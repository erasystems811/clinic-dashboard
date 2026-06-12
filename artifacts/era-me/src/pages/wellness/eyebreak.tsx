import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Minus } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Suggest a sensible target based on work hours (one break every 25 min)
function suggestTarget(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(4, Math.round(mins / 25));
}

export default function EyeBreakPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { startTime?: string; endTime?: string; targetBreaks?: number }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("eyebreak");
  const saveModule = useSaveModule("eyebreak");
  const logToday = useLogToday("eyebreak");

  const mod = modules?.eyebreak;
  const settings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const [setupMode, setSetupMode] = useState(false);
  const [startTime, setStartTime] = useState(settings.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(settings.endTime ?? "18:00");
  const [targetBreaks, setTargetBreaks] = useState(settings.targetBreaks ?? suggestTarget("09:00", "18:00"));

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const count = (todayLog?.data.count as number | undefined) ?? 0;
  const target = settings.targetBreaks ?? suggestTarget(settings.startTime ?? "09:00", settings.endTime ?? "18:00");
  const progress = Math.min(count / target, 1);
  const done = count >= target;

  function saveSetup() {
    saveModule.mutate({ settings: { startTime, endTime, targetBreaks }, enabled: true });
    setSetupMode(false);
  }

  function logBreak() { logToday.mutate({ count: count + 1 }); }
  function undoBreak() { if (count > 0) logToday.mutate({ count: count - 1 }); }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    const suggested = suggestTarget(startTime, endTime);
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">👁️</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Eye Break</h1>
            <p className="text-sm text-muted-foreground">Track the 20-20-20 rule</p>
          </div>
        </div>

        {/* Rule explanation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5">
          <p className="text-sm font-bold text-foreground mb-2">📖 What is the 20-20-20 rule?</p>
          <p className="text-sm text-foreground leading-relaxed mb-3">
            Every <strong>20 minutes</strong> of screen time, look at something at least <strong>20 feet away</strong> for <strong>20 seconds</strong>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Staring at screens causes your eye muscles to tighten. Looking far away relaxes them, reducing eye strain, headaches, and blurry vision at the end of the day.
          </p>
        </div>

        <div className="bg-muted rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why count breaks?</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A simple checkbox only tells you "I did it today." Counting each break shows you how consistently you actually followed the rule throughout the day.
          </p>
        </div>

        <div className="space-y-4 mb-5">
          <Field label="Screen time start">
            <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setTargetBreaks(suggestTarget(e.target.value, endTime)); }}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-bold text-foreground text-center outline-none" />
          </Field>
          <Field label="Screen time end">
            <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setTargetBreaks(suggestTarget(startTime, e.target.value)); }}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-bold text-foreground text-center outline-none" />
          </Field>
          <Field label={`Daily break target (suggested: ${suggested})`}>
            <div className="flex items-center gap-3">
              <button onClick={() => setTargetBreaks((t) => Math.max(1, t - 1))}
                className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl font-bold text-foreground transition active:scale-90">−</button>
              <span className="flex-1 text-center text-3xl font-bold text-foreground">{targetBreaks}</span>
              <button onClick={() => setTargetBreaks((t) => t + 1)}
                className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl font-bold text-foreground transition active:scale-90">+</button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">breaks per day</p>
          </Field>
        </div>

        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Set up eye break tracking"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👁️</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Eye Break</h1>
            <p className="text-xs text-muted-foreground">{settings.startTime} – {settings.endTime}</p>
          </div>
        </div>
      </div>

      {/* Rule reminder */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 mb-5">
        <p className="text-xs text-blue-800 dark:text-blue-300 font-semibold">20-20-20 rule</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Every 20 min → look 20 ft away → for 20 seconds</p>
      </div>

      {/* Counter card */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col items-center">
        {/* Progress arc */}
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress)}`}
              strokeLinecap="round"
              className={cn("transition-all duration-500", done ? "stroke-green-500" : "stroke-primary")}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-foreground">{count}</span>
            <span className="text-xs text-muted-foreground">of {target}</span>
          </div>
        </div>

        <p className={cn("text-base font-bold mb-1", done ? "text-green-600 dark:text-green-400" : "text-foreground")}>
          {done ? "Goal reached! Great job 👏" : `${target - count} break${target - count === 1 ? "" : "s"} to go`}
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          {done ? "Keep going if you're still at your screen." : "Tap the button each time you take an eye break."}
        </p>

        <button onClick={logBreak} disabled={logToday.isPending}
          className={cn("w-full py-4 rounded-2xl font-bold text-base transition active:scale-95 shadow-lg flex items-center justify-center gap-2",
            done ? "bg-green-500 text-white shadow-green-500/30" : "bg-primary text-primary-foreground shadow-primary/30")}>
          👁️ {logToday.isPending ? "Logging…" : "I just took a break"}
        </button>

        {count > 0 && (
          <button onClick={undoBreak} disabled={logToday.isPending}
            className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground transition active:scale-95">
            <Minus className="w-3.5 h-3.5" />Undo last
          </button>
        )}
      </div>

      {/* Weekly */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const log = weekLogs?.find((l) => l.log_date === dateStr);
            const dayCount = (log?.data.count as number | undefined) ?? 0;
            const isDone = dayCount >= target;
            const isToday = dateStr === today;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition",
                  isToday ? "ring-2 ring-primary" : "",
                  isDone ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                  dayCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {dayCount > 0 ? dayCount : "·"}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">Numbers show breaks logged. Green = goal reached.</p>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>{children}</div>;
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
