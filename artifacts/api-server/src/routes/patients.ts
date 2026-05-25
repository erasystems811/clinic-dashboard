import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr, snakify } from "../lib/camel.js";
import { z } from "zod/v4";
import {
  sendQueueJoinMessage,
  sendCarePlanNotification,
  sendCarePlanEmail,
} from "../lib/automation.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const ListPatientsQuery = z.object({
  stage: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const CreatePatientBody = z.object({
  patientId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  hospitalId: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(1),
  whatsappNumber: z.string().optional(),
  age: z.number().int().optional(),
  gender: z.string().optional(),
  stage: z.string().optional(),
  diagnosis: z.string().optional(),
  department: z.string().optional(),
  nextAppointment: z.string().optional(),
  notes: z.string().optional(),
});

const UpdatePatientBody = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  hospitalId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  age: z.number().int().optional(),
  gender: z.string().optional(),
  stage: z.string().optional(),
  diagnosis: z.string().optional(),
  department: z.string().optional(),
  nextAppointment: z.string().optional(),
  notes: z.string().optional(),
  treatmentPlan: z.string().optional(),
  treatmentType: z.string().optional(),
  medicationTiming: z.string().optional(),
  treatmentDurationDays: z.number().int().optional(),
  treatmentEndDate: z.string().optional(),
});

const TreatmentPlanBody = z.object({
  treatmentPlan: z.string().min(1),
  treatmentType: z.string().min(1),
  medicationTiming: z.string().optional(),
  treatmentDurationDays: z.number().int().min(1),
  diagnosis: z.string().optional(),
  department: z.string().optional(),
});

const FlagMissedBody = z.object({
  reason: z.string().min(1),
  actionType: z.enum(["automated_message", "manual_text", "manual_call"]).optional(),
  taskType: z.enum(["follow_up", "check_in"]).optional(),
  checkInType: z.string().optional(),
});

function serializePatient(p: Record<string, unknown>) {
  return camelize<Record<string, unknown>>(p);
}

