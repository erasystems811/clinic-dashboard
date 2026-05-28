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

// ── Tiny helpers ───────────────────────────────────────────────────────────────
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
  if (channel === "email") return <Mail className="w-3 h-3 shrink-0 text-blue-400/60" />;
  if (channel.includes("whatsapp")) return <MessageCircle className="w-3 h-3 shrink-0 text-emerald-400/60" />;
  return <MessageSquare className="w-3 h-3 shrink-0 text-muted-foreground/40" />;
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, gold, loading, sub }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  color: string; gold?: boolean; loading: boolean; sub?: string;
}) {
  return (
    <div className={`relative flex flex-col justify-between p-4 border transition-all duration-150 ${
      gold ? "border-[hsl(43_70%_62%/0.2)] bg-[hsl(43_70%_62%/0.04)]" : "border-[hsl(0_0%_22%)] bg-[hsl(0_0%_7%)]"
    }`}>
      {gold && <>
        <span className="absolute top-0 left-0 w-4 h-px bg-[hsl(43_70%_62%/0.5)]" />
        <span className="absolute top-0 left-0 w-px h-4 bg-[hsl(43_70%_62%/0.5)]" />
      </>}
      <div className="flex items-start justify-between mb-4">
        <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      {loading
        ? <div className="h-7 w-10 bg-muted/50 animate-pulse" />
        : <div>
            <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
            {sub && <p className="text-[9px] text-muted-foreground/35 mt-1 uppercase tracking-wider">{sub}</p>}
          </div>
      }
    </div>
  );
}

// ── Health card ────────────────────────────────────────────────────────────────
function HealthCard({ check }: { check: HealthCheck }) {
  const Icon = check.name === "Database" ? Database
    : check.name.startsWith("SMS") ? MessageSquare
    : check.name.startsWith("WhatsApp") ? Smartphone
    : check.name.startsWith("Email") ? Mail
    : check.name === "OpenAI" ? Cpu : Clock;
  const fail = !check.ok, warn = check.ok && check.warning, ok = check.ok && !check.warning;
  return (
    <div title={[check.detail, check.balance].filter(Boolean).join(" · ")}
      className={`p-3.5 border flex flex-col gap-3 cursor-default select-none ${
        fail ? "border-red-500/20 bg-red-500/5" : warn ? "border-amber-500/15 bg-amber-500/4" : "border-[hsl(0_0%_22%)] bg-[hsl(0_0%_7%)]"
      }`}>
      <div className="flex items-center justify-between">
        <Icon className={`w-3.5 h-3.5 ${fail ? "text-red-400" : warn ? "text-amber-400" : "text-emerald-400"}`} />
        <span className={`w-1.5 h-1.5 rounded-full ${fail ? "bg-red-400" : warn ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_6px_hsl(134_61%_51%/0.6)]"}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-foreground tracking-wide">{check.name}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${fail ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground/50"}`}>
          {check.balance ?? check.detail}
        </p>
      </div>
    </div>
  );
}

