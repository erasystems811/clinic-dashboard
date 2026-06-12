import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { generateOtp } from "../lib/patient-auth.js";
import { sendEmail } from "../lib/email.js";

const FROM = `ERA Health <${process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev"}>`;

const router: IRouter = Router();

// ── GET /api/patient-app/hospitals/search?q= ──────────────────────────────────
// Public — no auth needed. Searches hospitals by name or slug.
router.get("/patient-app/hospitals/search", async (req, res): Promise<void> => {
  const q = ((req.query.q as string) ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const { data } = await supabase
    .from("hospitals")
    .select("id, name, slug, logo_url")
    .eq("active", true)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(20);

  res.json(data ?? []);
});

// ── GET /api/patient-app/hospitals ────────────────────────────────────────────
// Returns all hospitals this account is connected to
router.get("/patient-app/hospitals", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: connections } = await supabase
    .from("patient_hospital_connections")
    .select("id, hospital_id, patient_record_id, verified_at")
    .eq("account_id", account.id);

  if (!connections || connections.length === 0) { res.json([]); return; }

  const hospitalIds = connections.map((c) => c.hospital_id as number);
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, name, slug, logo_url")
    .in("id", hospitalIds);

  const hospitalMap: Record<number, { name: string; slug: string; logo_url: string | null }> = {};
  for (const h of hospitals ?? []) {
    hospitalMap[h.id as number] = { name: h.name as string, slug: h.slug as string, logo_url: h.logo_url as string | null };
  }

  // Fetch patient record names for each connection
  const recordIds = connections.map((c) => c.patient_record_id as number);
  const { data: patientRecords } = await supabase
    .from("patients")
    .select("id, first_name, last_name, stage, department")
    .in("id", recordIds);

  const recordMap: Record<number, { firstName: string; lastName: string; stage: string; department: string | null }> = {};
  for (const p of patientRecords ?? []) {
    recordMap[p.id as number] = {
      firstName: p.first_name as string,
      lastName: p.last_name as string,
      stage: p.stage as string,
      department: p.department as string | null,
    };
  }

  const result = connections.map((c) => {
    const hospital = hospitalMap[c.hospital_id as number];
    const record = recordMap[c.patient_record_id as number];
    return {
      connectionId: c.id,
      hospitalId: c.hospital_id,
      hospitalName: hospital?.name ?? "Unknown",
      hospitalSlug: hospital?.slug ?? "",
      hospitalLogo: hospital?.logo_url ?? null,
      patientRecordId: c.patient_record_id,
      patientName: record ? `${record.firstName} ${record.lastName}` : "Unknown",
      stage: record?.stage ?? null,
      department: record?.department ?? null,
      verifiedAt: c.verified_at,
    };
  });

  res.json(result);
});

