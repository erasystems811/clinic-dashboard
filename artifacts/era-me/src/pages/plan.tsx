import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, BellOff, Printer, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useCurrentPlan, useRegeneratePlan } from "@/lib/plan-api";
import type { PlanItem, WeekPlan } from "@/lib/plan-api";
import { useWellnessToday, useWeekSummary, useQuickLog } from "@/lib/wellness-api";
import { useAuth } from "@/contexts/auth-context";
import { usePlanBySource } from "@/lib/return-visits-api";

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", fruit: "#22c55e",
  vitals: "#ef4444", smoking: "#64748b", alcohol: "#fbbf24",
  eyebreak: "#6366f1", sunscreen: "#eab308", outdoors: "#16a34a",
  hygiene: "#93c5fd", intimacy: "#fda4af",
};

const SHORT_DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getMonday(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function moduleHref(t: string) { return t === "mood_check" ? "/wellness/mood" : `/wellness/${t}`; }
function todayStr()            { return new Date().toISOString().split("T")[0]; }

function checklistKey(item: PlanItem): string {
  if (item.checklistId) return item.checklistId;
  if (item.moduleType === "medications" && item.time) return `medications_${item.time}`;
  return item.moduleType;
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
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2,"0")}${period}`;
}

interface ChecklistItem { id: string; done: boolean; sub?: string; prescribedBy?: string }

export default function PlanPage() {
  const [, navigate] = useLocation();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [view, setView] = useState<"today" | "timetable" | "source">(() =>
    new URLSearchParams(window.location.search).get("tab") === "week" ? "timetable" : "today"
  );
  const { account } = useAuth();
  const firstName = (account?.displayName ?? "").split(" ")[0] || "Your";

  const requestedWeekStart = weekOffset === 0 ? undefined : getMonday(weekOffset);
  const { data: planData, isLoading } = useCurrentPlan(requestedWeekStart);
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };
  const { data: summary } = useWeekSummary();
  const regenerate = useRegeneratePlan();
  const quickLog = useQuickLog();
  const { data: planBySource } = usePlanBySource();

  const plan = planData?.plan;
  const today = todayStr();
  const weekRate = summary?.overallRate ?? 0;
  const rateColor = weekRate >= 80 ? "#4ade80" : weekRate >= 50 ? "#fbbf24" : "#f87171";

  // When the loaded week changes, snap selected day to today (if in that week) or first day
  useEffect(() => {
    if (!plan) return;
    const hasToday = plan.days.some(d => d.date === today);
    setSelectedDate(hasToday ? today : (plan.days[0]?.date ?? today));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.weekStart]);

  // Auto-regenerate if plan has no time slots
  useEffect(() => {
    if (plan && !regenerate.isPending) {
      const hasTime = plan.days.some(d => d.items.some(i => i.time));
      if (!hasTime && plan.days.some(d => d.items.length > 0)) regenerate.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData?.generatedAt]);

  const todayDoneMap = useMemo(() => {
    const checklist = todayRaw?.checklist ?? [];
    const map = new Map(checklist.map(c => [c.id, c.done]));
    const medByTime = new Map<string, boolean[]>();
    for (const c of checklist) {
      if (c.id.startsWith("med_")) {
        const m = c.id.match(/(\d{2}:\d{2})$/);
        if (m) {
          if (!medByTime.has(m[1])) medByTime.set(m[1], []);
          medByTime.get(m[1])!.push(c.done);
        }
      }
    }
    for (const [time, dones] of medByTime) {
      map.set(`medications_${time}`, dones.every(Boolean));
    }
    return map;
  }, [todayRaw]);

  const selectedDay = plan?.days.find(d => d.date === selectedDate) ?? plan?.days[0];
  const isViewingToday = selectedDate === today;

  const timedItems = useMemo(() => {
    if (!selectedDay) return [];
    return [...selectedDay.items.filter(i => i.time)].sort((a, b) => a.time!.localeCompare(b.time!));
  }, [selectedDay]);

  const dayOnlyItems = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.items.filter(i => !i.time && !i.isRestDay);
  }, [selectedDay]);

  const doneCount = isViewingToday ? timedItems.filter(i => todayDoneMap.get(checklistKey(i)) === true).length : 0;
  const todayPct = isViewingToday && timedItems.length > 0 ? Math.round((doneCount / timedItems.length) * 100) : 0;

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
      if (delay > 0 && delay < 86400000)
        ids.push(setTimeout(() => new Notification("ERA Health", { body: `Time for ${item.label}!`, icon: "/favicon.ico" }), delay));
    });
    return () => ids.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifEnabled, plan, today]);

  async function enableNotifications() {
    if (!("Notification" in window)) { alert("Notifications not supported on this browser"); return; }
    setNotifEnabled(await Notification.requestPermission() === "granted");
  }

  function openPrint() {
    if (!plan) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to save/print"); return; }
    const s = getComputedStyle(document.documentElement);
    const darkMode = document.documentElement.classList.contains("dark");
    const livePalette: PrintPalette = {
      accent:       s.getPropertyValue("--accent").trim() || "#14b8a6",
      accentLight:  s.getPropertyValue("--accent-light").trim() || "#5eead4",
      btnGradient:  s.getPropertyValue("--btn-gradient").trim() || "linear-gradient(135deg,#0d9488,#14b8a6)",
      bgDark:       s.getPropertyValue("--bg-base").trim() || "#060d1f",
      bgLight:      s.getPropertyValue("--bg-base").trim() || "#f0fdfb",
    };
    win.document.write(buildPrintHTML(plan, today, firstName, livePalette, darkMode));
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
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 mb-6"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 16, marginBottom: 8 }}>No plan yet</p>
          <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.55, marginBottom: 22 }}>
            Set up your wellness modules and your weekly timetable will be built automatically.
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
  const weekLabel = `${weekStartDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEndDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return (
    <div className="pt-5 pb-16">

      {/* ── Header ── */}
      <div className="px-4 mb-5">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 mb-4"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>

        <div className="flex items-center justify-between">
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>
            {firstName}'s Plan
          </h1>
          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={notifEnabled ? () => setNotifEnabled(false) : enableNotifications}
              className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
              style={{ background: notifEnabled ? "var(--accent-tint-bg)" : "var(--glass-bg)", border: `1px solid ${notifEnabled ? "var(--accent-tint-border)" : "var(--glass-border)"}` }}>
              {notifEnabled ? <Bell className="w-4 h-4" style={{ color: "var(--accent)" }} /> : <BellOff className="w-4 h-4" style={{ color: "var(--text-sub)" }} />}
            </button>
            <button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}
              className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition disabled:opacity-50"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <RefreshCw className={`w-4 h-4 ${regenerate.isPending ? "animate-spin" : ""}`} style={{ color: "var(--text-sub)" }} />
            </button>
            <button onClick={openPrint}
              className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
              style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 12px rgba(var(--glow-rgb),0.3)` }}>
              <Printer className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg active:scale-90 transition"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <ChevronLeft className="w-3.5 h-3.5" style={{ color: "var(--text-sub)" }} />
          </button>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub)", flex: 1, textAlign: "center" }}>
            {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : weekOffset === 1 ? "Next week" : ""}
            {" "}· {weekLabel}
          </p>
          {weekOffset !== 0 ? (
            <button onClick={() => setWeekOffset(0)}
              className="px-2 h-7 rounded-lg text-xs font-bold active:scale-90 transition"
              style={{ background: "var(--accent-tint-bg)", border: "1px solid var(--accent-tint-border)", color: "var(--accent)" }}>
              Now
            </button>
          ) : (
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg active:scale-90 transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-sub)" }} />
            </button>
          )}
        </div>

        {/* Week progress bar (current week only) */}
        {weekOffset === 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontSize: 11, color: "var(--text-sub)", fontWeight: 600 }}>Week completion</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: rateColor }}>{weekRate}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${weekRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {(["today", "timetable", "source"] as const).map(tab => (
            <button key={tab} onClick={() => setView(tab)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition active:scale-95"
              style={{
                background: view === tab ? "var(--btn-gradient)" : "transparent",
                color: view === tab ? "#fff" : "var(--text-sub)",
                boxShadow: view === tab ? `0 4px 14px rgba(var(--glow-rgb),0.3)` : "none",
              }}>
              {tab === "today" ? "Today" : tab === "timetable" ? "Full Week" : "By Source"}
            </button>
          ))}
        </div>
      </div>

      {view === "source" ? (
        <div className="px-4">
          <SourceSplitView data={planBySource} navigate={navigate} />
        </div>
      ) : view === "timetable" ? (
        <div className="px-4">
          <WeekTableView plan={plan} today={today} onPrint={openPrint} />
          <button onClick={() => navigate("/report")}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl mt-3 active:scale-[0.98] transition"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: 18 }}>📊</span>
              <div className="text-left">
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Weekly Report</p>
                <p style={{ fontSize: 11, color: "var(--text-sub)" }}>See what you accomplished</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-sub)" }} />
          </button>
        </div>
      ) : (
        <>

      {/* ── 7-day strip ── */}
      <div className="px-3 mb-5">
        <div className="flex gap-1">
          {plan.days.map((day, i) => {
            const d = new Date(day.date + "T12:00:00");
            const isSelected = day.date === selectedDate;
            const isToday    = day.date === today;
            const hasItems   = day.items.filter(it => !it.isRestDay).length > 0;
            return (
              <button key={i} onClick={() => setSelectedDate(day.date)}
                className="flex-1 flex flex-col items-center py-2.5 rounded-2xl transition active:scale-95"
                style={{
                  background: isSelected ? "var(--btn-gradient)" : "var(--glass-bg)",
                  border: `1px solid ${isSelected ? "transparent" : isToday ? "var(--accent-tint-border)" : "var(--glass-border)"}`,
                  boxShadow: isSelected ? `0 4px 14px rgba(var(--glow-rgb),0.3)` : "none",
                }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: isSelected ? "rgba(255,255,255,0.8)" : "var(--text-dim)", textTransform: "uppercase", marginBottom: 3 }}>
                  {SHORT_DAY[i]}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: isSelected ? "#fff" : isToday ? "var(--accent)" : "var(--text-main)", lineHeight: 1 }}>
                  {d.getDate()}
                </span>
                {/* Activity dot */}
                <div style={{
                  width: 4, height: 4, borderRadius: "50%", marginTop: 4,
                  background: isSelected ? "rgba(255,255,255,0.5)" : isToday ? "var(--accent)" : hasItems ? "var(--text-dim)" : "transparent",
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected day schedule ── */}
      <div className="px-4">
        <DayScheduleView
          day={selectedDay!}
          isToday={isViewingToday}
          timedItems={timedItems}
          dayOnlyItems={dayOnlyItems}
          todayDoneMap={todayDoneMap}
          doneCount={doneCount}
          todayPct={todayPct}
          onMedBatch={(batchIds) => quickLog.mutate({ moduleType: "medications", data: { taken: Object.fromEntries(batchIds.map(bid => [bid.replace(/^med_/, ""), true])) } })}
        />
      </div>

        </>
      )}
    </div>
  );
}

// ── Day schedule view (replaces old TodayView, works for any day) ─────────────

function DayScheduleView({ day, isToday, timedItems, dayOnlyItems, todayDoneMap, doneCount, todayPct, onMedBatch }: {
  day: WeekPlan["days"][number]; isToday: boolean;
  timedItems: PlanItem[]; dayOnlyItems: PlanItem[];
  todayDoneMap: Map<string, boolean>; doneCount: number; todayPct: number;
  onMedBatch: (batchIds: string[]) => void;
}) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const dateObj = new Date(day.date + "T12:00:00");
  const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // Group timed items by slot
  const timeGroups: { time: string; items: PlanItem[] }[] = [];
  timedItems.forEach(item => {
    const last = timeGroups[timeGroups.length - 1];
    if (last && last.time === item.time) last.items.push(item);
    else timeGroups.push({ time: item.time!, items: [item] });
  });

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-main)" }}>{dayName}</p>
          {isToday && (
            <span style={{
              display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: "var(--accent)", background: "var(--accent-tint-bg)",
              border: "1px solid var(--accent-tint-border)",
              borderRadius: 8, padding: "2px 8px", marginTop: 3,
            }}>TODAY</span>
          )}
        </div>
        {isToday && timedItems.length > 0 && (
          <div className="text-right">
            <p style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: todayPct === 100 ? "#4ade80" : "var(--accent)", filter: `drop-shadow(0 0 6px ${todayPct === 100 ? "#4ade8070" : "rgba(var(--glow-rgb),0.4)"})` }}>
              {todayPct}%
            </p>
            <p style={{ fontSize: 10, color: "var(--text-sub)", marginTop: 2 }}>{doneCount}/{timedItems.length} done</p>
          </div>
        )}
      </div>

      {/* Today progress bar */}
      {isToday && timedItems.length > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${todayPct}%`,
              background: todayPct === 100 ? "#4ade80" : "linear-gradient(90deg,var(--accent),var(--accent-light))",
              boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)`,
            }} />
        </div>
      )}

      {/* Timed slots */}
      {timeGroups.length === 0 && dayOnlyItems.length === 0 && (
        <div className="py-10 text-center rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>😌</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>Rest day</p>
          <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>Nothing scheduled — take it easy</p>
        </div>
      )}

      <div className="space-y-4">
        {timeGroups.map(({ time, items }) => {
          const isPast  = isToday && time < currentTime;
          const isClose = isToday && !isPast && (() => {
            const [h1, m1] = time.split(":").map(Number);
            const [h2, m2] = currentTime.split(":").map(Number);
            return Math.abs((h1 * 60 + m1) - (h2 * 60 + m2)) <= 30;
          })();
          return (
            <div key={time}>
              {/* Time divider */}
              <div className="flex items-center gap-2 mb-2">
                <span style={{
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.3, whiteSpace: "nowrap",
                  color: isClose ? "var(--accent)" : isPast ? "var(--text-dim)" : "var(--text-sub)",
                }}>
                  {formatTime(time)}
                </span>
                <div className="flex-1 h-px" style={{ background: isClose ? "var(--accent-tint-border)" : "var(--glass-border)" }} />
                {isClose && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", background: "var(--accent-tint-bg)", padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap" }}>
                    COMING UP
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {items.map(item => {
                  const accent  = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
                  const done    = isToday && todayDoneMap.get(checklistKey(item)) === true;
                  const overdue = isToday && isPast && !done;
                  const isMedBatch = item.moduleType === "medications" && item.batchIds?.length;
                  const inner = (
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                      style={{
                        background: done ? "rgba(74,222,128,0.08)" : overdue ? "rgba(239,68,68,0.06)" : "var(--glass-bg)",
                        border: `1px solid ${done ? "rgba(74,222,128,0.25)" : overdue ? "rgba(239,68,68,0.2)" : "var(--glass-border)"}`,
                      }}>
                      {/* Status circle — only for today */}
                      {isToday && (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: done ? "#4ade80" : overdue ? "rgba(239,68,68,0.12)" : "var(--glass-track)", border: done ? "none" : `2px solid ${overdue ? "#f87171" : accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {done && <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span>}
                        </div>
                      )}
                      {/* Accent bar for non-today days */}
                      {!isToday && (
                        <div style={{ width: 4, height: 36, borderRadius: 4, flexShrink: 0, background: accent }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--text-dim)" : "var(--text-main)", textDecoration: done ? "line-through" : "none" }}>
                          {item.label}
                        </p>
                        {item.sub && (
                          <p style={{ fontSize: 11, marginTop: 2, color: done ? "var(--text-dim)" : overdue ? "#f87171" : "var(--text-sub)" }}>
                            {overdue ? "Overdue — tap to mark all done" : item.sub}
                          </p>
                        )}
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: done ? "var(--text-dim)" : "var(--text-sub)" }} />
                    </div>
                  );
                  return isMedBatch
                    ? <button key={`${item.moduleType}-${time}`} className="w-full text-left" disabled={done} onClick={() => onMedBatch(item.batchIds!)}>{inner}</button>
                    : <Link key={`${item.moduleType}-${time}`} href={moduleHref(item.moduleType)}>{inner}</Link>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Any-time tasks */}
      {dayOnlyItems.length > 0 && (
        <div className={timeGroups.length > 0 ? "mt-5" : ""}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.3, whiteSpace: "nowrap" }}>Any time</span>
            <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
          </div>
          <div className="space-y-1.5">
            {dayOnlyItems.map(item => {
              const accent = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
              const done   = isToday && todayDoneMap.get(checklistKey(item)) === true;
              return (
                <Link key={item.moduleType} href={moduleHref(item.moduleType)}>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                    style={{ background: done ? "rgba(74,222,128,0.08)" : "var(--glass-bg)", border: `1px solid ${done ? "rgba(74,222,128,0.25)" : "var(--glass-border)"}` }}>
                    {isToday ? (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: done ? "#4ade80" : "var(--glass-track)", border: done ? "none" : `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {done && <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span>}
                      </div>
                    ) : (
                      <div style={{ width: 4, height: 36, borderRadius: 4, flexShrink: 0, background: accent }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--text-dim)" : "var(--text-main)", textDecoration: done ? "line-through" : "none" }}>{item.label}</p>
                      {item.sub && <p style={{ fontSize: 11, marginTop: 2, color: done ? "var(--text-dim)" : "var(--text-sub)" }}>{item.sub}</p>}
                    </div>
                    <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, color: "var(--text-sub)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Full-week table (collapsible, kept for reference/print) ───────────────────

const thBase: React.CSSProperties = {
  padding: "10px 6px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 12,
  color: "var(--text-sub)",
  background: "var(--glass-track)",
  borderBottom: "1px solid var(--glass-border)",
  borderRight: "1px solid var(--glass-border)",
};

const tdTimeBase: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "center",
  fontSize: 10,
  fontWeight: 800,
  color: "var(--accent)",
  background: "var(--glass-track)",
  borderRight: "1px solid var(--glass-border)",
  whiteSpace: "nowrap" as const,
  verticalAlign: "middle",
};

function TaskCell({ items, isToday }: { items: PlanItem[]; isToday: boolean }) {
  if (items.length === 0) {
    return (
      <td style={{ padding: "8px 4px", textAlign: "center", borderRight: "1px solid var(--glass-border)", background: isToday ? "rgba(var(--glow-rgb),0.03)" : "transparent", opacity: 0.25, verticalAlign: "middle" }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>–</span>
      </td>
    );
  }
  return (
    <td style={{ padding: "6px 4px", textAlign: "center", borderRight: "1px solid var(--glass-border)", background: isToday ? "rgba(var(--glow-rgb),0.06)" : "transparent", verticalAlign: "middle" }}>
      {items.map((item, j) => {
        const accent = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
        return (
          <Link key={j} href={moduleHref(item.moduleType)}>
            <div style={{ display: "inline-block", width: "100%", fontSize: 10, fontWeight: 700, lineHeight: 1.3, color: isToday ? "var(--text-main)" : "var(--text-sub)", padding: "3px 2px", borderRadius: 6, borderLeft: `3px solid ${accent}`, background: isToday ? `${accent}15` : `${accent}08`, textAlign: "left", paddingLeft: 5, cursor: "pointer", marginBottom: j < items.length - 1 ? 3 : 0 }}>
              {item.label}
            </div>
          </Link>
        );
      })}
    </td>
  );
}

function WeekTableView({ plan, today, onPrint }: { plan: WeekPlan; today: string; onPrint: () => void }) {
  const todayIdx = plan.days.findIndex(d => d.date === today);

  const timeSlots = useMemo(() => {
    const set = new Set<string>();
    plan.days.forEach(d => d.items.forEach(i => { if (i.time) set.add(i.time); }));
    return [...set].sort();
  }, [plan]);

  const allDayCols = plan.days.map(d => d.items.filter(i => !i.time && !i.isRestDay));
  const hasAllDay  = allDayCols.some(col => col.length > 0);

  return (
    <div>
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: 56, minWidth: 56 }}>Time</th>
                {plan.days.map((day, i) => {
                  const isToday = day.date === today;
                  const date = new Date(day.date + "T12:00:00").getDate();
                  return (
                    <th key={i} style={{ ...thBase, background: isToday ? "var(--accent)" : "var(--glass-track)", color: isToday ? "#fff" : "var(--text-sub)", borderBottom: isToday ? `2px solid var(--accent)` : "1px solid var(--glass-border)" }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: isToday ? 0.85 : 0.7 }}>{SHORT_DAY[i]}</span>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 900, lineHeight: 1.2, marginTop: 2 }}>{date}</span>
                      {isToday && <span style={{ display: "block", fontSize: 8, fontWeight: 700, marginTop: 2, opacity: 0.9 }}>TODAY</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hasAllDay && (
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <td style={tdTimeBase}>Any</td>
                  {allDayCols.map((items, i) => <TaskCell key={i} items={items} isToday={i === todayIdx} />)}
                </tr>
              )}
              {timeSlots.map((time, ri) => (
                <tr key={time} style={{ borderBottom: ri < timeSlots.length - 1 ? "1px solid var(--glass-border)" : "none" }}>
                  <td style={tdTimeBase}>{formatTimeShort(time)}</td>
                  {plan.days.map((day, i) => {
                    const items = day.items.filter(x => x.time === time);
                    return <TaskCell key={i} items={items} isToday={i === todayIdx} />;
                  })}
                </tr>
              ))}
              {timeSlots.length === 0 && !hasAllDay && (
                <tr><td colSpan={8} style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>No tasks scheduled yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <button onClick={onPrint}
        className="w-full flex items-center justify-center gap-2 mt-3 py-3.5 rounded-2xl text-sm font-bold text-white active:scale-95 transition"
        style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 14px rgba(var(--glow-rgb),0.3)` }}>
        <Printer className="w-4 h-4" /> Save / Print timetable
      </button>
    </div>
  );
}

// ── Source split view: Hospital Plan vs My Plan — structured schedule view ────

function SectionHeading({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.4, color, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: color, opacity: 0.25 }} />
    </div>
  );
}

