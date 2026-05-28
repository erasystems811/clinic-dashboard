import { useState } from "react";
import Layout from "@/components/layout";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, Users, Mail, MessageSquare, Radio,
} from "lucide-react";

interface MonthSnapshot {
  label: string;
  cumPatients: number;
  cumEmails: number;
  cumSms: number;
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
  currentMonth: CurrentMonth;
  history: MonthSnapshot[];
}

type Metric = "patients" | "emails" | "sms";
type Window = 6 | 12;

function getTier(avgPerDay: number) {
  if (avgPerDay >= 100) return { label: "Large", color: "text-purple-400", dot: "bg-purple-400" };
  if (avgPerDay >= 41)  return { label: "Big",   color: "text-orange-400", dot: "bg-orange-400" };
  if (avgPerDay >= 21)  return { label: "Mid",   color: "text-blue-400",   dot: "bg-blue-400"   };
  if (avgPerDay >= 1)   return { label: "Small", color: "text-emerald-400",dot: "bg-emerald-400" };
  return                       { label: "—",     color: "text-muted-foreground/25", dot: "bg-muted-foreground/20" };
}

function heatColor(val: number, max: number): string {
  if (val === 0 || max === 0) return "text-muted-foreground/20";
  const ratio = val / max;
  if (ratio >= 0.75) return "text-emerald-300 font-bold";
  if (ratio >= 0.5)  return "text-emerald-400 font-semibold";
  if (ratio >= 0.25) return "text-foreground/80";
  return "text-foreground/50";
}

