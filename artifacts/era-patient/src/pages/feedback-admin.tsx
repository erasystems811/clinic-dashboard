import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  Star, MessageSquare, Loader2, ThumbsUp, Clock,
  Users, Heart, Share2, RefreshCw, Copy, CheckCircle2,
  Settings2, BarChart3, Eye, GripVertical, ToggleLeft, ToggleRight, Save, Printer,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import FeedbackForm, { type FormQuestion } from "./feedback-form";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CURRENT_YEAR = new Date().getFullYear();
const REPORT_YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => 2024 + i);

type PeriodType = "monthly" | "weekly" | "yearly";

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7);
}

function computePeriod(type: PeriodType, year: number, month: number, week: number) {
  if (type === "monthly") {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString(), label: `${MONTHS[month - 1]} ${year}` };
  }
  if (type === "weekly") {
    const jan4 = new Date(year, 0, 4);
    const dow = (jan4.getDay() + 6) % 7;
    const start = new Date(jan4);
    start.setDate(jan4.getDate() - dow + (week - 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString(), label: `Week ${week} · ${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}` };
  }
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString(), label: String(year) };
}

function printFeedbackReport(data: FeedbackData, hospitalName: string, periodLabel: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  const generated = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  const cardsHtml = data.entries.map(e => `
    <div class="card">
      <div class="card-top">
        <div class="pname">${e.patientName ?? "Anonymous"}</div>
        <div class="cdate">${format(parseISO(e.submittedAt), "d MMM yyyy")}</div>
      </div>
      <div class="overall">
        <span class="stars">${stars(e.rating)}</span>
        <span class="rnum">${e.rating}/5</span>
      </div>
      ${(e.waitTimeRating != null || e.staffFriendlinessRating != null || e.qualityOfCareRating != null) ? `
        <div class="subs">
          ${e.waitTimeRating != null ? `<span class="sub">Wait: <b>${e.waitTimeRating}/5</b></span>` : ""}
          ${e.staffFriendlinessRating != null ? `<span class="sub">Staff: <b>${e.staffFriendlinessRating}/5</b></span>` : ""}
          ${e.qualityOfCareRating != null ? `<span class="sub">Care: <b>${e.qualityOfCareRating}/5</b></span>` : ""}
        </div>` : ""}
      ${e.wouldRecommend != null ? `<div class="${e.wouldRecommend ? "rec-yes" : "rec-no"}">${e.wouldRecommend ? "✓ Would recommend" : "✗ Would not recommend"}</div>` : ""}
      ${e.comment ? `<div class="comment">"${e.comment}"</div>` : ""}
    </div>`).join("");

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${hospitalName} — Feedback Report</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,'Segoe UI',sans-serif;background:#fff;color:#1f2937;padding:24px}
    .header{background:#0d9488;color:#fff;padding:28px 32px;border-radius:14px;margin-bottom:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .hospital{font-size:22px;font-weight:800;letter-spacing:-0.5px}
    .rptitle{font-size:11px;opacity:.75;margin-top:6px;text-transform:uppercase;letter-spacing:1.5px}
    .period{font-size:16px;font-weight:700;margin-top:4px}
    .generated{font-size:10px;opacity:.55;margin-top:6px}
    .summary{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
    .stat{background:#f0fdfa;border:1.5px solid #99f6e4;border-radius:10px;padding:14px 18px;flex:1;min-width:100px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sval{font-size:22px;font-weight:800;color:#0d9488}
    .slbl{font-size:10px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
    .section{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:14px}
    .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
    .card{border:1.5px solid #ccfbf1;border-left:4px solid #0d9488;border-radius:10px;padding:14px 16px;break-inside:avoid}
    .card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
    .pname{font-weight:700;font-size:13px}
    .cdate{font-size:10px;color:#9ca3af}
    .overall{display:flex;align-items:center;gap:8px;margin-bottom:6px}
    .stars{color:#f59e0b;font-size:15px;letter-spacing:1px}
    .rnum{font-size:13px;font-weight:700;color:#0d9488}
    .subs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px}
    .sub{font-size:10px;color:#6b7280}
    .rec-yes{font-size:11px;font-weight:600;color:#059669;margin-bottom:4px}
    .rec-no{font-size:11px;font-weight:600;color:#dc2626;margin-bottom:4px}
    .comment{font-size:11px;color:#4b5563;font-style:italic;border-top:1px solid #e0f7f4;padding-top:8px;margin-top:8px;line-height:1.5}
    .footer{text-align:center;font-size:10px;color:#d1d5db;margin-top:32px;padding-top:16px;border-top:1px solid #f3f4f6}
  </style>
  </head><body>
  <div class="header">
    <div class="hospital">${hospitalName}</div>
    <div class="rptitle">Patient Feedback Report</div>
    <div class="period">${periodLabel}</div>
    <div class="generated">Generated by ERA Systems · ${generated}</div>
  </div>
  <div class="summary">
    <div class="stat"><div class="sval">${data.total}</div><div class="slbl">Total Responses</div></div>
    <div class="stat"><div class="sval">${data.avgRating > 0 ? data.avgRating + "/5" : "—"}</div><div class="slbl">Avg Rating</div></div>
    <div class="stat"><div class="sval">${data.avgWaitTime > 0 ? data.avgWaitTime + "/5" : "—"}</div><div class="slbl">Wait Time</div></div>
    <div class="stat"><div class="sval">${data.avgStaffFriendliness > 0 ? data.avgStaffFriendliness + "/5" : "—"}</div><div class="slbl">Staff</div></div>
    <div class="stat"><div class="sval">${data.avgQualityOfCare > 0 ? data.avgQualityOfCare + "/5" : "—"}</div><div class="slbl">Quality of Care</div></div>
    ${data.recommendRate != null ? `<div class="stat"><div class="sval">${data.recommendRate}%</div><div class="slbl">Recommend</div></div>` : ""}
  </div>
  <p class="section">${data.entries.length} Feedback ${data.entries.length === 1 ? "Entry" : "Entries"}</p>
  <div class="cards">${cardsHtml}</div>
  <div class="footer">ERA Systems · Confidential Patient Feedback Report · ${hospitalName}</div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}

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
  label: string; value: string | number; icon: React.ElementType; sub?: string; color?: string;
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
        <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-muted-foreground text-right">{count}</span>
    </div>
  );
}

type Tab = "dashboard" | "editor" | "reports";

export default function FeedbackAdmin() {
  const { hospital, hospitalConfig } = useAuth();
  const feedbackEnabled = hospitalConfig?.modules?.feedbackEnabled ?? true;

  if (!feedbackEnabled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Star className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">Feedback is not available</p>
          <p className="text-xs text-muted-foreground">This feature is not enabled for your clinic.</p>
        </div>
      </Layout>
    );
  }
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const polledAt = useRef<number>(0);
  const [tab, setTab] = useState<Tab>("dashboard");

  // ── Reports state ──────────────────────────────────────────────────────────
  const _now = new Date();
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [selYear, setSelYear] = useState(_now.getFullYear());
  const [selMonth, setSelMonth] = useState(_now.getMonth() + 1);
  const [selWeek, setSelWeek] = useState(isoWeekNumber(_now));
  const [reportParams, setReportParams] = useState<{ startDate: string; endDate: string; label: string } | null>(null);

  const feedbackLink = hospital?.feedbackSlug
    ? `${window.location.origin}${import.meta.env.BASE_URL}feedback/h/${hospital.feedbackSlug}`.replace(/\/+/g, "/").replace(":/", "://")
    : "";

  const headers = (): Record<string, string> =>
    hospital?.token ? { "x-hospital-token": hospital.token } : {};

  useEffect(() => {
    if (!hospital?.token) return;
    fetch(apiUrl("/api/feedback/mark-read"), {
      method: "POST",
      headers: { "x-hospital-token": hospital.token },
    }).catch(() => {});
  }, [hospital?.token]);

  const { data, isLoading, dataUpdatedAt, refetch } = useQuery<FeedbackData>({
    queryKey: ["feedback", hospital?.id],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/feedback"), { headers: headers() });
      if (!res.ok) throw new Error("Failed to load feedback");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: reportData, isLoading: reportLoading } = useQuery<FeedbackData>({
    queryKey: ["feedback-report", hospital?.id, reportParams?.startDate, reportParams?.endDate],
    queryFn: async () => {
      const url = `${apiUrl("/api/feedback")}?startDate=${encodeURIComponent(reportParams!.startDate)}&endDate=${encodeURIComponent(reportParams!.endDate)}`;
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json() as Promise<FeedbackData>;
    },
    enabled: !!reportParams && !!hospital,
    staleTime: 60_000,
  });

  const { data: configData, isLoading: configLoading } = useQuery<{ questions: FormQuestion[] }>({
    queryKey: ["feedback-config", hospital?.id],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/feedback/form-config"), { headers: headers() });
      if (!res.ok) throw new Error("Failed to load config");
      return res.json();
    },
    enabled: !!hospital,
  });

  const [localQuestions, setLocalQuestions] = useState<FormQuestion[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (configData?.questions) {
      setLocalQuestions(configData.questions);
      setIsDirty(false);
    }
  }, [configData]);

  const saveConfig = useMutation({
    mutationFn: async (questions: FormQuestion[]) => {
      const res = await fetch(apiUrl("/api/feedback/form-config"), {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-config"] });
      setIsDirty(false);
      toast({ title: "Form saved", description: "Patients will see the updated questions." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    },
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

  const updateQuestion = (key: string, patch: Partial<FormQuestion>) => {
    setLocalQuestions(prev => prev.map(q => q.key === key ? { ...q, ...patch } : q));
    setIsDirty(true);
  };

  const maxDist = data?.distribution?.length ? Math.max(...data.distribution.map(d => d.count), 1) : 1;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Patient Feedback</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Real-time ratings and responses from patients.</p>
          </div>
          {tab === "dashboard" ? (
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          ) : tab === "editor" ? (
            <button
              onClick={() => saveConfig.mutate(localQuestions)}
              disabled={!isDirty || saveConfig.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 transition"
            >
              {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveConfig.isPending ? "Saving…" : "Save Changes"}
            </button>
          ) : null}
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setTab("dashboard")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === "dashboard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => setTab("editor")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === "editor" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Form Editor
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === "reports" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Printer className="w-3.5 h-3.5" /> Reports
          </button>
        </div>

        {tab === "dashboard" && (
          <>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Your Hospital Feedback Link</p>
                <p className="text-xs text-muted-foreground">
                  This is your hospital's permanent feedback link.
                </p>
              </div>
              {feedbackLink ? (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-3 py-1.5 rounded-lg flex-1 truncate text-foreground/80 border border-border font-mono">
                    {feedbackLink}
                  </code>
                  <button
                    onClick={() => copyLink(feedbackLink)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy Link"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Link unavailable — please log out and log back in to refresh.</p>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Total Responses" value={data?.total ?? 0} icon={MessageSquare} />
                  <KpiCard label="Overall Rating" value={data?.avgRating ? `${data.avgRating}/5` : "—"} icon={Star} color="bg-amber-500" sub="avg score" />
                  <KpiCard label="Wait Time" value={data?.avgWaitTime ? `${data.avgWaitTime}/5` : "—"} icon={Clock} sub="avg score" />
                  <KpiCard label="Staff Friendliness" value={data?.avgStaffFriendliness ? `${data.avgStaffFriendliness}/5` : "—"} icon={Users} sub="avg score" />
                  <KpiCard label="Quality of Care" value={data?.avgQualityOfCare ? `${data.avgQualityOfCare}/5` : "—"} icon={Heart} sub="avg score" />
                  <KpiCard
                    label="Would Recommend"
                    value={data?.recommendRate != null ? `${data.recommendRate}%` : "—"}
                    icon={ThumbsUp}
                    color={data?.recommendRate != null && data.recommendRate >= 70 ? "bg-emerald-500" : "bg-muted"}
                    sub="of respondents"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold">Overall Rating Distribution</p>
                    <div className="space-y-2.5">
                      {data?.distribution?.length
                        ? [...data.distribution].reverse().map(d => (
                            <DistributionBar key={d.star} star={d.star} count={d.count} max={maxDist} />
                          ))
                        : [5, 4, 3, 2, 1].map(s => (
                            <DistributionBar key={s} star={s} count={0} max={1} />
                          ))
                      }
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <p className="text-sm font-semibold">Category Breakdown</p>
                    <div className="space-y-3">
                      {[
                        { label: "Overall Experience", value: data?.avgRating ?? 0 },
                        { label: "Wait Time", value: data?.avgWaitTime ?? 0 },
                        { label: "Staff Friendliness", value: data?.avgStaffFriendliness ?? 0 },
                        { label: "Quality of Care", value: data?.avgQualityOfCare ?? 0 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground w-36 shrink-0">{item.label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${item.value > 0 ? (item.value / 5) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-8 text-right">{item.value > 0 ? item.value.toFixed(1) : "—"}</span>
                        </div>
                      ))}
                    </div>
                    {data?.recommendRate != null && (
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
                      <p className="text-xs text-muted-foreground">Updated {format(new Date(dataUpdatedAt), "h:mm a")}</p>
                    )}
                  </div>
                  {!data?.entries?.length ? (
                    <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">No responses yet</p>
                      <p className="text-xs mt-1">Generate a link from a patient's profile and share it after their visit.</p>
                    </div>
                  ) : (
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
                                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${entry.wouldRecommend ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                    {entry.wouldRecommend ? <ThumbsUp className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3 rotate-180" />}
                                    {entry.wouldRecommend ? "Recommends" : "Would not recommend"}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mb-2">
                                {entry.waitTimeRating != null && <span className="text-xs text-muted-foreground">Wait: <span className="text-foreground font-medium">{entry.waitTimeRating}/5</span></span>}
                                {entry.staffFriendlinessRating != null && <span className="text-xs text-muted-foreground">Staff: <span className="text-foreground font-medium">{entry.staffFriendlinessRating}/5</span></span>}
                                {entry.qualityOfCareRating != null && <span className="text-xs text-muted-foreground">Care: <span className="text-foreground font-medium">{entry.qualityOfCareRating}/5</span></span>}
                              </div>
                              {entry.comment && <p className="text-sm text-muted-foreground italic">"{entry.comment}"</p>}
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{format(parseISO(entry.submittedAt), "d MMM yyyy")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "editor" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Form Questions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Edit labels and toggle questions on or off. Changes affect all future feedback forms.</p>
              </div>

              {configLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {localQuestions.map(q => {
                    const isRequired = q.required;
                    return (
                      <div
                        key={q.key}
                        className={`rounded-xl border p-4 transition-all ${q.enabled ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"}`}
                      >
                        <div className="flex items-start gap-3">
                          <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-1 shrink-0" />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                q.type === "rating" ? "bg-amber-500/10 text-amber-400" :
                                q.type === "recommend" ? "bg-emerald-500/10 text-emerald-400" :
                                "bg-blue-500/10 text-blue-400"
                              }`}>
                                {q.type === "rating" ? "⭐ Stars" : q.type === "recommend" ? "👍 Yes/No" : "💬 Text"}
                              </span>
                              {isRequired && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Required</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={q.label}
                              disabled={!q.enabled}
                              onChange={e => updateQuestion(q.key, { label: e.target.value })}
                              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isRequired}
                            onClick={() => updateQuestion(q.key, { enabled: !q.enabled })}
                            className={`shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${q.enabled ? "text-primary" : "text-muted-foreground"}`}
                            title={isRequired ? "Required questions cannot be disabled" : q.enabled ? "Click to disable" : "Click to enable"}
                          >
                            {q.enabled
                              ? <ToggleRight className="w-6 h-6" />
                              : <ToggleLeft className="w-6 h-6" />
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isDirty && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400 font-medium">
                  You have unsaved changes — click "Save Changes" to apply them.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Live Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">This is exactly what patients will see.</p>
                </div>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? "Hide" : "Show"} Preview
                </button>
              </div>

              {showPreview && (
                <div className="rounded-xl border border-border overflow-hidden bg-background">
                  <div className="bg-muted/30 px-3 py-1.5 border-b border-border text-xs text-muted-foreground font-medium">
                    Patient's view
                  </div>
                  <div className="overflow-y-auto max-h-[600px]">
                    <FeedbackForm token="" previewQuestions={localQuestions} />
                  </div>
                </div>
              )}

              {!showPreview && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-12 text-muted-foreground hover:border-primary/40 hover:text-primary transition"
                >
                  <Eye className="w-8 h-8 opacity-40" />
                  <span className="text-sm font-medium">Click to preview the form</span>
                  <span className="text-xs">See exactly what your patients will see</span>
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-6">
            {/* Period selector */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-0.5">Select Report Period</p>
                <p className="text-xs text-muted-foreground">Choose a period type, then the specific period you want.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["monthly", "weekly", "yearly"] as PeriodType[]).map(pt => (
                  <button key={pt} onClick={() => setPeriodType(pt)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${periodType === pt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {pt}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap items-end">
                {periodType === "monthly" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Month</p>
                    <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
                {periodType === "weekly" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Week</p>
                    <select value={selWeek} onChange={e => setSelWeek(Number(e.target.value))}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {Array.from({ length: 52 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
                    </select>
                  </div>
                )}
                {(periodType === "monthly" || periodType === "weekly" || periodType === "yearly") && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Year</p>
                    <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {REPORT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => setReportParams(computePeriod(periodType, selYear, selMonth, selWeek))}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold transition active:scale-95">
                  Generate
                </button>
              </div>
            </div>

            {/* Report output */}
            {reportParams && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold">Report: {reportParams.label}</p>
                    {reportData && <p className="text-xs text-muted-foreground mt-0.5">{reportData.total} {reportData.total === 1 ? "response" : "responses"} in this period</p>}
                  </div>
                  {reportData && reportData.total > 0 && (
                    <button
                      onClick={() => printFeedbackReport(reportData, hospital?.name ?? "Hospital", reportParams.label)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition active:scale-95"
                      style={{ background: "#0d9488" }}>
                      <Printer className="w-4 h-4" /> Print Report
                    </button>
                  )}
                </div>

                {reportLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !reportData?.entries?.length ? (
                  <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">No feedback for this period</p>
                    <p className="text-xs mt-1">Try a different period or check if feedback was collected during this time.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <KpiCard label="Total Responses" value={reportData.total} icon={MessageSquare} />
                      <KpiCard label="Overall Rating" value={reportData.avgRating ? `${reportData.avgRating}/5` : "—"} icon={Star} color="bg-amber-500" sub="avg score" />
                      <KpiCard label="Wait Time" value={reportData.avgWaitTime ? `${reportData.avgWaitTime}/5` : "—"} icon={Clock} sub="avg score" />
                      <KpiCard label="Staff" value={reportData.avgStaffFriendliness ? `${reportData.avgStaffFriendliness}/5` : "—"} icon={Users} sub="avg score" />
                      <KpiCard label="Quality of Care" value={reportData.avgQualityOfCare ? `${reportData.avgQualityOfCare}/5` : "—"} icon={Heart} sub="avg score" />
                      <KpiCard label="Would Recommend" value={reportData.recommendRate != null ? `${reportData.recommendRate}%` : "—"} icon={ThumbsUp} sub="of respondents" />
                    </div>
                    <div className="space-y-3">
                      {reportData.entries.map(entry => (
                        <div key={entry.id} className="rounded-xl border border-border bg-card p-4" style={{ borderLeft: "4px solid #0d9488" }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="font-medium text-sm">{entry.patientName ?? "Anonymous"}</span>
                                <StarDisplay rating={entry.rating} />
                                <span className="text-sm font-bold text-amber-400">{entry.rating}/5</span>
                                {entry.wouldRecommend != null && (
                                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${entry.wouldRecommend ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                    {entry.wouldRecommend ? <ThumbsUp className="w-3 h-3" /> : <ThumbsUp className="w-3 h-3 rotate-180" />}
                                    {entry.wouldRecommend ? "Recommends" : "Would not recommend"}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mb-2">
                                {entry.waitTimeRating != null && <span className="text-xs text-muted-foreground">Wait: <span className="text-foreground font-medium">{entry.waitTimeRating}/5</span></span>}
                                {entry.staffFriendlinessRating != null && <span className="text-xs text-muted-foreground">Staff: <span className="text-foreground font-medium">{entry.staffFriendlinessRating}/5</span></span>}
                                {entry.qualityOfCareRating != null && <span className="text-xs text-muted-foreground">Care: <span className="text-foreground font-medium">{entry.qualityOfCareRating}/5</span></span>}
                              </div>
                              {entry.comment && <p className="text-sm text-muted-foreground italic">"{entry.comment}"</p>}
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{format(parseISO(entry.submittedAt), "d MMM yyyy")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
