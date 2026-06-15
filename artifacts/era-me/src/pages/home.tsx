import { useState, useEffect, useRef, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { Bell, CheckCircle2, Circle, ChevronRight, MessageSquare, CalendarPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { useWellnessToday, useWeekSummary, useQuickLog, useWellnessStreak, useLogToday } from "@/lib/wellness-api";
import { useMyHospitals, useUnreadCounts, useUnreadNotifCount } from "@/lib/hospitals-api";
import { useWomensHealthToday, usePregnancyToday, PHASE_META } from "@/lib/womens-health-api";
import { useReturnVisits, useCareSchedule, useWellnessUpcomingEvents } from "@/lib/return-visits-api";
import { decodeGesture, useCompanionSettings } from "@/lib/companion-api";
import type { GestureConfig } from "@/lib/companion-api";
import type { HospitalConnection } from "@/lib/hospitals-api";

interface ChecklistItem {
  id: string; emoji: string; label: string; sub?: string; time?: string; done: boolean;
  count?: number; target?: number; batchIds?: string[]; prescribedBy?: string; scheduledBy?: string;
}
interface ModuleEntry {
  enabled: boolean; settings: Record<string, unknown>; log: Record<string, unknown> | null;
}
interface TodayData {
  date: string; dayKey: string;
  checklist: ChecklistItem[];
  modules: Record<string, ModuleEntry | undefined>;
}
interface QuickLogEntry { moduleType: string; data: Record<string, unknown> }

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  fruit: "#22c55e", vitals: "#ef4444",
  smoking: "#64748b", alcohol: "#fbbf24", eyebreak: "#6366f1",
  sunscreen: "#eab308", outdoors: "#16a34a", hygiene: "#93c5fd",
  vaccines: "#a78bfa", checkups: "#22d3ee",
};

function baseModule(id: string): string {
  if (id.startsWith("med_"))       return "medications";
  if (id.startsWith("hygiene_"))   return "hygiene";
  if (id.startsWith("vaccine_"))   return "vaccines";
  if (id.startsWith("checkup_"))   return "checkups";
  if (id.startsWith("sunscreen_")) return "sunscreen";
  return id;
}

function moduleHref(id: string): string {
  const base = baseModule(id);
  if (base !== id) return `/wellness/${base}`;
  return `/wellness/${id}`;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const p = h < 12 ? "AM" : "PM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hr}${p}` : `${hr}:${String(m).padStart(2, "0")}${p}`;
}

const TRACKING_MODULES = new Set(["vitals", "smoking", "alcohol", "intimacy"]);
const WIDGET_MODULES   = new Set(["water"]);

function buildQuickLogData(mods: Record<string, ModuleEntry | undefined>): Record<string, QuickLogEntry> {
  const outdoorsTarget = (mods.outdoors?.settings?.targetMinutes as number | undefined) ?? 30;
  const entries: Record<string, QuickLogEntry> = {
    fruit:    { moduleType: "fruit",    data: { done: true } },
    workout:  { moduleType: "workout",  data: { completed: true } },
    outdoors: { moduleType: "outdoors", data: { minutes: outdoorsTarget } },
  };
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

function getQuickLogEntry(item: ChecklistItem, data: Record<string, QuickLogEntry>): QuickLogEntry | undefined {
  if (item.id === "eyebreak") return { moduleType: "eyebreak", data: { count: (item.count ?? 0) + 1 } };
  if (item.id.startsWith("sunscreen_")) return { moduleType: "sunscreen", data: { count: parseInt(item.id.split("_")[1] ?? "0") + 1 } };
  if (item.batchIds?.length) return { moduleType: "medications", data: { taken: Object.fromEntries(item.batchIds.map(bid => [bid.replace(/^med_/, ""), true])) } };
  if (item.id.startsWith("rv_") || item.id.startsWith("cp_")) return { moduleType: "hospital_visit", data: { [item.id]: true } };
  return data[item.id];
}

export default function HomePage() {
  const { account } = useAuth();
  const [, navigate] = useLocation();
  const displayName = account?.displayName ?? account?.username ?? "there";

  const { data: todayData, isLoading: todayLoading } = useWellnessToday() as { data: TodayData | undefined; isLoading: boolean };
  const { data: summary } = useWeekSummary();
  const { data: cycleData } = useWomensHealthToday();
  const { data: pregData } = usePregnancyToday();
  const quickLog = useQuickLog();
  const { data: hospitals } = useMyHospitals();
  const { data: unreadCounts } = useUnreadCounts();
  const { data: notifData } = useUnreadNotifCount();
  const { data: returnVisitsData } = useReturnVisits();
  const { data: careScheduleData } = useCareSchedule();
  const { data: wellnessEventsData } = useWellnessUpcomingEvents();
  const unreadNotifs = notifData?.count ?? 0;

  // ── Secret diary gesture ──────────────────────────────────────────────────────
  const [gesture, setGesture] = useState<GestureConfig | null>(null);
  const tapRef = useRef<{ element: string; count: number; timer: ReturnType<typeof setTimeout> | null }>({ element: "", count: 0, timer: null });
  const { data: companionSettings } = useCompanionSettings();

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) {
      setGesture(decodeGesture(raw));
    } else if (companionSettings?.isSetUp) {
      const g: GestureConfig = { element: companionSettings.gestureElement, count: companionSettings.gestureCount, hidden: companionSettings.isHidden };
      localStorage.setItem("era_companion_tab", JSON.stringify(g));
      setGesture(g);
    }
  }, [companionSettings]);

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
  const checklist: ChecklistItem[] = todayData?.checklist ?? [];
  const planItems = checklist.filter(c => !TRACKING_MODULES.has(baseModule(c.id)) && !WIDGET_MODULES.has(baseModule(c.id)));
  const weekRate = summary?.overallRate ?? 0;
  const primaryHospital = hospitals?.[0] ?? null;
  const primaryUnread = unreadCounts && primaryHospital ? (unreadCounts[primaryHospital.hospitalId] ?? 0) : 0;

  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // Return visits (hospital-scheduled)
  const upcomingReturnVisits = (returnVisitsData?.visits ?? []).filter(v => v.visitDate >= today && v.visitDate <= in7days);
  // Care plan visit dates (antenatal, surgery, etc.)
  const upcomingCareEvents = (careScheduleData?.events ?? []).filter(e => e.date >= today && e.date <= in7days);
  // Personal module events — hygiene replacements, vaccine due dates, checkup reminders
  const upcomingWellnessEvents = (wellnessEventsData?.events ?? []).filter(e => e.dueDate <= in7days);
  // All combined
  const allUpcoming: Array<{ date: string; time: string | null; label: string; hospitalName: string | null; emoji?: string; isPersonal?: boolean }> = [
    ...upcomingReturnVisits.map(v => ({ date: v.visitDate, time: v.visitTime, label: v.reason, hospitalName: v.hospitalName })),
    ...upcomingCareEvents.map(e => ({ date: e.date, time: e.time, label: e.label, hospitalName: e.hospitalName })),
    ...upcomingWellnessEvents.map(e => ({ date: e.dueDate, time: null, label: e.label, hospitalName: null, emoji: e.emoji, isPersonal: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const todayVisits: Array<{ visitDate: string; visitTime: string | null; reason: string; hospitalName: string | null }> = [
    ...upcomingReturnVisits.filter(v => v.visitDate === today).map(v => ({ visitDate: v.visitDate, visitTime: v.visitTime, reason: v.reason, hospitalName: v.hospitalName })),
    ...upcomingCareEvents.filter(e => e.date === today).map(e => ({ visitDate: e.date, visitTime: e.time, reason: e.label, hospitalName: e.hospitalName })),
  ];

  return (
    <div className="pb-10">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="relative px-5 pt-8 pb-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full opacity-15"
            style={{ background: `radial-gradient(circle,rgba(var(--glow-rgb),1) 0%,transparent 70%)`, filter: "blur(56px)" }} />
        </div>
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p onClick={() => handleGestureTap("date")}
              style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
              {formatDate()}
            </p>
            <h1 onClick={() => handleGestureTap("greeting")}
              style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: "var(--text-main)", marginTop: 4 }}>
              {greeting()},<br />
              <span style={{ background: "linear-gradient(120deg,var(--accent-light),var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {displayName} 👋
              </span>
            </h1>
          </div>
          <Link href="/notifications">
            <div className="relative active:scale-90 transition mt-1" style={{ lineHeight: 0 }}>
              <Bell className="w-5 h-5" style={{ color: unreadNotifs > 0 ? "var(--accent)" : "var(--text-dim)" }} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ background: "#ef4444", color: "#fff" }}>
                  {unreadNotifs > 9 ? "9+" : unreadNotifs}
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Adherence ──────────────────────────────────────────────── */}
        <AdherenceCard weekRate={weekRate} hasData={summary !== undefined} />

        {/* ── Care Team ──────────────────────────────────────────────── */}
        <CareTeamCard hospital={primaryHospital} unread={primaryUnread} navigate={navigate} />

        {/* ── Upcoming Events (next 7 days) ───────────────────────── */}
        {primaryHospital && (
          <UpcomingEventsCard events={allUpcoming} navigate={navigate} />
        )}

        {/* ── Women's Health tracker card ─────────────────────────────── */}
        <WomensHealthCard cycleData={cycleData} pregData={pregData} navigate={navigate} />

        {/* ── Progress widgets: water, smoking, alcohol ──────────────── */}
        <ProgressWidgets mods={mods} checklist={checklist} navigate={navigate} />

        {/* ── Today's Care Plan ──────────────────────────────────────── */}
        <CarePlanSection
          items={planItems}
          mods={mods}
          quickLog={quickLog}
          navigate={navigate}
          hospitalName={primaryHospital?.hospitalName}
          todayReturnVisits={todayVisits}
          isLoaded={!todayLoading}
        />

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function AdherenceCard({ weekRate, hasData }: { weekRate: number; hasData: boolean }) {
  const color = weekRate >= 80 ? "#4ade80" : weekRate >= 50 ? "#fbbf24" : weekRate > 0 ? "#f87171" : "var(--text-dim)";
  const label = weekRate >= 80 ? "Excellent — keep it up" : weekRate >= 50 ? "Good — room to improve" : weekRate > 0 ? "Let's get back on track" : "";
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5, marginBottom: 10 }}>ADHERENCE</p>
      {!hasData || weekRate === 0 ? (
        <div>
          <p style={{ fontSize: 28, fontWeight: 900, color: "var(--text-dim)", lineHeight: 1 }}>—</p>
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>No data yet this week</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <p style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1 }}>{weekRate}%</p>
            <p style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, marginTop: 4, letterSpacing: 0.3 }}>THIS WEEK</p>
          </div>
          <div style={{ flex: 1 }}>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${weekRate}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 6 }}>{label}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CareTeamCard({ hospital, unread, navigate }: {
  hospital: HospitalConnection | null;
  unread: number;
  navigate: (path: string) => void;
}) {
  if (!hospital) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5, marginBottom: 14 }}>CARE TEAM</p>
        <div className="text-center py-2">
          <p style={{ fontSize: 32, marginBottom: 8 }}>🏥</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>No hospital connected</p>
          <p style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 16, lineHeight: 1.5 }}>
            Connect your hospital so they can actively manage your care from inside the app
          </p>
          <button onClick={() => navigate("/hospitals")}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition"
            style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.3)` }}>
            Find my hospital →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5, marginBottom: 12 }}>CARE TEAM</p>
      <div className="flex items-center gap-3 mb-4">
        {hospital.hospitalLogo ? (
          <img src={hospital.hospitalLogo} alt={hospital.hospitalName}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
            style={{ border: "1px solid var(--glass-border)" }} />
        ) : (
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>🏥</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{hospital.hospitalName}</p>
          {unread > 0 ? (
            <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 3 }}>
              {unread} unread message{unread !== 1 ? "s" : ""}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>Your care provider</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => navigate("/hospitals")}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition flex items-center justify-center gap-1.5"
          style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 12px rgba(var(--glow-rgb),0.25)` }}>
          <MessageSquare className="w-4 h-4" />
          Message
        </button>
        <button onClick={() => navigate("/hospitals")}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition flex items-center justify-center gap-1.5"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}>
          <CalendarPlus className="w-4 h-4" />
          Book
        </button>
      </div>
    </div>
  );
}

