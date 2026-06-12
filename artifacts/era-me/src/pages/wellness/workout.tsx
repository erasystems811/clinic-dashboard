import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

type DayKey = typeof DAYS[number]["key"];

const FOCUS_OPTIONS = [
  "Full body", "Upper body", "Lower body", "Core", "Cardio", "Yoga / Flexibility",
  "HIIT", "Swimming", "Cycling", "Running", "Rest / Recovery", "Custom",
];

interface DayPlan {
  enabled: boolean;
  time?: string;
  focus?: string;
  notes?: string;
}

type DaySettings = Record<DayKey, DayPlan>;

function emptyDays(): DaySettings {
  return Object.fromEntries(DAYS.map((d) => [d.key, { enabled: false }])) as DaySettings;
}

export default function WorkoutPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: {
      date: string;
      dayKey: string;
      modules: {
        workout: {
          enabled: boolean;
          settings: { days?: DaySettings };
          log: { completed?: boolean; notes?: string } | null;
          todayPlan: DayPlan | null;
        };
      };
    } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("workout");
  const { data: streakData } = useWellnessStreak("workout");
  const saveModule = useSaveModule("workout");
  const logToday = useLogToday("workout");

  const module = today?.modules.workout;
  const enabled = module?.enabled ?? false;
  const daySettings: DaySettings = module?.settings?.days ?? emptyDays();
  const todayPlan = module?.todayPlan;
  const completed = module?.log?.completed ?? false;
  const streak = streakData?.streak ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [localDays, setLocalDays] = useState<DaySettings>(daySettings);
  const [activeDay, setActiveDay] = useState<DayKey>("mon");

  function toggleDay(key: DayKey) {
    setLocalDays((p) => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }));
  }

  function updateDay(key: DayKey, field: keyof DayPlan, value: string | boolean) {
    setLocalDays((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  }

  function saveSetup() {
    saveModule.mutate({ settings: { days: localDays }, enabled: Object.values(localDays).some((d) => d.enabled) });
    setSetupMode(false);
  }

  function logWorkout(c: boolean) {
    logToday.mutate({ completed: c });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled || setupMode) {
    const activeDayPlan = localDays[activeDay];
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => (setupMode ? setSetupMode(false) : navigate("/wellness"))}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl">🏃</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Workout Tracker</h1>
            <p className="text-sm text-muted-foreground">Set up your weekly workout plan</p>
          </div>
        </div>

        {/* Day toggles */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active workout days</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => (
              <button key={d.key} onClick={() => toggleDay(d.key)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl transition",
                  localDays[d.key].enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                <span className="text-[10px] font-bold">{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Day detail editor */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Edit day details</p>
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {DAYS.filter((d) => localDays[d.key].enabled).map((d) => (
              <button key={d.key} onClick={() => setActiveDay(d.key)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition",
                  activeDay === d.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                {d.label}
              </button>
            ))}
          </div>

          {localDays[activeDay]?.enabled ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Time</p>
                <input type="time" value={activeDayPlan.time ?? "07:00"}
                  onChange={(e) => updateDay(activeDay, "time", e.target.value)}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Focus</p>
                <div className="flex flex-wrap gap-1.5">
                  {FOCUS_OPTIONS.map((f) => (
                    <button key={f} onClick={() => updateDay(activeDay, "focus", f)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-semibold transition",
                        activeDayPlan.focus === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Notes (optional)</p>
                <textarea value={activeDayPlan.notes ?? ""} rows={2}
                  onChange={(e) => updateDay(activeDay, "notes", e.target.value)}
                  placeholder="e.g. 30 min run + 10 min stretch"
                  className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Enable a day above to edit its plan.</p>
          )}
        </div>

        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Save workout plan"}
        </button>
      </div>
    );
  }

  const todayDayKey = today?.dayKey as DayKey | undefined;
  const isWorkoutDay = todayPlan != null;

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏃</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Workout Tracker</h1>
            <p className="text-xs text-muted-foreground">Your weekly plan</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Today card */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
        {isWorkoutDay ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                {todayPlan.focus && <p className="font-semibold text-foreground">{todayPlan.focus}</p>}
                {todayPlan.time && <p className="text-xs text-muted-foreground">{todayPlan.time}</p>}
                {todayPlan.notes && <p className="text-xs text-muted-foreground mt-1">{todayPlan.notes}</p>}
              </div>
              {completed && <Check className="w-6 h-6 text-green-500 shrink-0" />}
            </div>
            <div className="flex gap-3">
              <button onClick={() => logWorkout(true)} disabled={logToday.isPending}
                className={cn(
                  "flex-1 py-3 rounded-xl font-semibold text-sm transition active:scale-95",
                  completed ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground"
                )}>
                {completed ? "Completed ✓" : "Mark complete"}
              </button>
              {completed && (
                <button onClick={() => logWorkout(false)} disabled={logToday.isPending}
                  className="px-4 py-3 rounded-xl bg-muted text-muted-foreground text-sm font-semibold">
                  Undo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-2xl mb-2">😌</p>
            <p className="font-semibold text-foreground">Rest day</p>
            <p className="text-xs text-muted-foreground mt-1">No workout scheduled for today. Recovery matters!</p>
          </div>
        )}
      </div>

      {/* Weekly calendar */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="space-y-2">
          {DAYS.map((d) => {
            const plan = daySettings[d.key];
            const isToday = d.key === todayDayKey;

            // Find log for this day
            const now = new Date();
            const dayIndex = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(d.key);
            const diff = dayIndex - now.getDay();
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + diff - (diff > 0 ? 7 : 0));
            const dateStr = targetDate.toISOString().split("T")[0];
            const log = weekLogs?.find((l) => l.log_date === dateStr);
            const dayCompleted = log?.data.completed === true;

            return (
              <div key={d.key} className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                isToday ? "bg-primary/10 border border-primary/20" : ""
              )}>
                <span className={cn("text-xs font-semibold w-7", isToday ? "text-primary" : "text-muted-foreground")}>{d.label}</span>
                {plan.enabled ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", isToday ? "text-foreground" : "text-foreground/80")}>
                        {plan.focus ?? "Workout"}
                      </p>
                      {plan.time && <p className="text-xs text-muted-foreground">{plan.time}</p>}
                    </div>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center",
                      dayCompleted ? "bg-green-100 dark:bg-green-900/30" : "bg-muted")}>
                      {dayCompleted && <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Rest</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => { setLocalDays(daySettings); setSetupMode(true); }}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit weekly plan
      </button>
    </div>
  );
}