async function resolveHospitalIntId(usernameOrNull: string | null): Promise<number | null> {
  if (!usernameOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("username", usernameOrNull.toLowerCase()).single();
  return data?.id ?? null;
}

router.get("/patients", async (req, res): Promise<void> => {
  const query = ListPatientsQuery.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { limit, offset } = query.data;

  let q = supabase.from("patients").select("*").eq("hospital_id", hospital.username);

  if (query.data.stage) {
    q = q.eq("stage", query.data.stage);
  } else if (query.data.search) {
    const term = `%${query.data.search}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await q
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json(camelizeArr(data ?? []));
});

router.post("/patients", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { hospitalId: _ignored, ...rest } = parsed.data;
  const data = snakify({ ...rest, stage: "Queued", hospitalId: hospital.username });
  const { data: patient, error } = await supabase.from("patients").insert(data).select().single();
  if (error) {
    console.error("[create patient] supabase error:", JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }));
    const isDuplicate = error.code === "23505";
    res.status(isDuplicate ? 409 : 500).json({
      error: isDuplicate
        ? `A patient with ID "${parsed.data.patientId}" is already registered.`
        : error.message
    });
    return;
  }

  const p = camelize<Record<string, unknown>>(patient);
  await supabase.from("activity").insert({
    type: "patient_created",
    description: `New patient registered: ${p.firstName} ${p.lastName}`,
    patient_id: patient.id,
    patient_name: `${p.firstName} ${p.lastName}`,
    hospital_id: hospital.intId,
  });

  res.status(201).json(p);
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error || !data) { res.status(404).json({ error: "Patient not found" }); return; }

  res.json(serializePatient(data));
});

router.get("/patients/:id/history", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: patient, error: pErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (pErr || !patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const [activityRes, appointmentsRes, callTasksRes] = await Promise.all([
    supabase.from("activity").select("*").eq("patient_id", id).order("created_at", { ascending: true }),
    supabase.from("appointments").select("*").eq("patient_id", id).order("scheduled_at", { ascending: true }),
    supabase.from("call_tasks").select("*").eq("patient_id", id).order("flagged_at", { ascending: true }),
  ]);

  res.json({
    patient: serializePatient(patient),
    activity: camelizeArr(activityRes.data ?? []),
    appointments: (appointmentsRes.data ?? []).map(a => ({ ...camelize(a), duration: a.duration ?? 30 })),
    callTasks: camelizeArr(callTasksRes.data ?? []),
  });
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabase
    .from("patients")
    .update({ ...snakify(parsed.data as Record<string, unknown>), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: "Patient not found" }); return; }

  const patient = camelize<Record<string, unknown>>(data);

  if (parsed.data.stage) {
    await supabase.from("activity").insert({
      type: "stage_changed",
      description: `${patient.firstName} ${patient.lastName} moved to ${parsed.data.stage}`,
      patient_id: id,
      patient_name: `${patient.firstName} ${patient.lastName}`,
      metadata: parsed.data.stage,
    });
  }

  res.json(patient);
});

router.delete("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Fetch first so we have the name for the log
  const { data: existing, error: fetchErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (fetchErr || !existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const patientName = `${existing.first_name} ${existing.last_name}`;

  // Remove all child records that reference this patient before deleting the patient row
  await Promise.all([
    supabase.from("activity").delete().eq("patient_id", id),
    supabase.from("appointments").delete().eq("patient_id", id),
    supabase.from("call_tasks").delete().eq("patient_id", id),
    supabase.from("queue").delete().eq("patient_id", id),
  ]);

  const { error: deleteErr } = await supabase.from("patients").delete().eq("id", id);
  if (deleteErr) { res.status(500).json({ error: deleteErr.message }); return; }

  res.sendStatus(204);
});

router.post("/patients/:id/checkin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: existing, error: fetchErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (fetchErr || !existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: patient, error: updateErr } = await supabase
    .from("patients")
    .update({ stage: "Queued", pre_queue_stage: existing.stage, checked_in_at: nowIso, updated_at: nowIso })
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !patient) { res.status(500).json({ error: "Update failed" }); return; }

  const patientName = `${patient.first_name} ${patient.last_name}`;

  const { data: scheduledAppts } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", id)
    .eq("status", "scheduled");

  let matchedAppointmentId: number | null = null;
  let hasTimedAppointment = false;

  for (const appt of scheduledAppts ?? []) {
    const apptTime = new Date(appt.scheduled_at);
    const diffMins = (apptTime.getTime() - now.getTime()) / 60000;
    await supabase.from("appointments").update({ status: "completed" }).eq("id", appt.id);
    matchedAppointmentId = appt.id;
    if (Math.abs(diffMins) <= 30) hasTimedAppointment = true;
  }

  const { count: currentCount } = await supabase.from("queue").select("*", { count: "exact", head: true });
  const queueSize = currentCount ?? 0;

  let position: number;
  if (hasTimedAppointment && queueSize > 0) {
    const { data: existingQueue } = await supabase.from("queue").select("id, position").order("position", { ascending: true });
    for (const entry of existingQueue ?? []) {
      await supabase.from("queue").update({ position: entry.position + 1 }).eq("id", entry.id);
    }
    position = 1;
  } else {
    position = queueSize + 1;
  }

  await supabase.from("queue").insert({
    patient_id: patient.id,
    patient_name: patientName,
    phone: patient.phone,
    email: patient.email,
    whatsapp_number: patient.whatsapp_number,
    hospital_id: patient.hospital_id,
    stage: existing.stage,
    position,
    appointment_id: matchedAppointmentId,
  });

  const priorityNote = hasTimedAppointment ? " (priority — appointment time)" : "";
  await supabase.from("activity").insert({
    type: "checkin",
    description: `${patientName} checked in — added to queue at position ${position}${priorityNote}`,
    patient_id: patient.id,
    patient_name: patientName,
    metadata: nowIso,
  });

  // ── Automation: send queue join WhatsApp ──
  const hospitalIntId = await resolveHospitalIntId(patient.hospital_id as string);
  if (hospitalIntId) {
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);
    sendQueueJoinMessage(hospitalIntId, patient.id, patientName, phone, position).catch(() => {});

    // Notify patients whose position changed (bumped by priority check-in)
    if (hasTimedAppointment && queueSize > 0) {
      const { data: updatedQueue } = await supabase
        .from("queue")
        .select("patient_id, patient_name, whatsapp_number, phone, position")
        .eq("hospital_id", patient.hospital_id)
        .gt("position", 1)
        .order("position", { ascending: true });

      for (const qEntry of (updatedQueue ?? []).slice(0, 5)) {
        const qPhone = (qEntry.whatsapp_number as string) || (qEntry.phone as string);
        if (qPhone) {
          sendQueuePositionUpdate(hospitalIntId, qEntry.patient_id as number, qEntry.patient_name as string, qPhone, qEntry.position as number).catch(() => {});
        }
      }
    }
  }

  res.json(camelize(patient));
});

router.post("/patients/:id/dequeue", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: existing } = await supabase.from("patients").select("*").eq("id", id).single();
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  // Dequeue logic: restore pre_queue_stage, or Post Care if was Dormant
  let restoreStage = existing.pre_queue_stage ?? "Booked";
  if (restoreStage === "Dormant") restoreStage = "Post Care";
  if (restoreStage === "Booked") restoreStage = existing.pre_queue_stage ?? "Post Care";

  const { data: patient } = await supabase
    .from("patients")
    .update({ stage: restoreStage, pre_queue_stage: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  await supabase.from("queue").delete().eq("patient_id", id);

  const { data: remaining } = await supabase
    .from("queue")
    .select("id, patient_id, patient_name, phone, whatsapp_number, position")
    .eq("hospital_id", existing.hospital_id)
    .order("position", { ascending: true });

  for (let i = 0; i < (remaining ?? []).length; i++) {
    await supabase.from("queue").update({ position: i + 1 }).eq("id", remaining![i].id);
  }

  await supabase.from("activity").insert({
    type: "dequeued",
    description: `${patient!.first_name} ${patient!.last_name} removed from queue — returned to ${restoreStage}`,
    patient_id: id,
    patient_name: `${patient!.first_name} ${patient!.last_name}`,
  });

  // ── Automation: notify remaining patients of position updates ──
  const hospitalIntId = await resolveHospitalIntId(existing.hospital_id as string);
  if (hospitalIntId && (remaining ?? []).length > 0) {
    for (let i = 0; i < Math.min((remaining ?? []).length, 5); i++) {
      const qEntry = remaining![i];
      const qPhone = (qEntry.whatsapp_number as string) || (qEntry.phone as string);
      if (qPhone) {
        sendQueuePositionUpdate(hospitalIntId, qEntry.patient_id as number, qEntry.patient_name as string, qPhone, i + 1).catch(() => {});
      }
    }
  }

  res.json(camelize(patient!));
});

router.post("/patients/:id/treatment-plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = TreatmentPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: existing } = await supabase.from("patients").select("*").eq("id", id).single();
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();
  const treatmentEndDate = new Date(now);
  treatmentEndDate.setDate(treatmentEndDate.getDate() + parsed.data.treatmentDurationDays);

  const updateData: Record<string, unknown> = {
    treatment_plan: parsed.data.treatmentPlan,
    treatment_type: parsed.data.treatmentType,
    medication_timing: parsed.data.medicationTiming ?? null,
    treatment_duration_days: parsed.data.treatmentDurationDays,
    treatment_end_date: treatmentEndDate.toISOString().split("T")[0],
    stage: "In Care",
    treatment_started_at: now.toISOString(),
    pre_queue_stage: null,
    updated_at: now.toISOString(),
  };
  if (parsed.data.diagnosis) updateData.diagnosis = parsed.data.diagnosis;
  if (parsed.data.department) updateData.department = parsed.data.department;

  const { data: patient } = await supabase.from("patients").update(updateData).eq("id", id).select().single();
  await supabase.from("queue").delete().eq("patient_id", id);

  const patientName = `${patient!.first_name} ${patient!.last_name}`;
  await supabase.from("activity").insert({
    type: "treatment_plan_logged",
    description: `Treatment plan logged for ${patientName} — moved to In Care (${parsed.data.treatmentDurationDays} days, ends ${treatmentEndDate.toISOString().split("T")[0]})`,
    patient_id: id,
    patient_name: patientName,
    metadata: parsed.data.treatmentPlan,
  });

  const interval = Math.floor(parsed.data.treatmentDurationDays / 3) || 1;
  const reminders = [1, 2, 3].map((n) => ({
    type: "treatment_reminder",
    description: `Treatment reminder ${n} for ${patientName} (day ${n * interval})`,
    patient_id: id,
    patient_name: patientName,
    metadata: `day_${n * interval}`,
  }));
  await supabase.from("activity").insert(reminders);

  // ── Automation: 1) WhatsApp/SMS notification + 2) OpenAI care plan email ──
  const hospitalIntId = await resolveHospitalIntId(patient!.hospital_id as string);
  if (hospitalIntId) {
    const phone = (patient!.whatsapp_number as string) || (patient!.phone as string);
    const email = patient!.email as string | null;

    // 1. Mobile notification (WhatsApp or SMS, templated)
    if (phone) {
      sendCarePlanNotification(hospitalIntId, id, patientName, phone).catch(() => {});
    }

    // 2. Detailed care plan email (OpenAI generated)
    if (email) {
      sendCarePlanEmail(
        hospitalIntId,
        id,
        patientName,
        email,
        parsed.data.treatmentType,
        parsed.data.treatmentPlan,
        parsed.data.treatmentDurationDays,
      ).catch(() => {});
    }
  }

  res.json(camelize(patient!));
});

router.post("/patients/:id/flag-missed", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = FlagMissedBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const taskType = parsed.data.taskType ?? "follow_up";
  const { data: task, error: taskErr } = await supabase.from("call_tasks").insert({
    patient_id: patient.id,
    patient_name: `${patient.first_name} ${patient.last_name}`,
    phone: patient.phone,
    whatsapp_number: patient.whatsapp_number,
    department: patient.department,
    reason: parsed.data.reason,
    task_type: taskType,
    check_in_type: parsed.data.checkInType ?? null,
    action_type: parsed.data.actionType ?? "manual_call",
  }).select().single();

  if (taskErr || !task) { res.status(500).json({ error: taskErr?.message ?? "Failed to create task" }); return; }

  const activityDesc = taskType === "check_in"
    ? `${patient.first_name} ${patient.last_name} flagged for check-in (${parsed.data.checkInType ?? "General"}) — call task created`
    : `${patient.first_name} ${patient.last_name} flagged for missed treatment — call task created`;

  await supabase.from("activity").insert({
    type: taskType === "check_in" ? "check_in_flagged" : "missed_treatment_flagged",
    description: activityDesc,
    patient_id: id,
    patient_name: `${patient.first_name} ${patient.last_name}`,
    metadata: parsed.data.reason,
  });

  res.json(camelize(task));
});

export default router;
