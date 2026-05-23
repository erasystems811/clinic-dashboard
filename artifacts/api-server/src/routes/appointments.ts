import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, appointmentsTable, activityTable } from "@workspace/db";
import {
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  CreateAppointmentBody,
  ListAppointmentsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let dbQuery = db.select().from(appointmentsTable).$dynamic();

  if (query.data.patientId) {
    dbQuery = dbQuery.where(eq(appointmentsTable.patientId, query.data.patientId));
  }

  const appointments = await dbQuery.orderBy(appointmentsTable.scheduledAt);

  res.json(ListAppointmentsResponse.parse(appointments.map(a => ({
    ...a,
    duration: a.duration ?? 30,
  }))));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appt] = await db.insert(appointmentsTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "appointment_scheduled",
    description: `Appointment scheduled for ${appt.patientName}: ${appt.title}`,
    patientId: appt.patientId,
    patientName: appt.patientName,
    metadata: appt.scheduledAt,
  });

  res.status(201).json(ListAppointmentsResponseItem.parse({
    ...appt,
    duration: appt.duration ?? 30,
  }));
});

export default router;
