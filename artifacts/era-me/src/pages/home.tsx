import { Link } from "wouter";
import { ChevronRight, CheckCircle2, Circle, Plus, Minus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { useWellnessToday, useWeekSummary, useLogToday } from "@/lib/wellness-api";
import { useCoins } from "@/lib/hospitals-api";
import type { WeekSummary } from "@/lib/wellness-api";

interface ChecklistItem {
  id: string; emoji: string; label: string; sub?: string; done: boolean;
}
interface ModuleEntry {
  enabled: boolean;
  settings: Record<string, unknown>;
  log: Record<string, unknown> | null;
}
interface TodayData {
  date: string; dayKey: string;
  checklist: ChecklistItem[];
  modules: Record<string, ModuleEntry | undefined>;
}

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", energy: "#84cc16",
  stress: "#a855f7", fruit: "#22c55e", vitals: "#ef4444",
  smoking: "#64748b", eyebreak: "#6366f1", sunscreen: "#eab308",
  outdoors: "#16a34a", hygiene: "#93c5fd", eyebreak2: "#818cf8",
};

function moduleHref(id: string): string {
  if (id === "mood_check") return "/wellness/mood";
  return `/wellness/${id}`;
}

function todayIndex(weekStart: string): number {
  const start = new Date(weekStart + "T12:00:00");
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.min(6, Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000)));
}

function deriveInsight(
  checklist: ChecklistItem[],
  summary: WeekSummary | undefined
): { type: "win" | "nudge" | "info"; icon: string; text: string; href?: string } | null {
  const hour = new Date().getHours();
  const done = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  if (total === 0) return null;

  if (done === total) {
    return { type: "win", icon: "🎉", text: "You've completed everything for today — great work!" };
  }
  const rate = summary?.overallRate ?? 0;
  if (rate >= 75 && done >= Math.ceil(total / 2)) {
    return { type: "win", icon: "🔥", text: `${rate}% this week — you're on a roll! Keep it up.`, href: "/plan" };
  }
  const first = checklist.find((c) => !c.done);
  if (first && hour >= 11) {
    return { type: "nudge", icon: first.emoji, text: `Time to log your ${first.label}!`, href: moduleHref(first.id) };
  }
  if (hour < 9) {
    return { type: "info", icon: "🌅", text: "Good morning! Your daily wellness plan is ready." };
  }
  return { type: "info", icon: "✨", text: `${done} of ${total} tasks done today — keep going!` };
}

