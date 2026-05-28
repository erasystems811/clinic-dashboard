import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, RefreshCw, CalendarClock,
  Database, MessageSquare, Clock, Activity, Mail, Smartphone,
  Flag, X
} from "lucide-react";
import CreateHospitalModal from "@/components/create-hospital-modal";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  trial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function StatusBadge({ status, active }: { status: string; active: boolean }) {
  const label = (!active || status === "inactive") ? "suspended" : status;
  const style = STATUS_STYLES[label] ?? STATUS_STYLES.inactive;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${style}`}>
      {label === "active" && <CheckCircle2 className="w-3 h-3" />}
      {label === "suspended" && <XCircle className="w-3 h-3" />}
      {label === "trial" && <AlertCircle className="w-3 h-3" />}
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

type HealthCheck = { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string; flagged?: boolean; flaggedAt?: string };

export default function Dashboard() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showSuspended, setShowSuspended] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [, setLocation] = useLocation();

  const [health, setHealth] = useState<{ ok: boolean; anyWarning?: boolean; checks: HealthCheck[] } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [flagging, setFlagging] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const handleFlag = useCallback(async (service: string) => {
    setFlagging(service);
    try {
      await api.setServiceAlert(service);
      await fetchHealth();
    } catch { /* ignore */ } finally {
      setFlagging(null);
    }
  }, [fetchHealth]);

  const handleClearFlag = useCallback(async (service: string) => {
    setFlagging(service);
    try {
      await api.clearServiceAlert(service);
      await fetchHealth();
    } catch { /* ignore */ } finally {
      setFlagging(null);
    }
  }, [fetchHealth]);

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listHospitals();
      setHospitals(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHospitals(); fetchHealth(); }, [fetchHospitals, fetchHealth]);

  const isSuspended = (h: Hospital) => !h.active || h.subscriptionStatus === "suspended" || h.subscriptionStatus === "inactive";

  const filtered = hospitals.filter(h => {
    if (!showSuspended && isSuspended(h)) return false;
    return (
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.username.toLowerCase().includes(search.toLowerCase())
    );
  });

  const now = Date.now();
  const in30days = now + 30 * 24 * 60 * 60 * 1000;
  const stats = {
    total: hospitals.length,
    active: hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    // Trial only counts if the account is still active (not deactivated/suspended)
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hospital Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all hospital accounts on the Era platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHospitals}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" />
            Add Hospital
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Accounts", value: stats.total, icon: Building2, color: "text-primary" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Trial", value: stats.trial, icon: AlertCircle, color: "text-amber-400" },
          { label: "Suspended", value: stats.suspended, icon: XCircle, color: "text-red-400" },
          { label: "Expiring Soon", value: stats.expiringSoon, icon: CalendarClock, color: stats.expiringSoon > 0 ? "text-orange-400" : "text-muted-foreground" },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl bg-card border p-4 ${stat.label === "Expiring Soon" && stat.value > 0 ? "border-orange-500/40 bg-orange-500/5" : "border-border"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* System Health */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">System Health</span>
          </div>
          <div className="flex items-center gap-2">
            {!healthLoading && health && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                !health.ok
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : health.anyWarning
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {!health.ok ? "Degraded" : health.anyWarning ? "All Systems Operational" : "All Systems Operational"}
              </span>
            )}
            <button onClick={fetchHealth} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Refresh health">
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {healthLoading ? (
          <div className="flex gap-4">
            {[1,2,3].map(i => <div key={i} className="flex-1 h-12 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : health ? (
          <div className="grid grid-cols-5 gap-3">
            {health.checks.map(c => {
              const Icon = c.name === "Database" ? Database : c.name.startsWith("SMS") ? MessageSquare : c.name.startsWith("WhatsApp") ? Smartphone : c.name.startsWith("Email") ? Mail : Clock;
          
              const isWarn = c.ok && c.warning;
              const isBusy = flagging === c.name;
              return (
                <div key={c.name} className={`flex flex-col p-3 rounded-lg border ${
                  !c.ok ? "border-red-500/20 bg-red-500/5"
                  : isWarn ? "border-amber-500/20 bg-amber-500/5"
                  : "border-emerald-500/20 bg-emerald-500/5"
                }`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${!c.ok ? "text-red-400" : isWarn ? "text-amber-400" : "text-emerald-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate" title={c.detail}>{c.detail}</p>
                      {c.balance && (
                        <p className={`text-xs font-semibold mt-0.5 ${isWarn || !c.ok ? "text-amber-400" : "text-emerald-400"}`}>{c.balance}</p>
                      )}
                    </div>
                    {!c.ok
                      ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      : isWarn
                        ? <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                  </div>
                  {/* Manual alert flag — press when billing alert email arrives */}
                  {c.flagged ? (
                    <button
                      onClick={() => handleClearFlag(c.name)}
                      disabled={isBusy}
                      className="mt-2 flex items-center justify-center gap-1 w-full py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition border border-red-500/20"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      {!isBusy && "Clear alert"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFlag(c.name)}
                      disabled={isBusy}
                      className="mt-2 flex items-center justify-center gap-1 w-full py-0.5 rounded text-xs text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition"
                      title="Got a low-credit email for this service? Click to flag it red."
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Unable to reach health endpoint.</p>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals…"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
        </div>
        <button
          onClick={() => setShowSuspended(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition whitespace-nowrap ${
            showSuspended
              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
              : "bg-muted text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {showSuspended ? "Suspended shown" : "Suspended hidden"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading hospitals…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Building2 className="w-8 h-8 opacity-40" />
            <span className="text-sm">{search ? "No hospitals match your search" : "No hospitals yet"}</span>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs text-primary hover:underline"
              >
                Add the first hospital
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Hospital</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Subscription Expires</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(hospital => {
                const expDate = hospital.subscriptionExpiresAt ? new Date(hospital.subscriptionExpiresAt) : null;
                const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24)) : null;
                const isExpired = daysLeft !== null && daysLeft < 0;
                const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                return (
                <tr
                  key={hospital.id}
                  className="hover:bg-muted/30 transition cursor-pointer"
                  onClick={() => setLocation(`/hospitals/${hospital.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{hospital.name}</p>
                        <p className="text-xs text-muted-foreground">{hospital.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground font-mono">{hospital.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={hospital.subscriptionStatus} active={hospital.active} />
                  </td>
                  <td className="px-4 py-3">
                    {expDate ? (
                      <div>
                        <p className={`text-xs font-medium ${isExpired ? "text-red-400" : isExpiringSoon ? "text-orange-400" : "text-muted-foreground"}`}>
                          {expDate.toLocaleDateString()}
                        </p>
                        {isExpired && <p className="text-xs text-red-400">Expired {Math.abs(daysLeft!)}d ago</p>}
                        {isExpiringSoon && <p className="text-xs text-orange-400">⚠️ {daysLeft}d left</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(hospital.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateHospitalModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchHospitals(); }}
        />
      )}

    </Layout>
  );
}
