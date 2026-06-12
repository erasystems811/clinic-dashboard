import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { getWeekStart, type WeekPlan } from "./patient-app-plan.js";

const router: IRouter = Router();

const VALID_TYPES = [
  "water", "medications", "workout", "sleep", "mood_check", "fruit",
  "vitals", "smoking", "eyebreak", "sunscreen", "outdoors", "vaccines", "checkups", "hygiene",
];
// Daily habit modules — shown in checklist and used for week summary
const DAILY_HABIT_TYPES = [
  "water", "medications", "workout", "sleep", "mood_check", "fruit",
  "vitals", "eyebreak", "sunscreen", "outdoors",
];
const MODULE_META: Record<string, { label: string; emoji: string }> = {
  water:      { label: "Water intake",   emoji: "💧" },
  medications:{ label: "Medications",    emoji: "💊" },
  workout:    { label: "Workout",        emoji: "🏃" },
  sleep:      { label: "Sleep log",      emoji: "😴" },
  mood_check: { label: "Daily check-in", emoji: "😊" },
  fruit:      { label: "Eat fruit",      emoji: "🍎" },
  vitals:     { label: "Vitals",         emoji: "❤️" },
  eyebreak:   { label: "Eye breaks",     emoji: "👁️" },
  sunscreen:  { label: "Sunscreen",      emoji: "🧴" },
  outdoors:   { label: "Outdoors",       emoji: "🌿" },
};
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function todayDateStr(): string { return new Date().toISOString().split("T")[0]; }
function todayDayKey(): string { return DAY_KEYS[new Date().getDay()]; }

// ── Shared completion logic ────────────────────────────────────────────────────
export function isModuleCompleted(
  type: string,
  log: Record<string, unknown> | undefined,
  settings: Record<string, unknown>,
  date: string
): boolean {
  if (!log) return false;
  if (type === "water") {
    return ((log.cups as number) ?? 0) >= ((settings.target as number) ?? 8);
  }
  if (type === "fruit" || type === "sunscreen") return log.done === true;
  if (type === "sleep") return !!(log.bedtime && log.wakeTime);
  if (type === "mood_check") return !!(log.mood && log.energy && log.stress);
  if (type === "vitals") return !!(log.systolic || log.glucose || log.weight);
  if (type === "outdoors") return ((log.minutes as number) ?? 0) >= ((settings.target as number) ?? 30);
  if (type === "workout") {
    const dayKey = DAY_KEYS[new Date(date + "T12:00:00").getDay()];
    const days = (settings.days as Record<string, Record<string, unknown>>) ?? {};
    if (!days[dayKey]?.enabled) return true; // rest day counts
    return log.completed === true;
  }
  if (type === "medications") {
    const meds = ((settings.medications as Array<Record<string, unknown>>) ?? []).filter((m) => {
      const start = m.startDate as string;
      const dur = m.durationDays as number | null;
      if (date < start) return false;
      if (dur && new Date(start).getTime() + dur * 86400000 < new Date(date).getTime()) return false;
      return true;
    });
    if (meds.length === 0) return true;
    const taken = (log.taken as Record<string, boolean>) ?? {};
    return meds.every((m) => (m.times as string[]).every((t) => taken[`${m.id}_${t}`] === true));
  }
  if (type === "eyebreak") {
    const [sh, sm] = ((settings.startTime as string) ?? "09:00").split(":").map(Number);
    const [eh, em] = ((settings.endTime   as string) ?? "18:00").split(":").map(Number);
    const defaultTarget = Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
    return ((log.count as number) ?? 0) >= ((settings.targetBreaks as number) ?? defaultTarget);
  }
  return false;
}

