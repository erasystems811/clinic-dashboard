import { useState } from "react";
import Layout from "@/components/layout";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, Users, Zap, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface HospitalUsageStat {
  id: number;
  name: string;
  active: boolean;
  avgPatientsDay: number;
  avgPatientsMonth: number;
  avgAutosDay: number;
  avgAutosMonth: number;
  totalPatients30: number;
  totalPatients365: number;
  totalAutos30: number;
  totalAutos365: number;
}

type SortKey = "avgPatientsDay" | "avgPatientsMonth" | "avgAutosDay" | "avgAutosMonth" | "name";
type SortDir = "asc" | "desc";

function getTier(avgPerDay: number): { label: string; color: string; bg: string; range: string } {
  if (avgPerDay >= 100) return { label: "Large",  color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/25", range: "100+/day" };
  if (avgPerDay >= 41)  return { label: "Big",    color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/25", range: "41–100/day" };
  if (avgPerDay >= 21)  return { label: "Mid",    color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/25",     range: "21–40/day" };
  if (avgPerDay >= 1)   return { label: "Small",  color: "text-emerald-400",bg: "bg-emerald-500/15 border-emerald-500/25", range: "1–20/day" };
  return                       { label: "No data",color: "text-muted-foreground/40", bg: "bg-muted/10 border-border", range: "—" };
}

function fmt(n: number) {
  return n === 0 ? "—" : n.toFixed(1).replace(/\.0$/, "");
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 ml-1" />;
  return sortDir === "asc"
    ? <ArrowUp   className="w-3 h-3 text-primary ml-1" />
    : <ArrowDown className="w-3 h-3 text-primary ml-1" />;
}

const TIER_ORDER = ["Large", "Big", "Mid", "Small", "No data"];

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
    let cmp = 0;
    if (sortKey === "name") {
      cmp = a.name.localeCompare(b.name);
    } else {
      cmp = a[sortKey] - b[sortKey];
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Summary counts by tier
  const tierCounts = stats.reduce<Record<string, number>>((acc, h) => {
    const { label } = getTier(h.avgPatientsDay);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const SUMMARY = [
    { label: "Large",   color: "text-purple-400", bg: "bg-purple-500/10",  range: "100+ / day" },
    { label: "Big",     color: "text-orange-400", bg: "bg-orange-500/10",  range: "41–100 / day" },
    { label: "Mid",     color: "text-blue-400",   bg: "bg-blue-500/10",    range: "21–40 / day" },
    { label: "Small",   color: "text-emerald-400",bg: "bg-emerald-500/10", range: "1–20 / day" },
    { label: "No data", color: "text-muted-foreground/40", bg: "bg-muted/10", range: "0 / day" },
  ];

  const ColHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest cursor-pointer hover:text-muted-foreground transition select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center">
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
              Rolling averages per hospital — patients seen and automations fired. Tier is based on average patients per day.
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

        {/* Tier summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {SUMMARY.map(t => (
            <div key={t.label} className={`rounded-xl border border-border ${t.bg} px-4 py-3`}>
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
                  <tr className="border-b border-border">
                    <ColHeader col="name" label="Hospital" />
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
                      Tier
                    </th>
                    {/* Patients group */}
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap" colSpan={2}>
                      <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                        <Users className="w-3 h-3" /> Patients (avg)
                      </span>
                    </th>
                    {/* Automations group */}
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap" colSpan={2}>
                      <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                        <Zap className="w-3 h-3" /> Automations (avg)
                      </span>
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-white/[0.01]">
                    {/* spacers for Hospital + Tier */}
                    <th className="px-4 py-2" />
                    <th className="px-4 py-2" />
                    <ColHeader col="avgPatientsDay"   label="/ Day (30d)" />
                    <ColHeader col="avgPatientsMonth" label="/ Month (12m)" />
                    <ColHeader col="avgAutosDay"      label="/ Day (30d)" />
                    <ColHeader col="avgAutosMonth"    label="/ Month (12m)" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map(h => {
                    const tier = getTier(h.avgPatientsDay);
                    return (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Hospital name */}
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                            {h.name}
                          </div>
                        </td>

                        {/* Tier badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tier.bg} ${tier.color}`}>
                            {tier.label}
                          </span>
                        </td>

                        {/* Avg patients / day */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgPatientsDay > 0 ? "text-foreground font-medium" : "text-muted-foreground/30"}>
                            {fmt(h.avgPatientsDay)}
                          </span>
                          {h.avgPatientsDay > 0 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">/ day</span>
                          )}
                        </td>

                        {/* Avg patients / month */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgPatientsMonth > 0 ? "text-foreground font-medium" : "text-muted-foreground/30"}>
                            {fmt(h.avgPatientsMonth)}
                          </span>
                          {h.avgPatientsMonth > 0 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">/ mo</span>
                          )}
                        </td>

                        {/* Avg autos / day */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgAutosDay > 0 ? "text-foreground font-medium" : "text-muted-foreground/30"}>
                            {fmt(h.avgAutosDay)}
                          </span>
                          {h.avgAutosDay > 0 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">/ day</span>
                          )}
                        </td>

                        {/* Avg autos / month */}
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.avgAutosMonth > 0 ? "text-foreground font-medium" : "text-muted-foreground/30"}>
                            {fmt(h.avgAutosMonth)}
                          </span>
                          {h.avgAutosMonth > 0 && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">/ mo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tier legend */}
        <div className="flex flex-wrap gap-4 pb-2">
          <p className="text-[10px] text-muted-foreground/30 uppercase tracking-widest self-center">Tier legend</p>
          {[
            { label: "Small",   range: "1–20 / day",  color: "text-emerald-400" },
            { label: "Mid",     range: "21–40 / day", color: "text-blue-400" },
            { label: "Big",     range: "41–100 / day",color: "text-orange-400" },
            { label: "Large",   range: "100+ / day",  color: "text-purple-400" },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${t.color}`}>{t.label}</span>
              <span className="text-[10px] text-muted-foreground/40">{t.range}</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground/30 ml-auto">
            Patients = queue visits. Automations exclude test entries.
          </p>
        </div>

      </div>
    </Layout>
  );
}
