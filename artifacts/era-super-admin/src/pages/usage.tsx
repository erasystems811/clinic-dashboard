import { useState } from "react";
import Layout from "@/components/layout";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Users, Zap, ArrowUpDown, ArrowUp, ArrowDown, CalendarDays } from "lucide-react";

interface HospitalUsageStat {
  id: number;
  name: string;
  active: boolean;
  createdAt: string | null;
  daysSince: number;
  avgPatientsDay: number;
  avgPatientsMonth: number;
  avgAutosDay: number;
  avgAutosMonth: number;
  totalPatients: number;
  totalAutos: number;
}

type SortKey = "avgPatientsDay" | "avgPatientsMonth" | "avgAutosDay" | "avgAutosMonth" | "name" | "daysSince";
type SortDir = "asc" | "desc";

function getTier(avgPerDay: number): { label: string; color: string; bg: string } {
  if (avgPerDay >= 100) return { label: "Large",   color: "text-purple-400",        bg: "bg-purple-500/15 border-purple-500/25" };
  if (avgPerDay >= 41)  return { label: "Big",     color: "text-orange-400",        bg: "bg-orange-500/15 border-orange-500/25" };
  if (avgPerDay >= 21)  return { label: "Mid",     color: "text-blue-400",          bg: "bg-blue-500/15 border-blue-500/25" };
  if (avgPerDay >= 1)   return { label: "Small",   color: "text-emerald-400",       bg: "bg-emerald-500/15 border-emerald-500/25" };
  return                       { label: "No data", color: "text-muted-foreground/40", bg: "bg-white/5 border-border" };
}

