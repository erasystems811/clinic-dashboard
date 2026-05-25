import { 
  useListActivity,
  getListActivityQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { Activity as ActivityIcon, UserPlus, Calendar, Edit, ShieldAlert, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLog() {
  const { data: activities, isLoading } = useListActivity(
    { limit: 50 },
    { query: { queryKey: getListActivityQueryKey({ limit: 50 }) } }
  );

  const getIconForType = (type: string) => {
    switch (type) {
      case 'patient_created': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'appointment_scheduled': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'patient_updated': return <Edit className="w-4 h-4 text-orange-500" />;
      case 'patient_deleted': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'alert': return <ShieldAlert className="w-4 h-4 text-red-500" />;
      default: return <ActivityIcon className="w-4 h-4 text-primary" />;
    }
  };

  const isDestructive = (type: string) => type === 'patient_deleted';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground mt-1">
            System-wide activity and audit trail.
          </p>
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
          ) : (
            <div className="relative border-l border-border ml-4 space-y-8 pb-4">
              {activities?.map((activity) => {
                const destructive = isDestructive(activity.type);
                return (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center z-10">
                      {getIconForType(activity.type)}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-medium leading-snug ${destructive ? "text-red-700 dark:text-red-400" : ""}`}>
                          {activity.description}
                        </p>
                        {activity.patientName && (
                          <p className={`text-xs mt-1 font-medium ${destructive ? "text-red-500 dark:text-red-500" : "text-primary"}`}>
                            Patient: {activity.patientName}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(activity.createdAt), "MMM d, h:mm a")}
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