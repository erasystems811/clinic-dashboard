import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { isCompanionHidden } from "@/lib/companion-api";
import { useWeeklyReport } from "@/lib/wellness-api";
import type { WeeklyReportModule } from "@/lib/wellness-api";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function getMonday(weekOffset = 0): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + weekOffset * 7);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export default function ReportPage() {
  const [, navigate] = useLocation();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const weekStart = getMonday(weekOffset);
  const { data, isLoading } = useWeeklyReport(weekStart);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <p style={{ fontSize: 13, color: "var(--text-sub)" }}>Loading your report…</p>
      </div>
    );
  }

  const { thisWeek, prevWeek, rateChange, weekLabel, prevWeekLabel, today } = data;
  const isCurrentWeek = weekOffset === 0;
  const canGoForward = weekOffset < 0;

  const rateColor = thisWeek.rate >= 80 ? "#4ade80" : thisWeek.rate >= 50 ? "#fbbf24" : "#f87171";
  const changeColor = rateChange > 5 ? "#4ade80" : rateChange < -5 ? "#f87171" : "#fbbf24";
  const changeIcon = rateChange > 5 ? "↑" : rateChange < -5 ? "↓" : "→";

  const wonModules  = thisWeek.modules.filter(m => m.rate >= 70 && m.possible > 0);
  const missedModules = thisWeek.modules.filter(m => m.rate < 40 && m.possible > 0);
  const okModules   = thisWeek.modules.filter(m => m.rate >= 40 && m.rate < 70 && m.possible > 0);

  return (
    <div className="pb-16 pt-6">
      {/* ── Header ── */}
      <div className="px-4 mb-5">
        <button onClick={() => navigate("/plan")} className="flex items-center gap-1.5 mb-5"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>Weekly Report</h1>
          {/* Week navigator */}
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
            <button onClick={() => canGoForward && setWeekOffset(w => w + 1)}
              disabled={!canGoForward}
              className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition disabled:opacity-30"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-sub)" }}>{weekLabel}</p>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Big score card ── */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-5">
            {/* Completion ring */}
            <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
              <svg className="-rotate-90" viewBox="0 0 72 72" style={{ width: 96, height: 96 }}>
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                <circle cx="36" cy="36" r="28" fill="none"
                  stroke={rateColor} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - thisWeek.rate / 100)}`}
                  style={{ filter: `drop-shadow(0 0 8px ${rateColor}80)`, transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{thisWeek.rate}%</span>
                <span style={{ fontSize: 9, color: "var(--text-sub)", marginTop: 2 }}>this week</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)", marginBottom: 6 }}>
                {isCurrentWeek ? "This week so far" : `Week of ${weekLabel}`}
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: changeColor, marginBottom: 4 }}>
                {changeIcon} {Math.abs(rateChange)}%
              </p>
              <p style={{ fontSize: 12, color: "var(--text-sub)" }}>
                {rateChange > 5 ? "Better than" : rateChange < -5 ? "Lower than" : "About the same as"} last week ({prevWeek.rate}%)
              </p>
              {thisWeek.possible > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                  {thisWeek.totalCompleted} out of {thisWeek.totalPossible} possible habit-days
                </p>
              )}
            </div>
          </div>

          {/* Mini comparison bar */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {weekLabel}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {prevWeekLabel}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${thisWeek.rate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: rateColor, minWidth: 36, textAlign: "right" }}>{thisWeek.rate}%</span>
            </div>
            <div className="flex gap-2 items-center mt-1.5">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${prevWeek.rate}%`, background: "var(--text-dim)", opacity: 0.6 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", minWidth: 36, textAlign: "right" }}>{prevWeek.rate}%</span>
            </div>
          </div>
        </div>

        {/* ── What went well ── */}
        {wonModules.length > 0 && (
          <ReportSection
            title="What you nailed 🏆"
            accentColor="#4ade80"
            bgColor="rgba(74,222,128,0.07)"
            borderColor="rgba(74,222,128,0.2)"
            modules={wonModules}
            prevModules={prevWeek.modules}
            thisWeekDates={data.thisWeekDates}
            today={today}
          />
        )}

        {/* ── Keep going ── */}
        {okModules.length > 0 && (
          <ReportSection
            title="Keep building 💪"
            accentColor="#fbbf24"
            bgColor="rgba(251,191,36,0.07)"
            borderColor="rgba(251,191,36,0.2)"
            modules={okModules}
            prevModules={prevWeek.modules}
            thisWeekDates={data.thisWeekDates}
            today={today}
          />
        )}

        {/* ── Needs attention ── */}
        {missedModules.length > 0 && (
          <ReportSection
            title="Needs attention 🔴"
            accentColor="#f87171"
            bgColor="rgba(248,113,113,0.07)"
            borderColor="rgba(248,113,113,0.2)"
            modules={missedModules}
            prevModules={prevWeek.modules}
            thisWeekDates={data.thisWeekDates}
            today={today}
          />
        )}

        {/* ── Day-by-day grid ── */}
        <DayGrid modules={thisWeek.modules} dates={data.thisWeekDates} today={today} />

        {/* ── Best / worst day ── */}
        {(data.bestDay || data.worstDay) && (
          <div className="grid grid-cols-2 gap-3">
            {data.bestDay && (
              <div className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)" }}>
                <p style={{ fontSize: 22 }}>🌟</p>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#4ade80", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Best day</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: "var(--text-main)", marginTop: 2 }}>{data.bestDay.dayLabel}</p>
                <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>{data.bestDay.count} habits done</p>
              </div>
            )}
            {data.worstDay && data.worstDay.date !== data.bestDay?.date && (
              <div className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <p style={{ fontSize: 22 }}>💤</p>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#f87171", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Quietest day</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: "var(--text-main)", marginTop: 2 }}>{data.worstDay.dayLabel}</p>
                <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>{data.worstDay.count} habits done</p>
              </div>
            )}
          </div>
        )}

        {thisWeek.modules.length === 0 && (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>📊</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>No data for this week</p>
            <p style={{ fontSize: 12, color: "var(--text-sub)" }}>
              Log your habits throughout the week to see your report here.
            </p>
          </div>
        )}

        {/* Talk to companion */}
        {!isCompanionHidden() && (
          <Link href="/companion">
            <div className="flex items-center gap-3 px-4 py-4 rounded-2xl cursor-pointer active:scale-[0.98] transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <MessageCircle className="w-5 h-5 shrink-0" style={{ color: "var(--accent)" }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Talk to my diary</p>
                <p style={{ fontSize: 11, color: "var(--text-sub)" }}>Reflect on your week with a private chat</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}

// ── Section (nailed / building / attention) ───────────────────────────────────

function ReportSection({ title, accentColor, bgColor, borderColor, modules, prevModules, thisWeekDates, today }: {
  title: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  modules: WeeklyReportModule[];
  prevModules: WeeklyReportModule[];
  thisWeekDates: string[];
  today: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: accentColor, padding: "12px 16px 8px", letterSpacing: 0.3 }}>
        {title}
      </p>
      <div className="space-y-2 px-3 pb-3">
        {modules.map(m => {
          const prev = prevModules.find(p => p.type === m.type);
          const change = prev ? m.rate - prev.rate : null;
          return (
            <div key={m.type} className="rounded-xl p-3"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 18 }}>{m.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{m.label}</p>
                    <div className="flex items-center gap-1.5">
                      {change !== null && Math.abs(change) > 5 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: change > 0 ? "#4ade80" : "#f87171" }}>
                          {change > 0 ? "↑" : "↓"}{Math.abs(change)}%
                        </span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: accentColor }}>{m.completed}/{m.possible}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Day dots */}
              <div className="flex gap-1.5">
                {thisWeekDates.map((date, i) => {
                  const dayData = m.dayData.find(d => d.date === date);
                  const isFuture = date > today;
                  const isDone = dayData?.completed ?? false;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
                      <div className="w-full rounded-md"
                        style={{
                          height: 20,
                          background: isFuture ? "var(--glass-track)" : isDone ? accentColor : "var(--glass-track)",
                          opacity: isFuture ? 0.3 : 1,
                          boxShadow: isDone && !isFuture ? `0 0 6px ${accentColor}50` : "none",
                        }} />
                      <span style={{ fontSize: 8, color: "var(--text-dim)", fontWeight: 600 }}>{DAY_LETTERS[i]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar vs last week */}
              {prev && prev.possible > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
                    <div className="h-full rounded-full" style={{ width: `${m.rate}%`, background: accentColor, transition: "width 0.7s ease" }} />
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
                    <div className="h-full rounded-full" style={{ width: `${prev.rate}%`, background: "var(--text-dim)", opacity: 0.5 }} />
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: 9, color: "var(--text-dim)" }}>This week</span>
                    <span style={{ fontSize: 9, color: "var(--text-dim)" }}>Last week</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day-by-day heatmap grid ───────────────────────────────────────────────────

function DayGrid({ modules, dates, today }: {
  modules: WeeklyReportModule[];
  dates: string[];
  today: string;
}) {
  if (modules.length === 0) return null;

  const dayTotals = dates.map(date => {
    const done = modules.filter(m => m.dayData.find(d => d.date === date)?.completed).length;
    const total = modules.filter(m => m.dayData.find(d => d.date === date) !== undefined).length;
    return { date, done, total, isFuture: date > today };
  });

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>
        Day by day this week
      </p>
      <div className="flex gap-2">
        {dayTotals.map(({ date, done, total, isFuture }, i) => {
          const pct = total > 0 ? done / total : 0;
          const bg = isFuture ? "var(--glass-track)"
            : pct >= 0.8 ? "#4ade80"
            : pct >= 0.5 ? "#fbbf24"
            : pct > 0 ? "#f87171"
            : "var(--glass-track)";
          const isToday = date === today;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
              <div className="w-full rounded-xl flex flex-col items-center justify-center py-2 transition"
                style={{
                  background: bg,
                  opacity: isFuture ? 0.25 : 1,
                  border: isToday ? `2px solid var(--accent)` : "1px solid transparent",
                  boxShadow: !isFuture && pct > 0 ? `0 0 8px ${bg}60` : "none",
                  minHeight: 56,
                }}>
                {!isFuture && (
                  <span style={{ fontSize: 14, fontWeight: 900, color: pct === 0 ? "var(--text-dim)" : "#000", lineHeight: 1 }}>
                    {done}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text-dim)", textTransform: "uppercase" }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        {[["#4ade80","80–100%"],["#fbbf24","50–79%"],["#f87171","1–49%"]].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
            <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
