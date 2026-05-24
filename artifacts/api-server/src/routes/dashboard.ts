import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "Booked",         color: "#14b8a6", sort_order: 1 },
  { name: "Queued",         color: "#f59e0b", sort_order: 2 },
  { name: "In Care",        color: "#3b82f6", sort_order: 3 },
  { name: "Post Treatment", color: "#8b5cf6", sort_order: 4 },
  { name: "Post Care",      color: "#06b6d4", sort_order: 5 },
  { name: "Dormant",        color: "#6b7280", sort_order: 6 },
];

async function ensureStagesExist() {
  const { data: existing } = await supabase.from("pipeline_stages").select("id");
  if (!existing || existing.length === 0) {
    await supabase.from("pipeline_stages").insert(DEFAULT_STAGES);
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

  const [
    { count: totalPatients },
    { count: newThisMonth },
    { data: allAppointments },
    { data: stages },
    { data: allPatientStages },
    { data: allFeedback },
    { data: newsletters },
    { data: queuedPatients },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("patients").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("appointments").select("scheduled_at, status"),
    supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
    supabase.from("patients").select("stage"),
    supabase.from("feedback").select("rating"),
    supabase.from("wellness_newsletter").select("last_sent_at").order("last_sent_at", { ascending: false }).limit(1),
    supabase.from("patients").select("checked_in_at").eq("stage", "Queued").not("checked_in_at", "is", null),
  ]);

  const appointmentsToday = (allAppointments ?? []).filter(
    a => a.scheduled_at >= startOfDay && a.scheduled_at < endOfDay && a.status !== "cancelled"
  ).length;
  const appointmentsThisWeek = (allAppointments ?? []).filter(
    a => a.scheduled_at >= startOfWeek && a.scheduled_at < endOfWeek && a.status !== "cancelled"
  ).length;

  const countMap: Record<string, number> = {};
  for (const p of allPatientStages ?? []) {
    countMap[p.stage] = (countMap[p.stage] ?? 0) + 1;
  }

  const pipelineBreakdown = (stages ?? []).map((s: Record<string, unknown>) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    order: s.sort_order,
    count: countMap[s.name as string] ?? 0,
  }));

  const criticalAlerts = (countMap["Queued"] ?? 0) + (countMap["In Care"] ?? 0);

  const feedbackList = allFeedback ?? [];
  const avgFeedbackRating = feedbackList.length > 0
    ? Math.round((feedbackList.reduce((s, f) => s + (f.rating ?? 0), 0) / feedbackList.length) * 10) / 10
    : 0;

  let avgWaitMinutes = 0;
  if ((queuedPatients ?? []).length > 0) {
    const totalMins = (queuedPatients ?? []).reduce((sum, p) => {
      const checkedInAt = p.checked_in_at ? new Date(p.checked_in_at) : null;
      if (!checkedInAt) return sum;
      return sum + (now.getTime() - checkedInAt.getTime()) / 60000;
    }, 0);
    avgWaitMinutes = Math.round(totalMins / queuedPatients!.length);
  }

  res.json({
    totalPatients: totalPatients ?? 0,
    newPatientsThisMonth: newThisMonth ?? 0,
    appointmentsToday,
    appointmentsThisWeek,
    criticalAlerts,
    pipelineBreakdown,
    avgFeedbackRating,
    totalFeedback: feedbackList.length,
    wellnessLastSentAt: newsletters?.[0]?.last_sent_at ?? null,
    avgWaitMinutes,
  });
});

export default router;
