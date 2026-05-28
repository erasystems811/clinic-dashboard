import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr, snakify } from "../lib/camel.js";
import { z } from "zod/v4";
import {
  sendQueueJoinMessage,
  sendQueueYourTurn,
  sendQueueNextInLine,
  sendCarePlanNotification,
  sendCarePlanEmail,
  generateCallTaskDraft,
  sendCallTaskConfirmedMessage,
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
  patientId: z.string().min(1).transform((s) => s.trim().toUpperCase()),
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
  patientId: z.string().transform((s) => s.trim().toUpperCase()).optional(),
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
  actionType: z.enum(["manual_text", "manual_call"]).optional(),
  taskType: z.enum(["follow_up", "check_in"]).optional(),
  checkInType: z.string().optional(),
});

// Normalize legacy stage names so old DB values surface with current names.
const STAGE_ALIASES: Record<string, string> = {
  "Post Care": "Active",
};

function serializePatient(p: Record<string, unknown>) {
  const out = camelize<Record<string, unknown>>(p);
  if (typeof out.stage === "string" && STAGE_ALIASES[out.stage]) {
    out.stage = STAGE_ALIASES[out.stage];
  }
  return out;
}

async function resolveHospitalIntId(hospitalCodeOrNull: string | null): Promise<number | null> {
  if (!hospitalCodeOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCodeOrNull).single();
  return data?.id ?? null;
}

