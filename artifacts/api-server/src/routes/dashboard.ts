import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getHospitalFromRequest, getPatientIdsForHospital } from "../lib/hospital-auth.js";

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

  return { utcNow, startOfDay, endOfDay, startOfMonth, startOfWeek, endOfWeek };
}

// Statuses that should not count toward active appointment metrics
const EXCLUDED_STATUSES = new Set(["cancelled", "no_show", "dismissed"]);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  await ensureStagesExist();

  const { utcNow, startOfDay, endOfDay, startOfMonth, startOfWeek, endOfWeek } = getLagosBounds();

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
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("hospital_id", hospital.username),
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("hospital_id", hospital.username).gte("created_at", startOfMonth.toISOString()),
    // Only fetch appointments within the current week window — not all-time
    supabase.from("appointments").select("scheduled_at, status")
      .in("patient_id", safePatientIds)
      .gte("scheduled_at", startOfWeek.toISOString())
      .lt("scheduled_at", endOfWeek.toISOString()),
    supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
    supabase.from("patients").select("stage").eq("hospital_id", hospital.username),
    supabase.from("feedback").select("rating").in("patient_id", safePatientIds),
    supabase.from("wellness_newsletter").select("last_sent_at").eq("hospital_id", hospital.intId).order("last_sent_at", { ascending: false }).limit(1),
    supabase.from("patients").select("checked_in_at").eq("hospital_id", hospital.username).eq("stage", "Queued").not("checked_in_at", "is", null),
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
      return sum + (utcNow.getTime() - checkedInAt.getTime()) / 60000;
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
