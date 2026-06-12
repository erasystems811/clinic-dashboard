import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/wellness";

function headers() {
  const token = localStorage.getItem("era_me_session");
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
  return useQuery({ queryKey: ["wellness", "today"], queryFn: () => get(`${BASE}/today`), staleTime: 0, refetchOnMount: "always" });
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

export function useWeekSummary() {
  return useQuery<WeekSummary>({
    queryKey: ["wellness", "summary"],
    queryFn: () => get<WeekSummary>(`${BASE}/week-summary`),
    staleTime: 0,
    refetchOnMount: "always",
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

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSaveModule(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { settings?: unknown; enabled?: boolean }) => put(`${BASE}/modules/${type}`, body),
    onSuccess: () => {
      void qc.refetchQueries({ queryKey: ["wellness"] });
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
      void fetch("/api/patient-app/coins/award", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(() => {
            const t = localStorage.getItem("era_me_session");
            return t ? { "x-patient-token": t } : {};
          })(),
        },
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
