import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Flame, TrendingDown, Calendar, Wrench, ChevronRight, Check, RefreshCw } from "lucide-react";
import { useWLProfile, useWLToday, useWLProgress, useWLPlan, useWLGeneratePlan } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { FullPageSpinner } from "@/components/spinner";
import WLOnboarding from "./onboarding";

type Tab = "today" | "progress" | "week" | "tools";

const SLOT_META: Record<string, { emoji: string; label: string }> = {
  breakfast: { emoji: "🌅", label: "Breakfast" },
  lunch:     { emoji: "☀️",  label: "Lunch" },
  dinner:    { emoji: "🌙", label: "Dinner" },
  snack:     { emoji: "🍎", label: "Snack" },
};

const DAY_CHARS = ["M", "T", "W", "T", "F", "S", "S"];

export default function WeightLossPage() {
  const { data, isLoading } = useWLProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, navigate] = useLocation();
  useWLTheme();

  if (isLoading) return <FullPageSpinner />;

  if (showOnboarding || !data?.onboardingComplete) {
    return (
      <WLOnboarding
        onDone={() => {
          setShowOnboarding(false);
          window.location.reload();
        }}
      />
    );
  }

  return <Dashboard onBack={() => navigate("/")} />;
}

// ── Main Dashboard Shell ─────────────────────────────────────────────────────

function Dashboard({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const { data: today } = useWLToday();
  const [, navigate] = useLocation();
  const profile = today?.profile;

  const TABS: { id: Tab; icon: typeof Flame; label: string }[] = [
    { id: "today",    icon: Flame,        label: "Today" },
    { id: "progress", icon: TrendingDown, label: "Progress" },
    { id: "week",     icon: Calendar,     label: "This Week" },
    { id: "tools",    icon: Wrench,       label: "Tools" },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-md mx-auto h-full flex flex-col">

        {/* ── Sticky header ──────────────────────────────────────── */}
        <div className="shrink-0 px-5 pt-6 pb-0 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 80% -10%, rgba(16,185,129,0.2) 0%, transparent 55%)" }} />

          <div className="relative flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center gap-1.5 -ml-1" style={{ color: "var(--text-sub)" }}>
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{ background: "linear-gradient(135deg,#92400e,#d97706)", boxShadow: "0 2px 8px rgba(217,119,6,0.3)" }}>
                <span style={{ fontSize: 11 }}>🪙</span>
                <span className="text-xs font-bold text-white">{profile?.coinsAvailable ?? 0}</span>
              </div>
              {(profile?.cheatDaysAvailable ?? 0) > 0 && (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.28)" }}>
                  🎉 {profile!.cheatDaysAvailable}× cheat
                </span>
              )}
            </div>
          </div>

          <div className="relative mb-4">
            <div className="flex items-center gap-2.5 mb-0.5">
              <span style={{ fontSize: 22 }}>🏋️</span>
              <p className="text-xl font-black" style={{ color: "var(--text-main)" }}>Weight Loss</p>
            </div>
            <p className="text-xs ml-0.5" style={{ color: "var(--text-sub)" }}>
              {profile
                ? `Goal: ${profile.goalWeightKg} kg · ${profile.dailyCalorieTarget} kcal/day`
                : "Coach-guided · Nigeria-first"}
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-2xl mb-1"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {TABS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition"
                style={{
                  background: tab === id ? "var(--accent)" : "transparent",
                  color: tab === id ? "#fff" : "var(--text-dim)",
                }}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable tab content ──────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-10 space-y-4">
          {tab === "today"    && <TodayTab    onNavigate={navigate} />}
          {tab === "progress" && <ProgressTab onNavigate={navigate} />}
          {tab === "week"     && <WeekTab     onNavigate={navigate} />}
          {tab === "tools"    && <ToolsTab    onNavigate={navigate} />}
        </div>

      </div>
    </div>
  );
}

// ── Today Tab ────────────────────────────────────────────────────────────────