router.get("/patients", async (req, res): Promise<void> => {
  const query = ListPatientsQuery.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { limit, offset } = query.data;
  const nowIso = new Date().toISOString();

  // "Queued" and "Booked" are derived stages — they never live in patients.stage.
  // Handle them by looking up IDs from the source-of-truth tables, then fetching those patients.
  if (query.data.stage === "Queued") {
    const { data: queueRows } = await supabase
      .from("queue").select("patient_id").eq("hospital_id", hospital.code);
    const ids = (queueRows ?? []).map(r => r.patient_id as number);
    if (ids.length === 0) { res.json([]); return; }
    const { data, error } = await supabase
      .from("patients").select("*").in("id", ids)
      .eq("hospital_id", hospital.code)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const patients = data ?? [];
    if (patients.length > 0) {
      const pids = patients.map(p => p.id as number);
      const [{ data: plans }, { data: queueEntries }, { data: upcomingAppts }] = await Promise.all([
        supabase.from("care_plans").select("patient_id, department").eq("hospital_id", hospital.code).in("patient_id", pids),
        supabase.from("queue").select("patient_id").eq("hospital_id", hospital.code).in("patient_id", pids),
        supabase.from("appointments").select("patient_id").in("patient_id", pids).gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")'),
      ]);
      const withPlans = new Set((plans ?? []).map(p => p.patient_id as number));
      const inQueue = new Set((queueEntries ?? []).map(q => q.patient_id as number));
      const booked = new Set((upcomingAppts ?? []).map(a => a.patient_id as number));
      const deptsByPatient: Record<number, Set<string>> = {};
      for (const cp of plans ?? []) {
        const pid = cp.patient_id as number;
        if (!deptsByPatient[pid]) deptsByPatient[pid] = new Set();
        if (cp.department) deptsByPatient[pid].add(cp.department as string);
      }
      res.json(patients.map(p => serializePatient({ ...p, has_care_plan: withPlans.has(p.id as number), is_in_queue: inQueue.has(p.id as number), is_booked: booked.has(p.id as number), care_plan_departments: Array.from(deptsByPatient[p.id as number] ?? []) })));
    } else {
      res.json([]);
    }
    return;
  }

  if (query.data.stage === "Booked") {
    const { data: apptRows } = await supabase
      .from("appointments").select("patient_id").in("patient_id", (await supabase.from("patients").select("id").eq("hospital_id", hospital.code)).data?.map(p => p.id as number) ?? [])
      .gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")');
    const ids = [...new Set((apptRows ?? []).map(r => r.patient_id as number))];
    if (ids.length === 0) { res.json([]); return; }
    const { data, error } = await supabase
      .from("patients").select("*").in("id", ids)
      .eq("hospital_id", hospital.code)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const patients = data ?? [];
    if (patients.length > 0) {
      const pids = patients.map(p => p.id as number);
      const [{ data: plans }, { data: queueEntries }, { data: upcomingAppts }] = await Promise.all([
        supabase.from("care_plans").select("patient_id, department").eq("hospital_id", hospital.code).in("patient_id", pids),
        supabase.from("queue").select("patient_id").eq("hospital_id", hospital.code).in("patient_id", pids),
        supabase.from("appointments").select("patient_id").in("patient_id", pids).gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")'),
      ]);
      const withPlans = new Set((plans ?? []).map(p => p.patient_id as number));
      const inQueue = new Set((queueEntries ?? []).map(q => q.patient_id as number));
      const booked = new Set((upcomingAppts ?? []).map(a => a.patient_id as number));
      const deptsByPatient: Record<number, Set<string>> = {};
      for (const cp of plans ?? []) {
        const pid = cp.patient_id as number;
        if (!deptsByPatient[pid]) deptsByPatient[pid] = new Set();
        if (cp.department) deptsByPatient[pid].add(cp.department as string);
      }
      res.json(patients.map(p => serializePatient({ ...p, has_care_plan: withPlans.has(p.id as number), is_in_queue: inQueue.has(p.id as number), is_booked: booked.has(p.id as number), care_plan_departments: Array.from(deptsByPatient[p.id as number] ?? []) })));
    } else {
      res.json([]);
    }
    return;
  }

  let q = supabase.from("patients").select("*").eq("hospital_id", hospital.code);

  if (query.data.stage) {
    // "In Care" can come from patients.stage OR from having an active care plan — include both
    if (query.data.stage === "In Care") {
      const { data: planRows } = await supabase
        .from("care_plans").select("patient_id").eq("hospital_id", hospital.code);
      const carePlanPatientIds = [...new Set((planRows ?? []).map(r => r.patient_id as number))];
      if (carePlanPatientIds.length > 0) {
        q = q.or(`stage.eq.In Care,id.in.(${carePlanPatientIds.join(",")})`);
      } else {
        q = q.eq("stage", "In Care");
      }
    } else if (query.data.stage === "Active") {
      // "Post Care" is the legacy DB name for "Active" — include both
      q = q.or("stage.eq.Active,stage.eq.Post Care");
    } else {
      q = q.eq("stage", query.data.stage);
    }
  } else if (query.data.search) {
    const term = `%${query.data.search}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},patient_id.ilike.${term}`);
  }

  const { data, error } = await q
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const patients = data ?? [];

  if (patients.length > 0) {
    const ids = patients.map(p => p.id as number);
    const nowIso = new Date().toISOString();
    const [{ data: plans }, { data: queueEntries }, { data: upcomingAppts }] = await Promise.all([
      supabase.from("care_plans").select("patient_id, department").eq("hospital_id", hospital.code).in("patient_id", ids),
      supabase.from("queue").select("patient_id").eq("hospital_id", hospital.code).in("patient_id", ids),
      supabase.from("appointments").select("patient_id").in("patient_id", ids).gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")'),
    ]);

    const withPlans = new Set((plans ?? []).map(p => p.patient_id as number));
    const inQueue = new Set((queueEntries ?? []).map(q => q.patient_id as number));
    const isBooked = new Set((upcomingAppts ?? []).map(a => a.patient_id as number));

    // Aggregate all unique departments per patient from their care plans
    const deptsByPatient: Record<number, Set<string>> = {};
    for (const cp of plans ?? []) {
      const pid = cp.patient_id as number;
      if (!deptsByPatient[pid]) deptsByPatient[pid] = new Set();
      if (cp.department) deptsByPatient[pid].add(cp.department as string);
    }

    res.json(camelizeArr(patients.map(p => ({
      ...p,
      has_care_plan: withPlans.has(p.id as number),
      is_in_queue: inQueue.has(p.id as number),
      is_booked: isBooked.has(p.id as number),
      care_plan_departments: Array.from(deptsByPatient[p.id as number] ?? []),
    }))));
    return;
  }

  res.json([]);
});

