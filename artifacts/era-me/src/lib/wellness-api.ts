import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/wellness";

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

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useWellnessToday() {
  const todayKey = new Date().toISOString().split("T")[0];
  return useQuery({ queryKey: ["wellness", "today", todayKey], queryFn: () => get(`${BASE}/today`), staleTime: 30_000 });
}

export function useWellnessModules() {
  return useQuery({ queryKey: ["wellness", "modules"], queryFn: () => get(`${BASE}/modules`) });
}

export function useWellnessWeek(type: string) {
  return useQuery({ queryKey: ["wellness", "week", type], queryFn: () => get<WeekLog[]>(`${BASE}/week/${type}`) });
}

export function useWellnessStreak(type: string) {
  return useQuery({ queryKey: ["wellness", "streak", type], queryFn: () => get<{ streak: number }>(`${BASE}/streak/${type}`) });
}

export interface WeeklyReportDay { date: string; completed: boolean }
export interface WeeklyReportModule {
  type: string; label: string; emoji: string;
  completed: number; possible: number; rate: number;
  dayData: WeeklyReportDay[];
}
export interface WeeklyReportWeek {
  rate: number; totalCompleted: number; totalPossible: number;
  modules: WeeklyReportModule[];
}
export interface WeeklyReport {
  weekStart: string; weekEnd: string; weekLabel: string;
  prevWeekStart: string; prevWeekEnd: string; prevWeekLabel: string;
  thisWeek: WeeklyReportWeek; prevWeek: WeeklyReportWeek;
  rateChange: number;
  thisWeekDates: string[]; prevWeekDates: string[];
  today: string;
  bestDay: { date: string; dayLabel: string; count: number } | null;
  worstDay: { date: string; dayLabel: string; count: number } | null;
}

export function useWeeklyReport(weekStart?: string) {
  return useQuery<WeeklyReport>({
    queryKey: ["wellness", "weekly-report", weekStart ?? "current"],
    queryFn: () => get<WeeklyReport>(`${BASE}/weekly-report${weekStart ? `?weekStart=${weekStart}` : ""}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeekSummary() {
  return useQuery<WeekSummary>({
    queryKey: ["wellness", "summary"],
    queryFn: () => get<WeekSummary>(`${BASE}/week-summary`),
    staleTime: 30_000,
  });
}

export function useAiInsight() {
  return useQuery<{ insight: string | null }>({
    queryKey: ["wellness", "ai-insight"],
    queryFn: () => get<{ insight: string | null }>(`${BASE}/ai-insight`),
    staleTime: 4 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export interface UpcomingEvent {
  id: string;
  module: "hygiene" | "vaccines" | "checkups";
  emoji: string;
  label: string;
  dueDate: string;
  daysUntil: number;
}

export function useUpcomingEvents() {
  return useQuery<{ events: UpcomingEvent[] }>({
    queryKey: ["wellness", "upcoming-events"],
    queryFn: () => get<{ events: UpcomingEvent[] }>(`${BASE}/upcoming-events`),
    staleTime: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSaveModule(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { settings?: unknown; enabled?: boolean }) => put(`${BASE}/modules/${type}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wellness"] });
      void qc.invalidateQueries({ queryKey: ["patient-plan-by-source"] });
      void fetch("/api/patient-app/plan/regenerate", { method: "POST", headers: headers() })
        .then(() => qc.invalidateQueries({ queryKey: ["plan"] }));
    },
  });
}

export function useDisableModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleType: string) => put(`${BASE}/modules/${moduleType}`, { enabled: false }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wellness"] });
      void qc.invalidateQueries({ queryKey: ["patient-plan-by-source"] });
      void fetch("/api/patient-app/plan/regenerate", { method: "POST", headers: headers() })
        .then(() => qc.invalidateQueries({ queryKey: ["plan"] }));
    },
  });
}

// Quick log — accepts moduleType + data in one call, for home-screen checkboxes
export function useQuickLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleType, data }: { moduleType: string; data: unknown }) =>
      post(`${BASE}/log`, { moduleType, data }),
    onSuccess: (_, { moduleType }) => {
      void qc.invalidateQueries({ queryKey: ["wellness", "today"] });
      void qc.invalidateQueries({ queryKey: ["wellness", "week", moduleType] });
      void qc.invalidateQueries({ queryKey: ["wellness", "summary"] });
      void qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

export function useLogToday(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => post(`${BASE}/log`, { moduleType: type, data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wellness", "today"] });
      void qc.invalidateQueries({ queryKey: ["wellness", "week", type] });
      void qc.invalidateQueries({ queryKey: ["wellness", "streak", type] });
      void qc.invalidateQueries({ queryKey: ["wellness", "summary"] });
      // Award 1 coin per log — fire-and-forget
      const coinHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const tkn = getToken();
      if (tkn) coinHeaders["x-patient-token"] = tkn;
      void fetch("/api/patient-app/coins/award", {
        method: "POST",
        headers: coinHeaders,
        body: JSON.stringify({ amount: 1, reason: `wellness_log_${type}` }),
      }).then(() => qc.invalidateQueries({ queryKey: ["coins"] }));
    },
  });
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface WeekLog {
  log_date: string;
  data: Record<string, unknown>;
}

export interface WeekSummaryModuleStat {
  type: string;
  label: string;
  emoji: string;
  completedDays: number;
  days: boolean[];
}

export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  moduleStats: WeekSummaryModuleStat[];
  moodAvg: { mood: number; energy: number; stress: number } | null;
  overallRate: number;
  totalCompleted: number;
  totalPossible: number;
}
