import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type { HealthSnapshot } from "./health-tracker";

const BASE = "/api/patient-app/auto-health";

export interface AutoHealthLog {
  date: string;
  steps: number;
  distanceMeters: number;
  activeMinutes: number;
  caloriesBurned: number;
  activityType: string;
  sleepHours: number | null;
  sleepQuality: "good" | "fair" | "poor" | null;
  source: "web" | "native";
}

export function useAutoHealthToday() {
  return useQuery<{ log: AutoHealthLog | null }>({
    queryKey: ["auto-health", "today"],
    queryFn: () => apiFetch<{ log: AutoHealthLog | null }>(`${BASE}/today`, { auth: true }),
    staleTime: 30_000,
  });
}

export function useAutoHealthHistory() {
  return useQuery<{ history: AutoHealthLog[] }>({
    queryKey: ["auto-health", "history"],
    queryFn: () => apiFetch<{ history: AutoHealthLog[] }>(`${BASE}/history`, { auth: true }),
    staleTime: 5 * 60_000,
  });
}

export function useSyncAutoHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshot: HealthSnapshot) =>
      apiFetch<{ ok: boolean }>(`${BASE}/sync`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          steps:          snapshot.steps,
          distanceMeters: snapshot.distanceMeters,
          activeMinutes:  snapshot.activeMinutes,
          caloriesBurned: snapshot.caloriesBurned,
          activityType:   snapshot.activityType,
          sleepHours:     snapshot.sleepHours,
          sleepQuality:   snapshot.sleepQuality,
          source:         snapshot.source,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auto-health", "today"] });
    },
  });
}