router.post("/patients", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Case-insensitive uniqueness check before insert
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("hospital_id", hospital.code)
    .ilike("patient_id", parsed.data.patientId)
    .maybeSingle();
  if (existing) {
    res.status(409).json({ error: `A patient with ID "${parsed.data.patientId}" is already registered.` });
    return;
  }

  const { hospitalId: _ignored, ...rest } = parsed.data;
  const data = snakify({ ...rest, stage: "Active", hospitalId: hospital.code });
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
  const patientName = `${p.firstName} ${p.lastName}`;

  // Stamp checked_in_at and add to the live queue immediately on registration
  const nowIso = new Date().toISOString();
  await supabase.from("patients").update({ checked_in_at: nowIso }).eq("id", patient.id);

  const { count: currentCount } = await supabase.from("queue").select("*", { count: "exact", head: true }).eq("hospital_id", patient.hospital_id);
  const position = (currentCount ?? 0) + 1;

  await supabase.from("queue").insert({
    patient_id: patient.id,
    patient_name: patientName,
    phone: patient.phone,
    email: patient.email,
    whatsapp_number: patient.whatsapp_number,
    hospital_id: patient.hospital_id,
    stage: "New",
    position,
  });

  await supabase.from("activity").insert({
    type: "patient_created",
    description: `New patient registered: ${patientName} — added to queue at position ${position}`,
    patient_id: patient.id,
    patient_name: patientName,
    hospital_id: hospital.intId,
  });

  res.status(201).json({ ...p, checkedInAt: nowIso });
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);

  const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error || !data) { res.status(404).json({ error: "Patient not found" }); return; }

  const hospitalId = hospital?.code ?? (data.hospital_id as string);
  const nowIso = new Date().toISOString();
  const [{ data: plans }, { data: queueEntry }, { data: upcomingAppt }] = await Promise.all([
    supabase.from("care_plans").select("id").eq("patient_id", id).eq("hospital_id", hospitalId).limit(1),
    supabase.from("queue").select("id").eq("patient_id", id).maybeSingle(),
    supabase.from("appointments").select("id").eq("patient_id", id).gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")').limit(1).maybeSingle(),
  ]);
  const hasCarePlan = (plans ?? []).length > 0;
  const isInQueue = !!queueEntry;
  const isBooked = !!upcomingAppt;

  res.json(serializePatient({ ...data, has_care_plan: hasCarePlan, is_in_queue: isInQueue, is_booked: isBooked }));
});

