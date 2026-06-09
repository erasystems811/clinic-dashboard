import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { deliverMobileMessage } from "../lib/messaging.js";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Queue table is the source of truth — populated by the checkin route.
  const { data: entries, error } = await supabase
    .from("queue")
    .select("*")
    .eq("hospital_id", hospital.code)
    .order("position", { ascending: true })
    .limit(500);

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!entries || entries.length === 0) { res.json([]); return; }

  // Enrich with live patient data
  const patientIds = entries.map(e => e.patient_id as number);
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone, email, whatsapp_number, patient_id, stage, department, checked_in_at")
    .in("id", patientIds);

  const patientMap = Object.fromEntries((patients ?? []).map(p => [p.id, p]));

  // Fetch appointment scheduled times for entries with an appointment_id
  const appointmentIds = entries
    .map(e => e.appointment_id as number | null)
    .filter((id): id is number => id != null);

  let appointmentScheduledMap: Record<number, string> = {};
  if (appointmentIds.length > 0) {
    const { data: apts } = await supabase
      .from("appointments")
      .select("id, scheduled_at")
      .in("id", appointmentIds);
    appointmentScheduledMap = Object.fromEntries((apts ?? []).map(a => [a.id, a.scheduled_at]));
  }

  const result = entries.map(e => {
    const p = patientMap[e.patient_id] ?? {} as Record<string, unknown>;
    return {
      ...camelize(e),
      patientId: e.patient_id,
      patientCode: (p.patient_id as string) ?? null,
      phone: (p.phone as string) ?? (e.phone as string) ?? null,
      email: (p.email as string) ?? (e.email as string) ?? null,
      whatsappNumber: (p.whatsapp_number as string) ?? (e.whatsapp_number as string) ?? null,
      department: (p.department as string) ?? null,
      hospitalId: hospital.code,
      appointmentScheduledAt: e.appointment_id ? (appointmentScheduledMap[e.appointment_id as number] ?? null) : null,
      doctorId: (e.doctor_id as number | null) ?? null,
      doctorName: (e.doctor_name as string | null) ?? null,
    };
  });

  res.json(result);
});

// ── GET /api/doctor/queue — doctor sees only their own queue ──────────────────
router.get("/doctor/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;
  if (!doctorId) { res.status(400).json({ error: "doctorId required" }); return; }

  const { data: entries, error } = await supabase
    .from("queue")
    .select("*")
    .eq("hospital_id", hospital.code)
    .eq("doctor_id", doctorId)
    .is("called_in_at", null)
    .order("position", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((entries ?? []).map(e => ({ ...camelize(e), patientId: e.patient_id, doctorId: e.doctor_id, doctorName: e.doctor_name })));
});

// ── GET /api/doctor/appointments — doctor sees their upcoming appointments ─────
router.get("/doctor/appointments", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : null;
  if (!doctorId) { res.status(400).json({ error: "doctorId required" }); return; }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("hospital_id", hospital.intId)
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", new Date().toISOString())
    .not("status", "in", '("cancelled","no_show","completed")')
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(a => ({
    ...camelize(a),
    duration: a.duration ?? a.duration_minutes ?? 30,
    patientId: a.patient_id,
    reassignedFromDoctorId: a.reassigned_from_doctor_id ?? null,
    reassignedFromDoctorName: a.reassigned_from_doctor_name ?? null,
    reassignmentNote: a.reassignment_note ?? null,
  })));
});

// ── POST /api/queue/:id/call-in — doctor calls patient in, sends SMS ────────
router.post("/queue/:id/call-in", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: entry } = await supabase
    .from("queue").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!entry) { res.status(404).json({ error: "Queue entry not found" }); return; }

  const now = new Date().toISOString();

  // Send SMS/WhatsApp first
  const phone = (entry.whatsapp_number as string) || (entry.phone as string);
  if (phone) {
    const doctorPart = entry.doctor_name ? ` with Dr. ${entry.doctor_name as string}` : "";
    const msg = `It's your turn! Please proceed to the consultation room${doctorPart}.`;
    const channel = entry.whatsapp_number ? "whatsapp" : "sms";
    deliverMobileMessage(channel, phone, msg).catch(() => {});
  }

  // Remove from queue and move patient to In Care
  await supabase.from("queue").delete().eq("id", id);
  await supabase.from("patients")
    .update({ stage: "In Care", updated_at: now })
    .eq("id", entry.patient_id as number);

  await supabase.from("activity").insert({
    type: "called_in",
    description: `${entry.patient_name as string} called in${entry.doctor_name ? ` by Dr. ${entry.doctor_name as string}` : ""} — moved to In Care`,
    patient_id: entry.patient_id as number,
    patient_name: entry.patient_name as string,
    hospital_id: hospital.intId,
    performed_by: (req.headers["x-performed-by"] as string | undefined) ?? null,
    staff_role: "doctor",
  });

  res.json({ ok: true, calledInAt: now });
});

export default router;
