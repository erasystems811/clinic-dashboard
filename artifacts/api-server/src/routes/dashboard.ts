import { Router, type IRouter } from "express";
import { sql, gte } from "drizzle-orm";
import { db, patientsTable, appointmentsTable, pipelineStagesTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "New Inquiry", color: "#14b8a6", order: 1 },
  { name: "Consultation", color: "#0ea5e9", order: 2 },
  { name: "Treatment", color: "#f59e0b", order: 3 },
  { name: "Follow-up", color: "#8b5cf6", order: 4 },
  { name: "Discharged", color: "#6b7280", order: 5 },
];

async function ensureStagesExist() {
  const existing = await db.select().from(pipelineStagesTable);
  if (existing.length === 0) {
    await db.insert(pipelineStagesTable).values(DEFAULT_STAGES);
  }
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  await ensureStagesExist();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7).toISOString();

  const [totalResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(patientsTable);

  const [newThisMonthResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(patientsTable)
    .where(gte(patientsTable.createdAt, new Date(startOfMonth)));

  const allAppointments = await db.select().from(appointmentsTable);
  const appointmentsToday = allAppointments.filter(
    a => a.scheduledAt >= startOfDay && a.scheduledAt < endOfDay && a.status !== "cancelled"
  ).length;
  const appointmentsThisWeek = allAppointments.filter(
    a => a.scheduledAt >= startOfWeek && a.scheduledAt < endOfWeek && a.status !== "cancelled"
  ).length;

  const stages = await db.select().from(pipelineStagesTable).orderBy(pipelineStagesTable.order);
  const counts = await db
    .select({
      stage: patientsTable.stage,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(patientsTable)
    .groupBy(patientsTable.stage);

  const countMap = Object.fromEntries(counts.map(c => [c.stage, c.count]));
  const pipelineBreakdown = stages.map(s => ({
    ...s,
    count: countMap[s.name] ?? 0,
  }));

  const criticalAlerts = countMap["New Inquiry"] ?? 0;

  res.json(GetDashboardSummaryResponse.parse({
    totalPatients: totalResult.count,
    newPatientsThisMonth: newThisMonthResult.count,
    appointmentsToday,
    appointmentsThisWeek,
    criticalAlerts,
    pipelineBreakdown,
  }));
});

export default router;
