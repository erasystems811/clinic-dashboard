import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useWLProgress, useWLLogWeight, WL_COLOR } from "@/lib/weightloss-api";
import { useState } from "react";

export default function WLProgressPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useWLProgress();
  const logWeight = useWLLogWeight();
  const [weightInput, setWeightInput] = useState("");

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
  const kgLost = data?.kgLost ?? 0;
  const adjustments = data?.recentAdjustments ?? [];

  const startKg = profile?.currentWeightKg ?? 0;
  const goalKg = profile?.goalWeightKg ?? 0;
  const totalToLose = startKg - goalKg;
  const pctToGoal = totalToLose > 0
    ? Math.max(0, Math.min(100, (kgLost / totalToLose) * 100))
    : 0;
  const remainingKg = Math.max(0, totalToLose - kgLost);

  return (
    <div className="px-4 pt-5 pb-24">
      <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 mb-5 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-2xl font-black mb-5" style={{ color: "var(--text-main)" }}>Progress</h1>

      {/* Hero journey card */}
      {profile && (
        <div className="rounded-3xl p-5 mb-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.13) 0%, rgba(5,150,105,0.07) 55%, rgba(16,185,129,0.02) 100%)",
            border: "1px solid rgba(16,185,129,0.22)",
          }}>
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 pointer-events-none"
            style={{
              width: 200, height: 200,
              background: `radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)`,
              transform: "translate(30%, -30%)",
            }} />

          {/* Big lost number + coin/cheat day badges */}
          <div className="flex items-start justify-between mb-6 relative">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: WL_COLOR }}>
                Total lost
              </p>
              <div className="flex items-end gap-1.5">
                <p className="font-black leading-none"
                  style={{ fontSize: 54, color: kgLost > 0 ? "var(--text-main)" : "var(--text-dim)", lineHeight: 1 }}>
                  {Math.abs(kgLost).toFixed(1)}
                </p>
                <p className="text-xl font-bold mb-1" style={{ color: "var(--text-sub)" }}>kg</p>
              </div>
              <p className="text-xs mt-1.5" style={{ color: kgLost > 0 ? WL_COLOR : "var(--text-dim)" }}>
                {kgLost > 0 ? `${Math.round(pctToGoal)}% of your goal achieved` : "Log your first weigh-in below"}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span>🪙</span>
                <span className="text-sm font-black" style={{ color: "#fbbf24" }}>{profile.totalCoinsEarned}</span>
                <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>coins</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span>🎉</span>
                <span className="text-sm font-black" style={{ color: WL_COLOR }}>{profile.cheatDaysAvailable}</span>
                <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>cheat</span>
              </div>
            </div>
          </div>

          {/* Journey track */}
          <div className="relative mb-4">
            <div className="flex justify-between text-[10px] font-bold mb-2">
              <span style={{ color: "var(--text-dim)" }}>Start · {startKg} kg</span>
              <span style={{ color: WL_COLOR }}>Goal · {goalKg} kg</span>
            </div>
            {/* Track */}
            <div className="relative h-3 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              {/* Filled portion */}
              <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(2.5, pctToGoal)}%`,
                  background: `linear-gradient(90deg, #34d399, ${WL_COLOR})`,
                }} />
              {/* Glowing dot */}
              <div className="absolute top-1/2 w-5 h-5 rounded-full transition-all duration-700"
                style={{
                  left: `calc(${Math.max(2.5, pctToGoal)}% - 10px)`,
                  transform: "translateY(-50%)",
                  background: WL_COLOR,
                  border: "2.5px solid var(--bg-base)",
                  boxShadow: `0 0 12px ${WL_COLOR}90`,
                }} />
            </div>
            {/* Percent label */}
            <div className="flex justify-center mt-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: `${WL_COLOR}15`, color: WL_COLOR, border: `1px solid ${WL_COLOR}25` }}>
                {Math.round(pctToGoal)}% there
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Weeks planned", value: `${profile.timelineWeeks}` },
              { label: "Still to lose", value: remainingKg > 0 ? `${remainingKg.toFixed(1)} kg` : "Goal! 🎉" },
              { label: "Daily target", value: `${profile.dailyCalorieTarget}`, unit: "kcal" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-2.5 text-center"
                style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--text-dim)" }}>{s.label}</p>
                <p className="text-sm font-black leading-tight" style={{ color: "var(--text-main)" }}>{s.value}</p>
                {s.unit && <p className="text-[9px]" style={{ color: "var(--text-dim)" }}>{s.unit}</p>}
              </div>
            ))}
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
          style={{ background: `linear-gradient(135deg, #34d399, ${WL_COLOR})` }}>
          Save
        </button>
      </div>

      {/* Adherence cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <AdherenceCard label="Meal adherence" pct={data?.avgMealAdherence ?? null} emoji="🍽️" />
        <AdherenceCard label="Workout adherence" pct={data?.avgWorkoutAdherence ?? null} emoji="💪" />
      </div>

      {/* Weight chart */}
      {weightEntries.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>
            Weight history
          </p>
          <MiniWeightChart entries={weightEntries} />
        </div>
      )}

      {/* Coach adjustments */}
      {adjustments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>
            Recent coach actions
          </p>
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div key={adj.id} className="rounded-2xl p-4"
                style={{
                  background: adj.type === "punishment" ? "rgba(239,68,68,0.06)" : `${WL_COLOR}08`,
                  border: `1px solid ${adj.type === "punishment" ? "rgba(239,68,68,0.2)" : `${WL_COLOR}25`}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: adj.type === "punishment" ? "#f87171" : WL_COLOR }}>
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
          <p className="text-sm">Log meals & workouts to see your adherence stats here</p>
        </div>
      )}
    </div>
  );
}

function AdherenceCard({ label, pct, emoji }: { label: string; pct: number | null; emoji: string }) {
  const val = pct !== null ? Math.round(pct) : null;
  const color = val === null ? "var(--text-dim)" : val >= 80 ? WL_COLOR : val >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ fontSize: 24 }}>{emoji}</p>
      <p className="text-2xl font-black mt-1" style={{ color }}>{val !== null ? `${val}%` : "—"}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>{label}</p>
      {val !== null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${val}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

function MiniWeightChart({ entries }: { entries: Array<{ date: string; weight: number }> }) {
  const last14 = entries.slice(-14);
  if (last14.length < 2) {
    return <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>Need at least 2 weigh-ins to show chart</p>;
  }
  const min = Math.min(...last14.map((e) => e.weight)) - 0.5;
  const max = Math.max(...last14.map((e) => e.weight)) + 0.5;
  const range = max - min || 1;
  const W = 280;
  const H = 80;

  const pts = last14.map((e, i) => ({
    x: (i / (last14.length - 1)) * W,
    y: H - ((e.weight - min) / range) * (H - 10),
    weight: e.weight,
    date: e.date,
  }));

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${H} ${polyline} ${W},${H}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 6}`} width="100%" height={H + 6} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WL_COLOR} stopOpacity="0.28" />
            <stop offset="100%" stopColor={WL_COLOR} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon points={area} fill="url(#areaGrad)" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={WL_COLOR} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={WL_COLOR}
            stroke="var(--bg-base)" strokeWidth={1.5} />
        ))}
        {/* First + last weight labels */}
        <text x={pts[0].x} y={H + 6} textAnchor="start" fontSize="8.5"
          fill="rgba(255,255,255,0.35)" fontFamily="inherit">
          {pts[0].weight} kg
        </text>
        <text x={pts[pts.length - 1].x} y={H + 6} textAnchor="end" fontSize="8.5"
          fill="rgba(255,255,255,0.35)" fontFamily="inherit">
          {pts[pts.length - 1].weight} kg
        </text>
      </svg>
      <div className="flex justify-between mt-1.5">
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
        style={{ borderColor: `${WL_COLOR} transparent transparent transparent` }} />
    </div>
  );
}
