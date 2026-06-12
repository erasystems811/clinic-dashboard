import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Minus, Droplets, Flame, Settings2 } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACCENT = "#38bdf8";
const GRADIENT = "linear-gradient(135deg,#0c4a6e,#0369a1)";

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
  const enabled = module?.enabled ?? false;
  const streak = streakData?.streak ?? 0;
  const pct = Math.min(100, Math.round((currentCups / target) * 100));

  const [setupMode, setSetupMode] = useState(false);
  const [localTarget, setLocalTarget] = useState(target);
  const [reminderTimes, setReminderTimes] = useState<string[]>(settings.reminderTimes ?? ["09:00", "13:00", "17:00"]);
  const [newTime, setNewTime] = useState("09:00");

  function addCup() { logToday.mutate({ cups: Math.min(currentCups + 1, 20) }); }
  function removeCup() { if (currentCups > 0) logToday.mutate({ cups: currentCups - 1 }); }
  function saveSetup() {
    saveModule.mutate({ settings: { target: localTarget, reminderTimes }, enabled: true }, {
      onSuccess: () => setSetupMode(false),
    });
  }
  function addReminder() { if (!reminderTimes.includes(newTime)) setReminderTimes((p) => [...p, newTime].sort()); }
  function removeReminder(t: string) { setReminderTimes((p) => p.filter((x) => x !== t)); }

  if (isLoading) return <PageLoader color={ACCENT} />;

  if (!enabled || setupMode) {
    return (
      <div className="px-4 pt-6 pb-8">
        <PageBack onClick={() => setupMode ? setSetupMode(false) : navigate("/wellness")} label={setupMode ? "Cancel" : "Back"} />
        <ModuleHero emoji="💧" title="Water Intake" subtitle="Set your daily hydration goal" gradient={GRADIENT} accent={ACCENT} />

        <GlassCard accent={ACCENT} className="mb-4">
          <p className="text-sm font-bold text-white mb-4">Daily target (cups)</p>
          <div className="flex items-center justify-between">
            <StepBtn onClick={() => setLocalTarget((p) => Math.max(1, p - 1))}><Minus className="w-4 h-4" /></StepBtn>
            <div className="text-center">
              <p className="text-5xl font-black text-white">{localTarget}</p>
              <p className="text-xs mt-1" style={{ color: ACCENT }}>≈ {Math.round(localTarget * 250)}ml/day</p>
            </div>
            <StepBtn onClick={() => setLocalTarget((p) => Math.min(20, p + 1))}><Plus className="w-4 h-4" /></StepBtn>
          </div>
        </GlassCard>

        <GlassCard accent={ACCENT} className="mb-6">
          <p className="text-sm font-bold text-white mb-3">Reminder times</p>
          <div className="flex gap-2 mb-3">
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }} />
            <button onClick={addReminder}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: GRADIENT }}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {reminderTimes.map((t) => (
              <button key={t} onClick={() => removeReminder(t)}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: "rgba(56,189,248,0.15)", color: ACCENT, border: "1px solid rgba(56,189,248,0.3)" }}>
                {t} ×
              </button>
            ))}
          </div>
        </GlassCard>

        <SaveButton onClick={saveSetup} loading={saveModule.isPending} accent={ACCENT}>
          Save & Start Tracking
        </SaveButton>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <PageBack onClick={() => navigate("/")} label="Home" />
        <StreakBadge streak={streak} />
      </div>

      {/* Hero ring */}
      <GlassCard accent={ACCENT} className="mb-4 flex flex-col items-center py-6">
        <div className="relative w-44 h-44 mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="7" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={ACCENT} strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              style={{ filter: `drop-shadow(0 0 8px ${ACCENT})`, transition: "stroke-dashoffset 0.6s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-5xl font-black text-white">{currentCups}</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>of {target} cups</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button onClick={removeCup} disabled={currentCups === 0 || logToday.isPending}
            className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Minus className="w-6 h-6 text-white" />
          </button>
          <button onClick={addCup} disabled={logToday.isPending}
            className="w-20 h-20 rounded-2xl flex items-center justify-center active:scale-90 transition"
            style={{ background: GRADIENT, boxShadow: `0 8px 32px ${ACCENT}40` }}>
            <Droplets className="w-9 h-9 text-white" />
          </button>
          <div className="w-14 h-14" />
        </div>

        <p className="text-sm mt-4" style={{ color: pct >= 100 ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
          {pct >= 100 ? "Goal reached! 🎉" : `${target - currentCups} more to go`}
        </p>
      </GlassCard>

      {/* Cup dots */}
      <GlassCard accent={ACCENT} className="mb-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: target }, (_, i) => (
            <div key={i} className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition"
              style={{
                background: i < currentCups ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.05)",
                boxShadow: i < currentCups ? `0 0 8px ${ACCENT}50` : "none",
              }}>
              💧
            </div>
          ))}
        </div>
      </GlassCard>

      <WeekGrid weekLogs={weekLogs} accent={ACCENT}
        renderDay={(log, isToday) => {
          const cups = (log?.data.cups as number | undefined) ?? 0;
          const done = cups >= target;
          return { text: cups > 0 ? String(cups) : "·", done, isToday };
        }} />

      <button onClick={() => setSetupMode(true)}
        className="w-full mt-4 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
        <Settings2 className="w-4 h-4" /> Edit settings
      </button>
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function PageLoader({ color }: { color: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: color, borderTopColor: "transparent" }} />
    </div>
  );
}

