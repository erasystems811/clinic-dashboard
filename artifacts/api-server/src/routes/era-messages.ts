import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { verifyHospitalToken } from "./super-admin.js";

const router: IRouter = Router();

function auth(req: Parameters<typeof verifyHospitalToken>[0]) {
  const token = (req as unknown as { headers: Record<string, string> }).headers["x-hospital-token"] as string;
  return token ? verifyHospitalToken(token) : null;
}

function authDoctor(req: Parameters<typeof verifyHospitalToken>[0]): { hospitalId: number; doctorId: number } | null {
  const hospitalId = auth(req);
  if (!hospitalId) return null;
  const raw = (req as unknown as { headers: Record<string, string> }).headers["x-doctor-id"] as string | undefined;
  const doctorId = raw ? parseInt(raw, 10) : NaN;
  if (!doctorId || isNaN(doctorId)) return null;
  return { hospitalId, doctorId };
}

async function insertSystemMessage(connectionId: number, text: string): Promise<void> {
  await supabase.from("patient_hospital_messages").insert({
    connection_id: connectionId,
    sender: "system",
    message_type: "event",
    content: text,
    metadata: {},
  });
}

async function logActivity(params: {
  type: string;
  description: string;
  patientId?: number | null;
  patientName?: string | null;
  hospitalId?: number | null;
  performedBy?: string | null;
}): Promise<void> {
  await supabase.from("activity").insert({
    type: params.type,
    description: params.description,
    patient_id: params.patientId ?? null,
    patient_name: params.patientName ?? null,
    hospital_id: params.hospitalId ?? null,
    performed_by: params.performedBy ?? null,
  });
}

// ── GET /era-messages/unread-count ────────────────────────────────────────────
router.get("/era-messages/unread-count", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: connections } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("hospital_id", hospitalId);

  if (!connections || connections.length === 0) { res.json({ count: 0 }); return; }

  const connIds = connections.map(c => c.id as number);
  const { count } = await supabase
    .from("patient_hospital_messages")
    .select("id", { count: "exact", head: true })
    .in("connection_id", connIds)
    .eq("sender", "patient")
    .is("hospital_read_at", null);

  res.json({ count: count ?? 0 });
});

// ── GET /era-messages/departments ─────────────────────────────────────────────
// Returns unique specialties of active doctors at this hospital
router.get("/era-messages/departments", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("hospital_doctors")
    .select("specialty")
    .eq("hospital_id", hospitalId)
    .eq("active", true);

  const depts = [
    ...new Set(
      (data ?? []).map(d => d.specialty as string | null).filter((s): s is string => !!s)
    ),
  ].sort();

  res.json(depts);
});

// ── GET /era-messages/doctors ─────────────────────────────────────────────────
router.get("/era-messages/doctors", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("hospital_doctors")
    .select("id, full_name, specialty")
    .eq("hospital_id", hospitalId)
    .eq("active", true)
    .order("full_name");

  res.json((data ?? []).map(d => ({
    id: d.id as number,
    fullName: d.full_name as string,
    specialty: (d.specialty as string | null) ?? null,
  })));
});

