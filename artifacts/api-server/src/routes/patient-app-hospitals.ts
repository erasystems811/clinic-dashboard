import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { generateOtp } from "../lib/patient-auth.js";
import { sendEmail } from "../lib/email.js";

const FROM = `ERA Health <${process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev"}>`;

// ── Shared slot generation (mirrors self-booking.ts logic) ─────────────────────
function generateSlots(
  blocks: { day_of_week: number; start_time: string; end_time: string; slot_minutes: number }[],
  days = 30
): string[] {
  const slots: string[] = [];
  const now = new Date();
  for (let d = 1; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    for (const block of blocks.filter(b => b.day_of_week === dow)) {
      const [sH, sM] = block.start_time.split(":").map(Number);
      const [eH, eM] = block.end_time.split(":").map(Number);
      let cur = sH * 60 + sM;
      const end = eH * 60 + eM;
      while (cur + block.slot_minutes <= end) {
        const slot = new Date(date);
        slot.setHours(Math.floor(cur / 60), cur % 60, 0, 0);
        if (slot > now) slots.push(slot.toISOString());
        cur += block.slot_minutes;
      }
    }
  }
  return slots;
}

// Shared ownership check helper
async function resolveConnection(connectionId: number, accountId: number) {
  const { data } = await supabase
    .from("patient_hospital_connections")
    .select("id, hospital_id, patient_record_id")
    .eq("id", connectionId)
    .eq("account_id", accountId)
    .maybeSingle();
  return data as { id: number; hospital_id: number; patient_record_id: number } | null;
}

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

  // Fetch patient record names + active care plans in parallel
  const recordIds = connections.map((c) => c.patient_record_id as number);
  const [{ data: patientRecords }, { data: activeCarePlans }] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, stage, department").in("id", recordIds),
    supabase.from("care_plans").select("patient_id").in("patient_id", recordIds).eq("status", "active"),
  ]);

  const inCareSet = new Set((activeCarePlans ?? []).map((r) => r.patient_id as number));

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
    const rid = c.patient_record_id as number;
    return {
      connectionId: c.id,
      hospitalId: c.hospital_id,
      hospitalName: hospital?.name ?? "Unknown",
      hospitalSlug: hospital?.slug ?? "",
      hospitalLogo: hospital?.logo_url ?? null,
      patientRecordId: c.patient_record_id,
      patientName: record ? `${record.firstName} ${record.lastName}` : "Unknown",
      // "In Care" is derived from having an active care plan — mirrors hospital admin logic
      stage: inCareSet.has(rid) ? "In Care" : (record?.stage ?? null),
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

  try {
    await sendEmail({
      to: patientEmail,
      from: FROM,
      subject: `Your ERA Health verification code — ${hospitalName}`,
      html: `
        <p>Hi ${patientName},</p>
        <p>A request was made to link your patient record at <strong>${hospitalName}</strong> to your ERA Health account.</p>
        <p>Your verification code is:</p>
        <h2 style="font-size:36px;letter-spacing:10px;font-family:monospace;background:#f4f4f5;padding:16px 24px;border-radius:8px;display:inline-block;">${otp}</h2>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });
  } catch (emailErr) {
    console.error("[hospital-connect] Failed to send OTP email to", patientEmail, emailErr);
    // Clean up the OTP we just stored since it won't be usable
    await supabase.from("patient_otp_codes").delete().eq("email", patientEmail).eq("code", otp);
    res.status(503).json({
      error: "Could not send verification email. Please check that the email address on your hospital record is correct, or contact the hospital.",
      detail: process.env.NODE_ENV !== "production" ? String(emailErr) : undefined,
    });
    return;
  }

  // Return masked email so the UI can show "We sent a code to j***@gmail.com"
  const [localPart, domain] = patientEmail.split("@");
  const masked = `${localPart.slice(0, 2)}***@${domain}`;

  console.log(`[hospital-connect] OTP sent to ${masked} for patient ${patientName} at ${hospitalName}`);

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
    .order("created_at", { ascending: true });

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

// ── GET /api/patient-app/hospitals/:connectionId/booking-slots ────────────────
router.get("/patient-app/hospitals/:connectionId/booking-slots", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  const conn = await resolveConnection(connectionId, (account as { id: number }).id);
  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  const hospitalId = conn.hospital_id;

  const { data: hospital } = await supabase.from("hospitals").select("name").eq("id", hospitalId).single();
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const [{ data: blocks }, { data: takenAppts }, { data: takenBookings }] = await Promise.all([
    supabase.from("appointment_time_blocks").select("*").eq("hospital_id", hospitalId).eq("active", true),
    supabase.from("appointments").select("scheduled_at")
      .eq("hospital_id", hospitalId).gte("scheduled_at", new Date().toISOString())
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("requested_at")
      .eq("hospital_id", hospitalId).in("status", ["pending", "confirmed"]),
  ]);

  const takenSet = new Set([
    ...(takenAppts ?? []).map(a => new Date(a.scheduled_at as string).toISOString()),
    ...(takenBookings ?? []).map(b => new Date(b.requested_at as string).toISOString()),
  ]);

  type Block = { day_of_week: number; start_time: string; end_time: string; slot_minutes: number };
  const allSlots = generateSlots((blocks ?? []) as Block[]);
  const available = allSlots
    .filter(s => !takenSet.has(s))
    .slice(0, 40)
    .map(s => ({
      datetime: s,
      label: new Date(s).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
      }),
    }));

  res.json({ hospitalName: hospital.name as string, slots: available });
});

// ── POST /api/patient-app/hospitals/:connectionId/book ────────────────────────
router.post("/patient-app/hospitals/:connectionId/book", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  const conn = await resolveConnection(connectionId, (account as { id: number }).id);
  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  const { requestedAt, reason } = (req.body ?? {}) as Record<string, unknown>;
  if (!requestedAt || !reason || typeof reason !== "string" || !reason.trim()) {
    res.status(400).json({ error: "requestedAt and reason are required" }); return;
  }

  const { data: patient } = await supabase
    .from("patients").select("first_name, last_name, phone").eq("id", conn.patient_record_id).single();
  if (!patient) { res.status(404).json({ error: "Patient record not found" }); return; }

  const requestedAtIso = new Date(requestedAt as string).toISOString();

  // Slot collision check
  const [{ count: apptCount }, { count: bookCount }] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("hospital_id", conn.hospital_id).eq("scheduled_at", requestedAtIso)
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("*", { count: "exact", head: true })
      .eq("hospital_id", conn.hospital_id).eq("requested_at", requestedAtIso)
      .in("status", ["pending", "confirmed"]),
  ]);

  if ((apptCount ?? 0) > 0 || (bookCount ?? 0) > 0) {
    res.status(409).json({ error: "This slot is no longer available. Please choose another time." }); return;
  }

  const { data: booking, error } = await supabase.from("self_bookings").insert({
    hospital_id: conn.hospital_id,
    patient_name: `${patient.first_name as string} ${patient.last_name as string}`,
    patient_phone: patient.phone as string,
    reason: reason.trim(),
    requested_at: requestedAtIso,
    status: "pending",
  }).select("id").single();

  if (error || !booking) { res.status(500).json({ error: "Failed to create booking request" }); return; }

  res.status(201).json({
    id: booking.id as number,
    message: "Booking request submitted. The clinic will confirm it shortly.",
  });
});

// ── GET /api/patient-app/hospitals/:connectionId/my-bookings ─────────────────
router.get("/patient-app/hospitals/:connectionId/my-bookings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  const conn = await resolveConnection(connectionId, (account as { id: number }).id);
  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  const { data: patient } = await supabase
    .from("patients").select("first_name, last_name").eq("id", conn.patient_record_id).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const patientName = `${patient.first_name as string} ${patient.last_name as string}`;

  const { data } = await supabase
    .from("self_bookings")
    .select("id, reason, requested_at, status")
    .eq("hospital_id", conn.hospital_id)
    .eq("patient_name", patientName)
    .in("status", ["pending", "confirmed"])
    .order("requested_at", { ascending: true });

  res.json((data ?? []).map(b => ({
    id: b.id as number,
    reason: b.reason as string,
    requestedAt: b.requested_at as string,
    status: b.status as string,
  })));
});

// ── POST /api/patient-app/hospitals/:connectionId/reschedule ──────────────────
router.post("/patient-app/hospitals/:connectionId/reschedule", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const connectionId = parseInt(req.params.connectionId, 10);
  const conn = await resolveConnection(connectionId, (account as { id: number }).id);
  if (!conn) { res.status(403).json({ error: "Connection not found" }); return; }

  const { bookingId, newRequestedAt } = (req.body ?? {}) as Record<string, unknown>;
  if (!bookingId || !newRequestedAt) {
    res.status(400).json({ error: "bookingId and newRequestedAt are required" }); return;
  }

  const { data: patient } = await supabase
    .from("patients").select("first_name, last_name").eq("id", conn.patient_record_id).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const patientName = `${patient.first_name as string} ${patient.last_name as string}`;

  const { data: booking } = await supabase
    .from("self_bookings")
    .select("id, status")
    .eq("id", bookingId as number)
    .eq("hospital_id", conn.hospital_id)
    .eq("patient_name", patientName)
    .maybeSingle();

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  if (!["pending", "confirmed"].includes(booking.status as string)) {
    res.status(400).json({ error: "This booking cannot be rescheduled" }); return;
  }

  const newIso = new Date(newRequestedAt as string).toISOString();

  // Slot collision check
  const [{ count: apptCount }, { count: bookCount }] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("hospital_id", conn.hospital_id).eq("scheduled_at", newIso)
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("*", { count: "exact", head: true })
      .eq("hospital_id", conn.hospital_id).eq("requested_at", newIso)
      .in("status", ["pending", "confirmed"])
      .neq("id", bookingId as number),
  ]);
  if ((apptCount ?? 0) > 0 || (bookCount ?? 0) > 0) {
    res.status(409).json({ error: "This slot is no longer available. Please choose another time." }); return;
  }

  await supabase.from("self_bookings").update({ requested_at: newIso, status: "pending" }).eq("id", bookingId as number);

  res.json({ ok: true, message: "Reschedule request submitted. The clinic will confirm your new time shortly." });
});

// ── GET /api/patient-app/notifications ───────────────────────────────────────
router.get("/patient-app/notifications", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_notifications")
    .select("id, type, title, body, metadata, read_at, actioned_at, created_at")
    .eq("account_id", (account as { id: number }).id)
    .order("created_at", { ascending: false })
    .limit(50);

  res.json(data ?? []);
});

// ── GET /api/patient-app/notifications/unread-count ──────────────────────────
router.get("/patient-app/notifications/unread-count", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { count } = await supabase
    .from("patient_notifications")
    .select("*", { count: "exact", head: true })
    .eq("account_id", (account as { id: number }).id)
    .is("read_at", null);

  res.json({ count: count ?? 0 });
});

// ── POST /api/patient-app/notifications/:id/read ──────────────────────────────
router.post("/patient-app/notifications/:id/read", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  await supabase
    .from("patient_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parseInt(req.params.id, 10))
    .eq("account_id", (account as { id: number }).id)
    .is("read_at", null);

  res.json({ ok: true });
});

// ── POST /api/patient-app/notifications/:id/action ────────────────────────────
// Marks a notification as acted on (e.g. feedback submitted)
router.post("/patient-app/notifications/:id/action", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  await supabase
    .from("patient_notifications")
    .update({ actioned_at: new Date().toISOString(), read_at: new Date().toISOString() })
    .eq("id", parseInt(req.params.id, 10))
    .eq("account_id", (account as { id: number }).id);

  res.json({ ok: true });
});

export default router;
