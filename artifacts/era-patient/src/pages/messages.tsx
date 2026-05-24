import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import {
  MessageSquare, WifiOff, RefreshCw, Send, User,
  Phone, Clock, ChevronLeft, Inbox, Wifi,
} from "lucide-react";

import { apiUrl } from "@/lib/api";

type Category = "queue" | "appointment" | "care" | "treatment" | "general" | "wellness";

interface Conversation {
  phone: string;
  patientName: string | null;
  patientId: number | null;
  latestMessage: string;
  latestAt: string;
  latestDirection: string;
  unreadCount: number;
  category: Category;
}

interface ThreadMessage {
  id: number;
  patientPhone: string;
  patientName: string | null;
  messageBody: string;
  direction: "inbound" | "outbound";
  category: Category;
  read: boolean;
  receivedAt: string;
}

const CATEGORY_COLORS: Record<Category, string> = {
  queue:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  appointment: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  care:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  treatment:   "bg-teal-500/10 text-teal-400 border-teal-500/20",
  general:     "bg-muted text-muted-foreground border-border",
  wellness:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const CATEGORY_LABELS: Record<Category, string> = {
  queue: "Queue", appointment: "Appointment", care: "Care",
  treatment: "Treatment", general: "General", wellness: "Wellness",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function roleDescription(role: string): string {
  if (role === "receptionist") return "Queue & appointment replies";
  if (role === "nurse") return "Care & treatment replies";
  return "All patient replies";
}

export default function Messages() {
  const { hospital, user } = useAuth();
  const role = user?.role ?? "admin";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!hospital?.token) return;
    setLoadingConvs(true);
    try {
      const res = await fetch(apiUrl(`/api/messages/conversations?role=${role}`), {
        headers: { "x-hospital-token": hospital.token },
      });
      if (res.ok) setConversations(await res.json());
    } catch { /* ignore */ }
    finally { setLoadingConvs(false); }
  }, [hospital?.token, role]);

  const fetchThread = useCallback(async (conv: Conversation) => {
    if (!hospital?.token) return;
    setLoadingThread(true);
    setThread([]);
    try {
      const res = await fetch(
        apiUrl(`/api/messages/thread?phone=${encodeURIComponent(conv.phone)}`),
        { headers: { "x-hospital-token": hospital.token } },
      );
      if (res.ok) {
        const data: ThreadMessage[] = await res.json();
        setThread(data);
        // Clear unread badge in local state
        setConversations(prev =>
          prev.map(c => c.phone === conv.phone ? { ...c, unreadCount: 0 } : c)
        );
      }
    } catch { /* ignore */ }
    finally { setLoadingThread(false); }
  }, [hospital?.token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const openConversation = (conv: Conversation) => {
    setSelected(conv);
    setReplyText("");
    fetchThread(conv);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected || !hospital?.token) return;
    setSending(true);
    const body = replyText.trim();
    setReplyText("");
    try {
      const res = await fetch(apiUrl(`/api/messages/reply`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hospital-token": hospital.token,
        },
        body: JSON.stringify({
          phone:       selected.phone,
          body,
          patientName: selected.patientName ?? undefined,
          patientId:   selected.patientId ?? undefined,
          category:    selected.category,
        }),
      });
      if (res.ok) {
        const msg: ThreadMessage = await res.json();
        setThread(prev => [...prev, msg]);
        // Update conversation preview
        setConversations(prev =>
          prev.map(c => c.phone === selected.phone
            ? { ...c, latestMessage: body, latestAt: msg.receivedAt, latestDirection: "outbound" }
            : c
          )
        );
      }
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // Group thread messages by date
  const groupedThread: { dateLabel: string; messages: ThreadMessage[] }[] = [];
  for (const msg of thread) {
    const label = formatDateLabel(msg.receivedAt);
    const last = groupedThread[groupedThread.length - 1];
    if (!last || last.dateLabel !== label) groupedThread.push({ dateLabel: label, messages: [msg] });
    else last.messages.push(msg);
  }

  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Page title bar */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors md:hidden"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Messages</h1>
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                    {totalUnread}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{roleDescription(role)}</p>
            </div>
          </div>
          <button
            onClick={fetchConversations}
            disabled={loadingConvs}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingConvs ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* WhatsApp not connected banner */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 mb-4 shrink-0">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400/90">
            <span className="font-semibold">WhatsApp Business API not connected.</span>
            {" "}Replies are queued and will deliver automatically once Meta verification is complete.
          </p>
        </div>

        {/* Two-panel inbox */}
        <div className="flex flex-1 min-h-0 rounded-xl border border-border overflow-hidden bg-card">

          {/* LEFT — conversation list */}
          <div className={`w-72 shrink-0 border-r border-border flex flex-col ${selected ? "hidden md:flex" : "flex"}`}>
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</p>
            </div>

            {loadingConvs ? (
              <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  No messages yet. Patient replies will appear here once WhatsApp is connected.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {conversations.map((conv) => {
                  const isActive = selected?.phone === conv.phone;
                  return (
                    <button
                      key={conv.phone}
                      onClick={() => openConversation(conv)}
                      className={`w-full text-left px-4 py-3.5 transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
                              {conv.patientName ?? conv.phone}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">
                              {timeAgo(conv.latestAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate flex-1 ${conv.unreadCount > 0 ? "text-foreground/80" : "text-muted-foreground"}`}>
                              {conv.latestDirection === "outbound" && <span className="text-primary/60">You: </span>}
                              {conv.latestMessage}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[conv.category]}`}>
                            {CATEGORY_LABELS[conv.category]}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — thread + reply */}
          <div className={`flex-1 flex flex-col min-w-0 ${!selected ? "hidden md:flex" : "flex"}`}>
            {!selected ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Select a conversation</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a patient from the left to view messages and reply
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
                  <Wifi className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Ready for WhatsApp Business connection</span>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
                  <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {selected.patientName ?? selected.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{selected.phone}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[selected.category]}`}>
                        {CATEGORY_LABELS[selected.category]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {loadingThread ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : thread.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                      No messages yet
                    </div>
                  ) : (
                    groupedThread.map(({ dateLabel, messages }) => (
                      <div key={dateLabel} className="space-y-3">
                        {/* Date separator */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[11px] text-muted-foreground font-medium px-2">{dateLabel}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        {messages.map((msg) => {
                          const isOutbound = msg.direction === "outbound";
                          return (
                            <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[70%] space-y-1 ${isOutbound ? "items-end" : "items-start"} flex flex-col`}>
                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  isOutbound
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted border border-border text-foreground rounded-bl-sm"
                                }`}>
                                  {msg.messageBody}
                                </div>
                                <div className={`flex items-center gap-1.5 ${isOutbound ? "flex-row-reverse" : ""}`}>
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-[11px] text-muted-foreground">{formatTime(msg.receivedAt)}</span>
                                  {isOutbound && (
                                    <span className="text-[11px] text-muted-foreground">· Queued</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply box */}
                <div className="px-4 py-3 border-t border-border shrink-0 bg-card">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                        rows={2}
                        className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none leading-relaxed"
                      />
                    </div>
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0 mb-0.5"
                    >
                      {sending
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                    Replies are queued and will deliver via WhatsApp once the Business API is connected.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
