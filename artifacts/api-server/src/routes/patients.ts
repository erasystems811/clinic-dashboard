import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, patientsTable, activityTable } from "@workspace/db";
import {
  ListPatientsQueryParams,
  CreatePatientBody,
  GetPatientParams,
  GetPatientResponse,
  UpdatePatientParams,
  UpdatePatientBody,
  UpdatePatientResponse,
  DeletePatientParams,
  ListPatientsResponse,
  CheckinPatientParams,
  CheckinPatientResponse,
  DequeuePatientParams,
  DequeuePatientResponse,
  LogTreatmentPlanParams,
  LogTreatmentPlanBody,
  LogTreatmentPlanResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializePatient(p: typeof patientsTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

router.get("/patients", async (req, res): Promise<void> => {
  const query = ListPatientsQueryParams.safeParse(req.query);
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
      )
    );
  }

  const patients = await dbQuery.orderBy(patientsTable.createdAt);
  res.json(ListPatientsResponse.parse(patients.map(serializePatient)));
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

  res.status(201).json(GetPatientResponse.parse(serializePatient(patient)));
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPatientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  res.json(GetPatientResponse.parse(serializePatient(patient)));
});

router.patch("/patients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePatientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db
    .update(patientsTable)
    .set(parsed.data)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  if (parsed.data.stage) {
    await db.insert(activityTable).values({
      type: "stage_changed",
      description: `${patient.firstName} ${patient.lastName} moved to ${parsed.data.stage}`,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      metadata: parsed.data.stage,
    });
  }

  res.json(UpdatePatientResponse.parse(serializePatient(patient)));
});

router.delete("/patients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePatientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db.delete(patientsTable).where(eq(patientsTable.id, params.data.id)).returning();
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "patient_deleted",
    description: `Patient record removed: ${patient.firstName} ${patient.lastName}`,
    patientId: null,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.sendStatus(204);
});

// POST /patients/:id/checkin — receptionist checks patient in → Queued
router.post("/patients/:id/checkin", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CheckinPatientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const now = new Date().toISOString();
  const [patient] = await db
    .update(patientsTable)
    .set({ stage: "Queued", checkedInAt: now })
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  await db.insert(activityTable).values({
    type: "checkin",
    description: `${patient.firstName} ${patient.lastName} checked in — added to queue`,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    metadata: now,
  });

  res.json(CheckinPatientResponse.parse(serializePatient(patient)));
});

// POST /patients/:id/dequeue — receptionist removes patient from queue (doctor calls them in)
router.post("/patients/:id/dequeue", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DequeuePatientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [patient] = await db
    .update(patientsTable)
    .set({ stage: "In Care" })
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  await db.insert(activityTable).values({
    type: "dequeued",
    description: `${patient.firstName} ${patient.lastName} called in by doctor — removed from queue`,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.json(DequeuePatientResponse.parse(serializePatient(patient)));
});

// POST /patients/:id/treatment-plan — nurse logs treatment plan → In Care + reminders
router.post("/patients/:id/treatment-plan", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = LogTreatmentPlanParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = LogTreatmentPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const now = new Date().toISOString();
  const updateData: Partial<typeof patientsTable.$inferSelect> = {
    treatmentPlan: parsed.data.treatmentPlan,
    stage: "In Care",
    treatmentStartedAt: now,
  };
  if (parsed.data.diagnosis) updateData.diagnosis = parsed.data.diagnosis;
  if (parsed.data.doctor) updateData.doctor = parsed.data.doctor;

  const [patient] = await db
    .update(patientsTable)
    .set(updateData)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  const intervalDays = parsed.data.reminderIntervalDays ?? 7;
  const patientName = `${patient.firstName} ${patient.lastName}`;

  // Log treatment plan + create scheduled reminders in activity feed
  await db.insert(activityTable).values({
    type: "treatment_plan_logged",
    description: `Treatment plan logged for ${patientName} — moved to In Care`,
    patientId: patient.id,
    patientName,
    metadata: parsed.data.treatmentPlan,
  });

  // Schedule 3 reminder entries (simulated automation)
  const reminders = [1, 2, 3].map((n) => ({
    type: "treatment_reminder",
    description: `Treatment reminder ${n} scheduled for ${patientName} (in ${n * intervalDays} days)`,
    patientId: patient.id,
    patientName,
    metadata: `day_${n * intervalDays}`,
  }));
  await db.insert(activityTable).values(reminders);

  res.json(LogTreatmentPlanResponse.parse(serializePatient(patient)));
});

export default router;