// Sub-text for checklist items
function checklistSub(type: string, log: Record<string, unknown>, settings: Record<string, unknown>, todayStr: string): string | undefined {
  if (type === "water") {
    const cups = (log.cups as number) ?? 0;
    const target = (settings.target as number) ?? 8;
    return `${cups} / ${target} cups`;
  }
  if (type === "eyebreak") {
    const count = (log.count as number) ?? 0;
    const [sh, sm] = ((settings.startTime as string) ?? "09:00").split(":").map(Number);
    const [eh, em] = ((settings.endTime   as string) ?? "18:00").split(":").map(Number);
    const target = (settings.targetBreaks as number) ?? Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
    return `${count} / ${target} breaks`;
  }
  if (type === "outdoors") {
    const minutes = (log.minutes as number) ?? 0;
    const target = (settings.target as number) ?? 30;
    return `${minutes} / ${target} min`;
  }
  if (type === "medications") {
    const meds = ((settings.medications as Array<Record<string, unknown>>) ?? []).filter((m) => {
      const start = m.startDate as string;
      const dur = m.durationDays as number | null;
      if (todayStr < start) return false;
      if (dur && new Date(start).getTime() + dur * 86400000 < new Date(todayStr).getTime()) return false;
      return true;
    });
    const taken = (log.taken as Record<string, boolean>) ?? {};
    const total = meds.reduce((a, m) => a + (m.times as string[]).length, 0);
    const done  = meds.reduce((a, m) => a + (m.times as string[]).filter((t) => taken[`${m.id}_${t}`]).length, 0);
    return total > 0 ? `${done} / ${total} doses taken` : undefined;
  }
  if (type === "sleep") {
    if (log.bedtime && log.wakeTime) {
      return `${log.bedtime as string} → ${log.wakeTime as string}`;
    }
    return "Log last night's sleep";
  }
  if (type === "mood_check") {
    if (!log.mood) return "Mood, energy & stress";
    return undefined;
  }
  return undefined;
}