export default function HomePage() {
  const { account } = useAuth();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();
  const logWater = useLogToday("water");

  const { data: coinsData } = useCoins();
  const coins = coinsData?.coins ?? 0;

  const mods = todayData?.modules ?? {};
  const waterMod = mods.water;
  const waterEnabled = waterMod?.enabled ?? false;
  const waterCups = (waterMod?.log?.cups as number | undefined) ?? 0;
  const waterGoal = (waterMod?.settings?.target as number | undefined) ?? 8;
  const waterLeft = Math.max(0, waterGoal - waterCups);
  const waterPct = Math.min(100, Math.round((waterCups / waterGoal) * 100));

  const checklist: ChecklistItem[] = todayData?.checklist ?? [];
  const doneItems = checklist.filter((c) => c.done);
  const pendingItems = checklist.filter((c) => !c.done);
  const doneCount = doneItems.length;
  const total = checklist.length;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const insight = deriveInsight(checklist, summary);

  return (
    <div className="pb-10">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="relative px-5 pt-8 pb-7 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle,rgba(var(--glow-rgb),1) 0%,transparent 70%)`, filter: "blur(56px)" }} />
          <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full opacity-10"
            style={{ background: `radial-gradient(circle,rgba(var(--glow-rgb),0.6) 0%,transparent 70%)`, filter: "blur(44px)" }} />
        </div>
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: 500 }}>
                {formatDate()}
              </p>
              {coins > 0 && (
                <Link href="/profile">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full active:scale-95 transition"
                    style={{ background: "linear-gradient(135deg,#92400e,#d97706)", boxShadow: "0 2px 8px rgba(217,119,6,0.4)" }}>
                    <span style={{ fontSize: 10 }}>🪙</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{coins}</span>
                  </div>
                </Link>
              )}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: "#fff" }}>
              {greeting()},<br />
              <span style={{ background: "linear-gradient(120deg,#5eead4,#14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {displayName} 👋
              </span>
            </h1>
            {total > 0 && (
              <p style={{ marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
                {doneCount === total ? "All tasks complete today 🎉" : `${doneCount} of ${total} tasks done`}
              </p>
            )}
          </div>

          {total > 0 && (
            <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
              <svg className="w-full h-full -rotate-90" viewBox="0 0 76 76">
                <circle cx="38" cy="38" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                <circle cx="38" cy="38" r="30" fill="none"
                  stroke={completionPct === 100 ? "#4ade80" : "var(--accent)"}
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - completionPct / 100)}`}
                  style={{
                    filter: `drop-shadow(0 0 7px ${completionPct === 100 ? "rgba(74,222,128,0.9)" : "rgba(20,184,166,0.9)"})`,
                    transition: "stroke-dashoffset 0.8s ease",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {completionPct === 100
                  ? <span style={{ fontSize: 24 }}>🎉</span>
                  : <>
                    <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{completionPct}%</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>done</span>
                  </>
                }
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* ── Insight Banner ─────────────────────────────────────────── */}
        {insight && <InsightBanner insight={insight} />}

        {/* ── Live Water Widget ─────────────────────────────────────── */}
        {waterEnabled && (
          <div className="rounded-2xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg,rgba(12,74,110,0.7),rgba(3,105,161,0.5))", border: "1px solid rgba(56,189,248,0.22)", boxShadow: "0 4px 24px rgba(56,189,248,0.12)" }}>
            <div className="pointer-events-none absolute bottom-0 right-0 w-40 h-40 rounded-full"
              style={{ background: "radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 70%)", filter: "blur(20px)" }} />
            <div className="relative p-4">
              <p style={{ fontSize: 11, color: "rgba(56,189,248,0.8)", fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>💧 WATER TODAY</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{waterCups}</span>
                    <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>/ {waterGoal} cups</span>
                  </div>
                  <p style={{ fontSize: 12, marginTop: 3, color: waterPct >= 100 ? "#4ade80" : "rgba(255,255,255,0.45)" }}>
                    {waterPct >= 100 ? "Goal reached! 🎉" : `${waterLeft} more cup${waterLeft !== 1 ? "s" : ""} to go`}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => logWater.mutate({ cups: Math.min(waterCups + 1, 20) })}
                    disabled={logWater.isPending}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-90 transition text-white font-bold"
                    style={{ background: "linear-gradient(135deg,#0c4a6e,#0369a1)", boxShadow: "0 4px 16px rgba(56,189,248,0.35)", border: "1px solid rgba(56,189,248,0.3)" }}>
                    <Plus className="w-5 h-5" />
                  </button>
                  <button onClick={() => { if (waterCups > 0) logWater.mutate({ cups: waterCups - 1 }); }}
                    disabled={logWater.isPending || waterCups === 0}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-90 transition"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                    <Minus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Fill bar */}
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${waterPct}%`, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", boxShadow: "0 0 8px rgba(56,189,248,0.6)" }} />
              </div>

              {/* Cup dots */}
              <div className="flex gap-1 mt-2 flex-wrap">
                {Array.from({ length: Math.min(waterGoal, 14) }, (_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full transition-colors duration-200"
                    style={{ background: i < waterCups ? "rgba(56,189,248,0.7)" : "rgba(255,255,255,0.07)" }} />
                ))}
                {waterGoal > 14 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 2 }}>+{waterGoal - 14}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Today's Plan ──────────────────────────────────────────── */}
        {total > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Today's plan</h2>
              <Link href="/plan">
                <span style={{ fontSize: 12, color: "#14b8a6", fontWeight: 600 }}>View week →</span>
              </Link>
            </div>
            {/* Progress bar */}
            <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct === 100 ? "#4ade80" : "linear-gradient(90deg,#0d9488,#14b8a6)",
                  boxShadow: "0 0 8px rgba(20,184,166,0.5)",
                }} />
            </div>

            <div className="space-y-2">
              {pendingItems.map((item) => <CheckRow key={item.id} item={item} />)}
              {doneItems.map((item) => <CheckRow key={item.id} item={item} />)}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✨</p>
            <p style={{ fontWeight: 700, color: "#fff", fontSize: 15, marginBottom: 6 }}>Your plan is empty</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20, lineHeight: 1.5 }}>
              Set up wellness modules to see your daily plan and weekly habit tracker here.
            </p>
            <Link href="/wellness">
              <button className="px-6 py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition"
                style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}>
                Set up wellness →
              </button>
            </Link>
          </div>
        )}

        {/* ── This Week (compact grid) ──────────────────────────────── */}
        {summary && summary.moduleStats.length > 0 && (
          <ThisWeekCard summary={summary} />
        )}

        {/* ── Quick Access ──────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Quick access</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard href="/wellness"  emoji="💚" label="My Wellness"    description="Habits & modules"       gradient="linear-gradient(135deg,#064e3b,#065f46)" accent="#10b981" />
            <QuickCard href="/plan"      emoji="📅" label="Weekly Plan"    description="Your habit grid"        gradient="linear-gradient(135deg,#1e3a5f,#1e40af)" accent="#60a5fa" />
            <QuickCard href="/hospitals" emoji="🏥" label="Hospitals"      description="Connected hospitals"    gradient="linear-gradient(135deg,#1c2e4a,#1e3a5f)" accent="#7dd3fc" />
            <QuickCard href="/companion" emoji="🤖" label="Companion"      description="Journal & AI chat"      gradient="linear-gradient(135deg,#1c1917,#292524)" accent="#d6d3d1" />
          </div>
        </section>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightBanner({ insight }: {
  insight: { type: "win" | "nudge" | "info"; icon: string; text: string; href?: string };
}) {
  const palette = {
    win:   { bg: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(20,184,166,0.07))", border: "rgba(16,185,129,0.28)", accent: "#6ee7b7" },
    nudge: { bg: "linear-gradient(135deg,rgba(251,191,36,0.11),rgba(245,158,11,0.06))", border: "rgba(251,191,36,0.22)", accent: "#fcd34d" },
    info:  { bg: "linear-gradient(135deg,rgba(99,102,241,0.11),rgba(79,70,229,0.06))",  border: "rgba(99,102,241,0.22)", accent: "#a5b4fc" },
  }[insight.type];

  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{insight.icon}</span>
      <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.45 }}>{insight.text}</p>
      {insight.href && <ChevronRight style={{ width: 16, height: 16, color: palette.accent, flexShrink: 0 }} />}
    </div>
  );

  return insight.href ? <Link href={insight.href}>{inner}</Link> : <>{inner}</>;
}

function CheckRow({ item }: { item: ChecklistItem }) {
  const accent = MODULE_ACCENT[item.id] ?? "#14b8a6";
  return (
    <Link href={moduleHref(item.id)}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
        style={{
          background: item.done ? "rgba(20,184,166,0.07)" : `${accent}0f`,
          border: `1px solid ${item.done ? "rgba(20,184,166,0.18)" : `${accent}28`}`,
        }}>
        <div style={{ flexShrink: 0 }}>
          {item.done
            ? <CheckCircle2 style={{ width: 20, height: 20, color: "#14b8a6" }} />
            : <Circle style={{ width: 20, height: 20, color: accent, opacity: 0.55 }} />
          }
        </div>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 14, fontWeight: 600, lineHeight: 1.3,
            color: item.done ? "rgba(255,255,255,0.32)" : "#fff",
            textDecoration: item.done ? "line-through" : "none",
          }}>
            {item.label}
          </p>
          {item.sub && (
            <p style={{ fontSize: 11, marginTop: 1.5, color: item.done ? "rgba(255,255,255,0.22)" : accent }}>
              {item.sub}
            </p>
          )}
        </div>
        <ChevronRight style={{ width: 15, height: 15, flexShrink: 0, color: item.done ? "rgba(255,255,255,0.14)" : accent }} />
      </div>
    </Link>
  );
}

function ThisWeekCard({ summary }: { summary: WeekSummary }) {
  const { moduleStats, overallRate, weekStart } = summary;
  const rateColor = overallRate >= 80 ? "#4ade80" : overallRate >= 50 ? "#fbbf24" : "#f87171";
  const todayIdx = todayIndex(weekStart);
  const DAY_CHARS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>This week</h2>
        <Link href="/plan">
          <span style={{ fontSize: 12, color: "#14b8a6", fontWeight: 600 }}>Full plan →</span>
        </Link>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Rate header */}
        <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>Overall completion</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: rateColor, filter: `drop-shadow(0 0 6px ${rateColor}70)`, lineHeight: 1 }}>{overallRate}%</p>
        </div>
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full transition-all duration-800"
              style={{ width: `${overallRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
          </div>
        </div>

        {/* Day column headers */}
        <div className="px-4 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 3, paddingTop: 8 }}>
            <div />
            {DAY_CHARS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 9, fontWeight: 700,
                color: i === todayIdx ? "#14b8a6" : "rgba(255,255,255,0.25)",
                padding: "2px 0",
                borderRadius: 3,
                background: i === todayIdx ? "rgba(20,184,166,0.1)" : "transparent",
              }}>
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Module rows */}
        <div>
          {moduleStats.map((stat) => {
            const accent = MODULE_ACCENT[stat.type] ?? "#14b8a6";
            return (
              <Link key={stat.type} href={moduleHref(stat.type)}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                  gap: 3,
                  padding: "7px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  alignItems: "center",
                  cursor: "pointer",
                }}>
                  <span style={{ fontSize: 13, textAlign: "center" }}>{stat.emoji}</span>
                  {stat.days.map((done, i) => {
                    const isFuture = i > todayIdx;
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} style={{
                        height: 18,
                        borderRadius: 4,
                        background: done ? accent : isFuture ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.09)",
                        border: isToday ? `1.5px solid ${accent}80` : "1px solid transparent",
                        boxShadow: done ? `0 0 5px ${accent}55` : "none",
                        opacity: isFuture ? 0.45 : 1,
                        transition: "background 0.3s",
                      }} />
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuickCard({ href, emoji, label, description, gradient, accent }: {
  href: string; emoji: string; label: string; description: string; gradient: string; accent: string;
}) {
  return (
    <Link href={href}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{ background: gradient, border: `1px solid ${accent}2e`, boxShadow: `0 4px 20px ${accent}18`, minHeight: 92 }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.3) 0%,transparent 60%)" }} />
        <p style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</p>
        <p style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{label}</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{description}</p>
      </div>
    </Link>
  );
}
