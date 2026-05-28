import { useState } from "react";
import Layout from "@/components/layout";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, Radio, Users, Mail, MessageSquare, History, Zap, ChevronLeft, ChevronRight,
} from "lucide-react";

interface MonthSnapshot {
  label: string;
  patients: number;
  emails: number;
  sms: number;
  avgPatientsDay: number;
  avgEmailsDay: number;
  avgSmsDay: number;
}

interface CurrentMonth {
  label: string;
  daysElapsed: number;
  patients: number;
  emails: number;
  sms: number;
  avgPatientsDay: number;
  avgEmailsDay: number;
  avgSmsDay: number;
}

interface HospitalUsageStat {
  id: number;
  name: string;
  active: boolean;
  createdAt: string | null;
  daysSince: number;
  totalPatients: number;
  currentMonth: CurrentMonth;
  history: MonthSnapshot[];
}

type Tab = "history" | "live";

// avg = avg patients/day from most recent completed month
function getTier(avg: number) {
  if (avg >= 100) return { label: "Large", color: "text-purple-400" };
  if (avg >= 41)  return { label: "Big",   color: "text-orange-400" };
  if (avg >= 21)  return { label: "Mid",   color: "text-blue-400"   };
  if (avg >= 1)   return { label: "Small", color: "text-emerald-400" };
  return                 { label: "—",     color: "text-muted-foreground/25" };
}

// Returns the avgPatientsDay from the most recent completed month that had any patients
function recentAvg(history: MonthSnapshot[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i]?.patients ?? 0) > 0) return history[i].avgPatientsDay;
  }
  return 0;
}