// ── POST /api/patient-app/hospitals/connect/request ───────────────────────────
// Takes { hospitalId, patientRecordId } — looks up patient email at that hospital
// and sends OTP to it
router.post("/patient-app/hospitals/connect/request", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { hospitalId, patientRecordId } = req.body ?? {};
  if (!hospitalId || !patientRecordId) {
    res.status(400).json({ error: "hospitalId and patientRecordId are required" });
    return;
  }

  // Check not already connected
  const { data: existing } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("account_id", account.id)
    .eq("hospital_id", hospitalId)
    .maybeSingle();

  if (existing) { res.status(409).json({ error: "Already connected to this hospital" }); return; }

  // Look up the hospital to get its code (UUID used as hospital_id in patients table)
  // Use select("*") so that absent/optional columns like hospital_code don't error.
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("*")
    .eq("id", hospitalId)
    .eq("active", true)
    .single();

  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  // hospital_code is a UUID column added later; fall back to username for older hospitals
  const hospitalCode = (hospital.hospital_code as string | null) ?? (hospital.username as string);
  const hospitalUsername = hospital.username as string;

  // Look up patient.  patients.hospital_id may store the UUID (hospital_code) for newer records
  // or the username string for older records — try both so backward-compat is preserved.
  const idStr = String(patientRecordId).trim();
  type PatientRow = { id: number; first_name: string; last_name: string; email: string };
  let patientRecord: PatientRow | null = null;

  async function findByHospitalId(hid: string): Promise<PatientRow | null> {
    // 1. Try patient_id column (the custom alphanumeric ID shown in the hospital dashboard)
    const { data: byPatientId } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email")
      .ilike("patient_id", idStr)
      .eq("hospital_id", hid)
      .maybeSingle();
    if (byPatientId) return byPatientId as PatientRow;

    // 2. Try numeric DB id (the auto-increment integer primary key)
    if (/^\d+$/.test(idStr)) {
      const { data: byId } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .eq("id", parseInt(idStr, 10))
        .eq("hospital_id", hid)
        .maybeSingle();
      if (byId) return byId as PatientRow;
    }
    return null;
  }

  patientRecord = await findByHospitalId(hospitalCode);
  // If not found with UUID code, also try with username (pre-hospital_code records)
  if (!patientRecord && hospitalCode !== hospitalUsername) {
    patientRecord = await findByHospitalId(hospitalUsername);
  }

  if (!patientRecord) {
    res.status(404).json({ error: "No patient record found with that ID at this hospital. Please check the ID and try again." });
    return;
  }

  const patientEmail = patientRecord.email as string;
  if (!patientEmail) {
    res.status(422).json({ error: "This patient record does not have an email address on file. Please contact the hospital." });
    return;
  }

  // Generate and store OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase.from("patient_otp_codes").insert({
    email: patientEmail,
    code: otp,
    purpose: "hospital_connect",
    expires_at: expiresAt,
  });

  // Send email
  const patientName = `${patientRecord.first_name} ${patientRecord.last_name}`;
  const hospitalName = hospital.name as string;

  await sendEmail({
    to: patientEmail,
    from: FROM,
    subject: `Your ERA Health verification code — ${hospitalName}`,
    html: `
      <p>Hi ${patientName},</p>
      <p>A request was made to link your patient record at <strong>${hospitalName}</strong> to an ERA Health account.</p>
      <p>Your verification code is:</p>
      <h2 style="font-size:32px;letter-spacing:8px;font-family:monospace;">${otp}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, please ignore this email — your hospital record is safe.</p>
    `,
  });

  // Return masked email so the UI can show "We sent a code to j***@gmail.com"
  const [localPart, domain] = patientEmail.split("@");
  const masked = `${localPart.slice(0, 2)}***@${domain}`;

  res.json({
    ok: true,
    maskedEmail: masked,
    patientName,
    hospitalName,
  });
});

// ── POST /api/patient-app/hospitals/connect/verify ────────────────────────────
// Takes { hospitalId, patientRecordId, otp }
router.post("/patient-app/hospitals/connect/verify", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { hospitalId, patientRecordId, otp } = req.body ?? {};
  if (!hospitalId || !patientRecordId || !otp) {
    res.status(400).json({ error: "hospitalId, patientRecordId, and otp are required" });
    return;
  }

  // Resolve patient email at this hospital
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("*")
    .eq("id", hospitalId)
    .single();

  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalCode = (hospital.hospital_code as string | null) ?? (hospital.username as string);
  const hospitalUsername = hospital.username as string;

  const verifyIdStr = String(patientRecordId).trim();
  type VerifyRow = { id: number; email: string };

  async function findVerifyRow(hid: string): Promise<VerifyRow | null> {
    const { data: byNum } = await supabase
      .from("patients").select("id, email")
      .ilike("patient_id", verifyIdStr).eq("hospital_id", hid).maybeSingle();
    if (byNum) return byNum as VerifyRow;
    if (/^\d+$/.test(verifyIdStr)) {
      const { data: byId } = await supabase
        .from("patients").select("id, email")
        .eq("id", parseInt(verifyIdStr, 10)).eq("hospital_id", hid).maybeSingle();
      if (byId) return byId as VerifyRow;
    }
    return null;
  }

  let patientRecord = await findVerifyRow(hospitalCode);
  if (!patientRecord && hospitalCode !== hospitalUsername) {
    patientRecord = await findVerifyRow(hospitalUsername);
  }

  if (!patientRecord) { res.status(404).json({ error: "Patient record not found" }); return; }

  const patientEmail = patientRecord.email as string;

  // Verify OTP
  const { data: otpRow } = await supabase
    .from("patient_otp_codes")
    .select("id, expires_at, used_at")
    .eq("email", patientEmail)
    .eq("code", otp)
    .eq("purpose", "hospital_connect")
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow) { res.status(400).json({ error: "Invalid or expired code" }); return; }
  if (new Date(otpRow.expires_at as string) < new Date()) {
    res.status(400).json({ error: "Code has expired — please request a new one" });
    return;
  }

  // Mark OTP used
  await supabase.from("patient_otp_codes").update({ used_at: new Date().toISOString() }).eq("id", otpRow.id);

  // Create connection — store patientRecord.id (INTEGER), not the user-typed string
  const { error: connError } = await supabase.from("patient_hospital_connections").upsert({
    account_id: account.id,
    hospital_id: hospitalId,
    patient_record_id: patientRecord.id,
    verified_at: new Date().toISOString(),
  }, { onConflict: "account_id,hospital_id" });

  if (connError) { res.status(500).json({ error: "Failed to save connection" }); return; }

  res.json({ ok: true });
});

