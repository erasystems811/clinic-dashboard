import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, BellOff, Printer, RefreshCw, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useCurrentPlan, useRegeneratePlan } from "@/lib/plan-api";
import type { PlanItem, WeekPlan } from "@/lib/plan-api";
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

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatTimeShort(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

interface ChecklistItem { id: string; done: boolean; sub?: string }

export default function PlanPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"week" | "today">("week");
  const [notifEnabled, setNotifEnabled] = useState(false);

  const { data: planData, isLoading } = useCurrentPlan();
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };
  const { data: summary } = useWeekSummary();
  const regenerate = useRegeneratePlan();

  const plan = planData?.plan;
  const today = todayStr();
  const weekRate = summary?.overallRate ?? 0;
  const rateColor = weekRate >= 80 ? "#4ade80" : weekRate >= 50 ? "#fbbf24" : "#f87171";

  // Auto-regenerate if cached plan has no times (old format without timetable data)
  useEffect(() => {
    if (plan && !regenerate.isPending) {
      const hasTime = plan.days.some(d => d.items.some(i => i.time));
      if (!hasTime && plan.days.some(d => d.items.length > 0)) {
        regenerate.mutate();
      }
    }
  }, [planData?.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Done map from today's wellness log
  const todayDoneMap = useMemo(() => {
    const checklist = todayRaw?.checklist ?? [];
    return new Map(checklist.map((c) => [c.id, c.done]));
  }, [todayRaw]);

  // Derive timetable rows (unique time slots × 7 day columns)
  const { timetableRows, allDayItems } = useMemo(() => {
    if (!plan) return { timetableRows: [], allDayItems: [] };
    const timesSet = new Set<string>();
    plan.days.forEach(d => d.items.forEach(i => { if (i.time) timesSet.add(i.time); }));
    const timeSlots = [...timesSet].sort();
    const timetableRows = timeSlots.map(time => ({
      time,
      cols: plan.days.map(d => d.items.filter(i => i.time === time)),
    }));
    const allDayItems = plan.days.map(d => d.items.filter(i => !i.time));
    return { timetableRows, allDayItems };
  }, [plan]);

  // TODAY: items sorted by time
  const { timedItems, todayDayOnly } = useMemo(() => {
    if (!plan) return { timedItems: [], todayDayOnly: [] };
    const todayDay = plan.days.find(d => d.date === today) ?? plan.days[0];
    const timed = [...todayDay.items.filter(i => i.time)].sort((a, b) => a.time!.localeCompare(b.time!));
    const dayOnly = todayDay.items.filter(i => !i.time && !i.isRestDay);
    return { timedItems: timed, todayDayOnly: dayOnly };
  }, [plan, today]);

  const todayDoneCount = timedItems.filter(i => todayDoneMap.get(i.moduleType) === true).length;
  const todayPct = timedItems.length > 0 ? Math.round((todayDoneCount / timedItems.length) * 100) : 0;

  // Schedule browser notifications for today's upcoming tasks
  useEffect(() => {
    if (!notifEnabled || !plan) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const now = new Date();
    const todayDay = plan.days.find(d => d.date === today);
    if (!todayDay) return;
    todayDay.items.filter(i => i.time && !i.isRestDay).forEach(item => {
      const [h, m] = item.time!.split(":").map(Number);
      const fireAt = new Date(); fireAt.setHours(h, m, 0, 0);
      const delay = fireAt.getTime() - now.getTime();
      if (delay > 0 && delay < 86400000) {
        ids.push(setTimeout(() => {
          new Notification("ERA Health", { body: `Time for ${item.emoji} ${item.label}!`, icon: "/favicon.ico" });
        }, delay));
      }
    });
    return () => ids.forEach(clearTimeout);
  }, [notifEnabled, plan, today]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enableNotifications() {
    if (!("Notification" in window)) { alert("Notifications not supported on this browser"); return; }
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === "granted");
  }

  function openPrint() {
    if (!plan) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to save/print"); return; }
    win.document.write(buildPrintHTML(plan, today));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }

  if (isLoading || regenerate.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <p style={{ fontSize: 13, color: "var(--text-sub)" }}>
          {regenerate.isPending ? "Building your timetable…" : "Loading plan…"}
        </p>
      </div>
    );
  }

  if (!plan || plan.days.every(d => d.items.length === 0)) {
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
            Set up your wellness modules once — your weekly timetable will be generated automatically every week.
          </p>
          <Link href="/wellness">
            <button className="px-7 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition"
              style={{ background: "var(--btn-gradient)", boxShadow: `0 6px 20px rgba(var(--glow-rgb),0.35)` }}>
              Set up wellness →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const weekStartDate = new Date(plan.weekStart + "T12:00:00");
  const weekEndDate   = new Date(plan.weekStart + "T12:00:00");
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekLabel = `${weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  const todayIdx = plan.days.findIndex(d => d.date === today);
  const hasAllDay = allDayItems.some(col => col.length > 0);

  return (
    <div className="pt-6 pb-12">

      {/* ── Header ── */}
      <div className="px-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-5"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="flex items-end justify-between mb-2">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", marginBottom: 2 }}>Weekly Plan</h1>
            <p style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500 }}>{weekLabel}</p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: 30, fontWeight: 900, color: rateColor, lineHeight: 1, filter: `drop-shadow(0 0 6px ${rateColor}70)` }}>
              {weekRate}%
            </p>
            <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>this week</p>
          </div>
        </div>
        <div className="mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weekRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
        </div>
        <button onClick={() => navigate("/report")}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-1 active:scale-[0.98] transition"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 18 }}>📊</span>
            <div className="text-left">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Weekly Report</p>
              <p style={{ fontSize: 11, color: "var(--text-sub)" }}>See what you accomplished & compare weeks</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-sub)" }} />
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {(["week", "today"] as const).map(tab => (
            <button key={tab} onClick={() => setView(tab)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
              style={{
                background: view === tab ? "var(--btn-gradient)" : "transparent",
                color: view === tab ? "#fff" : "var(--text-sub)",
                boxShadow: view === tab ? `0 4px 14px rgba(var(--glow-rgb),0.3)` : "none",
              }}>
              {tab === "week" ? "📅 Full Week" : "✅ Today"}
            </button>
          ))}
        </div>
      </div>

      {view === "week" ? (
        /* ── WEEK TIMETABLE ── */
        <div>
          {/* Controls row */}
          <div className="px-4 flex items-center justify-between mb-3">
            <button onClick={notifEnabled ? () => setNotifEnabled(false) : enableNotifications}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition"
              style={{
                background: notifEnabled ? "var(--accent-tint-bg)" : "var(--glass-bg)",
                border: `1px solid ${notifEnabled ? "var(--accent-tint-border)" : "var(--glass-border)"}`,
                color: notifEnabled ? "var(--accent)" : "var(--text-sub)",
              }}>
              {notifEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              {notifEnabled ? "Reminders on" : "Reminders off"}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}
                className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-95 transition disabled:opacity-50"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <RefreshCw className={`w-3.5 h-3.5 ${regenerate.isPending ? "animate-spin" : ""}`}
                  style={{ color: "var(--text-sub)" }} />
              </button>
              <button onClick={openPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition"
                style={{ background: "var(--btn-gradient)", color: "#fff", boxShadow: `0 4px 14px rgba(var(--glow-rgb),0.3)` }}>
                <Printer className="w-3 h-3" />
                Save / Print
              </button>
            </div>
          </div>

          {/* Timetable (horizontally scrollable) */}
          <div className="px-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div style={{ minWidth: 490 }}>

              {/* Day header row */}
              <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
                <div />
                {plan.days.map((day, i) => {
                  const isToday = day.date === today;
                  const date = new Date(day.date + "T12:00:00").getDate();
                  return (
                    <div key={i} className="flex flex-col items-center justify-center py-1.5 rounded-xl"
                      style={{
                        background: isToday ? "var(--btn-gradient)" : "var(--glass-bg)",
                        border: `1px solid ${isToday ? "rgba(var(--glow-rgb),0.4)" : "var(--glass-border)"}`,
                        boxShadow: isToday ? `0 4px 12px rgba(var(--glow-rgb),0.25)` : "none",
                      }}>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: isToday ? "rgba(255,255,255,0.75)" : "var(--text-dim)" }}>
                        {SHORT_DAY[i]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#fff" : "var(--text-main)" }}>
                        {date}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ALL DAY row — tasks without a clock time (rest days etc.) */}
              {hasAllDay && (
                <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
                  <div className="flex items-center justify-center rounded-xl"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", minHeight: 44 }}>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.5, textTransform: "uppercase", textAlign: "center", lineHeight: 1.3 }}>
                      ALL<br />DAY
                    </span>
                  </div>
                  {allDayItems.map((items, i) => (
                    <TimetableCell key={i} items={items} isToday={i === todayIdx} />
                  ))}
                </div>
              )}

              {/* Time slot rows */}
              {timetableRows.map(({ time, cols }) => (
                <div key={time} style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
                  <div className="flex items-center justify-center rounded-xl px-1"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", minHeight: 44 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", textAlign: "center", lineHeight: 1.2 }}>
                      {formatTimeShort(time)}
                    </span>
                  </div>
                  {cols.map((items, i) => (
                    <TimetableCell key={i} items={items} isToday={i === todayIdx} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <p className="px-4 mt-3 text-center"
            style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5 }}>
            Tap <strong style={{ color: "var(--accent)" }}>Save / Print</strong> to download as PDF or print — paste it on your wall, fridge, anywhere 📌
          </p>
        </div>

      ) : (

        /* ── TODAY CHECKLIST ── */
        <TodayView
          timedItems={timedItems}
          dayOnlyItems={todayDayOnly}
          todayDoneMap={todayDoneMap}
          todayDoneCount={todayDoneCount}
          todayPct={todayPct}
          today={today}
        />
      )}
    </div>
  );
}

// ── Timetable cell ────────────────────────────────────────────────────────────

function TimetableCell({ items, isToday }: { items: PlanItem[]; isToday: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-px rounded-xl"
      style={{
        minHeight: 44,
        background: items.length > 0
          ? isToday ? "var(--accent-tint-bg)" : "var(--glass-bg)"
          : isToday ? "rgba(var(--glow-rgb),0.04)" : "var(--glass-bg)",
        border: `1px solid ${items.length > 0
          ? isToday ? "var(--accent-tint-border)" : "var(--glass-border)"
          : "var(--glass-border)"}`,
        opacity: items.length === 0 ? 0.35 : 1,
      }}>
      {items.map((item, j) => (
        <span key={j} title={item.label} style={{ fontSize: 15, lineHeight: 1 }}>
          {item.isRestDay ? "😌" : item.emoji}
        </span>
      ))}
    </div>
  );
}

// ── Today checklist view ──────────────────────────────────────────────────────

function TodayView({ timedItems, dayOnlyItems, todayDoneMap, todayDoneCount, todayPct, today }: {
  timedItems: PlanItem[];
  dayOnlyItems: PlanItem[];
  todayDoneMap: Map<string, boolean>;
  todayDoneCount: number;
  todayPct: number;
  today: string;
}) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const dayName = new Date(today + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" });

  // Group consecutive items by the same time into time blocks
  const timeGroups: { time: string; items: PlanItem[] }[] = [];
  timedItems.forEach(item => {
    const last = timeGroups[timeGroups.length - 1];
    if (last && last.time === item.time) last.items.push(item);
    else timeGroups.push({ time: item.time!, items: [item] });
  });

  return (
    <div className="px-4">
      {/* Day summary card */}
      <div className="rounded-2xl p-4 mb-5"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>{dayName}</p>
            <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
              {todayDoneCount} of {timedItems.length} done
            </p>
          </div>
          <p style={{
            fontSize: 28, fontWeight: 900, lineHeight: 1,
            color: todayPct === 100 ? "#4ade80" : "var(--accent)",
            filter: `drop-shadow(0 0 6px ${todayPct === 100 ? "#4ade8070" : "rgba(var(--glow-rgb),0.4)"})`,
          }}>{todayPct}%</p>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${todayPct}%`,
              background: todayPct === 100 ? "#4ade80" : "linear-gradient(90deg,var(--accent),var(--accent-light))",
              boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)`,
            }} />
        </div>
      </div>

      {/* Time-based task groups */}
      {timeGroups.map(({ time, items }) => {
        const isPast  = time < currentTime;
        const isClose = !isPast && Math.abs(
          parseInt(time.replace(":", ""), 10) - parseInt(currentTime.replace(":", ""), 10)
        ) <= 30;
        return (
          <div key={time} className="mb-4">
            {/* Time label */}
            <div className="flex items-center gap-2 mb-2">
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                color: isClose ? "var(--accent)" : isPast ? "var(--text-dim)" : "var(--text-sub)",
              }}>
                {isClose ? "🕐 " : ""}{formatTime(time)}
              </span>
              <div className="flex-1 h-px"
                style={{ background: isClose ? "var(--accent-tint-border)" : "var(--glass-border)" }} />
              {isClose && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-bg)", padding: "2px 6px", borderRadius: 8 }}>
                  NOW
                </span>
              )}
            </div>

            {/* Tasks at this time */}
            <div className="space-y-1.5">
              {items.map(item => {
                const accent  = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
                const done    = todayDoneMap.get(item.moduleType) === true;
                const overdue = isPast && !done && !isClose;
                return (
                  <Link key={`${item.moduleType}-${time}`} href={moduleHref(item.moduleType)}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                      style={{
                        background: done    ? "rgba(74,222,128,0.08)"
                                  : overdue ? "rgba(239,68,68,0.06)"
                                  : "var(--glass-bg)",
                        border: `1px solid ${done    ? "rgba(74,222,128,0.25)"
                                           : overdue ? "rgba(239,68,68,0.2)"
                                           : "var(--glass-border)"}`,
                      }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{done ? "✅" : item.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 14, fontWeight: 600,
                          color: done ? "var(--text-dim)" : "var(--text-main)",
                          textDecoration: done ? "line-through" : "none",
                        }}>{item.label}</p>
                        {item.sub && (
                          <p style={{ fontSize: 11, marginTop: 1, color: done ? "var(--text-dim)" : overdue ? "#f87171" : accent }}>
                            {overdue ? "Overdue — tap to log" : item.sub}
                          </p>
                        )}
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: done ? "var(--text-dim)" : accent }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Any-time tasks (no clock) */}
      {dayOnlyItems.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.3 }}>Any time today</span>
            <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
          </div>
          <div className="space-y-1.5">
            {dayOnlyItems.map(item => {
              const accent = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
              const done   = todayDoneMap.get(item.moduleType) === true;
              return (
                <Link key={item.moduleType} href={moduleHref(item.moduleType)}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                    style={{
                      background: done ? "rgba(74,222,128,0.08)" : "var(--glass-bg)",
                      border: `1px solid ${done ? "rgba(74,222,128,0.25)" : "var(--glass-border)"}`,
                    }}>
                    <span style={{ fontSize: 22 }}>{done ? "✅" : item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--text-dim)" : "var(--text-main)", textDecoration: done ? "line-through" : "none" }}>
                        {item.label}
                      </p>
                      {item.sub && <p style={{ fontSize: 11, marginTop: 1, color: done ? "var(--text-dim)" : accent }}>{item.sub}</p>}
                    </div>
                    <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: done ? "var(--text-dim)" : accent }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {timedItems.length === 0 && dayOnlyItems.length === 0 && (
        <div className="py-10 text-center rounded-2xl"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🌟</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>Nothing planned for today</p>
          <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>
            <Link href="/wellness"><span style={{ color: "var(--accent)" }}>Set up wellness modules</span></Link> to fill your plan
          </p>
        </div>
      )}
    </div>
  );
}

// ── Print/save HTML ───────────────────────────────────────────────────────────

function buildPrintHTML(plan: WeekPlan, today: string): string {
  const weekStart = new Date(plan.weekStart + "T12:00:00");
  const weekEnd   = new Date(plan.weekStart + "T12:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-NG", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}`;

  const timesSet = new Set<string>();
  plan.days.forEach(d => d.items.forEach(i => { if (i.time) timesSet.add(i.time); }));
  const timeSlots = [...timesSet].sort();
  const todayIdx  = plan.days.findIndex(d => d.date === today);
  const hasAllDay = plan.days.some(d => d.items.some(i => !i.time));

  function cell(items: PlanItem[], isToday: boolean): string {
    const cls = [isToday ? "today-col" : "", items.length > 0 ? "has-item" : ""].filter(Boolean).join(" ");
    if (items.length === 0) return `<td class="${cls || "empty"}"></td>`;
    const content = items.map(i => `<span title="${i.label}">${i.isRestDay ? "😌" : i.emoji}</span>`).join("&thinsp;");
    return `<td class="${cls}">${content}</td>`;
  }

  const dayHeaders = plan.days.map((d, i) => {
    const date = new Date(d.date + "T12:00:00").getDate();
    return `<th class="${i === todayIdx ? "today-header" : ""}">${SHORT_DAY[i]}<br><span class="date-num">${date}</span></th>`;
  }).join("");

  const allDayRow = hasAllDay ? `<tr>
    <td class="time-col"><small>ALL<br>DAY</small></td>
    ${plan.days.map((d, i) => cell(d.items.filter(x => !x.time), i === todayIdx)).join("")}
  </tr>` : "";

  const timeRows = timeSlots.map(time => {
    const label = formatTimeShort(time);
    return `<tr>
      <td class="time-col">${label}</td>
      ${plan.days.map((d, i) => cell(d.items.filter(x => x.time === time), i === todayIdx)).join("")}
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>ERA Health · Weekly Plan</title>
  <meta charset="utf-8">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;background:#fff;color:#111}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:10px;border-bottom:3px solid #0d9488}
    .hdr h1{font-size:18px;font-weight:800;color:#0d9488}
    .hdr .sub{font-size:11px;color:#64748b;margin-top:3px}
    .hdr .brand{font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    table{width:100%;border-collapse:collapse}
    th{background:#0f172a;color:#fff;padding:7px 3px;text-align:center;font-size:11px;font-weight:700;line-height:1.3}
    th.time-col{width:48px;background:#1e293b;font-size:9px}
    th.today-header{background:#0d9488}
    .date-num{font-size:15px;display:block;margin-top:1px}
    td{padding:7px 2px;text-align:center;border:1px solid #e2e8f0;font-size:18px;line-height:1;vertical-align:middle;min-height:38px}
    td.time-col{font-weight:700;font-size:10px;color:#475569;background:#f8fafc;white-space:nowrap;width:48px}
    td.has-item{background:#f0fdf4}
    td.today-col{background:#ecfdf5}
    td.today-col.has-item{background:#d1fae5}
    td.empty{background:#fafafa;opacity:.4}
    .footer{margin-top:12px;font-size:10px;color:#94a3b8;text-align:center}
    @media print{body{padding:6px}@page{size:landscape;margin:0.4cm}}
  </style>
</head>
<body>
  <div class="hdr">
    <div><h1>🏥 ERA Health — Weekly Wellness Plan</h1><p class="sub">Week of ${weekLabel}</p></div>
    <p class="brand">ERA Systems</p>
  </div>
  <table>
    <thead><tr><th class="time-col">TIME</th>${dayHeaders}</tr></thead>
    <tbody>${allDayRow}${timeRows}</tbody>
  </table>
  <p class="footer">Generated by ERA Health · era.erasystems.com.ng</p>
  <script>setTimeout(function(){window.print()},500)</script>
</body>
</html>`;
}
