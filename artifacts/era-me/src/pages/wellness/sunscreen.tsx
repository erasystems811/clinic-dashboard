import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_TIMES = ["07:00", "12:00", "16:00", "18:00", "20:00", "08:00", "10:00", "14:00"];

function buildTimes(count: number, existing: string[]): string[] {
  return Array.from({ length: count }, (_, i) => existing[i] ?? DEFAULT_TIMES[i] ?? "08:00");
}

export default function SunscreenPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { reminderTimes?: string[]; target?: number; notes?: string }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("sunscreen");
  const saveModule = useSaveModule("sunscreen");
  const logToday = useLogToday("sunscreen");

  const mod = modules?.sunscreen;
  const settings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;
  const target = settings.target ?? 2;

  const [setupMode, setSetupMode] = useState(false);
  const [targetInput, setTargetInput] = useState(target);
  const [reminderTimes, setReminderTimes] = useState<string[]>(
    settings.reminderTimes?.length ? settings.reminderTimes : buildTimes(target, [])
  );
  const [notes, setNotes] = useState(settings.notes ?? "");

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const count: number = (todayLog?.data.count as number) ?? 0;
  const done = count >= target;

  function changeTarget(n: number) {
    const clamped = Math.max(1, Math.min(8, n));
    setTargetInput(clamped);
    setReminderTimes((prev) => buildTimes(clamped, prev));
  }

  function setTime(index: number, val: string) {
    setReminderTimes((prev) => prev.map((t, i) => (i === index ? val : t)));
  }

  function saveSetup() {
    saveModule.mutate({ settings: { reminderTimes, target: targetInput, notes }, enabled: true });
    setSetupMode(false);
  }

  function addApplication() { logToday.mutate({ count: count + 1 }); }
  function removeApplication() { if (count > 0) logToday.mutate({ count: count - 1 }); }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : window.history.back()}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-2xl">☀️</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sunscreen</h1>
            <p className="text-sm text-muted-foreground">Daily skin protection</p>
          </div>
        </div>
        <div className="bg-muted rounded-2xl p-4 mb-5">
          <p className="text-sm text-muted-foreground">Sunscreen wears off every 2–3 hours. Set a time for each planned application so ERA can remind you.</p>
        </div>

        {/* Application count */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How many times per day?</p>
          <div className="flex items-center gap-4">
            <button onClick={() => changeTarget(targetInput - 1)}
              className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center active:scale-90 transition">
              <Minus className="w-5 h-5 text-foreground" />
            </button>
            <span className="text-3xl font-black text-foreground w-10 text-center">{targetInput}</span>
            <button onClick={() => changeTarget(targetInput + 1)}
              className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* One time picker per application */}
        <div className="mb-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Application times</p>
          {reminderTimes.map((t, i) => (
            <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-sm font-black text-yellow-700 dark:text-yellow-300 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Application {i + 1}</p>
                <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)}
                  className="w-full bg-transparent text-lg font-bold text-foreground outline-none" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "SPF 50+ on face, SPF 30 on body"'
            className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
        </div>

        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Enable sunscreen tracking"}
        </button>
      </div>
    );
  }

  // Dashboard
  const displayTimes = settings.reminderTimes ?? [];

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">☀️</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sunscreen</h1>
            <p className="text-xs text-muted-foreground">Goal: {target}× per day</p>
          </div>
        </div>
      </div>

      {/* Application times */}
      {displayTimes.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your schedule</p>
          <div className="grid grid-cols-2 gap-2">
            {displayTimes.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-[10px] font-black text-yellow-700 dark:text-yellow-300 shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm font-semibold text-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col items-center">
        <p className="text-sm font-semibold text-muted-foreground mb-4">Today's applications</p>
        <div className="flex items-center gap-6 mb-5">
          <button onClick={removeApplication} disabled={count === 0 || logToday.isPending}
            className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center active:scale-90 transition disabled:opacity-40">
            <Minus className="w-6 h-6 text-foreground" />
          </button>
          <div className="text-center">
            <p className="text-6xl font-black" style={{ color: done ? "#4ade80" : "var(--accent)" }}>{count}</p>
            <p className="text-sm text-muted-foreground mt-1">of {target}</p>
          </div>
          <button onClick={addApplication} disabled={logToday.isPending}
            className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition shadow-lg shadow-primary/30">
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Application slots */}
        {displayTimes.length > 0 && (
          <div className="w-full flex flex-wrap gap-2 justify-center mb-3">
            {displayTimes.map((t, i) => {
              const applied = i < count;
              return (
                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${applied ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" : "bg-muted text-muted-foreground"}`}>
                  <span>{applied ? "✓" : "○"}</span>
                  <span>{t}</span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-sm font-semibold" style={{ color: done ? "#4ade80" : "var(--text-sub)" }}>
          {done ? `All ${target} done!` : count === 0 ? "Tap + after each application" : `${target - count} more to go`}
        </p>
      </div>

      {/* Week view */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const dayLog = weekLogs?.find((l) => l.log_date === dateStr);
            const dayCount: number = (dayLog?.data.count as number) ?? 0;
            const dayDone = dayCount >= target;
            const isToday = dateStr === today;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${isToday ? "ring-2 ring-primary" : ""} ${dayDone ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" : dayCount > 0 ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}>
                  {dayCount > 0 ? `${dayCount}×` : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {notes && (
        <div className="bg-muted rounded-2xl p-4 mb-5">
          <p className="text-xs text-muted-foreground italic">{notes}</p>
        </div>
      )}

      <button onClick={() => { setTargetInput(target); setReminderTimes(settings.reminderTimes?.length ? settings.reminderTimes : buildTimes(target, [])); setNotes(settings.notes ?? ""); setSetupMode(true); }}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
