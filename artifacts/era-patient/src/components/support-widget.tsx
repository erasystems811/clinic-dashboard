import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, X, Send, Loader2, ChevronLeft,
  Plus, Clock, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { apiUrl, authHeader } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TicketSummary {
  id: number;
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
  ticket: { id: number; subject: string; status: string };
  messages: Message[];
}

type View = "list" | "thread" | "new";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === "closed") return { label: "Resolved", cls: "bg-emerald-500/15 text-emerald-400" };
  if (status === "escalated") return { label: "Awaiting us", cls: "bg-amber-500/15 text-amber-400" };
  if (status === "active") return { label: "In progress", cls: "bg-blue-500/15 text-blue-400" };
  return { label: "Sent", cls: "bg-muted text-muted-foreground" };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function NewTicketForm({ onCreated, onBack }: { onCreated: (ticketId: number) => void; onBack: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/support/ticket"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to send");
      }
      const d = await res.json();
      onCreated(d.ticketId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold">New Support Ticket</p>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="What do you need help with?"
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your issue in detail…"
            rows={5}
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            required maxLength={2000}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={sending || !subject.trim() || !message.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium py-2 hover:bg-primary/90 transition disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send Message"}
        </button>
      </form>
    </>
  );
}

function TicketList({
  tickets,
  loading,
  onSelect,
  onNew,
  onRefresh,
}: {
  tickets: TicketSummary[];
  loading: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <p className="text-sm font-semibold">Support</p>
          <p className="text-xs text-muted-foreground">We usually reply within minutes</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRefresh} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNew}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tickets yet</p>
            <button onClick={onNew} className="text-xs text-primary hover:underline">Send your first message →</button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map(t => {
              const badge = statusBadge(t.status);
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-sidebar-accent/40 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  {t.last_message && (
                    <p className="text-xs text-muted-foreground truncate">
                      {t.last_message.sender === "hospital" ? "You: " : "Support: "}
                      {t.last_message.preview}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(t.created_at)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ThreadView({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/support/tickets/${ticketId}/messages`), {
        headers: authHeader(),
      });
      if (res.ok) setThread(await res.json());
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchThread(); }, [fetchThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  // Poll for AI reply while status is 'open' or 'active' with no AI message yet
  useEffect(() => {
    if (!thread) return;
    const lastMsg = thread.messages[thread.messages.length - 1];
    const waitingForAI = lastMsg?.sender === "hospital" && thread.ticket.status !== "escalated" && thread.ticket.status !== "closed";
    if (!waitingForAI) { setPolling(false); return; }
    setPolling(true);
    const id = setInterval(() => fetchThread(true), 2500);
    return () => clearInterval(id);
  }, [thread, fetchThread]);

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    const text = reply.trim();
    setReply("");
    try {
      await fetch(apiUrl(`/api/support/tickets/${ticketId}/message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ message: text }),
      });
      await fetchThread(true);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isClosed = thread?.ticket.status === "closed";

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{thread?.ticket.subject ?? "Loading…"}</p>
          {thread && (
            <p className="text-[10px] text-muted-foreground capitalize">{statusBadge(thread.ticket.status).label}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {thread?.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === "hospital" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.sender === "hospital"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-sidebar-accent text-foreground rounded-bl-sm"
                }`}>
                  {msg.sender !== "hospital" && (
                    <p className="text-[10px] font-semibold mb-1 opacity-60">
                      {msg.sender === "ai" ? "Era Support" : "Era Team"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1 opacity-50 text-right`}>{timeAgo(msg.created_at)}</p>
                </div>
              </div>
            ))}

            {polling && (
              <div className="flex justify-start">
                <div className="bg-sidebar-accent rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Era Support is typing…</span>
                </div>
              </div>
            )}

            {thread?.ticket.status === "escalated" && !polling && (
              <div className="flex justify-center">
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Our team has been notified and will reply soon
                </div>
              </div>
            )}

            {isClosed && (
              <div className="flex justify-center">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Ticket resolved
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {!isClosed && (
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={2}
              className="flex-1 text-sm rounded-xl border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              maxLength={2000}
            />
            <button
              onClick={handleSend}
              disabled={!reply.trim() || sending}
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition disabled:opacity-40 shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch(apiUrl("/api/support/tickets"), { headers: authHeader() });
      if (res.ok) setTickets(await res.json());
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    if (open && view === "list") fetchTickets();
  }, [open, view, fetchTickets]);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) { setView("list"); setSelectedTicketId(null); }
  };

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    setView("thread");
  };

  const handleTicketCreated = (ticketId: number) => {
    setSelectedTicketId(ticketId);
    setView("thread");
    fetchTickets();
  };

  const hasEscalated = tickets.some(t => t.status === "escalated");
  const hasOpen = tickets.some(t => t.status === "open" || t.status === "active");
  const dotColor = hasEscalated ? "bg-amber-400" : hasOpen ? "bg-blue-400" : null;

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-96 max-h-[560px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{ animation: "supportSlideDown 0.2s ease-out", transformOrigin: "top right" }}
        >
          {view === "list" && (
            <TicketList
              tickets={tickets}
              loading={loadingTickets}
              onSelect={handleSelectTicket}
              onNew={() => setView("new")}
              onRefresh={fetchTickets}
            />
          )}
          {view === "new" && (
            <NewTicketForm
              onCreated={handleTicketCreated}
              onBack={() => setView("list")}
            />
          )}
          {view === "thread" && selectedTicketId !== null && (
            <ThreadView
              ticketId={selectedTicketId}
              onBack={() => { setView("list"); fetchTickets(); }}
            />
          )}
        </div>
      )}

      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center relative"
        title="Contact Support"
        aria-label="Contact Support"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!open && dotColor && (
          <span className={`absolute top-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-card ${dotColor}`} />
        )}
      </button>
    </>
  );
}
