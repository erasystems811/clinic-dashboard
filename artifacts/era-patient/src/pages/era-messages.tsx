import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { format, isToday, isYesterday } from "date-fns";

interface Convo {
  connectionId: number;
  patientId: number;
  patientName: string;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageAt: string;
  unread: number;
}

interface Message {
  id: number;
  sender: "patient" | "hospital";
  content: string;
  createdAt: string;
}

interface Thread {
  connectionId: number;
  patientName: string;
  messages: Message[];
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

function fullTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, h:mm a");
}

function initials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function EraMessagesPage() {
  const { hospital } = useAuth();
  const token = hospital?.token ?? "";

  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const headers = { "x-hospital-token": token };

  async function loadConvos() {
    const r = await fetch(apiUrl("/api/era-messages"), { headers });
    if (r.ok) setConvos(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    loadConvos();
    const id = setInterval(loadConvos, 15_000);
    return () => clearInterval(id);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openThread(convo: Convo) {
    setLoadingThread(true);
    setSelected(null);
    const r = await fetch(apiUrl(`/api/era-messages/${convo.connectionId}`), { headers });
    if (r.ok) {
      const data = await r.json();
      setSelected(data);
      // Mark as read
      await fetch(apiUrl(`/api/era-messages/${convo.connectionId}/read`), { method: "POST", headers });
      setConvos(prev => prev.map(c => c.connectionId === convo.connectionId ? { ...c, unread: 0 } : c));
    }
    setLoadingThread(false);
  }

  useEffect(() => {
    if (selected) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const r = await fetch(apiUrl(`/api/era-messages/${selected.connectionId}/send`), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply.trim() }),
    });
    if (r.ok) {
      const msg = await r.json();
      setSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setReply("");
    }
    setSending(false);
  }

  // Refresh thread in background while open
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(async () => {
      const r = await fetch(apiUrl(`/api/era-messages/${selected.connectionId}`), { headers });
      if (r.ok) {
        const data = await r.json();
        setSelected(data);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [selected?.connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Conversation list ─────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-border bg-background shrink-0 ${selected ? "hidden md:flex w-72" : "flex w-full md:w-72"}`}>
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            ERA App Messages
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Messages from patients on the ERA app</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <MessageSquare className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/60">Messages from patients using the ERA app will appear here</p>
            </div>
          ) : (
            convos.map(c => (
              <button
                key={c.connectionId}
                onClick={() => openThread(c)}
                className={`w-full text-left px-4 py-3.5 border-b border-border transition hover:bg-sidebar-accent/40 ${selected?.connectionId === c.connectionId ? "bg-sidebar-accent/60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(c.patientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-sm truncate ${c.unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {c.patientName}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeLabel(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${c.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {c.lastMessageSender === "hospital" ? "You: " : ""}{c.lastMessage}
                      </p>
                      {c.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Thread view ───────────────────────────────────────────── */}
      {loadingThread ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 shrink-0">
            <button onClick={() => setSelected(null)} className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/50 text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {initials(selected.patientName)}
            </div>
            <div>
              <p className="text-sm font-semibold">{selected.patientName}</p>
              <p className="text-xs text-muted-foreground">ERA App conversation</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {selected.messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === "hospital" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.sender === "hospital"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-sidebar-accent text-foreground rounded-bl-sm"
                }`}>
                  <p>{m.content}</p>
                  <p className={`text-[10px] mt-1 ${m.sender === "hospital" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {fullTime(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary transition"
                style={{ maxHeight: 100 }}
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition disabled:opacity-40"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Patient will see your reply in the ERA app</p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-center px-8">
          <MessageSquare className="w-12 h-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
