import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl, authHeader } from "@/lib/api";

const COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 10 * 60 * 1000; // 10 minutes into the session

const RATINGS = [
  { value: 1, emoji: "😫", label: "Terrible" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😍", label: "Amazing" },
];

export default function SystemFeedbackPopup() {
  const { user, hospital } = useAuth();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || !hospital) return;
    const key = `era_sfb_v1_${hospital.id}_${user.username}`;
    const last = localStorage.getItem(key);
    const shouldShow = !last || Date.now() - parseInt(last, 10) > COOLDOWN_MS;
    if (!shouldShow) return;
    localStorage.setItem(key, String(Date.now()));
    const t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [user?.username, hospital?.id]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  const handleSkip = () => setOpen(false);

  const handleSubmit = async () => {
    if (!rating || !user) return;
    setSubmitting(true);
    try {
      await fetch(apiUrl("/api/system-feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, role: user.role }),
      });
    } catch {
      // silent — feedback failure shouldn't interrupt the user
    } finally {
      setSubmitting(false);
      setDone(true);
      setTimeout(() => setOpen(false), 2500);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />
      <div
        className={`relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {done ? (
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <span className="text-5xl">🙌</span>
            <p className="text-base font-semibold text-foreground">Thanks for the feedback!</p>
            <p className="text-sm text-muted-foreground">It helps us make Era better for you.</p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-primary/70 mb-1">Quick check-in</p>
              <h2 className="text-lg font-bold text-foreground">How's Era feeling today?</h2>
              <p className="text-sm text-muted-foreground mt-1">Takes 5 seconds. Honestly.</p>
            </div>

            <div className="flex justify-between gap-1 mb-4">
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRating(r.value)}
                  className={`flex flex-col items-center gap-1 flex-1 p-2 rounded-xl transition-all duration-150 border ${
                    rating === r.value
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-2xl leading-none">{r.emoji}</span>
                  <span className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5">{r.label}</span>
                </button>
              ))}
            </div>

            {rating !== null && (
              <div className="mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Anything specific? (optional)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              {rating !== null ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Submit"}
                </button>
              ) : (
                <div className="flex-1" />
              )}
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
