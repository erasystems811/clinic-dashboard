import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, CheckCircle2, Circle, Plus, Minus, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { useWellnessToday, useWeekSummary, useLogToday, useAiInsight } from "@/lib/wellness-api";
import { useCoins } from "@/lib/hospitals-api";
import { canNotify, notifPermission, requestNotifPermission, fireNotification, maybeFireEveningReminder } from "@/lib/notifications";
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
  outdoors: "#16a34a", hygiene: "#93c5fd",
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

function computeEraScore(completionPct: number, weekRate: number): { score: number; label: string; color: string } {
  if (completionPct === 0 && weekRate === 0) {
    return { score: 0, label: "Just Getting Started", color: "#64748b" };
  }
  const score = Math.min(100, Math.round(weekRate * 0.55 + completionPct * 0.45));
  if (score >= 90) return { score, label: "Wellness Champion 🏆", color: "#4ade80" };
  if (score >= 75) return { score, label: "Consistently Healthy", color: "#86efac" };
  if (score >= 60) return { score, label: "Finding Your Rhythm", color: "#fbbf24" };
  if (score >= 40) return { score, label: "Building Habits", color: "#fb923c" };
  return { score, label: "Just Getting Started", color: "#94a3b8" };
}

function getUrgency(pendingCount: number): { level: 1 | 2; hoursLeft: number; minutesLeft: number } | null {
  if (pendingCount === 0) return null;
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const msLeft = midnight.getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);
  if (hoursLeft < 2) return { level: 2, hoursLeft, minutesLeft };
  if (hoursLeft < 5) return { level: 1, hoursLeft, minutesLeft };
  return null;
}

