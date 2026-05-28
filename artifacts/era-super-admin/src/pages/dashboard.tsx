import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, RefreshCw, CalendarClock,
  Database, MessageSquare, Activity, Mail, Smartphone, Cpu, Clock
} from "lucide-react";
import CreateHospitalModal from "@/components/create-hospital-modal";

// Status config — color only used for left edge and badge dot
const STATUS_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  active:    { dot: "bg-emerald-400",  label: "text-emerald-400",  text: "Active"    },
  trial:     { dot: "bg-amber-400",    label: "text-amber-400",    text: "Trial"     },
  suspended: { dot: "bg-red-400",      label: "text-red-400",      text: "Suspended" },
  inactive:  { dot: "bg-zinc-500",     label: "text-zinc-400",     text: "Inactive"  },
};

const STAT_ACCENT: Record<string, string> = {
  "Total Accounts": "border-l-primary/60",
  "Active":         "border-l-emerald-400/70",
  "Trial":          "border-l-amber-400/70",
  "Suspended":      "border-l-red-400/70",
  "Expiring Soon":  "border-l-orange-400/70",
};

function StatusBadge({ status, active }: { status: string; active: boolean }) {
  const key = (!active || status === "inactive") ? "suspended" : status;
  const cfg = STATUS_CONFIG[key] ?? STATUS_CONFIG.inactive;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={cfg.label}>{cfg.text}</span>
    </span>
  );
}

type HealthCheck = { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string; flagged?: boolean };

const HEALTH_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Database":        Database,
  "SMS (Termii)":    MessageSquare,
  "WhatsApp (Termii)": Smartphone,
  "Email (Resend)":  Mail,
  "OpenAI":          Cpu,
  "Scheduler":       Clock,
};

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

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try { setHealth(await api.getHealth()); } catch { setHealth(null); } finally { setHealthLoading(false); }
  }, []);

  const fetchHospitals = useCallback(async () => {
    setLoading(true); setError("");
    try { setHospitals(await api.listHospitals()); }
    catch (e: any) { setError(e.message ?? "Failed to load hospitals"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHospitals(); fetchHealth(); }, [fetchHospitals, fetchHealth]);

  const isSuspended = (h: Hospital) => !h.active || h.subscriptionStatus === "suspended" || h.subscriptionStatus === "inactive";

  const filtered = hospitals.filter(h => {
    if (!showSuspended && isSuspended(h)) return false;
    return h.name.toLowerCase().includes(search.toLowerCase()) || h.username.toLowerCase().includes(search.toLowerCase());
  });

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
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[10px] font-mono text-primary/60 uppercase tracking-[0.2em] mb-2">
            ERA SYSTEMS / PLATFORM
          </p>
          <h1
            className="text-3xl font-bold tracking-tight text-foreground leading-none"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Hospital Accounts
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHospitals}
            className="p-2 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition uppercase tracking-widest font-mono"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Hospital
          </button>
        </div>
      </div>

      {/* ── Stat cards — left edge only ─────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          { label: "Total Accounts", value: stats.total,        accent: "border-l-primary/50"        },
          { label: "Active",          value: stats.active,       accent: "border-l-emerald-400/60"    },
          { label: "Trial",           value: stats.trial,        accent: "border-l-amber-400/60"      },
          { label: "Suspended",       value: stats.suspended,    accent: "border-l-red-400/60"        },
          { label: "Expiring Soon",   value: stats.expiringSoon, accent: stats.expiringSoon > 0 ? "border-l-orange-400/80" : "border-l-border" },
        ].map(stat => (
          <div
            key={stat.label}
            className={`bg-card border border-border border-l-2 ${stat.accent} rounded px-4 py-4`}
          >
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
              {stat.label}
            </p>
            <p
              className="text-3xl font-bold text-foreground leading-none"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── System Health ────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span
              className="text-xs font-bold uppercase tracking-[0.15em] text-foreground"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              System Health
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!healthLoading && health && (
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 border rounded ${
                !health.ok ? "border-red-500/30 text-red-400" : "border-emerald-500/20 text-emerald-400"
              }`}>
                {!health.ok ? "DEGRADED" : "OPERATIONAL"}
              </span>
            )}
            <button
              onClick={fetchHealth}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <RefreshCw className={`w-3 h-3 ${healthLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Service rows — full untruncated names */}
        {healthLoading ? (
          <div className="px-5 py-4 space-y-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                <div className="ml-auto h-3 w-20 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : health ? (
          <div className="divide-y divide-border">
            {health.checks.map(c => {
              const Icon = HEALTH_ICON[c.name] ?? Activity;
              const isWarn = c.ok && c.warning;
              const statusColor = !c.ok ? "text-red-400" : isWarn ? "text-amber-400" : "text-emerald-400";
              const dotColor = !c.ok ? "bg-red-400" : isWarn ? "bg-amber-400" : "bg-emerald-400";
              const tooltip = [c.detail, c.balance].filter(Boolean).join(" · ");
              return (
                <div
                  key={c.name}
                  title={tooltip}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${statusColor}`} />
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  {c.balance && (
                    <span className={`text-xs font-mono ${statusColor}`}>{c.balance}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground font-medium truncate max-w-[260px]">
                    {c.detail}
                  </span>
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-widest shrink-0 ${statusColor}`}>
                    {!c.ok ? "FAIL" : isWarn ? "WARN" : "OK"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-4 text-xs text-muted-foreground font-mono">Unable to reach health endpoint.</p>
        )}
      </div>

      {/* ── Search + filter ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals…"
            className="w-full pl-9 pr-4 py-2 rounded bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 transition font-medium"
          />
        </div>
        <button
          onClick={() => setShowSuspended(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded border text-[11px] font-mono font-bold uppercase tracking-widest transition ${
            showSuspended
              ? "bg-red-500/8 text-red-400 border-red-500/20 hover:bg-red-500/12"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {showSuspended ? "Suspended On" : "Suspended Off"}
        </button>
      </div>

      {/* ── Hospital table ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Building2 className="w-8 h-8 opacity-15" />
            <span className="text-sm font-medium">{search ? "No hospitals match search" : "No hospitals yet"}</span>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="text-xs font-bold text-primary hover:underline uppercase tracking-widest font-mono">
                Add First Hospital
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">Hospital</th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">Username</th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">Expires</th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((hospital, idx) => {
                const expDate = hospital.subscriptionExpiresAt ? new Date(hospital.subscriptionExpiresAt) : null;
                const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24)) : null;
                const isExpired = daysLeft !== null && daysLeft < 0;
                const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                return (
                  <tr
                    key={hospital.id}
                    onClick={() => setLocation(`/hospitals/${hospital.id}`)}
                    className={`cursor-pointer hover:bg-muted/25 transition group ${idx !== filtered.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded border border-border flex items-center justify-center shrink-0 bg-muted/50">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground leading-tight">{hospital.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{hospital.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-muted-foreground">{hospital.username}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={hospital.subscriptionStatus} active={hospital.active} />
                    </td>
                    <td className="px-5 py-3.5">
                      {expDate ? (
                        <div>
                          <p className={`text-xs font-mono font-bold ${isExpired ? "text-red-400" : isExpiringSoon ? "text-orange-400" : "text-muted-foreground"}`}>
                            {expDate.toLocaleDateString()}
                          </p>
                          {isExpired && <p className="text-[10px] text-red-400 font-mono">–{Math.abs(daysLeft!)}d</p>}
                          {isExpiringSoon && <p className="text-[10px] text-orange-400 font-mono">{daysLeft}d left</p>}
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(hospital.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 ml-auto group-hover:text-muted-foreground transition" />
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