// ── Automation log row ─────────────────────────────────────────────────────────
function LogRow({ log }: { log: AutomationLog }) {
  const ok = log.status === "sent";
  const pending = log.status === "pending" || log.status === "queued";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[hsl(0_0%_7%)] last:border-0 group">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-emerald-400" : pending ? "bg-amber-400" : "bg-red-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {channelIcon(log.channel)}
          <p className="text-[11px] text-foreground/80 font-medium truncate tracking-wide">
            {log.automationType.replace(/_/g, " ")}
          </p>
          {log.patientName && (
            <span className="text-[10px] text-muted-foreground/40 truncate hidden sm:block">→ {log.patientName}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/35 mt-0.5 truncate">
          {log.hospitalName ?? "Unknown hospital"}{log.messagePreview ? ` · ${log.messagePreview.slice(0, 60)}…` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] text-muted-foreground/30 tabular-nums">{timeAgo(log.createdAt)}</p>
        <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${ok ? "text-emerald-400/60" : pending ? "text-amber-400/60" : "text-red-400/60"}`}>
          {log.status}
        </p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
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
  const in30 = now + 30 * 24 * 60 * 60 * 1000;

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
    operational: { label: "All Systems Operational", color: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_8px_hsl(134_61%_51%/0.7)]", border: "border-emerald-500/15", bg: "bg-emerald-500/4" },
    warning:     { label: "Service Warning Detected", color: "text-amber-400",   dot: "bg-amber-400",   border: "border-amber-500/15",  bg: "bg-amber-500/4"  },
    degraded:    { label: "Service Disruption Active", color: "text-red-400",     dot: "bg-red-400",     border: "border-red-500/15",    bg: "bg-red-500/4"    },
    unknown:     { label: "Status Unknown",            color: "text-muted-foreground/60", dot: "bg-muted-foreground/30", border: "border-border", bg: "bg-muted/20" },
  }[overallStatus];

  const sentToday = logs.filter(l => {
    const d = new Date(l.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const failedLogs = logs.filter(l => l.status === "failed").length;

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-2">Intelligence Dashboard</p>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Platform Overview</h1>
          <p className="text-[11px] text-muted-foreground/40 mt-1 tracking-wide">
            Live monitoring · account health · automation intelligence
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-[9px] text-muted-foreground/25 uppercase tracking-wider hidden sm:block">
            {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={fetchAll}
            className="p-1.5 border border-[hsl(0_0%_13%)] text-muted-foreground/40 hover:text-muted-foreground hover:border-[hsl(0_0%_22%)] transition">
            <RefreshCw className={`w-3.5 h-3.5 ${(healthLoading || hospitalsLoading || logsLoading) ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── System status banner ── */}
      <div className={`flex items-center gap-3 px-4 py-2.5 border mb-5 ${statusCfg.border} ${statusCfg.bg}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${statusCfg.color}`}>{statusCfg.label}</p>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground/30 uppercase tracking-wider">
            <Zap className="w-3 h-3 text-primary/40" />
            {logsLoading ? "…" : sentToday} sent today
          </span>
          {failedLogs > 0 && (
            <span className="flex items-center gap-1.5 text-[9px] text-red-400/60 uppercase tracking-wider">
              <ShieldAlert className="w-3 h-3" />
              {failedLogs} failed
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground/25 uppercase tracking-wider">
            <Activity className="w-3 h-3" />Live
          </span>
        </div>
      </div>

      {/* ── Account metrics ── */}
      <div className="mb-3">
        <p className="text-[9px] font-bold text-muted-foreground/35 uppercase tracking-[0.3em] mb-3">Account Registry</p>
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="Total"         value={stats.total}        icon={Building2}    color="text-primary/60"                              loading={hospitalsLoading} />
          <StatCard label="Active"        value={stats.active}       icon={CheckCircle2} color="text-emerald-400/70"                          loading={hospitalsLoading} sub="subscribed" />
          <StatCard label="Trial"         value={stats.trial}        icon={AlertCircle}  color="text-amber-400/70"                            loading={hospitalsLoading} sub="on trial" />
          <StatCard label="Suspended"     value={stats.suspended}    icon={XCircle}      color="text-red-400/60"                              loading={hospitalsLoading} />
          <StatCard label="Expiring ≤30d" value={stats.expiringSoon} icon={CalendarClock} color={stats.expiringSoon > 0 ? "text-[hsl(43_70%_62%)]" : "text-muted-foreground/25"} loading={hospitalsLoading} gold={stats.expiringSoon > 0} sub={stats.expiringSoon > 0 ? "needs action" : "all clear"} />
        </div>
      </div>

      {/* ── Infrastructure health (under account registry) ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold text-muted-foreground/35 uppercase tracking-[0.3em]">Infrastructure Health</p>
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-[9px] text-muted-foreground/25 hover:text-muted-foreground/50 uppercase tracking-wider transition">
            <Wifi className="w-3 h-3" />Probe
          </button>
        </div>
        {healthLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_7%)] animate-pulse" />)}
          </div>
        ) : health ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {health.checks.map(c => <HealthCard key={c.name} check={c} />)}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-6 border border-[hsl(0_0%_16%)] px-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/30" />
            <span className="text-[11px] text-muted-foreground/30 uppercase tracking-wider">Health endpoint unavailable</span>
          </div>
        )}
      </div>

      {/* ── Two-column: Attention list + Automation feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

        {/* Accounts needing attention */}
        <div className="border border-[hsl(0_0%_22%)] bg-[hsl(0_0%_7%)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_16%)]">
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.25em]">Accounts Needing Attention</p>
            <TrendingUp className="w-3 h-3 text-muted-foreground/25" />
          </div>
          {hospitalsLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-9 bg-muted/30 animate-pulse" />)}
            </div>
          ) : needsAttention.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400/30" />
              <p className="text-[10px] text-muted-foreground/25 uppercase tracking-[0.2em]">All accounts in good standing</p>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(0_0%_7%)]">
              {needsAttention.slice(0, 6).map(h => {
                const expDate = h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt) : null;
                const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / 86400000) : null;
                const isTrial = h.subscriptionStatus === "trial";
                return (
                  <button key={h.id} onClick={() => setLocation(`/hospitals/${h.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(0_0%_12%)] transition group text-left">
                    <div className="w-6 h-6 border border-[hsl(0_0%_14%)] bg-[hsl(0_0%_8%)] flex items-center justify-center shrink-0">
                      <Building2 className="w-3 h-3 text-muted-foreground/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground/40 truncate">
                        {isTrial ? "On trial" : expDate ? `Expires ${expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {isTrial && <span className="text-[9px] font-bold text-amber-400/70 uppercase tracking-wider">Trial</span>}
                      {!isTrial && daysLeft !== null && <span className="text-[9px] font-bold text-[hsl(43_70%_62%/0.7)] uppercase tracking-wider">{daysLeft}d left</span>}
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/40 shrink-0 transition" />
                  </button>
                );
              })}
            </div>
          )}
          {needsAttention.length > 6 && (
            <div className="border-t border-[hsl(0_0%_7%)] px-4 py-2">
              <button onClick={() => setLocation("/hospitals")}
                className="flex items-center gap-1.5 text-[10px] text-primary/50 hover:text-primary/80 transition uppercase tracking-wider">
                View all {needsAttention.length} <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Automation activity feed */}
        <div className="border border-[hsl(0_0%_22%)] bg-[hsl(0_0%_7%)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_16%)]">
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.25em]">Automation Activity</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_hsl(134_61%_51%/0.6)]" />
              <span className="text-[9px] text-muted-foreground/25 uppercase tracking-wider">Live</span>
            </div>
          </div>
          {logsLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-muted/30 animate-pulse" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <MailCheck className="w-5 h-5 text-muted-foreground/15" />
              <p className="text-[10px] text-muted-foreground/25 uppercase tracking-[0.2em]">No automation logs yet</p>
            </div>
          ) : (
            <div className="px-4 overflow-y-auto" style={{ maxHeight: 300 }}>
              {logs.map(l => <LogRow key={l.id} log={l} />)}
            </div>
          )}
          {logs.length > 0 && (
            <div className="border-t border-[hsl(0_0%_7%)] px-4 py-2 flex items-center justify-between">
              <p className="text-[9px] text-muted-foreground/25 uppercase tracking-wider">{logs.length} most recent events</p>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground/25">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />{logs.filter(l => l.status === "sent").length} sent</span>
                {failedLogs > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400/50" />{failedLogs} failed</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-5 border-t border-[hsl(0_0%_10%)]">
        <p className="text-[9px] text-muted-foreground/15 uppercase tracking-[0.4em] text-center">
          Evaluate · Rebuild · Automate
        </p>
      </div>
    </Layout>
  );
}
