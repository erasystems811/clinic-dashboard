import { useState, useMemo, useEffect } from "react";
import {
  format, isWithinInterval, subMinutes, addMinutes,
  startOfWeek, addDays, addWeeks, subWeeks, isSameDay,
  parseISO, setHours, setMinutes, isToday,
} from "date-fns";
import {
  useListAppointments,
  useUpdateAppointment,
  useCreateAppointment,
  useListPatients,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import type { Appointment } from "@workspace/api-client-react";
import { getPatientStages } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar, Clock, AlertTriangle, RefreshCw, X,
  CalendarPlus, ChevronLeft, ChevronRight, Loader2, Search, MessageSquare,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";

/* ──────────────────────────────────────────────
   Constants
────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
  scheduled:   "bg-primary/10 text-primary",
  no_show:     "bg-destructive/10 text-destructive",
  rescheduled: "bg-amber-500/10 text-amber-400",
  completed:   "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled", no_show: "No Show",
  rescheduled: "Rescheduled", completed: "Completed",
};

// Clinic hours: 8 am → 6 pm, 30-min slots
const HOUR_START = 8;
const HOUR_END   = 18;
const SLOT_MINS  = 30;
const HOURS = Array.from({ length: (HOUR_END - HOUR_START) * (60 / SLOT_MINS) }, (_, i) => {
  const total = HOUR_START * 60 + i * SLOT_MINS;
  return { h: Math.floor(total / 60), m: total % 60, label: format(setMinutes(setHours(new Date(), Math.floor(total / 60)), total % 60), "h:mm a") };
});
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isUpcomingNow(scheduledAt: string) {
  const t = new Date(scheduledAt);
  return isWithinInterval(t, { start: subMinutes(new Date(), 30), end: addMinutes(new Date(), 30) });
}

/* ──────────────────────────────────────────────
   Book Appointment Modal (shared)
────────────────────────────────────────────── */
function BookModal({
  prefillDate, prefillTime, onClose,
}: {
  prefillDate?: string;
  prefillTime?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{ id: number; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(prefillDate ?? "");
  const [time, setTime] = useState(prefillTime ?? "");
  const [duration, setDuration] = useState("30");

  const { data: results = [], isFetching } = useListPatients(
    { search },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: search.trim().length >= 2 } as any }
  );

  const create = useCreateAppointment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Appointment booked" });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        onClose();
      },
      onError: () => toast({ title: "Failed to book appointment", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !title || !date || !time) return;
    if (new Date(`${date}T${time}:00`) < new Date()) {
      toast({ title: "Cannot book in the past", description: "Please choose a future date and time.", variant: "destructive" });
      return;
    }
    create.mutate({
      data: {
        patientId: selectedPatient.id,
        title,
        scheduledAt: `${date}T${time}:00+01:00`, // WAT (Africa/Lagos = UTC+1)
        duration: parseInt(duration) || 30,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Book New Appointment</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Patient search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Patient *</label>
          {selectedPatient ? (
            <div className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                {selectedPatient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <span className="flex-1 text-sm font-medium">{selectedPatient.name}</span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSelectedPatient(null); setSearch(""); }}>
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-9"
                />
                {isFetching
                  ? <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                  : <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />}
              </div>
              {search.trim().length >= 2 && results.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border border-border bg-background p-1">
                  {results.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient({ id: p.id, name: `${p.firstName} ${p.lastName}` }); setSearch(""); }}
                      className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted/60 text-left text-sm"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.patientId && <span className="mr-1.5">ID: {p.patientId}</span>}
                          {p.email && <span className="mr-1.5">{p.email}</span>}
                          {getPatientStages(p as never).map(s => <span key={s} className="capitalize">{s}</span>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, " · ", el], [])}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && results.length === 0 && !isFetching && (
                <p className="text-xs text-muted-foreground text-center py-2">No patients found</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Appointment Title *</label>
          <Input placeholder="e.g. Follow-up Consultation" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date *</label>
            <Input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Time *</label>
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Duration</label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          >
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !selectedPatient || !title || !date || !time}>
            {create.isPending ? "Booking..." : "Confirm Booking"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Appointment Card
────────────────────────────────────────────── */
function isOverdue2Hours(scheduledAt: string) {
  return new Date().getTime() - new Date(scheduledAt).getTime() > 2 * 60 * 60 * 1000;
}

function AppointmentCard({ apt, onCancel, onReschedule, onNoShow, showActions }: {
  apt: Appointment;
  onCancel: (id: number) => void;
  onReschedule: (apt: Appointment) => void;
  onNoShow: (id: number) => void;
  showActions: boolean;
}) {
  const soon = isUpcomingNow(apt.scheduledAt);
  const overdue = isOverdue2Hours(apt.scheduledAt);
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-background transition-colors ${soon ? "border-primary/50 bg-primary/5" : overdue && apt.status === "scheduled" ? "border-destructive/30 bg-destructive/5" : "border-border hover:border-border/80"}`}>
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
          {soon && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Upcoming now</span>}
          {overdue && apt.status === "scheduled" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">2h+ overdue</span>}
        </div>
        <div className="text-sm font-medium text-primary mb-1">{apt.title}</div>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {format(new Date(apt.scheduledAt), "EEE d MMM, h:mm a")} ({apt.duration ?? 30} min)
        </span>
      </div>
      {showActions && apt.status === "scheduled" && (
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => onReschedule(apt)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reschedule
          </Button>
          {overdue && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-500 hover:text-amber-400 border-amber-500/30 hover:border-amber-400/60"
              onClick={() => onNoShow(apt.id)}
            >
              <AlertTriangle className="w-3.5 h-3.5" />No Show
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60" onClick={() => onCancel(apt.id)}>
            <X className="w-3.5 h-3.5" />Cancel
          </Button>
        </div>
      )}
      {showActions && apt.status === "no_show" && (
        <Button variant="outline" size="sm" onClick={() => onReschedule(apt)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Reschedule
        </Button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Calendar View
────────────────────────────────────────────── */
function CalendarView({
  appointments,
  onBook,
}: {
  appointments: Appointment[];
  onBook: (date: string, time: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Build a map: "YYYY-MM-DD HH:MM" → appointment
  const slotMap = useMemo(() => {
    const m: Record<string, Appointment[]> = {};
    for (const apt of appointments) {
      if (apt.status === "no_show" || apt.status === "completed") continue;
      const d = new Date(apt.scheduledAt);
      const key = format(d, "yyyy-MM-dd HH:mm");
      if (!m[key]) m[key] = [];
      m[key].push(apt);
    }
    return m;
  }, [appointments]);

  // Check if a slot is blocked (has an appointment within duration window)
  function isBlocked(day: Date, h: number, m: number): Appointment | null {
    const slotStart = setMinutes(setHours(day, h), m);
    for (const apt of appointments) {
      if (apt.status === "no_show" || apt.status === "completed") continue;
      const aptStart = new Date(apt.scheduledAt);
      const aptEnd = addMinutes(aptStart, apt.duration ?? 30);
      if (isSameDay(aptStart, day)) {
        if (slotStart >= aptStart && slotStart < aptEnd) return apt;
      }
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            onClick={() => setWeekStart(w => subWeeks(w, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          </span>
          <button
            type="button"
            className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500/25 border-l-2 border-teal-400 inline-block" />Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-card border border-border inline-block" />Free (click to book)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted/40 border border-border inline-block" />Past</span>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          <div className="py-2.5 px-2 text-xs text-muted-foreground border-r border-border" />
          {days.map((day, i) => (
            <div
              key={i}
              className={`py-2.5 text-center border-r border-border last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}
            >
              <p className="text-xs text-muted-foreground font-medium">{DAYS[i]}</p>
              <p className={`text-lg font-bold leading-tight ${isToday(day) ? "text-primary" : ""}`}>
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>

        {/* Time rows */}
        <div className="overflow-y-auto max-h-[520px]">
          {HOURS.map(({ h, m, label }) => (
            <div
              key={`${h}:${m}`}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: "64px repeat(7, 1fr)", minHeight: "40px" }}
            >
              {/* Time label */}
              <div className="px-2 py-1 text-xs text-muted-foreground border-r border-border flex items-start pt-1.5 shrink-0">
                {m === 0 ? label : ""}
              </div>

              {/* Day cells */}
              {days.map((day, di) => {
                const slotDate = setMinutes(setHours(day, h), m);
                const isPast = slotDate < new Date();
                const blocker = isBlocked(day, h, m);
                const slotKey = format(slotDate, "yyyy-MM-dd HH:mm");
                const isSlotStart = slotMap[slotKey]?.length > 0;

                if (isPast) {
                  return (
                    <div key={di} className="border-r border-border last:border-r-0 bg-muted/20" />
                  );
                }

                if (blocker) {
                  const isStart = format(new Date(blocker.scheduledAt), "yyyy-MM-dd HH:mm") === slotKey;
                  return (
                    <div
                      key={di}
                      className={`border-r border-border last:border-r-0 px-1 py-0.5 ${isStart ? "bg-teal-500/25 border-l-2 border-l-teal-400" : "bg-teal-500/15"}`}
                      title={`${blocker.patientName} — ${blocker.title}`}
                    >
                      {isStart && (
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-teal-300 truncate leading-tight">{blocker.patientName}</p>
                          <p className="text-xs text-teal-400/80 truncate leading-tight">{blocker.title}</p>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={di}
                    type="button"
                    className={`border-r border-border last:border-r-0 hover:bg-primary/5 transition-colors group relative ${isToday(day) ? "bg-primary/3" : ""}`}
                    onClick={() => onBook(format(day, "yyyy-MM-dd"), `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)}
                    title={`Book at ${label} on ${format(day, "EEE d MMM")}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <CalendarPlus className="w-3 h-3 text-primary" />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Click any free (white) slot to book an appointment at that time. Grayed slots are in the past.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Page
────────────────────────────────────────────── */
export default function Appointments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hospitalConfig, hospital } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;
  const isReceptionist = user?.role === "receptionist" || user?.role === "admin";

  const [smsModules, setSmsModules] = useState<{ appointmentReminderSmsEnabled: boolean } | null>(null);
  const [smsToggleSaving, setSmsToggleSaving] = useState(false);

  useEffect(() => {
    if (!hospital?.token) return;
    fetch(apiUrl("/api/hospital/sms-modules"), { headers: { "x-hospital-token": hospital.token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSmsModules({ appointmentReminderSmsEnabled: (data as Record<string, unknown>).appointmentReminderSmsEnabled as boolean }); });
  }, [hospital?.token]);

  const handleSmsToggle = async (value: boolean) => {
    if (!hospital?.token || smsToggleSaving) return;
    setSmsToggleSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/sms-modules"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": hospital.token },
        body: JSON.stringify({ appointmentReminderSmsEnabled: value }),
      });
      if (res.ok) setSmsModules(prev => prev ? { ...prev, appointmentReminderSmsEnabled: value } : prev);
    } finally { setSmsToggleSaving(false); }
  };

  if (!apptEnabled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">Appointments is not available</p>
          <p className="text-xs text-muted-foreground">This feature is not enabled for your clinic.</p>
        </div>
      </Layout>
    );
  }

  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [showBook, setShowBook] = useState(false);
  const [bookPrefillDate, setBookPrefillDate] = useState("");
  const [bookPrefillTime, setBookPrefillTime] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "noshow"; id: number } | null>(null);

  const { data: appointments = [], isLoading } = useListAppointments({}, {});

  const updateAppointment = useUpdateAppointment({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }),
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const handleCancel = (id: number) => setConfirmAction({ type: "cancel", id });

  const handleNoShow = (id: number) => setConfirmAction({ type: "noshow", id });

  const executeConfirmedAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "cancel") {
      updateAppointment.mutate({ id: confirmAction.id, data: { status: "cancelled" } });
      toast({ title: "Appointment cancelled" });
    } else {
      updateAppointment.mutate({ id: confirmAction.id, data: { status: "no_show" } });
      toast({ title: "No-show flagged", description: "A follow-up call task has been created." });
    }
    setConfirmAction(null);
  };

  const handleReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !newDate || !newTime) return;
    updateAppointment.mutate(
      { id: rescheduleTarget.id, data: { status: "scheduled", scheduledAt: `${newDate}T${newTime}:00+01:00` } }, // WAT
      {
        onSuccess: () => {
          toast({ title: "Appointment rescheduled" });
          setRescheduleTarget(null); setNewDate(""); setNewTime("");
        },
      }
    );
  };

  const openBook = (date = "", time = "") => {
    setBookPrefillDate(date);
    setBookPrefillTime(time);
    setShowBook(true);
  };

  const upcoming = appointments
    .filter(a => a.status === "scheduled" || (a.status === "rescheduled" && new Date(a.scheduledAt) >= new Date()))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const past = appointments
    .filter(a => !(a.status === "scheduled" || (a.status === "rescheduled" && new Date(a.scheduledAt) >= new Date())))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Book, reschedule, and track patient visits
            </p>
          </div>
          <div className="flex items-center gap-3">
            {smsModules !== null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>SMS reminders</span>
                <button
                  onClick={() => handleSmsToggle(!smsModules.appointmentReminderSmsEnabled)}
                  disabled={smsToggleSaving}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${smsModules.appointmentReminderSmsEnabled ? "bg-primary" : "bg-muted-foreground/30"} disabled:opacity-50`}
                  role="switch"
                  aria-checked={smsModules.appointmentReminderSmsEnabled}
                  title={smsModules.appointmentReminderSmsEnabled ? "SMS reminders on — click to disable" : "SMS reminders off — click to enable"}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${smsModules.appointmentReminderSmsEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            )}
            {isReceptionist && (
              <Button className="gap-2" onClick={() => openBook()}>
                <CalendarPlus className="w-4 h-4" />
                Book Appointment
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Appointments
          </button>
          <button
            type="button"
            onClick={() => setTab("calendar")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${tab === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
        </div>

        {/* ── LIST TAB ── */}
        {tab === "list" && (
          isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
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
              <p className="text-sm mb-4">No appointments yet</p>
              {isReceptionist && (
                <Button variant="outline" className="gap-2" onClick={() => openBook()}>
                  <CalendarPlus className="w-4 h-4" />
                  Book First Appointment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming */}
              {upcoming.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Upcoming · {upcoming.length}
                  </p>
                  {upcoming.map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} onCancel={handleCancel} onReschedule={setRescheduleTarget} onNoShow={handleNoShow} showActions={isReceptionist} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Calendar className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm">No upcoming appointments</p>
                  {isReceptionist && (
                    <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => openBook()}>
                      <CalendarPlus className="w-4 h-4" />Book Appointment
                    </Button>
                  )}
                </div>
              )}

              {/* Past — permanent ledger */}
              {past.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                      History · {past.length}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {past.map(apt => (
                    <AppointmentCard key={apt.id} apt={apt} onCancel={handleCancel} onReschedule={setRescheduleTarget} onNoShow={handleNoShow} showActions={isReceptionist} />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (
          <CalendarView
            appointments={appointments}
            onBook={(date, time) => isReceptionist ? openBook(date, time) : undefined}
          />
        )}
      </div>

      {/* Cancel / No-show confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "cancel" ? "Cancel appointment?" : "Flag as no-show?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "cancel"
                ? "This appointment will be marked as cancelled."
                : "The patient will be flagged as a no-show and a follow-up call task will be created."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirmedAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmAction?.type === "cancel" ? "Yes, cancel it" : "Yes, flag no-show"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Book modal */}
      {showBook && (
        <BookModal
          prefillDate={bookPrefillDate}
          prefillTime={bookPrefillTime}
          onClose={() => setShowBook(false)}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleReschedule} className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Reschedule</h2>
              <button type="button" onClick={() => setRescheduleTarget(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{rescheduleTarget.patientName} — {rescheduleTarget.title}</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New Date</label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New Time</label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} required />
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
    </Layout>
  );
}
