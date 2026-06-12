import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/womens-health";

function headers() {
  const token = localStorage.getItem("era_me_session");
  return { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}) };
}
async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); let m = t; try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ } throw new Error(m); }
  return r.json() as Promise<T>;
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); let m = t; try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ } throw new Error(m); }
  return r.json() as Promise<T>;
}

export type Phase = "menstruation" | "follicular" | "fertile" | "luteal";
export type Flow = "spotting" | "light" | "medium" | "heavy";

export interface CycleInfo {
  cycleDay: number;
  phase: Phase;
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

export interface CycleSettings {
  cycleLength: number;
  periodLength: number;
  lastPeriodStart: string | null;
}

export interface TodayLog {
  flow: Flow | null;
  symptoms: string[];
  notes: string | null;
  isPeriodStart: boolean;
}

export interface WomensHealthToday {
  isSetUp: boolean;
  settings?: CycleSettings;
  today?: string;
  cycleInfo?: CycleInfo | null;
  todayLog?: TodayLog | null;
}

export interface CalendarDay {
  date: string;
  cycleDay: number | null;
  phase: Phase | null;
  isPeriodDay: boolean;
  isFertileDay: boolean;
  isOvulationDay: boolean;
  log: TodayLog | null;
}

export interface CycleRecord {
  startDate: string;
  cycleLength: number | null;
  periodDays: number;
}

export function useWomensHealthToday() {
  return useQuery<WomensHealthToday>({
    queryKey: ["womens-health", "today"],
    queryFn: () => get(`${BASE}/today`),
  });
}

export function useWomensHealthCalendar(month: string) {
  return useQuery<{ month: string; days: CalendarDay[]; settings: CycleSettings }>({
    queryKey: ["womens-health", "calendar", month],
    queryFn: () => get(`${BASE}/calendar?month=${month}`),
  });
}

export function useWomensHealthHistory() {
  return useQuery<{ cycles: CycleRecord[]; settings: CycleSettings }>({
    queryKey: ["womens-health", "history"],
    queryFn: () => get(`${BASE}/history`),
  });
}

export function useSetupWomensHealth() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { cycleLength: number; periodLength: number; lastPeriodStart: string }>({
    mutationFn: (b) => post(`${BASE}/setup`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens-health"] }); },
  });
}

export function useUpdateWomensHealthSettings() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { cycleLength?: number; periodLength?: number }>({
    mutationFn: (b) => patch(`${BASE}/settings`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens-health"] }); },
  });
}

export function useLogCycleDay() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { date?: string; flow?: Flow | null; symptoms?: string[]; notes?: string | null; isPeriodStart?: boolean }>({
    mutationFn: (b) => post(`${BASE}/log`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens-health"] }); },
  });
}

// Phase display helpers
export const PHASE_META: Record<Phase, { label: string; color: string; bg: string; ring: string; description: string }> = {
  menstruation: {
    label: "Period",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    ring: "stroke-rose-500",
    description: "Your period is here. Rest, stay hydrated, and be kind to yourself.",
  },
  follicular: {
    label: "Follicular",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    ring: "stroke-purple-500",
    description: "Energy is rising. Great time for new projects and social activities.",
  },
  fertile: {
    label: "Fertile Window",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-100 dark:bg-teal-900/30",
    ring: "stroke-teal-500",
    description: "Your most fertile days. Ovulation is near.",
  },
  luteal: {
    label: "Luteal",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    ring: "stroke-amber-500",
    description: "Winding down toward your next period. Watch for PMS symptoms.",
  },
};

export const FLOW_META: Record<Flow, { label: string; dots: number; color: string }> = {
  spotting: { label: "Spotting", dots: 1, color: "bg-rose-200 dark:bg-rose-800" },
  light:    { label: "Light",    dots: 2, color: "bg-rose-400 dark:bg-rose-600" },
  medium:   { label: "Medium",   dots: 3, color: "bg-rose-500" },
  heavy:    { label: "Heavy",    dots: 4, color: "bg-rose-700 dark:bg-rose-500" },
};

export const SYMPTOMS = [
  "Cramps", "Bloating", "Headache", "Back pain", "Breast tenderness",
  "Mood swings", "Fatigue", "Nausea", "Food cravings", "Acne",
  "Insomnia", "Hot flashes", "Spotting", "Irritability", "Anxiety",
];
