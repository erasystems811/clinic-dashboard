import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, snakify } from "../lib/camel.js";
import { z } from "zod/v4";
import {
  sendAppointmentConfirmationEmail as sendAppointmentConfirmation,
  sendAppointmentRescheduleEmail as sendAppointmentReschedule,
  sendAppointmentNoShowEmail as sendAppointmentNoShowFollowUp,
} from "../lib/automation.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const ListAppointmentsQuery = z.object({
  patientId: z.coerce.number().int().optional(),
  date: z.string().optional(),
  status: z.string().optional(),
});

const CreateAppointmentBody = z.object({
  patientId: z.number().int(),
  title: z.string().min(1),
  scheduledAt: z.string().min(1),
  duration: z.number().int().optional(),
  durationMinutes: z.number().int().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  doctorId: z.number().int().optional(),
  doctorName: z.string().optional(),
});

const UpdateAppointmentBody = z.object({
  status: z.string().optional(),
  scheduledAt: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  doctorId: z.number().int().optional(),
  doctorName: z.string().optional(),
  durationMinutes: z.number().int().optional(),
});

async function resolveHospitalIntId(hospitalCodeOrNull: string | null): Promise<number | null> {
  if (!hospitalCodeOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCodeOrNull).single();
  return data?.id ?? null;
}

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQuery.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const nowIso = new Date().toISOString();

  // Auto-mark past "scheduled" (or legacy null-status) appointments as no_show.
  // This runs fire-and-forget so it doesn't block the response.
  supabase.from("appointments")
    .update({ status: "no_show" })
    .eq("hospital_id", hospital.intId)
    .lt("scheduled_at", nowIso)
    .or("status.eq.scheduled,status.is.null")
    .then(() => {});

  let q = supabase.from("appointments")
    .select("*")
    .eq("hospital_id", hospital.intId);

  if (query.data.status) {
    q = q.eq("status", query.data.status);
  }

  if (query.data.patientId) {
    q = q.eq("patient_id", query.data.patientId);
  }

  const { data, error } = await q.order("scheduled_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map((a) => ({
    ...camelize(a),
    duration: a.duration ?? 30,
    status: a.status ?? "scheduled",
  })));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (new Date(parsed.data.scheduledAt) < new Date()) {
    res.status(400).json({ error: "Appointment time cannot be in the past." });
    return;
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, last_name, email, phone, whatsapp_number, hospital_id")
    .eq("id", parsed.data.patientId)
    .eq("hospital_id", hospital.code)
    .single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  // Resolve doctor name if doctorId provided
  let resolvedDoctorName = parsed.data.doctorName ?? null;
  if (parsed.data.doctorId && !resolvedDoctorName) {
    const { data: doc } = await supabase.from("hospital_doctors").select("full_name").eq("id", parsed.data.doctorId).single();
    resolvedDoctorName = (doc?.full_name as string) ?? null;
  }

  const { data: appt, error } = await supabase.from("appointments").insert({
    ...snakify(parsed.data as Record<string, unknown>),
    patient_name: patientName,
    status: "scheduled",
    hospital_id: hospital.intId,
    doctor_name: resolvedDoctorName,
    duration_minutes: parsed.data.durationMinutes ?? parsed.data.duration ?? null,
  }).select().single();

  if (error || !appt) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  const performedBy = (req.headers["x-performed-by"] as string | undefined) || null;
  await supabase.from("activity").insert({
    type: "appointment_scheduled",
    description: `Appointment scheduled for ${patientName}: ${appt.title}`,
    patient_id: appt.patient_id,
    patient_name: patientName,
    metadata: appt.scheduled_at,
    performed_by: performedBy,
  });

  if (patient?.email) {
    sendAppointmentConfirmation(hospital.intId, parsed.data.patientId, patientName, patient.email as string, appt.scheduled_at)
      .catch((err) => console.error("[appt-confirm-email] unhandled error:", err));
  } else {
    console.warn("[appt-confirm-email] skipped — patient", parsed.data.patientId, "has no email address");
  }

  res.status(201).json({ ...camelize(appt), duration: appt.duration ?? 30, status: appt.status ?? "scheduled" });
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updatePayload: Record<string, unknown> = { ...snakify(parsed.data as Record<string, unknown>) };
  if (parsed.data.scheduledAt) {
    // Clear sent-at flags so the scheduler fires fresh 24h/2h reminders for the new time
    updatePayload.reminder_24h_sent_at = null;
    updatePayload.reminder_2h_sent_at = null;
  }

  const { data: appt, error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id)
    .eq("hospital_id", hospital.intId)
    .select()
    .single();

  if (error || !appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  if (parsed.data.status === "no_show") {
    const { data: patient } = await supabase.from("patients").select("*").eq("id", appt.patient_id).single();
    if (patient) {
      const hospitalIntId = await resolveHospitalIntId(patient.hospital_id as string);
      await supabase.from("call_tasks").insert({
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        phone: patient.phone,
        whatsapp_number: patient.whatsapp_number,
        reason: `No-show for appointment: ${appt.title} on ${new Date(appt.scheduled_at).toLocaleDateString()}`,
        action_type: "manual_call",
        hospital_id: hospitalIntId,
      });

      if (hospitalIntId) {
        const phone = (patient.whatsapp_number as string) || (patient.phone as string);
        if (phone) {
          sendAppointmentNoShowFollowUp(hospitalIntId, patient.id, `${patient.first_name} ${patient.last_name}`, phone, appt.title).catch(() => {});
        }
      }
    }

    await supabase.from("activity").insert({
      type: "no_show",
      description: `No-show recorded for ${appt.patient_name}: ${appt.title}`,
      patient_id: appt.patient_id,
      patient_name: appt.patient_name,
      metadata: appt.scheduled_at,
    });
  }

  if (parsed.data.scheduledAt) {
    const pBy = (req.headers["x-performed-by"] as string | undefined) || null;
    await supabase.from("activity").insert({
      type: "appointment_rescheduled",
      description: `Appointment rescheduled for ${appt.patient_name}: ${appt.title}`,
      patient_id: appt.patient_id,
      patient_name: appt.patient_name,
      metadata: parsed.data.scheduledAt,
      performed_by: pBy,
    });

    const { data: patient } = await supabase
      .from("patients")
      .select("email")
      .eq("id", appt.patient_id as number)
      .maybeSingle();
    if (patient?.email) {
      sendAppointmentReschedule(hospital.intId, appt.patient_id as number, appt.patient_name as string, patient.email as string, parsed.data.scheduledAt)
        .catch((err) => console.error("[appt-reschedule-email] unhandled error:", err));
    }
  }

  if (parsed.data.status === "cancelled") {
    const pBy = (req.headers["x-performed-by"] as string | undefined) || null;
    await supabase.from("activity").insert({
      type: "appointment_cancelled",
      description: `Appointment cancelled for ${appt.patient_name}: ${appt.title}`,
      patient_id: appt.patient_id,
      patient_name: appt.patient_name,
      performed_by: pBy,
    });
  }

  res.json({ ...camelize(appt), duration: appt.duration ?? 30, status: appt.status ?? "scheduled" });
});

export default router;
