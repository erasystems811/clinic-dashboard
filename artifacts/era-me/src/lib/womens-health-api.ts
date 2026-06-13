import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/womens-health";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("era_me_session");
    if (!stored) return null;
    return (JSON.parse(stored) as { token: string }).token ?? null;
  } catch { return null; }
}

function headers() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}) };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
async function patchReq<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface TodayData {
  isSetUp: boolean;
  settings?: { cycleLength: number; periodLength: number; lastPeriodStart: string | null };
  today?: string;
  cycleInfo?: CycleInfo | null;
  todayLog?: { flow: Flow | null; symptoms: string[]; notes: string | null; isPeriodStart: boolean } | null;
}

export interface CalendarDay {
  date: string;
  cycleDay: number | null;
  phase: Phase | null;
  isPeriodDay: boolean;
  isFertileDay: boolean;
  isOvulationDay: boolean;
  log: { flow: Flow | null; symptoms: string[]; notes: string | null; isPeriodStart: boolean } | null;
}

export interface CycleHistoryEntry {
  startDate: string;
  cycleLength: number | null;
  periodDays: number;
}

export interface PregnancyToday {
  isSetUp: boolean;
  today?: string;
  lmpDate?: string;
  dueDate?: string;
  weeksPregnant?: number;
  daysIntoWeek?: number;
  trimester?: 1 | 2 | 3;
  daysUntilDue?: number;
  isPostpartum?: boolean;
  todayLog?: {
    weightKg: number | null;
    symptoms: string[];
    mood: string | null;
    kicksCount: number | null;
    bloodPressure: string | null;
    notes: string | null;
  } | null;
}

export interface PregnancyTimelineEntry {
  date: string;
  week: number;
  weightKg: number | null;
  symptoms: string[];
  mood: string | null;
  kicksCount: number | null;
  bloodPressure: string | null;
  notes: string | null;
}

// ── UI constants ─────────────────────────────────────────────────────────────

export const PHASE_META: Record<Phase, { label: string; description: string; bg: string; color: string }> = {
  menstruation: {
    label: "Period",
    description: "Your period is here. Rest, stay hydrated, and take it easy.",
    bg: "bg-rose-100 dark:bg-rose-900/20",
    color: "text-rose-600 dark:text-rose-400",
  },
  follicular: {
    label: "Follicular Phase",
    description: "Your body is preparing to release an egg. Energy levels rise.",
    bg: "bg-purple-100 dark:bg-purple-900/20",
    color: "text-purple-600 dark:text-purple-400",
  },
  fertile: {
    label: "Fertile Window",
    description: "Highest chance of conception. Ovulation is near or happening.",
    bg: "bg-teal-100 dark:bg-teal-900/20",
    color: "text-teal-600 dark:text-teal-400",
  },
  luteal: {
    label: "Luteal Phase",
    description: "Post-ovulation. You may feel PMS symptoms in the final days.",
    bg: "bg-amber-100 dark:bg-amber-900/20",
    color: "text-amber-600 dark:text-amber-400",
  },
};

export const FLOW_META: Record<Flow, { label: string; dots: number; color: string }> = {
  spotting: { label: "Spotting", dots: 1, color: "bg-rose-200 dark:bg-rose-800" },
  light:    { label: "Light",    dots: 2, color: "bg-rose-400" },
  medium:   { label: "Medium",   dots: 3, color: "bg-rose-500" },
  heavy:    { label: "Heavy",    dots: 4, color: "bg-rose-700" },
};

// ── Cycle hooks ───────────────────────────────────────────────────────────────

export function useWomensHealthToday() {
  return useQuery<TodayData>({
    queryKey: ["womens", "today"],
    queryFn: () => get<TodayData>(`${BASE}/today`),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useWomensCalendar(month: string) {
  return useQuery<{ month: string; days: CalendarDay[]; settings: TodayData["settings"] }>({
    queryKey: ["womens", "calendar", month],
    queryFn: () => get(`${BASE}/calendar?month=${month}`),
    staleTime: 5 * 60_000,
  });
}
export const useWomensHealthCalendar = useWomensCalendar;

export function useWomensHistory() {
  return useQuery<{ cycles: CycleHistoryEntry[]; settings: TodayData["settings"] }>({
    queryKey: ["womens", "history"],
    queryFn: () => get(`${BASE}/history`),
    staleTime: 5 * 60_000,
  });
}
export const useWomensHealthHistory = useWomensHistory;

export function usePregnancyToday() {
  return useQuery<PregnancyToday>({
    queryKey: ["womens", "pregnancy", "today"],
    queryFn: () => get<PregnancyToday>(`${BASE}/pregnancy/today`),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function usePregnancyTimeline() {
  return useQuery<{ entries: PregnancyTimelineEntry[]; lmpDate: string; dueDate: string }>({
    queryKey: ["womens", "pregnancy", "timeline"],
    queryFn: () => get(`${BASE}/pregnancy/timeline`),
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSetupCycle() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { cycleLength: number; periodLength: number; lastPeriodStart: string }>({
    mutationFn: (b) => post(`${BASE}/setup`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens"] }); },
  });
}
export const useSetupWomensHealth = useSetupCycle;

export function useLogCycle() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { date?: string; flow?: Flow | null; symptoms?: string[]; notes?: string | null; isPeriodStart?: boolean }>({
    mutationFn: (b) => post(`${BASE}/log`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens"] }); },
  });
}
export const useLogCycleDay = useLogCycle;

export function useUpdateWomensHealthSettings() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { cycleLength?: number; periodLength?: number }>({
    mutationFn: (b) => patchReq(`${BASE}/settings`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens"] }); },
  });
}

export function useSetupPregnancy() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; lmpDate: string; dueDate: string }, Error, { lmpDate?: string; dueDate?: string }>({
    mutationFn: (b) => post(`${BASE}/pregnancy/setup`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens"] }); },
  });
}

export function useSwitchMode() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, "cycle" | "pregnancy">({
    mutationFn: (mode) => patchReq(`${BASE}/mode`, { mode }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens"] }); },
  });
}

export function useLogPregnancy() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, {
    date?: string;
    weightKg?: number | null;
    symptoms?: string[];
    mood?: string | null;
    kicksCount?: number | null;
    bloodPressure?: string | null;
    notes?: string | null;
  }>({
    mutationFn: (b) => post(`${BASE}/pregnancy/log`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["womens", "pregnancy"] }); },
  });
}
