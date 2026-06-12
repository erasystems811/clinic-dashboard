import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router: IRouter = Router();

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export interface PlanItem {
  moduleType: string;
  emoji: string;
  label: string;
  sub?: string;
  time?: string;       // "HH:MM" clock time
  isDayOnly?: boolean; // no specific time
  isRestDay?: boolean;
}

export interface PlanDay {
  date: string;
  dayKey: string;
  dayLabel: string;
  items: PlanItem[];
}

export interface WeekPlan {
  generatedAt: string;
  weekStart: string;
  days: PlanDay[];
}

type ModuleRow = { module_type: string; settings: Record<string, unknown>; enabled: boolean };

function parseTimeHint(notes: string): string | null {
  const n = notes.toLowerCase();
  if (/\b(5am|6am|05:|06:|very early)\b/.test(n)) return "06:00";
  if (/\b(7am|07:|morning|early|breakfast|after waking|wake up)\b/.test(n)) return "07:30";
  if (/\b(8am|08:)\b/.test(n)) return "08:00";
  if (/\b(10am|11am|10:|11:|mid.?morning|before lunch)\b/.test(n)) return "10:00";
  if (/\b(midday|lunch|noon|12|afternoon)\b/.test(n)) return "13:00";
  if (/\b(4pm|5pm|16:|17:|late afternoon|after work)\b/.test(n)) return "16:00";
  if (/\b(6pm|7pm|18:|19:|evening|dinner|after dinner)\b/.test(n)) return "18:00";
  if (/\b(9pm|10pm|11pm|21:|22:|23:|night|bedtime|before bed)\b/.test(n)) return "21:00";
  return null;
}