function UpcomingEventsCard({ events, navigate }: {
  events: Array<{ date: string; time: string | null; label: string; hospitalName: string | null; emoji?: string; isPersonal?: boolean }>;
  navigate: (path: string) => void;
}) {
  const nowStr = new Date().toISOString().split("T")[0];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5 }}>UPCOMING</p>
        <p style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>NEXT 7 DAYS</p>
      </div>
      {events.length === 0 ? (
        <div style={{ padding: "12px 16px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-sub)" }}>Nothing coming up this week</p>
        </div>
      ) : (
        events.map((e, i) => {
          const isToday = e.date === nowStr;
          const isOverdue = e.date < nowStr;
          const d = new Date(e.date + "T12:00:00");
          const dateLabel = isToday ? "Today"
            : isOverdue ? "Overdue"
            : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
          return (
            <div key={`${e.date}_${i}`} style={{ borderTop: "1px solid var(--glass-border)", padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
              {/* Left tile: emoji for personal events, date tile for hospital events */}
              {e.isPersonal ? (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--glass-track)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
                  {e.emoji}
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--glow-rgb),0.12)", border: "1px solid rgba(var(--glow-rgb),0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", letterSpacing: 0.5, lineHeight: 1 }}>{d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>{d.getDate()}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.3 }}>{e.label}</p>
                <p style={{ fontSize: 11, color: isOverdue ? "#f87171" : "var(--text-sub)", marginTop: 2 }}>
                  {dateLabel}{e.time ? ` · ${e.time}` : ""}
                </p>
                {e.hospitalName && !e.isPersonal && (
                  <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>
                    Scheduled by {e.hospitalName}
                  </p>
                )}
              </div>
              {isToday && !e.isPersonal && (
                <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "var(--btn-gradient)", padding: "2px 8px", borderRadius: 6, flexShrink: 0, letterSpacing: 0.5 }}>TODAY</span>
              )}
              {isOverdue && (
                <span style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 6, flexShrink: 0, border: "1px solid rgba(239,68,68,0.3)" }}>OVERDUE</span>
              )}
            </div>
          );
        })
      )}
      <div className="px-4 pb-3 pt-1">
        <button onClick={() => navigate("/plan?tab=source")} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          View full plan →
        </button>
      </div>
    </div>
  );
}

