import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, RefreshCw, Filter
} from "lucide-react";
import CreateHospitalModal from "@/components/create-hospital-modal";

function StatusDot({ status, active }: { status: string; active: boolean }) {
  const label = (!active || status === "inactive") ? "suspended" : status;
  const dot = label === "active" ? "bg-emerald-400 shadow-[0_0_5px_hsl(134_61%_51%/0.6)]"
    : label === "trial"   ? "bg-amber-400"
    : "bg-red-400";
  const text = label === "active" ? "text-emerald-400" : label === "trial" ? "text-amber-400" : "text-red-400";
  return (
    <span className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${text}`}>{label}</span>
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
    try { setHospitals(await api.listHospitals()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const isSuspended = (h: Hospital) => !h.active || h.subscriptionStatus === "suspended" || h.subscriptionStatus === "inactive";

  const filtered = hospitals.filter(h => {
    if (!showSuspended && isSuspended(h)) return false;
    return h.name.toLowerCase().includes(search.toLowerCase()) || h.username.toLowerCase().includes(search.toLowerCase());
  });

  const now = Date.now();

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-2">Era Platform</p>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Hospital Registry</h1>
          <p className="text-[11px] text-muted-foreground/50 mt-1 tracking-wide">
            {loading ? "Loading…" : `${hospitals.filter(h => !isSuspended(h)).length} active · ${hospitals.length} total accounts`}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={fetchHospitals}
            className="p-1.5 border border-[hsl(0_0%_13%)] text-muted-foreground/50 hover:text-muted-foreground hover:border-[hsl(0_0%_22%)] transition"
            title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-primary/90 transition"
            style={{ boxShadow: "0 2px 16px hsl(214 72% 56% / 0.2)" }}>
            <Plus className="w-3.5 h-3.5" />
            New Hospital
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals or usernames…"
            className="w-full pl-9 pr-3 py-2 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_13%)] text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition tracking-wide" />
        </div>
        <button onClick={() => setShowSuspended(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 border text-[10px] font-bold uppercase tracking-[0.15em] transition ${
            showSuspended
              ? "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
              : "border-[hsl(0_0%_13%)] bg-transparent text-muted-foreground/50 hover:text-muted-foreground hover:border-[hsl(0_0%_22%)]"
          }`}>
          <Filter className="w-3 h-3" />
          {showSuspended ? "Showing Suspended" : "Suspended Hidden"}
        </button>
      </div>

      {/* Table container */}
      <div className="border border-[hsl(0_0%_22%)] overflow-hidden">

        {/* Table header */}
        <div className="border-b border-[hsl(0_0%_22%)] bg-[hsl(0_0%_8%)] grid grid-cols-[1fr_140px_120px_130px_110px_32px] gap-0">
          {["Hospital Account", "Identifier", "Status", "Subscription Ends", "Registered", ""].map((h, i) => (
            <div key={i} className="px-4 py-2.5">
              <p className="text-[9px] font-bold text-muted-foreground/35 uppercase tracking-[0.25em]">{h}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-16 bg-[hsl(0_0%_7%)]">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.2em]">Loading registry…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 bg-[hsl(0_0%_7%)]">
            <AlertCircle className="w-4 h-4 text-destructive/70" />
            <span className="text-[11px] text-destructive/70">{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[hsl(0_0%_7%)]">
            <Building2 className="w-6 h-6 text-muted-foreground/15" />
            <span className="text-[11px] text-muted-foreground/30 uppercase tracking-[0.2em]">
              {search ? "No matching accounts" : "No hospitals registered"}
            </span>
            {!search && (
              <button onClick={() => setShowCreate(true)}
                className="text-[10px] text-primary/60 hover:text-primary uppercase tracking-[0.2em] transition font-bold">
                Register first hospital
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[hsl(0_0%_7%)]">
            {filtered.map(h => {
              const expDate = h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt) : null;
              const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / 86400000) : null;
              const isExpired = daysLeft !== null && daysLeft < 0;
              const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

              return (
                <div key={h.id}
                  className="grid grid-cols-[1fr_140px_120px_130px_110px_32px] items-center cursor-pointer group hover:bg-[hsl(0_0%_12%)] transition-all duration-100"
                  onClick={() => setLocation(`/hospitals/${h.id}`)}>

                  {/* Hospital name */}
                  <div className="px-4 py-3.5 flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 shrink-0 border border-[hsl(0_0%_14%)] bg-[hsl(0_0%_7%)] flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground/30" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate tracking-tight">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground/40 truncate tracking-wider">{h.slug}</p>
                    </div>
                  </div>

                  {/* Username */}
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] text-muted-foreground/50 font-mono tracking-wide">{h.username}</p>
                  </div>

                  {/* Status */}
                  <div className="px-4 py-3.5">
                    <StatusDot status={h.subscriptionStatus} active={h.active} />
                  </div>

                  {/* Expires */}
                  <div className="px-4 py-3.5">
                    {expDate ? (
                      <div>
                        <p className={`text-[11px] font-semibold tabular-nums ${isExpired ? "text-red-400" : isExpiringSoon ? "text-[hsl(43_70%_62%)]" : "text-muted-foreground/60"}`}>
                          {expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                        </p>
                        {isExpired && <p className="text-[9px] text-red-400/70 uppercase tracking-wider mt-0.5">{Math.abs(daysLeft!)}d overdue</p>}
                        {isExpiringSoon && <p className="text-[9px] text-[hsl(43_70%_62%/0.7)] uppercase tracking-wider mt-0.5">{daysLeft}d left</p>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/20">—</span>
                    )}
                  </div>

                  {/* Created */}
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] text-muted-foreground/40 tabular-nums">
                      {new Date(h.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>

                  {/* Chevron */}
                  <div className="flex items-center justify-center pr-3">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-[hsl(0_0%_7%)] bg-[hsl(0_0%_8%)] px-4 py-2 flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground/25 uppercase tracking-[0.2em]">
              Showing {filtered.length} of {hospitals.length} accounts
            </p>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/25 uppercase tracking-[0.15em]">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/40" />{filtered.filter(h => h.active && h.subscriptionStatus === "active").length} active</span>
              <span className="flex items-center gap-1.5"><AlertCircle className="w-2.5 h-2.5 text-amber-400/40" />{filtered.filter(h => h.subscriptionStatus === "trial").length} trial</span>
              <span className="flex items-center gap-1.5"><XCircle className="w-2.5 h-2.5 text-red-400/40" />{filtered.filter(h => isSuspended(h)).length} suspended</span>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateHospitalModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchHospitals(); }} />
      )}
    </Layout>
  );
}
