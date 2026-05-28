import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, RefreshCw
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
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${label === "active" ? "bg-emerald-400" : label === "suspended" ? "bg-red-400" : "bg-amber-400"}`} />
      {label}
    </span>
  );
}

export default function Hospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showSuspended, setShowSuspended] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [, setLocation] = useLocation();

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHospitals(await api.listHospitals());
    } catch (e: any) {
      setError(e.message ?? "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const isSuspended = (h: Hospital) => !h.active || h.subscriptionStatus === "suspended" || h.subscriptionStatus === "inactive";

  const filtered = hospitals.filter(h => {
    if (!showSuspended && isSuspended(h)) return false;
    return (
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.username.toLowerCase().includes(search.toLowerCase())
    );
  });

  const now = Date.now();

  return (
    <Layout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Era Systems Platform</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Hospital Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Manage all hospital accounts on the Era platform</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={fetchHospitals}
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition"
            style={{ boxShadow: "0 2px 12px hsl(43 96% 54% / 0.25)" }}>
            <Plus className="w-4 h-4" />
            Add Hospital
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals…"
            className="w-full pl-9 pr-4 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition font-medium"
          />
        </div>
        <button
          onClick={() => setShowSuspended(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-bold transition whitespace-nowrap uppercase tracking-wide ${
            showSuspended
              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/15"
              : "bg-muted text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {showSuspended ? "Suspended Shown" : "Suspended Hidden"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading hospitals…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Building2 className="w-8 h-8 opacity-20" />
            <span className="text-sm font-medium">{search ? "No hospitals match your search" : "No hospitals yet"}</span>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="text-xs text-primary hover:underline font-bold">
                Add the first hospital
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hospital</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Username</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expires</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created</th>
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
                    className="hover:bg-muted/25 transition cursor-pointer group"
                    onClick={() => setLocation(`/hospitals/${hospital.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{hospital.name}</p>
                          <p className="text-[11px] text-muted-foreground font-medium">{hospital.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-muted-foreground font-mono">{hospital.username}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={hospital.subscriptionStatus} active={hospital.active} />
                    </td>
                    <td className="px-4 py-3.5">
                      {expDate ? (
                        <div>
                          <p className={`text-xs font-semibold ${isExpired ? "text-red-400" : isExpiringSoon ? "text-orange-400" : "text-muted-foreground"}`}>
                            {expDate.toLocaleDateString()}
                          </p>
                          {isExpired && <p className="text-[10px] text-red-400 font-medium">Expired {Math.abs(daysLeft!)}d ago</p>}
                          {isExpiringSoon && <p className="text-[10px] text-orange-400 font-medium">{daysLeft}d remaining</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 font-medium">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-muted-foreground font-medium">
                        {new Date(hospital.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto group-hover:text-muted-foreground transition" />
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
