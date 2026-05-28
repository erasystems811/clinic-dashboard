import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, CheckCircle2, XCircle, AlertCircle, CalendarClock,
  Activity, RefreshCw, Database, MessageSquare, Clock, Mail, Smartphone, Cpu, Loader2
} from "lucide-react";

type HealthCheck = { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string };

export default function Analytics() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; anyWarning?: boolean; checks: HealthCheck[] } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try { setHealth(await api.getHealth()); } catch { setHealth(null); }
    finally { setHealthLoading(false); }
  }, []);

  const fetchHospitals = useCallback(async () => {
    setHospitalsLoading(true);
    try { setHospitals(await api.listHospitals()); } catch { /* ignore */ }
    finally { setHospitalsLoading(false); }
  }, []);

  useEffect(() => { fetchHealth(); fetchHospitals(); }, [fetchHealth, fetchHospitals]);

  const now = Date.now();
  const in30days = now + 30 * 24 * 60 * 60 * 1000;
  const stats = {
    total: hospitals.length,
    active: hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    trial: hospitals.filter(h => h.active && h.subscriptionStatus === "trial").length,
    suspended: hospitals.filter(h => !h.active || h.subscriptionStatus === "inactive").length,
    expiringSoon: hospitals.filter(h => {
      if (!h.active || !h.subscriptionExpiresAt) return false;
      const exp = new Date(h.subscriptionExpiresAt).getTime();
      return exp > now && exp <= in30days;
    }).length,
  };

  return (
    <Layout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Platform Overview</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Real-time health and account status across the platform</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={() => { fetchHealth(); fetchHospitals(); }}
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Account Stats */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Account Summary</p>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Building2, color: "text-primary", accent: false },
            { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-emerald-400", accent: false },
            { label: "Trial", value: stats.trial, icon: AlertCircle, color: "text-amber-400", accent: false },
            { label: "Suspended", value: stats.suspended, icon: XCircle, color: "text-red-400", accent: false },
            { label: "Expiring", value: stats.expiringSoon, icon: CalendarClock, color: stats.expiringSoon > 0 ? "text-orange-400" : "text-muted-foreground", accent: stats.expiringSoon > 0 },
          ].map(stat => (
            <div key={stat.label}
              className={`rounded-lg border p-5 ${stat.accent ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
              {hospitalsLoading
                ? <div className="h-8 w-12 rounded bg-muted animate-pulse" />
                : <div className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</div>
              }
            </div>
          ))}
        </div>
      </div>

      {/* System Health */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Health</p>
          <div className="flex items-center gap-2">
            {!healthLoading && health && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${
                !health.ok ? "bg-red-500/10 text-red-400 border-red-500/20"
                : health.anyWarning ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {!health.ok ? "Degraded" : "Operational"}
              </span>
            )}
            <button onClick={fetchHealth} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition">
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : health ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {health.checks.map(c => {
              const Icon = c.name === "Database" ? Database
                : c.name.startsWith("SMS") ? MessageSquare
                : c.name.startsWith("WhatsApp") ? Smartphone
                : c.name.startsWith("Email") ? Mail
                : c.name === "OpenAI" ? Cpu
                : Clock;
              const isWarn = c.ok && c.warning;
              const tooltip = [c.detail, c.balance].filter(Boolean).join(" · ");
              return (
                <div key={c.name} title={tooltip}
                  className={`flex flex-col gap-3 p-4 rounded-lg border cursor-default select-none ${
                    !c.ok ? "border-red-500/30 bg-red-500/6"
                    : isWarn ? "border-amber-500/30 bg-amber-500/6"
                    : "border-border bg-card"
                  }`}>
                  <div className="flex items-center justify-between">
                    <Icon className={`w-4 h-4 ${!c.ok ? "text-red-400" : isWarn ? "text-amber-400" : "text-emerald-400"}`} />
                    <span className={`w-2 h-2 rounded-full ${!c.ok ? "bg-red-400" : isWarn ? "bg-amber-400" : "bg-emerald-400"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{c.name}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${!c.ok ? "text-red-400" : isWarn ? "text-amber-400" : "text-muted-foreground"}`}>
                      {c.balance ?? c.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Health endpoint unavailable</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
