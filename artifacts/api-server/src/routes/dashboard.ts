import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getHospitalFromRequest, getPatientIdsForHospital } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "Booked",         color: "#14b8a6", sort_order: 1 },
  { name: "Queued",         color: "#f59e0b", sort_order: 2 },
  { name: "In Care",        color: "#3b82f6", sort_order: 3 },
  { name: "Post Treatment", color: "#8b5cf6", sort_order: 4 },
  { name: "Active",         color: "#06b6d4", sort_order: 5 },
  { name: "Dormant",        color: "#6b7280", sort_order: 6 },
];

async function ensureStagesExist() {
  const { data: existing } = await supabase.from("pipeline_stages").select("id, name, sort_order");
  const byOrder = new Map((existing ?? []).map(s => [s.sort_order as number, s as { id: number; name: string; sort_order: number }]));
  const byName = new Map((existing ?? []).map(s => [s.name as string, s as { id: number; name: string; sort_order: number }]));

  await Promise.all(DEFAULT_STAGES.map(async (stage) => {
    const existingByOrder = byOrder.get(stage.sort_order);
    const existingByName = byName.get(stage.name);

    if (existingByOrder) {
      if (existingByOrder.name !== stage.name) {
        await supabase.from("pipeline_stages")
          .update({ name: stage.name, color: stage.color })
          .eq("id", existingByOrder.id);
      }
    } else if (!existingByName) {
      await supabase.from("pipeline_stages").insert(stage);
    }
  }));
}

// ── Date bounds in Africa/Lagos (WAT = UTC+1) ─────────────────────────────────
function getLagosBounds() {
  const utcNow = new Date();
  const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1

  // Shift to Lagos "wall clock" in UTC fields
  const lagos = new Date(utcNow.getTime() + LAGOS_OFFSET_MS);
  const y = lagos.getUTCFullYear();
  const mo = lagos.getUTCMonth();
  const d = lagos.getUTCDate();
  const dow = lagos.getUTCDay(); // 0=Sun … 6=Sat

  // Convert Lagos midnight back to UTC by subtracting the offset
  const startOfDay  = new Date(Date.UTC(y, mo, d)     - LAGOS_OFFSET_MS);
  const endOfDay    = new Date(Date.UTC(y, mo, d + 1) - LAGOS_OFFSET_MS);
  const startOfMonth = new Date(Date.UTC(y, mo, 1)    - LAGOS_OFFSET_MS);

  // Week starts Monday (ISO) — Sun(0) is 6 days after Monday
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const startOfWeek = new Date(Date.UTC(y, mo, d - daysToMonday)     - LAGOS_OFFSET_MS);
  const endOfWeek   = new Date(Date.UTC(y, mo, d - daysToMonday + 7) - LAGOS_OFFSET_MS);

  const startOfLastMonth = new Date(Date.UTC(y, mo - 1, 1) - LAGOS_OFFSET_MS);

  return { utcNow, startOfDay, endOfDay, startOfMonth, startOfLastMonth, startOfWeek, endOfWeek };
}

