import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS = [
  { value: 1, emoji: "😫", label: "Terrible" },
  { value: 2, emoji: "😞", label: "Poor" },
  { value: 3, emoji: "😐", label: "OK" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function diffHours(bed: string, wake: string): string {
  const [bH, bM] = bed.split(":").map(Number);
  const [wH, wM] = wake.split(":").map(Number);
  let mins = (wH * 60 + wM) - (bH * 60 + bM);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function SleepPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: {
      modules: {
        sleep: {
          enabled: boolean;
          settings: { bedtimeTarget?: string; wakeTarget?: string; notes?: string };
          log: { bedtime?: string; wakeTime?: string; quality?: number } | null;
        };
      };
    } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("sleep");
  const { data: streakData } = useWellnessStreak("sleep");
  const saveModule = useSaveModule("sleep");
  const logToday = useLogToday("sleep");

  const module = today?.modules.sleep;
  const enabled = module?.enabled ?? false;
  const settings = module?.settings ?? {};
  const log = module?.log;
  const streak = streakData?.streak ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [bedtimeTarget, setBedtimeTarget] = useState(settings.bedtimeTarget ?? "22:30");
  const [wakeTarget, setWakeTarget] = useState(settings.wakeTarget ?? "06:30");
  const [notes, setNotes] = useState(settings.notes ?? "");

  const [logBedtime, setLogBedtime] = useState(log?.bedtime ?? settings.bedtimeTarget ?? "22:30");
  const [logWake, setLogWake] = useState(log?.wakeTime ?? settings.wakeTarget ?? "06:30");
  const [logQuality, setLogQuality] = useState(log?.quality ?? 0);

  const hasLog = !!(log?.bedtime && log?.wakeTime && log?.quality);

  function saveSetup() {
    saveModule.mutate({ settings: { bedtimeTarget, wakeTarget, notes }, enabled: true });
    setSetupMode(false);
  }

  function saveLog() {
    logToday.mutate({ bedtime: logBedtime, wakeTime: logWake, quality: logQuality });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => (setupMode ? setSetupMode(false) : window.history.back())}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl">😴</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sleep Tracker</h1>
            <p className="text-sm text-muted-foreground">Set your sleep targets</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
            <p className="text-sm font-semibold text-foreground mb-4">Bedtime target</p>
            <input type="time" value={bedtimeTarget} onChange={(e) => setBedtimeTarget(e.target.value)}
              className="w-full min-w-0 bg-muted rounded-xl px-4 py-3 text-2xl font-bold text-foreground text-center outline-none" />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
            <p className="text-sm font-semibold text-foreground mb-4">Wake time target</p>
            <input type="time" value={wakeTarget} onChange={(e) => setWakeTarget(e.target.value)}
              className="w-full min-w-0 bg-muted rounded-xl px-4 py-3 text-2xl font-bold text-foreground text-center outline-none" />
          </div>

          <div className="bg-muted rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              Target sleep: <strong className="text-foreground">{diffHours(bedtimeTarget, wakeTarget)}</strong>
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
            <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I usually read before bed", "I nap at 2pm"</p>
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
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">😴</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sleep Tracker</h1>
            <p className="text-xs text-muted-foreground">
              Target: {settings.bedtimeTarget} → {settings.wakeTarget} ({diffHours(settings.bedtimeTarget ?? "22:30", settings.wakeTarget ?? "06:30")})
            </p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Log last night */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5 overflow-hidden">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {hasLog ? "Last night (logged)" : "Log last night"}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1.5">I went to bed</p>
            <input type="time" value={logBedtime} onChange={(e) => setLogBedtime(e.target.value)}
              className="w-full min-w-0 bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1.5">I woke up</p>
            <input type="time" value={logWake} onChange={(e) => setLogWake(e.target.value)}
              className="w-full min-w-0 bg-muted rounded-xl px-3 py-2.5 text-base font-bold text-foreground text-center outline-none" />
          </div>
        </div>

        <div className="bg-muted rounded-xl px-4 py-2 text-center mb-4">
          <span className="text-sm font-semibold text-foreground">{diffHours(logBedtime, logWake)} slept</span>
        </div>

        <p className="text-xs text-muted-foreground mb-2">How was your sleep quality?</p>
        <div className="flex gap-2 mb-4">
          {QUALITY_OPTIONS.map((q) => (
            <button key={q.value} onClick={() => setLogQuality(q.value)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition",
                logQuality === q.value ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
              )}>
              <span className="text-xl">{q.emoji}</span>
              <span className="text-[9px] text-muted-foreground">{q.label}</span>
            </button>
          ))}
        </div>

        <button onClick={saveLog} disabled={logQuality === 0 || logToday.isPending}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition active:scale-95 disabled:opacity-60">
          {logToday.isPending ? "Saving…" : hasLog ? "Update log" : "Log sleep"}
        </button>
      </div>

      {/* This week */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const logEntry = weekLogs?.find((l) => l.log_date === dateStr);
            const q = logEntry?.data.quality as number | undefined;
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  isToday ? "ring-2 ring-primary" : "",
                  q ? "bg-primary/20" : "bg-muted"
                )}>
                  <span className="text-sm">
                    {q ? QUALITY_OPTIONS[q - 1].emoji : "—"}
                  </span>
                </div>
                {!!logEntry?.data.bedtime && (
                  <span className="text-[8px] text-muted-foreground">
                    {diffHours(logEntry.data.bedtime as string, logEntry.data.wakeTime as string)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit targets
      </button>
    </div>
  );
}
