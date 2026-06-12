import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, BellOff, Printer, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useCurrentPlan, useRegeneratePlan } from "@/lib/plan-api";
import type { PlanItem, WeekPlan } from "@/lib/plan-api";
import { useWellnessToday, useWeekSummary } from "@/lib/wellness-api";
import { useAuth } from "@/contexts/auth-context";

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", fruit: "#22c55e",
  vitals: "#ef4444", smoking: "#64748b", eyebreak: "#6366f1",
  sunscreen: "#eab308", outdoors: "#16a34a", hygiene: "#93c5fd",
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

interface ChecklistItem { id: string; done: boolean; sub?: string }

export default function PlanPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"week" | "today">("week");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, -1 = last week, +1 = next week
  const { account } = useAuth();
  const firstName = (account?.displayName ?? "").split(" ")[0] || "Your";

  const requestedWeekStart = weekOffset === 0 ? undefined : getMonday(weekOffset);
  const { data: planData, isLoading } = useCurrentPlan(requestedWeekStart);
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };
  const { data: summary } = useWeekSummary();
  const regenerate = useRegeneratePlan();

  const plan = planData?.plan;
  const today = todayStr();
  const weekRate = summary?.overallRate ?? 0;
  const rateColor = weekRate >= 80 ? "#4ade80" : weekRate >= 50 ? "#fbbf24" : "#f87171";

  useEffect(() => {
    if (plan && !regenerate.isPending) {
      const hasTime = plan.days.some(d => d.items.some(i => i.time));
      if (!hasTime && plan.days.some(d => d.items.length > 0)) regenerate.mutate();
    }
  }, [planData?.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayDoneMap = useMemo(() => {
    const checklist = todayRaw?.checklist ?? [];
    return new Map(checklist.map(c => [c.id, c.done]));
  }, [todayRaw]);

  const { timedItems, todayDayOnly } = useMemo(() => {
    if (!plan) return { timedItems: [], todayDayOnly: [] };
    const todayDay = plan.days.find(d => d.date === today) ?? plan.days[0];
    const timed = [...todayDay.items.filter(i => i.time)].sort((a, b) => a.time!.localeCompare(b.time!));
    const dayOnly = todayDay.items.filter(i => !i.time && !i.isRestDay);
    return { timedItems: timed, todayDayOnly: dayOnly };
  }, [plan, today]);

  const todayDoneCount = timedItems.filter(i => todayDoneMap.get(i.moduleType) === true).length;
  const todayPct = timedItems.length > 0 ? Math.round((todayDoneCount / timedItems.length) * 100) : 0;

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
  }, [notifEnabled, plan, today]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enableNotifications() {
    if (!("Notification" in window)) { alert("Notifications not supported on this browser"); return; }
    setNotifEnabled(await Notification.requestPermission() === "granted");
  }

  function openPrint() {
    if (!plan) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to save/print"); return; }
    win.document.write(buildPrintHTML(plan, today, firstName));
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
  const weekLabel = `${weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  return (
    <div className="pt-6 pb-12">

      {/* ── Header ── */}
      <div className="px-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-5"
          style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>
              {firstName}'s Plan
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 500, marginTop: 2 }}>
              {weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : weekOffset === 1 ? "Next week" : weekLabel}
              {" · "}{weekLabel}
            </p>
          </div>
          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                className="px-2 h-8 rounded-xl text-xs font-bold active:scale-90 transition"
                style={{ background: "var(--accent-tint-bg)", border: "1px solid var(--accent-tint-border)", color: "var(--accent)" }}>
                Today
              </button>
            )}
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
          </div>
        </div>
        {weekOffset !== 0 && (
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{weekLabel}</p>
        )}
        <div className="mt-3 mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weekRate}%`, background: rateColor, boxShadow: `0 0 8px ${rateColor}60` }} />
        </div>

        <button onClick={() => navigate("/report")}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-1 active:scale-[0.98] transition"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 16 }}>📊</span>
            <div className="text-left">
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Weekly Report</p>
              <p style={{ fontSize: 11, color: "var(--text-sub)" }}>See what you accomplished & compare weeks</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-sub)" }} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 mb-4 mt-4">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {(["week", "today"] as const).map(tab => (
            <button key={tab} onClick={() => setView(tab)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
              style={{
                background: view === tab ? "var(--btn-gradient)" : "transparent",
                color: view === tab ? "#fff" : "var(--text-sub)",
                boxShadow: view === tab ? `0 4px 14px rgba(var(--glow-rgb),0.3)` : "none",
              }}>
              {tab === "week" ? "Full Week" : "Today"}
            </button>
          ))}
        </div>
      </div>

      {view === "week" ? (
        <WeekTableView
          plan={plan} today={today} firstName={firstName}
          notifEnabled={notifEnabled}
          onToggleNotif={notifEnabled ? () => setNotifEnabled(false) : enableNotifications}
          onRegenerate={() => regenerate.mutate()}
          regenerating={regenerate.isPending}
          onPrint={openPrint}
        />
      ) : (
        <TodayView
          timedItems={timedItems} dayOnlyItems={todayDayOnly}
          todayDoneMap={todayDoneMap} todayDoneCount={todayDoneCount}
          todayPct={todayPct} today={today}
        />
      )}
    </div>
  );
}

