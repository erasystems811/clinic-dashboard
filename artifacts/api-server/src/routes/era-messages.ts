import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { verifyHospitalToken } from "./super-admin.js";

const router: IRouter = Router();

function auth(req: Parameters<typeof verifyHospitalToken>[0]) {
  const token = (req as unknown as { headers: Record<string, string> }).headers["x-hospital-token"] as string;
  return token ? verifyHospitalToken(token) : null;
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

// ── GET /era-messages ─────────────────────────────────────────────────────────
// Returns conversations (connections) sorted by latest message
router.get("/era-messages", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: connections } = await supabase
    .from("patient_hospital_connections")
    .select("id, patient_record_id")
    .eq("hospital_id", hospitalId);

  if (!connections || connections.length === 0) { res.json([]); return; }

  const connIds = connections.map(c => c.id as number);
  const patientIds = connections.map(c => c.patient_record_id as number);

  const [{ data: messages }, { data: patients }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("patient_hospital_messages")
      .select("id, connection_id, sender, content, created_at")
      .in("connection_id", connIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .in("id", patientIds),
    supabase
      .from("patient_hospital_messages")
      .select("connection_id")
      .in("connection_id", connIds)
      .eq("sender", "patient")
      .is("hospital_read_at", null),
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
    if (!latestMsg.has(cid)) {
      latestMsg.set(cid, { content: m.content as string, sender: m.sender as string, createdAt: m.created_at as string });
    }
  }

  const convos = connections
    .filter(c => latestMsg.has(c.id as number))
    .map(c => {
      const patient = patientMap.get(c.patient_record_id as number);
      const latest = latestMsg.get(c.id as number)!;
      return {
        connectionId: c.id as number,
        patientId: c.patient_record_id as number,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
        lastMessage: latest.content,
        lastMessageSender: latest.sender,
        lastMessageAt: latest.createdAt,
        unread: unreadCount.get(c.id as number) ?? 0,
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
    .select("id, patient_record_id")
    .eq("id", connectionId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const [{ data: messages }, { data: patient }] = await Promise.all([
    supabase
      .from("patient_hospital_messages")
      .select("id, sender, message_type, content, metadata, created_at")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("id", conn.patient_record_id as number)
      .maybeSingle(),
  ]);

  res.json({
    connectionId,
    patientId: conn.patient_record_id,
    patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
    messages: (messages ?? []).map(m => camelize(m)),
  });
});

// ── POST /era-messages/:connectionId/read ────────────────────────────────────
router.post("/era-messages/:connectionId/read", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  await supabase
    .from("patient_hospital_messages")
    .update({ hospital_read_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("sender", "patient")
    .is("hospital_read_at", null);

  res.json({ ok: true });
});

// ── POST /era-messages/:connectionId/send ────────────────────────────────────
router.post("/era-messages/:connectionId/send", async (req, res): Promise<void> => {
  const hospitalId = auth(req);
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  if (isNaN(connectionId)) { res.status(400).json({ error: "Invalid connection ID" }); return; }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id, account_id")
    .eq("id", connectionId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) { res.status(404).json({ error: "Not found" }); return; }

  const { data, error } = await supabase
    .from("patient_hospital_messages")
    .insert({
      connection_id: connectionId,
      sender: "hospital",
      message_type: "text",
      content: content.trim(),
      metadata: {},
    })
    .select()
    .single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  // Notify patient in ERA app (non-fatal)
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
