import { Router, type IRouter } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

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
  res.json(ListPatientsResponse.parse(patients.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? null,
  }))));
});

router.post("/patients", async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.insert(patientsTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "patient_created",
    description: `New patient registered: ${patient.firstName} ${patient.lastName}`,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
  });

  res.status(201).json(GetPatientResponse.parse({
    ...patient,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt?.toISOString() ?? null,
  }));
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

  res.json(GetPatientResponse.parse({
    ...patient,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt?.toISOString() ?? null,
  }));
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

  res.json(UpdatePatientResponse.parse({
    ...patient,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt?.toISOString() ?? null,
  }));
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

export default router;
