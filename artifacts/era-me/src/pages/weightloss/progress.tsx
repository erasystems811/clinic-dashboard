import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useWLProgress, useWLLogWeight } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { useState } from "react";

export default function WLProgressPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useWLProgress();
  const logWeight = useWLLogWeight();
  const [weightInput, setWeightInput] = useState("");
  useWLTheme();

  if (isLoading) return <Spinner />;
  if (data?.noProfile) {
    return (
      <div className="px-5 pt-6 pb-24">
        <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 mb-5 -ml-1" style={{ color: "var(--text-sub)" }}>
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center py-16">
          <p style={{ fontSize: 48 }}>📊</p>
          <p className="text-base font-bold mt-3" style={{ color: "var(--text-main)" }}>No data yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-sub)" }}>Complete onboarding first</p>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const weightEntries = data?.weightEntries ?? [];
  const kgLost = data?.kgLost;
  const adjustments = data?.recentAdjustments ?? [];

  const pctToGoal = profile
    ? Math.max(0, Math.min(100,
        ((profile.currentWeightKg - (profile.currentWeightKg - (kgLost ?? 0))) /
          (profile.currentWeightKg - profile.goalWeightKg)) * 100
      ))
    : 0;

  return (
    <div className="px-5 pt-6 pb-24">
      <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 mb-5 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-2xl font-black mb-5" style={{ color: "var(--text-main)" }}>Progress</h1>

      {/* Weight journey */}
      {profile && (
        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Weight journey</p>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: "var(--text-main)" }}>{profile.currentWeightKg}</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Start kg</p>
            </div>
            <div className="flex-1 relative h-2 rounded-full overflow-hidden"
              style={{ background: "var(--glass-border)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctToGoal}%`, background: "var(--accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: "var(--accent)" }}>{profile.goalWeightKg}</p>
              <p className="text-xs" style={{ color: "var(--accent)" }}>Goal kg</p>
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <StatBox label="Lost so far" value={kgLost !== null ? `${Math.abs(kgLost ?? 0).toFixed(1)} kg` : "—"} />
            <StatBox label="Weeks" value={`${profile.timelineWeeks}`} />
            <StatBox label="Coins" value={`${profile.totalCoinsEarned}`} emoji="🪙" />
            <StatBox label="Cheat days" value={`${profile.cheatDaysAvailable}`} emoji="🎉" />
          </div>
        </div>
      )}

      {/* Log weight */}
      <div className="rounded-2xl p-4 mb-4 flex gap-3"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <input
          type="number" step="0.1" placeholder="Log today's weight (kg)"
          value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
          style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }}
        />
        <button
          onClick={() => {
            if (!weightInput) return;
            logWeight.mutate(parseFloat(weightInput), { onSuccess: () => setWeightInput("") });
          }}
          disabled={!weightInput || logWeight.isPending}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          Save
        </button>
      </div>

      {/* Adherence */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <AdherenceCard label="Meal adherence" pct={data?.avgMealAdherence ?? null} emoji="🍽️" />
        <AdherenceCard label="Workout adherence" pct={data?.avgWorkoutAdherence ?? null} emoji="💪" />
      </div>

      {/* Weight chart */}
      {weightEntries.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Weight history</p>
          <MiniWeightChart entries={weightEntries} />
        </div>
      )}

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>Recent coach actions</p>
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div key={adj.id} className="rounded-2xl p-4"
                style={{
                  background: adj.type === "punishment" ? "rgba(239,68,68,0.06)" : "rgba(var(--glow-rgb),0.03)",
                  border: `1px solid ${adj.type === "punishment" ? "rgba(239,68,68,0.2)" : "rgba(var(--glow-rgb),0.15)"}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: adj.type === "punishment" ? "#f87171" : "var(--accent)" }}>
                    {adj.type === "punishment" ? "⚠️ Punishment" : "🎉 Reward"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>{adj.applies_date}</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{adj.description}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{adj.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.logsCount === 0 && (
        <div className="text-center py-8" style={{ color: "var(--text-dim)" }}>
          <p className="text-3xl mb-2">📈</p>
          <p className="text-sm">Start logging meals & workouts to see your progress here</p>
        </div>
      )}
    </div>
  );
}

function AdherenceCard({ label, pct, emoji }: { label: string; pct: number | null; emoji: string }) {
  const val = pct !== null ? Math.round(pct) : null;
  const color = val === null ? "var(--text-dim)" : val >= 80 ? "var(--accent)" : val >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ fontSize: 24 }}>{emoji}</p>
      <p className="text-2xl font-black mt-1" style={{ color }}>{val !== null ? `${val}%` : "—"}</p>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{label}</p>
    </div>
  );
}

function StatBox({ label, value, emoji }: { label: string; value: string; emoji?: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-base font-black" style={{ color: "var(--text-main)" }}>{emoji ? `${emoji} ` : ""}{value}</p>
      <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>{label}</p>
    </div>
  );
}

function MiniWeightChart({ entries }: { entries: Array<{ date: string; weight: number }> }) {
  const last14 = entries.slice(-14);
  if (last14.length < 2) {
    return <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>Need more data to show chart</p>;
  }
  const min = Math.min(...last14.map((e) => e.weight)) - 0.5;
  const max = Math.max(...last14.map((e) => e.weight)) + 0.5;
  const range = max - min || 1;
  const W = 280;
  const H = 80;
  const points = last14.map((e, i) => {
    const x = (i / (last14.length - 1)) * W;
    const y = H - ((e.weight - min) / range) * H;
    return `${x},${y}`;
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible" }}>
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {last14.map((e, i) => {
          const x = (i / (last14.length - 1)) * W;
          const y = H - ((e.weight - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" />;
        })}
      </svg>
      <div className="flex justify-between mt-1">
        <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
          {new Date(last14[0].date + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
        </p>
        <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
          {new Date(last14[last14.length - 1].date + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--accent) transparent transparent transparent" }} />
    </div>
  );
}
