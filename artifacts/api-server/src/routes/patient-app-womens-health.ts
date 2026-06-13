import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router: IRouter = Router();

interface WSettings {
  cycleLength: number;
  periodLength: number;
  lastPeriodStart: string | null;
}

interface CycleInfo {
  cycleDay: number;
  phase: "menstruation" | "follicular" | "fertile" | "luteal";
  currentCycleStart: string;
  nextPeriodDate: string;
  daysUntilNextPeriod: number;
  ovulationDate: string;
  fertileStartDate: string;
  fertileEndDate: string;
  isPeriodDay: boolean;
  isFertileDay: boolean;
  isOvulationDay: boolean;
  ovulationCycleDay: number;
  fertileStartCycleDay: number;
  fertileEndCycleDay: number;
}

function computeCycleInfo(settings: WSettings, today: string): CycleInfo | null {
  if (!settings.lastPeriodStart) return null;

  const lastStart = new Date(settings.lastPeriodStart + "T12:00:00");
  const todayDate = new Date(today + "T12:00:00");

  if (todayDate < lastStart) return null;

  const daysDiff = Math.floor((todayDate.getTime() - lastStart.getTime()) / 86400000);
  const completedCycles = Math.floor(daysDiff / settings.cycleLength);

  const currentCycleStart = new Date(lastStart);
  currentCycleStart.setDate(currentCycleStart.getDate() + completedCycles * settings.cycleLength);

  const cycleDay = daysDiff - completedCycles * settings.cycleLength + 1;

  const nextPeriod = new Date(currentCycleStart);
  nextPeriod.setDate(nextPeriod.getDate() + settings.cycleLength);
  const daysUntilNextPeriod = Math.ceil((nextPeriod.getTime() - todayDate.getTime()) / 86400000);

  // Standard fertile window: ovulation = cycleLength - 14, window = ovDay -4 to ovDay +2
  const ovCycleDay = settings.cycleLength - 14;
  const fertileStartCycleDay = Math.max(1, ovCycleDay - 4);
  const fertileEndCycleDay = ovCycleDay + 2;

  const ovDate = new Date(currentCycleStart);
  ovDate.setDate(ovDate.getDate() + ovCycleDay - 1);
  const fertileStartDate = new Date(currentCycleStart);
  fertileStartDate.setDate(fertileStartDate.getDate() + fertileStartCycleDay - 1);
  const fertileEndDate = new Date(currentCycleStart);
  fertileEndDate.setDate(fertileEndDate.getDate() + fertileEndCycleDay - 1);

  let phase: CycleInfo["phase"];
  if (cycleDay <= settings.periodLength) phase = "menstruation";
  else if (cycleDay < fertileStartCycleDay) phase = "follicular";
  else if (cycleDay <= fertileEndCycleDay) phase = "fertile";
  else phase = "luteal";

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  return {
    cycleDay,
    phase,
    currentCycleStart: fmt(currentCycleStart),
    nextPeriodDate: fmt(nextPeriod),
    daysUntilNextPeriod,
    ovulationDate: fmt(ovDate),
    fertileStartDate: fmt(fertileStartDate),
    fertileEndDate: fmt(fertileEndDate),
    isPeriodDay: cycleDay <= settings.periodLength,
    isFertileDay: cycleDay >= fertileStartCycleDay && cycleDay <= fertileEndCycleDay,
    isOvulationDay: cycleDay === ovCycleDay,
    ovulationCycleDay: ovCycleDay,
    fertileStartCycleDay,
    fertileEndCycleDay,
  };
}

function phaseForCycleDay(day: number, settings: WSettings): CycleInfo["phase"] {
  const ovCycleDay = settings.cycleLength - 14;
  const fertileStart = Math.max(1, ovCycleDay - 4);
  const fertileEnd = ovCycleDay + 2;
  if (day <= settings.periodLength) return "menstruation";
  if (day < fertileStart) return "follicular";
  if (day <= fertileEnd) return "fertile";
  return "luteal";
}

