import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

const BASE = "/api/patient-app/weightloss";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WLMeal {
  id: string;
  slot: string;
  time: string;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface WLExercise {
  name: string;
  sets: number;
  reps: string;
  rest_secs: number;
}

export interface WLWorkout {
  isRestDay: boolean;
  name: string;
  duration_mins: number;
  exercises: WLExercise[];
  notes: string;
}

export interface WLDayPlan {
  date: string;
  dayLabel: string;
  fastingWindow: { start: string; end: string } | null;
  meals: WLMeal[];
  totalCalories: number;
  workout: WLWorkout;
}

export interface WLPlan {
  weekStart: string;
  dailyCalorieTarget: number;
  days: WLDayPlan[];
}

export interface WLProfile {
  currentWeightKg: number;
  goalWeightKg: number;
  dailyCalorieTarget: number;
  fastingWindow: { start: string; end: string } | null;
  coinsAvailable: number;
  cheatDaysAvailable: number;
}

export interface WLAdjustment {
  id: number;
  type: "punishment" | "reward";
  reason: string;
  description: string;
  announced_date: string;
  applies_date: string;
  calorie_adjustment: number;
  workout_mins_extra: number;
  coins_earned: number;
  cheat_day_granted: boolean;
}

export interface WLLoggedMeal {
  id: string;
  name: string;
  calories: number;
  time: string;
  planned_meal_id: string | null;
  logged_at: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useWLProfile() {
  return useQuery({
    queryKey: ["weightloss", "profile"],
    queryFn: () => apiFetch<{ profile: WLProfile | null; hasProfile: boolean; onboardingComplete: boolean }>(
      `${BASE}/profile`, { auth: true }
    ),
  });
}

export function useWLOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<{ ok: boolean; dailyCalorieTarget: number; tdee: number; bmr: number }>(
        `${BASE}/onboard`, { method: "POST", auth: true, body: JSON.stringify(data) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["weightloss"] }),
  });
}

export function useWLPlan(weekStart?: string) {
  return useQuery({
    queryKey: ["weightloss", "plan", weekStart ?? "current"],
    queryFn: () => apiFetch<{ plan: WLPlan | null; generatedAt: string | null; weekStart: string }>(
      `${BASE}/plan${weekStart ? `?weekStart=${weekStart}` : ""}`, { auth: true }
    ),
  });
}

export function useWLGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart?: string) =>
      apiFetch<{ plan: WLPlan; weekStart: string }>(
        `${BASE}/generate-plan`, { method: "POST", auth: true, body: JSON.stringify({ weekStart }) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["weightloss", "plan"] }),
  });
}

export function useWLToday() {
  return useQuery({
    queryKey: ["weightloss", "today"],
    queryFn: () => apiFetch<{
      today: string;
      todayPlan: WLDayPlan | null;
      log: { meals_logged: WLLoggedMeal[]; workouts_completed: unknown[]; weight_kg: number | null; total_calories_consumed: number } | null;
      profile: WLProfile | null;
      caloriesConsumed: number;
      caloriesRemaining: number;
      pendingAdjustments: WLAdjustment[];
    }>(`${BASE}/today`, { auth: true }),
    refetchInterval: 60000,
  });
}

export function useWLLogMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; calories: number; time?: string; plannedMealId?: string }) =>
      apiFetch<{ ok: boolean; totalCalories: number; caloriesRemaining: number }>(
        `${BASE}/log-meal`, { method: "POST", auth: true, body: JSON.stringify(data) }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["weightloss", "today"] }),
  });
}

export function useWLCompleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { exerciseId?: string; workoutId?: string }) =>
      apiFetch<{ ok: boolean }>(`${BASE}/complete-workout`, { method: "POST", auth: true, body: JSON.stringify(data) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["weightloss", "today"] }),
  });
}

export function useWLLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weightKg: number) =>
      apiFetch<{ ok: boolean }>(`${BASE}/log-weight`, { method: "POST", auth: true, body: JSON.stringify({ weightKg }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["weightloss", "today"] });
      void qc.invalidateQueries({ queryKey: ["weightloss", "progress"] });
    },
  });
}

export function useWLCalcCalories() {
  return useMutation({
    mutationFn: (description: string) =>
      apiFetch<{ items: Array<{ name: string; portion: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>; totalCalories: number; advice: string }>(
        `${BASE}/calculate-calories`, { method: "POST", auth: true, body: JSON.stringify({ description }) }
      ),
  });
}

export function useWLCoachChat() {
  return useMutation({
    mutationFn: (data: { message: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) =>
      apiFetch<{ reply: string }>(`${BASE}/coach-chat`, { method: "POST", auth: true, body: JSON.stringify(data) }),
  });
}

export function useWLProgress() {
  return useQuery({
    queryKey: ["weightloss", "progress"],
    queryFn: () => apiFetch<{
      noProfile?: boolean;
      profile: { currentWeightKg: number; goalWeightKg: number; dailyCalorieTarget: number; timelineWeeks: number; totalCoinsEarned: number; cheatDaysAvailable: number };
      avgMealAdherence: number | null;
      avgWorkoutAdherence: number | null;
      weightEntries: Array<{ date: string; weight: number }>;
      kgLost: number | null;
      recentAdjustments: WLAdjustment[];
      logsCount: number;
    }>(`${BASE}/progress`, { auth: true }),
  });
}

export function useWLAdjustments() {
  return useQuery({
    queryKey: ["weightloss", "adjustments"],
    queryFn: () => apiFetch<{ adjustments: WLAdjustment[] }>(`${BASE}/adjustments`, { auth: true }),
  });
}

// Emerald color constants for weight loss theme
export const WL_COLOR = "#10b981";
export const WL_DARK  = "#059669";
export const WL_BG    = "linear-gradient(135deg, #022c22, #064e3b)";
export const WL_GLOW  = "16, 185, 129";
