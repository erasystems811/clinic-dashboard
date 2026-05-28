import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { api, AutomationLog, Hospital } from "@/lib/api";
import {
  Activity, Database, MessageSquare, Mail, Smartphone, Cpu, Clock,
  RefreshCw, Building2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  Send, RotateCcw, Loader2, ShieldAlert, Zap,
} from "lucide-react";

type HealthCheck = {
  name: string;
  ok: boolean;
  warning?: boolean;
  detail: string;
  balance?: string;
  flagged?: boolean;
  flaggedAt?: string;
};

const CHECK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Database, OpenAI: Cpu,
};
function getCheckIcon(name: string) {
  if (name in CHECK_ICONS) return CHECK_ICONS[name];
  if (name.startsWith("SMS")) return MessageSquare;
  if (name.startsWith("WhatsApp")) return Smartphone;
  if (name.startsWith("Email")) return Mail;
  return Clock;
}

const LOG_CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquare,
  whatsapp: Smartphone,
  email: Mail,
};

function channelIcon(channel: string) {
  return LOG_CHANNEL_ICONS[channel.toLowerCase()] ?? Send;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Analytics() {
  const [health, setHealth] = useState<{ ok: boolean; anyWarning?: boolean; checks: HealthCheck[] } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try { setHealth(await api.getHealth()); }
    catch { setHealth(null); }
    finally { setHealthLoading(false); }
  }, []);

  const fetchHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try { setHospitals(await api.listHospitals()); }
    catch { setHospitals([]); }
    finally { setHospitalsLoading(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try { setLogs(await api.getAutomationLog()); }
    catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchHospitals();
    fetchLogs();
  }, [fetchHealth, fetchHospitals, fetchLogs]);

  const now = Date.now();
  const in30 = now + 30 * 24 * 60 * 60 * 1000;
  const stats = {
    total: hospitals.length,
    active: hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    trial: hospitals.filter(h => h.active && h.subscriptionStatus === "trial").length,
    suspended: hospitals.filter(h => !h.active || h.subscriptionStatus === "inactive").length,
    expiring: hospitals.filter(h => {
      if (!h.active || !h.subscriptionExpiresAt) return false;
      const exp = new Date(h.subscriptionExpiresAt).getTime();
      return exp > now && exp <= in30;
    }).length,
  };

  const recentLogs = logs.slice(0, 20);
  const logStats = {
    sent: logs.filter(l => l.status === "sent").length,
    failed: logs.filter(l => l.status === "failed").length,
    pending: logs.filter(l => l.status === "pending").length,
  };

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">ERA Systems Platform</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Platform health, status and automation overview</p>
        </div>
        <button
          onClick={() => { fetchHealth(); fetchHospitals(); fetchLogs(); }}
          className="mt-1 flex items-center gap-2 px-3 py-2 rounded border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition uppercase tracking-wide"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh All
        </button>
      </div>

      {/* ── Platform Stats ─────────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Platform Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {hospitalsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded border border-border bg-card animate-pulse" />
            ))
          ) : (
            [
              { label: "Total", value: stats.total, icon: Building2, color: "text-foreground", bg: "border-border bg-card" },
              { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5" },
              { label: "Trial", value: stats.trial, icon: AlertCircle, color: "text-amber-400", bg: "border-amber-500/20 bg-amber-500/5" },
              { label: "Suspended", value: stats.suspended, icon: XCircle, color: "text-red-400", bg: "border-red-500/20 bg-red-500/5" },
              { label: "Expiring Soon", value: stats.expiring, icon: CalendarClock, color: stats.expiring > 0 ? "text-orange-400" : "text-muted-foreground", bg: stats.expiring > 0 ? "border-orange-500/20 bg-orange-500/5" : "border-border bg-card" },
            ].map(s => (
              <div key={s.label} className={`rounded border p-4 ${s.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</span>
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <div className={`text-3xl font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── System Health ──────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Health</p>
          <div className="flex items-center gap-2">
            {!healthLoading && health && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-widest ${
                !health.ok
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : health.anyWarning
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {health.checks.filter(c => !c.ok).length > 0
                  ? `${health.checks.filter(c => !c.ok).length} Degraded`
                  : health.anyWarning
                    ? `${health.checks.filter(c => c.warning).length} Warning`
                    : "All Systems Operational"}
              </span>
            )}
            <button onClick={fetchHealth} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded border border-border bg-card animate-pulse" />)}
          </div>
        ) : !health ? (
          <div className="rounded border border-border bg-card px-4 py-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="w-4 h-4" />Unable to reach health endpoint.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {health.checks.map(c => {
              const Icon = getCheckIcon(c.name);
              const isWarn = c.ok && c.warning;
              const isDown = !c.ok;
              return (
                <div
                  key={c.name}
                  title={[c.detail, c.balance].filter(Boolean).join(" · ")}
                  className={`rounded border p-4 cursor-default select-none transition ${
                    isDown ? "border-red-500/30 bg-red-500/6"
                    : isWarn ? "border-amber-500/30 bg-amber-500/6"
                    : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`w-4 h-4 ${isDown ? "text-red-400" : isWarn ? "text-amber-400" : "text-emerald-400"}`} />
                    <div className="flex items-center gap-1.5">
                      {c.flagged && <ShieldAlert className="w-3 h-3 text-red-400" title="Manually flagged" />}
                      <span className={`w-2 h-2 rounded-full ${isDown ? "bg-red-400" : isWarn ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-foreground leading-tight">{c.name}</p>
                  <p className={`text-[11px] mt-1 font-medium leading-snug ${isDown ? "text-red-400" : isWarn ? "text-amber-400" : "text-muted-foreground"}`}>
                    {c.balance ?? c.detail}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Automation Summary + Log ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Automations</p>
          <button onClick={fetchLogs} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Automation micro-stats */}
        {!logsLoading && logs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Sent", value: logStats.sent, color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-500/5", icon: CheckCircle2 },
              { label: "Failed", value: logStats.failed, color: "text-red-400", bg: "border-red-500/20 bg-red-500/5", icon: XCircle },
              { label: "Pending", value: logStats.pending, color: "text-amber-400", bg: "border-amber-500/20 bg-amber-500/5", icon: Clock },
            ].map(s => (
              <div key={s.label} className={`rounded border p-3 flex items-center gap-3 ${s.bg}`}>
                <s.icon className={`w-4 h-4 shrink-0 ${s.color}`} />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log table */}
        <div className="rounded border border-border overflow-hidden">
          {logsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Loading automations…</span>
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Zap className="w-6 h-6 opacity-20" />
              <span className="text-sm font-medium">No automation logs yet</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hospital</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Patient</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Channel</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentLogs.map(log => {
                  const ChanIcon = channelIcon(log.channel);
                  const isSent = log.status === "sent";
                  const isFailed = log.status === "failed";
                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-foreground capitalize">
                          {log.automationType.replace(/_/g, " ")}
                        </span>
                        {log.messagePreview && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{log.messagePreview}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-medium">{log.hospitalName ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-medium">{log.patientName ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium capitalize">
                          <ChanIcon className="w-3.5 h-3.5 shrink-0" />
                          {log.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                          isSent ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : isFailed ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {isSent && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {isFailed && <XCircle className="w-2.5 h-2.5" />}
                          {!isSent && !isFailed && <Clock className="w-2.5 h-2.5" />}
                          {log.status}
                        </span>
                        {isFailed && log.retryCount > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" />{log.retryCount} retr{log.retryCount === 1 ? "y" : "ies"}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-muted-foreground font-medium">{timeAgo(log.createdAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Layout>
  );
}
