import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { get, post } from "@/lib/api";
import { Loader2, RefreshCw, MessageSquare, AlertCircle, Send } from "lucide-react";
import { formatDistanceToNow, parseISO, isThisMonth } from "date-fns";

type BroadcastState = "idle" | "confirming" | "sending" | "sent" | "error";

interface HospitalFeedback {
  id: number;
  hospital_id: number;
  hospital_name: string;
  user_role: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const RATINGS = [
  { value: 5, emoji: "😍", label: "Amazing" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 1, emoji: "😫", label: "Terrible" },
];

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
  const [entries, setEntries] = useState<HospitalFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [broadcastState, setBroadcastState] = useState<BroadcastState>("idle");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true); setError("");
    try { setEntries(await get<HospitalFeedback[]>("/system-feedback")); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleBroadcast = async () => {
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

  const total = entries.length;
  const avg   = total ? (entries.reduce((s, e) => s + e.rating, 0) / total).toFixed(1) : "—";
  const month = entries.filter(e => { try { return isThisMonth(parseISO(e.created_at)); } catch { return false; } }).length;
  const breakdown = RATINGS.map(r => {
    const count = entries.filter(e => e.rating === r.value).length;
    return { ...r, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  return (
    <Layout>
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs font-semibold text-primary/70 mb-1">Era Platform</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Hospital Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">Ratings from hospital staff</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end mt-1">
          <button onClick={fetchEntries} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {broadcastState === "confirming" ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
              <span className="text-muted-foreground">Push to hospitals?</span>
              <button onClick={() => void handleBroadcast()} className="font-semibold text-primary hover:opacity-80">Yes</button>
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
        </div>
      </div>

      {broadcastMsg && (
        <div className={`flex items-center gap-2 text-sm mb-5 p-3 rounded-lg border ${broadcastState === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
          <AlertCircle className="w-4 h-4 shrink-0" />{broadcastMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total responses" value={loading ? null : total} />
        <StatCard label="Average rating" value={loading ? null : avg} suffix="/ 5" highlight />
        <StatCard label="This month" value={loading ? null : month} />
      </div>

      <div className="border border-border bg-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Rating breakdown</h2>
        <div className="space-y-3">
          {breakdown.map(r => (
            <div key={r.value} className="flex items-center gap-3">
              <span className="text-xl w-7 shrink-0 leading-none">{r.emoji}</span>
              <span className="text-xs text-muted-foreground w-14 shrink-0">{r.label}</span>
              <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: loading ? "0%" : `${r.pct}%` }} />
              </div>
              <span className="text-sm font-bold text-foreground w-6 text-right tabular-nums shrink-0">{loading ? "—" : r.count}</span>
              <span className="text-xs text-muted-foreground w-10 text-right tabular-nums shrink-0">{loading ? "" : `${r.pct}%`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border bg-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">All responses</h2>
          {!loading && total > 0 && <span className="text-xs text-muted-foreground">{total} total</span>}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
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
                {entries.map(e => {
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
    </Layout>
  );
}
