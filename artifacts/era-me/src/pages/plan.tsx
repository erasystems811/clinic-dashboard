import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useCurrentPlan, useRegeneratePlan } from "@/lib/plan-api";
import { useWellnessToday, useWeekSummary } from "@/lib/wellness-api";

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", fruit: "#22c55e",
  vitals: "#ef4444", smoking: "#64748b", eyebreak: "#6366f1",
  sunscreen: "#eab308", outdoors: "#16a34a", hygiene: "#93c5fd",
};

const SHORT_DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function moduleHref(moduleType: string): string {
  if (moduleType === "mood_check") return "/wellness/mood";
  return `/wellness/${moduleType}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

interface ChecklistItem { id: string; done: boolean; sub?: string }

export default function PlanPage() {
  const [, navigate] = useLocation();
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: planData, isLoading: planLoading } = useCurrentPlan();
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };
  const { data: summary } = useWeekSummary();
  const regenerate = useRegeneratePlan();

  const plan = planData?.plan;
  const weekRate = summary?.overallRate ?? 0;
  const rateColor = weekRate >= 80 ? "#4ade80" : weekRate >= 50 ? "#fbbf24" : "#f87171";

  if (planLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#14b8a6", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!plan || plan.days.every((d) => d.items.length === 0)) {
    return (
      <div className="px-4 pt-6 pb-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-6"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 44, marginBottom: 14 }}>📅</p>
          <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 16, marginBottom: 8 }}>No plan yet</p>
          <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.55, marginBottom: 22 }}>
            Set up wellness modules and your plan will be generated automatically each week.
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

  const todayChecklist: ChecklistItem[] = todayRaw?.checklist ?? [];
  const todayDoneMap = new Map(todayChecklist.map((c) => [c.id, c.done]));
  const todaySubMap  = new Map(todayChecklist.map((c) => [c.id, c.sub]));

  const selectedDay = plan.days.find((d) => d.date === selectedDate) ?? plan.days[0];
  const isToday   = selectedDate === today;
  const isFuture  = selectedDate > today;

  const weekStartDate = new Date(plan.weekStart + "T12:00:00");
  const weekEndDate   = new Date(plan.weekStart + "T12:00:00");
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekLabel = `${weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  const todayDoneCount = isToday
    ? selectedDay.items.filter((item) => item.isRestDay || todayDoneMap.get(item.moduleType) === true).length
    : 0;
  const todayTotal = isToday ? selectedDay.items.length : 0;
  const todayPct   = todayTotal > 0 ? Math.round((todayDoneCount / todayTotal) * 100) : 0;

  return (
    <div className="px-4 pt-6 pb-10">

      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-5"
        style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
        <ArrowLeft className="w-4 h-4" /> Home
      </button>

      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-main)", marginBottom: 3 }}>Your week</h1>
          <p style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>{weekLabel}</p>
        </div>
        <div className="text-right">
          <p style={{ fontSize: 34, fontWeight: 900, color: rateColor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${rateColor}70)` }}>
            {weekRate}%
          </p>
          <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>this week</p>
        </div>
      </div>

      <div className="mb-5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${weekRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
      </div>

      {/* Day pill tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {plan.days.map((day, i) => {
          const isSelected  = day.date === selectedDate;
          const isDayToday  = day.date === today;
          const isDayFuture = day.date > today;
          return (
            <button key={day.date} onClick={() => setSelectedDate(day.date)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition active:scale-95 shrink-0"
              style={{
                background: isSelected
                  ? (isDayToday ? "linear-gradient(135deg,#0d9488,#14b8a6)" : "var(--glass-bg)")
                  : "var(--glass-bg)",
                border: `1px solid ${isSelected
                  ? (isDayToday ? "rgba(20,184,166,0.5)" : "var(--glass-border)")
                  : "var(--glass-border)"}`,
                opacity: isDayFuture && !isSelected ? 0.5 : 1,
                minWidth: 44,
              }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? (isDayToday ? "#fff" : "var(--text-main)") : "var(--text-sub)" }}>
                {SHORT_DAY[i]}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: isSelected ? (isDayToday ? "#fff" : "var(--text-main)") : "var(--text-sub)" }}>
                {new Date(day.date + "T12:00:00").getDate()}
              </span>
              {isDayToday && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? "#fff" : "#14b8a6" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)" }}>
            {selectedDay.dayLabel}{isToday ? " — Today" : ""}
          </h2>
          {isToday && todayTotal > 0 && (
            <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
              {todayDoneCount} of {todayTotal} done
            </p>
          )}
          {isFuture && (
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Planned</p>
          )}
        </div>
        <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-95 transition disabled:opacity-50"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--input-border)", fontSize: 11, color: "var(--text-sub)", fontWeight: 600 }}>
          <RefreshCw className="w-3 h-3" style={{ animation: regenerate.isPending ? "spin 1s linear infinite" : undefined }} />
          Refresh
        </button>
      </div>

      {isToday && todayTotal > 0 && (
        <div className="mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${todayPct}%`,
              background: todayPct === 100 ? "#4ade80" : "linear-gradient(90deg,#0d9488,#14b8a6)",
              boxShadow: "0 0 8px rgba(20,184,166,0.5)",
            }} />
        </div>
      )}

      {/* Task cards */}
      {selectedDay.items.length === 0 ? (
        <div className="py-10 text-center rounded-2xl"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Nothing planned for this day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedDay.items.map((item) => {
            const accent = MODULE_ACCENT[item.moduleType] ?? "#14b8a6";
            const done = item.isRestDay ? true : isToday ? (todayDoneMap.get(item.moduleType) ?? false) : false;
            const sub  = isToday ? (todaySubMap.get(item.moduleType) ?? item.sub) : item.sub;

            return (
              <Link key={item.moduleType} href={moduleHref(item.moduleType)}>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                  style={{
                    background: done ? "rgba(20,184,166,0.08)" : isFuture ? "var(--glass-bg)" : `${accent}0d`,
                    border: `1px solid ${done ? "rgba(20,184,166,0.25)" : isFuture ? "var(--glass-border)" : `${accent}30`}`,
                    opacity: isFuture ? 0.65 : 1,
                  }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>
                    {done && !item.isRestDay ? "✅" : item.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 600,
                      color: done ? "var(--text-dim)" : "var(--text-main)",
                      textDecoration: done && !item.isRestDay ? "line-through" : "none",
                    }}>
                      {item.label}
                    </p>
                    {sub && (
                      <p style={{ fontSize: 11, marginTop: 2, color: done ? "var(--text-dim)" : accent }}>
                        {sub}
                      </p>
                    )}
                  </div>
                  <ChevronRight style={{ width: 15, height: 15, flexShrink: 0, color: done ? "var(--text-dim)" : accent }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Week overview grid */}
      {summary && summary.moduleStats.length > 0 && (
        <WeekGrid stats={summary.moduleStats} weekStart={plan.weekStart} today={today} />
      )}
    </div>
  );
}

function WeekGrid({ stats, weekStart, today }: {
  stats: Array<{ type: string; emoji: string; days: boolean[] }>;
  weekStart: string;
  today: string;
}) {
  const todayDate  = new Date(today + "T12:00:00");
  const startDate  = new Date(weekStart + "T12:00:00");
  const todayIdx   = Math.min(6, Math.max(0, Math.round((todayDate.getTime() - startDate.getTime()) / 86400000)));
  const DAY_CHARS  = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="mt-6 rounded-2xl overflow-hidden"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ padding: "12px 16px 6px", fontSize: 11, fontWeight: 700, color: "var(--text-sub)", letterSpacing: 1, textTransform: "uppercase" }}>
        Week overview
      </p>
      <div style={{ padding: "0 16px 6px", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px repeat(7,1fr)", gap: 3 }}>
          <div />
          {DAY_CHARS.map((d, i) => (
            <div key={i} style={{
              textAlign: "center", fontSize: 9, fontWeight: 700,
              color: i === todayIdx ? "#14b8a6" : "var(--text-dim)",
              padding: "2px 0", borderRadius: 3,
              background: i === todayIdx ? "rgba(20,184,166,0.12)" : "transparent",
            }}>{d}</div>
          ))}
        </div>
      </div>
      {stats.map((stat) => {
        const accent = (MODULE_ACCENT as Record<string, string>)[stat.type] ?? "#14b8a6";
        return (
          <Link key={stat.type} href={moduleHref(stat.type)}>
            <div style={{ display: "grid", gridTemplateColumns: "24px repeat(7,1fr)", gap: 3, padding: "8px 16px", borderTop: "1px solid var(--glass-bg)", alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontSize: 13, textAlign: "center" }}>{stat.emoji}</span>
              {stat.days.map((done, i) => {
                const isFut  = i > todayIdx;
                const isTod  = i === todayIdx;
                return (
                  <div key={i} style={{
                    height: 18, borderRadius: 5,
                    background: done ? accent : isFut ? "var(--glass-bg)" : "var(--glass-track)",
                    border: isTod ? `1.5px solid ${accent}80` : "1px solid transparent",
                    boxShadow: done ? `0 0 5px ${accent}55` : "none",
                    opacity: isFut ? 0.4 : 1,
                  }} />
                );
              })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