// ── GET /api/patient-app/womens-health/today ─────────────────────────────────
router.get("/patient-app/womens-health/today", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];

  const [settingsRes, logRes] = await Promise.all([
    supabase.from("womens_health_settings").select("*").eq("account_id", account.id).maybeSingle(),
    supabase.from("cycle_logs").select("*").eq("account_id", account.id).eq("log_date", today).maybeSingle(),
  ]);

  const raw = settingsRes.data;
  if (!raw) {
    res.json({ isSetUp: false });
    return;
  }

  const settings: WSettings = {
    cycleLength: raw.cycle_length as number,
    periodLength: raw.period_length as number,
    lastPeriodStart: raw.last_period_start as string | null,
  };

  const cycleInfo = computeCycleInfo(settings, today);

  res.json({
    isSetUp: true,
    settings,
    today,
    cycleInfo,
    todayLog: logRes.data
      ? {
          flow: logRes.data.flow,
          symptoms: logRes.data.symptoms as string[],
          notes: logRes.data.notes,
          isPeriodStart: logRes.data.is_period_start,
        }
      : null,
  });
});

// ── POST /api/patient-app/womens-health/setup ────────────────────────────────
router.post("/patient-app/womens-health/setup", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { cycleLength = 28, periodLength = 5, lastPeriodStart } = req.body as {
    cycleLength?: number; periodLength?: number; lastPeriodStart?: string;
  };

  const { error } = await supabase.from("womens_health_settings").upsert({
    account_id: account.id,
    cycle_length: cycleLength,
    period_length: periodLength,
    last_period_start: lastPeriodStart ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── PATCH /api/patient-app/womens-health/settings ────────────────────────────
router.patch("/patient-app/womens-health/settings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { cycleLength, periodLength } = req.body as { cycleLength?: number; periodLength?: number };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (cycleLength != null) patch.cycle_length = cycleLength;
  if (periodLength != null) patch.period_length = periodLength;

  const { error } = await supabase.from("womens_health_settings").update(patch).eq("account_id", account.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── POST /api/patient-app/womens-health/log ───────────────────────────────────
router.post("/patient-app/womens-health/log", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { date, flow, symptoms = [], notes, isPeriodStart = false } = req.body as {
    date?: string; flow?: string | null; symptoms?: string[]; notes?: string | null; isPeriodStart?: boolean;
  };

  const logDate = date ?? new Date().toISOString().split("T")[0];

  const { error } = await supabase.from("cycle_logs").upsert({
    account_id: account.id,
    log_date: logDate,
    flow: flow ?? null,
    symptoms,
    notes: notes ?? null,
    is_period_start: isPeriodStart,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,log_date" });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // If marking as period start, update last_period_start
  if (isPeriodStart) {
    const { data: existing } = await supabase
      .from("womens_health_settings").select("last_period_start, cycle_length").eq("account_id", account.id).maybeSingle();

    // Compute new average cycle length if we have a previous start
    let newCycleLength: number | undefined;
    if (existing?.last_period_start) {
      const prev = new Date((existing.last_period_start as string) + "T12:00:00");
      const curr = new Date(logDate + "T12:00:00");
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff >= 20 && diff <= 45) {
        // Smooth towards new observed length (80% old, 20% new)
        newCycleLength = Math.round((existing.cycle_length as number) * 0.8 + diff * 0.2);
      }
    }

    const updatePatch: Record<string, unknown> = { last_period_start: logDate, updated_at: new Date().toISOString() };
    if (newCycleLength) updatePatch.cycle_length = newCycleLength;

    await supabase.from("womens_health_settings").update(updatePatch).eq("account_id", account.id);
  }

  res.json({ ok: true });
});

// ── GET /api/patient-app/womens-health/calendar?month=YYYY-MM ────────────────
router.get("/patient-app/womens-health/calendar", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
  const [year, mon] = month.split("-").map(Number);

  const firstDay = new Date(year, mon - 1, 1);
  const lastDay  = new Date(year, mon, 0);
  const from = firstDay.toISOString().split("T")[0];
  const to   = lastDay.toISOString().split("T")[0];

  const [settingsRes, logsRes] = await Promise.all([
    supabase.from("womens_health_settings").select("*").eq("account_id", account.id).maybeSingle(),
    supabase.from("cycle_logs").select("*").eq("account_id", account.id).gte("log_date", from).lte("log_date", to),
  ]);

  if (!settingsRes.data) { res.json({ month, days: [] }); return; }

  const settings: WSettings = {
    cycleLength: settingsRes.data.cycle_length as number,
    periodLength: settingsRes.data.period_length as number,
    lastPeriodStart: settingsRes.data.last_period_start as string | null,
  };

  const logMap: Record<string, { flow: string | null; symptoms: string[]; notes: string | null; isPeriodStart: boolean }> = {};
  for (const l of logsRes.data ?? []) {
    logMap[l.log_date as string] = {
      flow: l.flow as string | null,
      symptoms: l.symptoms as string[],
      notes: l.notes as string | null,
      isPeriodStart: l.is_period_start as boolean,
    };
  }

  const days = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const info = computeCycleInfo(settings, dateStr);
    days.push({
      date: dateStr,
      cycleDay: info?.cycleDay ?? null,
      phase: info?.phase ?? null,
      isPeriodDay: info?.isPeriodDay ?? false,
      isFertileDay: info?.isFertileDay ?? false,
      isOvulationDay: info?.isOvulationDay ?? false,
      log: logMap[dateStr] ?? null,
    });
  }

  res.json({ month, days, settings });
});

// ── GET /api/patient-app/womens-health/history ───────────────────────────────
router.get("/patient-app/womens-health/history", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: settingsData } = await supabase.from("womens_health_settings").select("*").eq("account_id", account.id).maybeSingle();
  if (!settingsData) { res.json({ cycles: [] }); return; }

  const settings: WSettings = {
    cycleLength: settingsData.cycle_length as number,
    periodLength: settingsData.period_length as number,
    lastPeriodStart: settingsData.last_period_start as string | null,
  };

  // Last 6 months of logs
  const from = new Date(); from.setMonth(from.getMonth() - 6);
  const { data: logs } = await supabase.from("cycle_logs")
    .select("log_date, flow, symptoms, is_period_start")
    .eq("account_id", account.id)
    .gte("log_date", from.toISOString().split("T")[0])
    .order("log_date", { ascending: true });

  // Build cycle periods from is_period_start markers
  const periodStarts: string[] = [];
  for (const l of logs ?? []) {
    if (l.is_period_start) periodStarts.push(l.log_date as string);
  }

  // If we have lastPeriodStart from settings but it's not in logs, include it
  if (settings.lastPeriodStart && !periodStarts.includes(settings.lastPeriodStart)) {
    periodStarts.push(settings.lastPeriodStart);
    periodStarts.sort();
  }

  const cycles = periodStarts.map((start, i) => {
    const nextStart = periodStarts[i + 1];
    const length = nextStart
      ? Math.round((new Date(nextStart + "T12:00:00").getTime() - new Date(start + "T12:00:00").getTime()) / 86400000)
      : null;

    // Count period days from logs (days with flow between this start and next)
    const end = nextStart ?? new Date(start + "T12:00:00");
    const endDate = typeof end === "string"
      ? new Date(end + "T12:00:00")
      : end;

    const startDate = new Date(start + "T12:00:00");
    const periodDays = (logs ?? []).filter((l: Record<string, unknown>) => {
      const d = new Date((l.log_date as string) + "T12:00:00");
      return d >= startDate && d < endDate && l.flow;
    }).length;

    return { startDate: start, cycleLength: length, periodDays: periodDays || settings.periodLength };
  }).reverse(); // most recent first

  res.json({ cycles, settings });
});

// ── PATCH /api/patient-app/womens-health/mode ────────────────────────────────
router.patch("/patient-app/womens-health/mode", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { mode } = req.body as { mode: "cycle" | "pregnancy" };
  if (mode !== "cycle" && mode !== "pregnancy") { res.status(400).json({ error: "mode must be cycle or pregnancy" }); return; }
  await supabase.from("womens_health_settings").upsert({ account_id: account.id, mode, updated_at: new Date().toISOString() }, { onConflict: "account_id" });
  res.json({ ok: true });
});