// ── GET /era-messages/doctor ──────────────────────────────────────────────────
// Doctor view: unclaimed convos in their specialty + convos they own
router.get("/era-messages/doctor", async (req, res): Promise<void> => {
  const ctx = authDoctor(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { hospitalId, doctorId } = ctx;

  const { data: doc } = await supabase
    .from("hospital_doctors")
    .select("id, specialty")
    .eq("id", doctorId)
    .eq("hospital_id", hospitalId)
    .eq("active", true)
    .maybeSingle();
  if (!doc) { res.status(403).json({ error: "Forbidden" }); return; }

  const specialty = (doc.specialty as string | null) ?? null;

  const [{ data: owned }, deptResult] = await Promise.all([
    supabase
      .from("patient_hospital_connections")
      .select("id, patient_record_id, routed_to_doctor_id, era_status, conversation_department")
      .eq("hospital_id", hospitalId)
      .eq("routed_to_doctor_id", doctorId)
      .neq("era_status", "resolved"),
    specialty
      ? supabase
          .from("patient_hospital_connections")
          .select("id, patient_record_id, routed_to_doctor_id, era_status, conversation_department")
          .eq("hospital_id", hospitalId)
          .eq("era_status", "open")
          .eq("conversation_department", specialty)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const ownedIds = new Set((owned ?? []).map(c => (c as { id: number }).id));
  type ConnRow = { id: number; patient_record_id: number; routed_to_doctor_id: number | null; era_status: string; conversation_department: string | null };
  const allConnections: ConnRow[] = [
    ...(owned ?? []) as ConnRow[],
    ...((deptResult.data ?? []) as ConnRow[]).filter(c => !ownedIds.has(c.id)),
  ];

  if (allConnections.length === 0) { res.json([]); return; }

  const connIds = allConnections.map(c => c.id);
  const patientIds = allConnections.map(c => c.patient_record_id);

  const [{ data: messages }, { data: patients }, { data: unreadRows }] = await Promise.all([
    supabase.from("patient_hospital_messages").select("id, connection_id, sender, content, created_at").in("connection_id", connIds).order("created_at", { ascending: false }),
    supabase.from("patients").select("id, first_name, last_name").in("id", patientIds),
    supabase.from("patient_hospital_messages").select("connection_id").in("connection_id", connIds).eq("sender", "patient").is("hospital_read_at", null),
  ]);

  const patientMap = new Map((patients ?? []).map(p => [p.id as number, p]));
  const unreadCount = new Map<number, number>();
  for (const r of unreadRows ?? []) {
    const cid = r.connection_id as number;
    unreadCount.set(cid, (unreadCount.get(cid) ?? 0) + 1);
  }
  const latestMsg = new Map<number, { content: string; sender: string; createdAt: string }>();
  for (const m of messages ?? []) {
    const cid = m.connection_id as number;
    if (!latestMsg.has(cid)) latestMsg.set(cid, { content: m.content as string, sender: m.sender as string, createdAt: m.created_at as string });
  }

  const convos = allConnections
    .filter(c => latestMsg.has(c.id))
    .map(c => {
      const patient = patientMap.get(c.patient_record_id);
      const latest = latestMsg.get(c.id)!;
      return {
        connectionId: c.id,
        patientId: c.patient_record_id,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
        lastMessage: latest.content,
        lastMessageSender: latest.sender,
        lastMessageAt: latest.createdAt,
        unread: unreadCount.get(c.id) ?? 0,
        eraStatus: c.era_status,
        routedToDoctorId: c.routed_to_doctor_id,
        conversationDepartment: c.conversation_department,
        isOwned: ownedIds.has(c.id),
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  res.json(convos);
});

// ── GET /era-messages/doctor/:connectionId ───────────────────────────────────
router.get("/era-messages/doctor/:connectionId", async (req, res): Promise<void> => {
  const ctx = authDoctor(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { hospitalId, doctorId } = ctx;

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const { data: doc } = await supabase
    .from("hospital_doctors")
    .select("id, specialty")
    .eq("id", doctorId)
    .eq("hospital_id", hospitalId)
    .eq("active", true)
    .maybeSingle();
  if (!doc) { res.status(403).json({ error: "Forbidden" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id, patient_record_id, era_status, routed_to_doctor_id, conversation_department")
    .eq("id", connectionId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const ownedByMe = (conn.routed_to_doctor_id as number | null) === doctorId;
  const specialty = (doc.specialty as string | null) ?? null;
  const unclaimedInMyDept = (conn.era_status as string) === "open" && !!specialty && (conn.conversation_department as string | null) === specialty;
  if (!ownedByMe && !unclaimedInMyDept) { res.status(403).json({ error: "Not assigned to you" }); return; }

  const [{ data: messages }, { data: patient }] = await Promise.all([
    supabase.from("patient_hospital_messages").select("id, sender, message_type, content, metadata, created_at").eq("connection_id", connectionId).order("created_at", { ascending: true }).limit(200),
    supabase.from("patients").select("id, first_name, last_name").eq("id", conn.patient_record_id as number).maybeSingle(),
  ]);

  await supabase.from("patient_hospital_messages").update({ hospital_read_at: new Date().toISOString() }).eq("connection_id", connectionId).eq("sender", "patient").is("hospital_read_at", null);

  res.json({
    connectionId,
    patientId: conn.patient_record_id,
    patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
    eraStatus: conn.era_status as string,
    routedToDoctorId: (conn.routed_to_doctor_id as number | null) ?? null,
    conversationDepartment: (conn.conversation_department as string | null) ?? null,
    isOwned: ownedByMe,
    messages: (messages ?? []).map(m => camelize(m)),
  });
});

// ── GET /era-messages ─────────────────────────────────────────────────────────
router.get("/era-messages", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: connections } = await supabase
    .from("patient_hospital_connections")
    .select("id, patient_record_id, routed_to_doctor_id, era_status, conversation_department")
    .eq("hospital_id", hospitalId);

  if (!connections || connections.length === 0) { res.json([]); return; }

  const connIds = connections.map(c => c.id as number);
  const patientIds = connections.map(c => c.patient_record_id as number);
  const doctorIds = [...new Set(connections.map(c => c.routed_to_doctor_id as number | null).filter((id): id is number => id != null))];

  const [{ data: messages }, { data: patients }, { data: unreadRows }, { data: doctors }] = await Promise.all([
    supabase.from("patient_hospital_messages").select("id, connection_id, sender, content, created_at").in("connection_id", connIds).order("created_at", { ascending: false }),
    supabase.from("patients").select("id, first_name, last_name").in("id", patientIds),
    supabase.from("patient_hospital_messages").select("connection_id").in("connection_id", connIds).eq("sender", "patient").is("hospital_read_at", null),
    doctorIds.length > 0 ? supabase.from("hospital_doctors").select("id, full_name").in("id", doctorIds) : Promise.resolve({ data: [] }),
  ]);

  const patientMap = new Map((patients ?? []).map(p => [p.id as number, p]));
  const doctorMap = new Map((doctors ?? []).map(d => [d.id as number, d.full_name as string]));
  const unreadCount = new Map<number, number>();
  for (const r of unreadRows ?? []) {
    const cid = r.connection_id as number;
    unreadCount.set(cid, (unreadCount.get(cid) ?? 0) + 1);
  }
  const latestMsg = new Map<number, { content: string; sender: string; createdAt: string }>();
  for (const m of messages ?? []) {
    const cid = m.connection_id as number;
    if (!latestMsg.has(cid)) latestMsg.set(cid, { content: m.content as string, sender: m.sender as string, createdAt: m.created_at as string });
  }

  const convos = connections
    .filter(c => latestMsg.has(c.id as number))
    .map(c => {
      const patient = patientMap.get(c.patient_record_id as number);
      const latest = latestMsg.get(c.id as number)!;
      const routedDoctorId = c.routed_to_doctor_id as number | null;
      return {
        connectionId: c.id as number,
        patientId: c.patient_record_id as number,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
        lastMessage: latest.content,
        lastMessageSender: latest.sender,
        lastMessageAt: latest.createdAt,
        unread: unreadCount.get(c.id as number) ?? 0,
        eraStatus: (c.era_status as string) ?? "open",
        routedToDoctorId: routedDoctorId,
        routedToDoctorName: routedDoctorId ? (doctorMap.get(routedDoctorId) ?? null) : null,
        conversationDepartment: (c.conversation_department as string | null) ?? null,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  res.json(convos);
});

// ── GET /era-messages/:connectionId ──────────────────────────────────────────
router.get("/era-messages/:connectionId", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id, patient_record_id, routed_to_doctor_id, era_status, conversation_department")
    .eq("id", connectionId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const routedDoctorId = conn.routed_to_doctor_id as number | null;

  const [{ data: messages }, { data: patient }, { data: doctor }] = await Promise.all([
    supabase.from("patient_hospital_messages").select("id, sender, message_type, content, metadata, created_at").eq("connection_id", connectionId).order("created_at", { ascending: true }).limit(200),
    supabase.from("patients").select("id, first_name, last_name").eq("id", conn.patient_record_id as number).maybeSingle(),
    routedDoctorId ? supabase.from("hospital_doctors").select("id, full_name").eq("id", routedDoctorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  res.json({
    connectionId,
    patientId: conn.patient_record_id,
    patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
    eraStatus: (conn.era_status as string) ?? "open",
    routedToDoctorId: routedDoctorId,
    routedToDoctorName: doctor ? (doctor.full_name as string) : null,
    conversationDepartment: (conn.conversation_department as string | null) ?? null,
    messages: (messages ?? []).map(m => camelize(m)),
  });
});

// ── POST /era-messages/:connectionId/read ────────────────────────────────────
router.post("/era-messages/:connectionId/read", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const { data: conn } = await supabase.from("patient_hospital_connections").select("id").eq("id", connectionId).eq("hospital_id", hospitalId).maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  await supabase.from("patient_hospital_messages").update({ hospital_read_at: new Date().toISOString() }).eq("connection_id", connectionId).eq("sender", "patient").is("hospital_read_at", null);
  res.json({ ok: true });
});

// ── POST /era-messages/:connectionId/claim ───────────────────────────────────
// Doctor self-claims an unclaimed conversation in their department
router.post("/era-messages/:connectionId/claim", async (req, res): Promise<void> => {
  const ctx = authDoctor(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { hospitalId, doctorId } = ctx;

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const [{ data: doc }, { data: conn }] = await Promise.all([
    supabase.from("hospital_doctors").select("id, full_name, specialty").eq("id", doctorId).eq("hospital_id", hospitalId).eq("active", true).maybeSingle(),
    supabase.from("patient_hospital_connections").select("id, patient_record_id, era_status, routed_to_doctor_id").eq("id", connectionId).eq("hospital_id", hospitalId).maybeSingle(),
  ]);
  if (!doc) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!conn) { res.status(404).json({ error: "Conversation not found" }); return; }
  if ((conn.era_status as string) === "resolved") { res.status(400).json({ error: "Conversation is already resolved" }); return; }
  if (conn.routed_to_doctor_id) { res.status(409).json({ error: "Conversation already claimed by another doctor" }); return; }

  const doctorName = doc.full_name as string;
  const patientId = conn.patient_record_id as number;

  const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  await supabase.from("patient_hospital_connections").update({ routed_to_doctor_id: doctorId, era_status: "routed", doctor_replied: false }).eq("id", connectionId);

  await Promise.all([
    insertSystemMessage(connectionId, `Dr. ${doctorName} claimed this conversation`),
    logActivity({ type: "era_message_claimed", description: `Dr. ${doctorName} claimed ERA conversation with ${patientName}`, patientId, patientName, hospitalId, performedBy: `Dr. ${doctorName}` }),
  ]);

  res.json({ ok: true, routedToDoctorId: doctorId, routedToDoctorName: doctorName });
});

// ── POST /era-messages/:connectionId/assign ───────────────────────────────────
// Assign a conversation to a specific doctor (owning doctor or admin)
router.post("/era-messages/:connectionId/assign", async (req, res): Promise<void> => {
  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const doctorCtx = authDoctor(req);
  const hospitalId = doctorCtx ? doctorCtx.hospitalId : auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { targetDoctorId } = req.body as { targetDoctorId?: number };
  if (!targetDoctorId) { res.status(400).json({ error: "targetDoctorId required" }); return; }

  // Doctors can only reassign conversations they own; admins can assign any
  let q = supabase.from("patient_hospital_connections").select("id, patient_record_id").eq("id", connectionId).eq("hospital_id", hospitalId);
  if (doctorCtx) q = q.eq("routed_to_doctor_id", doctorCtx.doctorId);
  const { data: conn } = await q.maybeSingle();
  if (!conn) { res.status(404).json({ error: "Conversation not found or not assigned to you" }); return; }

  const [{ data: targetDoc }, { data: fromDoc }] = await Promise.all([
    supabase.from("hospital_doctors").select("id, full_name").eq("id", targetDoctorId).eq("hospital_id", hospitalId).eq("active", true).maybeSingle(),
    doctorCtx ? supabase.from("hospital_doctors").select("full_name").eq("id", doctorCtx.doctorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!targetDoc) { res.status(404).json({ error: "Target doctor not found" }); return; }

  const toName = targetDoc.full_name as string;
  const fromName = fromDoc ? `Dr. ${fromDoc.full_name as string}` : "Admin";
  const patientId = conn.patient_record_id as number;

  const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  await supabase.from("patient_hospital_connections").update({ routed_to_doctor_id: targetDoctorId, era_status: "routed", doctor_replied: false }).eq("id", connectionId);

  await Promise.all([
    insertSystemMessage(connectionId, `Conversation assigned to Dr. ${toName}`),
    logActivity({ type: "era_message_assigned", description: `${fromName} assigned ERA conversation with ${patientName} to Dr. ${toName}`, patientId, patientName, hospitalId, performedBy: fromName }),
  ]);

  res.json({ ok: true, routedToDoctorId: targetDoctorId, routedToDoctorName: toName });
});

// ── POST /era-messages/:connectionId/resolve ─────────────────────────────────
router.post("/era-messages/:connectionId/resolve", async (req, res): Promise<void> => {
  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const doctorCtx = authDoctor(req);
  const hospitalId = doctorCtx ? doctorCtx.hospitalId : auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  let q = supabase.from("patient_hospital_connections").select("id, patient_record_id, routed_to_doctor_id").eq("id", connectionId).eq("hospital_id", hospitalId);
  if (doctorCtx) q = q.eq("routed_to_doctor_id", doctorCtx.doctorId);
  const { data: conn } = await q.maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const patientId = conn.patient_record_id as number;
  const routedDoctorId = conn.routed_to_doctor_id as number | null;

  const [{ data: patient }, { data: doc }] = await Promise.all([
    supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle(),
    routedDoctorId ? supabase.from("hospital_doctors").select("full_name").eq("id", routedDoctorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";
  const doctorName = doc ? (doc.full_name as string) : null;
  const resolvedBy = doctorName ? `Dr. ${doctorName}` : "Admin";

  await supabase.from("patient_hospital_connections").update({ era_status: "resolved" }).eq("id", connectionId);

  await Promise.all([
    insertSystemMessage(connectionId, `${resolvedBy} has resolved this conversation`),
    logActivity({ type: "era_message_resolved", description: `${resolvedBy} marked ERA conversation with ${patientName} as resolved`, patientId, patientName, hospitalId, performedBy: resolvedBy }),
  ]);

  res.json({ ok: true });
});

// ── POST /era-messages/:connectionId/send ────────────────────────────────────
router.post("/era-messages/:connectionId/send", async (req, res): Promise<void> => {
  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const doctorCtx = authDoctor(req);
  const hospitalId = doctorCtx ? doctorCtx.hospitalId : auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  let q = supabase.from("patient_hospital_connections").select("id, account_id, doctor_replied, routed_to_doctor_id").eq("id", connectionId).eq("hospital_id", hospitalId);
  if (doctorCtx) q = q.eq("routed_to_doctor_id", doctorCtx.doctorId);
  const { data: conn } = await q.maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  if (doctorCtx && !(conn.doctor_replied as boolean)) {
    const { data: doc } = await supabase.from("hospital_doctors").select("full_name").eq("id", doctorCtx.doctorId).maybeSingle();
    const doctorName = doc ? (doc.full_name as string) : "Doctor";
    await insertSystemMessage(connectionId, `Dr. ${doctorName} has started the conversation`);
    await supabase.from("patient_hospital_connections").update({ doctor_replied: true }).eq("id", connectionId);
  }

  const { data, error } = await supabase
    .from("patient_hospital_messages")
    .insert({ connection_id: connectionId, sender: "hospital", message_type: "text", content: content.trim(), metadata: {} })
    .select()
    .single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  if (conn.account_id) {
    void supabase.from("patient_notifications").insert({
      account_id: conn.account_id as number,
      type: "message",
      title: "New message from your hospital",
      body: content.trim().slice(0, 100),
      metadata: { connectionId },
    });
  }

  res.status(201).json(camelize(data));
});

export default router;
