import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "@/components/layout";
import { get, patch } from "@/lib/api";
import {
  MessageCircle, Loader2, CheckCircle2, Clock,
  Send, RefreshCw, AlertCircle, Bot, User, ChevronLeft,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface TicketSummary {
  id: number;
  hospital_id: number;
  hospital_name: string;
  subject: string;
  status: "open" | "active" | "escalated" | "closed";
  created_at: string;
  last_message: { sender: string; preview: string; created_at: string } | null;
}

interface Message {
  id: number;
  sender: "hospital" | "ai" | "admin";
  message: string;
  created_at: string;
}

interface Thread {
  ticket: TicketSummary;
  messages: Message[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "closed")    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400">Resolved</span>;
  if (status === "escalated") return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Needs you</span>;
  if (status === "active")    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-400">AI handling</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Open</span>;
}

function SenderLabel({ sender }: { sender: string }) {
  if (sender === "ai")    return <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 mb-1"><Bot className="w-3 h-3" />Era Support AI</span>;
  if (sender === "admin") return <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mb-1"><User className="w-3 h-3" />You (Admin)</span>;
  return null;
}

export default function SupportInbox() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"escalated" | "all" | "closed">("escalated");
  const [selected, setSelected] = useState<Thread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try { setTickets(await get<TicketSummary[]>("/super-admin/support/tickets")); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  const openThread = async (ticketId: number) => {
    setLoadingThread(true);
    try {
      const data = await get<Thread>(`/super-admin/support/tickets/${ticketId}/messages`);
      setSelected(data);
      setReply("");
      setError("");
    } finally {
      setLoadingThread(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    setError("");
    try {
      await patch(`/super-admin/support/tickets/${selected.ticket.id}/reply`, { message: reply.trim() });
      setReply("");
      await openThread(selected.ticket.id);
      fetchTickets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };

  const filtered = tickets.filter(t =>
    filter === "all" ? true :
    filter === "closed" ? t.status === "closed" :
    t.status === "escalated"
  );

  const escalatedCount = tickets.filter(t => t.status === "escalated").length;

  return (
    <Layout breadcrumb={[{ label: "Support" }]}>
      <div className="flex gap-6 h-[calc(100vh-8rem)]">

        {/* ── Ticket list ──────────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold">Support Inbox</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {escalatedCount > 0 ? `${escalatedCount} need${escalatedCount === 1 ? "s" : ""} your attention` : "All caught up"}
              </p>
            </div>
            <button onClick={fetchTickets} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1.5">
            {(["escalated", "all", "closed"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize flex items-center gap-1 ${
                  filter === f ? "bg-primary/15 text-foreground" : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
                }`}>
                {f === "escalated" && escalatedCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center">{escalatedCount}</span>
                )}
                {f === "escalated" ? "Needs me" : f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tickets here</p>
              </div>
            ) : filtered.map(t => (
              <button key={t.id} onClick={() => openThread(t.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected?.ticket.id === t.id
                    ? "border-primary/40 bg-primary/8"
                    : t.status === "escalated"
                    ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/8"
                    : "border-border bg-card hover:bg-white/3"
                }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{t.subject}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs font-medium text-muted-foreground/80">{t.hospital_name}</p>
                {t.last_message && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {t.last_message.sender === "hospital" ? "Hospital: " : t.last_message.sender === "ai" ? "AI: " : "You: "}
                    {t.last_message.preview}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/50 mt-1">{formatDistanceToNow(parseISO(t.created_at), { addSuffix: true })}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Thread ───────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          {!selected && !loadingThread ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <MessageCircle className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a ticket to view the conversation</p>
            </div>
          ) : loadingThread ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected && (
            <>
              {/* Thread header */}
              <div className="px-5 py-3.5 border-b border-border shrink-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{selected.ticket.hospital_name}</p>
                </div>
                <StatusBadge status={selected.ticket.status} />
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {selected.messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === "hospital" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender === "hospital"
                        ? "bg-muted rounded-bl-sm"
                        : msg.sender === "ai"
                        ? "bg-blue-500/10 border border-blue-500/20 rounded-br-sm"
                        : "bg-primary/15 border border-primary/20 rounded-br-sm"
                    }`}>
                      <SenderLabel sender={msg.sender} />
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right">
                        {formatDistanceToNow(parseISO(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              {selected.ticket.status !== "closed" && (
                <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
                  {selected.ticket.status === "escalated" && (
                    <p className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      This ticket needs your attention — the AI couldn't resolve it
                    </p>
                  )}
                  {selected.ticket.status === "active" && (
                    <p className="text-xs text-blue-400 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      AI is handling this — you can still step in and reply
                    </p>
                  )}
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Reply as Era Systems… (Enter to send)"
                      rows={3}
                      className="flex-1 text-sm rounded-xl border border-input bg-background px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      maxLength={2000}
                    />
                    <button
                      onClick={handleReply}
                      disabled={!reply.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition disabled:opacity-40 shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {selected.ticket.status === "closed" && (
                <div className="px-5 py-3 border-t border-border text-center">
                  <span className="text-xs text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ticket resolved
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
