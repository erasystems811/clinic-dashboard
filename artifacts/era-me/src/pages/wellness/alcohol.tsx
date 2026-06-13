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

interface AlcoholSettings {
  goalType?: "quit" | "reduce";
  quitDate?: string;
  weeklyTarget?: number;
  drinksPerWeekBefore?: number;
  costPerDrink?: number;
  notes?: string;
}

export default function AlcoholPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: AlcoholSettings; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("alcohol");
  const saveModule = useSaveModule("alcohol");
  const logToday = useLogToday("alcohol");

  const mod = modules?.alcohol;
  const settings: AlcoholSettings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const drinksToday = (todayLog?.data.drinks as number | undefined) ?? 0;
  const cleanToday = !!todayLog && drinksToday === 0;

  const weekDrinks = weekLogs?.reduce((sum, l) => sum + ((l.data.drinks as number | undefined) ?? 0), 0) ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [goalType, setGoalType] = useState<"quit" | "reduce">(settings.goalType ?? "quit");
  const [quitDate, setQuitDate] = useState(settings.quitDate ?? today);
  const [weeklyTarget, setWeeklyTarget] = useState(String(settings.weeklyTarget ?? 3));
  const [drinksBefore, setDrinksBefore] = useState(String(settings.drinksPerWeekBefore ?? 14));
  const [costPerDrink, setCostPerDrink] = useState(String(settings.costPerDrink ?? 500));
  const [notes, setNotes] = useState(settings.notes ?? "");
  const [showLog, setShowLog] = useState(false);
  const [drinkCount, setDrinkCount] = useState("1");

  const daysFree = settings.goalType === "quit" && settings.quitDate
    ? Math.max(0, Math.floor((Date.now() - new Date(settings.quitDate).getTime()) / 86400000))
    : 0;
  const moneySaved = Math.round(
    daysFree * ((settings.drinksPerWeekBefore ?? 14) / 7) * (settings.costPerDrink ?? 500)
  );
  const nextMilestone = MILESTONES.find((m) => m.days > daysFree);
  const daysToNext = nextMilestone ? nextMilestone.days - daysFree : null;

  function saveSetup() {
    saveModule.mutate({
      settings: { goalType, quitDate, weeklyTarget: parseInt(weeklyTarget) || 0, drinksPerWeekBefore: parseInt(drinksBefore) || 0, costPerDrink: parseInt(costPerDrink) || 0, notes },
      enabled: true,
    });
    setSetupMode(false);
  }

  function logClean() { logToday.mutate({ drinks: 0 }); }

  function logDrinks() {
    logToday.mutate({ drinks: parseInt(drinkCount) || 1 });
    setShowLog(false);
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
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl">🍷</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Alcohol Tracker</h1>
            <p className="text-sm text-muted-foreground">Quit or reduce your alcohol intake</p>
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
            <Field label="Weekly limit (max drinks per week)">
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
            </Field>
          )}

          <Field label="Current drinks per week (your baseline)">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={drinksBefore}
              onChange={(e) => setDrinksBefore(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>

          <Field label="Average cost per drink (₦)">
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={costPerDrink}
              onChange={(e) => setCostPerDrink(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
          </Field>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mt-4">
          <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I drink at social events", "I drink beer most nights"</p>
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

  const isQuit = settings.goalType === "quit" || !settings.goalType;
  const weekTarget = settings.weeklyTarget ?? 3;
  const overTarget = weekDrinks > weekTarget;

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🍷</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Alcohol Tracker</h1>
          <p className="text-xs text-muted-foreground">
            {isQuit ? `Quit since: ${settings.quitDate}` : `Weekly limit: ${weekTarget} drinks`}
          </p>
        </div>
      </div>

      {isQuit ? (
        <>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 mb-5 text-center text-white">
            <p className="text-sm font-semibold opacity-80 mb-1">You've been drink-free for</p>
            <p className="text-6xl font-black mb-1">{daysFree}</p>
            <p className="text-xl font-bold opacity-90">{daysFree === 1 ? "day" : "days"}</p>
            {nextMilestone && (
              <p className="text-sm opacity-75 mt-3">{daysToNext} more {daysToNext === 1 ? "day" : "days"} to {nextMilestone.emoji} {nextMilestone.label}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard emoji="💰" value={`₦${moneySaved.toLocaleString()}`} label="Money saved" />
            <StatCard emoji="⏱️" value={`${daysFree}d`} label="Drink-free" />
          </div>
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-3xl font-black text-foreground">{weekDrinks}</p>
            <p className="text-sm text-muted-foreground">of {weekTarget} drinks</p>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-muted">
            <div className={cn("h-full rounded-full transition-all duration-500", overTarget ? "bg-red-500" : "bg-green-500")}
              style={{ width: `${Math.min(100, (weekDrinks / weekTarget) * 100)}%` }} />
          </div>
          <p className="text-xs mt-2 text-muted-foreground">
            {overTarget ? `${weekDrinks - weekTarget} over your limit` : weekDrinks === 0 ? "No drinks yet this week 🎉" : "Within your weekly limit 🎉"}
          </p>
        </div>
      )}

      {/* Today */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
        {drinksToday > 0 ? (
          <div className="text-center">
            <p className="text-2xl mb-2">😔</p>
            <p className="font-semibold text-foreground mb-1">You had {drinksToday} drink{drinksToday !== 1 ? "s" : ""} today</p>
            <p className="text-sm text-muted-foreground mb-3">That's okay — every day is a fresh start.</p>
            <button onClick={logClean} className="text-sm text-primary font-semibold">Change to drink-free day</button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={logClean} disabled={logToday.isPending}
              className={cn("w-full py-3.5 rounded-xl font-semibold text-sm transition active:scale-95",
                cleanToday ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground")}>
              {logToday.isPending ? "Saving…" : cleanToday ? "✓ Drink-free today" : "I stayed drink-free today"}
            </button>
            {!showLog ? (
              <button onClick={() => setShowLog(true)} className="w-full py-2 text-xs text-muted-foreground font-semibold">
                Had a drink? Log it honestly
              </button>
            ) : (
              <div className="flex gap-2">
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={drinkCount} onChange={(e) => setDrinkCount(e.target.value.replace(/\D/g, ""))}
                  className="w-20 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground text-center outline-none" />
                <button onClick={logDrinks} className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-semibold">
                  Log drinks
                </button>
                <button onClick={() => setShowLog(false)} className="px-3 text-muted-foreground text-sm">Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      {isQuit && (
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
