import { useState } from "react";
import { format, isWithinInterval, subMinutes, addMinutes } from "date-fns";
import {
  useListAppointments,
  useUpdateAppointment,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import type { Appointment } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, User, AlertTriangle, RefreshCw, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  no_show: "bg-destructive/10 text-destructive",
  rescheduled: "bg-amber-500/10 text-amber-400",
  completed: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  no_show: "No Show",
  rescheduled: "Rescheduled",
  completed: "Completed",
};

function isUpcomingNow(scheduledAt: string) {
  const t = new Date(scheduledAt);
  return isWithinInterval(t, { start: subMinutes(new Date(), 30), end: addMinutes(new Date(), 30) });
}

function AppointmentCard({ apt, onNoShow, onReschedule, showActions }: {
  apt: Appointment;
  onNoShow: (id: number) => void;
  onReschedule: (apt: Appointment) => void;
  showActions: boolean;
}) {
  const soon = isUpcomingNow(apt.scheduledAt);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-background transition-colors ${soon ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"}`}>
      <div className="w-16 h-16 rounded-lg bg-secondary flex flex-col items-center justify-center shrink-0 border border-border">
        <span className="text-xs font-bold text-primary uppercase">{format(new Date(apt.scheduledAt), "MMM")}</span>
        <span className="text-xl font-bold leading-none">{format(new Date(apt.scheduledAt), "d")}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold">{apt.patientName}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[apt.status] ?? STATUS_STYLES.scheduled}`}>
            {STATUS_LABELS[apt.status] ?? apt.status}
          </span>
          {soon && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              Upcoming now
            </span>
          )}
        </div>
        <div className="text-sm font-medium text-primary mb-1">{apt.title}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(new Date(apt.scheduledAt), "h:mm a")} ({apt.duration ?? 30} min)</span>
          {apt.department && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{apt.department}</span>}
        </div>
      </div>

      {showActions && apt.status === "scheduled" && (
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
            onClick={() => onNoShow(apt.id)}
          >
            <X className="w-3.5 h-3.5" />
            No Show
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReschedule(apt)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reschedule
          </Button>
        </div>
      )}

      {showActions && apt.status === "no_show" && (
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onReschedule(apt)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reschedule
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Appointments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isReceptionist = user?.role === "receptionist";
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const { data: appointments = [], isLoading } = useListAppointments({}, {});

  const updateAppointment = useUpdateAppointment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const handleNoShow = (id: number) => {
    if (!confirm("Mark this patient as a no-show? A call task will be created for follow-up.")) return;
    updateAppointment.mutate({ id, data: { status: "no_show" } });
    toast({ title: "No-show recorded", description: "A call task has been created for the receptionist." });
  };

  const handleReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !newDate || !newTime) return;
    const scheduledAt = `${newDate}T${newTime}:00`;
    updateAppointment.mutate(
      { id: rescheduleTarget.id, data: { status: "scheduled", scheduledAt } },
      {
        onSuccess: () => {
          toast({ title: "Appointment rescheduled" });
          setRescheduleTarget(null);
          setNewDate("");
          setNewTime("");
        },
      }
    );
  };

  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const noShows = appointments.filter((a) => a.status === "no_show");
  const rescheduled = appointments.filter((a) => a.status === "rescheduled");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Scheduled visits — completed appointments are removed automatically when patients check in.
          </p>
        </div>

        {/* Reschedule modal */}
        {rescheduleTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <form onSubmit={handleReschedule} className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h2 className="font-semibold text-lg">Reschedule Appointment</h2>
              <p className="text-sm text-muted-foreground">{rescheduleTarget.patientName} — {rescheduleTarget.title}</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">New Date</label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">New Time</label>
                  <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setRescheduleTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={updateAppointment.isPending}>
                  {updateAppointment.isPending ? "Saving..." : "Confirm Reschedule"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 p-4 border border-border rounded-lg">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Calendar className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No upcoming appointments</p>
          </div>
        ) : (
          <div className="space-y-6">
            {scheduled.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scheduled ({scheduled.length})</h2>
                {scheduled.map((apt) => (
                  <AppointmentCard key={apt.id} apt={apt} onNoShow={handleNoShow} onReschedule={setRescheduleTarget} showActions={isReceptionist} />
                ))}
              </div>
            )}

            {noShows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">No Shows ({noShows.length})</h2>
                </div>
                {noShows.map((apt) => (
                  <AppointmentCard key={apt.id} apt={apt} onNoShow={handleNoShow} onReschedule={setRescheduleTarget} showActions={isReceptionist} />
                ))}
              </div>
            )}

            {rescheduled.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rescheduled ({rescheduled.length})</h2>
                {rescheduled.map((apt) => (
                  <AppointmentCard key={apt.id} apt={apt} onNoShow={handleNoShow} onReschedule={setRescheduleTarget} showActions={isReceptionist} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
