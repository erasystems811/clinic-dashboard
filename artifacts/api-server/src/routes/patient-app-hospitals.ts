import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { generateOtp } from "../lib/patient-auth.js";
import { sendEmail } from "../lib/email.js";

const FROM = "ERA Me <noreply@erasystems.io>";

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
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("id, name, hospital_code, username")
    .eq("id", hospitalId)
    .eq("active", true)
    .single();

  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalCode = (hospital.hospital_code as string | null) ?? (hospital.username as string);

  // Look up patient record at this hospital using the provided record ID
  const { data: patientRecord } = await supabase
    .from("patients")
    .select("id, first_name, last_name, email")
    .eq("id", patientRecordId)
    .eq("hospital_id", hospitalCode)
    .single();

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
    subject: `Your ERA Me verification code — ${hospitalName}`,
    html: `
      <p>Hi ${patientName},</p>
      <p>A request was made to link your patient record at <strong>${hospitalName}</strong> to an ERA Me account.</p>
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
    .select("id, hospital_code, username")
    .eq("id", hospitalId)
    .single();

  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalCode = (hospital.hospital_code as string | null) ?? (hospital.username as string);

  const { data: patientRecord } = await supabase
    .from("patients")
    .select("id, email")
    .eq("id", patientRecordId)
    .eq("hospital_id", hospitalCode)
    .single();

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

  // Create connection (or silently succeed if already exists)
  const { error: connError } = await supabase.from("patient_hospital_connections").upsert({
    account_id: account.id,
    hospital_id: hospitalId,
    patient_record_id: patientRecordId,
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
    .eq("account_id", account.id); // ensures ownership

  res.json({ ok: true });
});

export default router;
