import { Router, type IRouter } from "express";
import { generateOpenAIMessage } from "../lib/ai.js";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { getWeekStart, type WeekPlan } from "./patient-app-plan.js";

const router: IRouter = Router();

const VALID_TYPES = [
  "water", "medications", "workout", "sleep", "mood_check", "fruit",
  "vitals", "smoking", "alcohol", "eyebreak", "sunscreen", "outdoors",
  "vaccines", "checkups", "hygiene", "intimacy",
];
// Daily habit modules — shown in checklist and used for week summary
const DAILY_HABIT_TYPES = [
  "water", "medications", "workout", "sleep", "mood_check", "fruit",
  "vitals", "eyebreak", "sunscreen", "outdoors", "smoking", "alcohol", "intimacy",
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
  smoking:    { label: "Quit smoking",   emoji: "🚭" },
  alcohol:    { label: "Alcohol",        emoji: "🍷" },
  intimacy:   { label: "Sex life",       emoji: "💗" },
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
  if (type === "fruit") return log.done === true;
  if (type === "sunscreen") return ((log.count as number) ?? 0) >= ((settings.target as number) ?? 2);
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
  if (type === "smoking") return log.smoked === false;
  if (type === "alcohol") {
    if (!log) return false;
    const goalType = (settings.goalType as string | undefined) ?? "quit";
    if (goalType === "reduce") return log.drinks !== undefined; // any log counts for reduce mode
    return log.drinks === 0; // quit mode: drink-free day
  }
  if (type === "intimacy") {
    if (!log) return false;
    const mode = (settings.mode as string | undefined) ?? "celibacy";
    if (mode === "celibacy") return log.active === false;
    return log.active !== undefined; // active mode: any log counts
  }
  if (type === "hygiene") return log.done === true;
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
  if (type === "sunscreen") {
    const count = (log.count as number) ?? 0;
    const tgt = (settings.target as number) ?? 2;
    return `${count} / ${tgt} application${tgt !== 1 ? "s" : ""}`;
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
  const checklist: Array<{ id: string; emoji: string; label: string; sub?: string; time?: string; done: boolean }> = [];
  const plan = planResult.data?.plan_data as WeekPlan | null;
  const todayPlanDay = plan?.days.find((d) => d.date === today);

  if (todayPlanDay && todayPlanDay.items.length > 0) {
    // Deduplicate by moduleType — the plan may schedule a module at multiple times
    // (e.g. water 3×/day) but the home checklist shows each habit exactly once.
    const seen = new Set<string>();
    for (const item of todayPlanDay.items) {
      const log = logMap[item.moduleType] ?? null;
      const settings = moduleMap[item.moduleType]?.settings ?? {};

      if (item.isRestDay) {
        if (!seen.has(item.moduleType)) {
          seen.add(item.moduleType);
          checklist.push({ id: item.moduleType, emoji: item.emoji, label: item.label, sub: item.sub, done: true });
        }
        continue;
      }

      if (seen.has(item.moduleType)) continue;
      seen.add(item.moduleType);

      // Medications: expand to one item per active drug
      if (item.moduleType === "medications") {
        const activeMeds = ((settings.medications as Array<Record<string, unknown>>) ?? []).filter((m) => {
          const start = m.startDate as string;
          const dur = m.durationDays as number | null;
          if (today < start) return false;
          if (dur && new Date(start).getTime() + dur * 86400000 < new Date(today).getTime()) return false;
          return true;
        });
        const taken = (log?.taken as Record<string, boolean>) ?? {};
        for (const med of activeMeds) {
          const times = (med.times as string[]) ?? [];
          const doneTimes = times.filter((t) => taken[`${med.id}_${t}`]);
          const medDone = doneTimes.length === times.length;
          const sub = times.length > 1 ? `${doneTimes.length}/${times.length} doses` : (doneTimes.length === 1 ? "Taken" : `Take at ${times[0] ?? "scheduled time"}`);
          checklist.push({ id: `med_${med.id as string}`, emoji: "💊", label: med.name as string, sub, time: item.time ?? undefined, done: medDone });
        }
        continue;
      }

      // Hygiene: appear in daily checklist only on the exact due date or when overdue
      if (item.moduleType === "hygiene") {
        interface HygieneItem { id: string; name: string; emoji: string; lastReplaced: string; intervalDays: number }
        const items = ((settings.items as HygieneItem[]) ?? []);
        for (const hi of items) {
          const age = Math.floor((Date.now() - new Date(hi.lastReplaced + "T12:00:00").getTime()) / 86400000);
          if (age < hi.intervalDays) continue; // only on/after the due date
          const replacedToday = hi.lastReplaced === today;
          const daysOverdue = age - hi.intervalDays;
          const sub = daysOverdue > 0 && !replacedToday ? `${daysOverdue}d overdue` : "Due today";
          checklist.push({ id: `hygiene_${hi.id}`, emoji: hi.emoji, label: `Replace ${hi.name}`, sub, done: replacedToday });
        }
        continue;
      }

      // Vaccines: appear in daily checklist only on the due date or when overdue
      if (item.moduleType === "vaccines") {
        interface Vaccine { id: string; name: string; nextDueDate?: string }
        const todayMs = new Date(today + "T12:00:00").getTime();
        for (const v of ((settings.vaccines as Vaccine[]) ?? [])) {
          if (!v.nextDueDate) continue;
          const daysUntil = Math.ceil((new Date(v.nextDueDate + "T12:00:00").getTime() - todayMs) / 86400000);
          if (daysUntil > 0) continue;
          const sub = daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : "Due today";
          checklist.push({ id: `vaccine_${v.id}`, emoji: "💉", label: `${v.name} vaccine`, sub, done: false });
        }
        continue;
      }

      // Checkups: appear in daily checklist only on the due date or when overdue
      if (item.moduleType === "checkups") {
        interface Checkup { id: string; type: string; lastDate: string; intervalMonths: number }
        const CHECKUP_EMOJIS: Record<string, string> = { "Dental": "🦷", "Eye / Vision": "👁️", "GP / General": "🩺", "Blood Test": "🩸", "Blood Pressure": "💗", "Cancer Screening": "🔬", "Skin Check": "🧴" };
        const todayMs = new Date(today + "T12:00:00").getTime();
        for (const c of ((settings.checkups as Checkup[]) ?? [])) {
          const due = new Date(c.lastDate); due.setMonth(due.getMonth() + c.intervalMonths);
          const daysUntil = Math.ceil((due.getTime() - todayMs) / 86400000);
          if (daysUntil > 0) continue;
          const sub = daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : "Due today";
          checklist.push({ id: `checkup_${c.id}`, emoji: CHECKUP_EMOJIS[c.type] ?? "📋", label: `${c.type} checkup`, sub, done: false });
        }
        continue;
      }

      // Workout: use focus as the label
      if (item.moduleType === "workout") {
        const focus = (item.sub ?? "").trim();
        const label = focus || "Workout";
        const done = isModuleCompleted("workout", log ?? undefined, settings, today);
        checklist.push({ id: "workout", emoji: item.emoji, label, time: item.time ?? undefined, done });
        continue;
      }

      const done = isModuleCompleted(item.moduleType, log ?? undefined, settings, today);
      const sub = log ? (checklistSub(item.moduleType, log, settings, today) ?? item.sub) : item.sub;
      const label = item.moduleType === "water" ? "Water intake" : item.label;
      checklist.push({ id: item.moduleType, emoji: item.emoji, label, sub, time: item.time ?? undefined, done });
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
          const focus = (todayWorkout.focus as string | undefined)?.trim();
          checklist.push({ id: "workout", emoji: "🏃", label: focus ?? "Workout", done: log?.completed === true });
        } else if (dayKey in workoutDays) {
          checklist.push({ id: "workout", emoji: "😌", label: "Rest day", sub: "No workout today", done: true });
        }
        continue;
      }

      if (type === "medications") {
        const activeMeds = ((settings.medications as Array<Record<string, unknown>>) ?? []).filter((m) => {
          const start = m.startDate as string;
          const dur = m.durationDays as number | null;
          if (today < start) return false;
          if (dur && new Date(start).getTime() + dur * 86400000 < new Date(today).getTime()) return false;
          return true;
        });
        if (activeMeds.length === 0) continue;
        const taken = (log?.taken as Record<string, boolean>) ?? {};
        for (const med of activeMeds) {
          const times = (med.times as string[]) ?? [];
          const doneTimes = times.filter((t) => taken[`${med.id}_${t}`]);
          const medDone = doneTimes.length === times.length;
          const sub = times.length > 1 ? `${doneTimes.length}/${times.length} doses` : (doneTimes.length === 1 ? "Taken" : `Take at ${times[0] ?? "scheduled time"}`);
          checklist.push({ id: `med_${med.id as string}`, emoji: "💊", label: med.name as string, sub, done: medDone });
        }
        continue;
      }

      const meta = MODULE_META[type];
      const done = isModuleCompleted(type, log ?? undefined, settings, today);
      const sub = log ? checklistSub(type, log, settings, today) : (type === "sleep" ? "Log last night's sleep" : type === "mood_check" ? "Mood, energy & stress" : undefined);
      checklist.push({ id: type, emoji: meta.emoji, label: meta.label, sub, done });
    }

    // Periodic modules: appear in daily checklist only on/after their due date
    const todayMs = new Date(today + "T12:00:00").getTime();

    const hygieneMod = moduleMap["hygiene"];
    if (hygieneMod?.enabled) {
      interface HygieneItem { id: string; name: string; emoji: string; lastReplaced: string; intervalDays: number }
      for (const item of ((hygieneMod.settings.items as HygieneItem[]) ?? [])) {
        const age = Math.floor((Date.now() - new Date(item.lastReplaced + "T12:00:00").getTime()) / 86400000);
        if (age < item.intervalDays) continue;
        const replacedToday = item.lastReplaced === today;
        const daysOverdue = age - item.intervalDays;
        const sub = daysOverdue > 0 && !replacedToday ? `${daysOverdue}d overdue` : "Due today";
        checklist.push({ id: `hygiene_${item.id}`, emoji: item.emoji, label: `Replace ${item.name}`, sub, done: replacedToday });
      }
    }

    const vaccinesMod = moduleMap["vaccines"];
    if (vaccinesMod?.enabled) {
      interface Vaccine { id: string; name: string; nextDueDate?: string }
      for (const v of ((vaccinesMod.settings.vaccines as Vaccine[]) ?? [])) {
        if (!v.nextDueDate) continue;
        const daysUntil = Math.ceil((new Date(v.nextDueDate + "T12:00:00").getTime() - todayMs) / 86400000);
        if (daysUntil > 0) continue;
        const sub = daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : "Due today";
        checklist.push({ id: `vaccine_${v.id}`, emoji: "💉", label: `${v.name} vaccine`, sub, done: false });
      }
    }

    const checkupsMod = moduleMap["checkups"];
    if (checkupsMod?.enabled) {
      interface Checkup { id: string; type: string; lastDate: string; intervalMonths: number }
      const CHECKUP_EMOJIS: Record<string, string> = { "Dental": "🦷", "Eye / Vision": "👁️", "GP / General": "🩺", "Blood Test": "🩸", "Blood Pressure": "💗", "Cancer Screening": "🔬", "Skin Check": "🧴" };
      for (const c of ((checkupsMod.settings.checkups as Checkup[]) ?? [])) {
        const due = new Date(c.lastDate); due.setMonth(due.getMonth() + c.intervalMonths);
        const daysUntil = Math.ceil((due.getTime() - todayMs) / 86400000);
        if (daysUntil > 0) continue;
        const sub = daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : "Due today";
        checklist.push({ id: `checkup_${c.id}`, emoji: CHECKUP_EMOJIS[c.type] ?? "📋", label: `${c.type} checkup`, sub, done: false });
      }
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

// ── GET /api/patient-app/wellness/weekly-report?weekStart=YYYY-MM-DD ──────────
// Returns this week vs previous week per-module comparison
router.get("/patient-app/wellness/weekly-report", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayDateStr();

  // Resolve the requested week start (defaults to current Mon)
  const rawWeekStart = req.query.weekStart as string | undefined;
  const weekStart: string = rawWeekStart ?? getWeekStart();

  function buildWeekDates(start: string): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start + "T12:00:00"); d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  const thisWeekDates = buildWeekDates(weekStart);
  const prevStart = new Date(weekStart + "T12:00:00");
  prevStart.setDate(prevStart.getDate() - 7);
  const prevWeekStart = prevStart.toISOString().split("T")[0];
  const prevWeekDates = buildWeekDates(prevWeekStart);

  const allDates = [...prevWeekDates, ...thisWeekDates];

  const [{ data: modules }, { data: logs }] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, settings, enabled").eq("account_id", account.id),
    supabase.from("wellness_logs").select("module_type, log_date, data")
      .eq("account_id", account.id)
      .gte("log_date", allDates[0]).lte("log_date", allDates[allDates.length - 1]),
  ]);

  const enabledModules = (modules ?? []).filter((m) => m.enabled && DAILY_HABIT_TYPES.includes(m.module_type as string));

  const logIndex: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const l of logs ?? []) {
    const t = l.module_type as string, d = l.log_date as string;
    if (!logIndex[t]) logIndex[t] = {};
    logIndex[t][d] = (l.data as Record<string, unknown>) ?? {};
  }

  function buildWeekStats(dates: string[]) {
    let totalPossible = 0, totalCompleted = 0;
    const moduleData = enabledModules.map((m) => {
      const settings = (m.settings as Record<string, unknown>) ?? {};
      const dayData = dates.filter((d) => d <= today).map((date) => {
        const log = logIndex[m.module_type as string]?.[date];
        return { date, completed: isModuleCompleted(m.module_type as string, log, settings, date) };
      });
      const possible = dayData.length;
      const completed = dayData.filter((d) => d.completed).length;
      totalPossible += possible;
      totalCompleted += completed;
      const meta = MODULE_META[m.module_type as string] ?? { label: m.module_type as string, emoji: "📋" };
      return {
        type: m.module_type as string,
        label: meta.label,
        emoji: meta.emoji,
        completed,
        possible,
        rate: possible > 0 ? Math.round((completed / possible) * 100) : 0,
        dayData,
      };
    });
    return {
      modules: moduleData,
      rate: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0,
      totalCompleted,
      totalPossible,
    };
  }

  const thisWeek = buildWeekStats(thisWeekDates);
  const prevWeek = buildWeekStats(prevWeekDates);
  const rateChange = thisWeek.rate - prevWeek.rate;

  // Best day this week (most modules completed)
  const dayScores = thisWeekDates.filter((d) => d <= today).map((date) => ({
    date,
    dayLabel: new Date(date + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long" }),
    count: thisWeek.modules.filter((m) => m.dayData.find((d2) => d2.date === date)?.completed).length,
  })).sort((a, b) => b.count - a.count);

  const weekLabel = `${new Date(weekStart + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" })}–${new Date(thisWeekDates[6] + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;
  const prevWeekLabel = `${new Date(prevWeekStart + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" })}–${new Date(prevWeekDates[6] + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  res.json({
    weekStart, weekEnd: thisWeekDates[6], weekLabel,
    prevWeekStart, prevWeekEnd: prevWeekDates[6], prevWeekLabel,
    thisWeek, prevWeek, rateChange,
    thisWeekDates, prevWeekDates,
    today,
    bestDay: dayScores[0] ?? null,
    worstDay: dayScores[dayScores.length - 1] ?? null,
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

// ── Daily Insight ─────────────────────────────────────────────────────────────
// Cached per account per day. Returns a factual, data-driven analysis of the user's wellness data.
const insightCache = new Map<string, string>();

router.get("/patient-app/wellness/ai-insight", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayDateStr();
  const cacheKey = `${account.id}:${today}`;

  if (insightCache.has(cacheKey)) { res.json({ insight: insightCache.get(cacheKey) }); return; }
  for (const k of insightCache.keys()) { if (!k.endsWith(`:${today}`)) insightCache.delete(k); }


  // Gather 2 weeks of data for pattern detection
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
  const fromDate = twoWeeksAgo.toISOString().split("T")[0];

  const [{ data: modules }, { data: logs }] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, settings, enabled").eq("account_id", account.id).eq("enabled", true),
    supabase.from("wellness_logs").select("module_type, log_date, data")
      .eq("account_id", account.id).gte("log_date", fromDate)
      .in("module_type", DAILY_HABIT_TYPES).order("log_date"),
  ]);

  // Build per-module completion counts for this week and last week
  const logIndex: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const l of logs ?? []) {
    const t = l.module_type as string, d = l.log_date as string;
    if (!logIndex[t]) logIndex[t] = {};
    logIndex[t][d] = (l.data as Record<string, unknown>) ?? {};
  }

  const thisWeekLines: string[] = [];
  for (const m of modules ?? []) {
    if (!DAILY_HABIT_TYPES.includes(m.module_type as string)) continue;
    const settings = (m.settings as Record<string, unknown>) ?? {};
    const meta = MODULE_META[m.module_type as string];
    if (!meta) continue;
    let thisW = 0, lastW = 0;
    for (let i = 0; i < 7; i++) {
      const d1 = new Date(); d1.setDate(d1.getDate() - i);
      const d1s = d1.toISOString().split("T")[0];
      if (isModuleCompleted(m.module_type as string, logIndex[m.module_type as string]?.[d1s], settings, d1s)) thisW++;
      const d2 = new Date(); d2.setDate(d2.getDate() - i - 7);
      const d2s = d2.toISOString().split("T")[0];
      if (isModuleCompleted(m.module_type as string, logIndex[m.module_type as string]?.[d2s], settings, d2s)) lastW++;
    }
    thisWeekLines.push(`${meta.label}: this week ${thisW}/7, last week ${lastW}/7`);
  }

  const rawName = (account as { display_name?: string }).display_name ?? "";
  const firstName = rawName.split(" ")[0] || "there";

  const prompt = `You are ${firstName}'s personal wellness coach. Write a warm, personalised insight (2-3 sentences, max 60 words) based on their habit data below.

DATA:
${thisWeekLines.join("\n") || "No habit data recorded yet."}

Rules:
- Address them by first name (${firstName}) naturally at the start.
- Mention their standout strength specifically — what they're doing well and why it's impressive.
- Identify their weakest habit by name and give one concrete, practical tip to improve it (e.g. link it to an existing habit they're already doing well).
- Sound like a thoughtful, encouraging coach — warm and specific, not generic. No emojis. No quotes.`;

  try {
    const text = await generateOpenAIMessage(
      `You are a warm, encouraging personal wellness coach speaking directly to ${firstName}. Be specific and personal — use their actual data. Sound like a real coach, not a report.`,
      prompt,
      150,
    );
    if (text) insightCache.set(cacheKey, text.trim());
    res.json({ insight: text ? text.trim() : null });
  } catch {
    res.json({ insight: null });
  }
});