// Statuses that should not count toward active appointment metrics
const EXCLUDED_STATUSES = new Set(["cancelled", "no_show", "dismissed"]);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  await ensureStagesExist();

  const { utcNow, startOfDay, endOfDay, startOfMonth, startOfLastMonth, startOfWeek, endOfWeek } = getLagosBounds();

  // Get patient IDs for this hospital (needed for appointments + feedback)
  const patientIds = await getPatientIdsForHospital(hospital.username);
  const safePatientIds = patientIds.length ? patientIds : [-1];

  const [
    { count: totalPatients },
    { count: newThisMonth },
    { data: weekAppointments },
    { data: stages },
    { data: allPatientStages },
    { data: allFeedback },
    { data: newsletters },
    { data: queuedPatients },
    { data: allAppointments },
    { data: dequeuedActivity },
    { data: carePlanPatients },
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("hospital_id", hospital.username),
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("hospital_id", hospital.username).gte("created_at", startOfMonth.toISOString()),
    // Only fetch appointments within the current week window — not all-time
    supabase.from("appointments").select("scheduled_at, status")
      .in("patient_id", safePatientIds)
      .gte("scheduled_at", startOfWeek.toISOString())
      .lt("scheduled_at", endOfWeek.toISOString()),
    supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
    supabase.from("patients").select("id, stage").eq("hospital_id", hospital.username),
    supabase.from("feedback").select("rating").eq("hospital_id", hospital.intId),
    supabase.from("wellness_newsletter").select("last_sent_at").eq("hospital_id", hospital.intId).order("last_sent_at", { ascending: false }).limit(1),
    supabase.from("queue").select("patient_id, added_at").eq("hospital_id", hospital.username),
    // All-time appointments for no-show rate calculation
    supabase.from("appointments").select("status, scheduled_at").in("patient_id", safePatientIds),
    // All-time dequeue events with stamped wait_minutes in metadata
    supabase.from("activity")
      .select("metadata, created_at")
      .eq("hospital_id", hospital.intId)
      .eq("type", "dequeued")
      .not("metadata", "is", null),
    // Patients who have any care plan row (regardless of patients.stage value)
    supabase.from("care_plans").select("patient_id").eq("hospital_id", hospital.username),
  ]);

  const startOfDayISO = startOfDay.toISOString();
  const endOfDayISO   = endOfDay.toISOString();

  const appointmentsToday = (weekAppointments ?? []).filter(
    a => a.scheduled_at >= startOfDayISO && a.scheduled_at < endOfDayISO && !EXCLUDED_STATUSES.has(a.status)
  ).length;
  const appointmentsThisWeek = (weekAppointments ?? []).filter(
    a => !EXCLUDED_STATUSES.has(a.status)
  ).length;

  const countMap: Record<string, number> = {};
  for (const p of allPatientStages ?? []) {
    countMap[p.stage] = (countMap[p.stage] ?? 0) + 1;
  }

  // "Queued" and "Booked" are derived states — their counts come from queue/appointments tables,
  // not from patients.stage. All other stages (Active, In Care, Post Treatment, Dormant) use countMap.
  const queueCount = queuedPatients?.length ?? 0;
  const pipelineBreakdown = (stages ?? []).map((s: Record<string, unknown>) => {
    let count: number;
    if (s.name === "Queued") {
      count = queueCount;
    } else {
      count = countMap[s.name as string] ?? 0;
    }
    return { id: s.id, name: s.name, color: s.color, order: s.sort_order, count };
  });

  // Distinct count: patients who are in queue OR currently in care (no double-counting).
  // "In Care" = patients.stage is "In Care" OR patient has any care_plans row.
  const queuedIds = new Set((queuedPatients ?? []).map(q => q.patient_id as number));
  const inCareByStage = new Set((allPatientStages ?? []).filter(p => p.stage === "In Care").map(p => (p as Record<string, unknown>).id as number));
  const inCareByPlan = new Set((carePlanPatients ?? []).map(p => p.patient_id as number));
  const activePatientIds = new Set([...queuedIds, ...inCareByStage, ...inCareByPlan]);
  const criticalAlerts = activePatientIds.size;

  const feedbackList = allFeedback ?? [];
  const avgFeedbackRating = feedbackList.length > 0
    ? Math.round((feedbackList.reduce((s, f) => s + (f.rating ?? 0), 0) / feedbackList.length) * 10) / 10
    : 0;

  // ── All-time avg wait: completed waits (from dequeue activity) + live waits (currently queued) ──
  const completedWaits = (dequeuedActivity ?? [])
    .map(a => parseFloat(a.metadata ?? ""))
    .filter(m => !isNaN(m) && m >= 0);

  const liveWaits = (queuedPatients ?? [])
    .map(q => q.added_at ? (utcNow.getTime() - new Date(q.added_at).getTime()) / 60000 : null)
    .filter((m): m is number => m !== null && m >= 0);

  const allWaits = [...completedWaits, ...liveWaits];
  const avgWaitMinutes = allWaits.length > 0
    ? Math.round(allWaits.reduce((s, m) => s + m, 0) / allWaits.length)
    : 0;

  // ── No-show rate (overall, all-time) ─────────────────────────────────────────
  const aptList = allAppointments ?? [];
  const totalAppts = aptList.length;
  const noShows = aptList.filter(a => a.status === "no_show").length;
  const noShowRate = totalAppts > 0 ? Math.round((noShows / totalAppts) * 1000) / 10 : 0;

  // Trend: compare this month vs last month
  const startOfMonthISO = startOfMonth.toISOString();
  const startOfLastMonthISO = startOfLastMonth.toISOString();
  const thisMonthAppts = aptList.filter(a => a.scheduled_at >= startOfMonthISO);
  const lastMonthAppts = aptList.filter(a => a.scheduled_at >= startOfLastMonthISO && a.scheduled_at < startOfMonthISO);
  const thisMonthNoShowRate = thisMonthAppts.length > 0 ? thisMonthAppts.filter(a => a.status === "no_show").length / thisMonthAppts.length : null;
  const lastMonthNoShowRate = lastMonthAppts.length > 0 ? lastMonthAppts.filter(a => a.status === "no_show").length / lastMonthAppts.length : null;
  let noShowTrend: "up" | "down" | "stable" = "stable";
  if (thisMonthNoShowRate !== null && lastMonthNoShowRate !== null) {
    if (thisMonthNoShowRate > lastMonthNoShowRate + 0.01) noShowTrend = "up";
    else if (thisMonthNoShowRate < lastMonthNoShowRate - 0.01) noShowTrend = "down";
  }

  // ── Avg wait trend (this month vs last month, from stamped dequeue activity) ──
  const calcAvgFromActivity = (rows: { metadata: string | null }[]) => {
    const vals = rows.map(r => parseFloat(r.metadata ?? "")).filter(m => !isNaN(m) && m >= 0);
    return vals.length > 0 ? vals.reduce((s, m) => s + m, 0) / vals.length : null;
  };
  const actList = dequeuedActivity ?? [];
  const thisMonthWait = calcAvgFromActivity(actList.filter(a => a.created_at >= startOfMonthISO));
  const lastMonthWait = calcAvgFromActivity(actList.filter(a => a.created_at >= startOfLastMonthISO && a.created_at < startOfMonthISO));
  let avgWaitTrend: "up" | "down" | "stable" = "stable";
  if (thisMonthWait !== null && lastMonthWait !== null) {
    if (thisMonthWait > lastMonthWait * 1.05) avgWaitTrend = "up";
    else if (thisMonthWait < lastMonthWait * 0.95) avgWaitTrend = "down";
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
    noShowRate,
    noShowTrend,
    avgWaitTrend,
  });
});

export default router;
