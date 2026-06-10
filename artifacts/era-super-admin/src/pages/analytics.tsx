import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { api, Hospital, AutomationLog } from "@/lib/api";
import {
  Building2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  RefreshCw, Database, MessageSquare, Clock, Mail, Smartphone, Cpu,
  Loader2, Activity, Wifi, Zap, ChevronRight, ArrowUpRight,
  TrendingUp, ShieldAlert, MailCheck, MessageCircle,
} from "lucide-react";
import { useLocation } from "wouter";

type HealthCheck = { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function channelIcon(channel: string) {
  if (channel === "email") return <Mail className="w-3.5 h-3.5 shrink-0 text-blue-400/70" />;
  if (channel.includes("whatsapp")) return <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400/70" />;
  return <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />;
}

function StatCard({ label, value, icon: Icon, color, gold, loading, sub }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  color: string; gold?: boolean; loading: boolean; sub?: string;
}) {
  return (
    <div className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all duration-150 ${
      gold ? "border-amber-500/25 bg-amber-500/5" : "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className={`p-1.5 rounded-lg ${gold ? "bg-amber-500/10" : "bg-primary/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-12 bg-muted/60 animate-pulse rounded-lg" />
        : <div>
            <p className="text-3xl font-bold text-foreground tabular-nums leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
      }
    </div>
  );
}