function sortItems(items: PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

export function generateWeekPlan(weekDates: string[], modules: ModuleRow[]): WeekPlan {
  const enabledMap: Record<string, Record<string, unknown>> = {};
  for (const m of modules) {
    if (m.enabled) enabledMap[m.module_type] = m.settings;
  }

  const days: PlanDay[] = weekDates.map((date) => {
    const d = new Date(date + "T12:00:00");
    const dayIndex = d.getDay();
    const dayKey = DAY_KEYS[dayIndex];
    const dayLabel = DAY_LABELS[dayIndex];
    const items: PlanItem[] = [];

    // Vitals — early morning
    if (enabledMap["vitals"]) {
      const vNotes = enabledMap["vitals"].notes as string | undefined;
      const vTime = (vNotes && parseTimeHint(vNotes)) ?? "07:00";
      items.push({ moduleType: "vitals", emoji: "❤️", label: "Log vitals", sub: vNotes ?? "BP, sugar or weight", time: vTime });
    }

    // Hygiene — morning routine
    if (enabledMap["hygiene"]) {
      const hNotes = enabledMap["hygiene"].notes as string | undefined;
      const hTime = (hNotes && parseTimeHint(hNotes)) ?? "07:00";
      items.push({ moduleType: "hygiene", emoji: "🪥", label: "Morning hygiene", sub: hNotes ?? "Brush teeth & routine", time: hTime });
    }

    // Sunscreen — after morning routine
    if (enabledMap["sunscreen"]) {
      const ssNotes = enabledMap["sunscreen"].notes as string | undefined;
      const ssTime = (ssNotes && parseTimeHint(ssNotes)) ?? "08:00";
      items.push({ moduleType: "sunscreen", emoji: "☀️", label: "Apply sunscreen", sub: ssNotes ?? "Daily skin protection", time: ssTime });
    }

    // Fruit — with morning meal
    if (enabledMap["fruit"]) {
      const fNotes = enabledMap["fruit"].notes as string | undefined;
      const fTime = (fNotes && parseTimeHint(fNotes)) ?? "08:00";
      items.push({ moduleType: "fruit", emoji: "🍎", label: "Eat fruit", sub: fNotes ?? "Daily fruit intake", time: fTime });
    }

    // Medications — one item per unique dose time
    if (enabledMap["medications"]) {
      type Med = { id: string; name: string; dosage?: string; startDate: string; durationDays: number | null; times: string[] };
      const meds = (enabledMap["medications"].medications as Med[]) ?? [];
      const activeMeds = meds.filter((m) => {
        if (date < m.startDate) return false;
        if (m.durationDays) {
          const end = new Date(new Date(m.startDate + "T12:00:00").getTime() + m.durationDays * 86400000).toISOString().split("T")[0];
          if (date > end) return false;
        }
        return true;
      });
      if (activeMeds.length > 0) {
        // Group active meds by dose time
        const timeGroups: Record<string, string[]> = {};
        activeMeds.forEach((m) => {
          const times: string[] = m.times?.length ? m.times : ["08:00"];
          times.forEach((t) => {
            if (!timeGroups[t]) timeGroups[t] = [];
            timeGroups[t].push(m.name);
          });
        });
        Object.entries(timeGroups).forEach(([time, names]) => {
          items.push({ moduleType: "medications", emoji: "💊", label: "Medications", sub: names.join(" · "), time });
        });
      }
    }

    // Mood check-in — morning
    if (enabledMap["mood_check"]) {
      const mNotes = enabledMap["mood_check"].notes as string | undefined;
      const mTime = (mNotes && parseTimeHint(mNotes)) ?? "08:30";
      items.push({ moduleType: "mood_check", emoji: "😊", label: "Daily mood check-in", sub: mNotes ?? "Mood, energy & stress", time: mTime });
    }

    // Eye breaks — first break at work start
    if (enabledMap["eyebreak"]) {
      const ebNotes = enabledMap["eyebreak"].notes as string | undefined;
      const startTime = (enabledMap["eyebreak"].startTime as string) ?? "09:00";
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = ((enabledMap["eyebreak"].endTime as string) ?? "18:00").split(":").map(Number);
      const target = (enabledMap["eyebreak"].targetBreaks as number) ??
        Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
      items.push({ moduleType: "eyebreak", emoji: "👁️", label: "Eye breaks", sub: ebNotes ?? `${target} breaks today`, time: startTime });
    }

    // Smoking status — mid-morning
    if (enabledMap["smoking"]) {
      const skNotes = enabledMap["smoking"].notes as string | undefined;
      const skTime = (skNotes && parseTimeHint(skNotes)) ?? "09:00";
      items.push({ moduleType: "smoking", emoji: "🚭", label: "Quit smoking", sub: skNotes ?? "Log today's status", time: skTime });
    }

    // Workout — use per-day settings
    if (enabledMap["workout"]) {
      const wkNotes = enabledMap["workout"].notes as string | undefined;
      const workoutDays = (enabledMap["workout"].days as Record<string, Record<string, unknown>>) ?? {};
      const todayWorkout = workoutDays[dayKey];
      if (todayWorkout?.enabled) {
        const workoutTime = (todayWorkout.time as string) ?? (wkNotes ? parseTimeHint(wkNotes) ?? "07:00" : "07:00");
        const focus = (todayWorkout.focus as string | undefined);
        items.push({
          moduleType: "workout", emoji: "🏃", label: "Workout",
          sub: focus ?? wkNotes ?? undefined,
          time: workoutTime,
        });
      } else if (Object.keys(workoutDays).length > 0) {
        items.push({ moduleType: "workout", emoji: "😌", label: "Rest day", sub: wkNotes ?? "Recovery — no workout today", isRestDay: true, isDayOnly: true });
      }
    }

    // Water — one item per reminder time
    if (enabledMap["water"]) {
      const wNotes = enabledMap["water"].notes as string | undefined;
      const target = (enabledMap["water"].target as number) ?? 8;
      const times: string[] = (enabledMap["water"].reminderTimes as string[])?.length
        ? (enabledMap["water"].reminderTimes as string[])
        : ["08:00", "13:00", "17:00"];
      times.forEach((time, i) => {
        const label = i === 0 ? "Water intake" : i === 1 ? "Water intake (midday)" : "Water intake (evening)";
        const sub = i === 0 && wNotes ? wNotes : `Goal: ${target} cups`;
        items.push({ moduleType: "water", emoji: "💧", label, sub, time });
      });
    }

    // Outdoors — afternoon
    if (enabledMap["outdoors"]) {
      const oNotes = enabledMap["outdoors"].notes as string | undefined;
      const oTarget = (enabledMap["outdoors"].targetMinutes as number) ?? 30;
      const oTime = (oNotes && parseTimeHint(oNotes)) ?? "16:00";
      items.push({ moduleType: "outdoors", emoji: "🌿", label: "Outdoor time", sub: oNotes ?? `Goal: ${oTarget} min`, time: oTime });
    }

    // Sleep — at bedtime target
    if (enabledMap["sleep"]) {
      const slNotes = enabledMap["sleep"].notes as string | undefined;
      const bedtime = (enabledMap["sleep"].bedtimeTarget as string) ?? "22:30";
      const slTime = (slNotes && parseTimeHint(slNotes)) ?? bedtime;
      items.push({ moduleType: "sleep", emoji: "😴", label: "Sleep log", sub: slNotes ?? "Log last night's sleep", time: slTime });
    }

    return { date, dayKey, dayLabel, items: sortItems(items) };
  });

  return { generatedAt: new Date().toISOString(), weekStart: weekDates[0], days };
}

async function fetchAndSavePlan(accountId: number): Promise<WeekPlan> {
  const weekStart = getWeekStart();
  const weekDates = getWeekDates(weekStart);
  const { data: modules } = await supabase
    .from("wellness_modules").select("module_type, settings, enabled").eq("account_id", accountId);
  const plan = generateWeekPlan(weekDates, (modules ?? []) as ModuleRow[]);
  await supabase.from("weekly_plans").upsert(
    { account_id: accountId, week_start: weekStart, plan_data: plan, generated_at: plan.generatedAt },
    { onConflict: "account_id,week_start" },
  );
  return plan;
}

// GET /api/patient-app/plan/current?weekStart=YYYY-MM-DD
// weekStart defaults to the current Monday; pass any Monday to view past or future weeks.
router.get("/patient-app/plan/current", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const currentWeekStart = getWeekStart();
  const reqWeekStart = req.query.weekStart as string | undefined;
  const weekStart = (reqWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(reqWeekStart))
    ? reqWeekStart
    : currentWeekStart;
  const isCurrentWeek = weekStart === currentWeekStart;

  const { data: existing } = await supabase
    .from("weekly_plans").select("plan_data, generated_at")
    .eq("account_id", account.id).eq("week_start", weekStart).maybeSingle();

  if (existing) {
    if (!isCurrentWeek) {
      // Past/future weeks: return whatever was saved, no auto-regenerate
      res.json({ weekStart, plan: existing.plan_data as WeekPlan, generatedAt: existing.generated_at });
      return;
    }
    // Current week: regenerate if modules were updated since last generation
    const { count } = await supabase
      .from("wellness_modules").select("*", { count: "exact", head: true })
      .eq("account_id", account.id).gt("updated_at", existing.generated_at as string);
    if (!count) {
      res.json({ weekStart, plan: existing.plan_data as WeekPlan, generatedAt: existing.generated_at });
      return;
    }
  }

  // Generate plan (current week → save; past with no saved plan → generate but don't overwrite)
  const weekDates = getWeekDates(weekStart);
  const { data: modules } = await supabase
    .from("wellness_modules").select("module_type, settings, enabled").eq("account_id", account.id);
  const plan = generateWeekPlan(weekDates, (modules ?? []) as ModuleRow[]);

  if (isCurrentWeek || !existing) {
    await supabase.from("weekly_plans").upsert(
      { account_id: account.id, week_start: weekStart, plan_data: plan, generated_at: plan.generatedAt },
      { onConflict: "account_id,week_start" },
    );
  }

  res.json({ weekStart, plan, generatedAt: plan.generatedAt });
});

// POST /api/patient-app/plan/regenerate
router.post("/patient-app/plan/regenerate", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const plan = await fetchAndSavePlan(account.id);
  res.json({ ok: true, plan, generatedAt: plan.generatedAt });
});

export default router;
