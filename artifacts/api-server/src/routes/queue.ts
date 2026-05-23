import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, queueTable, patientsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const entries = await db
    .select({
      id: queueTable.id,
      patientId: queueTable.patientId,
      patientName: queueTable.patientName,
      position: queueTable.position,
      addedAt: queueTable.addedAt,
      phone: patientsTable.phone,
      email: patientsTable.email,
      stage: patientsTable.stage,
    })
    .from(queueTable)
    .leftJoin(patientsTable, eq(queueTable.patientId, patientsTable.id))
    .orderBy(asc(queueTable.position));

  res.json(entries.map((e) => ({
    ...e,
    addedAt: e.addedAt.toISOString(),
  })));
});

export default router;
