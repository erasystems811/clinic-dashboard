import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Flame, Trophy, Calendar, MessageCircle, Calculator, TrendingDown } from "lucide-react";
import { useWLProfile, useWLToday } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { FullPageSpinner } from "@/components/spinner";
import WLOnboarding from "./onboarding";

export default function WeightLossPage() {
  const { data, isLoading } = useWLProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, navigate] = useLocation();
  useWLTheme();

  if (isLoading) return <FullPageSpinner />;

  if (showOnboarding || !data?.onboardingComplete) {
    return (
      <WLOnboarding
        onDone={() => {
          setShowOnboarding(false);
          window.location.reload();
        }}
      />
    );
  }

  return <Dashboard onBack={() => navigate("/profile")} />;
}

function Dashboard({ onBack }: { onBack: () => void }) {
  const { data: today } = useWLToday();
  const [, navigate] = useLocation();

  const profile = today?.profile;
  const consumed = today?.caloriesConsumed ?? 0;
  const target = profile?.dailyCalorieTarget ?? 2000;
  const remaining = today?.caloriesRemaining ?? target;
  const pct = Math.min(1, consumed / target);

  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const pendingCount = today?.pendingAdjustments?.length ?? 0;

  return (
    <div className="px-5 pt-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 -ml-1" style={{ color: "var(--text-sub)" }}>
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>🪙</span>
          <span className="text-sm font-bold" style={{ color: "#fbbf24" }}>{profile?.coinsAvailable ?? 0}</span>
          {(profile?.cheatDaysAvailable ?? 0) > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(var(--glow-rgb),0.13)", color: "var(--accent)", border: "1px solid rgba(var(--glow-rgb),0.25)" }}>
              🎉 {profile!.cheatDaysAvailable} cheat day{profile!.cheatDaysAvailable > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="text-center mb-2">
        <p className="text-3xl font-black" style={{ color: "var(--text-main)" }}>Weight Loss</p>
        <p className="text-sm" style={{ color: "var(--text-sub)" }}>Coach-guided · Nigeria-first</p>
      </div>

      {/* Calorie ring */}
      <div className="flex justify-center mt-6 mb-6">
        <div className="relative">
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth={12} />
            <circle
              cx={70} cy={70} r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text x={70} y={64} textAnchor="middle" fontSize="26" fontWeight="900" fill="white" fontFamily="inherit">
              {consumed}
            </text>
            <text x={70} y={80} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)" fontFamily="inherit">
              kcal eaten
            </text>
            <text x={70} y={96} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--accent)" fontFamily="inherit">
              {remaining > 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
            </text>
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: "Target", value: `${target}`, unit: "kcal" },
          { label: "Consumed", value: `${consumed}`, unit: "kcal" },
          {
            label: "Goal",
            value: profile ? `${profile.goalWeightKg}` : "—",
            unit: "kg",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-3 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-dim)" }}>{s.label}</p>
            <p className="text-xl font-black" style={{ color: "var(--text-main)" }}>{s.value}</p>
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>{s.unit}</p>
          </div>
        ))}
      </div>

      {/* Pending adjustments banner */}
      {pendingCount > 0 && (
        <button
          onClick={() => navigate("/weightloss/today")}
          className="w-full rounded-2xl p-3 flex items-center gap-3 mb-4 transition active:scale-[0.98]"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              {pendingCount} pending coach adjustment{pendingCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>Tap to view details</p>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
        </button>
      )}

      {/* Quick action cards */}
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Quick actions</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Flame className="w-5 h-5" />, label: "Today's Plan", sub: "Meals & workout", href: "/weightloss/today", color: "#f97316" },
          { icon: <Calendar className="w-5 h-5" />, label: "Weekly Plan", sub: "7-day schedule", href: "/weightloss/plan", color: "var(--accent)" },
          { icon: <Calculator className="w-5 h-5" />, label: "Calorie Calc", sub: "Check food calories", href: "/weightloss/calculator", color: "#a855f7" },
          { icon: <MessageCircle className="w-5 h-5" />, label: "Coach Chat", sub: "Ask your coach", href: "/weightloss/coach", color: "#3b82f6" },
          { icon: <TrendingDown className="w-5 h-5" />, label: "Progress", sub: "Weight & adherence", href: "/weightloss/progress", color: "#14b8a6" },
          { icon: <Trophy className="w-5 h-5" />, label: "Rewards", sub: "Coins & cheat days", href: "/weightloss/progress", color: "#fbbf24" },
        ].map((c) => (
          <button key={c.label} onClick={() => navigate(c.href)}
            className="rounded-2xl p-4 text-left flex items-start gap-3 transition active:scale-[0.97]"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${c.color}20`, color: c.color }}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-main)" }}>{c.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{c.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

