import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { days: 1,   label: "1 Day",    emoji: "🌱" },
  { days: 3,   label: "3 Days",   emoji: "💪" },
  { days: 7,   label: "1 Week",   emoji: "⭐" },
  { days: 14,  label: "2 Weeks",  emoji: "🔥" },
  { days: 30,  label: "1 Month",  emoji: "🏆" },
  { days: 90,  label: "3 Months", emoji: "💎" },
  { days: 180, label: "6 Months", emoji: "🌟" },
  { days: 365, label: "1 Year",   emoji: "👑" },
];

interface SmokingSettings {
  goalType?: "quit" | "reduce";
  quitDate?: string;
  dailyTarget?: number;
  smokesPerDay?: number;
  costPerSession?: number;
  // Legacy fields
  cigarettesPerDay?: number;
  costPerPack?: number;
  cigarettesPerPack?: number;
  notes?: string;
}

export default function SmokingPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: SmokingSettings; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("smoking");
  const saveModule = useSaveModule("smoking");
  const logToday = useLogToday("smoking");

  const mod = modules?.smoking;
  const settings: SmokingSettings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const effectiveSmokesPerDay = settings.smokesPerDay ?? settings.cigarettesPerDay ?? 10;
  const effectiveCostPerSession = settings.costPerSession
    ?? (settings.costPerPack && settings.cigarettesPerPack
      ? Math.round(settings.costPerPack / settings.cigarettesPerPack)
      : 75);

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const smokedToday = todayLog?.data.smoked === true;
  const smokeCount = (todayLog?.data.count as number | undefined) ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [goalType, setGoalType] = useState<"quit" | "reduce">(settings.goalType ?? "quit");
  const [quitDate, setQuitDate] = useState(settings.quitDate ?? today);
  const [dailyTarget, setDailyTarget] = useState(settings.dailyTarget ?? Math.ceil(effectiveSmokesPerDay / 2));
  const [perDay, setPerDay] = useState(effectiveSmokesPerDay);
  const [costPerSession, setCostPerSession] = useState(effectiveCostPerSession);
  const [notes, setNotes] = useState(settings.notes ?? "");
  const [showSlip, setShowSlip] = useState(false);
  const [slipCount, setSlipCount] = useState("1");

  const daysFree = settings.goalType !== "reduce" && settings.quitDate
    ? Math.max(0, Math.floor((Date.now() - new Date(settings.quitDate).getTime()) / 86400000))
    : 0;
  const smokesAvoided = daysFree * effectiveSmokesPerDay;
  const moneySaved = Math.round(smokesAvoided * effectiveCostPerSession);
  const nextMilestone = MILESTONES.find((m) => m.days > daysFree);
  const daysToNext = nextMilestone ? nextMilestone.days - daysFree : null;

  // Reduce mode stats
  const weekAvg = weekLogs && weekLogs.length > 0
    ? Math.round(weekLogs.reduce((sum, l) => sum + ((l.data.count as number | undefined) ?? 0), 0) / weekLogs.length)
    : 0;
  const target = settings.dailyTarget ?? Math.ceil(effectiveSmokesPerDay / 2);
  const todayOverTarget = smokeCount > target;
  const weekMoneySaved = Math.round(
    Math.max(0, effectiveSmokesPerDay - weekAvg) * effectiveCostPerSession * 7
  );

  function saveSetup() {
    saveModule.mutate({
      settings: { goalType, quitDate: goalType === "quit" ? quitDate : undefined, dailyTarget: goalType === "reduce" ? dailyTarget : undefined, smokesPerDay: perDay, costPerSession, notes },
      enabled: true,
    });
    setSetupMode(false);
  }

  function logClean() { logToday.mutate({ smoked: false, count: 0 }); }
  function logSlip() { logToday.mutate({ smoked: true, count: parseInt(slipCount) || 1 }); setShowSlip(false); }
  function logCount(n: number) { logToday.mutate({ smoked: n > 0, count: n }); }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">🚭</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Smoking Tracker</h1>
            <p className="text-sm text-muted-foreground">Quit or reduce — any type</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">My Goal</p>
            <div className="grid grid-cols-2 gap-2">
              {(["quit", "reduce"] as const).map((g) => (
                <button key={g} onClick={() => setGoalType(g)}
                  className={cn("py-3 rounded-xl text-sm font-bold transition active:scale-95",
                    goalType === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {g === "quit" ? "Quit completely" : "Reduce intake"}
                </button>
              ))}
            </div>
          </div>

          {goalType === "quit" && (
            <Field label="Quit date (or today if you're starting now)">
              <input type="date" value={quitDate} onChange={(e) => setQuitDate(e.target.value)}
                className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
            </Field>
          )}

          {goalType === "reduce" && (
            <Field label="Daily limit (max smokes per day)">
              <input type="number" min={1} value={dailyTarget}
                onChange={(e) => setDailyTarget(parseInt(e.target.value) || 1)}
                className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
            </Field>
          )}

          <Field label="Current smokes per day (your baseline)">
            <input type="number" min={1} value={perDay} onChange={(e) => setPerDay(parseInt(e.target.value) || 1)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>

          <Field label="Average cost per smoke session (₦)">
            <input type="number" min={0} value={costPerSession} onChange={(e) => setCostPerSession(parseInt(e.target.value) || 0)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mt-4">
          <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I crave after meals", "I smoke shisha on weekends"</p>
          <textarea value={notes} rows={3} onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that helps us plan better for you..."
            className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
        </div>

        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full mt-4 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Start tracking"}
        </button>
      </div>
    );
  }

  const isReduce = settings.goalType === "reduce";

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🚭</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Smoking Tracker</h1>
          <p className="text-xs text-muted-foreground">
            {isReduce ? `Daily limit: ${target} smokes` : `Quit date: ${settings.quitDate}`}
          </p>
        </div>
      </div>

      {isReduce ? (
        /* ── Reduce mode ── */
        <>
          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week's average</p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-3xl font-black text-foreground">{weekAvg}</p>
              <p className="text-sm text-muted-foreground">of {target} per day</p>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-muted">
              <div className={cn("h-full rounded-full transition-all duration-500", weekAvg > target ? "bg-red-500" : "bg-green-500")}
                style={{ width: `${Math.min(100, (weekAvg / Math.max(1, target)) * 100)}%` }} />
            </div>
            <p className="text-xs mt-2 text-muted-foreground">
              {weekAvg === 0 ? "Smoke-free so far this week 🎉" : weekAvg <= target ? "Below your daily limit 🎉" : `${weekAvg - target} above your limit`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard emoji="📉" value={`${Math.round(Math.max(0, (1 - weekAvg / Math.max(1, effectiveSmokesPerDay)) * 100))}%`} label="Reduction" />
            <StatCard emoji="💰" value={`₦${weekMoneySaved.toLocaleString()}`} label="Saved/week" />
          </div>

          {/* Today counter */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-4xl font-black text-foreground">{smokeCount}</p>
                <p className={cn("text-xs font-semibold mt-1", smokeCount === 0 ? "text-green-500" : todayOverTarget ? "text-red-500" : "text-amber-500")}>
                  {smokeCount === 0 ? "Smoke-free today 🎉" : todayOverTarget ? `${smokeCount - target} over limit` : `${target - smokeCount} under limit`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => logCount(Math.max(0, smokeCount - 1))}
                  disabled={logToday.isPending || smokeCount === 0}
                  className="w-11 h-11 rounded-xl bg-muted text-xl font-bold flex items-center justify-center transition active:scale-90 disabled:opacity-40">
                  −
                </button>
                <button
                  onClick={() => logCount(smokeCount + 1)}
                  disabled={logToday.isPending}
                  className="w-11 h-11 rounded-xl bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center transition active:scale-90">
                  +
                </button>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-muted">
              <div className={cn("h-full rounded-full transition-all duration-300", smokeCount === 0 ? "bg-green-500" : todayOverTarget ? "bg-red-500" : "bg-amber-500")}
                style={{ width: `${Math.min(100, (smokeCount / Math.max(1, target)) * 100)}%` }} />
            </div>
          </div>
        </>
      ) : (
        /* ── Quit mode ── */
        <>
          <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-3xl p-6 mb-5 text-center text-white">
            <p className="text-sm font-semibold opacity-80 mb-1">You've been smoke-free for</p>
            <p className="text-6xl font-black mb-1">{daysFree}</p>
            <p className="text-xl font-bold opacity-90">{daysFree === 1 ? "day" : "days"}</p>
            {nextMilestone && (
              <p className="text-sm opacity-75 mt-3">{daysToNext} more {daysToNext === 1 ? "day" : "days"} to {nextMilestone.emoji} {nextMilestone.label}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard emoji="🚭" value={smokesAvoided.toLocaleString()} label="Smokes avoided" />
            <StatCard emoji="💰" value={`₦${moneySaved.toLocaleString()}`} label="Saved" />
            <StatCard emoji="⏱️" value={`${Math.round(daysFree * 24)}h`} label="Smoke-free" />
          </div>

          {/* Today */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
            {smokedToday ? (
              <div className="text-center">
                <p className="text-2xl mb-2">😔</p>
                <p className="font-semibold text-foreground mb-1">You logged a slip today</p>
                <p className="text-sm text-muted-foreground mb-3">{smokeCount} time{smokeCount !== 1 ? "s" : ""}. That's okay — every day is a new chance.</p>
                <button onClick={logClean} className="text-sm text-primary font-semibold">Mark as clean day instead</button>
              </div>
            ) : (
              <div className="space-y-2">
                <button onClick={logClean} disabled={logToday.isPending}
                  className={cn("w-full py-3.5 rounded-xl font-semibold text-sm transition active:scale-95",
                    todayLog ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground")}>
                  {logToday.isPending ? "Saving…" : todayLog ? "✓ Logged smoke-free today" : "I stayed smoke-free today"}
                </button>
                {!showSlip ? (
                  <button onClick={() => setShowSlip(true)} className="w-full py-2 text-xs text-muted-foreground font-semibold">
                    Had a slip? Log it honestly
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input type="number" value={slipCount} onChange={(e) => setSlipCount(e.target.value)} min="1"
                      className="w-20 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground text-center outline-none" />
                    <button onClick={logSlip} className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-semibold">Log slip</button>
                    <button onClick={() => setShowSlip(false)} className="px-3 text-muted-foreground text-sm">Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Milestones</p>
            <div className="grid grid-cols-4 gap-2">
              {MILESTONES.map((m) => {
                const reached = daysFree >= m.days;
                return (
                  <div key={m.days} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl",
                    reached ? "bg-green-100 dark:bg-green-900/30" : "bg-muted")}>
                    <span className={cn("text-xl", !reached && "grayscale opacity-50")}>{m.emoji}</span>
                    <span className={cn("text-[10px] font-semibold text-center", reached ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
    </div>
  );
}

function StatCard({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 text-center">
      <p className="text-xl mb-1">{emoji}</p>
      <p className="font-bold text-foreground text-sm">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