// ── POST /api/patient-app/womens-health/pregnancy/setup ──────────────────────
router.post("/patient-app/womens-health/pregnancy/setup", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { lmpDate, dueDate } = req.body as { lmpDate?: string; dueDate?: string };
  if (!lmpDate && !dueDate) { res.status(400).json({ error: "lmpDate or dueDate required" }); return; }

  let resolvedLmp = lmpDate ?? null;
  let resolvedDue = dueDate ?? null;

  if (lmpDate && !dueDate) {
    const lmp = new Date(lmpDate + "T12:00:00");
    lmp.setDate(lmp.getDate() + 280);
    resolvedDue = lmp.toISOString().split("T")[0];
  }
  if (dueDate && !lmpDate) {
    const due = new Date(dueDate + "T12:00:00");
    due.setDate(due.getDate() - 280);
    resolvedLmp = due.toISOString().split("T")[0];
  }

  const { error } = await supabase.from("womens_health_settings").upsert({
    account_id: account.id,
    mode: "pregnancy",
    lmp_date: resolvedLmp,
    due_date: resolvedDue,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, lmpDate: resolvedLmp, dueDate: resolvedDue });
});

// ── GET /api/patient-app/womens-health/pregnancy/today ───────────────────────
router.get("/patient-app/womens-health/pregnancy/today", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const [settingsRes, logRes] = await Promise.all([
    supabase.from("womens_health_settings").select("mode, lmp_date, due_date").eq("account_id", account.id).maybeSingle(),
    supabase.from("pregnancy_logs").select("*").eq("account_id", account.id).eq("log_date", today).maybeSingle(),
  ]);

  const raw = settingsRes.data;
  if (!raw?.lmp_date) { res.json({ isSetUp: false }); return; }

  const lmp = new Date((raw.lmp_date as string) + "T12:00:00");
  const due = new Date((raw.due_date as string) + "T12:00:00");
  const todayDate = new Date(today + "T12:00:00");

  const daysPregnant = Math.floor((todayDate.getTime() - lmp.getTime()) / 86400000);
  const weeksPregnant = Math.floor(daysPregnant / 7);
  const daysIntoWeek = daysPregnant % 7;
  const daysUntilDue = Math.ceil((due.getTime() - todayDate.getTime()) / 86400000);

  let trimester = 1;
  if (weeksPregnant >= 13 && weeksPregnant < 27) trimester = 2;
  else if (weeksPregnant >= 27) trimester = 3;

  const isPostpartum = daysUntilDue < -1;

  res.json({
    isSetUp: true,
    today,
    lmpDate: raw.lmp_date,
    dueDate: raw.due_date,
    weeksPregnant: Math.max(0, weeksPregnant),
    daysIntoWeek,
    trimester,
    daysUntilDue,
    isPostpartum,
    todayLog: logRes.data ? {
      weightKg: logRes.data.weight_kg,
      symptoms: logRes.data.symptoms as string[],
      mood: logRes.data.mood,
      kicksCount: logRes.data.kicks_count,
      bloodPressure: logRes.data.blood_pressure,
      notes: logRes.data.notes,
    } : null,
  });
});