router.get("/patients/:id/history", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: patient, error: pErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (pErr || !patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const nowIso = new Date().toISOString();
  const [activityRes, appointmentsRes, callTasksRes, allPlansRes, queueRes, bookedRes] = await Promise.all([
    supabase.from("activity").select("*").eq("patient_id", id).order("created_at", { ascending: true }),
    supabase.from("appointments").select("*").eq("patient_id", id).order("scheduled_at", { ascending: true }),
    supabase.from("call_tasks").select("*").eq("patient_id", id).order("flagged_at", { ascending: true }),
    supabase.from("care_plans").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("queue").select("id").eq("patient_id", id).maybeSingle(),
    supabase.from("appointments").select("id").eq("patient_id", id).gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")').limit(1).maybeSingle(),
  ]);

  if (allPlansRes.error) {
    console.error("[history] care_plans query error:", allPlansRes.error.message, allPlansRes.error.code);
  }
  let carePlans = allPlansRes.data ?? [];

  // Lazy migration: old patients stored treatment_plan directly on the patients row.
  // If no care_plans rows exist yet but the patient has a treatment_plan, create a real
  // care_plans row now so the history page (and End Early button) work with old data.
  if (carePlans.length === 0 && patient.treatment_plan) {
    const hospitalId = patient.hospital_id as string;
    const createdAt = (patient.treatment_started_at as string | null) ?? new Date().toISOString();
    const dept = (patient.department as string | null) || (patient.treatment_type as string | null) || "General";
    const { data: migrated } = await supabase.from("care_plans").insert({
      patient_id: id,
      hospital_id: hospitalId,
      summary: patient.treatment_plan as string,
      department: dept,
      template_data: patient.treatment_end_date
        ? { legacyEndDate: patient.treatment_end_date, migratedFromPatientRow: true }
        : { migratedFromPatientRow: true },
      created_at: createdAt,
      updated_at: createdAt,
    }).select().single();
    if (migrated) carePlans = [migrated];
  }

  res.json({
    patient: serializePatient({ ...patient, has_care_plan: carePlans.length > 0, is_in_queue: !!queueRes.data, is_booked: !!bookedRes.data }),
    activity: camelizeArr(activityRes.data ?? []),
    appointments: (appointmentsRes.data ?? []).map(a => ({ ...camelize(a), duration: a.duration ?? 30 })),
    callTasks: camelizeArr(callTasksRes.data ?? []),
    carePlans: camelizeArr(carePlans),
  });
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Fetch existing record so we can detect changes and propagate them
  const { data: before, error: beforeErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (beforeErr || !before) { res.status(404).json({ error: "Patient not found" }); return; }

  // If patientId is being changed, enforce uniqueness within this hospital (case-insensitive)
  if (parsed.data.patientId && parsed.data.patientId !== before.patient_id?.toUpperCase()) {
    const hospital = await getHospitalFromRequest(req);
    if (hospital) {
      const { data: conflict } = await supabase
        .from("patients")
        .select("id")
        .eq("hospital_id", hospital.code)
        .ilike("patient_id", parsed.data.patientId)
        .neq("id", id)
        .maybeSingle();
      if (conflict) {
        res.status(409).json({ error: `Patient ID "${parsed.data.patientId}" is already in use by another patient in this hospital.` });
        return;
      }
    }
  }

  const { data, error } = await supabase
    .from("patients")
    .update({ ...snakify(parsed.data as Record<string, unknown>), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    const isDuplicate = error?.code === "23505" || error?.message?.includes("unique constraint");
    res.status(isDuplicate ? 409 : 500).json({
      error: isDuplicate ? "Patient ID already exists in this hospital." : (error?.message ?? "Update failed"),
    });
    return;
  }

  const patient = camelize<Record<string, unknown>>(data);
  const newName = `${data.first_name} ${data.last_name}`;
  const oldName = `${before.first_name} ${before.last_name}`;

  // ── Stage change: log to activity ──
  if (parsed.data.stage) {
    await supabase.from("activity").insert({
      type: "stage_changed",
      description: `${newName} moved to ${parsed.data.stage}`,
      patient_id: id,
      patient_name: newName,
      hospital_id: before.hospital_id ? (await resolveHospitalIntId(before.hospital_id as string)) : null,
      metadata: parsed.data.stage,
    });

    // ── When treatment completes, clear the active plan so a new plan can be started fresh ──
    if (parsed.data.stage === "Post Treatment") {
      await supabase.from("patients").update({
        treatment_plan: null,
        treatment_type: null,
        medication_timing: null,
        treatment_duration_days: null,
        treatment_end_date: null,
        treatment_started_at: null,
      }).eq("id", id);
    }
  }

  // ── Info edit: propagate name + contact changes to queue and call_tasks ──
  const isInfoEdit = !parsed.data.stage && (
    parsed.data.firstName || parsed.data.lastName ||
    parsed.data.phone || parsed.data.email || parsed.data.whatsappNumber ||
    parsed.data.dateOfBirth || parsed.data.age || parsed.data.gender ||
    parsed.data.department || parsed.data.diagnosis || parsed.data.patientId || parsed.data.notes
  );

  if (isInfoEdit) {
    // Detect what actually changed for the activity log
    const changes: string[] = [];
    if (data.first_name !== before.first_name || data.last_name !== before.last_name)
      changes.push(`name: "${oldName}" → "${newName}"`);
    if (parsed.data.phone && data.phone !== before.phone) changes.push("phone");
    if (parsed.data.email && data.email !== before.email) changes.push("email");
    if (parsed.data.whatsappNumber && data.whatsapp_number !== before.whatsapp_number) changes.push("WhatsApp");
    if (parsed.data.gender && data.gender !== before.gender) changes.push("gender");
    if (parsed.data.dateOfBirth && data.date_of_birth !== before.date_of_birth) changes.push("date of birth");
    if (parsed.data.age && data.age !== before.age) changes.push("age");
    if (parsed.data.department && data.department !== before.department) changes.push("department");
    if (parsed.data.diagnosis && data.diagnosis !== before.diagnosis) changes.push("diagnosis");
    if (parsed.data.patientId && data.patient_id !== before.patient_id) changes.push(`patient ID: "${before.patient_id}" → "${data.patient_id}"`);
    if (parsed.data.notes && data.notes !== before.notes) changes.push("notes");

    // Build queue update payload (sync whatever changed)
    const queueUpdate: Record<string, unknown> = {};
    if (data.first_name !== before.first_name || data.last_name !== before.last_name) queueUpdate.patient_name = newName;
    if (parsed.data.phone) queueUpdate.phone = data.phone;
    if (parsed.data.email) queueUpdate.email = data.email;
    if (parsed.data.whatsappNumber) queueUpdate.whatsapp_number = data.whatsapp_number;

    const propagations: Promise<unknown>[] = [];

    // Sync queue row if patient is currently queued
    if (Object.keys(queueUpdate).length > 0) {
      propagations.push(
        supabase.from("queue").update(queueUpdate).eq("patient_id", id)
      );
    }

    // Sync patient_name in open call tasks
    if (data.first_name !== before.first_name || data.last_name !== before.last_name) {
      propagations.push(
        supabase.from("call_tasks").update({ patient_name: newName }).eq("patient_id", id)
      );
    }

    // Log activity entry for the edit
    if (changes.length > 0) {
      propagations.push(
        supabase.from("activity").insert({
          type: "patient_info_updated",
          description: `Patient info updated for ${newName}: ${changes.join(", ")}`,
          patient_id: id,
          patient_name: newName,
          hospital_id: before.hospital_id ? (await resolveHospitalIntId(before.hospital_id as string)) : null,
        })
      );
    }

    await Promise.all(propagations);
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

  // Null out patient_id on activity so history is preserved as an audit trail after deletion
  await supabase.from("activity").update({ patient_id: null }).eq("patient_id", id);

  // Remove child records that would block the patient row deletion
  await Promise.all([
    supabase.from("appointments").delete().eq("patient_id", id),
    supabase.from("call_tasks").delete().eq("patient_id", id),
    supabase.from("queue").delete().eq("patient_id", id),
  ]);

  const { error: deleteErr } = await supabase.from("patients").delete().eq("id", id);
  if (deleteErr) { res.status(500).json({ error: deleteErr.message }); return; }

  // Log the deletion to activity (no patient_id since the row is gone)
  await supabase.from("activity").insert({
    type: "patient_deleted",
    description: `Patient record permanently deleted: ${patientName}`,
    patient_name: patientName,
    hospital_id: existing.hospital_id ? (await resolveHospitalIntId(existing.hospital_id as string)) : null,
  });

  res.sendStatus(204);
});

router.post("/patients/:id/checkin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: existing, error: fetchErr } = await supabase.from("patients").select("*").eq("id", id).single();
  if (fetchErr || !existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();
  const nowIso = now.toISOString();

  // Dormant → Active: checking in re-activates the patient.
  // For all other stages, check-in is a REFLECTION and does not change the primary stage.
  const reactivating = existing.stage === "Dormant";
  const stageUpdate = reactivating ? { stage: "Active", checked_in_at: nowIso, updated_at: nowIso } : { checked_in_at: nowIso, updated_at: nowIso };

  const { data: patient, error: updateErr } = await supabase
    .from("patients")
    .update(stageUpdate)
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !patient) { res.status(500).json({ error: "Update failed" }); return; }

  const patientName = `${patient.first_name} ${patient.last_name}`;

  if (reactivating) {
    await supabase.from("activity").insert({
      type: "stage_changed",
      description: `${patientName} re-activated — moved from Dormant to Active on queue check-in`,
      patient_id: id,
      patient_name: patientName,
      metadata: "Active",
    });
  }

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
    if (Math.abs(diffMins) <= 60) hasTimedAppointment = true;
  }

  const { count: currentCount } = await supabase.from("queue").select("*", { count: "exact", head: true }).eq("hospital_id", existing.hospital_id);
  const queueSize = currentCount ?? 0;

  let position: number;
  if (hasTimedAppointment && queueSize > 0) {
    const { data: existingQueue } = await supabase.from("queue").select("id, position").eq("hospital_id", existing.hospital_id).order("position", { ascending: true });
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

  // ── Automation: send queue join WhatsApp ──
  const hospitalIntId = await resolveHospitalIntId(patient.hospital_id as string);

  const priorityNote = hasTimedAppointment ? " (priority — appointment time)" : "";
  await supabase.from("activity").insert({
    type: "checkin",
    description: `${patientName} checked in — added to queue at position ${position}${priorityNote}`,
    patient_id: patient.id,
    patient_name: patientName,
    hospital_id: hospitalIntId ?? null,
    metadata: nowIso,
  });
  if (hospitalIntId) {
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);
    sendQueueJoinMessage(hospitalIntId, patient.id, patientName, phone, position).catch(() => {});

  }

  res.json(camelize(patient));
});

router.post("/patients/:id/dequeue", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: existing } = await supabase.from("patients").select("*").eq("id", id).single();
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  // ── Automation: "Your Turn" message to the patient being called in ────────────
  const calledPatientName = `${existing.first_name} ${existing.last_name}`;
  const calledPhone = (existing.whatsapp_number as string) || (existing.phone as string);
  const hospitalIntId = await resolveHospitalIntId(existing.hospital_id as string);
  if (hospitalIntId && calledPhone) {
    sendQueueYourTurn(hospitalIntId, id, calledPatientName, calledPhone)
      .catch((err) => console.error("[dequeue] sendQueueYourTurn failed:", err));
  }

  // Stage is never changed on dequeue — it's a primary lifecycle state (Active/Post Treatment/Dormant/In Care).
  // Queue membership was always tracked separately in the queue table; removing from there is enough.
  const { data: patient } = await supabase
    .from("patients")
    .update({ updated_at: new Date().toISOString() })
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

  // ── Automation: "Next in Line" to the new position 1 patient ─────────────────
  if (hospitalIntId && remaining && remaining.length > 0) {
    const newFirst = remaining[0];
    const nextPhone = (newFirst.whatsapp_number as string) || (newFirst.phone as string);
    if (nextPhone) {
      sendQueueNextInLine(hospitalIntId, newFirst.patient_id as number, newFirst.patient_name as string, nextPhone)
        .catch((err) => console.error("[dequeue] sendQueueNextInLine failed:", err));
    }
  }

  // Compute how long this patient actually waited (checked_in_at → now)
  const waitMins = existing.checked_in_at
    ? Math.max(0, Math.round((Date.now() - new Date(existing.checked_in_at).getTime()) / 60000))
    : null;

  await supabase.from("activity").insert({
    type: "dequeued",
    description: `${patient!.first_name} ${patient!.last_name} removed from queue`,
    patient_id: id,
    patient_name: `${patient!.first_name} ${patient!.last_name}`,
    hospital_id: await resolveHospitalIntId(existing.hospital_id as string),
    // metadata stores wait_minutes as a numeric string so dashboard can compute all-time avg
    metadata: waitMins !== null ? String(waitMins) : null,
  });

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

router.post("/patients/:id/end-plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: patient, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error || !patient) { res.status(404).json({ error: "Patient not found" }); return; }

  if (!patient.treatment_plan) { res.status(400).json({ error: "No active plan to end" }); return; }

  const patientName = `${patient.first_name} ${patient.last_name}`;

  await supabase.from("patients").update({
    treatment_plan: null,
    treatment_type: null,
    medication_timing: null,
    treatment_duration_days: null,
    treatment_end_date: null,
    treatment_started_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  await supabase.from("activity").insert({
    type: "plan_ended",
    description: `Active treatment plan manually ended for ${patientName}`,
    patient_id: id,
    patient_name: patientName,
    hospital_id: patient.hospital_id ? (await resolveHospitalIntId(patient.hospital_id as string)) : null,
  });

  const { data: updated } = await supabase.from("patients").select("*").eq("id", id).single();
  res.json(camelize(updated!));
});

router.post("/patients/:id/flag-missed", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = FlagMissedBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const taskType = parsed.data.taskType ?? "follow_up";

  // Resolve hospital integer id for direct scoping on call_tasks
  let hospitalIntId: number | null = null;
  if (patient.hospital_id) {
    const { data: hosp } = await supabase.from("hospitals").select("id").eq("hospital_code", patient.hospital_id as string).single();
    hospitalIntId = hosp?.id ?? null;
  }

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
    hospital_id: hospitalIntId,
  }).select().single();

  if (taskErr || !task) { res.status(500).json({ error: taskErr?.message ?? "Failed to create task" }); return; }

  const activityDesc = taskType === "check_in"
    ? `${patient.first_name} ${patient.last_name} flagged for check-in (${parsed.data.checkInType ?? "General"}) — call task created`
    : `${patient.first_name} ${patient.last_name} flagged for follow-up — call task created`;

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
