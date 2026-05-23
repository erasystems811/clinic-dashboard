import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { Star, CheckCircle } from "lucide-react";

export default function FeedbackForm() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = useSubmitFeedback({
    mutation: {
      onSuccess: () => setSubmitted(true),
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold">Thank you!</h1>
          <p className="text-muted-foreground">Your feedback has been received. We appreciate it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Star className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">How was your visit?</h1>
          <p className="text-muted-foreground text-sm">Your feedback helps us improve our care.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Rate your experience *</label>
            <div className="flex items-center gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      s <= (hovered || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm font-medium text-amber-400">
                {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Comments (optional)</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Tell us about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={rating === 0 || submit.isPending}
            onClick={() => submit.mutate({ data: { rating, comment: comment || undefined } })}
          >
            {submit.isPending ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </div>
    </div>
  );
}
