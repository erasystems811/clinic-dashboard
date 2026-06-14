import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";

const SESSIONS_KEY    = "era_nudge_sessions";
const LAST_SHOWN_KEY  = "era_nudge_last_shown";
const SESSION_COUNTED = "era_nudge_counted";   // sessionStorage — clears on tab close

const MIN_SESSIONS   = 3;
const REPEAT_DAYS    = 21;

function getSessionCount(): number {
  if (!sessionStorage.getItem(SESSION_COUNTED)) {
    sessionStorage.setItem(SESSION_COUNTED, "1");
    const next = parseInt(localStorage.getItem(SESSIONS_KEY) ?? "0", 10) + 1;
    localStorage.setItem(SESSIONS_KEY, String(next));
    return next;
  }
  return parseInt(localStorage.getItem(SESSIONS_KEY) ?? "0", 10);
}

function lastShownDate(): Date | null {
  const raw = localStorage.getItem(LAST_SHOWN_KEY);
  return raw ? new Date(raw) : null;
}

function shouldShowOrganic(): boolean {
  const sessions = getSessionCount();
  if (sessions < MIN_SESSIONS) return false;
  const last = lastShownDate();
  if (!last) return true;
  return (Date.now() - last.getTime()) / 86_400_000 >= REPEAT_DAYS;
}

function recordShown() {
  localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
}

export function FeedbackNudge() {
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState<"rating" | "note" | "done">("rating");
  const [rating, setRating]   = useState(0);
  const [note, setNote]       = useState("");
  const [sending, setSending] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Check server broadcast first (superadmin manual trigger bypasses the 21-day wait)
    void (async () => {
      try {
        const res = await fetch("/api/patient-app/feedback-broadcast");
        if (res.ok) {
          const { triggeredAt } = await res.json() as { triggeredAt: string | null };
          if (triggeredAt) {
            const last = lastShownDate();
            const broadcastIsNewer = !last || new Date(triggeredAt) > last;
            if (broadcastIsNewer) {
              setTimeout(() => setVisible(true), 3000);
              return;
            }
          }
        }
      } catch { /* fall through to organic check */ }

      // Organic: show after MIN_SESSIONS opens, then every REPEAT_DAYS
      if (shouldShowOrganic()) {
        setTimeout(() => setVisible(true), 5000);
      }
    })();
  }, []);

  function dismiss() {
    recordShown();
    setVisible(false);
  }

  function pickRating(r: number) {
    setRating(r);
    setStep("note");
  }

  async function submit() {
    setSending(true);
    try {
      await apiFetch("/api/patient-app/feedback", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          rating,
          category: "general",
          message: note.trim() || `Quick rating: ${rating}/5 stars`,
        }),
      });
    } catch { /* ignore — still thank them */ }
    setSending(false);
    setStep("done");
    recordShown();
    setTimeout(() => setVisible(false), 2000);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 82,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: 416,
        zIndex: 45,
        animation: "nudge-slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
      <style>{`
        @keyframes nudge-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
      `}</style>

      <div className="rounded-2xl p-4 shadow-2xl"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}>

        {step === "rating" && (
          <>
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                💬 How's ERA treating you?
              </p>
              <button onClick={dismiss} className="text-lg leading-none ml-3" style={{ color: "var(--text-dim)" }}>✕</button>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>
              Quick rating — helps us improve for you
            </p>
            <div className="flex gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => pickRating(s)}
                  className="flex-1 py-2 rounded-xl text-xl transition active:scale-90"
                  style={{ background: "var(--bg-base)" }}>
                  ⭐
                </button>
              ))}
            </div>
            <button onClick={dismiss}
              className="w-full py-2 rounded-xl text-xs font-medium transition active:scale-95"
              style={{ background: "var(--bg-base)", color: "var(--text-dim)" }}>
              Not now
            </button>
          </>
        )}

        {step === "note" && (
          <>
            <p className="text-sm font-bold mb-0.5" style={{ color: "var(--text-main)" }}>
              {"⭐".repeat(rating)} Thank you!
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>
              Anything you'd like to add? (optional)
            </p>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              rows={2} placeholder="Tell us more…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2"
              style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
            <div className="flex gap-2">
              <button onClick={dismiss}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition active:scale-95"
                style={{ background: "var(--bg-base)", color: "var(--text-sub)" }}>
                Skip
              </button>
              <button onClick={() => void submit()} disabled={sending}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition active:scale-95 disabled:opacity-60"
                style={{ background: "var(--accent)" }}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex items-center gap-3 py-1">
            <span style={{ fontSize: 28 }}>🙏</span>
            <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
              Means a lot — thank you!
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
