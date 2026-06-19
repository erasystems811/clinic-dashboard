import { useEffect } from "react";
import { Users, Calendar, AlertCircle, Clock, UserX, Star, Send, Activity, Wallet, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import { PIPELINE_STAGES } from "@/types";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

const TOTAL = 248;

export default function S01_Dashboard({ prospect, onNext }: Props) {
  useEffect(() => {
    const t = setTimeout(onNext, 5000);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="relative space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Live overview of clinic activity and patient pipeline.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">248</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-primary font-medium">+14</span> new this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Appointments Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground mt-1">23 total this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Active Patients</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">12</div>
            <p className="text-xs text-muted-foreground mt-1">In queue or active care</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14<span className="text-sm font-normal ml-1">min</span></div>
            <span className="flex items-center gap-0.5 text-xs font-medium text-green-500 mt-1">
              <TrendingDown className="h-3 w-3" /> Decreasing vs last month
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>No-show Rate</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8<span className="text-sm font-normal ml-1">%</span></div>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground mt-1">
              <Minus className="h-3 w-3" /> Stable vs last month
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Patient Feedback</CardTitle>
            <Star className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.7<span className="text-sm font-normal ml-1 text-muted-foreground">/ 5</span></div>
            <p className="text-xs text-muted-foreground mt-1">182 total responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground mt-1">All services operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>SMS Wallet</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">₦2,450</div>
            <p className="text-xs text-muted-foreground mt-1">Fund in Settings if low</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline breakdown */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Pipeline Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.name} className="flex items-center">
                <div className="w-32 text-sm font-medium">{stage.name}</div>
                <div className="flex-1 px-4">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (stage.count / TOTAL) * 100)}%`,
                        backgroundColor: stage.color,
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

      <NarrationBubble
        text={<>This is <strong>your clinic at a glance</strong>. Every morning, you know exactly what's happening — patients, wait times, automations, wallet — all in one place.</>}
        onNext={onNext}
        nextLabel="Next →"
      />
    </div>
  );
}
