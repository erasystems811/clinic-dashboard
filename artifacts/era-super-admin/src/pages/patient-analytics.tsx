import Layout from "@/components/layout";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, UserPlus, Eye, BarChart2, Star,
  MessageSquare, RefreshCw, Bug, Lightbulb, Heart,
} from "lucide-react";

interface AnalyticsData {
  totalPatients:  number;
  newToday:       number;
  newThisWeek:    number;
  activeToday:    number;
  activeThisWeek: number;
  pageViewsToday: number;
  pageViewsWeek:  number;
  topPages:       { route: string; views: number }[];
  dailySignups:   { date: string; count: number }[];
  recentFeedback: {
    id: number;
    username: string | null;
    rating: number | null;
    category: string;
    message: string;
    created_at: string;
  }[];
}

function StatCard({
  label, value, sub, icon: Icon, color, loading,
}: { label: string; value: number | string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; loading: boolean }) {
  return (
    <div className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-16 bg-muted/60 animate-pulse rounded-lg" />
        : <div>
            <p className="text-3xl font-bold text-foreground tabular-nums leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
      }
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CategoryIcon({ cat }: { cat: string }) {
  if (cat === "bug")     return <Bug className="w-3.5 h-3.5 text-red-400" />;
  if (cat === "feature") return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
  if (cat === "praise")  return <Heart className="w-3.5 h-3.5 text-pink-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted/40 mt-1.5">
      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SignupChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const label = new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover border border-border text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
              {d.count} · {label}
            </div>
            <div className="w-full rounded-t-sm bg-primary/40 hover:bg-primary/70 transition-all"
              style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 2)}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default function PatientAnalytics() {
  const { data, isLoading, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["patient-analytics"],
    queryFn: () => get<AnalyticsData>("/super-admin/patient-analytics"),
    staleTime: 60_000,
  });

  const topPagesMax = Math.max(...(data?.topPages ?? []).map(p => p.views), 1);

  // Shorten route labels for display
  function routeLabel(r: string) {
    if (r === "/" || r === "") return "Home";
    return r.replace(/^\//, "").replace(/\//g, " › ").slice(0, 35) || "Home";
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1">ERA Patient App</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Patient App Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            User growth · page engagement · in-app feedback
          </p>
        </div>
        <button onClick={() => void refetch()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition mt-1">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Patients"    value={data?.totalPatients  ?? 0} icon={Users}     color="text-primary"        loading={isLoading} sub="all time" />
        <StatCard label="New Today"         value={data?.newToday       ?? 0} icon={UserPlus}   color="text-emerald-400"    loading={isLoading} />
        <StatCard label="New This Week"     value={data?.newThisWeek    ?? 0} icon={UserPlus}   color="text-teal-400"       loading={isLoading} />
        <StatCard label="Active Today"      value={data?.activeToday    ?? 0} icon={UserCheck}  color="text-blue-400"       loading={isLoading} sub="unique users" />
        <StatCard label="Active This Week"  value={data?.activeThisWeek ?? 0} icon={UserCheck}  color="text-indigo-400"     loading={isLoading} sub="unique users" />
        <StatCard label="Page Views Today"  value={data?.pageViewsToday ?? 0} icon={Eye}        color="text-violet-400"     loading={isLoading} />
        <StatCard label="Page Views / Week" value={data?.pageViewsWeek  ?? 0} icon={BarChart2}  color="text-purple-400"     loading={isLoading} />
      </div>

      {/* ── Two-column: Signups chart + Top pages ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Daily signups chart */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">New Signups — Last 14 Days</p>
          </div>
          <div className="px-5 py-5">
            {isLoading
              ? <div className="h-20 bg-muted/30 animate-pulse rounded-lg" />
              : data?.dailySignups.length
                ? <SignupChart data={data.dailySignups} />
                : <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
            }
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">{data?.dailySignups[0]?.date ?? ""}</p>
              <p className="text-[10px] text-muted-foreground">{data?.dailySignups[data?.dailySignups.length - 1]?.date ?? ""}</p>
            </div>
          </div>
        </div>

        {/* Top pages */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Top Pages — Last 30 Days</p>
          </div>
          <div className="px-5 py-3 space-y-3">
            {isLoading
              ? [1,2,3,4].map(i => <div key={i} className="h-8 bg-muted/30 animate-pulse rounded-lg" />)
              : (data?.topPages ?? []).length === 0
                ? <p className="text-sm text-muted-foreground py-4 text-center">No page views tracked yet</p>
                : (data?.topPages ?? []).map((p) => (
                    <div key={p.route}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground font-medium font-mono truncate max-w-[70%]">{routeLabel(p.route)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{p.views.toLocaleString()}</span>
                      </div>
                      <MiniBar value={p.views} max={topPagesMax} />
                    </div>
                  ))
            }
          </div>
        </div>
      </div>

      {/* ── Recent feedback ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400/70" />
            <p className="text-sm font-semibold text-foreground">In-App Feedback</p>
          </div>
          {(data?.recentFeedback?.length ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">{data!.recentFeedback.length} recent</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 animate-pulse rounded-lg" />)}
          </div>
        ) : (data?.recentFeedback ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <MessageSquare className="w-6 h-6 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No feedback yet — it'll appear here once patients send some</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {(data?.recentFeedback ?? []).map((fb) => (
              <div key={fb.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-muted/30 shrink-0 mt-0.5">
                    <CategoryIcon cat={fb.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {fb.username ?? "Anonymous"}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{
                            background: fb.category === "bug" ? "rgba(239,68,68,0.1)" : fb.category === "praise" ? "rgba(236,72,153,0.1)" : fb.category === "feature" ? "rgba(245,158,11,0.1)" : "rgba(99,102,241,0.1)",
                            color: fb.category === "bug" ? "#f87171" : fb.category === "praise" ? "#f472b6" : fb.category === "feature" ? "#fbbf24" : "#a5b4fc",
                          }}>
                          {fb.category === "praise" ? "love it" : fb.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {fb.rating && (
                          <span className="text-xs text-amber-400">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo(fb.created_at)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{fb.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="pt-5 border-t border-border/40">
        <p className="text-xs text-muted-foreground/40 text-center">
          Analytics are based on page-view events from the ERA patient app · Feedback submitted by patients
        </p>
      </div>
    </Layout>
  );
}
