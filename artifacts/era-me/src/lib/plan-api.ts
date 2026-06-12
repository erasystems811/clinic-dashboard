import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/plan";

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

async function post<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export interface PlanItem {
  moduleType: string;
  emoji: string;
  label: string;
  sub?: string;
  time?: string;       // "HH:MM" — scheduled clock time
  isDayOnly?: boolean; // true = no specific time (day-sensitive tasks)
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

export function useCurrentPlan(weekStart?: string) {
  return useQuery({
    queryKey: ["plan", weekStart ?? "current"],
    queryFn: () => get<{ weekStart: string; plan: WeekPlan; generatedAt: string }>(
      `${BASE}/current${weekStart ? `?weekStart=${weekStart}` : ""}`
    ),
    staleTime: weekStart ? 10 * 60 * 1000 : 0,
    refetchOnMount: weekStart ? false : "always",
  });
}

export function useRegeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ ok: boolean }>(`${BASE}/regenerate`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan"] });
      void qc.invalidateQueries({ queryKey: ["wellness", "today"] });
    },
  });
}
