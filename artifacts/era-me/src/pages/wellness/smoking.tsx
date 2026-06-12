import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { days: 1, label: "1 Day", emoji: "🌱" },
  { days: 3, label: "3 Days", emoji: "💪" },
  { days: 7, label: "1 Week", emoji: "⭐" },
  { days: 14, label: "2 Weeks", emoji: "🔥" },
  { days: 30, label: "1 Month", emoji: "🏆" },
  { days: 90, label: "3 Months", emoji: "💎" },
  { days: 180, label: "6 Months", emoji: "🌟" },
  { days: 365, label: "1 Year", emoji: "👑" },
];

interface SmokingSettings {
  quitDate?: string;
  cigarettesPerDay?: number;
  costPerPack?: number;
  cigarettesPerPack?: number;
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

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const smokedToday = todayLog?.data.smoked === true;
  const smokedCount = (todayLog?.data.count as number | undefined) ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [quitDate, setQuitDate] = useState(settings.quitDate ?? today);
  const [perDay, setPerDay] = useState(settings.cigarettesPerDay ?? 10);
  const [costPerPack, setCostPerPack] = useState(settings.costPerPack ?? 1500);
  const [perPack, setPerPack] = useState(settings.cigarettesPerPack ?? 20);
  const [showSlip, setShowSlip] = useState(false);
  const [slipCount, setSlipCount] = useState("1");

  const daysFree = settings.quitDate
    ? Math.max(0, Math.floor((Date.now() - new Date(settings.quitDate).getTime()) / 86400000))
    : 0;

  const cigAvoided = daysFree * (settings.cigarettesPerDay ?? 10);
  const packsSaved = cigAvoided / (settings.cigarettesPerPack ?? 20);
  const moneySaved = Math.round(packsSaved * (settings.costPerPack ?? 1500));

  const nextMilestone = MILESTONES.find((m) => m.days > daysFree);
  const daysToNext = nextMilestone ? nextMilestone.days - daysFree : null;

  function saveSetup() {
    saveModule.mutate({ settings: { quitDate, cigarettesPerDay: perDay, costPerPack, cigarettesPerPack: perPack }, enabled: true });
    setSetupMode(false);
  }

  function logClean() {
    logToday.mutate({ smoked: false });
  }

  function logSlip() {
    logToday.mutate({ smoked: true, count: parseInt(slipCount) || 1 });
    setShowSlip(false);
  }

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
            <h1 className="text-xl font-bold text-foreground">Smoking Cessation</h1>
            <p className="text-sm text-muted-foreground">Set your quit date & track progress</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Quit date (or today if you're starting now)">
            <input type="date" value={quitDate} onChange={(e) => setQuitDate(e.target.value)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
          <Field label="Average cigarettes per day (before quitting)">
            <input type="number" value={perDay} onChange={(e) => setPerDay(parseInt(e.target.value) || 1)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
          <Field label="Cost per pack (₦)">
            <input type="number" value={costPerPack} onChange={(e) => setCostPerPack(parseInt(e.target.value) || 0)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
          <Field label="Cigarettes per pack">
            <input type="number" value={perPack} onChange={(e) => setPerPack(parseInt(e.target.value) || 1)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
        </div>
        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Start tracking"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🚭</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Smoking Cessation</h1>
          <p className="text-xs text-muted-foreground">Quit date: {settings.quitDate}</p>
        </div>
      </div>

      {/* Big counter */}
      <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-3xl p-6 mb-5 text-center text-white">
        <p className="text-sm font-semibold opacity-80 mb-1">You've been smoke-free for</p>
        <p className="text-6xl font-black mb-1">{daysFree}</p>
        <p className="text-xl font-bold opacity-90">{daysFree === 1 ? "day" : "days"}</p>
        {nextMilestone && (
          <p className="text-sm opacity-75 mt-3">{daysToNext} more {daysToNext === 1 ? "day" : "days"} to {nextMilestone.emoji} {nextMilestone.label}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard emoji="🚬" value={cigAvoided.toLocaleString()} label="Cigs avoided" />
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
            <p className="text-sm text-muted-foreground mb-3">{smokedCount} cigarette{smokedCount !== 1 ? "s" : ""}. That's okay — every day is a new chance. You've still come {daysFree} days.</p>
            <button onClick={logClean} className="text-sm text-primary font-semibold">Mark as clean day instead</button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={logClean} disabled={logToday.isPending}
              className={cn("w-full py-3.5 rounded-xl font-semibold text-sm transition active:scale-95",
                todayLog ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground")}>
              {logToday.isPending ? "Saving…" : todayLog ? "✓ Logged clean today" : "I stayed smoke-free today"}
            </button>
            {!showSlip ? (
              <button onClick={() => setShowSlip(true)} className="w-full py-2 text-xs text-muted-foreground font-semibold">
                Had a slip? Log it honestly
              </button>
            ) : (
              <div className="flex gap-2">
                <input type="number" value={slipCount} onChange={(e) => setSlipCount(e.target.value)} min="1"
                  className="w-20 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground text-center outline-none" />
                <button onClick={logSlip} className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-semibold">
                  Log slip
                </button>
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