// ── GET /api/patient-app/wellness/upcoming-events ────────────────────────────
// Returns non-daily events (hygiene replacements, vaccines, checkups) due within
// the next 14 days or already overdue, so the home screen can show "this week's goals"
router.get("/patient-app/wellness/upcoming-events", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayDateStr();
  const todayMs = new Date(today + "T12:00:00").getTime();

  const { data: modulesData } = await supabase
    .from("wellness_modules")
    .select("module_type, settings, enabled")
    .eq("account_id", account.id)
    .in("module_type", ["hygiene", "vaccines", "checkups"]);

  interface UpcomingEvent {
    id: string;
    module: string;
    emoji: string;
    label: string;
    dueDate: string;
    daysUntil: number;
  }

  const events: UpcomingEvent[] = [];
  const WINDOW_DAYS = 14;

  for (const row of modulesData ?? []) {
    if (!(row.enabled as boolean)) continue;
    const settings = (row.settings as Record<string, unknown>) ?? {};
    const type = row.module_type as string;

    if (type === "hygiene") {
      interface HygieneItem { id: string; name: string; emoji: string; lastReplaced: string; intervalDays: number }
      for (const item of ((settings.items as HygieneItem[]) ?? [])) {
        const dueMs = new Date(item.lastReplaced + "T12:00:00").getTime() + item.intervalDays * 86400000;
        const dueDate = new Date(dueMs).toISOString().split("T")[0];
        const daysUntil = Math.ceil((dueMs - todayMs) / 86400000);
        if (daysUntil <= WINDOW_DAYS) {
          events.push({ id: `hygiene_${item.id}`, module: "hygiene", emoji: item.emoji, label: `Replace ${item.name}`, dueDate, daysUntil });
        }
      }
    }

    if (type === "vaccines") {
      interface Vaccine { id: string; name: string; nextDueDate?: string }
      for (const v of ((settings.vaccines as Vaccine[]) ?? [])) {
        if (!v.nextDueDate) continue;
        const dueMs = new Date(v.nextDueDate + "T12:00:00").getTime();
        const daysUntil = Math.ceil((dueMs - todayMs) / 86400000);
        if (daysUntil <= WINDOW_DAYS) {
          events.push({ id: `vaccine_${v.id}`, module: "vaccines", emoji: "💉", label: `${v.name} vaccine`, dueDate: v.nextDueDate, daysUntil });
        }
      }
    }

    if (type === "checkups") {
      interface Checkup { id: string; type: string; lastDate: string; intervalMonths: number }
      const CHECKUP_EMOJIS: Record<string, string> = {
        "Dental": "🦷", "Eye / Vision": "👁️", "GP / General": "🩺",
        "Blood Test": "🩸", "Blood Pressure": "💗", "Cancer Screening": "🔬", "Skin Check": "🧴",
      };
      for (const c of ((settings.checkups as Checkup[]) ?? [])) {
        const due = new Date(c.lastDate);
        due.setMonth(due.getMonth() + c.intervalMonths);
        const dueDate = due.toISOString().split("T")[0];
        const daysUntil = Math.ceil((due.getTime() - todayMs) / 86400000);
        if (daysUntil <= WINDOW_DAYS) {
          const emoji = CHECKUP_EMOJIS[c.type] ?? "📋";
          events.push({ id: `checkup_${c.id}`, module: "checkups", emoji, label: `${c.type} checkup`, dueDate, daysUntil });
        }
      }
    }
  }

  // Sort: overdue first, then by nearest due date
  events.sort((a, b) => a.daysUntil - b.daysUntil);

  res.json({ events });
});

export default router;
