import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/layout";
import { get, patch } from "@/lib/api";
import {
  MessageCircle, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Send, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface Ticket {
  id: number;
  hospital_id: number;
  hospital_name: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  reply: string | null;
  replied_at: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400">
        <CheckCircle2 className="w-3 h-3" /> Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-400">
      <Clock className="w-3 h-3" /> Open
    </span>
  );
}

function TicketRow({ ticket, onReplied }: { ticket: Ticket; onReplied: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      await patch(`/super-admin/support/tickets/${ticket.id}/reply`, { reply: reply.trim() });
      setReply("");
      onReplied();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/3 transition"
      >
        <MessageCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{ticket.subject}</span>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ticket.hospital_name} · {formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Message from {ticket.hospital_name}</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
          </div>

          {ticket.reply && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-emerald-400 font-medium mb-1">Your reply · {ticket.replied_at ? formatDistanceToNow(parseISO(ticket.replied_at), { addSuffix: true }) : ""}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.reply}</p>
            </div>
          )}

          {ticket.status === "open" && (
            <form onSubmit={handleReply} className="space-y-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Type your reply… (will be emailed to the hospital)"
                rows={3}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                required
                maxLength={2000}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportInbox() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<Ticket[]>("/super-admin/support/tickets");
      setTickets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filtered = tickets.filter(t => filter === "all" ? true : t.status === filter);
  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <Layout breadcrumb={[{ label: "Support" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Support Inbox</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {openCount > 0 ? `${openCount} open ticket${openCount > 1 ? "s" : ""}` : "All tickets resolved"}
            </p>
          </div>
          <button
            onClick={fetchTickets}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          {(["open", "all", "closed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
                filter === f
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} tickets</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ticket => (
              <TicketRow key={ticket.id} ticket={ticket} onReplied={fetchTickets} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
