import { useEffect, useState, useRef, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, CheckCircle2, Circle, Plus, Minus, X, Bell } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { useWellnessToday, useWeekSummary, useLogToday, useQuickLog, useAiInsight, useUpcomingEvents } from "@/lib/wellness-api";
import type { UpcomingEvent } from "@/lib/wellness-api";
import { useCoins, useUnreadNotifCount } from "@/lib/hospitals-api";
import { canNotify, notifPermission, requestNotifPermission, fireNotification, maybeFireEveningReminder } from "@/lib/notifications";
import { decodeGesture, gestureLabel, isCompanionHidden } from "@/lib/companion-api";
import type { WeekSummary } from "@/lib/wellness-api";
import type { GestureConfig } from "@/lib/companion-api";

interface ChecklistItem {
  id: string; emoji: string; label: string; sub?: string; time?: string; done: boolean;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const p = h < 12 ? "AM" : "PM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hr}${p}` : `${hr}:${String(m).padStart(2, "0")}${p}`;
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
  smoking: "#64748b", alcohol: "#fbbf24", eyebreak: "#6366f1",
  sunscreen: "#eab308", outdoors: "#16a34a", hygiene: "#93c5fd",
  intimacy: "#fda4af", vaccines: "#a78bfa", checkups: "#22d3ee",
};

function baseModule(id: string): string {
  if (id.startsWith("med_"))     return "medications";
  if (id.startsWith("hygiene_")) return "hygiene";
  if (id.startsWith("vaccine_")) return "vaccines";
  if (id.startsWith("checkup_")) return "checkups";
  return id;
}

