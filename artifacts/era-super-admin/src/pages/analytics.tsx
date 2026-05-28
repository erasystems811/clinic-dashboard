import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  RefreshCw, Database, MessageSquare, Clock, Mail, Smartphone, Cpu,
  Loader2, TrendingUp, Activity, Wifi,
} from "lucide-react";

type HealthCheck = { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string };

function Metric({ label, value, sub, icon: Icon, color, accent, loading }: {
  label: string; value: number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; accent?: boolean; loading: boolean;
}) {
  return (
    <div className={`relative flex flex-col justify-between p-4 border transition-all duration-200 ${
      accent
        ? "border-[hsl(43_65%_58%/0.2)] bg-[hsl(43_65%_58%/0.04)]"
        : "border-[hsl(220_12%_14%)] bg-[hsl(220_14%_8%)] hover:border-[hsl(220_12%_18%)]"
    }`}>
      {/* Corner accent for highlighted card */}
      {accent && (
        <>
          <span className="absolute top-0 left-0 w-4 h-px" style={{ background: "hsl(43 65% 58% / 0.5)" }} />
          <span className="absolute top-0 left-0 w-px h-4" style={{ background: "hsl(43 65% 58% / 0.5)" }} />
        </>
      )}
      <div className="flex items-start justify-between mb-4">
        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      {loading
        ? <div className="h-7 w-10 bg-muted/60 animate-pulse" />
        : (
          <div>
            <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
            {sub && <p className="text-[9px] text-muted-foreground/40 mt-1 uppercase tracking-wider">{sub}</p>}
          </div>
        )
      }
    </div>
  );
}

