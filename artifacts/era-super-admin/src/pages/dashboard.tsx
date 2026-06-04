import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital } from "@/lib/api";
import {
  Building2, Plus, Search, Users,
  AlertCircle, Loader2, ChevronRight, RefreshCw, Filter, Wallet
} from "lucide-react";
import CreateHospitalModal from "@/components/create-hospital-modal";

function StatusBadge({ status, active }: { status: string; active: boolean }) {
  const label = (!active || status === "inactive") ? "Suspended" : status === "active" ? "Active" : status === "trial" ? "Trial" : status;
  const cls = label === "Active"
    ? "bg-emerald-500/12 text-emerald-400"
    : label === "Trial"
    ? "bg-amber-500/12 text-amber-400"
    : "bg-red-500/12 text-red-400";
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>
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
          <p className="text-xs font-semibold text-primary/70 mb-1">Era Platform</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Hospital Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${hospitals.filter(h => !isSuspended(h)).length} active · ${hospitals.length} total accounts`}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={fetchHospitals}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition"
            title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
            style={{ boxShadow: "0 2px 16px hsl(214 72% 56% / 0.25)" }}>
            <Plus className="w-4 h-4" />
            New Hospital
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search hospitals or usernames…"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition" />
        </div>
        <button onClick={() => setShowSuspended(s => !s)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
            showSuspended
              ? "border-red-500/25 bg-red-500/8 text-red-400 hover:bg-red-500/12"
              : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}>
          <Filter className="w-3.5 h-3.5" />
          {showSuspended ? "Showing Suspended" : "Hide Suspended"}
        </button>
      </div>

      {/* List container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">Loading registry…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16">
            <AlertCircle className="w-5 h-5 text-destructive/70" />
            <span className="text-sm text-destructive/70">{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search ? "No matching accounts" : "No hospitals registered"}
            </p>
            {!search && (
              <button onClick={() => setShowCreate(true)}
                className="text-sm text-primary hover:text-primary/80 transition font-medium">
                Register first hospital →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(h => {
              const expDate = h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt) : null;
              const daysLeft = expDate ? Math.ceil((expDate.getTime() - now) / 86400000) : null;
              const isExpired = daysLeft !== null && daysLeft < 0;
              const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

              return (
                <div key={h.id}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer group hover:bg-white/3 transition-all duration-100"
                  onClick={() => setLocation(`/hospitals/${h.id}`)}>

                  {/* Initial avatar */}
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{h.name[0]?.toUpperCase()}</span>
                  </div>

                  {/* Name + username */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{h.username}</p>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={h.subscriptionStatus} active={h.active} />

                  {/* Wallet balance */}
                  <div className="hidden md:flex items-center gap-1 min-w-[90px] justify-end" title="SMS wallet balance">
                    <Wallet className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    <span className={`text-sm font-semibold tabular-nums ${(h.walletBalanceKobo ?? 0) === 0 ? "text-muted-foreground/40" : (h.walletBalanceKobo ?? 0) < 50000 ? "text-amber-400" : "text-emerald-400"}`}>
                      ₦{((h.walletBalanceKobo ?? 0) / 100).toLocaleString()}
                    </span>
                  </div>

                  {/* Patient count */}
                  <div className="hidden sm:flex items-center gap-1 min-w-[70px] justify-end">
                    <Users className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    <span className="text-sm font-semibold tabular-nums text-foreground/80">{(h.patientCount ?? 0).toLocaleString()}</span>
                  </div>

                  {/* Expiry */}
                  <div className="hidden sm:block text-right min-w-[110px]">
                    {expDate ? (
                      <div>
                        <p className={`text-sm font-medium tabular-nums ${isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-muted-foreground"}`}>
                          {expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                        </p>
                        {isExpired && <p className="text-xs text-red-400/70 mt-0.5">{Math.abs(daysLeft!)}d overdue</p>}
                        {isExpiringSoon && <p className="text-xs text-amber-400/70 mt-0.5">{daysLeft}d left</p>}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Registered */}
                  <div className="hidden md:block text-right min-w-[90px]">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {new Date(h.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-border/50 px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {hospitals.length} accounts
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{filtered.filter(h => h.active && h.subscriptionStatus === "active").length} active</span>
              <span>{filtered.filter(h => h.subscriptionStatus === "trial").length} trial</span>
              <span>{filtered.filter(h => isSuspended(h)).length} suspended</span>
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
