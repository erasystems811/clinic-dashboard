import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router: IRouter = Router();

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
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

    if (enabledMap["water"]) {
      const target = (enabledMap["water"].target as number) ?? 8;
      items.push({ moduleType: "water", emoji: "💧", label: "Water intake", sub: `Goal: ${target} cups` });
    }

    if (enabledMap["mood_check"]) {
      items.push({ moduleType: "mood_check", emoji: "😊", label: "Daily mood check-in", sub: "Mood, energy & stress" });
    }

    if (enabledMap["sleep"]) {
      items.push({ moduleType: "sleep", emoji: "😴", label: "Sleep log", sub: "Log last night's sleep" });
    }

    if (enabledMap["workout"]) {
      const workoutDays = (enabledMap["workout"].days as Record<string, Record<string, unknown>>) ?? {};
      const todayWorkout = workoutDays[dayKey];
      if (todayWorkout?.enabled) {
        items.push({
          moduleType: "workout", emoji: "🏃", label: "Workout",
          sub: (todayWorkout.focus as string | undefined) ?? undefined,
        });
      } else if (Object.keys(workoutDays).length > 0) {
        items.push({ moduleType: "workout", emoji: "😌", label: "Rest day", sub: "Recovery — no workout today", isRestDay: true });
      }
    }

    if (enabledMap["medications"]) {
      const meds = (enabledMap["medications"].medications as Array<Record<string, unknown>>) ?? [];
      const activeMeds = meds.filter((m) => {
        const start = m.startDate as string;
        const dur = m.durationDays as number | null;
        if (date < start) return false;
        if (dur) {
          const end = new Date(new Date(start + "T12:00:00").getTime() + dur * 86400000).toISOString().split("T")[0];
          if (date > end) return false;
        }
        return true;
      });
      if (activeMeds.length > 0) {
        const sub = activeMeds.map((m) => m.name as string).join(" · ");
        items.push({ moduleType: "medications", emoji: "💊", label: "Medications", sub });
      }
    }

    if (enabledMap["fruit"]) {
      items.push({ moduleType: "fruit", emoji: "🍎", label: "Eat fruit", sub: "Daily fruit intake" });
    }

    if (enabledMap["vitals"]) {
      items.push({ moduleType: "vitals", emoji: "❤️", label: "Log vitals", sub: "BP, sugar or weight" });
    }

    if (enabledMap["smoking"]) {
      items.push({ moduleType: "smoking", emoji: "🚭", label: "Quit smoking", sub: "Log today's status" });
    }

    if (enabledMap["eyebreak"]) {
      const [sh, sm] = ((enabledMap["eyebreak"].startTime as string) ?? "09:00").split(":").map(Number);
      const [eh, em] = ((enabledMap["eyebreak"].endTime   as string) ?? "18:00").split(":").map(Number);
      const target = (enabledMap["eyebreak"].targetBreaks as number) ??
        Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
      items.push({ moduleType: "eyebreak", emoji: "👁️", label: "Eye breaks", sub: `${target} breaks today` });
    }

    if (enabledMap["sunscreen"]) {
      items.push({ moduleType: "sunscreen", emoji: "☀️", label: "Apply sunscreen", sub: "Daily skin protection" });
    }

    if (enabledMap["outdoors"]) {
      const target = (enabledMap["outdoors"].target as number) ?? 30;
      items.push({ moduleType: "outdoors", emoji: "🌿", label: "Outdoor time", sub: `Goal: ${target} min` });
    }

    if (enabledMap["hygiene"]) {
      items.push({ moduleType: "hygiene", emoji: "🪥", label: "Hygiene routine", sub: "Brush teeth & essentials" });
    }

    return { date, dayKey, dayLabel, items };
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
    // Check if any module was updated after the plan was generated
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