function moduleHref(id: string): string {
  if (id === "mood_check") return "/wellness/mood";
  if (id === "energy" || id === "stress") return "/wellness/mood";
  const base = baseModule(id);
  if (base !== id) return `/wellness/${base}`;
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
  const [, navigate] = useLocation();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();
  const logWater = useLogToday("water");
  const quickLog = useQuickLog();
  const { data: coinsData } = useCoins();
  const coins = coinsData?.coins ?? 0;
  const { data: aiData, isLoading: aiLoading } = useAiInsight();
  const { data: upcomingData } = useUpcomingEvents();
  const { data: notifData } = useUnreadNotifCount();
  const unreadNotifs = notifData?.count ?? 0;

  // ── Secret diary gesture ──────────────────────────────────────────────────
  const [gesture, setGesture] = useState<GestureConfig | null>(null);
  const [showHint, setShowHint] = useState(false);
  const tapRef = useRef<{ element: string; count: number; timer: ReturnType<typeof setTimeout> | null }>({ element: "", count: 0, timer: null });

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) setGesture(decodeGesture(raw));
  }, []);

  function handleGestureTap(element: string, e?: MouseEvent) {
    if (!gesture || gesture.element !== element) return;
    if (element === "coins") e?.preventDefault();
    if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
    if (tapRef.current.element !== element) {
      tapRef.current = { element, count: 1, timer: null };
    } else {
      tapRef.current.count += 1;
    }
    if (tapRef.current.count >= gesture.count) {
      tapRef.current = { element: "", count: 0, timer: null };
      navigate("/companion");
      return;
    }
    tapRef.current.timer = setTimeout(() => {
      tapRef.current = { element: "", count: 0, timer: null };
    }, 1500);
  }

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
              <p
                onClick={() => handleGestureTap("date")}
                style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500, cursor: gesture?.element === "date" ? "default" : undefined }}
              >{formatDate()}</p>
              {coins > 0 && (gesture?.element === "coins" ? (
                <div
                  onClick={(e) => handleGestureTap("coins", e)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full active:scale-95 transition"
                  style={{ background: "linear-gradient(135deg,#92400e,#d97706)", boxShadow: "0 2px 8px rgba(217,119,6,0.4)", cursor: "pointer" }}>
                  <span style={{ fontSize: 10 }}>🪙</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{coins}</span>
                </div>
              ) : (
                <Link href="/profile">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full active:scale-95 transition"
                    style={{ background: "linear-gradient(135deg,#92400e,#d97706)", boxShadow: "0 2px 8px rgba(217,119,6,0.4)" }}>
                    <span style={{ fontSize: 10 }}>🪙</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{coins}</span>
                  </div>
                </Link>
              ))}
              <Link href="/notifications">
                <div className="relative active:scale-90 transition" style={{ lineHeight: 0 }}>
                  <Bell className="w-5 h-5" style={{ color: unreadNotifs > 0 ? "var(--accent)" : "var(--text-dim)" }} />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{ background: "#ef4444", color: "#fff" }}>
                      {unreadNotifs > 9 ? "9+" : unreadNotifs}
                    </span>
                  )}
                </div>
              </Link>
              {gesture && (
                <button
                  onClick={() => setShowHint((p) => !p)}
                  style={{ lineHeight: 0, opacity: 0.35, fontSize: 14, padding: 2 }}
                  title="Your diary secret"
                >🔑</button>
              )}
            </div>
            {showHint && gesture && (
              <div className="mb-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
                style={{ background: "var(--accent-tint-bg)", color: "var(--accent)", border: "1px solid var(--accent-tint-border)" }}>
                Secret: {gestureLabel(gesture)} → PIN
              </div>
            )}
            <h1
              onClick={() => handleGestureTap("greeting")}
              style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: "var(--text-main)", cursor: gesture?.element === "greeting" ? "default" : undefined }}
            >
              {greeting()},<br />
              <span style={{ background: "linear-gradient(120deg,var(--accent-light),var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {displayName} 👋
              </span>
            </h1>
            {total > 0 && (
              <p style={{ marginTop: 7, fontSize: 13, color: "var(--text-sub)", fontWeight: 500 }}>
                {doneCount === total ? "All tasks complete today 🎉" : `${doneCount} of ${total} tasks done`}
              </p>
            )}
          </div>
          {total > 0 && (
            <div className="relative shrink-0" style={{ width: 76, height: 76 }}
              onClick={() => handleGestureTap("score")}>
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
                      <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{completionPct}%</span>
                      <span style={{ fontSize: 9, color: "var(--text-sub)" }}>done</span>
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
            completionPct={completionPct} weekRate={weekRate}
            aiInsight={aiData?.insight ?? null} aiLoading={aiLoading} />
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

        {/* ── Coming Up ─────────────────────────────────────────── */}
        {(upcomingData?.events?.length ?? 0) > 0 && (
          <ComingUpCard events={upcomingData!.events} />
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
                    <span style={{ fontSize: 40, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{waterCups}</span>
                    <span style={{ fontSize: 15, color: "var(--text-sub)", fontWeight: 500 }}>/ {waterGoal} cups</span>
                  </div>
                  <p style={{ fontSize: 12, marginTop: 3, color: waterPct >= 100 ? "#4ade80" : "var(--text-sub)" }}>
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
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--input-border)", color: "var(--text-sub)" }}>
                    <Minus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${waterPct}%`, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", boxShadow: "0 0 8px rgba(56,189,248,0.6)" }} />
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {Array.from({ length: Math.min(waterGoal, 14) }, (_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full transition-colors duration-200"
                    style={{ background: i < waterCups ? "rgba(56,189,248,0.7)" : "var(--glass-track)" }} />
                ))}
                {waterGoal > 14 && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 2 }}>+{waterGoal - 14}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Today's Plan ───────────────────────────────────────── */}
        {total > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>Today's plan</h2>
              <Link href="/plan">
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>View week →</span>
              </Link>
            </div>
            <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%`, background: completionPct === 100 ? "#4ade80" : "var(--btn-gradient)", boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)` }} />
            </div>
            {/* 2-column task grid — one card, all tasks side by side */}
            {(() => {
              const quickLogData = buildQuickLogData(mods);
              const allItems = [...checklist].sort((a, b) => {
                if (!a.time && !b.time) return 0;
                if (!a.time) return 1;
                if (!b.time) return -1;
                return a.time.localeCompare(b.time);
              });
              return (
                <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {allItems.map((item, i) => {
                      const entry = quickLogData[item.id];
                      const accent = MODULE_ACCENT[baseModule(item.id)] ?? "var(--accent)";
                      const isRight = i % 2 === 1;
                      return (
                        <Link key={item.id} href={moduleHref(item.id)}>
                          <div className="flex items-start gap-2 p-3 cursor-pointer active:scale-[0.98] transition"
                            style={{
                              borderBottom: i >= 2 * Math.floor((allItems.length - 1) / 2) ? "none" : `1px solid var(--glass-border)`,
                              borderRight: isRight ? "none" : `1px solid var(--glass-border)`,
                              background: item.done ? "rgba(74,222,128,0.04)" : "transparent",
                            }}>
                            {/* Check circle */}
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); entry && !item.done && quickLog.mutate({ moduleType: entry.moduleType, data: entry.data }); }}
                              disabled={item.done || !entry}
                              className="shrink-0 mt-0.5 active:scale-90 transition disabled:cursor-default"
                              style={{ lineHeight: 0 }}>
                              {item.done
                                ? <CheckCircle2 style={{ width: 18, height: 18, color: "var(--accent)" }} />
                                : entry
                                  ? <Circle style={{ width: 18, height: 18, color: accent }} />
                                  : <Circle style={{ width: 18, height: 18, color: accent, opacity: 0.4 }} />
                              }
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span style={{ fontSize: 14 }}>{item.emoji}</span>
                                {item.time && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: item.done ? "var(--text-dim)" : accent, background: `${accent}18`, padding: "1px 5px", borderRadius: 6, flexShrink: 0 }}>
                                    {fmtTime(item.time)}
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: item.done ? "var(--text-dim)" : "var(--text-main)", textDecoration: item.done ? "line-through" : "none", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.label}
                              </p>
                              {item.sub && (
                                <p style={{ fontSize: 10, color: item.done ? "var(--text-dim)" : "var(--text-sub)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.sub}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>
        ) : (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✨</p>
            <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 15, marginBottom: 6 }}>Your plan is empty</p>
            <p style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 20, lineHeight: 1.5 }}>
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>Quick access</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickCard href="/wellness"  emoji="💚" label="My Wellness"  description="Habits & modules" />
            <QuickCard href="/plan"      emoji="📅" label="Weekly Plan"  description="Your habit grid" />
            <QuickCard href="/hospitals" emoji="🏥" label="Hospitals"    description="Chat & book" />
            <QuickCard href="/profile"   emoji="⚙️" label="Settings"     description="Account & theme" />
            {!isCompanionHidden() && (
              <QuickCard href="/companion" emoji="📔" label="My Diary" description="Private journal & chats" />
            )}
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
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--accent-tint-border)" }}>
      <div className="p-4 flex items-center gap-4">
        {/* Text side */}
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5, marginBottom: 3 }}>ERA SCORE</p>
          <p style={{ fontSize: 32, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{score}</p>
          <p style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4, lineHeight: 1.3 }}>{label}</p>
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{completionPct}%</p>
              <p style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>TODAY</p>
            </div>
            <div style={{ width: 1, background: "var(--glass-border)" }} />
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{weekRate}%</p>
              <p style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 600, marginTop: 2 }}>THIS WEEK</p>
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
            <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text-main)" }}>{score}</span>
          </div>
        </div>
      </div>

      {/* Insight strip */}
      {(aiLoading || aiInsight) && (
        <div style={{ borderTop: "1px solid var(--glass-border)", padding: "8px 16px 10px", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>📊</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", letterSpacing: 1, marginBottom: 4 }}>INSIGHT</p>
            {aiLoading
              ? <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ height: 9, borderRadius: 4, background: "var(--glass-track)", width: "90%", animation: "pulse 1.5s infinite" }} />
                  <div style={{ height: 9, borderRadius: 4, background: "var(--glass-track)", width: "75%", animation: "pulse 1.5s infinite" }} />
                </div>
              : <p style={{ fontSize: 11, color: "var(--text-sub)", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{aiInsight}</p>
            }
          </div>
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
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
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
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <p style={{ flex: 1, fontSize: 12, color: "var(--text-sub)", fontWeight: 500, lineHeight: 1.4 }}>
        Get evening reminders to complete your daily plan
      </p>
      <button onClick={handleEnable} disabled={asking}
        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 transition disabled:opacity-50"
        style={{ background: "var(--btn-gradient)", flexShrink: 0 }}>
        Enable
      </button>
      <button onClick={onDismiss} className="active:scale-95 transition"
        style={{ color: "var(--text-dim)", flexShrink: 0, padding: "2px 4px" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Build minimal one-tap log payloads keyed by checklist item ID.
// Each entry carries { moduleType, data } so the API call uses the right module type
// (e.g. "med_abc" → moduleType "medications").
interface QuickLogEntry { moduleType: string; data: Record<string, unknown> }
function buildQuickLogData(mods: Record<string, ModuleEntry | undefined>): Record<string, QuickLogEntry> {
  const outdoorsTarget = (mods.outdoors?.settings?.targetMinutes as number | undefined) ?? 30;
  const eyeTarget = (mods.eyebreak?.settings?.targetBreaks as number | undefined) ?? 6;
  const intimacyMode = (mods.intimacy?.settings as { mode?: string } | undefined)?.mode;
  const entries: Record<string, QuickLogEntry> = {
    fruit:     { moduleType: "fruit",     data: { done: true } },
    sunscreen: { moduleType: "sunscreen", data: { done: true } },
    smoking:   { moduleType: "smoking",   data: { smoked: false } },
    alcohol:   { moduleType: "alcohol",   data: { drinks: 0 } },
    workout:   { moduleType: "workout",   data: { completed: true } },
    outdoors:  { moduleType: "outdoors",  data: { minutes: outdoorsTarget } },
    eyebreak:  { moduleType: "eyebreak",  data: { count: eyeTarget } },
  };
  if (intimacyMode === "celibacy") entries.intimacy = { moduleType: "intimacy", data: { active: false } };

  // Medications — one quick-log entry per dose per med (key matches checklist item id)
  type Med = { id: string; times?: string[] };
  const meds = (mods.medications?.settings?.medications as Med[]) ?? [];
  for (const med of meds) {
    const times: string[] = med.times?.length ? med.times : ["08:00"];
    for (const t of times) {
      entries[`med_${med.id}_${t}`] = { moduleType: "medications", data: { taken: { [`${med.id}_${t}`]: true } } };
    }
  }

  return entries;
}

function CheckRow({ item, isUrgent, onQuickDone }: {
  item: ChecklistItem;
  isUrgent: boolean;
  onQuickDone?: () => void;
}) {
  const accent = MODULE_ACCENT[baseModule(item.id)] ?? "var(--accent)";
  const urgentGlow = isUrgent && !item.done;

  const rowContent = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl transition"
      style={{
        background: item.done ? "var(--glass-bg)" : urgentGlow ? `${accent}12` : `${accent}0c`,
        border: `1px solid ${item.done ? "var(--glass-border)" : urgentGlow ? `${accent}55` : `${accent}28`}`,
        boxShadow: urgentGlow ? `0 0 12px ${accent}25` : "none",
      }}>

      {/* Left: tappable check circle */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickDone?.(); }}
        disabled={item.done || !onQuickDone}
        className="shrink-0 active:scale-90 transition disabled:cursor-default"
        style={{ lineHeight: 0 }}>
        {item.done
          ? <CheckCircle2 style={{ width: 22, height: 22, color: "var(--accent)" }} />
          : onQuickDone
            ? <Circle style={{ width: 22, height: 22, color: accent }} />
            : <Circle style={{ width: 22, height: 22, color: accent, opacity: 0.5 }} />
        }
      </button>

      <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>

      {/* Middle: label + sub + time — this whole area navigates */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: item.done ? "var(--text-dim)" : "var(--text-main)", textDecoration: item.done ? "line-through" : "none" }}>
          {item.label}
        </p>
        {(item.time || item.sub) && (
          <p style={{ fontSize: 11, marginTop: 1.5, color: item.done ? "var(--text-dim)" : accent }}>
            {item.time && <span style={{ fontWeight: 700, marginRight: item.sub ? 4 : 0 }}>{fmtTime(item.time)}</span>}
            {item.time && item.sub && <span style={{ opacity: 0.5, marginRight: 4 }}>·</span>}
            {item.sub}
          </p>
        )}
      </div>

      <ChevronRight style={{ width: 15, height: 15, flexShrink: 0, color: item.done ? "var(--text-dim)" : accent }} />
    </div>
  );

  return (
    <Link href={moduleHref(item.id)}>
      <div className="cursor-pointer active:scale-[0.98] transition">{rowContent}</div>
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
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>This week</h2>
        <div className="flex items-center gap-3">
          <Link href="/report">
            <span style={{ fontSize: 11, color: "var(--text-sub)", fontWeight: 600 }}>Past weeks →</span>
          </Link>
          <Link href="/plan">
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Full plan →</span>
          </Link>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {/* Rate header */}
        <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
          <p style={{ fontSize: 13, color: "var(--text-sub)", fontWeight: 500 }}>Overall completion</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: rateColor, filter: `drop-shadow(0 0 6px ${rateColor}70)`, lineHeight: 1 }}>{overallRate}%</p>
        </div>
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
            <div className="h-full rounded-full transition-all duration-800"
              style={{ width: `${overallRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
          </div>
        </div>
        {/* Day headers */}
        <div className="px-4 pb-1" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 3, paddingTop: 8 }}>
            <div />
            {DAY_CHARS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 9, fontWeight: 700,
                color: i === todayIdx ? "var(--accent)" : "var(--text-dim)",
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
                <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 1fr 1fr 1fr 1fr 1fr 1fr", gap: 3, padding: "7px 16px", borderTop: "1px solid var(--glass-bg)", alignItems: "center", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, textAlign: "center" }}>{stat.emoji}</span>
                  {stat.days.map((done, i) => {
                    const isFuture = i > todayIdx;
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} style={{
                        height: 18, borderRadius: 4,
                        background: done ? accent : isFuture ? "var(--glass-bg)" : "var(--glass-track)",
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

function dueDateLabel(daysUntil: number, dueDate: string): { text: string; color: string } {
  if (daysUntil < 0) return { text: `Overdue ${Math.abs(daysUntil)}d ago`, color: "#f87171" };
  if (daysUntil === 0) return { text: "Due today", color: "#fb923c" };
  if (daysUntil === 1) return { text: "Due tomorrow", color: "#fbbf24" };
  if (daysUntil <= 7) {
    const d = new Date(dueDate + "T12:00:00");
    return { text: `Due ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}`, color: "#fbbf24" };
  }
  return { text: `Due in ${daysUntil}d`, color: "var(--text-sub)" };
}

function moduleHrefForEvent(module: string): string {
  if (module === "hygiene") return "/wellness/hygiene";
  if (module === "vaccines") return "/wellness/vaccines";
  if (module === "checkups") return "/wellness/checkups";
  return "/wellness";
}

function ComingUpCard({ events }: { events: UpcomingEvent[] }) {
  const overdueCount = events.filter((e) => e.daysUntil < 0).length;
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
          Coming up
          {overdueCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
              {overdueCount} overdue
            </span>
          )}
        </h2>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>next 2 weeks</span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {events.map((event, i) => {
          const { text, color } = dueDateLabel(event.daysUntil, event.dueDate);
          return (
            <Link key={event.id} href={moduleHrefForEvent(event.module)}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:scale-[0.98] transition"
                style={{ borderTop: i > 0 ? "1px solid var(--glass-border)" : "none" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{event.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", lineHeight: 1.3 }}>{event.label}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{text}</span>
                <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)", flexShrink: 0 }} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function QuickCard({ href, emoji, label, description }: { href: string; emoji: string; label: string; description: string }) {
  return (
    <Link href={href}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", minHeight: 92 }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.25) 0%,transparent 60%)" }} />
        <p style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</p>
        <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 13 }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>{description}</p>
      </div>
    </Link>
  );
}