function SubHeading({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6, marginTop: 2 }}>{label}</p>
  );
}

function PlanRow({ left, right, sub, badge }: { left: string; right?: string; sub?: string; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", flex: 1, lineHeight: 1.4 }}>{left}</span>
      {badge && (
        <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "var(--btn-gradient)", padding: "2px 7px", borderRadius: 5, flexShrink: 0, alignSelf: "center" }}>{badge}</span>
      )}
      {right && !badge && (
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-sub)", flexShrink: 0, textAlign: "right", maxWidth: "45%" }}>{right}</span>
      )}
      {sub && (
        <span style={{ fontSize: 11, color: "var(--text-sub)", flexShrink: 0, textAlign: "right" }}>{sub}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--glass-border)", margin: "10px 0" }} />;
}

function SourceSplitView({ data, navigate }: {
  data: import("@/lib/return-visits-api").PlanBySource | undefined;
  navigate: (path: string) => void;
}) {
  const today = todayStr();
  const carePlans    = data?.carePlans    ?? [];
  const returnVisits = data?.returnVisits ?? [];
  const myMods       = data?.myModules ?? [];

  const hasHospital = carePlans.length > 0 || returnVisits.length > 0;

  return (
    <div className="space-y-6">

      {/* ── HOSPITAL PLAN ─────────────────────────────────────────────── */}
      <div>
        <SectionHeading label="HOSPITAL PLAN" color="var(--accent)" />
        <div className="rounded-2xl px-4 py-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {!hasHospital ? (
            <p style={{ fontSize: 13, color: "var(--text-sub)", textAlign: "center", padding: "20px 0" }}>
              No hospital plan yet. Connect your hospital to see your care plans here.
            </p>
          ) : (
            <>
              {/* Treatment / care plans */}
              {carePlans.length > 0 && (
                <>
                  <SubHeading label="Active Treatment" />
                  {carePlans.map((plan, i) => (
                    <React.Fragment key={plan.id}>
                      <div style={{ paddingBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", flex: 1 }}>{plan.summary}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-bg)", padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>{plan.department}</span>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-sub)" }}>
                          {plan.hospitalName ?? "Hospital"} · since {new Date(plan.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      {i < carePlans.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </>
              )}

              {/* Return visits */}
              {returnVisits.length > 0 && (
                <>
                  {carePlans.length > 0 && <Divider />}
                  <SubHeading label="Scheduled Visits" />
                  {/* Column headers */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.8, width: 68, flexShrink: 0 }}>DATE</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.8, flex: 1 }}>REASON</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", letterSpacing: 0.8, width: 60, textAlign: "right", flexShrink: 0 }}>TIME</span>
                  </div>
                  {returnVisits.map((v) => {
                    const isToday = v.visitDate === today;
                    const d = new Date(v.visitDate + "T12:00:00");
                    const dateStr = isToday ? "Today"
                      : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                    const timeStr = v.visitTime
                      ? v.visitTime.slice(0, 5).replace(/^(\d):/, "0$1:")
                        .replace(/^(\d{2}):(\d{2})$/, (_, h, m) => {
                          const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr < 12 ? "AM" : "PM"}`;
                        })
                      : "—";
                    return (
                      <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "baseline", paddingBottom: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? "var(--accent)" : "var(--text-main)", width: 68, flexShrink: 0, lineHeight: 1.3 }}>{dateStr}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-main)", flex: 1, lineHeight: 1.3 }}>{v.reason}{v.hospitalName ? <span style={{ color: "var(--text-sub)", fontWeight: 400 }}> · {v.hospitalName}</span> : null}</span>
                        <span style={{ fontSize: 11, color: "var(--text-sub)", width: 60, textAlign: "right", flexShrink: 0 }}>{timeStr}</span>
                        {isToday && <span style={{ fontSize: 8, fontWeight: 900, color: "#fff", background: "var(--btn-gradient)", padding: "2px 6px", borderRadius: 4, flexShrink: 0, alignSelf: "center" }}>TODAY</span>}
                      </div>
                    );
                  })}
                </>
              )}

            </>
          )}
        </div>
      </div>

      {/* ── MY PLAN ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeading label="MY PLAN" color="var(--text-sub)" />
        <div className="rounded-2xl px-4 py-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {myMods.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 10 }}>You have not set up any personal programs yet.</p>
              <button onClick={() => navigate("/programs")} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                Browse Programs →
              </button>
            </div>
          ) : (
            <>
              <SubHeading label="Active Programs" />
              {myMods.map((m) => (
                <PlanRow key={m.moduleType} left={`${m.emoji}  ${m.label}`} right="Daily" />
              ))}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Print HTML ────────────────────────────────────────────────────────────────

type PrintPalette = { accent: string; accentLight: string; btnGradient: string; bgDark: string; bgLight: string };

function buildPrintHTML(plan: WeekPlan, today: string, firstName: string, palette: PrintPalette, darkMode: boolean): string {
  const weekStartObj = new Date(plan.weekStart + "T12:00:00");
  const weekEndObj   = new Date(plan.weekStart + "T12:00:00");
  weekEndObj.setDate(weekEndObj.getDate() + 6);
  const weekLabel = `${weekStartObj.toLocaleDateString("en-NG", { month: "long", day: "numeric" })} – ${weekEndObj.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}`;

  const bg = "#f8fafc", cardBg = "#ffffff", cardBdr = "rgba(0,0,0,0.09)";
  const textMain = "#0f172a", textSub = "#475569", textDim = "#94a3b8";
  const todayCardBg = `${palette.accent}14`, todayCardBdr = `${palette.accent}60`;

  const dayCards = plan.days.map((day, i) => {
    const isToday = day.date === today;
    const dateObj = new Date(day.date + "T12:00:00");
    const sortedItems = [...day.items].filter(it => !it.isRestDay).sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    const seen = new Set<string>();
    const uniqueItems = sortedItems.filter(it => { if (seen.has(it.moduleType)) return false; seen.add(it.moduleType); return true; });
    const taskRows = uniqueItems.length > 0
      ? uniqueItems.map(item => `<div class="task-row"><span class="task-time">${item.time ? formatTimeShort(item.time) : "–"}</span><span class="task-label">${item.label}</span></div>`).join("")
      : `<div class="rest-label">Rest day</div>`;
    return `<div class="day-card${isToday ? " today-card" : ""}"><div class="card-header${isToday ? " today-header" : ""}"><div class="day-name">${FULL_DAY[i]}</div><div class="day-date">${dateObj.getDate()} ${dateObj.toLocaleDateString("en-NG",{month:"short"})}${isToday?` <span class="today-pill">TODAY</span>`:""}</div></div><div class="card-body">${taskRows}</div></div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><title>${firstName}'s Weekly Plan</title><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:${bg};color:${textMain};padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid ${palette.accent}}.page-title{font-size:22px;font-weight:900;color:${palette.accent}}.page-sub{font-size:12px;color:${textSub};margin-top:4px}.page-brand{font-size:10px;color:${textDim};font-weight:700;letter-spacing:1.5px;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}.day-card{border-radius:14px;overflow:hidden;background:${cardBg};border:1px solid ${cardBdr}}.today-card{background:${todayCardBg};border:2px solid ${todayCardBdr};box-shadow:0 4px 20px ${palette.accent}25}.card-header{padding:10px 10px 8px;background:${darkMode?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"};border-bottom:1px solid ${cardBdr}}.today-header{background:${palette.btnGradient}}.day-name{font-size:12px;font-weight:800;color:${textMain};line-height:1}.today-header .day-name,.today-header .day-date{color:#fff}.day-date{font-size:10px;color:${textSub};margin-top:3px;line-height:1}.today-pill{display:inline-block;background:rgba(255,255,255,0.25);color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:10px;vertical-align:middle;margin-left:3px}.card-body{padding:8px 10px}.task-row{display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid ${darkMode?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)"}}.task-row:last-child{border-bottom:none}.task-time{font-size:9px;font-weight:700;color:${palette.accent};min-width:30px;padding-top:1px;white-space:nowrap}.task-label{font-size:10px;font-weight:600;color:${textMain};line-height:1.35}.rest-label{font-size:10px;color:${textDim};text-align:center;padding:8px 0;font-style:italic}.footer{margin-top:16px;font-size:10px;color:${textDim};text-align:center}@media print{body{padding:8px}@page{size:landscape;margin:0.4cm}}</style></head><body><div class="page-header"><div><div class="page-title">${firstName}'s Weekly Health Plan</div><div class="page-sub">Week of ${weekLabel}</div></div><div class="page-brand">ERA Health</div></div><div class="grid">${dayCards}</div><div class="footer">Generated by ERA Health · era.erasystems.com.ng</div></body></html>`;
}