function PageBack({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm font-medium transition"
      style={{ color: "rgba(255,255,255,0.45)" }}>
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  );
}

function ModuleHero({ emoji, title, subtitle, gradient, accent }: { emoji: string; title: string; subtitle: string; gradient: string; accent: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
        style={{ background: gradient, boxShadow: `0 4px 16px ${accent}40` }}>
        {emoji}
      </div>
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

function GlassCard({ children, accent, className = "" }: { children: React.ReactNode; accent: string; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${accent}20` }}>
      {children}
    </div>
  );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-90 transition text-white"
      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {children}
    </button>
  );
}

function SaveButton({ onClick, loading, accent, children }: { onClick: () => void; loading?: boolean; accent: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
      style={{ background: `linear-gradient(135deg, ${accent}dd, ${accent})`, boxShadow: `0 8px 32px ${accent}40` }}>
      {loading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : children}
    </button>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (!streak) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ background: "linear-gradient(135deg,#92400e,#d97706)", boxShadow: "0 4px 12px rgba(217,119,6,0.4)" }}>
      <Flame className="w-3.5 h-3.5 text-white" />
      <span className="text-xs font-bold text-white">{streak} day streak</span>
    </div>
  );
}

function WeekGrid({ weekLogs, accent, renderDay }: {
  weekLogs: Array<{ log_date: string; data: Record<string, unknown> }> | undefined;
  accent: string;
  renderDay: (log: { log_date: string; data: Record<string, unknown> } | undefined, isToday: boolean) => { text: string; done: boolean; isToday: boolean };
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>This week</p>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split("T")[0];
          const log = weekLogs?.find((l) => l.log_date === dateStr);
          const isToday = dateStr === new Date().toISOString().split("T")[0];
          const { text, done } = renderDay(log, isToday);
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                {DAY_LABELS[d.getDay()]}
              </span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition"
                style={{
                  background: done ? `${accent}25` : isToday ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  border: isToday ? `1.5px solid ${accent}60` : done ? `1px solid ${accent}40` : "1px solid transparent",
                  color: done ? accent : isToday ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                  boxShadow: done ? `0 0 8px ${accent}30` : "none",
                }}>
                {text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PageLoader, PageBack, ModuleHero, GlassCard, StepBtn, SaveButton, StreakBadge, WeekGrid };
