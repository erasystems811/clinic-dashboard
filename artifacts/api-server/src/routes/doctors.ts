import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { getHospitalFromRequest, verifyHospitalToken } from "../lib/hospital-auth.js";
import { sendEmail, wrapHtml } from "../lib/email.js";

const router: IRouter = Router();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function generatePassword(): string {
  const adj = ["Blue", "Swift", "Clear", "Bright", "Strong", "Fresh", "Bold", "Smart", "Pure", "Calm"];
  const noun = ["Star", "Rock", "Lake", "Wave", "Tree", "Stone", "Cloud", "River", "Eagle", "Tiger"];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${num}`;
}

function fromAddress(): string {
  const email = process.env.PLATFORM_FROM_EMAIL || "onboarding@resend.dev";
  const name = process.env.PLATFORM_FROM_NAME || "Era Systems";
  return `${name} <${email}>`;
}

async function sendDoctorInviteEmail(doctorEmail: string, doctorName: string, hospitalName: string, username: string, password: string): Promise<void> {
  const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
  const body = `Hi Dr. ${doctorName},\n\nYou have been added to ${hospitalName}'s clinical team on Era Systems.\n\nYour login credentials:\nUsername: ${username}\nPassword: ${password}\n\nLog in at: ${appUrl}/login\n\nIf you did not expect this email, contact your hospital administrator.\n\nWarm regards,\nEra Systems`;
  const html = wrapHtml(`
    <p>Hi <strong>Dr. ${doctorName}</strong>,</p>
    <p>You have been added to <strong>${hospitalName}</strong>'s clinical team on Era Systems.</p>
    <p>Your login credentials:</p>
    <table style="margin:12px 0;border-collapse:collapse;">
      <tr><td style="padding:4px 16px 4px 0;color:#888;font-size:14px;">Username</td><td style="font-weight:bold;font-family:monospace;font-size:14px;">${username}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#888;font-size:14px;">Password</td><td style="font-weight:bold;font-family:monospace;font-size:14px;">${password}</td></tr>
    </table>
    <p>Log in at: <a href="${appUrl}/login">${appUrl}/login</a></p>
    <p style="font-size:13px;color:#888;">If you did not expect this, contact your hospital administrator.</p>
  `, hospitalName);
  await sendEmail({ to: doctorEmail, from: fromAddress(), subject: `Your Era Systems login — ${hospitalName}`, html, text: body });
}

// ── GET /api/hospital/doctors ─────────────────────────────────────────────────
router.get("/hospital/doctors", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("hospital_doctors")
    .select("id, full_name, email, specialty, username, active, unavailable, created_at")
    .eq("hospital_id", ctx.intId)
    .order("full_name", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(d => ({
    id: d.id as number,
    fullName: d.full_name as string,
    email: d.email as string,
    specialty: (d.specialty as string | null) ?? null,
    username: d.username as string,
    active: d.active as boolean,
    unavailable: (d.unavailable as boolean) ?? false,
    createdAt: d.created_at as string,
  })));
});

