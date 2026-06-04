import { useState } from "react";
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
  useUpdatePatient,
  getListQueueQueryKey,
  getListPatientsQueryKey,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";

import { Users, Clock, Search, UserPlus, Loader2, RefreshCw, Star, Pencil, X } from "lucide-react";
import { getPatientStages } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

interface EditPatient {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  whatsappNumber: string;
  dateOfBirth: string;
  gender: string;
  patientId: string;
  notes: string;
}

function EditPatientModal({ patient, onClose, onSaved }: { patient: EditPatient; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const update = useUpdatePatient();
  const [form, setForm] = useState({ ...patient });

  const field = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: patient.id, data: {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        whatsappNumber: form.whatsappNumber || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        patientId: form.patientId || undefined,
        notes: form.notes || undefined,
      }},
      {
        onSuccess: () => {
          toast({ title: "Patient info updated" });
          onSaved();
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Update failed";
          toast({ title: "Could not update patient", description: msg, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Edit Patient Info</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">First Name</label>
              <Input value={form.firstName} onChange={field("firstName")} placeholder="First name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Last Name</label>
              <Input value={form.lastName} onChange={field("lastName")} placeholder="Last name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Phone</label>
              <Input value={form.phone} onChange={field("phone")} placeholder="Phone number" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">WhatsApp</label>
              <Input value={form.whatsappNumber} onChange={field("whatsappNumber")} placeholder="If different" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Email</label>
            <Input type="email" value={form.email} onChange={field("email")} placeholder="Email address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Date of Birth</label>
              <Input type="date" value={form.dateOfBirth} onChange={field("dateOfBirth")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Gender</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={field("gender")}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Patient ID / MRN</label>
            <Input value={form.patientId} onChange={field("patientId")} placeholder="e.g. PT-00123" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
              value={form.notes}
              onChange={field("notes")}
              placeholder="Any additional notes..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function waitTime(addedAt: string) {
  const diff = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000);
  if (diff < 1) return "Just added";
  if (diff === 1) return "1 min";
  return `${diff} mins`;
}

export default function QueueManagement() {
  const { hospitalConfig } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;
  const queueEnabled = hospitalConfig?.modules?.feedbackEnabled ?? true;

  if (!queueEnabled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">Queue Management is not available</p>
          <p className="text-xs text-muted-foreground">This feature is not enabled for your clinic.</p>
        </div>
      </Layout>
    );
  }
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [editPatient, setEditPatient] = useState<EditPatient | null>(null);

  const { data: queue = [], refetch: refetchQueue, isLoading: queueLoading, isFetching: queueFetching } = useListQueue({
    query: { refetchInterval: 5000 },
  });
  const { data: searchResults = [], isFetching: searching } = useListPatients(
    { search },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: search.trim().length >= 2 } as any }
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
        toast({ title: "Removed from queue", description: `${patient.firstName} ${patient.lastName} — now: ${getPatientStages(patient as never, { apptEnabled }).join(" · ")}.` });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    },
  });

  const filteredPatients = search.trim().length >= 2 ? searchResults : [];

  function handlePatientSaved() {
    queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
  }

  return (
    <Layout>
      {editPatient && (
        <EditPatientModal
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={handlePatientSaved}
        />
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Queue Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Live patient queue</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchQueue()} disabled={queueFetching} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${queueFetching ? "animate-spin" : ""}`} />
              {queueFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

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
                          {entry.appointmentScheduledAt && (
                            <span className="text-muted-foreground font-normal">
                              · {new Date(entry.appointmentScheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                      {entry.patientCode && <span className="font-mono">ID: {entry.patientCode}</span>}
                      {entry.department && <span>{entry.department}</span>}
                      {entry.email && <span>{entry.email}</span>}
                      {entry.whatsappNumber && <span>WA: {entry.whatsappNumber}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {waitTime(entry.addedAt)}
                  </div>
                  <button
                    onClick={() => setEditPatient({
                      id: entry.patientId,
                      firstName: (entry.patientName ?? "").split(" ")[0] ?? "",
                      lastName: (entry.patientName ?? "").split(" ").slice(1).join(" ") ?? "",
                      phone: entry.phone ?? "",
                      email: entry.email ?? "",
                      whatsappNumber: entry.whatsappNumber ?? "",
                      dateOfBirth: "",
                      gender: "",
                      patientId: entry.patientCode ?? "",
                      notes: "",
                    })}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Edit patient info"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Tick when patient is called in">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          dequeue.mutate({ id: entry.patientId });
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
                placeholder="Search by name or ID..."
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
                  filteredPatients.map((patient) => {
                    const alreadyQueued = queue.some((q) => q.patientId === patient.id);
                    return (
                      <div key={patient.id} className={`flex items-center gap-3 p-3 rounded-md border bg-muted/30 ${alreadyQueued ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20" : "border-border"}`}>
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                            {patient.patientId && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">ID: {patient.patientId}</span>}
                            <span>{getPatientStages(patient as never, { apptEnabled }).join(" · ")}</span>
                            <span>{patient.email}</span>
                            {patient.whatsappNumber && <span>WA: {patient.whatsappNumber}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditPatient({
                              id: patient.id,
                              firstName: patient.firstName ?? "",
                              lastName: patient.lastName ?? "",
                              phone: (patient as never as { phone?: string }).phone ?? "",
                              email: patient.email ?? "",
                              whatsappNumber: patient.whatsappNumber ?? "",
                              dateOfBirth: (patient as never as { dateOfBirth?: string }).dateOfBirth ?? "",
                              gender: (patient as never as { gender?: string }).gender ?? "",
                              patientId: patient.patientId ?? "",
                              notes: (patient as never as { notes?: string }).notes ?? "",
                            })}
                            className="gap-1.5"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </Button>
                          {alreadyQueued ? (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full whitespace-nowrap">
                              Already in queue
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => checkin.mutate({ id: patient.id })}
                              disabled={checkin.isPending}
                            >
                              Add to Queue
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
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