function fmt(n: number) {
  if (n === 0) return "—";
  if (n < 0.1) return "< 0.1";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDays(d: number) {
  if (d < 30)  return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  const yrs = Math.floor(d / 365);
  const mo  = Math.floor((d % 365) / 30);
  return mo > 0 ? `${yrs}y ${mo}mo` : `${yrs}y`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/25 ml-1 shrink-0" />;
  return sortDir === "asc"
    ? <ArrowUp   className="w-3 h-3 text-primary ml-1 shrink-0" />
    : <ArrowDown className="w-3 h-3 text-primary ml-1 shrink-0" />;
}

const TIER_SUMMARY = [
  { label: "Large",   range: "100+ / day",  color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { label: "Big",     range: "41–100 / day",color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { label: "Mid",     range: "21–40 / day", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  { label: "Small",   range: "1–20 / day",  color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  { label: "No data", range: "0 / day",     color: "text-muted-foreground/40", bg: "bg-white/5 border-border" },
];

export default function Usage() {
  const [sortKey, setSortKey] = useState<SortKey>("avgPatientsDay");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, isFetching, refetch } = useQuery<{ stats: HospitalUsageStat[] }>({
    queryKey: ["usage-stats"],
    queryFn: () => get("/super-admin/usage-stats"),
    staleTime: 5 * 60_000,
  });

  const stats = data?.stats ?? [];

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...stats].sort((a, b) => {
    const cmp = sortKey === "name"
      ? a.name.localeCompare(b.name)
      : (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const tierCounts = stats.reduce<Record<string, number>>((acc, h) => {
    const { label } = getTier(h.avgPatientsDay);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const Col = ({ col, label, right }: { col: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest cursor-pointer hover:text-muted-foreground transition select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      <span className={`inline-flex items-center ${right ? "justify-end" : ""}`}>
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <Layout breadcrumb={[{ label: "Usage" }]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Hospital Usage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All-time rolling averages per hospital — calculated from each hospital's first day on the platform. Updated on each refresh.
            </p>
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
          {TIER_SUMMARY.map(t => (
            <div key={t.label} className={`rounded-xl border ${t.bg} px-4 py-3`}>
              <p className={`text-2xl font-bold tabular-nums ${t.color}`}>
                {isLoading ? "—" : (tierCounts[t.label] ?? 0)}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${t.color}`}>{t.label}</p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">{t.range}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">
              Loading usage data…
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground/50">
              No hospitals found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Group header row */}
                  <tr className="border-b border-border bg-white/[0.015]">
                    <th className="px-4 py-2.5 text-left" colSpan={2} />
                    <th className="px-4 py-2.5 border-l border-border" colSpan={2}>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                        <Users className="w-3 h-3" /> Patients seen (avg)
                      </span>
                    </th>
                    <th className="px-4 py-2.5 border-l border-border" colSpan={2}>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                        <Zap className="w-3 h-3" /> Automations fired (avg)
                      </span>
                    </th>
                    <th className="px-4 py-2.5 border-l border-border">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                        <CalendarDays className="w-3 h-3" /> Since
                      </span>
                    </th>
                  </tr>
                  {/* Sub-header row */}
                  <tr className="border-b border-border">
                    <Col col="name"     label="Hospital" />
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest text-left whitespace-nowrap">
                      Tier
                    </th>
                    {/* Patients */}
                    <Col col="avgPatientsDay"   label="Per day"   right />
                    <Col col="avgPatientsMonth" label="Per month" right />
                    {/* Automations */}
                    <Col col="avgAutosDay"      label="Per day"   right />
                    <Col col="avgAutosMonth"    label="Per month" right />
                    {/* Since */}
                    <Col col="daysSince"        label="Active for" right />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map(h => {
                    const tier = getTier(h.avgPatientsDay);
                    return (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">

                        {/* Name */}
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                            {h.name}
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tier.bg} ${tier.color}`}>
                            {tier.label}
                          </span>
                        </td>

                        {/* Avg patients / day */}
                        <td className="px-4 py-3 text-right tabular-nums border-l border-border/50">
                          <span className={h.avgPatientsDay > 0 ? "text-foreground font-semibold" : "text-muted-foreground/25"}>
                            {fmt(h.avgPatientsDay)}
                          </span>
                          {h.avgPatientsDay > 0 && <span className="ml-1 text-[10px] text-muted-foreground/35">/day</span>}
                        </td>

                        {/* Avg patients / month */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgPatientsMonth > 0 ? "text-foreground font-medium" : "text-muted-foreground/25"}>
                            {fmt(h.avgPatientsMonth)}
                          </span>
                          {h.avgPatientsMonth > 0 && <span className="ml-1 text-[10px] text-muted-foreground/35">/mo</span>}
                        </td>

                        {/* Avg autos / day */}
                        <td className="px-4 py-3 text-right tabular-nums border-l border-border/50">
                          <span className={h.avgAutosDay > 0 ? "text-foreground font-semibold" : "text-muted-foreground/25"}>
                            {fmt(h.avgAutosDay)}
                          </span>
                          {h.avgAutosDay > 0 && <span className="ml-1 text-[10px] text-muted-foreground/35">/day</span>}
                        </td>

                        {/* Avg autos / month */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgAutosMonth > 0 ? "text-foreground font-medium" : "text-muted-foreground/25"}>
                            {fmt(h.avgAutosMonth)}
                          </span>
                          {h.avgAutosMonth > 0 && <span className="ml-1 text-[10px] text-muted-foreground/35">/mo</span>}
                        </td>

                        {/* Since / active for */}
                        <td className="px-4 py-3 text-right whitespace-nowrap border-l border-border/50">
                          <p className="text-xs font-medium text-foreground/70 tabular-nums">{fmtDays(h.daysSince)}</p>
                          <p className="text-[10px] text-muted-foreground/35 mt-0.5">{fmtDate(h.createdAt)}</p>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend + footnote */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-2">
          <p className="text-[10px] text-muted-foreground/30 uppercase tracking-widest">Tier</p>
          {[
            { label: "Small",  range: "1–20/day",   color: "text-emerald-400" },
            { label: "Mid",    range: "21–40/day",  color: "text-blue-400"   },
            { label: "Big",    range: "41–100/day", color: "text-orange-400" },
            { label: "Large",  range: "100+/day",   color: "text-purple-400" },
          ].map(t => (
            <span key={t.label} className="flex items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${t.color}`}>{t.label}</span>
              <span className="text-[10px] text-muted-foreground/35">{t.range}</span>
            </span>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground/30">
            Averages run from each hospital's creation date · Patients = queue visits · Test automations excluded
          </span>
        </div>

      </div>
    </Layout>
  );
}