// ── Full-week table on one card ───────────────────────────────────────────────

function WeekTableView({ plan, today, firstName, notifEnabled, onToggleNotif, onRegenerate, regenerating, onPrint }: {
  plan: WeekPlan; today: string; firstName: string;
  notifEnabled: boolean;
  onToggleNotif: () => void; onRegenerate: () => void;
  regenerating: boolean; onPrint: () => void;
}) {
  const todayIdx = plan.days.findIndex(d => d.date === today);

  // Collect all unique time slots, sorted
  const timeSlots = useMemo(() => {
    const set = new Set<string>();
    plan.days.forEach(d => d.items.forEach(i => { if (i.time) set.add(i.time); }));
    return [...set].sort();
  }, [plan]);

  // Items with no time
  const hasAnyTime = timeSlots.length > 0;
  const allDayCols = plan.days.map(d => d.items.filter(i => !i.time && !i.isRestDay));
  const hasAllDay  = allDayCols.some(col => col.length > 0);

  return (
    <div className="px-4">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onToggleNotif}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition"
          style={{
            background: notifEnabled ? "var(--accent-tint-bg)" : "var(--glass-bg)",
            border: `1px solid ${notifEnabled ? "var(--accent-tint-border)" : "var(--glass-border)"}`,
            color: notifEnabled ? "var(--accent)" : "var(--text-sub)",
          }}>
          {notifEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {notifEnabled ? "Reminders on" : "Reminders off"}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onRegenerate} disabled={regenerating}
            className="w-8 h-8 flex items-center justify-center rounded-xl active:scale-95 transition disabled:opacity-50"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
            title="Refresh plan">
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} style={{ color: "var(--text-sub)" }} />
          </button>
          <button onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition"
            style={{ background: "var(--btn-gradient)", color: "#fff", boxShadow: `0 4px 14px rgba(var(--glow-rgb),0.3)` }}>
            <Printer className="w-3.5 h-3.5" />
            Save / Print
          </button>
        </div>
      </div>

      {/* Big table card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>

        {/* Card title */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
            {firstName}'s Plan for This Week
          </p>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>

            {/* Day header row */}
            <thead>
              <tr>
                <th style={{ ...thBase, width: 56, minWidth: 56 }}>Time</th>
                {plan.days.map((day, i) => {
                  const isToday = day.date === today;
                  const date = new Date(day.date + "T12:00:00").getDate();
                  return (
                    <th key={i} style={{
                      ...thBase,
                      background: isToday ? "var(--accent)" : "var(--glass-track)",
                      color: isToday ? "#fff" : "var(--text-sub)",
                      borderBottom: isToday ? `2px solid var(--accent)` : "1px solid var(--glass-border)",
                    }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", opacity: isToday ? 0.85 : 0.7 }}>
                        {SHORT_DAY[i]}
                      </span>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 900, lineHeight: 1.2, marginTop: 2 }}>
                        {date}
                      </span>
                      {isToday && (
                        <span style={{ display: "block", fontSize: 8, fontWeight: 700, marginTop: 2, opacity: 0.9 }}>TODAY</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* All-day row */}
              {hasAllDay && (
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <td style={{ ...tdTimeBase }}>Any time</td>
                  {allDayCols.map((items, i) => (
                    <TaskCell key={i} items={items} isToday={i === todayIdx} />
                  ))}
                </tr>
              )}

              {/* Timed rows */}
              {hasAnyTime && timeSlots.map((time, ri) => (
                <tr key={time} style={{ borderBottom: ri < timeSlots.length - 1 ? "1px solid var(--glass-border)" : "none" }}>
                  <td style={{ ...tdTimeBase }}>{formatTimeShort(time)}</td>
                  {plan.days.map((day, i) => {
                    const items = day.items.filter(x => x.time === time);
                    return <TaskCell key={i} items={items} isToday={i === todayIdx} />;
                  })}
                </tr>
              ))}

              {!hasAnyTime && !hasAllDay && (
                <tr>
                  <td colSpan={8} style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>
                    No tasks scheduled yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-center" style={{ fontSize: 11, color: "var(--text-dim)" }}>
        Tap <strong style={{ color: "var(--accent)" }}>Save / Print</strong> to download as PDF
      </p>
    </div>
  );
}

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
      <td style={{
        padding: "8px 4px",
        textAlign: "center",
        borderRight: "1px solid var(--glass-border)",
        background: isToday ? "rgba(var(--glow-rgb),0.03)" : "transparent",
        opacity: 0.25,
        verticalAlign: "middle",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>–</span>
      </td>
    );
  }
  return (
    <td style={{
      padding: "6px 4px",
      textAlign: "center",
      borderRight: "1px solid var(--glass-border)",
      background: isToday ? "rgba(var(--glow-rgb),0.06)" : "transparent",
      verticalAlign: "middle",
    }}>
      {items.map((item, j) => {
        const accent = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
        return (
          <Link key={j} href={moduleHref(item.moduleType)}>
            <div style={{
              display: "inline-block", width: "100%",
              fontSize: 10, fontWeight: 700, lineHeight: 1.3,
              color: isToday ? "var(--text-main)" : "var(--text-sub)",
              padding: "3px 2px",
              borderRadius: 6,
              borderLeft: `3px solid ${accent}`,
              background: isToday ? `${accent}15` : `${accent}08`,
              textAlign: "left",
              paddingLeft: 5,
              cursor: "pointer",
              marginBottom: j < items.length - 1 ? 3 : 0,
            }}>
              {item.label}
            </div>
          </Link>
        );
      })}
    </td>
  );
}

// ── Today checklist ───────────────────────────────────────────────────────────

function TodayView({ timedItems, dayOnlyItems, todayDoneMap, todayDoneCount, todayPct, today }: {
  timedItems: PlanItem[]; dayOnlyItems: PlanItem[];
  todayDoneMap: Map<string, boolean>; todayDoneCount: number;
  todayPct: number; today: string;
}) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const dayName = new Date(today + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", month: "long", day: "numeric" });

  const timeGroups: { time: string; items: PlanItem[] }[] = [];
  timedItems.forEach(item => {
    const last = timeGroups[timeGroups.length - 1];
    if (last && last.time === item.time) last.items.push(item);
    else timeGroups.push({ time: item.time!, items: [item] });
  });

  return (
    <div className="px-4">
      {/* Day summary */}
      <div className="rounded-2xl p-4 mb-5"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>{dayName}</p>
            <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>
              {todayDoneCount} of {timedItems.length} tasks done
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

      {timeGroups.map(({ time, items }) => {
        const isPast  = time < currentTime;
        const isClose = !isPast && Math.abs(parseInt(time.replace(":",""),10) - parseInt(currentTime.replace(":",""),10)) <= 30;
        return (
          <div key={time} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, color: isClose ? "var(--accent)" : isPast ? "var(--text-dim)" : "var(--text-sub)" }}>
                {formatTime(time)}
              </span>
              <div className="flex-1 h-px" style={{ background: isClose ? "var(--accent-tint-border)" : "var(--glass-border)" }} />
              {isClose && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-tint-bg)", padding: "2px 8px", borderRadius: 8 }}>COMING UP</span>}
            </div>
            <div className="space-y-1.5">
              {items.map(item => {
                const accent  = MODULE_ACCENT[item.moduleType] ?? "var(--accent)";
                const done    = todayDoneMap.get(item.moduleType) === true;
                const overdue = isPast && !done && !isClose;
                return (
                  <Link key={`${item.moduleType}-${time}`} href={moduleHref(item.moduleType)}>
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                      style={{
                        background: done ? "rgba(74,222,128,0.08)" : overdue ? "rgba(239,68,68,0.06)" : "var(--glass-bg)",
                        border: `1px solid ${done ? "rgba(74,222,128,0.25)" : overdue ? "rgba(239,68,68,0.2)" : "var(--glass-border)"}`,
                      }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: done ? "#4ade80" : overdue ? "#f87171" : "var(--glass-track)", border: done ? "none" : `2px solid ${overdue ? "#f87171" : accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {done && <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--text-dim)" : "var(--text-main)", textDecoration: done ? "line-through" : "none" }}>
                          {item.label}
                        </p>
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
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition"
                    style={{ background: done ? "rgba(74,222,128,0.08)" : "var(--glass-bg)", border: `1px solid ${done ? "rgba(74,222,128,0.25)" : "var(--glass-border)"}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: done ? "#4ade80" : "var(--glass-track)", border: done ? "none" : `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {done && <span style={{ fontSize: 12, color: "#fff", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: done ? "var(--text-dim)" : "var(--text-main)", textDecoration: done ? "line-through" : "none" }}>{item.label}</p>
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
        <div className="py-10 text-center rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>Nothing planned for today</p>
          <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 4 }}>
            <Link href="/wellness"><span style={{ color: "var(--accent)" }}>Set up wellness modules</span></Link> to fill your plan
          </p>
        </div>
      )}
    </div>
  );
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function buildPrintHTML(plan: WeekPlan, today: string, firstName: string): string {
  const weekStart = new Date(plan.weekStart + "T12:00:00");
  const weekEnd   = new Date(plan.weekStart + "T12:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-NG", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}`;
  const todayIdx  = plan.days.findIndex(d => d.date === today);

  const timesSet = new Set<string>();
  plan.days.forEach(d => d.items.forEach(i => { if (i.time) timesSet.add(i.time); }));
  const timeSlots = [...timesSet].sort();
  const hasAllDay = plan.days.some(d => d.items.some(i => !i.time && !i.isRestDay));

  function cell(items: PlanItem[], isToday: boolean): string {
    const cls = [isToday ? "today-col" : "", items.length > 0 ? "has-item" : "empty"].filter(Boolean).join(" ");
    if (items.length === 0) return `<td class="${cls}"></td>`;
    const names = items.map(i => `<div class="task-name">${i.label}${i.sub ? `<br><small>${i.sub}</small>` : ""}</div>`).join("");
    return `<td class="${cls}">${names}</td>`;
  }

  const dayHeaders = plan.days.map((d, i) => {
    const date = new Date(d.date + "T12:00:00").getDate();
    return `<th class="${i === todayIdx ? "today-header" : ""}">${SHORT_DAY[i]}<br><span class="date-num">${date}</span>${i === todayIdx ? "<br><span class='today-badge'>TODAY</span>" : ""}</th>`;
  }).join("");

  const allDayRow = hasAllDay ? `<tr>
    <td class="time-col">Any time</td>
    ${plan.days.map((d, i) => cell(d.items.filter(x => !x.time && !x.isRestDay), i === todayIdx)).join("")}
  </tr>` : "";

  const timeRows = timeSlots.map(time => `<tr>
    <td class="time-col">${formatTimeShort(time)}</td>
    ${plan.days.map((d, i) => cell(d.items.filter(x => x.time === time), i === todayIdx)).join("")}
  </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${firstName}'s Weekly Health Plan</title>
  <meta charset="utf-8">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:20px;background:#fff;color:#111}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #0d9488}
    .hdr h1{font-size:20px;font-weight:800;color:#0d9488}
    .hdr .sub{font-size:12px;color:#64748b;margin-top:4px}
    .hdr .brand{font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    th{padding:8px 6px;text-align:center;font-size:11px;font-weight:700;background:#1e293b;color:#fff;border-right:1px solid #334155;line-height:1.3}
    th.time-col{width:54px;background:#0f172a;font-size:10px}
    th.today-header{background:#0d9488}
    .date-num{font-size:14px;font-weight:900;display:block;margin-top:2px}
    .today-badge{font-size:8px;display:inline-block;margin-top:2px;background:rgba(255,255,255,0.25);padding:1px 5px;border-radius:8px;font-weight:700}
    td{padding:7px 5px;border:1px solid #e2e8f0;vertical-align:middle;text-align:center}
    td.time-col{font-weight:700;font-size:10px;color:#0d9488;background:#f8fafc;width:54px;text-align:center;white-space:nowrap}
    td.empty{background:#fafafa;opacity:.35}
    td.has-item{background:#f0fdf4}
    td.today-col{background:#f0fdfa}
    td.today-col.has-item{background:#d1fae5}
    .task-name{font-size:11px;font-weight:600;color:#1e293b;line-height:1.3;text-align:left;padding:2px 0}
    .task-name small{font-size:9px;color:#64748b;display:block}
    .footer{margin-top:14px;font-size:10px;color:#94a3b8;text-align:center}
    @media print{body{padding:6px}@page{size:landscape;margin:0.4cm}}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>${firstName}'s Weekly Health Plan</h1>
      <p class="sub">Week of ${weekLabel}</p>
    </div>
    <p class="brand">ERA Health</p>
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
