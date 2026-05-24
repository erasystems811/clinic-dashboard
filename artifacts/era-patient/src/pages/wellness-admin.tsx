import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  useListWellnessNewsletters,
  useUpsertWellnessNewsletter,
  getListWellnessNewslettersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { format, parseISO, startOfWeek } from "date-fns";
import {
  Send, Save, Newspaper, Edit3, CheckCircle, CheckCircle2, Loader2,
  Sparkles, Youtube, Link, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function weekOfDate(date: Date) {
  return format(startOfWeek(date), "yyyy-MM-dd");
}

const FALLBACK_TOPIC_SUGGESTIONS = [
  "Hydration and Water Intake",
  "Sleep Hygiene",
  "Stress Management",
  "Physical Activity and Exercise",
  "Healthy Eating Habits",
  "Mental Health Awareness",
  "Heart Health",
  "Immune System Support",
];

export default function WellnessAdmin() {
  const { toast } = useToast();
  const { hospital } = useAuth();
  const queryClient = useQueryClient();
  const currentWeekOf = weekOfDate(new Date());

  const { data: newsletters = [], isLoading } = useListWellnessNewsletters({});
  const currentNewsletter = newsletters.find(n => n.weekOf === currentWeekOf);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [angle, setAngle] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [tiktokLink, setTiktokLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>(FALLBACK_TOPIC_SUGGESTIONS);

  useEffect(() => {
    if (!hospital?.token) return;
    fetch(`${BASE}/api/wellness/topics`, {
      headers: { "x-hospital-token": hospital.token },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { suggested: string[] } | null) => {
        if (data?.suggested?.length) setTopicSuggestions(data.suggested);
      })
      .catch(() => {});
  }, [hospital?.token]);

  useEffect(() => {
    if (currentNewsletter) {
      setContent(currentNewsletter.content);
      setTopic((currentNewsletter as Record<string, unknown>).topic as string ?? "");
      setYoutubeLink((currentNewsletter as Record<string, unknown>).youtubeLink as string ?? "");
      setTiktokLink((currentNewsletter as Record<string, unknown>).tiktokLink as string ?? "");
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

  const handleGenerate = async (mode: "fresh" | "new-subtopic" | "new-angle" = "fresh") => {
    if (!hospital?.token) { toast({ title: "Not authenticated", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const body: Record<string, string> = { topic: topic || "General Wellness" };
      // Lock the current subtopic → only the angle will change
      if (mode === "new-angle" && subtopic) body.subtopic = subtopic;
      // mode === "new-subtopic" sends only the topic, letting AI pick a completely new subtopic
      const res = await fetch(`${BASE}/api/wellness/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setContent(data.content);
      setTopic(data.topic);
      setSubtopic(data.subtopic ?? "");
      setAngle(data.angle ?? "");
      setEditing(true);
      const desc = data.angle ? `${data.subtopic} → ${data.angle}` : (data.subtopic ?? data.topic);
      toast({ title: "Newsletter generated", description: desc });
    } catch (err: unknown) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAndSend = async (newsletterId?: number) => {
    if (!hospital?.token) { toast({ title: "Not authenticated", variant: "destructive" }); return; }

    let id = newsletterId;

    // Save first if needed
    if (!id || editing) {
      const saved = await new Promise<number | null>((resolve) => {
        upsert.mutate(
          { data: { content, weekOf: currentWeekOf, topic: topic || undefined, youtubeLink: youtubeLink || undefined, tiktokLink: tiktokLink || undefined } },
          {
            onSuccess: (res) => {
              queryClient.invalidateQueries({ queryKey: getListWellnessNewslettersQueryKey() });
              setEditing(false);
              resolve((res as Record<string, unknown>).id as number);
            },
            onError: () => { toast({ title: "Save failed", variant: "destructive" }); resolve(null); },
          }
        );
      });
      if (!saved) return;
      id = saved;
    }

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${BASE}/api/wellness/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      toast({
        title: "Newsletter sent!",
        description: `Delivered to ${data.sent} patient${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: getListWellnessNewslettersQueryKey() });
    } catch (err: unknown) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const isSent = !!currentNewsletter?.lastSentAt;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wellness Newsletter</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI-powered weekly wellness emails for your patients. Claude generates content; you review and send.
          </p>
        </div>

        {/* Current week editor */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Newspaper className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">This Week's Newsletter</h2>
            <span className="text-xs text-muted-foreground ml-1">Week of {format(parseISO(currentWeekOf), "MMMM d, yyyy")}</span>
            {isSent && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                Sent {format(parseISO(currentNewsletter!.lastSentAt!), "d MMM")}
                {sendResult && <span className="ml-1 opacity-70">· {sendResult.sent} delivered</span>}
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Topic row */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Topic</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Hydration and Water Intake (leave blank for AI to pick)"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowTopicSuggestions(!showTopicSuggestions)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  Suggestions
                  {showTopicSuggestions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
              {showTopicSuggestions && (
                <div className="flex flex-wrap gap-2">
                  {topicSuggestions.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTopic(t); setShowTopicSuggestions(false); }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${topic === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video links */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Youtube className="w-3 h-3" />YouTube Link
                </label>
                <input
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Link className="w-3 h-3" />TikTok Link
                </label>
                <input
                  type="url"
                  value={tiktokLink}
                  onChange={(e) => setTiktokLink(e.target.value)}
                  placeholder="https://tiktok.com/@..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>
            </div>

            {/* Generate with AI */}
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => handleGenerate("fresh")}
                  disabled={generating}
                >
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate with AI</>}
                </Button>
              </div>

              {/* Subtopic + Angle Claude chose — with per-level regenerate controls */}
              {(subtopic || angle) && !generating && (
                <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Claude's selection</span>
                  </div>

                  {/* Subtopic row */}
                  {subtopic && (
                    <div className="flex items-center gap-2 pl-5">
                      <span className="text-[10px] text-muted-foreground w-14 shrink-0">Subtopic</span>
                      <span className="text-xs font-medium text-foreground flex-1">{subtopic}</span>
                      <button
                        type="button"
                        onClick={() => handleGenerate("new-subtopic")}
                        className="text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                        title="Keep the topic but let AI pick a completely different subtopic"
                      >
                        Different subtopic
                      </button>
                    </div>
                  )}

                  {/* Angle row */}
                  {angle && (
                    <div className="flex items-center gap-2 pl-5">
                      <span className="text-[10px] text-muted-foreground w-14 shrink-0">Angle</span>
                      <span className="text-xs font-semibold text-primary flex-1">{angle}</span>
                      <button
                        type="button"
                        onClick={() => handleGenerate("new-angle")}
                        className="text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                        title="Keep this subtopic but get a different angle on it"
                      >
                        Different angle
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!subtopic && !angle && !generating && !content && (
                <p className="text-xs text-muted-foreground">
                  Claude picks a subtopic and a specific angle within your category. After generating, you can swap just the angle or the whole subtopic independently.
                </p>
              )}
            </div>

            {/* Content area */}
            {(editing || !currentNewsletter || generating) ? (
              <div className="space-y-3">
                {generating && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">Claude is picking an angle and writing your newsletter…</span>
                  </div>
                )}
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[320px] resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                  placeholder="Newsletter content will appear here after AI generation, or write your own…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={generating}
                />
                <div className="flex gap-2 justify-end">
                  {currentNewsletter && (
                    <Button variant="outline" onClick={() => { setContent(currentNewsletter.content); setEditing(false); }}>Cancel</Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => upsert.mutate({ data: { content, weekOf: currentWeekOf, topic: topic || undefined, youtubeLink: youtubeLink || undefined, tiktokLink: tiktokLink || undefined } })}
                    disabled={!content.trim() || upsert.isPending || generating}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {upsert.isPending ? "Saving…" : "Save Draft"}
                  </Button>
                  <Button
                    onClick={() => handleSaveAndSend(currentNewsletter?.id)}
                    disabled={!content.trim() || sending || generating}
                    className="gap-2"
                  >
                    {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Save &amp; Send</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/30 border border-border p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {currentNewsletter.content}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {format(parseISO(currentNewsletter.updatedAt), "d MMM yyyy, HH:mm")}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
                    <Edit3 className="w-4 h-4" />Edit
                  </Button>
                  {!isSent ? (
                    <Button onClick={() => handleSaveAndSend(currentNewsletter.id)} disabled={sending} className="gap-2">
                      {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Send to Friends</>}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sent this week — next send available next week
                    </div>
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Week of {format(parseISO(n.weekOf), "MMMM d, yyyy")}</p>
                        {(n as Record<string, unknown>).topic && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{(n as Record<string, unknown>).topic as string}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.content}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {(n as Record<string, unknown>).recipientCount && (
                        <span className="text-xs text-muted-foreground">{(n as Record<string, unknown>).recipientCount as number} sent</span>
                      )}
                      {n.lastSentAt ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Sent {format(parseISO(n.lastSentAt), "d MMM")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not sent</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </Layout>
  );
}