// ── POST /api/hospital/doctors ────────────────────────────────────────────────
router.post("/hospital/doctors", async (req: Request, res: Response): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { fullName, email, specialty } = (req.body ?? {}) as Record<string, string>;
  if (!fullName?.trim() || !email?.trim()) {
    res.status(400).json({ error: "fullName and email are required" }); return;
  }

  const { data: hospital } = await supabase.from("hospitals").select("name, active").eq("id", hospitalId).single();
  if (!hospital?.active) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Generate username: DR.FIRSTNAME.LASTNAME
  const nameParts = fullName.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ").filter(Boolean);
  let username = `DR.${nameParts.join(".")}`;
  let suffix = 1;
  while (true) {
    const { data: existing } = await supabase.from("hospital_doctors").select("id").eq("username", username).maybeSingle();
    if (!existing) break;
    username = `DR.${nameParts.join(".")}.${suffix++}`;
  }

  const plainPassword = generatePassword();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(plainPassword, salt)}`;

  const { data: doctor, error } = await supabase
    .from("hospital_doctors")
    .insert({ hospital_id: hospitalId, full_name: fullName.trim(), email: email.trim(), specialty: specialty?.trim() || null, username, password_hash: passwordHash })
    .select("id, full_name, email, specialty, username, active, unavailable, created_at")
    .single();

  if (error || !doctor) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  sendDoctorInviteEmail(email.trim(), fullName.trim(), hospital.name as string, username, plainPassword)
    .catch(err => console.error("[doctor-invite]", err));

  res.status(201).json({
    id: doctor.id as number,
    fullName: doctor.full_name as string,
    email: doctor.email as string,
    specialty: (doctor.specialty as string | null) ?? null,
    username: doctor.username as string,
    active: doctor.active as boolean,
    unavailable: (doctor.unavailable as boolean) ?? false,
    createdAt: doctor.created_at as string,
  });
});

// ── PATCH /api/hospital/doctors/:id ──────────────────────────────────────────
router.patch("/hospital/doctors/:id", async (req: Request, res: Response): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof body.fullName === "string") updates.full_name = (body.fullName as string).trim();
  if (typeof body.email === "string") updates.email = (body.email as string).trim();
  if (typeof body.specialty !== "undefined") updates.specialty = body.specialty || null;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.unavailable === "boolean") updates.unavailable = body.unavailable;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields" }); return; }

  const { data, error } = await supabase
    .from("hospital_doctors")
    .update(updates)
    .eq("id", id)
    .eq("hospital_id", hospitalId)
    .select("id, full_name, email, specialty, username, active, unavailable, created_at")
    .single();

  if (error || !data) { res.status(404).json({ error: "Doctor not found" }); return; }

  res.json({
    id: data.id as number,
    fullName: data.full_name as string,
    email: data.email as string,
    specialty: (data.specialty as string | null) ?? null,
    username: data.username as string,
    active: data.active as boolean,
    unavailable: (data.unavailable as boolean) ?? false,
    createdAt: data.created_at as string,
  });
});

// ── DELETE /api/hospital/doctors/:id ─────────────────────────────────────────
router.delete("/hospital/doctors/:id", async (req: Request, res: Response): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { count: queueCount } = await supabase
    .from("queue").select("*", { count: "exact", head: true }).eq("doctor_id", id);
  if ((queueCount ?? 0) > 0) {
    res.status(409).json({ error: `Cannot delete — this doctor has ${queueCount} patient(s) in their queue. Transfer them first.` }); return;
  }

  const { count: apptCount } = await supabase
    .from("appointments").select("*", { count: "exact", head: true })
    .eq("doctor_id", id).gte("scheduled_at", new Date().toISOString())
    .not("status", "in", '("cancelled","no_show","completed")');
  if ((apptCount ?? 0) > 0) {
    res.status(409).json({ error: `Cannot delete — this doctor has ${apptCount} upcoming appointment(s). Reassign them first.` }); return;
  }

  await supabase.from("hospital_doctors").delete().eq("id", id).eq("hospital_id", hospitalId);
  res.sendStatus(204);
});

// ── PATCH /api/doctor/availability — doctor marks themselves unavailable/available
router.patch("/doctor/availability", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const doctorId = Number(body.doctorId);
  const unavailable = body.unavailable as boolean | undefined;
  if (!doctorId || typeof unavailable !== "boolean") {
    res.status(400).json({ error: "doctorId and unavailable required" }); return;
  }

  const { data: doctor, error } = await supabase
    .from("hospital_doctors")
    .update({ unavailable })
    .eq("id", doctorId)
    .eq("hospital_id", ctx.intId)
    .select("full_name")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("activity").insert({
    type: unavailable ? "doctor_unavailable" : "doctor_available",
    description: `Dr. ${doctor?.full_name ?? "Unknown"} marked as ${unavailable ? "unavailable" : "available"}`,
    hospital_id: ctx.intId,
    performed_by: (doctor?.full_name as string) ?? null,
    staff_role: "doctor",
  });

  res.json({ ok: true, unavailable });
});

// ── POST /api/queue/:id/transfer — transfer queued patient to another doctor ──
router.post("/queue/:id/transfer", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const queueId = parseInt(req.params.id, 10);
  if (isNaN(queueId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { doctorId, performedBy } = (req.body ?? {}) as Record<string, unknown>;
  if (!doctorId) { res.status(400).json({ error: "doctorId required" }); return; }

  const { data: doctor } = await supabase
    .from("hospital_doctors")
    .select("full_name")
    .eq("id", Number(doctorId))
    .eq("hospital_id", ctx.intId)
    .single();
  if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

  // Get current position count for destination doctor to place at end
  const { count: destCount } = await supabase
    .from("queue").select("*", { count: "exact", head: true })
    .eq("hospital_id", ctx.code)
    .eq("doctor_id", Number(doctorId));

  const newPosition = (destCount ?? 0) + 1;

  const { data: entry, error } = await supabase
    .from("queue")
    .update({ doctor_id: Number(doctorId), doctor_name: doctor.full_name as string, position: newPosition })
    .eq("id", queueId)
    .select("patient_name")
    .single();

  if (error || !entry) { res.status(404).json({ error: "Queue entry not found" }); return; }

  await supabase.from("activity").insert({
    type: "patient_transferred",
    description: `${entry.patient_name} transferred to Dr. ${doctor.full_name}`,
    hospital_id: ctx.intId,
    performed_by: (performedBy as string) ?? null,
    staff_role: "doctor",
  });

  res.json({ ok: true });
});

// ── Doctor follow-ups ─────────────────────────────────────────────────────────

router.post("/doctor/follow-ups", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { doctorId, patientName, phone, reason, assignTo } = req.body ?? {};
  if (!doctorId || !patientName || !reason) {
    res.status(400).json({ error: "doctorId, patientName, reason are required" }); return;
  }

  if (assignTo === "receptionist") {
    // Create a regular call task so the receptionist sees it in their Call Tasks page
    const { error } = await supabase.from("call_tasks").insert({
      patient_id: 0,
      patient_name: patientName,
      phone: phone ?? "",
      hospital_id: ctx.code,
      reason,
      task_type: "doctor_referral",
      action_type: "manual_call",
    });
    if (error) { res.status(500).json({ error: error.message }); return; }
  } else {
    // Store as doctor's own follow-up
    const { error } = await supabase.from("doctor_follow_ups").insert({
      doctor_id: Number(doctorId),
      hospital_id: ctx.intId,
      patient_name: patientName,
      phone: phone ?? null,
      reason,
      status: "pending",
    });
    if (error) { res.status(500).json({ error: error.message }); return; }
  }

  res.status(201).json({ ok: true });
});

router.get("/doctor/follow-ups", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const doctorId = parseInt(req.query.doctorId as string, 10);
  if (!doctorId) { res.status(400).json({ error: "doctorId required" }); return; }

  const { data, error } = await supabase
    .from("doctor_follow_ups")
    .select("id, patient_name, phone, reason, status, created_at")
    .eq("doctor_id", doctorId)
    .eq("hospital_id", ctx.intId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(r => ({
    id: r.id,
    patientName: r.patient_name,
    phone: r.phone,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  })));
});

router.patch("/doctor/follow-ups/:id/complete", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  await supabase.from("doctor_follow_ups")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("hospital_id", ctx.intId);

  res.json({ ok: true });
});

export default router;
