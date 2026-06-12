import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useWeekSummary, useWellnessToday } from "@/lib/wellness-api";
import type { WeekSummary, WeekSummaryModuleStat } from "@/lib/wellness-api";

interface ChecklistItem {
  id: string; emoji: string; label: string; sub?: string; done: boolean;
}

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", energy: "#84cc16",
  stress: "#a855f7", fruit: "#22c55e", vitals: "#ef4444",
  smoking: "#64748b", eyebreak: "#6366f1", sunscreen: "#eab308",
  outdoors: "#16a34a", hygiene: "#93c5fd",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function PlanPage() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading } = useWeekSummary();
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };

  const checklist = todayRaw?.checklist ?? [];
  const pending = checklist.filter((c) => !c.done);
  const done = checklist.filter((c) => c.done);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#14b8a6", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!summary || summary.moduleStats.length === 0) {
    return (
      <div className="px-4 pt-6 pb-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-6"
          style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 44, marginBottom: 14 }}>📅</p>
          <p style={{ fontWeight: 700, color: "#fff", fontSize: 16, marginBottom: 8 }}>No plan yet</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.55, marginBottom: 22 }}>
            Set up wellness modules to generate your weekly plan and daily habit grid.
          </p>
          <Link href="/wellness">
            <button className="px-7 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition"
              style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 6px 20px rgba(20,184,166,0.35)" }}>
              Set up wellness →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const tidx = todayIndex(summary.weekStart);
  const weekStartDate = new Date(summary.weekStart + "T12:00:00");
  const weekEndDate = new Date(summary.weekEnd + "T12:00:00");
  const startLabel = weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const endLabel = weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const rateColor = summary.overallRate >= 80 ? "#4ade80" : summary.overallRate >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="px-4 pt-6 pb-10">
      {/* Back */}
      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-5"
        style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500 }}>
        <ArrowLeft className="w-4 h-4" /> Home
      </button>

      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Your plan</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Week of {startLabel} – {endLabel}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 38, fontWeight: 900, color: rateColor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${rateColor}70)` }}>
            {summary.overallRate}%
          </p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>this week</p>
        </div>
      </div>

      {/* Overall bar */}
      <div className="mb-6 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${summary.overallRate}%`, background: rateColor, boxShadow: `0 0 10px ${rateColor}60` }} />
      </div>

      {/* ── Weekly Habit Grid ─────────────────────────────────────── */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
        Weekly Grid
      </h2>

      <div className="rounded-2xl overflow-hidden mb-6"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Day header row */}
        <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 4, alignItems: "center" }}>
            <div /> {/* emoji spacer */}
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                color: i === tidx ? "#14b8a6" : "rgba(255,255,255,0.3)",
                padding: "3px 2px",
                borderRadius: 4,
                background: i === tidx ? "rgba(20,184,166,0.12)" : "transparent",
              }}>
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Module rows */}
        {summary.moduleStats.map((stat) => {
          const accent = MODULE_ACCENT[stat.type] ?? "#14b8a6";
          const doneDays = stat.completedDays;
          return (
            <Link key={stat.type} href={moduleHref(stat.type)}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                className="active:bg-white/[0.03] transition">
                {/* Dots row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "32px repeat(7, 1fr)",
                  gap: 4,
                  padding: "10px 16px 6px",
                  alignItems: "center",
                }}>
                  <span style={{ fontSize: 15, textAlign: "center" }}>{stat.emoji}</span>
                  {stat.days.map((isDone, i) => {
                    const isFuture = i > tidx;
                    const isToday = i === tidx;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                        <div style={{
                          width: "100%",
                          maxWidth: 30,
                          height: 24,
                          borderRadius: 6,
                          background: isDone
                            ? accent
                            : isToday
                              ? "rgba(20,184,166,0.12)"
                              : isFuture
                                ? "rgba(255,255,255,0.03)"
                                : "rgba(255,255,255,0.08)",
                          border: isToday
                            ? `1.5px solid ${isDone ? accent : accent + "70"}`
                            : "1px solid transparent",
                          boxShadow: isDone ? `0 0 8px ${accent}55` : "none",
                          opacity: isFuture ? 0.4 : 1,
                          transition: "background 0.3s, box-shadow 0.3s",
                        }} />
                      </div>
                    );
                  })}
                </div>

                {/* Label + count row */}
                <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{stat.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: doneDays >= 5 ? "#4ade80" : accent }}>{doneDays}/7</span>
                    <ChevronRight style={{ width: 12, height: 12, color: accent, opacity: 0.6 }} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Today's Checklist ─────────────────────────────────────── */}
      {checklist.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            Today — {done.length}/{checklist.length} done
          </h2>

          {/* Progress bar */}
          {checklist.length > 0 && (
            <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-600"
                style={{
                  width: `${Math.round((done.length / checklist.length) * 100)}%`,
                  background: done.length === checklist.length ? "#4ade80" : "linear-gradient(90deg,#0d9488,#14b8a6)",
                  boxShadow: "0 0 8px rgba(20,184,166,0.5)",
                }} />
            </div>
          )}

          <div className="space-y-2 mb-4">
            {pending.map((item) => <TaskRow key={item.id} item={item} />)}
          </div>

          {done.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Completed
              </p>
              <div className="space-y-2">
                {done.map((item) => <TaskRow key={item.id} item={item} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Mood averages */}
      {summary.moodAvg && (
        <div className="mt-6 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Week averages
          </p>
          <div className="flex gap-6">
            <MoodStat label="Mood" emoji="😊" value={summary.moodAvg.mood} />
            <MoodStat label="Energy" emoji="⚡" value={summary.moodAvg.energy} />
            <MoodStat label="Stress" emoji="🧘" value={summary.moodAvg.stress} invert />
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ item }: { item: ChecklistItem }) {
  const accent = MODULE_ACCENT[item.id] ?? "#14b8a6";
  return (
    <Link href={moduleHref(item.id)}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
        style={{
          background: item.done ? "rgba(20,184,166,0.07)" : `${accent}0f`,
          border: `1px solid ${item.done ? "rgba(20,184,166,0.2)" : `${accent}28`}`,
        }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.done ? "✅" : "⭕"}</span>
        <span style={{ fontSize: 17, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 14, fontWeight: 600,
            color: item.done ? "rgba(255,255,255,0.35)" : "#fff",
            textDecoration: item.done ? "line-through" : "none",
          }}>
            {item.label}
          </p>
          {item.sub && (
            <p style={{ fontSize: 11, marginTop: 2, color: item.done ? "rgba(255,255,255,0.22)" : accent }}>{item.sub}</p>
          )}
        </div>
        <ChevronRight style={{ width: 15, height: 15, flexShrink: 0, color: item.done ? "rgba(255,255,255,0.15)" : accent }} />
      </div>
    </Link>
  );
}

function MoodStat({ label, emoji, value, invert = false }: { label: string; emoji: string; value: number; invert?: boolean }) {
  const filled = Math.round(value);
  const good = invert ? 6 - filled : filled;
  return (
    <div>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: 5, letterSpacing: 0.5 }}>{emoji} {label}</p>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < good ? "#14b8a6" : "rgba(255,255,255,0.09)",
            boxShadow: i < good ? "0 0 5px rgba(20,184,166,0.6)" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}
