import { useState } from "react";
import { ArrowLeft, Bell, Star } from "lucide-react";
import { useLocation } from "wouter";
import {
  useNotifications,
  useMarkNotifRead,
  useActionNotif,
  type PatientNotification,
} from "@/lib/hospitals-api";

export default function NotificationsPage() {
  const [_, navigate] = useLocation();
  const { data: notifs = [], isLoading } = useNotifications();
  const markRead = useMarkNotifRead();

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => window.history.back()} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--text-sub)" }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-main)" }}>Notifications</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: "var(--text-sub)" }} />
          <p className="font-bold mb-1" style={{ color: "var(--text-main)", fontSize: 15 }}>All caught up</p>
          <p style={{ fontSize: 13, color: "var(--text-sub)" }}>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => (
            <NotifCard key={n.id} notif={n} onRead={() => markRead.mutate(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifCard({ notif, onRead }: { notif: PatientNotification; onRead: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isFeedback = notif.type === "feedback_request";
  const isUnread = !notif.read_at;

  function handleOpen() {
    setExpanded(true);
    if (isUnread) onRead();
  }

  if (expanded && isFeedback && !notif.actioned_at) {
    const token = notif.metadata.token as string | undefined;
    return <FeedbackForm notif={notif} token={token ?? ""} onClose={() => setExpanded(false)} />;
  }

  const icons: Record<string, string> = {
    feedback_request: "⭐",
    birthday: "🎂",
    appointment_confirmed: "✅",
    appointment_cancelled: "❌",
    stage_update: "🏥",
    plan_integrated: "💊",
    era_message_sent: "💬",
    general: "🔔",
  };

  return (
    <div
      onClick={handleOpen}
      className="rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition"
      style={{
        background: isUnread ? "rgba(var(--glow-rgb),0.06)" : "var(--glass-bg)",
        border: `1px solid ${isUnread ? "rgba(var(--glow-rgb),0.2)" : "var(--glass-border)"}`,
      }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icons[notif.type] ?? "🔔"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>{notif.title}</p>
            {isUnread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--accent)" }} />}
          </div>
          {notif.body && <p style={{ fontSize: 12, color: "var(--text-sub)", lineHeight: 1.5 }}>{notif.body}</p>}
          <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
            {new Date(notif.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {notif.actioned_at && " · Done"}
          </p>
        </div>
        {isFeedback && !notif.actioned_at && (
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg shrink-0"
            style={{ background: "rgba(var(--glow-rgb),0.1)", color: "var(--accent)" }}>
            Rate
          </span>
        )}
      </div>
    </div>
  );
}

function FeedbackForm({ notif, token, onClose }: { notif: PatientNotification; token: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [waitTime, setWaitTime] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [careRating, setCareRating] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const actionNotif = useActionNotif();

  const hospitalName = (notif.metadata.hospitalName as string) ?? "the hospital";

  async function handleSubmit() {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          waitTimeRating: waitTime || undefined,
          staffFriendlinessRating: staffRating || undefined,
          qualityOfCareRating: careRating || undefined,
          wouldRecommend: recommend ?? undefined,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok && res.status !== 409) throw new Error("Submit failed");
      actionNotif.mutate(notif.id);
      setDone(true);
    } catch {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 44, marginBottom: 12 }}>🙏</p>
        <p className="font-bold mb-1" style={{ color: "var(--text-main)", fontSize: 15 }}>Thank you!</p>
        <p style={{ fontSize: 13, color: "var(--text-sub)" }}>Your feedback has been shared with {hospitalName}.</p>
        <button onClick={onClose} className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition"
          style={{ background: "var(--btn-gradient)" }}>Done</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid rgba(var(--glow-rgb),0.2)" }}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>Rate your visit</p>
        <button onClick={onClose} style={{ color: "var(--text-dim)", fontSize: 12 }}>✕</button>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-5">
        {/* Overall */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub)", marginBottom: 10 }}>Overall experience <span style={{ color: "#f87171" }}>*</span></p>
          <StarRow value={rating} hovered={hovered} onHover={setHovered} onChange={setRating} size="lg" />
        </div>

        {/* Sub-ratings */}
        <div className="space-y-4">
          {[
            { label: "Wait time", value: waitTime, set: setWaitTime },
            { label: "Staff friendliness", value: staffRating, set: setStaffRating },
            { label: "Quality of care", value: careRating, set: setCareRating },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: "var(--text-sub)" }}>{label}</p>
              <StarRow value={value} hovered={0} onHover={() => {}} onChange={set} size="sm" />
            </div>
          ))}
        </div>

        {/* Recommend */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub)", marginBottom: 8 }}>Would you recommend {hospitalName}?</p>
          <div className="flex gap-2">
            {[["Yes", true], ["No", false]].map(([label, val]) => (
              <button key={String(label)} onClick={() => setRecommend(val as boolean)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold active:scale-95 transition"
                style={{
                  background: recommend === val ? (val ? "rgba(20,184,166,0.2)" : "rgba(239,68,68,0.15)") : "var(--glass-track)",
                  border: `1px solid ${recommend === val ? (val ? "rgba(20,184,166,0.4)" : "rgba(239,68,68,0.3)") : "var(--glass-border)"}`,
                  color: recommend === val ? (val ? "#14b8a6" : "#f87171") : "var(--text-sub)",
                }}>
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-sub)", marginBottom: 8 }}>Additional comments</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Anything else you'd like to share…"
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)", caretColor: "var(--accent)" }}
          />
        </div>

        <button onClick={handleSubmit} disabled={!rating || submitting}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-sm active:scale-95 transition disabled:opacity-50"
          style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.3)` }}>
          {submitting ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}

function StarRow({ value, hovered, onHover, onChange, size }: {
  value: number; hovered: number; onHover: (n: number) => void; onChange: (n: number) => void; size: "lg" | "sm";
}) {
  const sz = size === "lg" ? 32 : 22;
  const active = hovered || value;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} onMouseEnter={() => onHover(n)} onMouseLeave={() => onHover(0)}
          className="active:scale-90 transition" style={{ lineHeight: 0 }}>
          <Star style={{ width: sz, height: sz, fill: n <= active ? "#fbbf24" : "transparent", color: n <= active ? "#fbbf24" : "var(--glass-border)", transition: "fill 0.1s, color 0.1s" }} />
        </button>
      ))}
    </div>
  );
}
