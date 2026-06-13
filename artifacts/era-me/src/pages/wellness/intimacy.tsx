import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessModules, useWellnessWeek } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const CELIBACY_MILESTONES = [
  { days: 7,   label: "1 Week",   emoji: "🌱" },
  { days: 14,  label: "2 Weeks",  emoji: "💪" },
  { days: 30,  label: "1 Month",  emoji: "⭐" },
  { days: 90,  label: "3 Months", emoji: "🔥" },
  { days: 180, label: "6 Months", emoji: "🏆" },
  { days: 365, label: "1 Year",   emoji: "👑" },
];

const DAY_CHARS = ["M", "T", "W", "T", "F", "S", "S"];

interface IntimacySettings {
  mode?: "celibacy" | "active";
  startDate?: string;
  contraception?: string;
  lastStiTest?: string;
  stiTestIntervalMonths?: number;
  notes?: string;
}

export default function IntimacyPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: IntimacySettings; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("intimacy");
  const saveModule = useSaveModule("intimacy");
  const logToday = useLogToday("intimacy");

  const mod = modules?.intimacy;
  const settings: IntimacySettings = mod?.settings ?? {};
  const enabled = mod?.enabled ?? false;

  const today = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs?.find((l) => l.log_date === today);
  const activityToday = todayLog?.data.active === true;
  const celibateToday = !!todayLog && todayLog.data.active === false;

  const [setupMode, setSetupMode] = useState(false);
  const [mode, setMode] = useState<"celibacy" | "active">(settings.mode ?? "celibacy");
  const [startDate, setStartDate] = useState(settings.startDate ?? today);
  const [contraception, setContraception] = useState(settings.contraception ?? "");
  const [lastStiTest, setLastStiTest] = useState(settings.lastStiTest ?? "");
  const [stiInterval, setStiInterval] = useState(String(settings.stiTestIntervalMonths ?? 6));
  const [notes, setNotes] = useState(settings.notes ?? "");

  const daysFree = settings.mode === "celibacy" && settings.startDate
    ? Math.max(0, Math.floor((Date.now() - new Date(settings.startDate).getTime()) / 86400000))
    : 0;
  const nextMilestone = CELIBACY_MILESTONES.find((m) => m.days > daysFree);
  const daysToNext = nextMilestone ? nextMilestone.days - daysFree : null;

  const nextStiTestDate = settings.lastStiTest && settings.stiTestIntervalMonths
    ? (() => {
        const d = new Date(settings.lastStiTest);
        d.setMonth(d.getMonth() + settings.stiTestIntervalMonths);
        return d.toISOString().split("T")[0];
      })()
    : null;
  const stiTestDue = !!nextStiTestDate && nextStiTestDate <= today;
  const daysToStiTest = nextStiTestDate
    ? Math.ceil((new Date(nextStiTestDate).getTime() - Date.now()) / 86400000)
    : null;

  function saveSetup() {
    saveModule.mutate({
      settings: { mode, startDate, contraception, lastStiTest, stiTestIntervalMonths: parseInt(stiInterval) || 6, notes },
      enabled: true,
    });
    setSetupMode(false);
  }

  function markStiTestDone() {
    saveModule.mutate({ settings: { ...settings, lastStiTest: today }, enabled: true });
  }

  if (isLoading) return <Spinner />;

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-2xl">💗</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sex Life & Intimacy</h1>
            <p className="text-sm text-muted-foreground">Personal wellness · Ages 18+</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span>🔒</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Private & secure — only visible to you</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tracking Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode("celibacy")}
                className={cn("py-4 rounded-xl text-sm font-bold transition active:scale-95 flex flex-col items-center gap-1",
                  mode === "celibacy" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <span className="text-xl">🌿</span>
                Celibacy
              </button>
              <button onClick={() => setMode("active")}
                className={cn("py-4 rounded-xl text-sm font-bold transition active:scale-95 flex flex-col items-center gap-1",
                  mode === "active" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <span className="text-xl">💗</span>
                Active
              </button>
            </div>
          </div>

          {mode === "celibacy" && (
            <Field label="Celibacy start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
            </Field>
          )}

          {mode === "active" && (
            <>
              <Field label="Contraception method (optional)">
                <input value={contraception} onChange={(e) => setContraception(e.target.value)}
                  placeholder="e.g. Condom, Pill, IUD, None..."
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
              </Field>
              <Field label="Last STI/STD test date (optional)">
                <input type="date" value={lastStiTest} onChange={(e) => setLastStiTest(e.target.value)}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
              </Field>
              <Field label="Test reminder every (months)">
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={stiInterval}
                  onChange={(e) => setStiInterval(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-base font-semibold text-foreground outline-none" />
              </Field>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mt-4">
          <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — anything relevant to your goals</p>
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

  const isCelibacy = settings.mode === "celibacy";

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">💗</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Sex Life & Intimacy</h1>
          <p className="text-xs text-muted-foreground">{isCelibacy ? "Celibacy tracking" : "Sexual health"}</p>
        </div>
      </div>

      {isCelibacy ? (
        <>
          <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl p-6 mb-5 text-center text-white">
            <p className="text-sm font-semibold opacity-80 mb-1">Days of celibacy</p>
            <p className="text-6xl font-black mb-1">{daysFree}</p>
            <p className="text-xl font-bold opacity-90">{daysFree === 1 ? "day" : "days"}</p>
            {nextMilestone && (
              <p className="text-sm opacity-75 mt-3">{daysToNext} more {daysToNext === 1 ? "day" : "days"} to {nextMilestone.emoji} {nextMilestone.label}</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
            <button onClick={() => logToday.mutate({ active: false })} disabled={logToday.isPending}
              className={cn("w-full py-3.5 rounded-xl font-semibold text-sm transition active:scale-95",
                celibateToday ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground")}>
              {logToday.isPending ? "Saving…" : celibateToday ? "✓ Logged — staying celibate" : "I maintained my celibacy today"}
            </button>
            {!activityToday && (
              <button onClick={() => logToday.mutate({ active: true })}
                className="w-full py-2 text-xs text-muted-foreground font-semibold mt-2">
                Had a slip? Log honestly
              </button>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Milestones</p>
            <div className="grid grid-cols-3 gap-2">
              {CELIBACY_MILESTONES.map((m) => {
                const reached = daysFree >= m.days;
                return (
                  <div key={m.days} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl",
                    reached ? "bg-green-100 dark:bg-green-900/30" : "bg-muted")}>
                    <span className={cn("text-xl", !reached && "grayscale opacity-50")}>{m.emoji}</span>
                    <span className={cn("text-[10px] font-semibold text-center leading-tight",
                      reached ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {nextStiTestDate && (
            <div className={cn("rounded-2xl p-4 mb-5 flex items-start gap-3",
              stiTestDue
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : "bg-card border border-border")}>
              <span className="text-xl">🔬</span>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">
                  {stiTestDue
                    ? "STI test overdue!"
                    : `STI test due ${daysToStiTest !== null && daysToStiTest <= 30 ? `in ${daysToStiTest} days` : `on ${nextStiTestDate}`}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Every {settings.stiTestIntervalMonths} months keeps you protected</p>
                {stiTestDue && (
                  <button onClick={markStiTestDone} disabled={saveModule.isPending}
                    className="mt-2 text-xs text-primary font-semibold">
                    Mark test done today
                  </button>
                )}
              </div>
            </div>
          )}

          {settings.contraception && (
            <div className="bg-card border border-border rounded-2xl p-4 mb-5 flex items-center gap-3">
              <span className="text-xl">💊</span>
              <div>
                <p className="font-semibold text-foreground text-sm">Contraception</p>
                <p className="text-xs text-muted-foreground">{settings.contraception}</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</p>
            {activityToday ? (
              <div className="text-center py-2">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-sm text-muted-foreground">Activity logged for today</p>
              </div>
            ) : (
              <button onClick={() => logToday.mutate({ active: true })} disabled={logToday.isPending}
                className="w-full py-3.5 rounded-xl font-semibold text-sm bg-primary text-primary-foreground transition active:scale-95">
                {logToday.isPending ? "Saving…" : "Log activity today"}
              </button>
            )}
          </div>

          {weekLogs && weekLogs.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  const dateStr = d.toISOString().split("T")[0];
                  const log = weekLogs?.find((l) => l.log_date === dateStr);
                  const active = log?.data.active === true;
                  const logged = !!log;
                  const dayOfWeek = d.getDay();
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {DAY_CHARS[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}
                      </span>
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        active ? "bg-pink-100 dark:bg-pink-900/30 text-pink-600"
                          : logged ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                          : "bg-muted text-muted-foreground",
                      )}>
                        {active ? "💗" : logged ? "✓" : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit settings
      </button>
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
