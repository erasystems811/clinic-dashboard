import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, BellOff, Printer, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useCurrentPlan, useRegeneratePlan } from "@/lib/plan-api";
import type { PlanItem, WeekPlan } from "@/lib/plan-api";
import { useWellnessToday, useWeekSummary } from "@/lib/wellness-api";
import { useAuth } from "@/contexts/auth-context";

const PALETTES: Record<string, { accent: string; accentLight: string; btnGradient: string; bgDark: string; bgLight: string }> = {
  teal:   { accent: "#14b8a6", accentLight: "#5eead4", btnGradient: "linear-gradient(135deg,#0d9488,#14b8a6)", bgDark: "#060d1f", bgLight: "#f0fdfb" },
  blue:   { accent: "#3b82f6", accentLight: "#93c5fd", btnGradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)", bgDark: "#060e21", bgLight: "#eff6ff" },
  purple: { accent: "#a78bfa", accentLight: "#c4b5fd", btnGradient: "linear-gradient(135deg,#7c3aed,#a78bfa)", bgDark: "#0d0618", bgLight: "#faf5ff" },
  green:  { accent: "#22c55e", accentLight: "#4ade80", btnGradient: "linear-gradient(135deg,#15803d,#22c55e)", bgDark: "#031209", bgLight: "#f0fdf4" },
  orange: { accent: "#f97316", accentLight: "#fb923c", btnGradient: "linear-gradient(135deg,#c2410c,#f97316)", bgDark: "#160c03", bgLight: "#fff7ed" },
  pink:   { accent: "#ec4899", accentLight: "#f472b6", btnGradient: "linear-gradient(135deg,#be185d,#ec4899)", bgDark: "#1a0515", bgLight: "#fdf2f8" },
  slate:  { accent: "#94a3b8", accentLight: "#cbd5e1", btnGradient: "linear-gradient(135deg,#475569,#94a3b8)", bgDark: "#0a0d12", bgLight: "#f8fafc" },
};

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
  const [view, setView] = useState<"week" | "today">("today");
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

  const todayDoneCount = timedItems.filter(i => todayDoneMap.get(i.checklistId ?? i.moduleType) === true).length;
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
    // Read live CSS vars so the print always matches whatever theme/mode is active
    const s = getComputedStyle(document.documentElement);
    const darkMode = !document.documentElement.classList.contains("light");
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
  const weekLabel = `${weekStartDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;

  return (
    <div className="pt-6 pb-12">

      {/* ── Header ── */}
      <div className="px-4">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 mb-5"
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
                const done    = todayDoneMap.get(item.checklistId ?? item.moduleType) === true;
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
              const done   = todayDoneMap.get(item.checklistId ?? item.moduleType) === true;
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

// ── Print HTML — card layout using the user's theme color ─────────────────────

type PrintPalette = { accent: string; accentLight: string; btnGradient: string; bgDark: string; bgLight: string };

function buildPrintHTML(plan: WeekPlan, today: string, firstName: string, palette: PrintPalette, darkMode: boolean): string {
  const weekStartObj = new Date(plan.weekStart + "T12:00:00");
  const weekEndObj   = new Date(plan.weekStart + "T12:00:00");
  weekEndObj.setDate(weekEndObj.getDate() + 6);
  const weekLabel = `${weekStartObj.toLocaleDateString("en-NG", { month: "long", day: "numeric" })} – ${weekEndObj.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}`;

  // Always use light palette for print — dark backgrounds get stripped by browsers,
  // which would leave light text invisible on white paper.
  const bg       = "#f8fafc";
  const cardBg   = "#ffffff";
  const cardBdr  = "rgba(0,0,0,0.09)";
  const textMain = "#0f172a";
  const textSub  = "#475569";
  const textDim  = "#94a3b8";
  const todayCardBg  = `${palette.accent}14`;
  const todayCardBdr = `${palette.accent}60`;

  const dayCards = plan.days.map((day, i) => {
    const isToday = day.date === today;
    const dateObj = new Date(day.date + "T12:00:00");
    const dateNum = dateObj.getDate();
    const monthAbbr = dateObj.toLocaleDateString("en-NG", { month: "short" });

    const sortedItems = [...day.items]
      .filter(it => !it.isRestDay)
      .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));

    // Deduplicate by moduleType for the print card too
    const seen = new Set<string>();
    const uniqueItems = sortedItems.filter(it => {
      if (seen.has(it.moduleType)) return false;
      seen.add(it.moduleType);
      return true;
    });

    const taskRows = uniqueItems.length > 0
      ? uniqueItems.map(item => `
          <div class="task-row">
            <span class="task-time">${item.time ? formatTimeShort(item.time) : "–"}</span>
            <span class="task-label">${item.moduleType === "water" ? "Water intake" : item.label}</span>
          </div>`).join("")
      : `<div class="rest-label">Rest day</div>`;

    return `
      <div class="day-card${isToday ? " today-card" : ""}">
        <div class="card-header${isToday ? " today-header" : ""}">
          <div class="day-name">${FULL_DAY[i]}</div>
          <div class="day-date">${dateNum} ${monthAbbr}${isToday ? ' <span class="today-pill">TODAY</span>' : ""}</div>
        </div>
        <div class="card-body">${taskRows}</div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${firstName}'s Weekly Plan</title>
  <meta charset="utf-8">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
      background:${bg};
      color:${textMain};
      padding:20px;
      min-height:100vh;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }

    /* ── Page header ── */
    .page-header{
      display:flex;justify-content:space-between;align-items:flex-end;
      margin-bottom:20px;padding-bottom:14px;
      border-bottom:2px solid ${palette.accent};
    }
    .page-title{font-size:22px;font-weight:900;color:${palette.accent}}
    .page-sub{font-size:12px;color:${textSub};margin-top:4px}
    .page-brand{font-size:10px;color:${textDim};font-weight:700;letter-spacing:1.5px;text-transform:uppercase}

    /* ── 7-column card grid ── */
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}

    /* ── Individual day card ── */
    .day-card{
      border-radius:14px;overflow:hidden;
      background:${cardBg};
      border:1px solid ${cardBdr};
    }
    .today-card{
      background:${todayCardBg};
      border:2px solid ${todayCardBdr};
      box-shadow:0 4px 20px ${palette.accent}25;
    }

    /* ── Card header ── */
    .card-header{
      padding:10px 10px 8px;
      background:${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};
      border-bottom:1px solid ${cardBdr};
    }
    .today-header{background:${palette.btnGradient}}
    .day-name{font-size:12px;font-weight:800;color:${textMain};line-height:1}
    .today-header .day-name,.today-header .day-date{color:#fff}
    .day-date{font-size:10px;color:${textSub};margin-top:3px;line-height:1}
    .today-pill{
      display:inline-block;background:rgba(255,255,255,0.25);
      color:#fff;font-size:8px;font-weight:700;padding:1px 5px;
      border-radius:10px;vertical-align:middle;margin-left:3px;
    }

    /* ── Task rows ── */
    .card-body{padding:8px 10px}
    .task-row{
      display:flex;align-items:flex-start;gap:6px;
      padding:4px 0;
      border-bottom:1px solid ${darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"};
    }
    .task-row:last-child{border-bottom:none}
    .task-time{
      font-size:9px;font-weight:700;color:${palette.accent};
      min-width:30px;padding-top:1px;white-space:nowrap;
    }
    .task-label{font-size:10px;font-weight:600;color:${textMain};line-height:1.35}
    .rest-label{font-size:10px;color:${textDim};text-align:center;padding:8px 0;font-style:italic}

    /* ── Footer ── */
    .footer{margin-top:16px;font-size:10px;color:${textDim};text-align:center}

    @media print{
      body{padding:8px}
      @page{size:landscape;margin:0.4cm}
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="page-title">${firstName}'s Weekly Health Plan</div>
      <div class="page-sub">Week of ${weekLabel}</div>
    </div>
    <div class="page-brand">ERA Health</div>
  </div>
  <div class="grid">${dayCards}</div>
  <div class="footer">Generated by ERA Health · era.erasystems.com.ng</div>
  <script>setTimeout(function(){window.print()},500)</script>
</body>
</html>`;
}
