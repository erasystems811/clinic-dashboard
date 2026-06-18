import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  MessageSquare, Mail, Phone, CheckCircle2, XCircle,
  Clock, Filter, ChevronDown, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";

interface LogEntry {
  id: number;
  patientId: number | null;
  patientName: string | null;
  automationType: string;
  channel: "sms" | "whatsapp" | "email" | string;
  status: "sent" | "failed" | "queued" | string;
  messagePreview: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const PAGE_SIZE = 100;

function friendlyType(type: string): string {
  if (type.startsWith("med_"))        return "Medication Reminder";
  if (type.startsWith("proc_"))       return "Procedure Reminder";
  if (type.startsWith("cat_visit_"))  return "Category Visit Reminder";
  if (type.startsWith("care_plan_email_")) return "Treatment Plan Email";
  if (type.startsWith("genout_"))     return "Treatment Reminder";
  if (type.startsWith("post_treatment_patient")) return "Post-Treatment Check-in";
  if (type.startsWith("care_visit_")) return "Care Visit Reminder";
  const map: Record<string, string> = {
    appointment_reminder:    "Appointment Reminder",
    appointment_no_show:     "No-show Follow-up",
    feedback_email:          "Feedback Request",
    birthday_email:          "Birthday Email",
    post_care_email:         "Wellness Email",
    post_treatment_checkin:  "Post-Treatment Check-in",
    queue_long_wait_apology: "Queue Apology",
    care_plan_notification:  "Treatment Notification",
    bulk_email_blast:        "Bulk Email",
    return_visit_reminder:   "Return Visit Reminder",
    doctor_appointment_reminder: "Doctor Appointment Reminder",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email")    return <Mail    className="w-3.5 h-3.5 text-blue-400"   />;
  if (channel === "whatsapp") return <MessageSquare className="w-3.5 h-3.5 text-green-400" />;
  return <Phone className="w-3.5 h-3.5 text-amber-400" />;
}

function StatusBadge({ status, errorMessage }: { status: string; errorMessage: string | null }) {
  const isDnd = errorMessage?.includes("DND") || errorMessage?.includes("dnd");
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-3 h-3" /> Sent
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
        <XCircle className="w-3 h-3" /> {isDnd ? "DND Blocked" : "Failed"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      <Clock className="w-3 h-3" /> Queued
    </span>
  );
}

export default function MessageLog() {
  const { hospital } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [statusFilter, setStatusFilter]  = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [applied, setApplied] = useState<{ status: string; channel: string; from: string; to: string }>({ status: "", channel: "", from: "", to: "" });

  const fetchEntries = useCallback(async (offset: number, filters: typeof applied): Promise<LogEntry[]> => {
    if (!hospital?.token) return [];
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (filters.status)  params.set("status",  filters.status);
    if (filters.channel) params.set("channel", filters.channel);
    if (filters.from)    params.set("from",    filters.from);
    if (filters.to)      params.set("to",      filters.to);
    const res = await fetch(apiUrl(`/api/hospital/automation-log?${params}`), {
      headers: { "x-hospital-token": hospital.token },
    });
    if (!res.ok) return [];
    return res.json();
  }, [hospital]);

  const load = useCallback(async (filters: typeof applied) => {
    setLoading(true);
    const data = await fetchEntries(0, filters);
    setEntries(data);
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }, [fetchEntries]);

  useEffect(() => { load(applied); }, [load, applied]);

  const applyFilters = () => {
    setApplied({ status: statusFilter, channel: channelFilter, from, to });
  };
  const clearFilters = () => {
    setStatusFilter(""); setChannelFilter(""); setFrom(""); setTo("");
    setApplied({ status: "", channel: "", from: "", to: "" });
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const more = await fetchEntries(entries.length, applied);
    setEntries(prev => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const hasFilters = applied.status || applied.channel || applied.from || applied.to;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Message Log</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All automated messages sent to patients — SMS, WhatsApp, and email.</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filter
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed / DND</option>
              <option value="queued">Queued</option>
            </select>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All channels</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 text-sm" placeholder="From" />
            <Input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="h-9 text-sm" placeholder="To" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters}>Apply</Button>
            {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>}
          </div>
        </div>

        {/* Log list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No messages found{hasFilters ? " for the selected filters" : ""}.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map(entry => (
                <div key={entry.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Channel icon */}
                    <div className="mt-0.5 shrink-0">
                      <ChannelIcon channel={entry.channel} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {entry.patientName ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{friendlyType(entry.automationType)}</span>
                        <StatusBadge status={entry.status} errorMessage={entry.errorMessage} />
                      </div>

                      {entry.messagePreview && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">
                          {entry.messagePreview}
                        </p>
                      )}

                      {entry.status === "failed" && entry.errorMessage && (
                        <p className="text-xs text-destructive mt-0.5 truncate max-w-xl">
                          {entry.errorMessage}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {format(new Date(entry.createdAt), "d MMM, h:mm a")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div className="px-4 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="w-full gap-2">
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
