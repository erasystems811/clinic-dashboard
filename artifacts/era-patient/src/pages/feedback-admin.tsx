import { useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Star, MessageSquare, Loader2, ThumbsUp, Clock,
  Users, Heart, Share2, RefreshCw, Copy, CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";

interface FeedbackEntry {
  id: number;
  patientName?: string | null;
  rating: number;
  waitTimeRating?: number | null;
  staffFriendlinessRating?: number | null;
  qualityOfCareRating?: number | null;
  wouldRecommend?: boolean | null;
  comment?: string | null;
  submittedAt: string;
}

interface FeedbackData {
  entries: FeedbackEntry[];
  total: number;
  avgRating: number;
  avgWaitTime: number;
  avgStaffFriendliness: number;
  avgQualityOfCare: number;
  recommendRate: number | null;
  distribution: { star: number; count: number }[];
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${cls} ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, sub, color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color ?? "bg-primary/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${color ? "text-white" : "text-primary"}`} />
        </div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DistributionBar({ star, count, max }: { star: number; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 text-muted-foreground text-right">{star}</span>
      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-5 text-muted-foreground text-right">{count}</span>
    </div>
  );
}

export default function FeedbackAdmin() {
  const { hospital } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const polledAt = useRef<number>(0);

  const feedbackLink = hospital
    ? `${window.location.origin}${import.meta.env.BASE_URL}feedback/`.replace(/\/+/g, "/").replace(":/", "://")
    : "";

  const { data, isLoading, dataUpdatedAt, refetch } = useQuery<FeedbackData>({
    queryKey: ["feedback", hospital?.id],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (hospital?.token) headers["x-hospital-token"] = hospital.token;
      const res = await fetch("/api/feedback", { headers });
      if (!res.ok) throw new Error("Failed to load feedback");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== polledAt.current) {
      polledAt.current = dataUpdatedAt;
    }
  }, [dataUpdatedAt]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied", description: "Share with a patient to collect their feedback." });
  };

  const maxDist = data?.distribution?.length
    ? Math.max(...data.distribution.map(d => d.count), 1)
    : 1;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Real-time ratings and responses from patients.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
            Patient Feedback Link
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Generate a unique link per patient from their profile page, or share this general link.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded-lg flex-1 truncate text-foreground/70 border border-border">
              {feedbackLink}<span className="text-muted-foreground">[patient-token]</span>
            </code>
            <button
              onClick={() => copyLink(feedbackLink)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition shrink-0"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.total === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No feedback yet</p>
            <p className="text-xs mt-1">Generate a link from a patient's profile and share it after their visit.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Total Responses"
                value={data.total}
                icon={MessageSquare}
              />
              <KpiCard
                label="Overall Rating"
                value={data.avgRating ? `${data.avgRating}/5` : "—"}
                icon={Star}
                color="bg-amber-500"
                sub="avg score"
              />
              <KpiCard
                label="Wait Time"
                value={data.avgWaitTime ? `${data.avgWaitTime}/5` : "—"}
                icon={Clock}
                sub="avg score"
              />
              <KpiCard
                label="Staff Friendliness"
                value={data.avgStaffFriendliness ? `${data.avgStaffFriendliness}/5` : "—"}
                icon={Users}
                sub="avg score"
              />
              <KpiCard
                label="Quality of Care"
                value={data.avgQualityOfCare ? `${data.avgQualityOfCare}/5` : "—"}
                icon={Heart}
                sub="avg score"
              />
              <KpiCard
                label="Would Recommend"
                value={data.recommendRate != null ? `${data.recommendRate}%` : "—"}
                icon={ThumbsUp}
                color={data.recommendRate != null && data.recommendRate >= 70 ? "bg-emerald-500" : "bg-muted"}
                sub="of respondents"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Overall Rating Distribution</p>
                <div className="space-y-2.5">
                  {[...data.distribution].reverse().map(d => (
                    <DistributionBar key={d.star} star={d.star} count={d.count} max={maxDist} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Category Breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: "Overall Experience", value: data.avgRating },
                    { label: "Wait Time", value: data.avgWaitTime },
                    { label: "Staff Friendliness", value: data.avgStaffFriendliness },
                    { label: "Quality of Care", value: data.avgQualityOfCare },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground w-36 shrink-0">{item.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${item.value > 0 ? (item.value / 5) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right">
                        {item.value > 0 ? item.value.toFixed(1) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                {data.recommendRate != null && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Recommendation Rate</span>
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-400">{data.recommendRate}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Recent Responses</p>
                {dataUpdatedAt > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Updated {format(new Date(dataUpdatedAt), "h:mm a")}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {data.entries.map(entry => (
                  <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-medium text-sm">{entry.patientName ?? "Anonymous"}</span>
                          <StarDisplay rating={entry.rating} />
                          <span className="text-sm font-bold text-amber-400">{entry.rating}/5</span>
                          {entry.wouldRecommend != null && (
                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                              entry.wouldRecommend
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}>
                              {entry.wouldRecommend ? <ThumbsUp className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3 rotate-180" />}
                              {entry.wouldRecommend ? "Recommends" : "Would not recommend"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 mb-2">
                          {entry.waitTimeRating != null && (
                            <span className="text-xs text-muted-foreground">
                              Wait: <span className="text-foreground font-medium">{entry.waitTimeRating}/5</span>
                            </span>
                          )}
                          {entry.staffFriendlinessRating != null && (
                            <span className="text-xs text-muted-foreground">
                              Staff: <span className="text-foreground font-medium">{entry.staffFriendlinessRating}/5</span>
                            </span>
                          )}
                          {entry.qualityOfCareRating != null && (
                            <span className="text-xs text-muted-foreground">
                              Care: <span className="text-foreground font-medium">{entry.qualityOfCareRating}/5</span>
                            </span>
                          )}
                        </div>
                        {entry.comment && (
                          <p className="text-sm text-muted-foreground italic">"{entry.comment}"</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {format(parseISO(entry.submittedAt), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
