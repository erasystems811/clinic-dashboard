import { useState } from "react";
import { useListActivity, getListActivityQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import {
  Activity as ActivityIcon, UserPlus, Calendar, Edit,
  ShieldAlert, Trash2, Search, X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 50;

function getIcon(type: string) {
  switch (type) {
    case "patient_created":        return <UserPlus className="w-4 h-4 text-green-500" />;
    case "appointment_scheduled":  return <Calendar className="w-4 h-4 text-blue-500" />;
    case "appointment_rescheduled":return <Calendar className="w-4 h-4 text-amber-500" />;
    case "appointment_cancelled":  return <Calendar className="w-4 h-4 text-destructive" />;
    case "patient_info_updated":   return <Edit className="w-4 h-4 text-orange-500" />;
    case "patient_deleted":        return <Trash2 className="w-4 h-4 text-destructive" />;
    case "alert":                  return <ShieldAlert className="w-4 h-4 text-destructive" />;
    default:                       return <ActivityIcon className="w-4 h-4 text-primary" />;
  }
}

export default function ActivityLog() {
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);

  const params = applied
    ? { limit: PAGE_SIZE, from: applied.from || undefined, to: applied.to || undefined }
    : { limit: PAGE_SIZE };

  const { data: activities, isLoading } = useListActivity(
    params,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { queryKey: getListActivityQueryKey(params) } as any }
  );

  const applyFilter = () => {
    if (!from && !to) { setApplied(null); return; }
    setApplied({ from, to });
  };

  const clearFilter = () => {
    setFrom(""); setTo(""); setApplied(null);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground mt-1">Full audit trail — search by date range to view any period.</p>
        </div>

        {/* Date range filter */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" />
            </div>
            <Button onClick={applyFilter} className="gap-2">
              <Search className="w-4 h-4" />
              Search
            </Button>
            {applied && (
              <Button variant="outline" size="sm" onClick={clearFilter} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
          {applied && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing up to {PAGE_SIZE} records
              {applied.from ? ` from ${format(parseISO(applied.from), "d MMM yyyy")}` : ""}
              {applied.to   ? ` to ${format(parseISO(applied.to), "d MMM yyyy")}` : ""}
            </p>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activities?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity found for this period.</p>
          ) : (
            <div className="relative border-l border-border ml-4 space-y-8 pb-4">
              {activities.map((activity) => {
                const destructive = activity.type === "patient_deleted";
                return (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center z-10">
                      {getIcon(activity.type)}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug break-words ${destructive ? "text-red-400" : ""}`}>
                          {activity.description}
                        </p>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {activity.patientName && (
                            <span className={`text-xs font-medium ${destructive ? "text-red-500" : "text-primary"}`}>
                              {activity.patientName}
                            </span>
                          )}
                          {activity.performedBy && (
                            <span className="text-xs text-muted-foreground">
                              by <span className="font-medium text-foreground">{activity.performedBy}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(activity.createdAt), "d MMM yyyy, h:mm a")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
