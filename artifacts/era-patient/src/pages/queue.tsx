import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListQueue,
  useListPatients,
  useCheckinPatient,
  useDequeuePatient,
  useCreateAppointment,
  getListQueueQueryKey,
  getListPatientsQueryKey,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Users, Clock, Search, UserPlus, Loader2, RefreshCw, Star, CalendarPlus, X } from "lucide-react";

function waitTime(addedAt: string) {
  const diff = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000);
  if (diff < 1) return "Just added";
  if (diff === 1) return "1 min";
  return `${diff} mins`;
}

const EMPTY_APT_FORM = {
  patientId: 0,
  patientName: "",
  title: "",
  date: "",
  time: "",
  duration: "30",
};

export default function QueueManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [aptForm, setAptForm] = useState(EMPTY_APT_FORM);
  const [showSchedule, setShowSchedule] = useState(false);
  const [aptSearch, setAptSearch] = useState("");

  const { data: queue = [], refetch: refetchQueue, isLoading: queueLoading } = useListQueue({
    query: { refetchInterval: 5000 },
  });
  const { data: searchResults = [], isFetching: searching } = useListPatients(
    { search },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: search.trim().length >= 2 } as any }
  );
  const { data: aptSearchResults = [], isFetching: aptSearching } = useListPatients(
    { search: aptSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: aptSearch.trim().length >= 2 } as any }
  );

  const checkin = useCheckinPatient({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Added to queue", description: `${patient.firstName} ${patient.lastName} is now queued.` });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setSearch("");
      },
      onError: () => toast({ title: "Failed to add to queue", variant: "destructive" }),
    },
  });

  const dequeue = useDequeuePatient({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Removed from queue", description: `${patient.firstName} ${patient.lastName} returned to ${patient.stage}.` });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    },
  });

  const createAppointment = useCreateAppointment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Appointment scheduled" });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setShowSchedule(false);
        setAptForm(EMPTY_APT_FORM);
        setAptSearch("");
      },
      onError: () => toast({ title: "Failed to schedule", variant: "destructive" }),
    },
  });

  useEffect(() => {
    const interval = setInterval(() => refetchQueue(), 30000);
    return () => clearInterval(interval);
  }, [refetchQueue]);

  const handleScheduleApt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptForm.patientId || !aptForm.title || !aptForm.date || !aptForm.time) return;
    createAppointment.mutate({
      data: {
        patientId: aptForm.patientId,
        title: aptForm.title,
        scheduledAt: `${aptForm.date}T${aptForm.time}:00`,
        duration: parseInt(aptForm.duration) || 30,
      },
    });
  };

  const selectAptPatient = (p: Patient) => {
    setAptForm(f => ({ ...f, patientId: p.id, patientName: `${p.firstName} ${p.lastName}` }));
    setAptSearch("");
  };


  const filteredPatients = search.trim().length >= 2
    ? searchResults.filter((p) => !queue.some((q) => q.patientId === p.id))
    : [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Queue Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Live patient queue — auto-refreshes every 30 seconds</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)} className="gap-2">
              <CalendarPlus className="w-4 h-4" />
              Schedule Appointment
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchQueue()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Schedule Appointment Modal */}
        {showSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <form onSubmit={handleScheduleApt} className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Schedule Appointment</h2>
                <button type="button" onClick={() => { setShowSchedule(false); setAptForm(EMPTY_APT_FORM); setAptSearch(""); }}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Patient search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Patient *</label>
                {aptForm.patientId ? (
                  <div className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {aptForm.patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{aptForm.patientName}</span>
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setAptForm(f => ({ ...f, patientId: 0, patientName: "" }))}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Search patient by name, ID, or phone..."
                        value={aptSearch}
                        onChange={(e) => setAptSearch(e.target.value)}
                      />
                      {aptSearching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {aptSearch.trim().length >= 2 && aptSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {aptSearchResults.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectAptPatient(p)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-left text-sm"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {p.firstName[0]}{p.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{p.firstName} {p.lastName}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.patientId && <span className="mr-2">ID: {p.patientId}</span>}
                                {p.stage}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Appointment Title *</label>
                <Input
                  placeholder="e.g. Follow-up Consultation"
                  value={aptForm.title}
                  onChange={(e) => setAptForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date *</label>
                  <Input type="date" value={aptForm.date} onChange={(e) => setAptForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Time *</label>
                  <Input type="time" value={aptForm.time} onChange={(e) => setAptForm(f => ({ ...f, time: e.target.value }))} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Duration (min)</label>
                <Input
                  type="number"
                  min={10}
                  max={180}
                  value={aptForm.duration}
                  onChange={(e) => setAptForm(f => ({ ...f, duration: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" onClick={() => { setShowSchedule(false); setAptForm(EMPTY_APT_FORM); setAptSearch(""); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAppointment.isPending || !aptForm.patientId}>
                  {createAppointment.isPending ? "Scheduling..." : "Confirm Appointment"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Live Queue */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Current Queue</span>
            <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
              {queue.length} waiting
            </span>
          </div>

          {queueLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Queue is empty</div>
          ) : (
            <div className="divide-y divide-border">
              {queue.map((entry) => (
                <div key={entry.id} className={`flex items-center gap-4 px-4 py-3 ${entry.position === 1 && entry.appointmentId ? "bg-primary/5" : ""}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {entry.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm leading-none">{entry.patientName}</p>
                      {entry.appointmentId && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                          <Star className="w-3 h-3" />
                          Appointment
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                      {entry.patientCode && <span className="font-mono">ID: {entry.patientCode}</span>}
                      {entry.stage && <span>was: {entry.stage}</span>}
                      {entry.email && <span>{entry.email}</span>}
                      {entry.whatsappNumber && <span>WA: {entry.whatsappNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {waitTime(entry.addedAt)}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Tick when patient is called in">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (confirm(`Mark ${entry.patientName} as called in?`)) {
                            dequeue.mutate({ id: entry.patientId });
                          } else {
                            e.target.checked = false;
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Called in</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search & Add to Queue */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Add Patient to Queue</span>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Search for an existing patient, or register a new file for first-time visitors.
            </p>
            <div className="relative">
              <Input
                placeholder="Search by name, hospital ID, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {search.trim().length >= 2 && (
              <div className="space-y-2">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <div key={patient.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                          {patient.patientId && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">ID: {patient.patientId}</span>}
                          <span>{patient.stage}</span>
                          <span>{patient.email}</span>
                          {patient.whatsappNumber && <span>WA: {patient.whatsappNumber}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => checkin.mutate({ id: patient.id })}
                        disabled={checkin.isPending}
                      >
                        Add to Queue
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">No patient found for "{search}"</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setLocation("/patients/new")}
                    >
                      <UserPlus className="w-4 h-4" />
                      Register New Patient
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}
