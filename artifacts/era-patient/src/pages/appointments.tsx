import { useState } from "react";
import { format } from "date-fns";
import { 
  useListAppointments,
  getListAppointmentsQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Clock, User, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Appointments() {
  const [dateFilter] = useState<string>("");

  const { data: appointments, isLoading } = useListAppointments(
    { date: dateFilter || undefined },
    { query: { queryKey: getListAppointmentsQueryKey({ date: dateFilter || undefined }) } }
  );

  return (
    <Layout>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground mt-1">
              Manage clinic schedule and upcoming visits.
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Schedule
          </Button>
        </div>

        <div className="flex-1 bg-card rounded-lg border border-border p-6 overflow-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : appointments?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Calendar className="w-12 h-12 mb-4 opacity-20" />
              <p>No appointments found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments?.map((apt) => (
                <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-border rounded-lg bg-background hover:border-primary/50 transition-colors">
                  <div className="w-16 h-16 rounded-lg bg-secondary flex flex-col items-center justify-center shrink-0 border border-border">
                    <span className="text-xs font-bold text-primary uppercase">{format(new Date(apt.scheduledAt), "MMM")}</span>
                    <span className="text-xl font-bold leading-none">{format(new Date(apt.scheduledAt), "d")}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{apt.patientName}</h3>
                      <Badge variant={apt.status === 'scheduled' ? 'default' : apt.status === 'completed' ? 'secondary' : 'destructive'} className="text-[10px] h-5">
                        {apt.status}
                      </Badge>
                    </div>
                    
                    <div className="text-sm font-medium text-primary mb-2">{apt.title}</div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {format(new Date(apt.scheduledAt), "h:mm a")} ({apt.duration || 30} min)</span>
                      <span className="flex items-center gap-1"><User className="w-4 h-4" /> {apt.doctor}</span>
                      {apt.notes && <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Notes attached</span>}
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <Button variant="outline" size="sm">Details</Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">Reschedule</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}