function ProgressWidgets({ mods, checklist, navigate }: {
  mods: Record<string, ModuleEntry | undefined>;
  checklist: ChecklistItem[];
  navigate: (path: string) => void;
}) {
  const waterEnabled   = mods.water?.enabled ?? false;
  const smokingEnabled = mods.smoking?.enabled ?? false;
  const alcoholEnabled = mods.alcohol?.enabled ?? false;

  const { data: smokingStreak } = useWellnessStreak("smoking", { enabled: smokingEnabled });
  const { data: alcoholStreak } = useWellnessStreak("alcohol", { enabled: alcoholEnabled });
  const logWater = useLogToday("water");

  if (!waterEnabled && !smokingEnabled && !alcoholEnabled) return null;

  const waterLog   = mods.water?.log;
  const cups       = (waterLog?.cups as number | undefined) ?? 0;
  const target     = (mods.water?.settings?.target as number | undefined) ?? 8;
  const waterPct   = Math.min(100, Math.round((cups / target) * 100));

  const smokingLog = checklist.find(c => c.id === "smoking");
  const alcoholLog = checklist.find(c => c.id === "alcohol");
  const smokedToday  = smokingLog ? !smokingLog.done : null;
  const drankToday   = alcoholLog ? !alcoholLog.done : null;

  const goalType = (mods.alcohol?.settings?.goalType as string | undefined) ?? "quit";

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {waterEnabled && (
        <div style={{ flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 16, padding: "10px 12px" }}>
          <p onClick={() => navigate("/wellness/water")} style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 8, cursor: "pointer" }}>💧 Water</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <button
              onClick={() => logWater.mutate({ cups: Math.max(0, cups - 1) })}
              disabled={cups === 0 || logWater.isPending}
              style={{ width: 30, height: 30, borderRadius: 8, background: "var(--glass-border)", border: "none", fontSize: 18, lineHeight: 1, cursor: cups === 0 ? "default" : "pointer", color: "var(--text-sub)", opacity: cups === 0 ? 0.3 : 1 }}>
              −
            </button>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#38bdf8", lineHeight: 1, margin: 0 }}>{cups}<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>/{target}</span></p>
              <p style={{ fontSize: 9, color: "var(--text-dim)", margin: "2px 0 0" }}>cups today</p>
            </div>
            <button
              onClick={() => logWater.mutate({ cups: cups + 1 })}
              disabled={logWater.isPending}
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(56,189,248,0.15)", border: "none", fontSize: 18, lineHeight: 1, cursor: "pointer", color: "#38bdf8", fontWeight: 700 }}>
              +
            </button>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--glass-border)" }}>
            <div style={{ height: 4, borderRadius: 2, width: `${waterPct}%`, background: "#38bdf8", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {smokingEnabled && (
        <button onClick={() => navigate("/wellness/smoking")} className="active:scale-95 transition" style={{ flex: 1, background: "var(--glass-bg)", border: `1px solid ${smokedToday ? "#ef444440" : "var(--glass-border)"}`, borderRadius: 16, padding: "10px 12px", textAlign: "left" }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>🚭 Smoking</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: smokedToday ? "#ef4444" : "#4ade80", lineHeight: 1 }}>
            {smokingStreak?.streak ?? 0}<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>d</span>
          </p>
          <p style={{ fontSize: 9, color: smokedToday ? "#ef4444" : "var(--text-dim)" }}>
            {smokedToday ? "smoked today" : "smoke-free"}
          </p>
        </button>
      )}

      {alcoholEnabled && (
        <button onClick={() => navigate("/wellness/alcohol")} className="active:scale-95 transition" style={{ flex: 1, background: "var(--glass-bg)", border: `1px solid ${drankToday && goalType === "quit" ? "#ef444440" : "var(--glass-border)"}`, borderRadius: 16, padding: "10px 12px", textAlign: "left" }}>
          <p style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>🍷 Alcohol</p>
          <p style={{ fontSize: 18, fontWeight: 900, color: drankToday && goalType === "quit" ? "#ef4444" : "#4ade80", lineHeight: 1 }}>
            {alcoholStreak?.streak ?? 0}<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>d</span>
          </p>
          <p style={{ fontSize: 9, color: drankToday && goalType === "quit" ? "#ef4444" : "var(--text-dim)" }}>
            {goalType === "quit" ? (drankToday ? "had a drink" : "drink-free") : "streak"}
          </p>
        </button>
      )}
    </div>
  );
}

