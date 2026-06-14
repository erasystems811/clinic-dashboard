import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OutdoorsPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { targetMinutes?: number; reminderTime?: string; notes?: string }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("outdoors");
  const saveModule = useSaveModule("outdoors");
  const logToday = useLogToday("outdoors");

  const mod = modules?.outdoors;
  const settings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;
  const target = settings.targetMinutes ?? 30;

  const [setupMode, setSetupMode] = useState(false);
  const [localTarget, setLocalTarget] = useState(target);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime ?? "07:00");
  const [notes, setNotes] = useState(settings.notes ?? "");

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const minutes = (todayLog?.data.minutes as number | undefined) ?? 0;
  const pct = Math.min(100, Math.round((minutes / target) * 100));

  function saveSetup() {
    saveModule.mutate({ settings: { targetMinutes: localTarget, reminderTime, notes }, enabled: true });
    setSetupMode(false);
  }

  function adjustMinutes(delta: number) {
    const newVal = Math.max(0, minutes + delta);
    logToday.mutate({ minutes: newVal });
  }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : window.history.back()}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">🌿</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Outdoor Time</h1>
            <p className="text-sm text-muted-foreground">Daily sunlight & fresh air</p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Daily target (minutes)</p>
            <div className="flex items-center justify-between">
              <button onClick={() => setLocalTarget((p) => Math.max(5, p - 5))}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{localTarget}</p>
                <p className="text-xs text-muted-foreground mt-1">minutes</p>
              </div>
              <button onClick={() => setLocalTarget((p) => Math.min(240, p + 5))}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
            <p className="text-sm font-semibold text-foreground mb-3">Reminder time</p>
            <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
              className="w-full min-w-0 bg-muted rounded-xl px-4 py-3 text-2xl font-bold text-foreground text-center outline-none" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
            <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I walk in the evenings", "I prefer mornings before work"</p>
            <textarea value={notes} rows={3} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything that helps us plan better for you..."
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
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
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🌿</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Outdoor Time</h1>
          <p className="text-xs text-muted-foreground">Target: {target} min/day</p>
        </div>
      </div>

      {/* Today */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today</p>
          <span className={cn("text-xs font-semibold px-2 py-1 rounded-full",
            pct >= 100 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-muted rounded-full mb-4 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", pct >= 100 ? "bg-green-500" : "bg-primary")}
            style={{ width: `${pct}%` }} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => adjustMinutes(-5)} disabled={minutes === 0 || logToday.isPending}
            className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition disabled:opacity-40">
            <Minus className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-4xl font-bold text-foreground">{minutes}</p>
            <p className="text-xs text-muted-foreground">of {target} min</p>
          </div>
          <button onClick={() => adjustMinutes(5)} disabled={logToday.isPending}
            className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center active:scale-95 transition shadow-lg shadow-primary/30">
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {pct >= 100 ? "Goal reached! 🎉" : `${target - minutes} more minutes to go`}
        </p>
      </div>

      {/* This week */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const log = weekLogs?.find((l) => l.log_date === dateStr);
            const mins = (log?.data.minutes as number | undefined) ?? 0;
            const done = mins >= target;
            const isToday = dateStr === today;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border-2",
                  done ? "bg-primary/20 border-primary text-primary" : isToday ? "border-primary/50 text-foreground" : "border-transparent bg-muted text-muted-foreground")}>
                  {mins > 0 ? mins : "—"}
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

function Spinner() {
  return <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
