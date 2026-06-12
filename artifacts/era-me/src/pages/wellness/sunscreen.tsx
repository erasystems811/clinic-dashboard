import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SunscreenPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { reminderTime?: string }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("sunscreen");
  const saveModule = useSaveModule("sunscreen");
  const logToday = useLogToday("sunscreen");

  const mod = modules?.sunscreen;
  const settings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const [setupMode, setSetupMode] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime ?? "08:00");

  const today = new Date().toISOString().split("T")[0];
  const done = weekLogs?.find((l) => l.log_date === today)?.data.done === true;

  function saveSetup() {
    saveModule.mutate({ settings: { reminderTime }, enabled: true });
    setSetupMode(false);
  }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-2xl">☀️</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sunscreen Reminder</h1>
            <p className="text-sm text-muted-foreground">Daily skin protection</p>
          </div>
        </div>
        <div className="bg-muted rounded-2xl p-4 mb-5">
          <p className="text-sm text-muted-foreground">Daily sunscreen use protects against UV damage and skin ageing. Apply before leaving the house every morning.</p>
        </div>
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Morning reminder time</p>
          <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
            className="w-full bg-muted rounded-xl px-4 py-3 text-2xl font-bold text-foreground text-center outline-none" />
        </div>
        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Enable sunscreen reminder"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">☀️</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sunscreen</h1>
            <p className="text-xs text-muted-foreground">Reminder at {settings.reminderTime}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col items-center">
        <div className="text-7xl mb-4">{done ? "✅" : "☀️"}</div>
        <p className="text-lg font-bold text-foreground mb-1">{done ? "Applied today!" : "Applied sunscreen today?"}</p>
        <p className="text-sm text-muted-foreground mb-5 text-center">Tap once you've applied your sunscreen this morning.</p>
        <button onClick={() => logToday.mutate({ done: !done })} disabled={logToday.isPending}
          className={cn("w-full py-4 rounded-2xl font-bold text-base transition active:scale-95 flex items-center justify-center gap-2",
            done ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground shadow-lg shadow-primary/30")}>
          {done && <Check className="w-5 h-5" />}
          {logToday.isPending ? "Saving…" : done ? "Mark as not done" : "Yes, applied!"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const wasDone = weekLogs?.find((l) => l.log_date === dateStr)?.data.done === true;
            const isToday = dateStr === today;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm",
                  isToday ? "ring-2 ring-primary" : "", wasDone ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted text-muted-foreground")}>
                  {wasDone ? "☀️" : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit reminder time
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
