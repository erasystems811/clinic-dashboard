import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Calendar, AlertCircle, Star, Clock, Send, TrendingUp, TrendingDown, Minus, UserX, Info, TriangleAlert, RefreshCw, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "update";
  createdAt: string;
}

function AnnouncementBanners({ token }: { token: string }) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/hospital/announcements"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {});
  }, [token]);

  const dismiss = async (id: number) => {
    setItems(prev => prev.filter(a => a.id !== id));
    await fetch(apiUrl(`/api/hospital/announcements/${id}/dismiss`), {
      method: "POST",
      headers: { "x-hospital-token": token },
    }).catch(() => {});
  };

  if (!items.length) return null;

  const STYLES: Record<string, { banner: string; icon: typeof Info }> = {
    info:    { banner: "border-blue-500/30 bg-blue-500/5 text-blue-300",    icon: Info },
    warning: { banner: "border-amber-500/30 bg-amber-500/5 text-amber-300", icon: TriangleAlert },
    update:  { banner: "border-primary/30 bg-primary/5 text-primary",       icon: RefreshCw },
  };

  return (
    <div className="space-y-3">
      {items.map(a => {
        const s = STYLES[a.type] ?? STYLES.info;
        const Icon = s.icon;
        return (
          <div key={a.id} className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${s.banner}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="text-sm mt-0.5 opacity-90 whitespace-pre-wrap">{a.message}</p>
              <p className="text-xs opacity-60 mt-1">{format(new Date(a.createdAt), "d MMM yyyy")}</p>
            </div>
            <button onClick={() => dismiss(a.id)} className="shrink-0 opacity-60 hover:opacity-100 transition mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TrendBadge({ trend, goodDirection = "down" }: { trend?: "up" | "down" | "stable" | null; goodDirection?: "up" | "down" }) {
  if (!trend || trend === "stable") return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> Stable vs last month</span>;
  const isGood = trend === goodDirection;
  if (trend === "up") return <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-green-600" : "text-red-500"}`}><TrendingUp className="h-3 w-3" /> Increasing vs last month</span>;
  return <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? "text-green-600" : "text-red-500"}`}><TrendingDown className="h-3 w-3" /> Decreasing vs last month</span>;
}

export default function Dashboard() {
  const { hospitalConfig, hospital } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;
  const feedbackEnabled = hospitalConfig?.modules?.feedbackEnabled ?? true;
  const wellnessEnabled = hospitalConfig?.modules?.wellnessNewsletterEnabled ?? true;

  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 30000 },
  });

  // Filter "Booked" from pipeline breakdown when appointments module is off
  const breakdown = (summary?.pipelineBreakdown ?? []).filter(
    s => apptEnabled || s.name !== "Booked"
  );

  return (
    <Layout>
      <div className="space-y-8">
        {hospital?.token && <AnnouncementBanners token={hospital.token} />}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Live overview of clinic activity and patient pipeline.</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-1/2" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-16 mb-1" /><Skeleton className="h-3 w-2/3" /></CardContent>
              </Card>
            ))}
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalPatients}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-primary font-medium">+{summary.newPatientsThisMonth}</span> new this month
                  </p>
                </CardContent>
              </Card>

              {apptEnabled && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Appointments Today</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.appointmentsToday}</div>
                    <p className="text-xs text-muted-foreground mt-1">{summary.appointmentsThisWeek} total this week</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-400">{summary.criticalAlerts}</div>
                  <p className="text-xs text-muted-foreground mt-1">{feedbackEnabled ? "In queue or active care" : "In active care"}</p>
                </CardContent>
              </Card>

              {feedbackEnabled && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.avgWaitMinutes ?? 0}<span className="text-sm font-normal ml-1">min</span></div>
                    <div className="mt-1"><TrendBadge trend={summary.avgWaitTrend} goodDirection="down" /></div>
                  </CardContent>
                </Card>
              )}

              {apptEnabled && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">No-show Rate</CardTitle>
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.noShowRate ?? 0}<span className="text-sm font-normal ml-1">%</span></div>
                    <div className="mt-1"><TrendBadge trend={summary.noShowTrend} goodDirection="down" /></div>
                  </CardContent>
                </Card>
              )}

              {feedbackEnabled && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Patient Feedback</CardTitle>
                    <Star className="h-4 w-4 text-amber-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.avgFeedbackRating ? Number(summary.avgFeedbackRating).toFixed(1) : "—"}
                      <span className="text-sm font-normal ml-1 text-muted-foreground">/ 5</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{summary.totalFeedback ?? 0} total responses</p>
                  </CardContent>
                </Card>
              )}

              {wellnessEnabled && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Wellness Newsletter</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {summary.wellnessLastSentAt
                        ? format(parseISO(summary.wellnessLastSentAt), "MMM d, yyyy")
                        : "Never sent"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Last delivery date</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">Healthy</div>
                  <p className="text-xs text-muted-foreground mt-1">All services operational</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Pipeline Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    {breakdown.map(stage => (
                      <div key={stage.id} className="flex items-center">
                        <div className="w-32 text-sm font-medium">{stage.name}</div>
                        <div className="flex-1 px-4">
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${summary.totalPatients > 0 ? Math.max(2, (stage.count / summary.totalPatients) * 100) : 0}%`,
                                backgroundColor: stage.color
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-12 text-right text-sm font-medium">{stage.count}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Failed to load dashboard data.</div>
        )}
      </div>
    </Layout>
  );
}
