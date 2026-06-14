import { useState, useCallback } from "react";
import Layout from "@/components/layout";
import { get, post } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, UserPlus, Eye, BarChart2, Star,
  MessageSquare, RefreshCw, Bug, Lightbulb, Heart,
  BarChart, Send, Loader2, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, parseISO, isThisMonth } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  recentFeedback: PatientFeedback[];
}

interface PatientFeedback {
  id: number;
  username: string | null;
  rating: number | null;
  category: string;
  message: string;
  created_at: string;
}

interface PatientFeedbackPage {
  items: PatientFeedback[];
  total: number;
  page: number;
  limit: number;
}

type BroadcastState = "idle" | "confirming" | "sending" | "sent" | "error";

// ── Constants ─────────────────────────────────────────────────────────────────

const RATINGS = [
  { value: 5, emoji: "😍", label: "Amazing" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 1, emoji: "😫", label: "Terrible" },
];

const CATEGORIES: Record<string, { label: string; color: string }> = {
  praise:  { label: "Love it",      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  general: { label: "General",      color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  feature: { label: "Feature idea", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  bug:     { label: "Bug report",   color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

// ── Small components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string; value: number | string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string; loading: boolean;
}) {
  return (
    <div className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className="p-1.5 rounded-lg bg-primary/10"><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
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

function FbStatCard({ label, value, suffix, highlight }: { label: string; value: string | number | null; suffix?: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-xl p-5 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{label}</p>
      {value === null
        ? <div className="h-9 w-16 bg-muted/60 animate-pulse rounded-lg" />
        : <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold tabular-nums leading-none ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
            {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          </div>
      }
    </div>
  );
}

function CategoryIcon({ cat }: { cat: string }) {
  if (cat === "bug")     return <Bug className="w-3.5 h-3.5 text-red-400" />;
  if (cat === "feature") return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
  if (cat === "praise")  return <Heart className="w-3.5 h-3.5 text-pink-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 rounded-full bg-muted/40 mt-1.5">
      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientAnalytics() {
  const [tab, setTab] = useState<"analytics" | "feedback">("analytics");

  // ── Analytics data ─────────────────────────────────────────────────────────
  const { data, isLoading, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["patient-analytics"],
    queryFn: () => get<AnalyticsData>("/super-admin/patient-analytics"),
    staleTime: 60_000,
  });

  const topPagesMax = Math.max(...(data?.topPages ?? []).map(p => p.views), 1);

  function routeLabel(r: string) {
    if (r === "/" || r === "") return "Home";
    return r.replace(/^\//, "").replace(/\//g, " › ").slice(0, 35) || "Home";
  }

  // ── Full feedback data (loaded when tab is opened) ─────────────────────────
  const [feedbackData, setFeedbackData] = useState<PatientFeedbackPage | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [broadcastState, setBroadcastState] = useState<BroadcastState>("idle");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const fetchFeedback = useCallback(async (page = 1) => {
    setFeedbackLoading(true); setFeedbackError("");
    try {
      const d = await get<PatientFeedbackPage>(`/super-admin/patient-feedback?page=${page}`);
      setFeedbackData(d); setFeedbackPage(page);
    } catch (e: unknown) {
      setFeedbackError(e instanceof Error ? e.message : "Failed to load");
    } finally { setFeedbackLoading(false); }
  }, []);

  function openFeedbackTab() {
    setTab("feedback");
    if (!feedbackData) fetchFeedback(1);
  }

  const handleBroadcast = async () => {
    setBroadcastState("sending");
    try {
      await post("/super-admin/patient-feedback/broadcast", {});
      setBroadcastMsg("Nudge queued — ERA-me users will see it on next app open.");
      setBroadcastState("sent");
    } catch (e: unknown) {
      setBroadcastMsg(e instanceof Error ? e.message : "Failed");
      setBroadcastState("error");
    } finally {
      setTimeout(() => { setBroadcastState("idle"); setBroadcastMsg(""); }, 6000);
    }
  };

  // ── Derived feedback stats ─────────────────────────────────────────────────
  const fItems      = feedbackData?.items ?? [];
  const fTotal      = feedbackData?.total ?? 0;
  const ratedItems  = fItems.filter(e => e.rating != null);
  const fAvg        = ratedItems.length ? (ratedItems.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedItems.length).toFixed(1) : "—";
  const fMonth      = fItems.filter(e => { try { return isThisMonth(parseISO(e.created_at)); } catch { return false; } }).length;
  const fBreakdown  = RATINGS.map(r => {
    const count = fItems.filter(e => e.rating === r.value).length;
    return { ...r, count, pct: ratedItems.length ? Math.round((count / ratedItems.length) * 100) : 0 };
  });
  const totalPages  = feedbackData ? Math.ceil(feedbackData.total / feedbackData.limit) : 1;

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1">ERA-me Patient App</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Patient App</h1>
          <p className="text-sm text-muted-foreground mt-1">Analytics · engagement · feedback</p>
        </div>
        {tab === "analytics" ? (
          <button onClick={() => void refetch()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition mt-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => fetchFeedback(feedbackPage)} disabled={feedbackLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${feedbackLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {broadcastState === "confirming" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
                <span className="text-muted-foreground">Push to ERA-me users?</span>
                <button onClick={() => void handleBroadcast()} className="font-semibold text-violet-400 hover:opacity-80">Yes</button>
                <button onClick={() => setBroadcastState("idle")} className="text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => broadcastState === "idle" && setBroadcastState("confirming")}
                disabled={broadcastState === "sending"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                  broadcastState === "sent"  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : broadcastState === "error" ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/15"}`}>
                {broadcastState === "sending" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {broadcastState === "sent" ? "Sent!" : broadcastState === "error" ? "Failed" : "Push nudge"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-6 w-fit">
        <button onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "analytics" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <BarChart className="w-3.5 h-3.5" />Analytics
        </button>
        <button onClick={openFeedbackTab}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "feedback" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Star className="w-3.5 h-3.5" />Feedback
          {(data?.recentFeedback?.length ?? 0) > 0 && tab !== "feedback" && (
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              {data!.recentFeedback.length}+
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {tab === "analytics" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Patients"    value={data?.totalPatients  ?? 0} icon={Users}     color="text-primary"     loading={isLoading} sub="all time" />
            <StatCard label="New Today"         value={data?.newToday       ?? 0} icon={UserPlus}  color="text-emerald-400" loading={isLoading} />
            <StatCard label="New This Week"     value={data?.newThisWeek    ?? 0} icon={UserPlus}  color="text-teal-400"    loading={isLoading} />
            <StatCard label="Active Today"      value={data?.activeToday    ?? 0} icon={UserCheck} color="text-blue-400"    loading={isLoading} sub="unique users" />
            <StatCard label="Active This Week"  value={data?.activeThisWeek ?? 0} icon={UserCheck} color="text-indigo-400"  loading={isLoading} sub="unique users" />
            <StatCard label="Page Views Today"  value={data?.pageViewsToday ?? 0} icon={Eye}       color="text-violet-400"  loading={isLoading} />
            <StatCard label="Page Views / Week" value={data?.pageViewsWeek  ?? 0} icon={BarChart2} color="text-purple-400"  loading={isLoading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
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

          {/* Recent feedback preview — click to see full list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400/70" />
                <p className="text-sm font-semibold text-foreground">Recent Feedback</p>
              </div>
              <button onClick={openFeedbackTab}
                className="text-xs font-semibold text-primary hover:opacity-80 transition">
                View all →
              </button>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 animate-pulse rounded-lg" />)}</div>
            ) : (data?.recentFeedback ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageSquare className="w-6 h-6 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No feedback yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {(data?.recentFeedback ?? []).slice(0, 5).map((fb) => (
                  <div key={fb.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-muted/30 shrink-0 mt-0.5"><CategoryIcon cat={fb.category} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{fb.username ?? "Anonymous"}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                              style={{
                                background: fb.category === "bug" ? "rgba(239,68,68,0.1)" : fb.category === "praise" ? "rgba(236,72,153,0.1)" : fb.category === "feature" ? "rgba(245,158,11,0.1)" : "rgba(99,102,241,0.1)",
                                color: fb.category === "bug" ? "#f87171" : fb.category === "praise" ? "#f472b6" : fb.category === "feature" ? "#fbbf24" : "#a5b4fc",
                              }}>
                              {fb.category === "praise" ? "love it" : fb.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {fb.rating && <span className="text-xs text-amber-400">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(fb.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{fb.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(data?.recentFeedback?.length ?? 0) > 5 && (
                  <div className="px-5 py-3 text-center">
                    <button onClick={openFeedbackTab} className="text-xs text-primary font-semibold hover:opacity-80 transition">
                      + {data!.recentFeedback.length - 5} more — view all →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ FEEDBACK TAB ══════════════ */}
      {tab === "feedback" && (
        <>
          {broadcastMsg && (
            <div className={`flex items-center gap-2 text-sm mb-5 p-3 rounded-lg border ${broadcastState === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-violet-400 bg-violet-500/10 border-violet-500/20"}`}>
              <AlertCircle className="w-4 h-4 shrink-0" />{broadcastMsg}
            </div>
          )}
          {feedbackError && (
            <div className="flex items-center gap-2 text-sm text-red-400 mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />{feedbackError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <FbStatCard label="Total responses"  value={feedbackLoading ? null : fTotal} />
            <FbStatCard label="Average rating"   value={feedbackLoading ? null : fAvg} suffix="/ 5" highlight />
            <FbStatCard label="This page / month" value={feedbackLoading ? null : fMonth} />
          </div>

          <div className="border border-border bg-card rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Rating breakdown</h2>
            <div className="space-y-3">
              {fBreakdown.map(r => (
                <div key={r.value} className="flex items-center gap-3">
                  <span className="text-xl w-7 shrink-0 leading-none">{r.emoji}</span>
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500/60 rounded-full transition-all duration-500" style={{ width: feedbackLoading ? "0%" : `${r.pct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-foreground w-6 text-right tabular-nums shrink-0">{feedbackLoading ? "—" : r.count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums shrink-0">{feedbackLoading ? "" : `${r.pct}%`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">All responses</h2>
              {!feedbackLoading && fTotal > 0 && (
                <span className="text-xs text-muted-foreground">{fTotal} total · page {feedbackPage} of {totalPages}</span>
              )}
            </div>

            {feedbackLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : fItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">No feedback yet</p>
                <p className="text-xs opacity-60">Use the push button above to prompt users</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">User</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Category</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Rating</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Message</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fItems.map(e => {
                        const r = e.rating != null ? RATINGS.find(x => x.value === e.rating) : null;
                        const cat = CATEGORIES[e.category] ?? CATEGORIES.general;
                        return (
                          <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">
                              {e.username ? `@${e.username}` : <span className="text-muted-foreground opacity-40">—</span>}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>{cat.label}</span>
                            </td>
                            <td className="px-3 py-3">
                              {r ? (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-base leading-none">{r.emoji}</span>
                                  <span className="font-bold text-foreground tabular-nums">{e.rating}</span>
                                  <span className="text-xs text-muted-foreground">/5</span>
                                </span>
                              ) : <span className="text-muted-foreground opacity-30">—</span>}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground max-w-sm">
                              <span className="line-clamp-2">{e.message}</span>
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="px-5 py-4 border-t border-border flex items-center justify-between">
                    <button onClick={() => fetchFeedback(feedbackPage - 1)} disabled={feedbackPage <= 1 || feedbackLoading}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      ← Previous
                    </button>
                    <span className="text-xs text-muted-foreground">Page {feedbackPage} of {totalPages}</span>
                    <button onClick={() => fetchFeedback(feedbackPage + 1)} disabled={feedbackPage >= totalPages || feedbackLoading}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