function HealthCard({ check }: { check: HealthCheck }) {
  const Icon = check.name === "Database" ? Database
    : check.name.startsWith("SMS") ? MessageSquare
    : check.name.startsWith("WhatsApp") ? Smartphone
    : check.name.startsWith("Email") ? Mail
    : check.name === "OpenAI" ? Cpu : Clock;
  const fail = !check.ok, warn = check.ok && check.warning, ok = check.ok && !check.warning;
  return (
    <div title={[check.detail, check.balance].filter(Boolean).join(" · ")}
      className={`p-4 rounded-xl border flex flex-col gap-3 cursor-default select-none ${
        fail ? "border-red-500/25 bg-red-500/8" : warn ? "border-amber-500/20 bg-amber-500/6" : "border-border bg-card"
      }`}>
      <div className="flex items-center justify-between">
        <div className={`p-1.5 rounded-lg ${fail ? "bg-red-500/10" : warn ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${fail ? "text-red-400" : warn ? "text-amber-400" : "text-emerald-400"}`} />
        </div>
        <span className={`w-2 h-2 rounded-full ${fail ? "bg-red-400" : warn ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_6px_hsl(134_61%_51%/0.6)]"}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{check.name}</p>
        <p className={`text-xs mt-0.5 ${fail ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground"}`}>
          {check.balance ?? check.detail}
        </p>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: AutomationLog }) {
  const ok = log.status === "sent";
  const pending = log.status === "pending" || log.status === "queued";
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className={`p-1.5 rounded-lg shrink-0 ${ok ? "bg-emerald-500/10" : pending ? "bg-amber-500/10" : "bg-red-500/10"}`}>
        {channelIcon(log.channel)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {log.automationType.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {log.patientName ? `${log.patientName} · ` : ""}{log.hospitalName ?? "Unknown hospital"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground tabular-nums">{timeAgo(log.createdAt)}</p>
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
          ok ? "bg-emerald-500/12 text-emerald-400" :
          pending ? "bg-amber-500/12 text-amber-400" :
          "bg-red-500/12 text-red-400"
        }`}>{log.status}</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [, setLocation] = useLocation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; anyWarning?: boolean; checks: HealthCheck[] } | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(async () => {
    setHealthLoading(true); setHospitalsLoading(true); setLogsLoading(true);
    setLastRefresh(new Date());
    const [h, hosp, l] = await Promise.allSettled([
      api.getHealth(),
      api.listHospitals(),
      api.getAutomationLog(),
    ]);
    if (h.status === "fulfilled") setHealth(h.value); else setHealth(null);
    if (hosp.status === "fulfilled") setHospitals(hosp.value);
    if (l.status === "fulfilled") setLogs(l.value.slice(0, 20));
    setHealthLoading(false); setHospitalsLoading(false); setLogsLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now = Date.now();
  const in30 = now + 5 * 24 * 60 * 60 * 1000;

  const isSuspended = (h: Hospital) => !h.active || h.subscriptionStatus === "inactive" || h.subscriptionStatus === "suspended";

  const stats = {
    total:        hospitals.length,
    active:       hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    trial:        hospitals.filter(h => h.active && h.subscriptionStatus === "trial").length,
    suspended:    hospitals.filter(h => isSuspended(h)).length,
    expiringSoon: hospitals.filter(h => {
      if (!h.active || !h.subscriptionExpiresAt) return false;
      const exp = new Date(h.subscriptionExpiresAt).getTime();
      return exp > now && exp <= in30;
    }).length,
  };

  const needsAttention = hospitals.filter(h => {
    if (isSuspended(h)) return false;
    if (h.subscriptionStatus === "trial") return true;
    if (!h.subscriptionExpiresAt) return false;
    const exp = new Date(h.subscriptionExpiresAt).getTime();
    return exp > now && exp <= in30;
  });

  const overallStatus = !health ? "unknown" : !health.ok ? "degraded" : health.anyWarning ? "warning" : "operational";
  const statusCfg = {
    operational: { label: "All Systems Running",      color: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_8px_hsl(134_61%_51%/0.7)]", border: "border-emerald-500/20", bg: "bg-emerald-500/6" },
    warning:     { label: "Service Warning Detected", color: "text-amber-400",   dot: "bg-amber-400",   border: "border-amber-500/20",  bg: "bg-amber-500/6"  },
    degraded:    { label: "Service Disruption Active", color: "text-red-400",    dot: "bg-red-400",     border: "border-red-500/20",    bg: "bg-red-500/6"    },
    unknown:     { label: "Status Unknown",            color: "text-muted-foreground", dot: "bg-muted-foreground/40", border: "border-border", bg: "bg-muted/30" },
  }[overallStatus];

  const sentToday = logs.filter(l => {
    const d = new Date(l.createdAt);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const failedLogs = logs.filter(l => l.status === "failed").length;

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1">Era Platform</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Platform Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hospital accounts · automated workflows · system health
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${(healthLoading || hospitalsLoading || logsLoading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── System status banner ── */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 ${statusCfg.border} ${statusCfg.bg}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
        <p className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-primary/60" />
            {logsLoading ? "…" : sentToday} sent today
          </span>
          {failedLogs > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <ShieldAlert className="w-3 h-3" />
              {failedLogs} failed
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="w-3 h-3" />Live
          </span>
        </div>
      </div>

      {/* ── Account metrics ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Account Registry</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <StatCard label="Total"         value={stats.total}        icon={Building2}    color="text-primary"                              loading={hospitalsLoading} />
          <StatCard label="Active"        value={stats.active}       icon={CheckCircle2} color="text-emerald-400"                          loading={hospitalsLoading} sub="subscribed" />
          <StatCard label="Trial"         value={stats.trial}        icon={AlertCircle}  color="text-amber-400"                            loading={hospitalsLoading} sub="on trial" />
          <StatCard label="Suspended"     value={stats.suspended}    icon={XCircle}      color="text-red-400"                              loading={hospitalsLoading} />
          <StatCard label="Expiring ≤5d" value={stats.expiringSoon} icon={CalendarClock} color={stats.expiringSoon > 0 ? "text-amber-400" : "text-muted-foreground/40"} loading={hospitalsLoading} gold={stats.expiringSoon > 0} sub={stats.expiringSoon > 0 ? "needs action" : "all clear"} />
        </div>
      </div>

      {/* ── System health ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">System Status</h2>
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition rounded-lg px-2 py-1 hover:bg-white/5">
            <Wifi className="w-3 h-3" />Probe
          </button>
        </div>
        {healthLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />)}
          </div>
        ) : health ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {health.checks.map(c => <HealthCard key={c.name} check={c} />)}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 rounded-xl border border-border bg-card px-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">Health endpoint unavailable</span>
          </div>
        )}
      </div>

      {/* ── Two-column: Attention list + Automation feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Accounts needing attention */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400/70" />
              <p className="text-sm font-semibold text-foreground">Needs Attention</p>
            </div>
            {needsAttention.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                {needsAttention.length}
              </span>
            )}
          </div>
          {hospitalsLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : needsAttention.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400/40" />
              <p className="text-sm text-muted-foreground">All accounts in good standing</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {needsAttention.slice(0, 6).map(h => {
                const expDate = h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt) : null;
                const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / 86400000) : null;
                const isTrial = h.subscriptionStatus === "trial";
                return (
                  <button key={h.id} onClick={() => setLocation(`/hospitals/${h.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/4 transition group text-left">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{h.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isTrial ? "On trial" : expDate ? `Expires ${expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "—"}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isTrial && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400">Trial</span>}
                      {!isTrial && daysLeft !== null && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(43_70%_62%/0.12)] text-[hsl(43_70%_62%)]">{daysLeft}d</span>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {needsAttention.length > 6 && (
            <div className="border-t border-border/50 px-5 py-3">
              <button onClick={() => setLocation("/hospitals")}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition font-medium">
                View all {needsAttention.length} <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Automation activity feed */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary/70" />
              <p className="text-sm font-semibold text-foreground">Automation Activity</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_hsl(134_61%_51%/0.6)]" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <MailCheck className="w-6 h-6 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No automation logs yet</p>
            </div>
          ) : (
            <div className="px-5 overflow-y-auto" style={{ maxHeight: 320 }}>
              {logs.map(l => <LogRow key={l.id} log={l} />)}
            </div>
          )}
          {logs.length > 0 && (
            <div className="border-t border-border/50 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{logs.length} most recent events</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />{logs.filter(l => l.status === "sent").length} sent</span>
                {failedLogs > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />{failedLogs} failed</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-border/40">
        <p className="text-xs text-muted-foreground/40 text-center tracking-widest uppercase">
          Evaluate · Rebuild · Automate
        </p>
      </div>
    </Layout>
  );
}
