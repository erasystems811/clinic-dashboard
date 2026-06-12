import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { PageLoader, PageBack, ModuleHero, GlassCard, SaveButton, StreakBadge, WeekGrid } from "./water";

const ACCENT = "#fbbf24";
const GRADIENT = "linear-gradient(135deg,#451a03,#b45309)";

const MOOD_OPTIONS =   [{ value:1,emoji:"😢",label:"Very sad"},{value:2,emoji:"😔",label:"Down"},{value:3,emoji:"😐",label:"Neutral"},{value:4,emoji:"😊",label:"Good"},{value:5,emoji:"😄",label:"Great"}];
const ENERGY_OPTIONS = [{ value:1,emoji:"🪫",label:"Drained"},{value:2,emoji:"😴",label:"Tired"},{value:3,emoji:"😐",label:"OK"},{value:4,emoji:"⚡",label:"Energised"},{value:5,emoji:"🚀",label:"Fired up"}];
const STRESS_OPTIONS = [{ value:1,emoji:"😌",label:"Calm"},{value:2,emoji:"🙂",label:"Low"},{value:3,emoji:"😐",label:"Moderate"},{value:4,emoji:"😬",label:"High"},{value:5,emoji:"😰",label:"Very high"}];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function MoodPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: { modules: { mood_check: { enabled: boolean; log: { mood?: number; energy?: number; stress?: number } | null } } } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("mood_check");
  const { data: streakData } = useWellnessStreak("mood_check");
  const saveModule = useSaveModule("mood_check");
  const logToday = useLogToday("mood_check");

  const module = today?.modules.mood_check;
  const enabled = module?.enabled ?? false;
  const log = module?.log;
  const streak = streakData?.streak ?? 0;

  const [mood, setMood] = useState(log?.mood ?? 0);
  const [energy, setEnergy] = useState(log?.energy ?? 0);
  const [stress, setStress] = useState(log?.stress ?? 0);
  const [saved, setSaved] = useState(!!(log?.mood && log?.energy && log?.stress));

  useEffect(() => {
    if (log) { setMood(log.mood ?? 0); setEnergy(log.energy ?? 0); setStress(log.stress ?? 0); setSaved(!!(log.mood && log.energy && log.stress)); }
  }, [log]);

  function saveLog() {
    if (!mood || !energy || !stress) return;
    logToday.mutate({ mood, energy, stress }, { onSuccess: () => setSaved(true) });
  }

  if (isLoading) return <PageLoader color={ACCENT} />;

  if (!enabled) {
    return (
      <div className="px-4 pt-6 pb-8">
        <PageBack onClick={() => navigate("/wellness")} label="Back" />
        <ModuleHero emoji="😊" title="Daily Check-in" subtitle="Mood, energy & stress" gradient={GRADIENT} accent={ACCENT} />
        <GlassCard accent={ACCENT} className="mb-5 text-center">
          <p className="text-4xl mb-3">😊⚡🧘</p>
          <p className="font-bold text-white mb-1">Know how you feel each day</p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            A 10-second check-in on your mood, energy, and stress. Spot patterns over time.
          </p>
        </GlassCard>
        <SaveButton onClick={() => saveModule.mutate({ settings: {}, enabled: true })} loading={saveModule.isPending} accent={ACCENT}>
          Enable daily check-in
        </SaveButton>
      </div>
    );
  }

  const currentMoodEmoji = mood ? MOOD_OPTIONS[mood - 1].emoji : "😊";

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <PageBack onClick={() => navigate("/")} label="Home" />
        <StreakBadge streak={streak} />
      </div>

      {/* Current mood hero */}
      <GlassCard accent={ACCENT} className="mb-4 text-center py-6">
        <p className="text-7xl mb-2">{currentMoodEmoji}</p>
        <p className="text-sm font-bold" style={{ color: saved ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
          {saved ? "Logged for today ✓" : "How are you today?"}
        </p>
      </GlassCard>

      {/* Scale pickers */}
      <GlassCard accent={ACCENT} className="mb-4 space-y-5">
        <ScaleRow label="Mood" options={MOOD_OPTIONS} value={mood} onChange={setMood} accent={ACCENT} />
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
        <ScaleRow label="Energy" options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} accent="#84cc16" />
        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
        <ScaleRow label="Stress" options={STRESS_OPTIONS} value={stress} onChange={setStress} accent="#a855f7" />

        <button onClick={saveLog} disabled={!mood || !energy || !stress || logToday.isPending}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: saved ? "rgba(74,222,128,0.15)" : GRADIENT, border: saved ? "1px solid rgba(74,222,128,0.3)" : "none", boxShadow: saved ? "none" : `0 8px 24px ${ACCENT}30`, color: saved ? "#4ade80" : "#fff" }}>
          {logToday.isPending ? "Saving…" : saved ? "Update check-in ✓" : "Save check-in"}
        </button>
      </GlassCard>

      {/* Week */}
      <WeekGrid weekLogs={weekLogs} accent={ACCENT}
        renderDay={(log, isToday) => {
          const m = log?.data.mood as number | undefined;
          return { text: m ? MOOD_OPTIONS[m - 1].emoji : "·", done: !!m, isToday };
        }} />
    </div>
  );
}

function ScaleRow({ label, options, value, onChange, accent }: {
  label: string; options: { value: number; emoji: string; label: string }[]; value: number; onChange: (v: number) => void; accent: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold mb-2.5" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition active:scale-90"
            style={{
              background: value === o.value ? `${accent}20` : "rgba(255,255,255,0.05)",
              border: value === o.value ? `1.5px solid ${accent}60` : "1.5px solid transparent",
              boxShadow: value === o.value ? `0 0 12px ${accent}30` : "none",
            }}>
            <span className="text-xl">{o.emoji}</span>
            <span className="text-[9px] font-medium leading-tight text-center" style={{ color: value === o.value ? accent : "rgba(255,255,255,0.35)" }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
