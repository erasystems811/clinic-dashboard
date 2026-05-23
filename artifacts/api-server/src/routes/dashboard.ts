import { Router, type IRouter } from "express";
import { sql, gte, desc } from "drizzle-orm";
import { db, patientsTable, appointmentsTable, pipelineStagesTable, feedbackTable, wellnessNewsletterTable, queueTable } from "@workspace/db";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "Booked",         color: "#14b8a6", order: 1 },
  { name: "Queued",         color: "#f59e0b", order: 2 },
  { name: "In Care",        color: "#3b82f6", order: 3 },
  { name: "Post Treatment", color: "#8b5cf6", order: 4 },
  { name: "Post Care",      color: "#06b6d4", order: 5 },
  { name: "Dormant",        color: "#6b7280", order: 6 },
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
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
    .where(gte(patientsTable.createdAt, startOfMonth));

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

  const criticalAlerts = (countMap["Queued"] ?? 0) + (countMap["In Care"] ?? 0);

  // Feedback stats
  const [feedbackStats] = await db
    .select({
      avgRating: sql<number>`round(avg(rating)::numeric, 1)`,
      total: sql<number>`cast(count(*) as int)`,
    })
    .from(feedbackTable);

  // Wellness newsletter last sent
  const [latestNewsletter] = await db
    .select()
    .from(wellnessNewsletterTable)
    .orderBy(desc(wellnessNewsletterTable.lastSentAt))
    .limit(1);

  // Average waiting time from queue (checkedInAt vs now for currently queued patients)
  // Use patientsTable checkedInAt for all currently queued patients
  const queuedPatients = await db
    .select({ checkedInAt: patientsTable.checkedInAt })
    .from(patientsTable)
    .where(sql`${patientsTable.stage} = 'Queued' AND ${patientsTable.checkedInAt} IS NOT NULL`);

  let avgWaitMinutes = 0;
  if (queuedPatients.length > 0) {
    const totalMins = queuedPatients.reduce((sum, p) => {
      const checkedInAt = p.checkedInAt ? new Date(p.checkedInAt) : null;
      if (!checkedInAt) return sum;
      return sum + (now.getTime() - checkedInAt.getTime()) / 60000;
    }, 0);
    avgWaitMinutes = Math.round(totalMins / queuedPatients.length);
  }

  res.json({
    totalPatients: totalResult.count,
    newPatientsThisMonth: newThisMonthResult.count,
    appointmentsToday,
    appointmentsThisWeek,
    criticalAlerts,
    pipelineBreakdown,
    avgFeedbackRating: Number(feedbackStats.avgRating) || 0,
    totalFeedback: feedbackStats.total,
    wellnessLastSentAt: latestNewsletter?.lastSentAt?.toISOString() ?? null,
    avgWaitMinutes,
  });
});

export default router;
