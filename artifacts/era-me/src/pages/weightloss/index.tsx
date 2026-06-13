import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Flame, Trophy, Calendar, MessageCircle, Calculator, TrendingDown } from "lucide-react";
import { useWLProfile, useWLToday, WL_COLOR } from "@/lib/weightloss-api";
import WLOnboarding from "./onboarding";

export default function WeightLossPage() {
  const { data, isLoading } = useWLProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, navigate] = useLocation();

  if (isLoading) return <Spinner />;

  if (showOnboarding || !data?.onboardingComplete) {
    return (
      <WLOnboarding
        onDone={() => { setShowOnboarding(false); window.location.reload(); }}
      />
    );
  }

  return <Dashboard onBack={() => navigate("/profile")} />;
}

function Dashboard({ onBack }: { onBack: () => void }) {
  const { data: today } = useWLToday();
  const { data: profileData } = useWLProfile();
  const [, navigate] = useLocation();

  const profile = today?.profile;
  const wlProfile = profileData?.profile;
  const consumed = today?.caloriesConsumed ?? 0;
  const target = profile?.dailyCalorieTarget ?? 2000;
  const remaining = today?.caloriesRemaining ?? target;
  const pct = Math.min(1, consumed / target);

  const r = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const goalKg = wlProfile?.goalWeightKg ?? 0;
  const pendingCount = today?.pendingAdjustments?.length ?? 0;

  return (
    <div className="px-4 pt-5 pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 -ml-1" style={{ color: "var(--text-sub)" }}>
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <span style={{ fontSize: 14 }}>🪙</span>
            <span className="text-sm font-bold" style={{ color: "#fbbf24" }}>{profile?.coinsAvailable ?? 0}</span>
          </div>
          {(profile?.cheatDaysAvailable ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: `${WL_COLOR}15`, border: `1px solid ${WL_COLOR}30` }}>
              <span style={{ fontSize: 12 }}>🎉</span>
              <span className="text-xs font-bold" style={{ color: WL_COLOR }}>{profile!.cheatDaysAvailable}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-3xl p-5 mb-4 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.07) 55%, rgba(16,185,129,0.03) 100%)",
          border: "1px solid rgba(16,185,129,0.22)",
        }}>
        {/* Ambient glow behind ring */}
        <div className="absolute pointer-events-none"
          style={{
            top: 0, left: "50%",
            transform: "translate(-50%, -38%)",
            width: 260, height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)",
          }} />

        {/* Label row */}
        <div className="flex items-start justify-between mb-3 relative">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: WL_COLOR }}>
              Daily calories
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              {wlProfile?.timelineWeeks ? `${wlProfile.timelineWeeks}-week programme` : "Your programme"}
            </p>
          </div>
          {goalKg > 0 && (
            <div className="text-right">
              <p className="text-sm font-black" style={{ color: "var(--text-main)" }}>{goalKg} kg</p>
              <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>goal weight</p>
            </div>
          )}
        </div>

        {/* Ring */}
        <div className="flex justify-center mb-4 relative">
          <div className="relative">
            <div className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: `0 0 48px rgba(16,185,129,${(pct * 0.5).toFixed(2)})` }} />
            <svg width={164} height={164} viewBox="0 0 164 164">
              <circle cx={82} cy={82} r={r} fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth={14} />
              <circle
                cx={82} cy={82} r={r}
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 82 82)"
                style={{ transition: "stroke-dashoffset 0.75s cubic-bezier(0.4,0,0.2,1)" }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor={WL_COLOR} />
                </linearGradient>
              </defs>
              {/* Consumed number */}
              <text x={82} y={76} textAnchor="middle" fontSize="32" fontWeight="900" fill="white" fontFamily="inherit">
                {consumed}
              </text>
              <text x={82} y={92} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.38)" fontFamily="inherit">
                kcal eaten
              </text>
              <text x={82} y={110} textAnchor="middle" fontSize="12" fontWeight="700"
                fill={remaining < 0 ? "#f87171" : WL_COLOR} fontFamily="inherit">
                {remaining > 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
              </text>
            </svg>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Target", value: `${target}`, unit: "kcal" },
            { label: "Consumed", value: `${consumed}`, unit: "kcal" },
            { label: "Goal wt", value: goalKg ? `${goalKg}` : "—", unit: "kg" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-2.5 text-center"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--text-dim)" }}>{s.label}</p>
              <p className="text-lg font-black" style={{ color: "var(--text-main)" }}>{s.value}</p>
              <p className="text-[9px]" style={{ color: "var(--text-dim)" }}>{s.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <button onClick={() => navigate("/weightloss/today")}
          className="w-full rounded-2xl p-3.5 flex items-center gap-3 mb-4 transition active:scale-[0.98]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              {pendingCount} coach adjustment{pendingCount > 1 ? "s" : ""} pending
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>Tap to view details</p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
        </button>
      )}

      {/* Action grid */}
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>Quick actions</p>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { icon: <Flame className="w-5 h-5" />, label: "Today's Plan", sub: "Meals & workout", href: "/weightloss/today", color: "#f97316" },
          { icon: <Calendar className="w-5 h-5" />, label: "Weekly Plan", sub: "7-day schedule", href: "/weightloss/plan", color: WL_COLOR },
          { icon: <Calculator className="w-5 h-5" />, label: "Calorie Calc", sub: "Check any food", href: "/weightloss/calculator", color: "#a855f7" },
          { icon: <MessageCircle className="w-5 h-5" />, label: "Coach Chat", sub: "Ask your coach", href: "/weightloss/coach", color: "#3b82f6" },
          { icon: <TrendingDown className="w-5 h-5" />, label: "Progress", sub: "Weight & adherence", href: "/weightloss/progress", color: "#14b8a6" },
          { icon: <Trophy className="w-5 h-5" />, label: "Rewards", sub: `${profile?.coinsAvailable ?? 0} coins earned`, href: "/weightloss/progress", color: "#fbbf24" },
        ].map((c) => (
          <button key={c.label} onClick={() => navigate(c.href)}
            className="rounded-2xl p-4 flex items-center gap-3 text-left transition active:scale-[0.97]"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${c.color}38, ${c.color}12)`,
                border: `1px solid ${c.color}28`,
                color: c.color,
              }}>
              {c.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-main)" }}>{c.label}</p>
              <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--text-dim)" }}>{c.sub}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-dim)", opacity: 0.4 }} />
          </button>
        ))}
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
