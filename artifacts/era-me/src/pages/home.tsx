import { Link } from "wouter";
import { Heart, Building2, Users, Sparkles, ChevronRight, Crown, CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate, cn } from "@/lib/utils";
import { useWellnessToday, useWeekSummary } from "@/lib/wellness-api";
import type { WeekSummary } from "@/lib/wellness-api";

interface ChecklistItem {
  id: string;
  emoji: string;
  label: string;
  sub?: string;
  done: boolean;
}

interface TodayData {
  date: string;
  dayKey: string;
  checklist: ChecklistItem[];
  modules: Record<string, unknown>;
}

function moduleHref(id: string): string {
  if (id === "mood_check") return "/wellness/mood";
  return `/wellness/${id}`;
}

const MODULE_COLORS: Record<string, string> = {
  water:       "rgba(56,189,248,0.15)",
  medications: "rgba(20,184,166,0.15)",
  workout:     "rgba(249,115,22,0.15)",
  sleep:       "rgba(139,92,246,0.15)",
  mood_check:  "rgba(251,191,36,0.15)",
  energy:      "rgba(132,204,22,0.15)",
  stress:      "rgba(168,85,247,0.15)",
  fruit:       "rgba(34,197,94,0.15)",
  vitals:      "rgba(239,68,68,0.15)",
  smoking:     "rgba(100,116,139,0.15)",
  eyebreak:    "rgba(99,102,241,0.15)",
  sunscreen:   "rgba(234,179,8,0.15)",
  outdoors:    "rgba(22,163,74,0.15)",
};

const MODULE_ACCENT: Record<string, string> = {
  water:       "#38bdf8",
  medications: "#14b8a6",
  workout:     "#f97316",
  sleep:       "#8b5cf6",
  mood_check:  "#fbbf24",
  energy:      "#84cc16",
  stress:      "#a855f7",
  fruit:       "#22c55e",
  vitals:      "#ef4444",
  smoking:     "#64748b",
  eyebreak:    "#6366f1",
  sunscreen:   "#eab308",
  outdoors:    "#16a34a",
};

