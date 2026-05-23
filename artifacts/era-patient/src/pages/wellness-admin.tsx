import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  useListWellnessNewsletters,
  useUpsertWellnessNewsletter,
  useMarkNewsletterSent,
  getListWellnessNewslettersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfWeek } from "date-fns";
import { Send, Save, Newspaper, Edit3, CheckCircle, Loader2 } from "lucide-react";

function weekOfDate(date: Date) {
  const d = startOfWeek(date);
  return format(d, "yyyy-MM-dd");
}

export default function WellnessAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentWeekOf = weekOfDate(new Date());

  const { data: newsletters = [], isLoading } = useListWellnessNewsletters({});
  const currentNewsletter = newsletters.find(n => n.weekOf === currentWeekOf);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (currentNewsletter) {
      setContent(currentNewsletter.content);
    }
  }, [currentNewsletter]);

  const upsert = useUpsertWellnessNewsletter({
    mutation: {
      onSuccess: () => {
        toast({ title: "Newsletter saved" });
        queryClient.invalidateQueries({ queryKey: getListWellnessNewslettersQueryKey() });
        setEditing(false);
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const markSent = useMarkNewsletterSent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Marked as sent", description: "Newsletter delivery recorded." });
        queryClient.invalidateQueries({ queryKey: getListWellnessNewslettersQueryKey() });
      },
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wellness Newsletter</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage the weekly wellness newsletter. Review and edit AI drafts before sending.
          </p>
        </div>

        {/* Current week editor */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Newspaper className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">This Week's Newsletter</h2>
            <span className="text-xs text-muted-foreground ml-1">
              Week of {format(parseISO(currentWeekOf), "MMMM d, yyyy")}
            </span>
            {currentNewsletter?.lastSentAt && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                Sent {format(parseISO(currentNewsletter.lastSentAt), "d MMM")}
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {editing || !currentNewsletter ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {!currentNewsletter
                    ? "No newsletter created for this week yet. Write one below."
                    : "Editing current week's newsletter. Make corrections before marking as sent."}
                </p>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[300px] resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed"
                  placeholder="Write the wellness newsletter content here...&#10;&#10;Tip: Include health tips, reminders about treatment adherence, seasonal wellness advice, and any doctor-recommended guidance."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  {currentNewsletter && (
                    <Button variant="outline" onClick={() => { setContent(currentNewsletter.content); setEditing(false); }}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={() => upsert.mutate({ data: { content, weekOf: currentWeekOf } })}
                    disabled={!content.trim() || upsert.isPending}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {upsert.isPending ? "Saving..." : "Save Newsletter"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/30 border border-border p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-mono">
                  {currentNewsletter.content}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {format(parseISO(currentNewsletter.updatedAt), "d MMM yyyy, HH:mm")}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </Button>
                  {!currentNewsletter.lastSentAt && (
                    <Button
                      onClick={() => markSent.mutate({ id: currentNewsletter.id })}
                      disabled={markSent.isPending}
                      className="gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {markSent.isPending ? "Marking..." : "Mark as Sent"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Past newsletters */}
        {newsletters.filter(n => n.weekOf !== currentWeekOf).length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-sm">Past Newsletters</h2>
            </div>
            <div className="divide-y divide-border">
              {newsletters
                .filter(n => n.weekOf !== currentWeekOf)
                .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
                .map(n => (
                  <div key={n.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Week of {format(parseISO(n.weekOf), "MMMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.content}</p>
                    </div>
                    {n.lastSentAt ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
                        <CheckCircle className="w-3 h-3" />
                        Sent {format(parseISO(n.lastSentAt), "d MMM")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Not sent</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
