import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, snakify } from "../lib/camel.js";
import { z } from "zod/v4";
import {
  sendAppointmentConfirmation,
  sendAppointmentNoShowFollowUp,
} from "../lib/automation.js";

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
  department: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateAppointmentBody = z.object({
  status: z.string().optional(),
  scheduledAt: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

async function resolveHospitalIntId(usernameOrNull: string | null): Promise<number | null> {
  if (!usernameOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("username", usernameOrNull.toLowerCase()).single();
  return data?.id ?? null;
}

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQuery.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  let q = supabase.from("appointments").select("*");

  if (query.data.status) {
    q = q.eq("status", query.data.status);
  } else {
    q = q.neq("status", "completed").neq("status", "dismissed").neq("status", "cancelled");
  }

  if (query.data.patientId) {
    q = q.eq("patient_id", query.data.patientId);
  }

  const { data, error } = await q.order("scheduled_at", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map((a) => ({ ...camelize(a), duration: a.duration ?? 30 })));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, last_name, phone, whatsapp_number, hospital_id")
    .eq("id", parsed.data.patientId)
    .single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  const { data: appt, error } = await supabase.from("appointments").insert({
    ...snakify(parsed.data as Record<string, unknown>),
    patient_name: patientName,
  }).select().single();

  if (error || !appt) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  await supabase.from("activity").insert({
    type: "appointment_scheduled",
    description: `Appointment scheduled for ${patientName}: ${appt.title}`,
    patient_id: appt.patient_id,
    patient_name: patientName,
    metadata: appt.scheduled_at,
  });

  // ── Automation: WhatsApp confirmation ──
  if (patient) {
    const hospitalIntId = await resolveHospitalIntId(patient.hospital_id as string);
    if (hospitalIntId) {
      const phone = (patient.whatsapp_number as string) || (patient.phone as string);
      if (phone) {
        sendAppointmentConfirmation(hospitalIntId, parsed.data.patientId, patientName, phone, appt.title, appt.scheduled_at).catch(() => {});
      }
    }
  }

  res.status(201).json({ ...camelize(appt), duration: appt.duration ?? 30 });
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: appt, error } = await supabase
    .from("appointments")
    .update(snakify(parsed.data as Record<string, unknown>))
    .eq("id", id)
    .select()
    .single();

  if (error || !appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  if (parsed.data.status === "no_show") {
    const { data: patient } = await supabase.from("patients").select("*").eq("id", appt.patient_id).single();
    if (patient) {
      await supabase.from("call_tasks").insert({
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        phone: patient.phone,
        whatsapp_number: patient.whatsapp_number,
        reason: `No-show for appointment: ${appt.title} on ${new Date(appt.scheduled_at).toLocaleDateString()}`,
        action_type: "manual_call",
      });

      // ── Automation: WhatsApp no-show follow-up ──
      const hospitalIntId = await resolveHospitalIntId(patient.hospital_id as string);
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

  if (parsed.data.status === "rescheduled" || (parsed.data.scheduledAt && !parsed.data.status)) {
    await supabase.from("activity").insert({
      type: "appointment_rescheduled",
      description: `Appointment rescheduled for ${appt.patient_name}: ${appt.title}`,
      patient_id: appt.patient_id,
      patient_name: appt.patient_name,
      metadata: parsed.data.scheduledAt ?? appt.scheduled_at,
    });
  }

  res.json({ ...camelize(appt), duration: appt.duration ?? 30 });
});

export default router;
