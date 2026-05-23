import { Layout } from "@/components/layout";
import { useListFeedback } from "@workspace/api-client-react";
import { Star, Send, Loader2, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export default function FeedbackAdmin() {
  const { toast } = useToast();
  const { data, isLoading } = useListFeedback({});

  const feedbackLink = `${window.location.origin}${import.meta.env.BASE_URL}feedback`.replace('//', '/');

  const copyLink = () => {
    navigator.clipboard.writeText(feedbackLink);
    toast({ title: "Link copied", description: "Share this with patients at end of visit." });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            View all patient ratings and responses. Send the form link at the end of each visit.
          </p>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Average Rating</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{data.avgRating ? Number(data.avgRating).toFixed(1) : "—"}</span>
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Responses</p>
              <span className="text-2xl font-bold">{data.total}</span>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Patient Form Link</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{feedbackLink}</code>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No feedback submitted yet.</p>
            <p className="text-xs mt-1">Share the form link with patients after their visit.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...data.entries].reverse().map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-medium text-sm">{entry.patientName ?? "Anonymous"}</p>
                      <StarRating rating={entry.rating} />
                      <span className="text-sm font-bold text-amber-400">{entry.rating}/5</span>
                    </div>
                    {entry.comment && <p className="text-sm text-muted-foreground mt-1">"{entry.comment}"</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(entry.submittedAt), "d MMM yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