export default function HomePage() {
  const { account } = useAuth();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const isPremium = account?.isPremium ?? false;
  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();

  const checklist: ChecklistItem[] = todayData?.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">

      {/* ── Hero greeting ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{formatDate()}</p>
          <h1 className="text-2xl font-bold leading-tight" style={{ background: "linear-gradient(135deg,#fff 30%,#94d4cf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {greeting()},<br />{displayName} 👋
          </h1>
        </div>

        {/* Completion ring */}
        {total > 0 && (
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#14b8a6" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
                style={{ filter: "drop-shadow(0 0 6px rgba(20,184,166,0.8))", transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-white leading-none">{pct}%</span>
              <span className="text-[9px] leading-none" style={{ color: "rgba(255,255,255,0.45)" }}>done</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Premium banner ─────────────────────────────────────────── */}
      {!isPremium && (
        <Link href="/pricing">
          <div className="relative rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition overflow-hidden"
            style={{ background: "linear-gradient(135deg,#92400e,#d97706,#f59e0b)", boxShadow: "0 8px 32px rgba(245,158,11,0.3)" }}>
            <div className="absolute inset-0 opacity-20"
              style={{ background: "repeating-linear-gradient(-45deg,transparent,transparent 8px,rgba(255,255,255,0.1) 8px,rgba(255,255,255,0.1) 9px)" }} />
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0 relative">
              <p className="text-white font-bold text-sm">Unlock ERA Premium</p>
              <p className="text-white/75 text-xs mt-0.5">Companion, hospital connections & more</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 shrink-0 relative" />
          </div>
        </Link>
      )}

      {/* ── Today's plan ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">Today's plan</h2>
          {total > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.25)" }}>
              {doneCount}/{total} done
            </span>
          )}
        </div>

        {checklist.length > 0 ? (
          <div className="space-y-2.5">
            {checklist.map((item) => {
              const accent = MODULE_ACCENT[item.id] ?? "#14b8a6";
              const bg = MODULE_COLORS[item.id] ?? "rgba(20,184,166,0.1)";
              return (
                <Link key={item.id} href={moduleHref(item.id)}>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                    style={{
                      background: item.done ? "rgba(20,184,166,0.1)" : bg,
                      border: `1px solid ${item.done ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: item.done ? `0 0 20px rgba(20,184,166,0.08)` : "none",
                    }}>
                    <div className="w-4 h-4 shrink-0">
                      {item.done
                        ? <CheckCircle2 className="w-4 h-4" style={{ color: "#14b8a6" }} />
                        : <Circle className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />}
                    </div>
                    <span className="text-xl shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", item.done ? "line-through" : "text-white")}
                        style={{ color: item.done ? "rgba(255,255,255,0.35)" : undefined }}>
                        {item.label}
                      </p>
                      {item.sub && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{item.sub}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: accent, opacity: 0.7 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)" }}>
              <Sparkles className="w-7 h-7" style={{ color: "#14b8a6" }} />
            </div>
            <p className="font-bold text-white mb-1">Nothing set up yet</p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
              Set up your wellness modules and your daily plan will appear here.
            </p>
            <Link href="/wellness">
              <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-95"
                style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}>
                Set up wellness
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Weekly summary ──────────────────────────────────────────── */}
      {summary && summary.moduleStats.length > 0 && (
        <WeeklySummaryCard summary={summary} />
      )}

      {/* ── Quick access ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-white mb-3">Quick access</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickCard href="/wellness"
            emoji="💚" label="My Wellness" description="Habits & tracking"
            gradient="linear-gradient(135deg,#064e3b,#065f46)" accent="#10b981" />
          <QuickCard href={isPremium ? "/hospitals" : "/pricing"}
            emoji="🏥" label="Hospitals" description="Your connected hospitals"
            gradient="linear-gradient(135deg,#1e3a5f,#1e40af)" accent="#60a5fa"
            locked={!isPremium} />
          <QuickCard href="/social"
            emoji="👥" label="Social" description="Partners & streaks"
            gradient="linear-gradient(135deg,#3b0764,#6d28d9)" accent="#a78bfa" />
        </div>
      </div>

    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: WeekSummary }) {
  const { moduleStats, moodAvg, overallRate, weekStart, weekEnd } = summary;
  const startLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const endLabel   = new Date(weekEnd   + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });

  const rateColor = overallRate >= 80 ? "#10b981" : overallRate >= 50 ? "#f59e0b" : "#ef4444";
  const rateGlow  = overallRate >= 80 ? "rgba(16,185,129,0.3)" : overallRate >= 50 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">This week</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{startLabel} – {endLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black" style={{ color: rateColor, filter: `drop-shadow(0 0 8px ${rateGlow})` }}>
            {overallRate}%
          </p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>completed</p>
        </div>
      </div>

      {/* Overall bar */}
      <div className="px-4 pb-4">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${overallRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateGlow}` }} />
        </div>
      </div>

      {/* Per-module rows */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {moduleStats.map((stat) => {
          const accent = MODULE_ACCENT[stat.type] ?? "#14b8a6";
          return (
            <div key={stat.type} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-base w-6 text-center shrink-0">{stat.emoji}</span>
              <div className="flex gap-1 flex-1">
                {stat.days.map((done, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full"
                    style={{ background: done ? accent : "rgba(255,255,255,0.08)",
                      boxShadow: done ? `0 0 4px ${accent}80` : "none" }} />
                ))}
              </div>
              <span className="text-xs font-bold w-8 text-right shrink-0" style={{ color: accent }}>
                {stat.completedDays}/7
              </span>
            </div>
          );
        })}
      </div>

      {/* Mood */}
      {moodAvg && (
        <div className="px-4 py-3 flex items-center gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Avg mood</p>
          <div className="flex gap-4 flex-1">
            <MoodPip label="😊" value={moodAvg.mood} />
            <MoodPip label="⚡" value={moodAvg.energy} />
            <MoodPip label="🧘" value={moodAvg.stress} invert />
          </div>
        </div>
      )}
    </div>
  );
}

function MoodPip({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const filled = Math.round(value);
  const good = invert ? 6 - filled : filled;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-2 h-2 rounded-full"
            style={{ background: i < good ? "#14b8a6" : "rgba(255,255,255,0.1)",
              boxShadow: i < good ? "0 0 4px rgba(20,184,166,0.6)" : "none" }} />
        ))}
      </div>
    </div>
  );
}

function QuickCard({ href, emoji, label, description, gradient, accent, locked = false }: {
  href: string; emoji: string; label: string; description: string;
  gradient: string; accent: string; locked?: boolean;
}) {
  return (
    <Link href={href}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{ background: gradient, border: `1px solid ${accent}30`, boxShadow: `0 4px 20px ${accent}20` }}>
        <div className="text-2xl mb-2">{emoji}</div>
        <p className="font-bold text-white text-sm">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{description}</p>
        {locked && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.2)" }}>
            <Crown className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
          </div>
        )}
      </div>
    </Link>
  );
}
