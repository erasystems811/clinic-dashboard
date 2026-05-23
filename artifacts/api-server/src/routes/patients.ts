import { Router, type IRouter } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, patientsTable, activityTable, queueTable, callTasksTable, appointmentsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const ListPatientsQuery = z.object({
  stage: z.string().optional(),
  search: z.string().optional(),
});

const CreatePatientBody = z.object({
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

function serializePatient(p: typeof patientsTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

router.get("/patients", async (req, res): Promise<void> => {
  const query = ListPatientsQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let dbQuery = db.select().from(patientsTable).$dynamic();

  if (query.data.stage) {
    dbQuery = dbQuery.where(eq(patientsTable.stage, query.data.stage));
  } else if (query.data.search) {
    const term = `%${query.data.search}%`;
    dbQuery = dbQuery.where(
      or(
        ilike(patientsTable.firstName, term),
        ilike(patientsTable.lastName, term),
        ilike(patientsTable.email, term),
        ilike(patientsTable.phone, term),
        ilike(patientsTable.hospitalId, term),
      )
    );
  }

  const patients = await dbQuery.orderBy(patientsTable.createdAt);
  res.json(patients.map(serializePatient));
});

router.post("/patients", async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = { ...parsed.data, stage: parsed.data.stage ?? "Booked" };
  const [patient] = await db.insert(patientsTable).values(data).returning();

  await db.insert(activityTable).values({
    type: "patient_created",
    description: `New patient registered: ${patient.firstName} ${patient.lastName}`,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.status(201).json(serializePatient(patient));
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  res.json(serializePatient(patient));
});

// GET /patients/:id/history — full patient history: activity, appointments, call tasks
router.get("/patients/:id/history", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const [activity, appointments, callTasks] = await Promise.all([
    db.select().from(activityTable).where(eq(activityTable.patientId, id)).orderBy(activityTable.createdAt),
    db.select().from(appointmentsTable).where(eq(appointmentsTable.patientId, id)).orderBy(appointmentsTable.scheduledAt),
    db.select().from(callTasksTable).where(eq(callTasksTable.patientId, id)).orderBy(callTasksTable.flaggedAt),
  ]);

  res.json({
    patient: serializePatient(patient),
    activity: activity.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
    appointments: appointments.map(a => ({ ...a, duration: a.duration ?? 30 })),
    callTasks: callTasks.map(t => ({
      ...t,
      flaggedAt: t.flaggedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
  });
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db
    .update(patientsTable)
    .set(parsed.data)
    .where(eq(patientsTable.id, id))
    .returning();

  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  if (parsed.data.stage) {
    await db.insert(activityTable).values({
      type: "stage_changed",
      description: `${patient.firstName} ${patient.lastName} moved to ${parsed.data.stage}`,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      metadata: parsed.data.stage,
    });
  }

  res.json(serializePatient(patient));
});

router.delete("/patients/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [patient] = await db.delete(patientsTable).where(eq(patientsTable.id, id)).returning();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  await db.insert(activityTable).values({
    type: "patient_deleted",
    description: `Patient record removed: ${patient.firstName} ${patient.lastName}`,
    patientId: null,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.sendStatus(204);
});

// POST /patients/:id/checkin
router.post("/patients/:id/checkin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();
  const nowIso = now.toISOString();

  const [patient] = await db
    .update(patientsTable)
    .set({ stage: "Queued", preQueueStage: existing.stage, checkedInAt: nowIso })
    .where(eq(patientsTable.id, id))
    .returning();

  const patientName = `${patient.firstName} ${patient.lastName}`;

  const scheduledAppts = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.patientId, id));

  let matchedAppointmentId: number | null = null;
  let hasTimedAppointment = false;

  for (const appt of scheduledAppts) {
    if (appt.status !== "scheduled") continue;
    const apptTime = new Date(appt.scheduledAt);
    const diffMins = (apptTime.getTime() - now.getTime()) / 60000;
    await db.update(appointmentsTable).set({ status: "completed" }).where(eq(appointmentsTable.id, appt.id));
    matchedAppointmentId = appt.id;
    if (Math.abs(diffMins) <= 30) {
      hasTimedAppointment = true;
    }
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(queueTable);
  const currentCount = Number(count);

  let position: number;
  if (hasTimedAppointment && currentCount > 0) {
    const existing_queue = await db.select().from(queueTable).orderBy(queueTable.position);
    for (const entry of existing_queue) {
      await db.update(queueTable).set({ position: entry.position + 1 }).where(eq(queueTable.id, entry.id));
    }
    position = 1;
  } else {
    position = currentCount + 1;
  }

  await db.insert(queueTable).values({
    patientId: patient.id,
    patientName,
    phone: patient.phone,
    email: patient.email,
    whatsappNumber: patient.whatsappNumber ?? undefined,
    hospitalId: patient.hospitalId ?? undefined,
    stage: existing.stage,
    position,
    appointmentId: matchedAppointmentId ?? undefined,
  });

  const priorityNote = hasTimedAppointment ? " (priority — appointment time)" : "";

  await db.insert(activityTable).values({
    type: "checkin",
    description: `${patientName} checked in — added to queue at position ${position}${priorityNote}`,
    patientId: patient.id,
    patientName,
    metadata: nowIso,
  });

  res.json(serializePatient(patient));
});

// POST /patients/:id/dequeue — restore previous stage
router.post("/patients/:id/dequeue", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  // If they were "Booked" before queuing, remove from Booked → go back to Booked
  // If pre-stage was something else, restore it
  const restoreStage = existing.preQueueStage ?? "Booked";

  const [patient] = await db
    .update(patientsTable)
    .set({ stage: restoreStage, preQueueStage: null })
    .where(eq(patientsTable.id, id))
    .returning();

  await db.delete(queueTable).where(eq(queueTable.patientId, id));

  const remaining = await db.select().from(queueTable).orderBy(queueTable.position);
  for (let i = 0; i < remaining.length; i++) {
    await db.update(queueTable).set({ position: i + 1 }).where(eq(queueTable.id, remaining[i].id));
  }

  await db.insert(activityTable).values({
    type: "dequeued",
    description: `${patient.firstName} ${patient.lastName} removed from queue — returned to ${restoreStage}`,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.json(serializePatient(patient));
});

// POST /patients/:id/treatment-plan
router.post("/patients/:id/treatment-plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = TreatmentPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();
  const treatmentEndDate = new Date(now);
  treatmentEndDate.setDate(treatmentEndDate.getDate() + parsed.data.treatmentDurationDays);

  const [patient] = await db
    .update(patientsTable)
    .set({
      treatmentPlan: parsed.data.treatmentPlan,
      treatmentType: parsed.data.treatmentType,
      medicationTiming: parsed.data.medicationTiming ?? null,
      treatmentDurationDays: parsed.data.treatmentDurationDays,
      treatmentEndDate: treatmentEndDate.toISOString().split("T")[0],
      stage: "In Care",
      treatmentStartedAt: now.toISOString(),
      preQueueStage: null,
      ...(parsed.data.diagnosis ? { diagnosis: parsed.data.diagnosis } : {}),
      ...(parsed.data.department ? { department: parsed.data.department } : {}),
    })
    .where(eq(patientsTable.id, id))
    .returning();

  await db.delete(queueTable).where(eq(queueTable.patientId, id));

  const patientName = `${patient.firstName} ${patient.lastName}`;

  await db.insert(activityTable).values({
    type: "treatment_plan_logged",
    description: `Treatment plan logged for ${patientName} — moved to In Care (${parsed.data.treatmentDurationDays} days, ends ${treatmentEndDate.toISOString().split("T")[0]})`,
    patientId: patient.id,
    patientName,
    metadata: parsed.data.treatmentPlan,
  });

  const interval = Math.floor(parsed.data.treatmentDurationDays / 3) || 1;
  const reminders = [1, 2, 3].map((n) => ({
    type: "treatment_reminder",
    description: `Treatment reminder ${n} for ${patientName} (day ${n * interval})`,
    patientId: patient.id,
    patientName,
    metadata: `day_${n * interval}`,
  }));
  await db.insert(activityTable).values(reminders);

  res.json(serializePatient(patient));
});

// POST /patients/:id/flag-missed
router.post("/patients/:id/flag-missed", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = FlagMissedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const taskType = parsed.data.taskType ?? "follow_up";
  const [task] = await db.insert(callTasksTable).values({
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    phone: patient.phone,
    whatsappNumber: patient.whatsappNumber ?? undefined,
    department: patient.department ?? undefined,
    reason: parsed.data.reason,
    taskType,
    checkInType: parsed.data.checkInType ?? undefined,
    actionType: parsed.data.actionType ?? "manual_call",
  }).returning();

  const activityDesc = taskType === "check_in"
    ? `${patient.firstName} ${patient.lastName} flagged for check-in (${parsed.data.checkInType ?? "General"}) — call task created`
    : `${patient.firstName} ${patient.lastName} flagged for missed treatment — call task created`;

  await db.insert(activityTable).values({
    type: taskType === "check_in" ? "check_in_flagged" : "missed_treatment_flagged",
    description: activityDesc,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    metadata: parsed.data.reason,
  });

  res.json({
    ...task,
    flaggedAt: task.flaggedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  });
});

export default router;