function HealthCard({ check }: { check: HealthCheck }) {
  const Icon = check.name === "Database" ? Database
    : check.name.startsWith("SMS") ? MessageSquare
    : check.name.startsWith("WhatsApp") ? Smartphone
    : check.name.startsWith("Email") ? Mail
    : check.name === "OpenAI" ? Cpu
    : Clock;

  const isWarn = check.ok && check.warning;
  const isOk = check.ok && !check.warning;
  const isFail = !check.ok;

  const stateColor = isFail ? "text-red-400" : isWarn ? "text-amber-400" : "text-emerald-400";
  const borderColor = isFail ? "border-red-500/20" : isWarn ? "border-amber-500/15" : "border-[hsl(220_12%_14%)]";
  const bgColor = isFail ? "bg-red-500/5" : isWarn ? "bg-amber-500/4" : "bg-[hsl(220_14%_8%)]";
  const dotColor = isFail ? "bg-red-400" : isWarn ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div title={[check.detail, check.balance].filter(Boolean).join(" · ")}
      className={`p-3.5 border flex flex-col gap-3 cursor-default select-none transition-all ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between">
        <Icon className={`w-3.5 h-3.5 ${stateColor}`} />
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isOk ? "shadow-[0_0_6px_hsl(134_61%_51%/0.6)]" : ""}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-foreground tracking-wide">{check.name}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${stateColor === "text-emerald-400" ? "text-muted-foreground/50" : stateColor}`}>
          {check.balance ?? check.detail}
        </p>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; anyWarning?: boolean; checks: HealthCheck[] } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try { setHealth(await api.getHealth()); } catch { setHealth(null); }
    finally { setHealthLoading(false); }
  }, []);

  const fetchHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try { setHospitals(await api.listHospitals()); } catch { /* */ }
    finally { setHospitalsLoading(false); }
  }, []);

  const refresh = useCallback(() => {
    fetchHealth();
    fetchHospitals();
    setLastRefresh(new Date());
  }, [fetchHealth, fetchHospitals]);

  useEffect(() => { refresh(); }, [refresh]);

  const now = Date.now();
  const in30 = now + 30 * 24 * 60 * 60 * 1000;
  const stats = {
    total: hospitals.length,
    active: hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    trial: hospitals.filter(h => h.active && h.subscriptionStatus === "trial").length,
    suspended: hospitals.filter(h => !h.active || h.subscriptionStatus === "inactive").length,
    expiringSoon: hospitals.filter(h => {
      if (!h.active || !h.subscriptionExpiresAt) return false;
      const exp = new Date(h.subscriptionExpiresAt).getTime();
      return exp > now && exp <= in30;
    }).length,
  };

  const overallStatus = !health ? "unknown"
    : !health.ok ? "degraded"
    : health.anyWarning ? "warning"
    : "operational";

  const statusConfig = {
    operational: { label: "All Systems Operational", color: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_8px_hsl(134_61%_51%/0.7)]", border: "border-emerald-500/15", bg: "bg-emerald-500/5" },
    warning:     { label: "Degraded — Warning",       color: "text-amber-400",   dot: "bg-amber-400",   border: "border-amber-500/15",  bg: "bg-amber-500/5"  },
    degraded:    { label: "Service Disruption",        color: "text-red-400",     dot: "bg-red-400",     border: "border-red-500/15",    bg: "bg-red-500/5"    },
    unknown:     { label: "Status Unknown",            color: "text-muted-foreground", dot: "bg-muted-foreground", border: "border-border", bg: "bg-muted/30" },
  }[overallStatus];

  return (
    <Layout>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-2">Platform Overview</p>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Command Center</h1>
          <p className="text-[11px] text-muted-foreground/50 mt-1 tracking-wide">Real-time infrastructure health · account intelligence</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-[9px] text-muted-foreground/30 uppercase tracking-wider hidden sm:block">
            Refreshed {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={refresh}
            className="p-1.5 border border-[hsl(220_12%_14%)] text-muted-foreground/50 hover:text-muted-foreground hover:border-[hsl(220_12%_20%)] transition"
            title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${(healthLoading || hospitalsLoading) ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* System health banner */}
      <div className={`flex items-center gap-3 px-4 py-2.5 border mb-6 ${statusConfig.border} ${statusConfig.bg}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dot}`} />
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${statusConfig.color}`}>{statusConfig.label}</p>
        <div className="ml-auto flex items-center gap-1.5">
          <Activity className={`w-3 h-3 ${statusConfig.color}`} />
          <span className={`text-[9px] font-medium ${statusConfig.color} opacity-60`}>Live</span>
        </div>
      </div>

      {/* Account metrics grid */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">Account Registry</p>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-muted-foreground/30" />
            <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">{stats.total} hospitals</span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <Metric label="Total Accounts"  value={stats.total}       icon={Building2}     color="text-primary/70"        loading={hospitalsLoading} />
          <Metric label="Active"          value={stats.active}      icon={CheckCircle2}  color="text-emerald-400/80"    loading={hospitalsLoading} />
          <Metric label="On Trial"        value={stats.trial}       icon={AlertCircle}   color="text-amber-400/80"      loading={hospitalsLoading} />
          <Metric label="Suspended"       value={stats.suspended}   icon={XCircle}       color="text-red-400/70"        loading={hospitalsLoading} />
          <Metric label="Expiring ≤30d"   value={stats.expiringSoon} icon={CalendarClock} color={stats.expiringSoon > 0 ? "text-[hsl(43_65%_58%)]" : "text-muted-foreground/30"} loading={hospitalsLoading} accent={stats.expiringSoon > 0} sub={stats.expiringSoon > 0 ? "Needs attention" : "All clear"} />
        </div>
      </div>

      {/* Divider */}
      <div className="my-6 border-t border-[hsl(220_12%_11%)]" />

      {/* System health grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">Infrastructure Health</p>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-muted-foreground/30" />
            <button onClick={fetchHealth}
              className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 uppercase tracking-wider transition flex items-center gap-1">
              <RefreshCw className={`w-2.5 h-2.5 ${healthLoading ? "animate-spin" : ""}`} />
              Probe services
            </button>
          </div>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-20 border border-[hsl(220_12%_12%)] bg-[hsl(220_14%_7%)] animate-pulse" />
            ))}
          </div>
        ) : health ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {health.checks.map(c => <HealthCard key={c.name} check={c} />)}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-8 border border-[hsl(220_12%_12%)] bg-[hsl(220_14%_7%)] px-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider">Health endpoint unavailable</span>
          </div>
        )}
      </div>

      {/* Footer tagline */}
      <div className="mt-10 pt-6 border-t border-[hsl(220_12%_10%)]">
        <p className="text-[9px] text-muted-foreground/20 uppercase tracking-[0.4em] text-center">
          Evaluate · Rebuild · Automate
        </p>
      </div>
    </Layout>
  );
}