// ── DELETE /api/patient-app/hospitals/:connectionId ───────────────────────────
router.delete("/patient-app/hospitals/:connectionId", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { connectionId } = req.params;
  await supabase
    .from("patient_hospital_connections")
    .delete()
    .eq("id", connectionId)
    .eq("account_id", account.id);

  res.json({ ok: true });
});

// ── GET /api/patient-app/hospitals/:connectionId/messages ─────────────────────
router.get("/patient-app/hospitals/:connectionId/messages", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);

  // Verify ownership
  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("account_id", account.id)
    .maybeSingle();

  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  // Mark hospital messages as read by patient
  await supabase
    .from("patient_hospital_messages")
    .update({ patient_read_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("sender", "hospital")
    .is("patient_read_at", null);

  const { data: messages } = await supabase
    .from("patient_hospital_messages")
    .select("id, sender, message_type, content, metadata, created_at")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true })
    .limit(100);

  res.json(messages ?? []);
});

// ── POST /api/patient-app/hospitals/:connectionId/messages ────────────────────
router.post("/patient-app/hospitals/:connectionId/messages", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  const { content, messageType = "text", metadata = {} } = req.body ?? {};

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" }); return;
  }

  // Verify ownership
  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("account_id", account.id)
    .maybeSingle();

  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  const { data: message, error } = await supabase
    .from("patient_hospital_messages")
    .insert({
      connection_id: connectionId,
      sender: "patient",
      message_type: messageType,
      content: content.trim(),
      metadata,
    })
    .select("id, sender, message_type, content, metadata, created_at")
    .single();

  if (error) { res.status(500).json({ error: "Failed to send message" }); return; }

  res.json(message);
});

// ── GET /api/patient-app/hospitals/unread ─────────────────────────────────────
// Returns unread message counts per connection
router.get("/patient-app/hospitals/unread", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: connections } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("account_id", account.id);

  if (!connections || connections.length === 0) { res.json({}); return; }

  const connectionIds = connections.map((c) => c.id as number);
  const { data: unread } = await supabase
    .from("patient_hospital_messages")
    .select("connection_id")
    .in("connection_id", connectionIds)
    .eq("sender", "hospital")
    .is("patient_read_at", null);

  const counts: Record<number, number> = {};
  for (const row of unread ?? []) {
    const id = row.connection_id as number;
    counts[id] = (counts[id] ?? 0) + 1;
  }

  res.json(counts);
});

// ── GET /api/patient-app/coins ────────────────────────────────────────────────
router.get("/patient-app/coins", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_accounts")
    .select("coins")
    .eq("id", account.id)
    .single();

  res.json({ coins: (data?.coins as number | undefined) ?? 0 });
});

// ── POST /api/patient-app/coins/award ────────────────────────────────────────
// Internal — called after module logging to award coins
router.post("/patient-app/coins/award", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, reason } = req.body ?? {};
  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" }); return;
  }

  await supabase
    .from("patient_accounts")
    .update({ coins: (account.coins as number ?? 0) + amount })
    .eq("id", account.id);

  await supabase.from("patient_coin_transactions").insert({
    account_id: account.id,
    amount,
    reason: reason ?? "wellness_log",
  });

  const { data } = await supabase
    .from("patient_accounts")
    .select("coins")
    .eq("id", account.id)
    .single();

  res.json({ coins: (data?.coins as number | undefined) ?? 0 });
});

export default router;
