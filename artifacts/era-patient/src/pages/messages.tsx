import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import {
  MessageSquare, Wifi, WifiOff, RefreshCw, CheckCheck,
  User, Phone, Clock, Tag, Inbox,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Category = "queue" | "appointment" | "care" | "treatment" | "general" | "wellness";

interface WaMessage {
  id: number;
  patientName: string | null;
  patientPhone: string;
  messageBody: string;
  category: Category;
  read: boolean;
  receivedAt: string;
  waMessageId: string | null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  queue:       "Queue",
  appointment: "Appointment",
  care:        "Care",
  treatment:   "Treatment",
  general:     "General",
  wellness:    "Wellness",
};

const CATEGORY_COLORS: Record<Category, string> = {
  queue:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  appointment: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  care:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  treatment:   "bg-teal-500/10 text-teal-400 border-teal-500/20",
  general:     "bg-muted text-muted-foreground border-border",
  wellness:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
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

function roleTitle(role: string): string {
  if (role === "receptionist") return "Queue & Appointment Replies";
  if (role === "nurse") return "Care & Treatment Replies";
  return "All Patient Replies";
}

function roleDescription(role: string): string {
  if (role === "receptionist") return "Patient replies related to queue positions and appointments";
  if (role === "nurse") return "Patient replies related to care plans and treatment check-ins";
  return "All inbound WhatsApp replies from patients across every category";
}

export default function Messages() {
  const { hospital, user } = useAuth();
  const role = user?.role ?? "admin";

  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!hospital?.token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, ...(unreadOnly ? { unread: "true" } : {}) });
      const res = await fetch(`${BASE}/api/messages?${params}`, {
        headers: { "x-hospital-token": hospital.token },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [hospital?.token, role, unreadOnly]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const markAllRead = async () => {
    if (!hospital?.token) return;
    setMarkingAll(true);
    try {
      await fetch(`${BASE}/api/messages/read-all?role=${role}`, {
        method: "PATCH",
        headers: { "x-hospital-token": hospital.token },
      });
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  const markRead = async (id: number) => {
    if (!hospital?.token) return;
    try {
      await fetch(`${BASE}/api/messages/${id}/read`, {
        method: "PATCH",
        headers: { "x-hospital-token": hospital.token },
      });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    } catch {
      /* ignore */
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{roleDescription(role)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                unreadOnly
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              Unread only
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={fetchMessages}
              disabled={loading}
              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* WhatsApp connection banner */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-amber-500/10 shrink-0">
            <WifiOff className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">WhatsApp Business API not connected</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              This inbox is ready and will automatically display patient replies once the Meta WhatsApp Business API is configured.
              Messages will be categorised by context so each role only sees what's relevant to them.
            </p>
          </div>
          <div className="shrink-0 text-xs text-amber-500/60 font-mono mt-0.5">Coming soon</div>
        </div>

        {/* Role scope info */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="w-4 h-4" />
            <span className="font-medium text-foreground">{roleTitle(role)}</span>
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            {Object.entries(CATEGORY_LABELS)
              .filter(([cat]) => {
                if (role === "receptionist") return ["queue", "appointment"].includes(cat);
                if (role === "nurse") return ["care", "treatment"].includes(cat);
                return true;
              })
              .map(([cat, label]) => (
                <span
                  key={cat}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[cat as Category]}`}
                >
                  {label}
                </span>
              ))}
          </div>
        </div>

        {/* Message list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Inbox className="w-7 h-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Patient replies will appear here once WhatsApp Business API is connected
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 px-4 py-2 rounded-lg bg-muted border border-border">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Inbox ready — awaiting WhatsApp connection</span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => { if (!msg.read) markRead(msg.id); }}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-default ${
                    !msg.read
                      ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="mt-1.5 shrink-0">
                    {!msg.read
                      ? <div className="w-2 h-2 rounded-full bg-primary" />
                      : <div className="w-2 h-2 rounded-full bg-transparent" />
                    }
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${!msg.read ? "text-foreground" : "text-foreground/80"}`}>
                        {msg.patientName ?? "Unknown Patient"}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[msg.category]}`}>
                        {CATEGORY_LABELS[msg.category]}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed line-clamp-2 ${!msg.read ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {msg.messageBody}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {msg.patientPhone}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {timeAgo(msg.receivedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it will work */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">How the inbox works when connected</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground">
            {[
              {
                icon: MessageSquare,
                title: "Inbound replies captured",
                desc: "When a patient replies to an automated WhatsApp message, it's captured via the Meta webhook and stored here in real time.",
              },
              {
                icon: Tag,
                title: "Auto-categorised by context",
                desc: "Replies are tagged based on the original message context — queue updates, appointment reminders, care check-ins, or treatment follow-ups.",
              },
              {
                icon: User,
                title: "Role-filtered views",
                desc: "Receptionists see queue and appointment replies. Nurses see care and treatment replies. Admins see everything.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-0.5">{title}</p>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
