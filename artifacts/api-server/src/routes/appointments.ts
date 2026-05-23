import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, appointmentsTable, activityTable, callTasksTable, patientsTable } from "@workspace/db";
import { z } from "zod/v4";

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

function serializeAppointment(a: typeof appointmentsTable.$inferSelect) {
  return { ...a, duration: a.duration ?? 30 };
}

router.get("/appointments", async (req, res): Promise<void> => {
  const query = ListAppointmentsQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let dbQuery = db.select().from(appointmentsTable).$dynamic();

  if (query.data.status) {
    dbQuery = dbQuery.where(eq(appointmentsTable.status, query.data.status));
  } else {
    dbQuery = dbQuery.where(ne(appointmentsTable.status, "completed"));
  }

  if (query.data.patientId) {
    dbQuery = dbQuery.where(eq(appointmentsTable.patientId, query.data.patientId));
  }

  const appointments = await dbQuery.orderBy(appointmentsTable.scheduledAt);
  res.json(appointments.map(serializeAppointment));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, parsed.data.patientId));
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown";

  const [appt] = await db.insert(appointmentsTable).values({
    ...parsed.data,
    patientName,
  }).returning();

  await db.insert(activityTable).values({
    type: "appointment_scheduled",
    description: `Appointment scheduled for ${patientName}: ${appt.title}`,
    patientId: appt.patientId,
    patientName,
    metadata: appt.scheduledAt,
  });

  res.status(201).json(serializeAppointment(appt));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appt] = await db
    .update(appointmentsTable)
    .set(parsed.data)
    .where(eq(appointmentsTable.id, id))
    .returning();

  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  if (parsed.data.status === "no_show") {
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, appt.patientId));
    if (patient) {
      await db.insert(callTasksTable).values({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
        whatsappNumber: patient.whatsappNumber ?? undefined,
        reason: `No-show for appointment: ${appt.title} on ${new Date(appt.scheduledAt).toLocaleDateString()}`,
        actionType: "manual_call",
      });
    }

    await db.insert(activityTable).values({
      type: "no_show",
      description: `No-show recorded for ${appt.patientName}: ${appt.title}`,
      patientId: appt.patientId,
      patientName: appt.patientName,
      metadata: appt.scheduledAt,
    });
  }

  if (parsed.data.status === "rescheduled" || (parsed.data.scheduledAt && !parsed.data.status)) {
    await db.insert(activityTable).values({
      type: "appointment_rescheduled",
      description: `Appointment rescheduled for ${appt.patientName}: ${appt.title}`,
      patientId: appt.patientId,
      patientName: appt.patientName,
      metadata: parsed.data.scheduledAt ?? appt.scheduledAt,
    });
  }

  res.json(serializeAppointment(appt));
});

export default router;