// ── GET /api/patient-app/wellness/today ───────────────────────────────────────
router.get("/patient-app/wellness/today", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayDateStr();
  const dayKey = todayDayKey();

  const weekStart = getWeekStart();

  const [modulesResult, logsResult, planResult] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, settings, enabled").eq("account_id", account.id),
    supabase.from("wellness_logs").select("module_type, data").eq("account_id", account.id).eq("log_date", today),
    supabase.from("weekly_plans").select("plan_data").eq("account_id", account.id).eq("week_start", weekStart).maybeSingle(),
  ]);

  const moduleMap: Record<string, { settings: Record<string, unknown>; enabled: boolean }> = {};
  for (const m of modulesResult.data ?? []) {
    moduleMap[m.module_type as string] = {
      settings: (m.settings as Record<string, unknown>) ?? {},
      enabled: m.enabled as boolean,
    };
  }
  const logMap: Record<string, Record<string, unknown>> = {};
  for (const l of logsResult.data ?? []) {
    logMap[l.module_type as string] = (l.data as Record<string, unknown>) ?? {};
  }

  // Build checklist from the weekly plan (falls back to module-based logic if no plan)
  const checklist: Array<{ id: string; emoji: string; label: string; sub?: string; done: boolean }> = [];
  const plan = planResult.data?.plan_data as WeekPlan | null;
  const todayPlanDay = plan?.days.find((d) => d.date === today);

  if (todayPlanDay && todayPlanDay.items.length > 0) {
    for (const item of todayPlanDay.items) {
      const log = logMap[item.moduleType] ?? null;
      const settings = moduleMap[item.moduleType]?.settings ?? {};

      if (item.isRestDay) {
        checklist.push({ id: item.moduleType, emoji: item.emoji, label: item.label, sub: item.sub, done: true });
        continue;
      }

      const done = isModuleCompleted(item.moduleType, log ?? undefined, settings, today);
      const sub = log ? (checklistSub(item.moduleType, log, settings, today) ?? item.sub) : item.sub;
      checklist.push({ id: item.moduleType, emoji: item.emoji, label: item.label, sub, done });
    }
  } else {
    // No plan yet — fall back to direct module-based checklist
    for (const type of DAILY_HABIT_TYPES) {
      const mod = moduleMap[type];
      if (!mod?.enabled) continue;
      const log = logMap[type] ?? null;
      const settings = mod.settings;

      if (type === "workout") {
        const workoutDays = (settings.days as Record<string, Record<string, unknown>>) ?? {};
        const todayWorkout = workoutDays[dayKey];
        if (todayWorkout?.enabled) {
          checklist.push({ id: "workout", emoji: "🏃", label: "Workout", sub: (todayWorkout.focus as string | undefined) ?? undefined, done: log?.completed === true });
        } else if (dayKey in workoutDays) {
          checklist.push({ id: "workout", emoji: "😌", label: "Rest day", sub: "No workout today", done: true });
        }
        continue;
      }

      if (type === "medications") {
        const meds = ((settings.medications as Array<Record<string, unknown>>) ?? []).filter((m) => {
          const start = m.startDate as string;
          const dur = m.durationDays as number | null;
          if (today < start) return false;
          if (dur && new Date(start).getTime() + dur * 86400000 < new Date(today).getTime()) return false;
          return true;
        });
        if (meds.length === 0) continue;
        const taken = (log?.taken as Record<string, boolean>) ?? {};
        const total = meds.reduce((a, m) => a + (m.times as string[]).length, 0);
        const done  = meds.reduce((a, m) => a + (m.times as string[]).filter((t) => taken[`${m.id}_${t}`]).length, 0);
        checklist.push({ id: "medications", emoji: "💊", label: "Medications", sub: `${done} / ${total} doses taken`, done: done === total });
        continue;
      }

      const meta = MODULE_META[type];
      const done = isModuleCompleted(type, log ?? undefined, settings, today);
      const sub = log ? checklistSub(type, log, settings, today) : (type === "sleep" ? "Log last night's sleep" : type === "mood_check" ? "Mood, energy & stress" : undefined);
      checklist.push({ id: type, emoji: meta.emoji, label: meta.label, sub, done });
    }
  }

  // Keep legacy `modules` object for backwards compat with other pages
  const workoutSettings = moduleMap["workout"]?.settings ?? {};
  const workoutDays = (workoutSettings.days as Record<string, Record<string, unknown>>) ?? {};
  const todayWorkout = workoutDays[dayKey];

  res.json({
    date: today,
    dayKey,
    checklist,
    modules: {
      water:      { enabled: moduleMap["water"]?.enabled ?? false,      settings: moduleMap["water"]?.settings ?? {},      log: logMap["water"] ?? null },
      medications:{ enabled: moduleMap["medications"]?.enabled ?? false, settings: moduleMap["medications"]?.settings ?? {}, log: logMap["medications"] ?? null },
      workout:    { enabled: moduleMap["workout"]?.enabled ?? false,     settings: moduleMap["workout"]?.settings ?? {},    log: logMap["workout"] ?? null, todayPlan: todayWorkout?.enabled ? todayWorkout : null },
      sleep:      { enabled: moduleMap["sleep"]?.enabled ?? false,       settings: moduleMap["sleep"]?.settings ?? {},      log: logMap["sleep"] ?? null },
      mood_check: { enabled: moduleMap["mood_check"]?.enabled ?? false,  log: logMap["mood_check"] ?? null },
      fruit:      { enabled: moduleMap["fruit"]?.enabled ?? false,       settings: moduleMap["fruit"]?.settings ?? {},      log: logMap["fruit"] ?? null },
    },
  });
});