export default function HomePage() {
  const { account } = useAuth();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();
  const { data: aiData, isLoading: aiLoading } = useAiInsight();
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
  const weekRate = summary?.overallRate ?? 0;
  const eraScore = computeEraScore(completionPct, weekRate);
  const urgency = getUrgency(pendingItems.length);
  const aiInsight = aiData?.insight ?? null;

  // Notification prompt — shown once when permission not yet asked
  const [showNotifPrompt, setShowNotifPrompt] = useState(() => {
    if (!canNotify()) return false;
    const asked = localStorage.getItem("era_notif_asked");
    return !asked && notifPermission() === "default";
  });

  // Fire evening reminder on mount
  useEffect(() => {
    maybeFireEveningReminder(pendingItems.length);
  }, [pendingItems.length]);

  return (
    <div className="pb-10">

      {/* ── Hero Header ──────────────────────────────────────────── */}
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
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, fontWeight: 500 }}>{formatDate()}</p>
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
              <span style={{ background: "linear-gradient(120deg,var(--accent-light),var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
                  style={{ filter: `drop-shadow(0 0 7px rgba(var(--glow-rgb),0.9))`, transition: "stroke-dashoffset 0.8s ease" }}
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

      <div className="px-4 space-y-4">

        {/* ── ERA Score + AI Insight Card ───────────────────────── */}
        {(total > 0 || summary) && (
          <EraScoreCard score={eraScore.score} label={eraScore.label} color={eraScore.color}
            completionPct={completionPct} weekRate={weekRate} aiInsight={aiInsight} aiLoading={aiLoading} />
        )}

        {/* ── Urgency Banner ────────────────────────────────────── */}
        {urgency && <UrgencyBanner pending={pendingItems.length} {...urgency} />}

        {/* ── Notification Opt-In ───────────────────────────────── */}
        {showNotifPrompt && doneCount > 0 && (
          <NotifPrompt onDismiss={() => {
            setShowNotifPrompt(false);
            localStorage.setItem("era_notif_asked", "dismissed");
          }} />
        )}

        {/* ── Live Water Widget ──────────────────────────────────── */}
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
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${waterPct}%`, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", boxShadow: "0 0 8px rgba(56,189,248,0.6)" }} />
              </div>
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

        {/* ── Today's Plan ───────────────────────────────────────── */}
        {total > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Today's plan</h2>
              <Link href="/plan">
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>View week →</span>
              </Link>
            </div>
            <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%`, background: completionPct === 100 ? "#4ade80" : "var(--btn-gradient)", boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)` }} />
            </div>
            <div className="space-y-2">
              {pendingItems.map((item) => <CheckRow key={item.id} item={item} isUrgent={!!urgency} />)}
              {doneItems.map((item) => <CheckRow key={item.id} item={item} isUrgent={false} />)}
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
                style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.3)` }}>
                Set up wellness →
              </button>
            </Link>
          </div>
        )}

        {/* ── This Week Grid ─────────────────────────────────────── */}
        {summary && summary.moduleStats.length > 0 && (
          <ThisWeekCard summary={summary} />
        )}

        {/* ── Quick Access ───────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Quick access</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard href="/wellness"  emoji="💚" label="My Wellness"  description="Habits & modules" />
            <QuickCard href="/plan"      emoji="📅" label="Weekly Plan"  description="Your habit grid" />
            <QuickCard href="/hospitals" emoji="🏥" label="Hospitals"    description="Chat & book" />
            <QuickCard href="/companion" emoji="🤖" label="Companion"    description="Journal & AI chat" />
          </div>
        </section>

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function EraScoreCard({ score, label, color, completionPct, weekRate, aiInsight, aiLoading }: {
  score: number; label: string; color: string;
  completionPct: number; weekRate: number;
  aiInsight: string | null; aiLoading: boolean;
}) {
  const c = 2 * Math.PI * 22;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: `rgba(var(--glow-rgb),0.06)`, border: `1px solid rgba(var(--glow-rgb),0.2)` }}>
      <div className="p-4 flex items-center gap-4">
        {/* Text side */}
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5, marginBottom: 3 }}>ERA SCORE</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score}</p>
          <p style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4, lineHeight: 1.3 }}>{label}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{completionPct}%</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 2 }}>TODAY</p>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{weekRate}%</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: 2 }}>THIS WEEK</p>
            </div>
          </div>
        </div>

        {/* Score ring */}
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <svg className="-rotate-90" viewBox="0 0 54 54" style={{ width: 72, height: 72 }}>
            <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
            <circle cx="27" cy="27" r="22" fill="none"
              stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - score / 100)}
              style={{ filter: `drop-shadow(0 0 5px ${color}90)`, transition: "stroke-dashoffset 1.2s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{score}</span>
          </div>
        </div>
      </div>

      {/* AI insight strip */}
      {(aiInsight || aiLoading) && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>
          {aiLoading && !aiInsight ? (
            <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
              <div className="h-2 rounded-full animate-pulse" style={{ width: "60%", background: "rgba(255,255,255,0.12)" }} />
              <div className="h-2 rounded-full animate-pulse" style={{ width: "30%", background: "rgba(255,255,255,0.08)" }} />
            </div>
          ) : (
            <p style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, lineHeight: 1.5 }}>{aiInsight}</p>
          )}
        </div>
      )}
    </div>
  );
}

function UrgencyBanner({ pending, level, hoursLeft, minutesLeft }: {
  pending: number; level: 1 | 2; hoursLeft: number; minutesLeft: number;
}) {
  const red = level === 2;
  const timeStr = hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{
        background: red ? "linear-gradient(135deg,rgba(239,68,68,0.14),rgba(220,38,38,0.07))" : "linear-gradient(135deg,rgba(249,115,22,0.14),rgba(234,88,12,0.07))",
        border: `1px solid ${red ? "rgba(239,68,68,0.35)" : "rgba(249,115,22,0.3)"}`,
        boxShadow: red ? "0 0 20px rgba(239,68,68,0.12)" : "0 0 16px rgba(249,115,22,0.1)",
      }}>
      <span style={{ fontSize: 20, animation: red ? "pulse 1.5s infinite" : undefined }}>{red ? "🔴" : "⚡"}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          {pending} habit{pending > 1 ? "s" : ""} left · {timeStr} to midnight
        </p>
        <p style={{ fontSize: 11, marginTop: 2, color: red ? "#f87171" : "#fb923c", fontWeight: 600 }}>
          Log now to protect your streak
        </p>
      </div>
    </div>
  );
}

