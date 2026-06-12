import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Minus, Droplets, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WaterPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: { modules: { water: { enabled: boolean; settings: { target?: number; reminderTimes?: string[] }; log: { cups?: number } | null } } } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("water");
  const { data: streakData } = useWellnessStreak("water");
  const saveModule = useSaveModule("water");
  const logToday = useLogToday("water");

  const module = today?.modules.water;
  const settings = module?.settings ?? {};
  const target = settings.target ?? 8;
  const currentCups = (module?.log?.cups as number | undefined) ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [localTarget, setLocalTarget] = useState(target);
  const [reminderTimes, setReminderTimes] = useState<string[]>(settings.reminderTimes ?? ["09:00", "13:00", "17:00"]);
  const [newTime, setNewTime] = useState("09:00");

  const enabled = module?.enabled ?? false;
  const streak = streakData?.streak ?? 0;

  function addCup() {
    logToday.mutate({ cups: Math.min(currentCups + 1, 20) });
  }

  function removeCup() {
    if (currentCups === 0) return;
    logToday.mutate({ cups: currentCups - 1 });
  }

  function saveSetup() {
    saveModule.mutate({ settings: { target: localTarget, reminderTimes }, enabled: true });
    setSetupMode(false);
  }

  function addReminder() {
    if (!reminderTimes.includes(newTime)) {
      setReminderTimes((p) => [...p, newTime].sort());
    }
  }

  function removeReminder(t: string) {
    setReminderTimes((p) => p.filter((x) => x !== t));
  }

  const pct = Math.min(100, Math.round((currentCups / target) * 100));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => (setupMode ? setSetupMode(false) : navigate("/wellness"))}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
            💧
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Water Intake</h1>
            <p className="text-sm text-muted-foreground">Set your daily hydration goal</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Target cups */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Daily target (cups)</p>
            <div className="flex items-center justify-between">
              <button onClick={() => setLocalTarget((p) => Math.max(1, p - 1))}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{localTarget}</p>
                <p className="text-xs text-muted-foreground mt-1">≈ {Math.round(localTarget * 250)}ml / day</p>
              </div>
              <button onClick={() => setLocalTarget((p) => Math.min(20, p + 1))}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reminders */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Reminder times</p>
            <div className="flex gap-2 mb-3">
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground border-0 outline-none" />
              <button onClick={addReminder}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {reminderTimes.map((t) => (
                <button key={t} onClick={() => removeReminder(t)}
                  className="flex items-center gap-1 bg-muted text-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
                  {t}
                  <span className="text-muted-foreground ml-1">×</span>
                </button>
              ))}
            </div>
            {reminderTimes.length === 0 && (
              <p className="text-xs text-muted-foreground">No reminders set</p>
            )}
          </div>

          <button onClick={saveSetup} disabled={saveModule.isPending}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
            {saveModule.isPending ? "Saving…" : "Save & Start Tracking"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")}
        className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💧</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Water Intake</h1>
            <p className="text-xs text-muted-foreground">Target: {target} cups/day</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Progress ring */}
      <div className="bg-card border border-border rounded-3xl p-6 mb-5 flex flex-col items-center">
        <div className="relative w-40 h-40 mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
              strokeLinecap="round" className="text-primary transition-all duration-500"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold text-foreground">{currentCups}</p>
            <p className="text-xs text-muted-foreground">of {target} cups</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button onClick={removeCup} disabled={currentCups === 0 || logToday.isPending}
            className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center active:scale-95 transition disabled:opacity-40">
            <Minus className="w-6 h-6 text-foreground" />
          </button>
          <button onClick={addCup} disabled={logToday.isPending}
            className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center active:scale-95 transition shadow-lg shadow-primary/30">
            <Droplets className="w-9 h-9 text-primary-foreground" />
          </button>
          <div className="w-14 h-14" /> {/* spacer */}
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          {pct >= 100
            ? "Goal reached! 🎉"
            : `${target - currentCups} more ${target - currentCups === 1 ? "cup" : "cups"} to go`}
        </p>
      </div>

      {/* Cup dots visual */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: target }, (_, i) => (
            <div key={i} className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm transition",
              i < currentCups ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              💧
            </div>
          ))}
        </div>
      </div>

      {/* This week */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const log = weekLogs?.find((l) => l.log_date === dateStr);
            const cups = (log?.data.cups as number | undefined) ?? 0;
            const done = cups >= target;
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border-2",
                  done ? "bg-primary/20 border-primary text-primary" : isToday ? "border-primary/50 text-foreground" : "border-transparent bg-muted text-muted-foreground"
                )}>
                  {cups > 0 ? cups : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
    </div>
  );
}
