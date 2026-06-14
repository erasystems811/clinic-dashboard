import { useState, useEffect, useRef, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { Bell, CheckCircle2, Circle, ChevronRight, MessageSquare, CalendarPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { useWellnessToday, useWeekSummary, useQuickLog } from "@/lib/wellness-api";
import { useMyHospitals, useUnreadCounts, useUnreadNotifCount } from "@/lib/hospitals-api";
import { useReturnVisits, type ReturnVisit } from "@/lib/return-visits-api";
import { decodeGesture, useCompanionSettings } from "@/lib/companion-api";
import type { GestureConfig } from "@/lib/companion-api";
import type { HospitalConnection } from "@/lib/hospitals-api";

interface ChecklistItem {
  id: string; emoji: string; label: string; sub?: string; time?: string; done: boolean;
  count?: number; target?: number; batchIds?: string[]; prescribedBy?: string;
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
  sleep: "#8b5cf6", mood_check: "#fbbf24", energy: "#84cc16",
  stress: "#a855f7", fruit: "#22c55e", vitals: "#ef4444",
  smoking: "#64748b", alcohol: "#fbbf24", eyebreak: "#6366f1",
  sunscreen: "#eab308", outdoors: "#16a34a", hygiene: "#93c5fd",
  intimacy: "#fda4af", vaccines: "#a78bfa", checkups: "#22d3ee",
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
  if (id === "mood_check") return "/wellness/mood";
  if (id === "energy" || id === "stress") return "/wellness/mood";
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
  const intimacyMode = (mods.intimacy?.settings as { mode?: string } | undefined)?.mode;
  const entries: Record<string, QuickLogEntry> = {
    fruit:    { moduleType: "fruit",    data: { done: true } },
    workout:  { moduleType: "workout",  data: { completed: true } },
    outdoors: { moduleType: "outdoors", data: { minutes: outdoorsTarget } },
  };
  if (intimacyMode === "celibacy") entries.intimacy = { moduleType: "intimacy", data: { active: false } };
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
  return data[item.id];
}

export default function HomePage() {
  const { account } = useAuth();
  const [, navigate] = useLocation();
  const displayName = account?.displayName ?? account?.username ?? "there";

  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();
  const quickLog = useQuickLog();
  const { data: hospitals } = useMyHospitals();
  const { data: unreadCounts } = useUnreadCounts();
  const { data: notifData } = useUnreadNotifCount();
  const { data: returnVisitsData } = useReturnVisits();
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
  const upcomingVisits = (returnVisitsData?.visits ?? []).filter(v => v.visitDate >= today && v.visitDate <= in7days);
  const todayVisits = upcomingVisits.filter(v => v.visitDate === today);

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
        {upcomingVisits.length > 0 && (
          <UpcomingEventsCard visits={upcomingVisits} navigate={navigate} />
        )}

        {/* ── Today's Care Plan ──────────────────────────────────────── */}
        <CarePlanSection
          items={planItems}
          mods={mods}
          quickLog={quickLog}
          navigate={navigate}
          hospitalName={primaryHospital?.hospitalName}
          todayReturnVisits={todayVisits}
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

function UpcomingEventsCard({ visits, navigate }: { visits: ReturnVisit[]; navigate: (path: string) => void }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.5 }}>UPCOMING EVENTS</p>
        <p style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>NEXT 7 DAYS</p>
      </div>
      {visits.map((v, i) => {
        const dateLabel = new Date(v.visitDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const isToday = v.visitDate === new Date().toISOString().split("T")[0];
        return (
          <div key={v.id} style={{ borderTop: i > 0 ? "1px solid var(--glass-border)" : "1px solid var(--glass-border)", padding: "10px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--glow-rgb),0.12)", border: "1px solid rgba(var(--glow-rgb),0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", letterSpacing: 0.5, lineHeight: 1 }}>{new Date(v.visitDate + "T12:00:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>{new Date(v.visitDate + "T12:00:00").getDate()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", lineHeight: 1.3 }}>{v.reason}</p>
              <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>
                {isToday ? "Today" : dateLabel}{v.visitTime ? ` · ${v.visitTime}` : ""}{v.hospitalName ? ` · ${v.hospitalName}` : ""}
              </p>
            </div>
            {isToday && (
              <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "var(--btn-gradient)", padding: "2px 8px", borderRadius: 6, flexShrink: 0, letterSpacing: 0.5 }}>TODAY</span>
            )}
          </div>
        );
      })}
      <div className="px-4 pb-3 pt-1">
        <button onClick={() => navigate("/plan?tab=source")} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          View hospital plan →
        </button>
      </div>
    </div>
  );
}

function CarePlanSection({ items, mods, quickLog, navigate, hospitalName, todayReturnVisits }: {
  items: ChecklistItem[];
  mods: Record<string, ModuleEntry | undefined>;
  quickLog: ReturnType<typeof useQuickLog>;
  navigate: (path: string) => void;
  hospitalName?: string;
  todayReturnVisits?: ReturnVisit[];
}) {
  const doneCount = items.filter(c => c.done).length;
  const total = items.length;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

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
                onClick={() => navigate(moduleHref(item.id))}
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
                </div>
                <ChevronRight style={{ width: 14, height: 14, color: "var(--text-dim)", flexShrink: 0, opacity: 0.4 }} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Today's hospital return visits */}
      {(todayReturnVisits ?? []).length > 0 && (
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ background: "rgba(var(--glow-rgb),0.06)", border: "1px solid rgba(var(--glow-rgb),0.15)" }}>
          {(todayReturnVisits ?? []).map((v, i) => (
            <div key={v.id} style={{ borderTop: i > 0 ? "1px solid rgba(var(--glow-rgb),0.12)" : "none", padding: "12px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", letterSpacing: 1.2, marginBottom: 4 }}>HOSPITAL VISIT TODAY</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{v.reason}</p>
              <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2 }}>
                {v.hospitalName}{v.visitTime ? ` · ${v.visitTime}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