// ── GET /api/patient-app/wellness/week-summary ────────────────────────────────
router.get("/patient-app/wellness/week-summary", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayDateStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fromDate = sevenDaysAgo.toISOString().split("T")[0];

  // Build list of the last 7 dates (oldest → newest)
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    weekDates.push(d.toISOString().split("T")[0]);
  }

  const [modulesResult, logsResult] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, settings, enabled").eq("account_id", account.id),
    supabase.from("wellness_logs").select("module_type, log_date, data")
      .eq("account_id", account.id).gte("log_date", fromDate)
      .in("module_type", DAILY_HABIT_TYPES),
  ]);

  const moduleMap: Record<string, { settings: Record<string, unknown>; enabled: boolean }> = {};
  for (const m of modulesResult.data ?? []) {
    if ((m.enabled as boolean) && DAILY_HABIT_TYPES.includes(m.module_type as string)) {
      moduleMap[m.module_type as string] = {
        settings: (m.settings as Record<string, unknown>) ?? {},
        enabled: true,
      };
    }
  }

  // logIndex[type][date] = data
  const logIndex: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const l of logsResult.data ?? []) {
    const t = l.module_type as string, d = l.log_date as string;
    if (!logIndex[t]) logIndex[t] = {};
    logIndex[t][d] = (l.data as Record<string, unknown>) ?? {};
  }

  // Build stats per module
  const moduleStats: Array<{ type: string; label: string; emoji: string; completedDays: number; days: boolean[] }> = [];
  let totalCompleted = 0, totalPossible = 0;

  for (const type of DAILY_HABIT_TYPES) {
    const mod = moduleMap[type];
    if (!mod) continue;
    const days: boolean[] = weekDates.map((date) => {
      // Future dates are never completed
      if (date > today) return false;
      // For workout rest days: count as done
      const log = logIndex[type]?.[date];
      return isModuleCompleted(type, log, mod.settings, date);
    });
    const completedDays = days.filter(Boolean).length;
    // Only count past days + today for possible
    const possibleDays = weekDates.filter((d) => d <= today).length;
    totalCompleted += completedDays;
    totalPossible += possibleDays;
    moduleStats.push({ type, label: MODULE_META[type].label, emoji: MODULE_META[type].emoji, completedDays, days });
  }

  // Mood average from mood_check logs
  let moodAvg: { mood: number; energy: number; stress: number } | null = null;
  const moodLogs = Object.values(logIndex["mood_check"] ?? {});
  if (moodLogs.length > 0) {
    const sum = moodLogs.reduce<{ mood: number; energy: number; stress: number }>(
      (a, l) => ({ mood: a.mood + ((l.mood as number) ?? 0), energy: a.energy + ((l.energy as number) ?? 0), stress: a.stress + ((l.stress as number) ?? 0) }),
      { mood: 0, energy: 0, stress: 0 }
    );
    moodAvg = { mood: Math.round((sum.mood / moodLogs.length) * 10) / 10, energy: Math.round((sum.energy / moodLogs.length) * 10) / 10, stress: Math.round((sum.stress / moodLogs.length) * 10) / 10 };
  }

  res.json({
    weekStart: weekDates[0],
    weekEnd: weekDates[6],
    moduleStats,
    moodAvg,
    overallRate: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0,
    totalCompleted,
    totalPossible,
  });
});

// ── GET /api/patient-app/wellness/modules ─────────────────────────────────────
router.get("/patient-app/wellness/modules", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase.from("wellness_modules").select("module_type, settings, enabled, updated_at").eq("account_id", account.id);

  const result: Record<string, unknown> = {};
  for (const m of data ?? []) {
    result[m.module_type as string] = { settings: m.settings, enabled: m.enabled, updatedAt: m.updated_at };
  }
  res.json(result);
});

// ── PUT /api/patient-app/wellness/modules/:type ───────────────────────────────
router.put("/patient-app/wellness/modules/:type", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  if (!VALID_TYPES.includes(type)) { res.status(400).json({ error: "Invalid module type" }); return; }

  const { settings = {}, enabled = true } = req.body ?? {};
  const now = new Date().toISOString();

  const { data, error } = await supabase.from("wellness_modules").upsert({
    account_id: account.id, module_type: type, settings, enabled, updated_at: now,
  }, { onConflict: "account_id,module_type" }).select().single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Save failed" }); return; }
  res.json({ ok: true, settings: data.settings, enabled: data.enabled });
});

// ── DELETE /api/patient-app/wellness/modules/:type ────────────────────────────
router.delete("/patient-app/wellness/modules/:type", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  await supabase.from("wellness_modules").update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("account_id", account.id).eq("module_type", type);
  res.json({ ok: true });
});

// ── POST /api/patient-app/wellness/log ────────────────────────────────────────
router.post("/patient-app/wellness/log", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { moduleType, data, date } = req.body ?? {};
  if (!moduleType || !data) { res.status(400).json({ error: "moduleType and data required" }); return; }
  if (!VALID_TYPES.includes(moduleType as string)) { res.status(400).json({ error: "Invalid module type" }); return; }

  const logDate = (date as string | undefined) ?? todayDateStr();
  const now = new Date().toISOString();

  const { data: existing } = await supabase.from("wellness_logs")
    .select("data").eq("account_id", account.id).eq("module_type", moduleType).eq("log_date", logDate).maybeSingle();

  const merged = { ...((existing?.data as Record<string, unknown>) ?? {}), ...(data as Record<string, unknown>) };

  // Deep merge nested `taken` map (medications dose-by-dose)
  const existingData = existing?.data as Record<string, unknown> | null;
  if (existingData?.taken && typeof existingData.taken === "object" && typeof (data as Record<string, unknown>).taken === "object") {
    merged.taken = {
      ...(existingData.taken as Record<string, boolean>),
      ...((data as Record<string, unknown>).taken as Record<string, boolean>),
    };
  }

  const { data: saved, error } = await supabase.from("wellness_logs").upsert({
    account_id: account.id, module_type: moduleType, log_date: logDate, data: merged, updated_at: now,
  }, { onConflict: "account_id,module_type,log_date" }).select("data").single();

  if (error || !saved) { res.status(500).json({ error: error?.message ?? "Log failed" }); return; }
  res.json({ ok: true, data: saved.data });
});