function NotifPrompt({ onDismiss }: { onDismiss: () => void }) {
  const [asking, setAsking] = useState(false);

  async function handleEnable() {
    setAsking(true);
    const granted = await requestNotifPermission();
    localStorage.setItem("era_notif_asked", granted ? "granted" : "denied");
    if (granted) {
      fireNotification("ERA Health 🌿", "Reminders enabled! We'll nudge you each evening to log your habits.");
    }
    onDismiss();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <p style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, lineHeight: 1.4 }}>
        Get evening reminders to complete your daily plan
      </p>
      <button onClick={handleEnable} disabled={asking}
        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 transition disabled:opacity-50"
        style={{ background: "var(--btn-gradient)", flexShrink: 0 }}>
        Enable
      </button>
      <button onClick={onDismiss} className="active:scale-95 transition"
        style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, padding: "2px 4px" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function CheckRow({ item, isUrgent }: { item: ChecklistItem; isUrgent: boolean }) {
  const accent = MODULE_ACCENT[item.id] ?? "var(--accent)";
  const urgentGlow = isUrgent && !item.done;
  return (
    <Link href={moduleHref(item.id)}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
        style={{
          background: item.done ? `rgba(var(--glow-rgb),0.06)` : urgentGlow ? `${accent}12` : `${accent}0c`,
          border: `1px solid ${item.done ? `rgba(var(--glow-rgb),0.15)` : urgentGlow ? `${accent}55` : `${accent}28`}`,
          boxShadow: urgentGlow ? `0 0 12px ${accent}25` : "none",
        }}>
        <div style={{ flexShrink: 0 }}>
          {item.done
            ? <CheckCircle2 style={{ width: 20, height: 20, color: "var(--accent)" }} />
            : <Circle style={{ width: 20, height: 20, color: accent, opacity: 0.6 }} />
          }
        </div>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: item.done ? "rgba(255,255,255,0.3)" : "#fff", textDecoration: item.done ? "line-through" : "none" }}>
            {item.label}
          </p>
          {item.sub && (
            <p style={{ fontSize: 11, marginTop: 1.5, color: item.done ? "rgba(255,255,255,0.2)" : accent }}>
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
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Full plan →</span>
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
        {/* Day headers */}
        <div className="px-4 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 3, paddingTop: 8 }}>
            <div />
            {DAY_CHARS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 9, fontWeight: 700,
                color: i === todayIdx ? "var(--accent)" : "rgba(255,255,255,0.25)",
                padding: "2px 0", borderRadius: 3,
                background: i === todayIdx ? `rgba(var(--glow-rgb),0.1)` : "transparent",
              }}>{d}</div>
            ))}
          </div>
        </div>
        {/* Module rows */}
        <div>
          {moduleStats.map((stat) => {
            const accent = MODULE_ACCENT[stat.type] ?? "var(--accent)";
            return (
              <Link key={stat.type} href={moduleHref(stat.type)}>
                <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 3, padding: "7px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", alignItems: "center", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, textAlign: "center" }}>{stat.emoji}</span>
                  {stat.days.map((done, i) => {
                    const isFuture = i > todayIdx;
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} style={{
                        height: 18, borderRadius: 4,
                        background: done ? accent : isFuture ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.09)",
                        border: isToday ? `1.5px solid ${accent}80` : "1px solid transparent",
                        boxShadow: done ? `0 0 5px ${accent}55` : "none",
                        opacity: isFuture ? 0.4 : 1,
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

function QuickCard({ href, emoji, label, description }: { href: string; emoji: string; label: string; description: string }) {
  return (
    <Link href={href}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{ background: `rgba(var(--glow-rgb),0.06)`, border: `1px solid rgba(var(--glow-rgb),0.15)`, minHeight: 92 }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.25) 0%,transparent 60%)" }} />
        <p style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</p>
        <p style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{label}</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{description}</p>
      </div>
    </Link>
  );
}
