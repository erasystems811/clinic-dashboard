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
  checklistId?: string; // overrides moduleType for done-state lookup (e.g. hygiene_uuid)
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

    // Hygiene — specific replacement items on their due date (or first day of week if overdue)
    if (enabledMap["hygiene"]) {
      interface HygieneItem { id: string; name: string; emoji: string; lastReplaced: string; intervalDays: number }
      const hItems = (enabledMap["hygiene"].items as HygieneItem[]) ?? [];
      const hNotes = enabledMap["hygiene"].notes as string | undefined;
      const hTime = (hNotes && parseTimeHint(hNotes)) ?? "07:00";
      const weekStart = weekDates[0];
      const weekStartMs = new Date(weekStart + "T12:00:00").getTime();
      const dayMs = new Date(date + "T12:00:00").getTime();
      for (const hi of hItems) {
        const dueMs = new Date(hi.lastReplaced + "T12:00:00").getTime() + hi.intervalDays * 86400000;
        const dueDate = new Date(dueMs).toISOString().split("T")[0];
        const isExactDay = dueDate === date;
        const isOverdueOnWeekStart = date === weekStart && dueMs < weekStartMs;
        if (isExactDay || isOverdueOnWeekStart) {
          const daysOverdue = isOverdueOnWeekStart ? Math.floor((dayMs - dueMs) / 86400000) : 0;
          const sub = daysOverdue > 0 ? `${daysOverdue}d overdue` : "Due today";
          items.push({ moduleType: "hygiene", checklistId: `hygiene_${hi.id}`, emoji: hi.emoji, label: `Replace ${hi.name}`, sub, time: hTime });
        }
      }
    }

    // Vaccines — specific item on its due date (or first day of week if overdue)
    if (enabledMap["vaccines"]) {
      interface Vaccine { id: string; name: string; nextDueDate?: string }
      const vaccines = (enabledMap["vaccines"].vaccines as Vaccine[]) ?? [];
      const weekStart = weekDates[0];
      const weekStartMs = new Date(weekStart + "T12:00:00").getTime();
      const dayMs = new Date(date + "T12:00:00").getTime();
      for (const v of vaccines) {
        if (!v.nextDueDate) continue;
        const dueMs = new Date(v.nextDueDate + "T12:00:00").getTime();
        const isExactDay = v.nextDueDate === date;
        const isOverdueOnWeekStart = date === weekStart && dueMs < weekStartMs;
        if (isExactDay || isOverdueOnWeekStart) {
          const daysOverdue = isOverdueOnWeekStart ? Math.floor((dayMs - dueMs) / 86400000) : 0;
          const sub = daysOverdue > 0 ? `${daysOverdue}d overdue` : "Due today";
          items.push({ moduleType: "vaccines", checklistId: `vaccine_${v.id}`, emoji: "💉", label: `${v.name} vaccine`, sub, time: "09:00" });
        }
      }
    }

    // Checkups — specific item on its due date (or first day of week if overdue)
    if (enabledMap["checkups"]) {
      interface Checkup { id: string; type: string; lastDate: string; intervalMonths: number }
      const CHECKUP_EMOJIS: Record<string, string> = { "Dental": "🦷", "Eye / Vision": "👁️", "GP / General": "🩺", "Blood Test": "🩸", "Blood Pressure": "💗", "Cancer Screening": "🔬", "Skin Check": "🧴" };
      const checkups = (enabledMap["checkups"].checkups as Checkup[]) ?? [];
      const weekStart = weekDates[0];
      const weekStartMs = new Date(weekStart + "T12:00:00").getTime();
      const dayMs = new Date(date + "T12:00:00").getTime();
      for (const c of checkups) {
        const due = new Date(c.lastDate + "T12:00:00");
        due.setMonth(due.getMonth() + c.intervalMonths);
        const dueMs = due.getTime();
        const dueDate = due.toISOString().split("T")[0];
        const isExactDay = dueDate === date;
        const isOverdueOnWeekStart = date === weekStart && dueMs < weekStartMs;
        if (isExactDay || isOverdueOnWeekStart) {
          const daysOverdue = isOverdueOnWeekStart ? Math.floor((dayMs - dueMs) / 86400000) : 0;
          const sub = daysOverdue > 0 ? `${daysOverdue}d overdue` : "Due today";
          items.push({ moduleType: "checkups", checklistId: `checkup_${c.id}`, emoji: CHECKUP_EMOJIS[c.type] ?? "📋", label: `${c.type} checkup`, sub, time: "09:00" });
        }
      }
    }

    // Sunscreen — one plan item per application
    if (enabledMap["sunscreen"]) {
      const ssNotes = enabledMap["sunscreen"].notes as string | undefined;
      const ssTarget = (enabledMap["sunscreen"].target as number) ?? 2;
      const reminderTime = (enabledMap["sunscreen"].reminderTime as string) ?? (ssNotes && parseTimeHint(ssNotes)) ?? "08:00";
      const [rh, rm] = reminderTime.split(":").map(Number);
      const startMins = (rh ?? 8) * 60 + (rm ?? 0);
      const endMins = 18 * 60;
      for (let i = 0; i < ssTarget; i++) {
        const t = ssTarget === 1 ? startMins : Math.round(startMins + (i * (endMins - startMins)) / Math.max(1, ssTarget - 1));
        const timeStr = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        items.push({ moduleType: "sunscreen", checklistId: `sunscreen_${i}`, emoji: "☀️", label: "Apply sunscreen", sub: ssTarget > 1 ? `Application ${i + 1} of ${ssTarget}` : (ssNotes ?? "Daily skin protection"), time: timeStr });
      }
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
        // Group active meds by dose time, keeping name + dosage
        const timeGroups: Record<string, { name: string; dosage?: string }[]> = {};
        activeMeds.forEach((m) => {
          const times: string[] = m.times?.length ? m.times : ["08:00"];
          times.forEach((t) => {
            if (!timeGroups[t]) timeGroups[t] = [];
            timeGroups[t].push({ name: m.name, dosage: m.dosage });
          });
        });
        // One plan item per individual medication so each has its own independent done state.
        // checklistId matches the wellness checklist format: med_${id}_${time}
        activeMeds.forEach((m) => {
          const times: string[] = m.times?.length ? m.times : ["08:00"];
          times.forEach((time) => {
            items.push({ moduleType: "medications", checklistId: `med_${m.id}_${time}`, emoji: "💊", label: `Take ${m.name}`, sub: m.dosage ?? undefined, time });
          });
        });
      }
    }

    // Mood check-in — flexible time (afternoon default)
    if (enabledMap["mood_check"]) {
      const mNotes = enabledMap["mood_check"].notes as string | undefined;
      const mReminderTime = enabledMap["mood_check"].reminderTime as string | undefined;
      const mTime = mReminderTime ?? (mNotes && parseTimeHint(mNotes)) ?? "14:00";
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

    // Alcohol
    if (enabledMap["alcohol"]) {
      const alNotes = enabledMap["alcohol"].notes as string | undefined;
      const alGoal = (enabledMap["alcohol"].goalType as string | undefined) ?? "quit";
      const alTime = (alNotes && parseTimeHint(alNotes)) ?? "20:00";
      const alLabel = alGoal === "reduce" ? "Alcohol check-in" : "Stay drink-free";
      items.push({ moduleType: "alcohol", emoji: "🍷", label: alLabel, sub: alNotes ?? "Log today's intake", time: alTime });
    }

    // Intimacy / celibacy
    if (enabledMap["intimacy"]) {
      const imNotes = enabledMap["intimacy"].notes as string | undefined;
      const imMode = (enabledMap["intimacy"].mode as string | undefined) ?? "celibacy";
      const imTime = (imNotes && parseTimeHint(imNotes)) ?? "21:00";
      if (imMode === "celibacy") {
        items.push({ moduleType: "intimacy", emoji: "💗", label: "Celibacy check-in", sub: imNotes ?? "Log today", time: imTime });
      } else {
        items.push({ moduleType: "intimacy", emoji: "💗", label: "Intimacy log", sub: imNotes ?? "Log today", time: imTime, isDayOnly: true });
      }
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

    // Water — single daily item (reminder times are for push notifications, not separate plan entries)
    if (enabledMap["water"]) {
      const wNotes = enabledMap["water"].notes as string | undefined;
      const target = (enabledMap["water"].target as number) ?? 8;
      const times: string[] = (enabledMap["water"].reminderTimes as string[])?.length
        ? (enabledMap["water"].reminderTimes as string[])
        : ["08:00"];
      items.push({ moduleType: "water", emoji: "💧", label: "Water intake", sub: wNotes ?? `Goal: ${target} cups today`, time: times[0] });
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

export async function fetchAndSavePlan(accountId: number): Promise<WeekPlan> {
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