function CarePlanSection({ items, mods, quickLog, navigate, hospitalName, todayReturnVisits, isLoaded }: {
  items: ChecklistItem[];
  mods: Record<string, ModuleEntry | undefined>;
  quickLog: ReturnType<typeof useQuickLog>;
  navigate: (path: string) => void;
  hospitalName?: string;
  todayReturnVisits?: Array<{ visitDate: string; visitTime: string | null; reason: string; hospitalName: string | null }>;
  isLoaded?: boolean;
}) {
  const doneCount = items.filter(c => c.done).length;
  const total = items.length;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (!isLoaded) {
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full shrink-0" style={{ background: "var(--glass-border)" }} />
            <div className="flex-1 h-4 rounded-lg" style={{ background: "var(--glass-border)", opacity: 0.6 - i * 0.1 }} />
          </div>
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 36, marginBottom: 12 }}>📋</p>
        <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 15, marginBottom: 6 }}>No care plan yet</p>
        <p style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 20, lineHeight: 1.5 }}>
          Browse Programs to set up your daily health habits and care routine.
        </p>
        <button onClick={() => navigate("/programs")}
          className="px-6 py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition"
          style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.3)` }}>
          Browse Programs →
        </button>
      </div>
    );
  }

  const logData = buildQuickLogData(mods);

  return (
    <section>
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>Today's Care Plan</h2>
          {hospitalName && (
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Managed with {hospitalName}</p>
          )}
        </div>
        <Link href="/plan">
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>View week →</span>
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-track)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${completionPct}%`,
              background: completionPct === 100 ? "#4ade80" : "var(--btn-gradient)",
              boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)`,
            }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sub)", flexShrink: 0 }}>
          {doneCount}/{total} done
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {items.map((item, i) => {
          const entry = getQuickLogEntry(item, logData);
          const accent = MODULE_ACCENT[baseModule(item.id)] ?? "var(--accent)";
          const canTick = !item.done && !!entry;

          return (
            <div key={item.id} className="flex items-stretch"
              style={{ borderTop: i > 0 ? "1px solid var(--glass-border)" : "none", minHeight: 58, background: item.done ? "rgba(74,222,128,0.03)" : "transparent" }}>

              {/* Tick zone */}
              <button
                onClick={() => {
                  if (item.done) return;
                  if (canTick) quickLog.mutate({ moduleType: entry!.moduleType, data: entry!.data });
                  else navigate(moduleHref(item.id));
                }}
                className="shrink-0 flex items-center justify-center active:scale-90 transition"
                style={{ width: 52, background: "transparent" }}>
                {item.done
                  ? <CheckCircle2 style={{ width: 20, height: 20, color: "var(--accent)" }} />
                  : canTick
                    ? <Circle style={{ width: 20, height: 20, color: accent }} />
                    : <Circle style={{ width: 20, height: 20, color: accent, opacity: 0.45 }} />
                }
              </button>

              {/* Content */}
              <button
                onClick={() => {
                  if (item.id.startsWith("rv_") || item.id.startsWith("cp_")) navigate("/hospitals");
                  else navigate(moduleHref(item.id));
                }}
                className="flex-1 flex items-center gap-3 py-3 pr-3 text-left active:opacity-70 transition"
                style={{ background: "transparent", border: "none", borderLeft: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, fontWeight: 700, lineHeight: 1.3,
                    color: item.done ? "var(--text-dim)" : "var(--text-main)",
                    textDecoration: item.done ? "line-through" : "none",
                  }}>{item.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.time && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: item.done ? "var(--text-dim)" : accent, background: `${accent}18`, padding: "1px 5px", borderRadius: 5 }}>
                        {fmtTime(item.time)}
                      </span>
                    )}
                    {item.sub && (
                      <span style={{ fontSize: 11, color: item.done ? "var(--text-dim)" : "var(--text-sub)" }}>{item.sub}</span>
                    )}
                  </div>
                  {item.prescribedBy && (
                    <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 3 }}>
                      Prescribed by {item.prescribedBy}
                    </p>
                  )}
                  {item.scheduledBy && (
                    <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 3 }}>
                      Scheduled by {item.scheduledBy}
                    </p>
                  )}
                </div>
                <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)", flexShrink: 0, opacity: 0.4 }} />
              </button>
            </div>
          );
        })}
      </div>

    </section>
  );
}

// ── Women's Health home card ─────────────────────────────────────────────────

const PHASE_HEX: Record<string, string> = {
  menstruation: "#f43f5e",
  follicular:   "#a855f7",
  fertile:      "#14b8a6",
  luteal:       "#f59e0b",
};

function WomensHealthCard({
  cycleData,
  pregData,
  navigate,
}: {
  cycleData: ReturnType<typeof useWomensHealthToday>["data"];
  pregData: ReturnType<typeof usePregnancyToday>["data"];
  navigate: (path: string) => void;
}) {
  if (!cycleData?.isSetUp && !pregData?.isSetUp) return null;

  // Pregnancy card
  if (pregData?.isSetUp) {
    const week = pregData.weeksPregnant ?? 0;
    const days = pregData.daysIntoWeek ?? 0;
    const daysUntilDue = pregData.daysUntilDue ?? 0;
    const trimester = pregData.trimester ?? 1;
    const isPostpartum = pregData.isPostpartum;
    const hasLog = !!(pregData.todayLog?.mood || (pregData.todayLog?.symptoms?.length ?? 0) > 0 || pregData.todayLog?.weightKg);
    const pct = Math.min(100, Math.round((week / 40) * 100));

    return (
      <button
        onClick={() => navigate("/womens-health")}
        className="w-full text-left active:scale-[0.98] transition rounded-2xl"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontSize: 10, fontWeight: 800, color: "#a855f7", letterSpacing: 1.5 }}>PREGNANCY</p>
            <div className="flex items-center gap-2">
              {hasLog && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 7px", borderRadius: 5 }}>LOGGED</span>}
              <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)" }} />
            </div>
          </div>

          {isPostpartum ? (
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 28 }}>👶</span>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-main)", lineHeight: 1.2 }}>Postpartum period</p>
                <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>Congratulations on your new baby!</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#a855f7", lineHeight: 1 }}>
                    Week {week}
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)" }}> + {days}d</span>
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>
                    {trimester === 1 ? "First" : trimester === 2 ? "Second" : "Third"} trimester
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>
                    {daysUntilDue}
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)" }}>d</span>
                  </p>
                  <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>until due</p>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "var(--glass-track)" }}>
                <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: "#a855f7", transition: "width 0.3s" }} />
              </div>
              <div className="flex justify-between mt-1">
                <p style={{ fontSize: 9, color: "var(--text-dim)" }}>Week 1</p>
                <p style={{ fontSize: 9, color: "var(--text-dim)" }}>Week 40</p>
              </div>
            </>
          )}
        </div>
      </button>
    );
  }

  // Cycle card
  const phase = cycleData?.cycleInfo?.phase ?? null;
  const cycleDay = cycleData?.cycleInfo?.cycleDay ?? null;
  const cycleLen = cycleData?.settings?.cycleLength ?? 28;
  const hasLog = !!(cycleData?.todayLog?.flow || (cycleData?.todayLog?.symptoms?.length ?? 0) > 0);
  const col = phase ? PHASE_HEX[phase] : "var(--accent)";
  const meta = phase ? PHASE_META[phase] : null;

  return (
    <button
      onClick={() => navigate("/womens-health")}
      className="w-full text-left active:scale-[0.98] transition rounded-2xl"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 800, color: col, letterSpacing: 1.5 }}>CYCLE TRACKER</p>
          <div className="flex items-center gap-2">
            {hasLog && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 7px", borderRadius: 5 }}>LOGGED</span>}
            <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)" }} />
          </div>
        </div>

        {!cycleData?.cycleInfo ? (
          <p style={{ fontSize: 13, color: "var(--text-sub)" }}>Log your period to start predictions</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: col }}>
                  Day {cycleDay}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sub)" }}> of {cycleLen}</span>
                </p>
                {meta && <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>{meta.label}</p>}
              </div>
              {phase && (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}20`, border: `1px solid ${col}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18 }}>
                    {phase === "menstruation" ? "🩸" : phase === "follicular" ? "🌸" : phase === "fertile" ? "✨" : "🌙"}
                  </span>
                </div>
              )}
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "var(--glass-track)" }}>
              <div style={{ height: 4, borderRadius: 2, width: `${Math.round(((cycleDay ?? 1) / cycleLen) * 100)}%`, background: col, transition: "width 0.3s" }} />
            </div>
          </>
        )}
      </div>
    </button>
  );
}