// ── GET /api/patient-app/wellness/week/:type ──────────────────────────────────
router.get("/patient-app/wellness/week/:type", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fromDate = sevenDaysAgo.toISOString().split("T")[0];

  const { data } = await supabase.from("wellness_logs")
    .select("log_date, data").eq("account_id", account.id).eq("module_type", type)
    .gte("log_date", fromDate).order("log_date", { ascending: true });
  res.json(data ?? []);
});

// ── GET /api/patient-app/wellness/streak/:type ────────────────────────────────
router.get("/patient-app/wellness/streak/:type", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { type } = req.params;
  const from = new Date(); from.setDate(from.getDate() - 89);
  const fromDate = from.toISOString().split("T")[0];

  const [logsResult, moduleResult] = await Promise.all([
    supabase.from("wellness_logs").select("log_date, data")
      .eq("account_id", account.id).eq("module_type", type).gte("log_date", fromDate).order("log_date", { ascending: false }),
    supabase.from("wellness_modules").select("settings").eq("account_id", account.id).eq("module_type", type).maybeSingle(),
  ]);

  const settings = (moduleResult.data?.settings as Record<string, unknown>) ?? {};
  const logByDate: Record<string, Record<string, unknown>> = {};
  for (const l of logsResult.data ?? []) { logByDate[l.log_date as string] = l.data as Record<string, unknown>; }

  let streak = 0;
  const today = todayDateStr();
  for (let i = 0; i < 90; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (dateStr === today && i === 0) {
      if (isModuleCompleted(type, logByDate[dateStr], settings, dateStr)) streak++;
      else continue; // today incomplete — don't break streak, show yesterday's streak
    } else {
      if (isModuleCompleted(type, logByDate[dateStr], settings, dateStr)) streak++;
      else break;
    }
  }

  res.json({ streak });
});

// ── AI Daily Insight ─────────────────────────────────────────────────────────
// Cached per account per day — only one Claude call per user per day
const insightCache = new Map<string, string>();

router.get("/patient-app/wellness/ai-insight", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `${account.id}:${today}`;

  if (insightCache.has(cacheKey)) {
    res.json({ insight: insightCache.get(cacheKey) });
    return;
  }

  // Evict old entries
  for (const k of insightCache.keys()) {
    if (!k.endsWith(`:${today}`)) insightCache.delete(k);
  }

  // Fetch context
  const [{ data: modules }, { data: logs }] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, enabled").eq("account_id", account.id).eq("enabled", true),
    supabase.from("wellness_logs")
      .select("module_type, log_date")
      .eq("account_id", account.id)
      .gte("log_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0])
      .order("log_date", { ascending: false }),
  ]);

  const activeTypes = (modules ?? []).map((m: Record<string, string>) => m.module_type).join(", ");
  const daysLogged = [...new Set((logs ?? []).map((l: Record<string, string>) => l.log_date))].length;
  const logCount = logs?.length ?? 0;
  const name = (account as Record<string, unknown>).display_name as string ?? "there";
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: `You are ERA Health, a caring wellness companion. Write ONE short, warm, personal insight (max 18 words) for ${name} based on: active habits = [${activeTypes}], days logged this week = ${daysLogged}/7, total logs this week = ${logCount}, time of day = ${timeOfDay}. Be specific, encouraging, and actionable. No generic advice. No quotes.`,
      }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    if (text) insightCache.set(cacheKey, text);
    res.json({ insight: text ?? null });
  } catch {
    res.json({ insight: null });
  }
});

export default router;
