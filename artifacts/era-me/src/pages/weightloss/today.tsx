import { useState } from "react";
import { ArrowLeft, Check, Plus, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { FullPageSpinner } from "@/components/spinner";
import {
  useWLToday, useWLLogMeal, useWLCompleteWorkout, useWLLogWeight,
  type WLMeal, type WLLoggedMeal,
} from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { cn } from "@/lib/utils";

export default function WLTodayPage() {
  const [, navigate] = useLocation();
  useWLTheme();
  return (
    <div className="px-5 pt-6 pb-24">
      <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 mb-5 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <TodayContent />
    </div>
  );
}

function TodayContent() {
  const { data, isLoading } = useWLToday();
  const logMeal = useWLLogMeal();
  const completeWorkout = useWLCompleteWorkout();
  const logWeight = useWLLogWeight();

  const [addingMeal, setAddingMeal] = useState(false);
  const [customMeal, setCustomMeal] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [showWeightInput, setShowWeightInput] = useState(false);

  if (isLoading) return <FullPageSpinner />;
  if (!data?.todayPlan) {
    return (
      <div className="text-center py-16">
        <p style={{ fontSize: 48 }}>📋</p>
        <p className="text-base font-bold mt-3" style={{ color: "var(--text-main)" }}>No plan for today</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-sub)" }}>Your coach hasn't generated this week's plan yet.</p>
        <button onClick={() => window.history.back()}
          className="mt-5 px-6 py-3 rounded-2xl text-sm font-bold"
          style={{ background: "var(--accent)", color: "#fff" }}>
          Go back
        </button>
      </div>
    );
  }

  const { todayPlan, log, caloriesConsumed, caloriesRemaining, pendingAdjustments, profile } = data;
  const loggedMeals: WLLoggedMeal[] = (log?.meals_logged ?? []) as WLLoggedMeal[];
  const loggedMealIds = new Set(loggedMeals.map((m) => m.planned_meal_id).filter(Boolean));
  const workoutsCompleted = (log?.workouts_completed ?? []) as string[];
  const workoutDone = workoutsCompleted.includes("main");

  const pct = Math.min(1, caloriesConsumed / (profile?.dailyCalorieTarget ?? 2000));
  const r = 40;
  const circ = 2 * Math.PI * r;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-black" style={{ color: "var(--text-main)" }}>
            {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}
          </p>
          <p className="text-sm" style={{ color: "var(--text-sub)" }}>{todayPlan.dayLabel}</p>
        </div>
        <button onClick={() => setShowWeightInput((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
          <Scale className="w-3.5 h-3.5" /> Log weight
        </button>
      </div>

      {/* Weight input */}
      {showWeightInput && (
        <div className="rounded-2xl p-4 flex gap-3"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <input
            type="number" step="0.1" placeholder="Weight in kg"
            value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
            style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }}
          />
          <button
            onClick={() => {
              if (!weightInput) return;
              logWeight.mutate(parseFloat(weightInput), {
                onSuccess: () => { setWeightInput(""); setShowWeightInput(false); },
              });
            }}
            disabled={!weightInput || logWeight.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}>
            Save
          </button>
        </div>
      )}

      {/* Pending adjustments */}
      {(pendingAdjustments?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {pendingAdjustments!.map((adj) => (
            <div key={adj.id} className="rounded-2xl p-4"
              style={{
                background: adj.type === "punishment" ? "rgba(239,68,68,0.06)" : "rgba(var(--glow-rgb),0.06)",
                border: `1px solid ${adj.type === "punishment" ? "rgba(239,68,68,0.25)" : "rgba(var(--glow-rgb),0.19)"}`,
              }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1"
                style={{ color: adj.type === "punishment" ? "#f87171" : "var(--accent)" }}>
                {adj.type === "punishment" ? "⚠️ Coach Punishment" : "🎉 Coach Reward"} — {adj.applies_date}
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{adj.description}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Reason: {adj.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Calorie summary */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <svg width={92} height={92} viewBox="0 0 92 92" className="shrink-0">
          <circle cx={46} cy={46} r={r} fill="none" stroke="rgba(var(--glow-rgb),0.12)" strokeWidth={9} />
          <circle
            cx={46} cy={46} r={r} fill="none"
            stroke={caloriesRemaining < 0 ? "#ef4444" : "var(--accent)"}
            strokeWidth={9} strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform="rotate(-90 46 46)"
            style={{ transition: "stroke-dashoffset 0.5s" }}
          />
          <text x={46} y={43} textAnchor="middle" fontSize="16" fontWeight="900" fill="white" fontFamily="inherit">
            {caloriesConsumed}
          </text>
          <text x={46} y={57} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="inherit">
            kcal
          </text>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-black" style={{ color: caloriesRemaining < 0 ? "#f87171" : "var(--accent)" }}>
            {caloriesRemaining > 0 ? `${caloriesRemaining}` : `+${Math.abs(caloriesRemaining)}`}
          </p>
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>
            {caloriesRemaining > 0 ? "kcal remaining" : "kcal over budget"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            Target: {profile?.dailyCalorieTarget ?? "—"} kcal
          </p>
        </div>
      </div>

      {/* Fasting window */}
      {profile?.fastingWindow && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2"
          style={{ background: "rgba(var(--glow-rgb),0.06)", border: "1px solid rgba(var(--glow-rgb),0.15)" }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            Eating window: {profile.fastingWindow.start} — {profile.fastingWindow.end}
          </p>
        </div>
      )}

      {/* Meals */}
      <Section title="Today's Meals" total={`${todayPlan.totalCalories} kcal planned`}>
        <div className="space-y-2">
          {todayPlan.meals.map((meal) => {
            const done = loggedMealIds.has(meal.id);
            return (
              <MealRow
                key={meal.id}
                meal={meal}
                done={done}
                onLog={() => {
                  logMeal.mutate({ name: meal.name, calories: meal.calories, time: meal.time, plannedMealId: meal.id });
                }}
                loading={logMeal.isPending}
              />
            );
          })}
          {!addingMeal ? (
            <button
              onClick={() => setAddingMeal(true)}
              className="w-full flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition active:scale-95"
              style={{ background: "var(--glass-bg)", border: "1.5px dashed var(--glass-border)", color: "var(--text-dim)" }}>
              <Plus className="w-4 h-4" /> Log additional meal
            </button>
          ) : (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <input placeholder="Food name (e.g. jollof rice, chicken)" value={customMeal}
                onChange={(e) => setCustomMeal(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
              <input type="number" placeholder="Calories (kcal)" value={customCal}
                onChange={(e) => setCustomCal(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
              <div className="flex gap-2">
                <button onClick={() => { setAddingMeal(false); setCustomMeal(""); setCustomCal(""); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--bg-base)", color: "var(--text-sub)" }}>
                  Cancel
                </button>
                <button
                  disabled={!customMeal || !customCal || logMeal.isPending}
                  onClick={() => {
                    logMeal.mutate({ name: customMeal, calories: parseInt(customCal, 10) }, {
                      onSuccess: () => { setAddingMeal(false); setCustomMeal(""); setCustomCal(""); },
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--accent)" }}>
                  Add meal
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Workout */}
      <Section title="Today's Workout">
        {todayPlan.workout.isRestDay ? (
          <div className="rounded-2xl p-4 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p style={{ fontSize: 36 }}>😴</p>
            <p className="font-bold text-sm mt-2" style={{ color: "var(--text-main)" }}>Rest Day</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-sub)" }}>Recovery is as important as training</p>
          </div>
        ) : (
          <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{todayPlan.workout.name}</p>
                <p className="text-xs" style={{ color: "var(--text-sub)" }}>{todayPlan.workout.duration_mins} mins</p>
              </div>
              <button
                onClick={() => completeWorkout.mutate({ workoutId: "main" })}
                disabled={workoutDone || completeWorkout.isPending}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95",
                  workoutDone ? "opacity-60 cursor-default" : "")}
                style={{
                  background: workoutDone ? "rgba(var(--glow-rgb),0.12)" : "var(--accent)",
                  color: workoutDone ? "var(--accent)" : "#fff",
                  border: workoutDone ? "1px solid rgba(var(--glow-rgb),0.25)" : "none",
                }}>
                {workoutDone ? <><Check className="w-3.5 h-3.5" /> Done!</> : "Mark complete"}
              </button>
            </div>
            {todayPlan.workout.exercises.length > 0 && (
              <div className="space-y-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
                {todayPlan.workout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>{ex.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {ex.sets ? `${ex.sets} × ${ex.reps}` : ex.reps}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {todayPlan.workout.notes && (
              <p className="text-xs mt-3 italic" style={{ color: "var(--text-dim)" }}>{todayPlan.workout.notes}</p>
            )}
          </div>
        )}
      </Section>

      {/* Already logged meals */}
      {loggedMeals.length > 0 && (
        <Section title={`Logged today (${loggedMeals.length})`}>
          <div className="space-y-1">
            {loggedMeals.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{m.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>{m.time}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{m.calories} kcal</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function MealRow({ meal, done, onLog, loading }: {
  meal: WLMeal; done: boolean; onLog: () => void; loading: boolean;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", opacity: done ? 0.7 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
              style={{ background: "rgba(var(--glow-rgb),0.09)", color: "var(--accent)" }}>
              {meal.slot} · {meal.time}
            </span>
          </div>
          <p className="text-sm font-bold mt-1" style={{ color: "var(--text-main)" }}>{meal.name}</p>
          {meal.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-sub)" }}>{meal.description}</p>
          )}
          <div className="flex gap-3 mt-1.5">
            <MacroChip label="cal" value={meal.calories} />
            <MacroChip label="P" value={meal.protein_g} unit="g" />
            <MacroChip label="C" value={meal.carbs_g} unit="g" />
            <MacroChip label="F" value={meal.fat_g} unit="g" />
          </div>
        </div>
        <button
          onClick={onLog}
          disabled={done || loading}
          className={cn("shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-90",
            done ? "cursor-default" : "")}
          style={{
            background: done ? "rgba(var(--glow-rgb),0.09)" : "var(--accent)",
            color: done ? "var(--accent)" : "#fff",
          }}>
          {done ? <Check className="w-3.5 h-3.5" /> : "Log"}
        </button>
      </div>
    </div>
  );
}

function MacroChip({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  return (
    <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>
      {label}: {value}{unit}
    </span>
  );
}

function Section({ title, total, children }: { title: string; total?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{title}</p>
        {total && <p className="text-xs" style={{ color: "var(--text-dim)" }}>{total}</p>}
      </div>
      {children}
    </div>
  );
}

