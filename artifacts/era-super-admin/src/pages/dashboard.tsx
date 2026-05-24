import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, RefreshCw, Trash2, CalendarClock
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

export default function Dashboard() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [, setLocation] = useLocation();

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

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const handleReset = async () => {
    setResetting(true);
    setResetMsg("");
    try {
      const result = await api.resetTestData();
      setResetMsg(result.message);
      setShowResetConfirm(false);
    } catch (e: any) {
      setResetMsg(e.message ?? "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const filtered = hospitals.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.username.toLowerCase().includes(search.toLowerCase())
  );

  const now = Date.now();
  const in30days = now + 30 * 24 * 60 * 60 * 1000;
  const stats = {
    total: hospitals.length,
    active: hospitals.filter(h => h.active && h.subscriptionStatus === "active").length,
    trial: hospitals.filter(h => h.subscriptionStatus === "trial").length,
    suspended: hospitals.filter(h => !h.active).length,
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
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition"
            title="Clear all test data for production launch"
          >
            <Trash2 className="w-4 h-4" />
            Reset Test Data
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

      {/* Reset success message */}
      {resetMsg && (
        <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border mb-4 text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {resetMsg}
        </div>
      )}

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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search hospitals…"
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
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

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-lg">Reset All Test Data</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete all patients, appointments, queue entries, call tasks, automation logs, feedback, and wellness newsletters across <strong>all hospitals</strong>.
                </p>
                <p className="text-sm text-amber-400 mt-2 font-medium">
                  Hospital accounts and settings are preserved. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {resetting ? "Resetting…" : "Yes, Reset Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
