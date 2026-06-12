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
      items.push({ moduleType: "vitals", emoji: "❤️", label: "Log vitals", sub: "BP, sugar or weight", time: "07:00" });
    }

    // Hygiene — morning routine
    if (enabledMap["hygiene"]) {
      items.push({ moduleType: "hygiene", emoji: "🪥", label: "Morning hygiene", sub: "Brush teeth & routine", time: "07:00" });
    }

    // Sunscreen — after morning routine
    if (enabledMap["sunscreen"]) {
      items.push({ moduleType: "sunscreen", emoji: "☀️", label: "Apply sunscreen", sub: "Daily skin protection", time: "08:00" });
    }

    // Fruit — with morning meal
    if (enabledMap["fruit"]) {
      items.push({ moduleType: "fruit", emoji: "🍎", label: "Eat fruit", sub: "Daily fruit intake", time: "08:00" });
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
      items.push({ moduleType: "mood_check", emoji: "😊", label: "Daily mood check-in", sub: "Mood, energy & stress", time: "08:30" });
    }

    // Eye breaks — first break at work start
    if (enabledMap["eyebreak"]) {
      const startTime = (enabledMap["eyebreak"].startTime as string) ?? "09:00";
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = ((enabledMap["eyebreak"].endTime as string) ?? "18:00").split(":").map(Number);
      const target = (enabledMap["eyebreak"].targetBreaks as number) ??
        Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
      items.push({ moduleType: "eyebreak", emoji: "👁️", label: "Eye breaks", sub: `${target} breaks today`, time: startTime });
    }

    // Smoking status — mid-morning
    if (enabledMap["smoking"]) {
      items.push({ moduleType: "smoking", emoji: "🚭", label: "Quit smoking", sub: "Log today's status", time: "09:00" });
    }

    // Workout — use per-day settings
    if (enabledMap["workout"]) {
      const workoutDays = (enabledMap["workout"].days as Record<string, Record<string, unknown>>) ?? {};
      const todayWorkout = workoutDays[dayKey];
      if (todayWorkout?.enabled) {
        const workoutTime = (todayWorkout.time as string) ?? "07:00";
        items.push({
          moduleType: "workout", emoji: "🏃", label: "Workout",
          sub: (todayWorkout.focus as string | undefined) ?? undefined,
          time: workoutTime,
        });
      } else if (Object.keys(workoutDays).length > 0) {
        items.push({ moduleType: "workout", emoji: "😌", label: "Rest day", sub: "Recovery — no workout today", isRestDay: true, isDayOnly: true });
      }
    }

    // Water — one item per reminder time
    if (enabledMap["water"]) {
      const target = (enabledMap["water"].target as number) ?? 8;
      const times: string[] = (enabledMap["water"].reminderTimes as string[])?.length
        ? (enabledMap["water"].reminderTimes as string[])
        : ["08:00", "13:00", "17:00"];
      times.forEach((time, i) => {
        const label = i === 0 ? "Water intake" : i === 1 ? "Water intake (midday)" : "Water intake (evening)";
        items.push({ moduleType: "water", emoji: "💧", label, sub: `Goal: ${target} cups`, time });
      });
    }

    // Outdoors — afternoon
    if (enabledMap["outdoors"]) {
      const target = (enabledMap["outdoors"].target as number) ?? 30;
      items.push({ moduleType: "outdoors", emoji: "🌿", label: "Outdoor time", sub: `Goal: ${target} min`, time: "16:00" });
    }

    // Sleep — at bedtime target
    if (enabledMap["sleep"]) {
      const bedtime = (enabledMap["sleep"].bedtimeTarget as string) ?? "22:30";
      items.push({ moduleType: "sleep", emoji: "😴", label: "Sleep log", sub: "Log last night's sleep", time: bedtime });
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

// GET /api/patient-app/plan/current
router.get("/patient-app/plan/current", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const weekStart = getWeekStart();

  const { data: existing } = await supabase
    .from("weekly_plans").select("plan_data, generated_at")
    .eq("account_id", account.id).eq("week_start", weekStart).maybeSingle();

  if (existing) {
    const { count } = await supabase
      .from("wellness_modules").select("*", { count: "exact", head: true })
      .eq("account_id", account.id).gt("updated_at", existing.generated_at as string);
    if (!count) {
      res.json({ weekStart, plan: existing.plan_data as WeekPlan, generatedAt: existing.generated_at });
      return;
    }
  }

  const plan = await fetchAndSavePlan(account.id);
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