function TodayTab({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { data: today } = useWLToday();

  if (!today) return <SkeletonCards />;

  const profile      = today.profile;
  const consumed     = today.caloriesConsumed;
  const target       = profile?.dailyCalorieTarget ?? 2000;
  const remaining    = today.caloriesRemaining;
  const pct          = Math.min(1, consumed / target);
  const r            = 48;
  const circ         = 2 * Math.PI * r;
  const offset       = circ * (1 - pct);
  const pendingCount = today.pendingAdjustments?.length ?? 0;
  const todayPlan    = today.todayPlan;
  const loggedMeals  = today.log?.meals_logged ?? [];
  const workoutDone  = (today.log?.workouts_completed?.length ?? 0) > 0;
  const workout      = todayPlan?.workout;

  return (
    <>
      {/* Calorie overview */}
      <div className="rounded-2xl p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--accent)" }}>
          Today's calories
        </p>
        <div className="flex items-center gap-5">
          {/* Ring */}
          <div className="relative shrink-0">
            <svg width={120} height={120} viewBox="0 0 120 120">
              <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth={10} />
              <circle cx={60} cy={60} r={r} fill="none"
                stroke={remaining < 0 ? "#f87171" : "var(--accent)"}
                strokeWidth={10} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-black leading-none" style={{ color: "var(--text-main)" }}>
                {consumed}
              </span>
              <span className="text-[9px] font-semibold mt-0.5" style={{ color: "var(--text-dim)" }}>kcal eaten</span>
              <span className="text-[11px] font-bold mt-0.5"
                style={{ color: remaining < 0 ? "#f87171" : "var(--accent)" }}>
                {remaining > 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
              </span>
            </div>
          </div>

          {/* Stat rows */}
          <div className="flex-1 space-y-3">
            {[
              { label: "Daily target", value: target,             showBar: false },
              { label: "Consumed",     value: consumed,           showBar: true },
              { label: "Remaining",    value: Math.abs(remaining), showBar: false,
                suffix: remaining < 0 ? " over" : " left" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-end justify-between mb-0.5">
                  <p className="text-[10px] font-semibold" style={{ color: "var(--text-dim)" }}>{s.label}</p>
                  <p className="text-sm font-black" style={{ color: "var(--text-main)" }}>
                    {s.value}
                    <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-dim)" }}>
                      {s.suffix ?? " kcal"}
                    </span>
                  </p>
                </div>
                {s.showBar && (
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--glass-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: "var(--accent)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending adjustments */}
      {pendingCount > 0 && (
        <button onClick={() => onNavigate("/weightloss/today")}
          className="w-full rounded-2xl p-4 flex items-center gap-3 transition active:scale-[0.98]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              {pendingCount} pending coach adjustment{pendingCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>Tap to review and accept</p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
        </button>
      )}

      {/* What you ate today — PRIMARY */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
            What you ate today
          </p>
          <button onClick={() => onNavigate("/weightloss/today")}
            className="text-[11px] font-bold px-3 py-1 rounded-lg transition active:scale-95"
            style={{ background: "var(--accent)", color: "#fff" }}>
            + Log meal
          </button>
        </div>

        {loggedMeals.length > 0 ? (
          loggedMeals.map((lm, i) => (
            <div key={lm.id} className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: "1px solid var(--glass-border)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "rgba(16,185,129,0.1)" }}>
                🍽️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main)" }}>{lm.name}</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>{lm.time}</p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: "var(--accent)" }}>{lm.calories} kcal</span>
            </div>
          ))
        ) : (
          <div className="px-4 pb-5 pt-1 text-center">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>Nothing logged yet today</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Log what you actually eat — not what was suggested
            </p>
          </div>
        )}
      </div>

      {/* Suggested meals — SECONDARY reference */}
      {todayPlan && todayPlan.meals.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                Suggested meals
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                Guide only — log what you actually eat
              </p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg"
              style={{ background: "var(--bg-base)", color: "var(--text-dim)" }}>
              {todayPlan.totalCalories} kcal
            </span>
          </div>
          {todayPlan.meals.map((meal, i) => {
            const slot = SLOT_META[meal.slot] ?? { emoji: "🍽️", label: meal.slot };
            return (
              <div key={meal.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: "1px solid var(--glass-border)", opacity: 0.75 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: "var(--bg-base)" }}>
                  {slot.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-main)" }}>{meal.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>{slot.label} · {meal.calories} kcal</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Workout card */}
      {workout && (
        <button onClick={() => onNavigate("/weightloss/today")}
          className="w-full rounded-2xl p-4 text-left transition active:scale-[0.98]"
          style={{
            background: workoutDone ? "rgba(16,185,129,0.08)" : "var(--glass-bg)",
            border: workoutDone ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--glass-border)",
          }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: workoutDone ? "var(--accent)" : "var(--text-dim)" }}>
              {workoutDone ? "✓ Workout done" : "Workout"}
            </p>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
          </div>
          {workout.isRestDay ? (
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 26 }}>😴</span>
              <div>
                <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>Rest Day</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>Recovery is part of the plan</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 26 }}>🏋️</span>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>{workout.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {workout.duration_mins} min · {workout.exercises.length} exercises
                </p>
              </div>
            </div>
          )}
        </button>
      )}
    </>
  );
}

// ── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { data } = useWLProgress();

  if (!data || data.noProfile) {
    return (
      <div className="rounded-2xl p-8 text-center"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>📊</p>
        <p className="font-bold text-base mb-2" style={{ color: "var(--text-main)" }}>No data yet</p>
        <p className="text-sm" style={{ color: "var(--text-sub)" }}>
          Log your weight and meals to see progress here.
        </p>
      </div>
    );
  }

  const { profile, weightEntries, kgLost, avgMealAdherence, avgWorkoutAdherence, recentAdjustments } = data;
  const currentWeight = weightEntries[0]?.weight ?? profile.currentWeightKg;
  const startWeight   = weightEntries[weightEntries.length - 1]?.weight ?? profile.currentWeightKg;
  const toGoKg        = Math.max(0, currentWeight - profile.goalWeightKg);
  const totalRange    = profile.currentWeightKg - profile.goalWeightKg;
  const progressPct   = totalRange > 0
    ? Math.min(100, Math.round(((startWeight - currentWeight) / totalRange) * 100))
    : 0;

  return (
    <>
      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Current", value: `${currentWeight}`, unit: "kg" },
          { label: "Goal",    value: `${profile.goalWeightKg}`, unit: "kg" },
          { label: "Lost",    value: kgLost != null ? `${kgLost.toFixed(1)}` : "—", unit: kgLost != null ? "kg" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-3 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>{s.label}</p>
            <p className="text-xl font-black" style={{ color: "var(--text-main)" }}>{s.value}</p>
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>{s.unit}</p>
          </div>
        ))}
      </div>

      {/* Progress to goal */}
      <div className="rounded-2xl p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
            Progress to goal
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{progressPct}%</p>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--glass-border)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: "var(--accent)", boxShadow: "0 0 8px rgba(16,185,129,0.45)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          {toGoKg.toFixed(1)} kg to go · started at {startWeight} kg
        </p>
      </div>

      {/* Adherence */}
      <div className="rounded-2xl p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-dim)" }}>
          Adherence
        </p>
        <div className="space-y-4">
          {[
            { label: "Meal plan", pct: avgMealAdherence,    icon: "🍽️" },
            { label: "Workouts",  pct: avgWorkoutAdherence, icon: "🏋️" },
          ].map((a) => {
            const color = a.pct != null && a.pct >= 80 ? "#4ade80"
                        : a.pct != null && a.pct >= 50 ? "#fbbf24"
                        : "#f87171";
            return (
              <div key={a.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>{a.icon}</span>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{a.label}</p>
                  </div>
                  <p className="text-sm font-black" style={{ color }}>
                    {a.pct != null ? `${a.pct}%` : "—"}
                  </p>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${a.pct ?? 0}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rewards */}
      <div className="rounded-2xl p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>
          Rewards earned
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 text-center"
            style={{ background: "linear-gradient(135deg,rgba(146,64,14,0.4),rgba(217,119,6,0.2))", border: "1px solid rgba(217,119,6,0.3)" }}>
            <span style={{ fontSize: 26 }}>🪙</span>
            <p className="text-2xl font-black mt-1" style={{ color: "#fbbf24" }}>{profile.totalCoinsEarned}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>Total coins</p>
          </div>
          <div className="rounded-xl p-4 text-center"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)" }}>
            <span style={{ fontSize: 26 }}>🎉</span>
            <p className="text-2xl font-black mt-1" style={{ color: "var(--accent)" }}>{profile.cheatDaysAvailable}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(16,185,129,0.7)" }}>Cheat days</p>
          </div>
        </div>
      </div>

      {/* Weigh-in history */}
      {weightEntries.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              Weigh-in history
            </p>
          </div>
          {weightEntries.slice(0, 6).map((entry, i) => {
            const prev    = weightEntries[i + 1];
            const diff    = prev ? entry.weight - prev.weight : null;
            const dateStr = new Date(entry.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            return (
              <div key={entry.date} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: "1px solid var(--glass-border)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ background: "var(--bg-base)" }}>
                  ⚖️
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{entry.weight} kg</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>{dateStr}</p>
                </div>
                {diff != null
                  ? <span className="text-xs font-bold shrink-0"
                      style={{ color: diff < 0 ? "#4ade80" : diff > 0 ? "#f87171" : "var(--text-dim)" }}>
                      {diff < 0 ? "↓" : diff > 0 ? "↑" : "="} {Math.abs(diff).toFixed(1)} kg
                    </span>
                  : <span className="text-xs" style={{ color: "var(--text-dim)" }}>start</span>
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Coach notes */}
      {recentAdjustments.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              Coach notes
            </p>
          </div>
          {recentAdjustments.slice(0, 3).map((adj) => (
            <div key={adj.id} className="px-4 py-3 flex gap-3"
              style={{ borderTop: "1px solid var(--glass-border)" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{adj.type === "reward" ? "🏆" : "⚡"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold mb-0.5"
                  style={{ color: adj.type === "reward" ? "#fbbf24" : "#f87171" }}>
                  {adj.type === "reward" ? "Reward" : "Adjustment"}
                </p>
                <p className="text-sm leading-snug" style={{ color: "var(--text-sub)" }}>{adj.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Week Tab ─────────────────────────────────────────────────────────────────

function WeekTab({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { data: planData, isLoading } = useWLPlan();
  const plan      = planData?.plan;
  const todayStr  = new Date().toISOString().split("T")[0]!;
  const todayIdx  = plan ? Math.max(0, plan.days.findIndex((d) => d.date === todayStr)) : 0;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const dayIdx = selectedDay ?? todayIdx;
  const day    = plan?.days[dayIdx];

  if (isLoading) return <SkeletonCards />;

  if (!plan) {
    return (
      <div className="rounded-2xl p-8 text-center"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>📅</p>
        <p className="font-bold text-base mb-2" style={{ color: "var(--text-main)" }}>No suggestions yet</p>
        <p className="text-sm mb-4" style={{ color: "var(--text-sub)" }}>
          Generate a plan from the Tools tab to see weekly meal suggestions here.
        </p>
        <button onClick={() => onNavigate("/weightloss")}
          className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          Go to Tools →
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Day selector strip */}
      <div className="rounded-2xl p-3"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex gap-1.5">
          {plan.days.map((d, i) => {
            const isToday    = d.date === todayStr;
            const isSelected = i === dayIdx;
            const dateNum    = new Date(d.date + "T12:00:00").getDate();
            return (
              <button key={d.date} onClick={() => setSelectedDay(i)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition"
                style={{
                  background: isSelected ? "var(--accent)" : isToday ? "rgba(16,185,129,0.08)" : "transparent",
                  border: isToday && !isSelected ? "1px solid rgba(16,185,129,0.28)" : "1px solid transparent",
                }}>
                <span className="text-[9px] font-bold"
                  style={{ color: isSelected ? "rgba(255,255,255,0.65)" : "var(--text-dim)" }}>
                  {DAY_CHARS[i]}
                </span>
                <span className="text-xs font-black"
                  style={{ color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--text-main)" }}>
                  {dateNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day heading */}
      {day && (
        <div className="flex items-center justify-between">
          <p className="text-base font-black" style={{ color: "var(--text-main)" }}>
            {day.dayLabel}
            {day.date === todayStr && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "var(--accent)" }}>
                Today
              </span>
            )}
          </p>
          <p className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            {day.totalCalories} kcal
          </p>
        </div>
      )}

      {/* Suggested meals */}
      {day && day.meals.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>Suggested meals</p>
            <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>{day.totalCalories} kcal</p>
          </div>
          {day.meals.map((meal, i) => {
            const slot = SLOT_META[meal.slot] ?? { emoji: "🍽️", label: meal.slot };
            return (
              <div key={meal.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: "1px solid var(--glass-border)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: "var(--bg-base)" }}>
                  {slot.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main)" }}>{meal.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {slot.label} · {meal.protein_g}g protein · {meal.carbs_g}g carbs
                  </p>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-dim)" }}>{meal.calories}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Workout */}
      {day?.workout && (
        <div className="rounded-2xl p-4"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>
            Workout
          </p>
          {day.workout.isRestDay ? (
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 28 }}>😴</span>
              <div>
                <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>Rest Day</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>Recovery is part of the plan</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span style={{ fontSize: 24 }}>🏋️</span>
                <div className="flex-1">
                  <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>{day.workout.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {day.workout.duration_mins} min · {day.workout.exercises.length} exercises
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {day.workout.exercises.slice(0, 4).map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                    <p className="text-xs" style={{ color: "var(--text-sub)" }}>
                      {ex.name} · {ex.sets}×{ex.reps}
                    </p>
                  </div>
                ))}
                {day.workout.exercises.length > 4 && (
                  <p className="text-xs pl-3.5" style={{ color: "var(--text-dim)" }}>
                    +{day.workout.exercises.length - 4} more exercises
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Full plan link */}
      <button onClick={() => onNavigate("/weightloss/plan")}
        className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--accent)" }}>
        <Calendar className="w-4 h-4" />
        View full weekly plan
        <ChevronRight className="w-4 h-4" />
      </button>
    </>
  );
}

// ── Tools Tab ─────────────────────────────────────────────────────────────────

function ToolsTab({ onNavigate }: { onNavigate: (p: string) => void }) {
  const generatePlan = useWLGeneratePlan();

  const tools = [
    {
      icon: "💬", label: "Coach Chat",
      sub: "Ask about meals, adjustments, or motivation",
      color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)",
      cta: "Open", href: "/weightloss/coach",
    },
    {
      icon: "🧮", label: "Calorie Calculator",
      sub: "Describe any food to get instant calorie counts",
      color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.25)",
      cta: "Calculate", href: "/weightloss/calculator",
    },
    {
      icon: "📅", label: "Full Weekly Plan",
      sub: "Your detailed 7-day meal and workout schedule",
      color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)",
      cta: "View", href: "/weightloss/plan",
    },
    {
      icon: "📊", label: "Progress Details",
      sub: "Full weight log, adherence history and adjustments",
      color: "#14b8a6", bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.25)",
      cta: "View", href: "/weightloss/progress",
    },
  ];

  return (
    <>
      <div className="space-y-3">
        {tools.map((t) => (
          <button key={t.href} onClick={() => onNavigate(t.href)}
            className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition active:scale-[0.98]"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: t.bg, border: `1px solid ${t.border}` }}>
              {t.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{t.label}</p>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-dim)" }}>{t.sub}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs font-semibold" style={{ color: t.color }}>{t.cta}</span>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: t.color }} />
            </div>
          </button>
        ))}
      </div>

      {/* Regenerate plan */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-dim)" }}>
          Plan management
        </p>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-sub)" }}>
          Not happy with your current plan? Generate a fresh 7-day schedule based on your settings and current progress.
        </p>
        <button
          onClick={() => generatePlan.mutate(undefined)}
          disabled={generatePlan.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: "var(--accent)" }}>
          <RefreshCw className={`w-4 h-4 ${generatePlan.isPending ? "animate-spin" : ""}`} />
          {generatePlan.isPending ? "Generating…" : "Regenerate plan"}
        </button>
        {generatePlan.isSuccess && (
          <p className="text-xs mt-2 font-semibold" style={{ color: "var(--accent)" }}>
            Done — switch to the This Week tab to see it.
          </p>
        )}
      </div>
    </>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[100, 72, 140].map((h) => (
        <div key={h} className="rounded-2xl animate-pulse" style={{ height: h, background: "var(--glass-bg)" }} />
      ))}
    </div>
  );
}
