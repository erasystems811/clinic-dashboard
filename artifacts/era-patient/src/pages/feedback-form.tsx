import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { Star, CheckCircle, XCircle, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

export interface FormQuestion {
  key: string;
  label: string;
  type: "rating" | "recommend" | "text";
  required: boolean;
  enabled: boolean;
}

interface FormContext {
  patientId: number;
  patientName: string;
  hospitalName: string;
  alreadySubmitted: boolean;
  questions: FormQuestion[];
}

const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

function StarRow({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-foreground w-44 shrink-0">
        {label}{required ? " *" : ""}
      </span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                s <= (hovered || value)
                  ? "text-amber-400 fill-amber-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
        <span className="text-xs text-amber-400 font-medium w-16 ml-1">
          {(hovered || value) > 0 ? LABELS[hovered || value] : ""}
        </span>
      </div>
    </div>
  );
}

const DEFAULT_QUESTIONS: FormQuestion[] = [
  { key: "overall", label: "Overall Experience", type: "rating", required: true, enabled: true },
  { key: "wait_time", label: "Wait Time", type: "rating", required: false, enabled: true },
  { key: "staff_friendliness", label: "Staff Friendliness", type: "rating", required: false, enabled: true },
  { key: "quality_of_care", label: "Quality of Care", type: "rating", required: false, enabled: true },
  { key: "recommend", label: "Would you recommend us to others?", type: "recommend", required: false, enabled: true },
  { key: "comments", label: "Additional Comments", type: "text", required: false, enabled: true },
];

interface Props {
  token: string;
  previewQuestions?: FormQuestion[];
}

export default function FeedbackForm({ token, previewQuestions }: Props) {
  const isPreview = !!previewQuestions;
  const [ctx, setCtx] = useState<FormContext | null>(null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const questions: FormQuestion[] = previewQuestions ?? ctx?.questions ?? DEFAULT_QUESTIONS;
  const enabledQuestions = questions.filter(q => q.enabled);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (isPreview) return;
    if (!token) { setError("Invalid feedback link."); setLoading(false); return; }
    fetch(apiUrl(`/api/feedback/form/${token}`))
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else {
          setCtx(data);
          if (data.alreadySubmitted) setSubmitted(true);
        }
      })
      .catch(() => setError("Failed to load form. Please try again."))
      .finally(() => setLoading(false));
  }, [token, isPreview]);

  const handleSubmit = async () => {
    if (isPreview) return;
    const overallQ = enabledQuestions.find(q => q.key === "overall" && q.type === "rating");
    if (overallQ && !ratings["overall"]) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        token,
        rating: ratings["overall"] ?? 1,
      };
      if (ratings["wait_time"]) body.waitTimeRating = ratings["wait_time"];
      if (ratings["staff_friendliness"]) body.staffFriendlinessRating = ratings["staff_friendliness"];
      if (ratings["quality_of_care"]) body.qualityOfCareRating = ratings["quality_of_care"];
      if (wouldRecommend != null) body.wouldRecommend = wouldRecommend;
      if (comment.trim()) body.comment = comment.trim();

      const res = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) { setSubmitted(true); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Submission failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !ctx && !isPreview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Link Invalid</h1>
          <p className="text-muted-foreground text-sm max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted && !isPreview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Thank You{ctx?.patientName ? `, ${ctx.patientName.split(" ")[0]}` : ""}!</h1>
          <p className="text-muted-foreground text-sm">
            Your feedback has been received. We appreciate you taking the time to help us improve our care.
          </p>
          {ctx?.hospitalName && (
            <p className="text-xs text-muted-foreground/60">— {ctx.hospitalName}</p>
          )}
        </div>
      </div>
    );
  }

  const ratingQuestions = enabledQuestions.filter(q => q.type === "rating");
  const recommendQ = enabledQuestions.find(q => q.type === "recommend");
  const commentsQ = enabledQuestions.find(q => q.type === "text");
  const requiredRatings = ratingQuestions.filter(q => q.required);
  const allRequiredFilled = requiredRatings.every(q => (ratings[q.key] ?? 0) > 0);
  const canSubmit = allRequiredFilled && !submitting;

  const patientFirstName = isPreview ? "Alex" : ctx?.patientName?.split(" ")[0] ?? "";
  const hospitalName = isPreview ? "Your Hospital" : ctx?.hospitalName ?? "";

  return (
    <div className={`${isPreview ? "" : "min-h-screen"} bg-background flex items-center justify-center p-4 py-10`}>
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Star className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            How was your visit{patientFirstName ? `, ${patientFirstName}` : ""}?
          </h1>
          {hospitalName && (
            <p className="text-muted-foreground text-sm">{hospitalName}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-7">

          {ratingQuestions.length > 0 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Rate Your Experience</p>
                <div className="space-y-4">
                  {ratingQuestions.map((q, i) => (
                    <div key={q.key}>
                      {i === 1 && <div className="h-px bg-border mb-4" />}
                      <StarRow
                        label={q.label}
                        value={ratings[q.key] ?? 0}
                        onChange={v => setRatings(prev => ({ ...prev, [q.key]: v }))}
                        required={q.required}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {recommendQ && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <p className="text-sm font-medium">{recommendQ.label}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => !isPreview && setWouldRecommend(true)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 justify-center ${
                      wouldRecommend === true
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-400"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Yes, definitely
                  </button>
                  <button
                    type="button"
                    onClick={() => !isPreview && setWouldRecommend(false)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 justify-center ${
                      wouldRecommend === false
                        ? "border-rose-500 bg-rose-500/10 text-rose-400"
                        : "border-border text-muted-foreground hover:border-rose-500/50 hover:text-rose-400"
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Not really
                  </button>
                </div>
              </div>
            </>
          )}

          {commentsQ && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {commentsQ.label}{" "}
                  {!commentsQ.required && (
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  )}
                </label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                  placeholder="Tell us more about your experience…"
                  value={comment}
                  onChange={e => !isPreview && setComment(e.target.value)}
                  readOnly={isPreview}
                />
              </div>
            </>
          )}

          {error && !isPreview && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit || isPreview}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
          {!allRequiredFilled && !isPreview && (
            <p className="text-center text-xs text-muted-foreground">* Required fields must be filled</p>
          )}
        </div>
      </div>
    </div>
  );
}
