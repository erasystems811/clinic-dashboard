import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { z } from "zod/v4";

const router: IRouter = Router();

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Sync today's snapshot ─────────────────────────────────────────────────────
// Called automatically by the app every 60 s while tracking is active.
// Upserts so only one row per account per day is ever stored.
router.post("/patient-app/auto-health/sync", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({
    steps:          z.number().int().min(0),
    distanceMeters: z.number().int().min(0),
    activeMinutes:  z.number().int().min(0),
    caloriesBurned: z.number().int().min(0),
    activityType:   z.enum(["still", "walking", "running", "cycling", "unknown"]).default("unknown"),
    sleepHours:     z.number().min(0).max(24).nullable().default(null),
    sleepQuality:   z.enum(["good", "fair", "poor"]).nullable().default(null),
    source:         z.enum(["web", "native"]).default("web"),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  const { error } = await supabase.from("patient_auto_health_logs").upsert(
    {
      account_id:      account.id,
      date:            todayStr(),
      steps:           body.data.steps,
      distance_meters: body.data.distanceMeters,
      active_minutes:  body.data.activeMinutes,
      calories_burned: body.data.caloriesBurned,
      activity_type:   body.data.activityType,
      sleep_hours:     body.data.sleepHours,
      sleep_quality:   body.data.sleepQuality,
      source:          body.data.source,
      recorded_at:     new Date().toISOString(),
    },
    { onConflict: "account_id,date" }
  );

  if (error) { res.status(500).json({ error: "Failed to save health data" }); return; }

  res.json({ ok: true });
});

type RawLog = {
  date: string; steps: number;
  distance_meters: number; active_minutes: number;
  calories_burned: number; activity_type: string;
  sleep_hours: number | null; sleep_quality: string | null;
};
function toLog(r: RawLog) {
  return {
    date: r.date, steps: r.steps,
    distanceMeters: r.distance_meters,
    activeMinutes: r.active_minutes,
    caloriesBurned: r.calories_burned,
    activityType: r.activity_type,
    sleepHours: r.sleep_hours,
    sleepQuality: r.sleep_quality,
  };
}

// ── Get today's logged snapshot ───────────────────────────────────────────────
router.get("/patient-app/auto-health/today", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_auto_health_logs")
    .select("date, steps, distance_meters, active_minutes, calories_burned, sleep_hours, sleep_quality, activity_type")
    .eq("account_id", account.id)
    .eq("date", todayStr())
    .maybeSingle();

  res.json({ log: data ? toLog(data as RawLog) : null });
});

// ── Get last 7 days history ───────────────────────────────────────────────────
router.get("/patient-app/auto-health/history", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const since = sevenDaysAgo.toISOString().split("T")[0];

  const { data } = await supabase
    .from("patient_auto_health_logs")
    .select("date, steps, distance_meters, active_minutes, calories_burned, sleep_hours, sleep_quality, activity_type")
    .eq("account_id", account.id)
    .gte("date", since)
    .order("date", { ascending: false });

  res.json({ history: (data ?? []).map((r) => toLog(r as RawLog)) });
});

export default router;