function fmt(n: number) {
  if (n === 0)   return "—";
  if (n < 0.1)   return "<0.1";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtShortMonth(label: string) {
  // "May 2026" → "May'26"
  const parts = label.split(" ");
  if (parts.length === 2) return `${parts[0]}'${parts[1].slice(2)}`;
  return label;
}

function fmtDays(d: number) {
  if (d < 30)  return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  const yrs = Math.floor(d / 365);
  const mo  = Math.floor((d % 365) / 30);
  return mo > 0 ? `${yrs}y ${mo}mo` : `${yrs}y`;
}

const TIER_DEFS = [
  { label: "Large", range: "100+/day",   color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { label: "Big",   range: "41–100/day", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { label: "Mid",   range: "21–40/day",  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20"   },
  { label: "Small", range: "1–20/day",   color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "—",     range: "0/day",      color: "text-muted-foreground/40", bg: "bg-white/5 border-border"    },
];

export default function Usage() {
  const [metric, setMetric]   = useState<Metric>("patients");
  const [window_, setWindow]  = useState<Window>(6);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<{ stats: HospitalUsageStat[] }>({
    queryKey: ["usage-stats"],
    queryFn:  () => get("/super-admin/usage-stats"),
    staleTime: 0,
    refetchInterval: 2 * 60_000,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const stats = (data?.stats ?? []).filter(s => s?.currentMonth);

  // Sort by current month avg patients/day descending
  const sorted = [...stats].sort((a, b) => b.currentMonth.avgPatientsDay - a.currentMonth.avgPatientsDay);

  const tierCounts = stats.reduce<Record<string, number>>((acc, h) => {
    const { label } = getTier(h.currentMonth.avgPatientsDay);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  // Build the month columns we'll show: last N completed months from history
  // All hospitals share the same history length (12), slice the last N
  const historyMonths = stats[0]?.history ?? [];
  const visibleMonths = historyMonths.slice(historyMonths.length - window_);

  // Compute per-column max for heat coloring
  function getAvg(m: MonthSnapshot, met: Metric) {
    if (met === "patients") return m.avgPatientsDay;
    if (met === "emails")   return m.avgEmailsDay;
    return m.avgSmsDay;
  }
  function getCurrAvg(cm: CurrentMonth, met: Metric) {
    if (met === "patients") return cm.avgPatientsDay;
    if (met === "emails")   return cm.avgEmailsDay;
    return cm.avgSmsDay;
  }

  // Global max across all visible cells for consistent heat scale
  const allValues = [
    ...sorted.flatMap(h => visibleMonths.map((_, ci) => getAvg(h.history[h.history.length - window_ + ci] ?? {} as MonthSnapshot, metric))),
    ...sorted.map(h => getCurrAvg(h.currentMonth, metric)),
  ].filter(Boolean);
  const globalMax = allValues.length > 0 ? Math.max(...allValues) : 1;

  const METRIC_OPTS: { id: Metric; icon: React.ReactNode; label: string }[] = [
    { id: "patients", icon: <Users className="w-3 h-3" />,         label: "Patients / day" },
    { id: "emails",   icon: <Mail className="w-3 h-3" />,          label: "Emails / day"   },
    { id: "sms",      icon: <MessageSquare className="w-3 h-3" />, label: "SMS / day"      },
  ];

  return (
    <Layout breadcrumb={[{ label: "Usage" }]}>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground">Hospital Usage</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                <Radio className="w-2.5 h-2.5" /> Live
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Running averages per day — each past month shows the all-time average as it stood at month-end.
            </p>
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

        {/* Tier strip */}
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

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Metric toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {METRIC_OPTS.map(m => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`flex items-center gap-1.5 px-3 h-7 transition font-medium whitespace-nowrap
                  ${metric === m.id
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Window toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {([6, 12] as Window[]).map(w => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 h-7 font-medium transition whitespace-nowrap
                  ${window_ === w
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
              >
                {w}M
              </button>
            ))}
          </div>

          <span className="text-[11px] text-muted-foreground/35 ml-1">
            Brighter = higher avg · each past month = all-time average as of that month-end
          </span>
        </div>

        {/* Matrix table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">No hospitals found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {/* Fixed columns */}
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap sticky left-0 bg-card z-10 min-w-[160px]">
                      Hospital
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
                      Tier
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
                      Since
                    </th>
                    {/* Month columns */}
                    {visibleMonths.map((m) => (
                      <th
                        key={m.label}
                        className="px-3 py-3 text-center text-[10px] font-semibold text-muted-foreground/35 whitespace-nowrap border-l border-border/40 min-w-[64px]"
                      >
                        {fmtShortMonth(m.label)}
                      </th>
                    ))}
                    {/* Current month */}
                    {stats[0] && (
                      <th className="px-3 py-3 text-center text-[10px] font-semibold text-primary/60 whitespace-nowrap border-l border-primary/20 bg-primary/5 min-w-[72px]">
                        {fmtShortMonth(stats[0].currentMonth.label)} ▸
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((h, rowIdx) => {
                    const tier = getTier(h.currentMonth.avgPatientsDay);
                    const currVal = getCurrAvg(h.currentMonth, metric);

                    // Slice the right portion of this hospital's history
                    const visHist = h.history.slice(h.history.length - window_);

                    return (
                      <tr
                        key={h.id}
                        className={`border-t border-border/50 hover:bg-white/[0.02] transition-colors ${rowIdx % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                      >
                        {/* Name */}
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap sticky left-0 bg-card group-hover:bg-white/[0.02] z-10">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                            {h.name}
                          </div>
                        </td>
                        {/* Tier */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`text-xs font-semibold ${tier.color}`}>{tier.label}</span>
                        </td>
                        {/* Since */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="text-[11px] text-muted-foreground/40 tabular-nums">{fmtDays(h.daysSince)}</span>
                        </td>
                        {/* Past month cells */}
                        {visibleMonths.map((_, ci) => {
                          const snap  = visHist[ci];
                          const val   = snap ? getAvg(snap, metric) : 0;
                          const color = heatColor(val, globalMax);
                          return (
                            <td
                              key={ci}
                              className={`px-3 py-3 text-center tabular-nums border-l border-border/20 ${color}`}
                            >
                              {snap ? fmt(val) : <span className="text-muted-foreground/20 text-[10px]">·</span>}
                            </td>
                          );
                        })}
                        {/* Current month cell */}
                        <td className={`px-3 py-3 text-center tabular-nums border-l border-primary/15 bg-primary/[0.04] ${heatColor(currVal, globalMax)}`}>
                          {fmt(currVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 pb-2">
          <span className="text-[10px] text-muted-foreground/30 uppercase tracking-widest">Tier</span>
          {[
            { label: "Small", range: "1–20/d",   color: "text-emerald-400" },
            { label: "Mid",   range: "21–40/d",  color: "text-blue-400"   },
            { label: "Big",   range: "41–100/d", color: "text-orange-400" },
            { label: "Large", range: "100+/d",   color: "text-purple-400" },
          ].map(t => (
            <span key={t.label} className="flex items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${t.color}`}>{t.label}</span>
              <span className="text-[10px] text-muted-foreground/35">{t.range}</span>
            </span>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground/30">
            Past months = all-time avg as of month-end · Current month resets on the 1st · Test automations excluded
          </span>
        </div>

      </div>
    </Layout>
  );
}