function fmt(n: number) {
  if (!n || n === 0) return "—";
  if (n < 0.1) return "<0.1";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtDays(d: number) {
  if (d < 30)  return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  const y = Math.floor(d / 365), m = Math.floor((d % 365) / 30);
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

// Short month: "May 2026" → "May '26"
function shortLabel(label: string) {
  const p = label.split(" ");
  return p.length === 2 ? `${p[0]} '${p[1].slice(2)}` : label;
}

const TIER_DEFS = [
  { label: "Large", range: "100+/d",   color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { label: "Big",   range: "41–99/d",  color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { label: "Mid",   range: "21–40/d",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20"   },
  { label: "Small", range: "1–20/d",   color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "—",     range: "no data",  color: "text-muted-foreground/40", bg: "bg-white/5 border-border"    },
];

export default function Usage() {
  const [tab, setTab] = useState<Tab>("live");

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<{ stats: HospitalUsageStat[] }>({
    queryKey: ["usage-stats-v7"],
    queryFn: () => get("/super-admin/usage-stats"),
    staleTime: 0,
    refetchInterval: 2 * 60_000,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const stats = (data?.stats ?? []).filter(s => s?.currentMonth);
  const sorted = [...stats].sort((a, b) => recentAvg(b.history) - recentAvg(a.history));

  const tierCounts = stats.reduce<Record<string, number>>((acc, h) => {
    const { label } = getTier(recentAvg(h.history));
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const COLS_PER_PAGE = 6;
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // windowOffset: default COLS_PER_PAGE so May 2026 (current month) is column 0.
  // Negative = shift left into the past. Positive = shift right into the future.
  const [windowOffset, setWindowOffset] = useState(COLS_PER_PAGE);

  // Visible month labels: starts at (now - COLS_PER_PAGE + windowOffset)
  const visibleMonths: string[] = Array.from({ length: COLS_PER_PAGE }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - COLS_PER_PAGE + windowOffset + i, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });

  // A month is "future" if it's after the current month
  const isFutureMonth = (label: string) => {
    const [mName, yr] = label.split(" ");
    const mIdx = MONTH_NAMES.indexOf(mName);
    const y = parseInt(yr);
    return y > now.getFullYear() || (y === now.getFullYear() && mIdx > now.getMonth());
  };
  const isCurrentMonth = (label: string) => label === currentMonthLabel;
  const daysElapsed = stats[0]?.currentMonth.daysElapsed ?? now.getDate();

  return (
    <Layout breadcrumb={[{ label: "Usage" }]}>
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground">Hospital Usage</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                <Radio className="w-2.5 h-2.5" /> Live
              </span>
            </div>
            {lastUpdated && (
              <p className="text-[11px] text-muted-foreground/35 mt-1">
                Last updated: {lastUpdated} · auto-refreshes every 2 min
              </p>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Tier summary strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {TIER_DEFS.map(t => (
            <div key={t.label} className={`rounded-xl border ${t.bg} px-4 py-3`}>
              <p className={`text-2xl font-bold tabular-nums ${t.color}`}>
                {isLoading ? "—" : (tierCounts[t.label] ?? 0)}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${t.color}`}>{t.label}</p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">{t.range}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-border gap-1">
          <button
            onClick={() => setTab("live")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition
              ${tab === "live"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Live — {currentMonthLabel}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition
              ${tab === "history"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        </div>

        {/* ══════════════════════════════════════════
            TAB: LIVE — current month rolling stats
        ══════════════════════════════════════════ */}
        {tab === "live" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Bar: current month context */}
            <div className="px-5 py-2.5 border-b border-border flex items-center gap-3 bg-white/[0.04]">
              <Zap className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                {MONTH_SHORT[now.getMonth()]} '{String(now.getFullYear()).slice(2)}
              </span>
              <span className="text-[11px] text-muted-foreground/40">Day {daysElapsed} of {new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()} · resets 1st</span>
              <div className="ml-auto flex items-center gap-4 text-[10px] text-muted-foreground/35">
                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Patients</span>
                <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Emails</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> SMS</span>
              </div>
            </div>
            {/* Key */}
            <div style={{ padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.015)", fontSize: 10, color: "rgba(255,255,255,0.35)", display: "flex", gap: 16 }}>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>Pts</strong> = Patients avg/day this month</span>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>Em</strong> = Emails avg/day this month</span>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>SMS</strong> = Text messages avg/day this month</span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.22)" }}>Tier = most recent completed month</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">Loading…</div>
            ) : (
              <table className="w-full text-xs" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 190 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 80 }} />
                  <col /><col /><col />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: "rgba(255,255,255,0.04)", borderBottom: "2px solid rgba(255,255,255,0.12)" }}>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", borderRight: "3px solid rgba(255,255,255,0.22)" }}>Hospital</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Tier</th>
                    <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Since</th>
                    <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", borderLeft: "1px solid rgba(255,255,255,0.10)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>Pts · avg/day</div>
                    </th>
                    <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", borderLeft: "1px solid rgba(255,255,255,0.10)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>Em · avg/day</div>
                    </th>
                    <th style={{ padding: "9px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", borderLeft: "1px solid rgba(255,255,255,0.10)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>SMS · avg/day</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, hi) => {
                    const tier = getTier(recentAvg(h.history));
                    const cm   = h.currentMonth;
                    const rowBg = hi % 2 === 0 ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.02)";
                    return (
                      <tr
                        key={h.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", backgroundColor: rowBg }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = rowBg)}
                      >
                        {/* Hospital — fixed width, truncated */}
                        <td style={{ padding: "10px 14px", background: hi % 2 === 0 ? "rgb(24,24,24)" : "rgb(26,26,26)", borderRight: "3px solid rgba(255,255,255,0.22)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                          </div>
                        </td>
                        {/* Tier */}
                        <td style={{ padding: "10px 10px" }}>
                          <span className={`text-[10px] font-semibold ${tier.color}`}>{tier.label}</span>
                        </td>
                        {/* Since */}
                        <td style={{ padding: "10px 10px", overflow: "hidden" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{fmtDays(h.daysSince)}</span>
                        </td>
                        {/* Patients avg/day this month */}
                        <td style={{ padding: "10px 12px", textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
                          <span className="tabular-nums font-semibold" style={{ fontSize: 13, color: cm.avgPatientsDay > 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)" }}>
                            {fmt(cm.avgPatientsDay)}
                          </span>
                          {cm.patients > 0 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{cm.patients} this month</div>}
                        </td>
                        {/* Emails avg/day */}
                        <td style={{ padding: "10px 12px", textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
                          <span className="tabular-nums font-semibold" style={{ fontSize: 13, color: cm.avgEmailsDay > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)" }}>
                            {fmt(cm.avgEmailsDay)}
                          </span>
                          {cm.emails > 0 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{cm.emails} total</div>}
                        </td>
                        {/* SMS avg/day */}
                        <td style={{ padding: "10px 12px", textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
                          <span className="tabular-nums font-semibold" style={{ fontSize: 13, color: cm.avgSmsDay > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)" }}>
                            {fmt(cm.avgSmsDay)}
                          </span>
                          {cm.sms > 0 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{cm.sms} total</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: HISTORY — all 12 months open at once
            Rows = hospitals · Columns = every month
            3 metric rows per hospital (patients, emails, SMS)
        ══════════════════════════════════════════ */}
        {tab === "history" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Section header: title + prev/next navigation + legend */}
            <div className="px-5 py-2.5 border-b border-border flex items-center gap-3 bg-white/[0.04] flex-wrap">
              <History className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <span className="text-xs font-semibold text-foreground">History</span>
              <span className="text-[11px] text-muted-foreground/40">Avg/day that month</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setWindowOffset(o => o - COLS_PER_PAGE)}
                  className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Older
                </button>
                <span className="text-[11px] text-muted-foreground/40 px-2 tabular-nums">
                  {visibleMonths[0]} – {visibleMonths[visibleMonths.length - 1]}
                </span>
                <button
                  onClick={() => setWindowOffset(o => o + COLS_PER_PAGE)}
                  className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-white/5 transition"
                >
                  Newer <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Patients</span>
                <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Emails</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> SMS</span>
              </div>
            </div>
            {/* Key */}
            <div style={{ padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.015)", fontSize: 10, color: "rgba(255,255,255,0.35)", display: "flex", gap: 16 }}>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>Pts</strong> = Patients</span>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>Em</strong> = Emails</span>
              <span><strong style={{ color: "rgba(255,255,255,0.55)" }}>SMS</strong> = Text messages</span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.22)" }}>All figures = avg per day that month · divided by days the hospital was active</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">Loading…</div>
            ) : (
              <table className="text-xs w-full" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 200 }} />
                  {visibleMonths.map(m => <col key={m} />)}
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: "rgba(255,255,255,0.06)", borderBottom: "2px solid rgba(255,255,255,0.16)" }}>
                    <th
                      className="text-left"
                      style={{ padding: "10px 14px", width: 180, maxWidth: 180, background: "rgba(24,24,24,1)", borderRight: "3px solid rgba(255,255,255,0.22)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}
                    >
                      Hospital
                    </th>
                    {visibleMonths.map(label => {
                      const isCur = isCurrentMonth(label);
                      const isFut = isFutureMonth(label);
                      return (
                        <th
                          key={label}
                          className="text-center"
                          style={{
                            padding: "10px 6px",
                            borderLeft: isCur ? "3px solid rgba(99,200,255,0.55)" : "1px solid rgba(255,255,255,0.10)",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            color: isFut ? "rgba(255,255,255,0.25)" : isCur ? "rgba(130,210,255,0.9)" : "rgba(255,255,255,0.65)",
                            backgroundColor: isCur ? "rgba(99,200,255,0.05)" : "transparent",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            maxWidth: 90,
                          }}
                        >
                          {/* "November 2025" → "Nov '25" */}
                          {(() => { const [mn, yr] = label.split(" "); return `${MONTH_SHORT[MONTH_NAMES.indexOf(mn)]} '${yr.slice(2)}`; })()}
                        </th>
                      );
                    })}
                  </tr>
                  <tr style={{ backgroundColor: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                    <th style={{ background: "rgba(24,24,24,1)", borderRight: "3px solid rgba(255,255,255,0.22)", padding: "4px 14px" }} />
                    {visibleMonths.map(label => {
                      const isCur = isCurrentMonth(label);
                      const isFut = isFutureMonth(label);
                      return (
                        <th key={label} style={{ borderLeft: isCur ? "3px solid rgba(99,200,255,0.55)" : "1px solid rgba(255,255,255,0.10)", padding: "4px 0", backgroundColor: isCur ? "rgba(99,200,255,0.04)" : "transparent" }}>
                          <div className="flex justify-around px-2" style={{ fontSize: 9, fontWeight: 600, color: isFut ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
                            <span>Pts</span><span>Em</span><span>SMS</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, hi) => {
                    const tier = getTier(h.currentMonth.avgPatientsDay);
                    const rowBg = hi % 2 === 0 ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.02)";
                    const snapByLabel = new Map((h.history ?? []).map(s => [s.label, s]));
                    const windowSnaps = visibleMonths.map(label => snapByLabel.get(label) ?? null);

                    return (
                      <tr
                        key={h.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", backgroundColor: rowBg }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = rowBg)}
                      >
                        {/* Hospital name — fixed width, truncated */}
                        <td
                          style={{ padding: "9px 14px", width: 180, maxWidth: 180, background: hi % 2 === 0 ? "rgb(24,24,24)" : "rgb(26,26,26)", borderRight: "3px solid rgba(255,255,255,0.22)", overflow: "hidden" }}
                        >
                          <div className="flex items-center gap-1.5" style={{ overflow: "hidden" }}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                            <span className="font-semibold text-foreground" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 pl-3" style={{ overflow: "hidden" }}>
                            <span className={`font-semibold shrink-0 ${tier.color}`} style={{ fontSize: 9 }}>{tier.label}</span>
                            <span className="text-muted-foreground/35 shrink-0" style={{ fontSize: 9 }}>{fmtDays(h.daysSince)}</span>
                          </div>
                        </td>
                        {windowSnaps.map((snap, mi) => {
                          const noData = !snap || (snap.patients === 0 && snap.emails === 0 && snap.sms === 0);
                          return (
                            <td
                              key={mi}
                              className="text-center tabular-nums"
                              style={{ padding: "8px 4px", borderLeft: "1px solid rgba(255,255,255,0.08)", verticalAlign: "middle" }}
                            >
                              {noData ? (
                                <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 16 }}>·</span>
                              ) : (
                                <div className="flex justify-around px-1 gap-1">
                                  <span className="font-semibold" style={{ fontSize: 12, color: snap!.avgPatientsDay > 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)", minWidth: 24, textAlign: "center" }}>
                                    {fmt(snap!.avgPatientsDay)}
                                  </span>
                                  <span style={{ fontSize: 11, color: snap!.avgEmailsDay > 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.10)", minWidth: 22, textAlign: "center" }}>
                                    {fmt(snap!.avgEmailsDay)}
                                  </span>
                                  <span style={{ fontSize: 11, color: snap!.avgSmsDay > 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)", minWidth: 20, textAlign: "center" }}>
                                    {fmt(snap!.avgSmsDay)}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground/30 pb-2">
          {tab === "live"
            ? `Live tab resets on the 1st of each month · Avg/day = total so far ÷ days elapsed · Test automations excluded`
            : `History = cumulative all-time avg/day as of each month's last day · A rising number = hospital is growing`}
        </p>

      </div>
    </Layout>
  );
}
