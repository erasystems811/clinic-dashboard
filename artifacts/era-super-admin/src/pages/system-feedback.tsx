import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { get, post } from "@/lib/api";
import { Loader2, RefreshCw, MessageSquare, AlertCircle, Send, Building2, Smartphone } from "lucide-react";
import { formatDistanceToNow, parseISO, isThisMonth } from "date-fns";

type BroadcastState = "idle" | "confirming" | "sending" | "sent" | "error";
type Tab = "hospital" | "patient";

interface HospitalFeedback {
  id: number;
  hospital_id: number;
  hospital_name: string;
  user_role: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface PatientFeedback {
  id: number;
  username: string;
  rating: number | null;
  category: "general" | "bug" | "feature" | "praise";
  message: string;
  created_at: string;
}

interface PatientFeedbackPage {
  items: PatientFeedback[];
  total: number;
  page: number;
  limit: number;
}

const RATINGS = [
  { value: 5, emoji: "😍", label: "Amazing" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 1, emoji: "😫", label: "Terrible" },
];

const CATEGORIES: Record<PatientFeedback["category"], { label: string; color: string }> = {
  praise:  { label: "Love it",     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  general: { label: "General",     color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  feature: { label: "Feature idea",color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  bug:     { label: "Bug report",  color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "nurse") return "Nurse";
  if (role === "receptionist") return "Receptionist";
  return role;
}

function StatCard({ label, value, suffix, highlight }: { label: string; value: string | number | null; suffix?: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-xl p-5 ${highlight ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
      <p className="text-xs font-semibold text-muted-foreground mb-3">{label}</p>
      {value === null ? (
        <div className="h-9 w-16 bg-muted/60 animate-pulse rounded-lg" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-bold tabular-nums leading-none ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      )}
    </div>
  );
}

export default function SystemFeedbackPage() {
  const [tab, setTab] = useState<Tab>("hospital");

  // ── Hospital staff ─────────────────────────────────────────────────────────
  const [staffEntries, setStaffEntries] = useState<HospitalFeedback[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [broadcastState, setBroadcastState] = useState<BroadcastState>("idle");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true); setStaffError("");
    try { setStaffEntries(await get<HospitalFeedback[]>("/system-feedback")); }
    catch (e: unknown) { setStaffError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setStaffLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleStaffBroadcast = async () => {
    setBroadcastState("sending");
    try {
      await post("/system-feedback/broadcast", {});
      setBroadcastMsg("Popup queued — all logged-in hospital users will see it within 5 minutes.");
      setBroadcastState("sent");
    } catch (e: unknown) {
      setBroadcastMsg(e instanceof Error ? e.message : "Failed");
      setBroadcastState("error");
    } finally {
      setTimeout(() => { setBroadcastState("idle"); setBroadcastMsg(""); }, 6000);
    }
  };

  // ── Patient app ────────────────────────────────────────────────────────────
  const [patientData, setPatientData] = useState<PatientFeedbackPage | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [patientPage, setPatientPage] = useState(1);
  const [patientBroadcastState, setPatientBroadcastState] = useState<BroadcastState>("idle");
  const [patientBroadcastMsg, setPatientBroadcastMsg] = useState("");

  const fetchPatient = useCallback(async (page = 1) => {
    setPatientLoading(true); setPatientError("");
    try {
      const data = await get<PatientFeedbackPage>(`/super-admin/patient-feedback?page=${page}`);
      setPatientData(data);
      setPatientPage(page);
    } catch (e: unknown) {
      setPatientError(e instanceof Error ? e.message : "Failed to load");
    } finally { setPatientLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "patient" && !patientData) fetchPatient(1);
  }, [tab, patientData, fetchPatient]);

  const handlePatientBroadcast = async () => {
    setPatientBroadcastState("sending");
    try {
      await post("/super-admin/patient-feedback/broadcast", {});
      setPatientBroadcastMsg("Nudge queued — ERA-me users will see it on next app open.");
      setPatientBroadcastState("sent");
    } catch (e: unknown) {
      setPatientBroadcastMsg(e instanceof Error ? e.message : "Failed");
      setPatientBroadcastState("error");
    } finally {
      setTimeout(() => { setPatientBroadcastState("idle"); setPatientBroadcastMsg(""); }, 6000);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const staffTotal = staffEntries.length;
  const staffAvg   = staffTotal ? (staffEntries.reduce((s, e) => s + e.rating, 0) / staffTotal).toFixed(1) : "—";
  const staffMonth = staffEntries.filter(e => { try { return isThisMonth(parseISO(e.created_at)); } catch { return false; } }).length;
  const staffBreakdown = RATINGS.map(r => {
    const count = staffEntries.filter(e => e.rating === r.value).length;
    return { ...r, count, pct: staffTotal ? Math.round((count / staffTotal) * 100) : 0 };
  });

  const pItems      = patientData?.items ?? [];
  const patientTotal = patientData?.total ?? 0;
  const ratedItems  = pItems.filter(e => e.rating != null);
  const patientAvg  = ratedItems.length ? (ratedItems.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedItems.length).toFixed(1) : "—";
  const patientMonth = pItems.filter(e => { try { return isThisMonth(parseISO(e.created_at)); } catch { return false; } }).length;
  const patientBreakdown = RATINGS.map(r => {
    const count = pItems.filter(e => e.rating === r.value).length;
    return { ...r, count, pct: ratedItems.length ? Math.round((count / ratedItems.length) * 100) : 0 };
  });
  const totalPages = patientData ? Math.ceil(patientData.total / patientData.limit) : 1;

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1">Era Platform</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">Ratings and responses from staff and patients</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {tab === "hospital" ? (
            <>
              <button onClick={fetchStaff} disabled={staffLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${staffLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {broadcastState === "confirming" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
                  <span className="text-muted-foreground">Push to hospitals?</span>
                  <button onClick={handleStaffBroadcast} className="font-semibold text-primary hover:opacity-80">Yes</button>
                  <button onClick={() => setBroadcastState("idle")} className="text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button onClick={() => broadcastState === "idle" && setBroadcastState("confirming")} disabled={broadcastState === "sending"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                    broadcastState === "sent" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : broadcastState === "error" ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"}`}>
                  {broadcastState === "sending" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {broadcastState === "sent" ? "Sent!" : broadcastState === "error" ? "Failed" : "Push to hospitals"}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => fetchPatient(patientPage)} disabled={patientLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${patientLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {patientBroadcastState === "confirming" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
                  <span className="text-muted-foreground">Push to ERA-me users?</span>
                  <button onClick={handlePatientBroadcast} className="font-semibold text-violet-400 hover:opacity-80">Yes</button>
                  <button onClick={() => setPatientBroadcastState("idle")} className="text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button onClick={() => patientBroadcastState === "idle" && setPatientBroadcastState("confirming")} disabled={patientBroadcastState === "sending"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                    patientBroadcastState === "sent" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : patientBroadcastState === "error" ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/15"}`}>
                  {patientBroadcastState === "sending" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {patientBroadcastState === "sent" ? "Sent!" : patientBroadcastState === "error" ? "Failed" : "Push nudge to ERA-me"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-6 w-fit">
        <button onClick={() => setTab("hospital")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "hospital" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Building2 className="w-3.5 h-3.5" />Hospital Staff
        </button>
        <button onClick={() => setTab("patient")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "patient" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Smartphone className="w-3.5 h-3.5" />ERA-me Patients
          {patientData && patientData.total > 0 && (
            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
              {patientData.total}
            </span>
          )}
        </button>
      </div>

      {/* ── Status banners ── */}
      {broadcastMsg && tab === "hospital" && (
        <div className={`flex items-center gap-2 text-sm mb-5 p-3 rounded-lg border ${broadcastState === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
          <AlertCircle className="w-4 h-4 shrink-0" />{broadcastMsg}
        </div>
      )}
      {patientBroadcastMsg && tab === "patient" && (
        <div className={`flex items-center gap-2 text-sm mb-5 p-3 rounded-lg border ${patientBroadcastState === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-violet-400 bg-violet-500/10 border-violet-500/20"}`}>
          <AlertCircle className="w-4 h-4 shrink-0" />{patientBroadcastMsg}
        </div>
      )}

      {/* ══════════════ HOSPITAL STAFF TAB ══════════════ */}
      {tab === "hospital" && (
        <>
          {staffError && (
            <div className="flex items-center gap-2 text-sm text-red-400 mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />{staffError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total responses" value={staffLoading ? null : staffTotal} />
            <StatCard label="Average rating" value={staffLoading ? null : staffAvg} suffix="/ 5" highlight />
            <StatCard label="This month" value={staffLoading ? null : staffMonth} />
          </div>

          <div className="border border-border bg-card rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Rating breakdown</h2>
            <div className="space-y-3">
              {staffBreakdown.map(r => (
                <div key={r.value} className="flex items-center gap-3">
                  <span className="text-xl w-7 shrink-0 leading-none">{r.emoji}</span>
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: staffLoading ? "0%" : `${r.pct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-foreground w-6 text-right tabular-nums shrink-0">{staffLoading ? "—" : r.count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums shrink-0">{staffLoading ? "" : `${r.pct}%`}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">All responses</h2>
              {!staffLoading && staffTotal > 0 && <span className="text-xs text-muted-foreground">{staffTotal} total</span>}
            </div>
            {staffLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : staffEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">No feedback yet</p>
                <p className="text-xs opacity-60">Responses appear here once hospital staff start rating</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Hospital</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Role</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Rating</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Comment</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffEntries.map(e => {
                      const r = RATINGS.find(x => x.value === e.rating) ?? RATINGS[2];
                      return (
                        <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{e.hospital_name}</td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{roleLabel(e.user_role)}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-base leading-none">{r.emoji}</span>
                              <span className="font-bold text-foreground tabular-nums">{e.rating}</span>
                              <span className="text-xs text-muted-foreground">/5</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground max-w-xs">
                            {e.comment ? <span className="line-clamp-2">{e.comment}</span> : <span className="opacity-30">—</span>}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ ERA-ME PATIENTS TAB ══════════════ */}
      {tab === "patient" && (
        <>
          {patientError && (
            <div className="flex items-center gap-2 text-sm text-red-400 mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />{patientError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total responses" value={patientLoading ? null : patientTotal} />
            <StatCard label="Average rating" value={patientLoading ? null : patientAvg} suffix="/ 5" highlight />
            <StatCard label="This page / month" value={patientLoading ? null : patientMonth} />
          </div>

          {/* Rating breakdown */}
          <div className="border border-border bg-card rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Rating breakdown</h2>
            <div className="space-y-3">
              {patientBreakdown.map(r => (
                <div key={r.value} className="flex items-center gap-3">
                  <span className="text-xl w-7 shrink-0 leading-none">{r.emoji}</span>
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500/60 rounded-full transition-all duration-500" style={{ width: patientLoading ? "0%" : `${r.pct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-foreground w-6 text-right tabular-nums shrink-0">{patientLoading ? "—" : r.count}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums shrink-0">{patientLoading ? "" : `${r.pct}%`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response table */}
          <div className="border border-border bg-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">All responses</h2>
              {!patientLoading && patientTotal > 0 && (
                <span className="text-xs text-muted-foreground">{patientTotal} total · page {patientPage} of {totalPages}</span>
              )}
            </div>

            {patientLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : pItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">No patient feedback yet</p>
                <p className="text-xs opacity-60">Use the push button to prompt users, or wait for organic responses</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">User</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Category</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Rating</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Message</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pItems.map(e => {
                        const r = e.rating != null ? RATINGS.find(x => x.value === e.rating) : null;
                        const cat = CATEGORIES[e.category] ?? CATEGORIES.general;
                        return (
                          <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">@{e.username}</td>
                            <td className="px-3 py-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>{cat.label}</span>
                            </td>
                            <td className="px-3 py-3">
                              {r ? (
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-base leading-none">{r.emoji}</span>
                                  <span className="font-bold text-foreground tabular-nums">{e.rating}</span>
                                  <span className="text-xs text-muted-foreground">/5</span>
                                </span>
                              ) : <span className="text-muted-foreground opacity-30">—</span>}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground max-w-sm">
                              <span className="line-clamp-2">{e.message}</span>
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(parseISO(e.created_at), { addSuffix: true })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-5 py-4 border-t border-border flex items-center justify-between">
                    <button onClick={() => fetchPatient(patientPage - 1)} disabled={patientPage <= 1 || patientLoading}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      ← Previous
                    </button>
                    <span className="text-xs text-muted-foreground">Page {patientPage} of {totalPages}</span>
                    <button onClick={() => fetchPatient(patientPage + 1)} disabled={patientPage >= totalPages || patientLoading}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