// ── POST /api/patient-app/womens-health/pregnancy/log ────────────────────────
router.post("/patient-app/womens-health/pregnancy/log", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { date, weightKg, symptoms = [], mood, kicksCount, bloodPressure, notes } = req.body as {
    date?: string; weightKg?: number | null; symptoms?: string[]; mood?: string | null;
    kicksCount?: number | null; bloodPressure?: string | null; notes?: string | null;
  };

  const logDate = date ?? new Date().toISOString().split("T")[0];
  await supabase.from("pregnancy_logs").upsert({
    account_id: account.id,
    log_date: logDate,
    weight_kg: weightKg ?? null,
    symptoms,
    mood: mood ?? null,
    kicks_count: kicksCount ?? null,
    blood_pressure: bloodPressure ?? null,
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,log_date" });

  res.json({ ok: true });
});

// ── GET /api/patient-app/womens-health/pregnancy/timeline ────────────────────
router.get("/patient-app/womens-health/pregnancy/timeline", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [settingsRes, logsRes] = await Promise.all([
    supabase.from("womens_health_settings").select("lmp_date, due_date").eq("account_id", account.id).maybeSingle(),
    supabase.from("pregnancy_logs").select("*").eq("account_id", account.id).order("log_date", { ascending: false }).limit(60),
  ]);

  const raw = settingsRes.data;
  if (!raw?.lmp_date) { res.json({ entries: [] }); return; }

  const lmp = new Date((raw.lmp_date as string) + "T12:00:00");

  const entries = (logsRes.data ?? []).map(l => {
    const logDate = new Date((l.log_date as string) + "T12:00:00");
    const daysPregnant = Math.floor((logDate.getTime() - lmp.getTime()) / 86400000);
    return {
      date: l.log_date,
      week: Math.floor(daysPregnant / 7),
      weightKg: l.weight_kg,
      symptoms: l.symptoms as string[],
      mood: l.mood,
      kicksCount: l.kicks_count,
      bloodPressure: l.blood_pressure,
      notes: l.notes,
    };
  });

  res.json({ entries, lmpDate: raw.lmp_date, dueDate: raw.due_date });
});

// ── DELETE /api/patient-app/womens-health ─────────────────────────────────────
router.delete("/patient-app/womens-health", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  await supabase.from("womens_health_settings").delete().eq("account_id", account.id);
  res.json({ ok: true });
});

export default router;
