import { useState, useEffect } from "react";
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
  useCreatePatient,
  getListQueueQueryKey,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import { Users, Clock, Search, UserPlus, CheckSquare, Loader2, RefreshCw } from "lucide-react";

function waitTime(addedAt: string) {
  const diff = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000);
  if (diff < 1) return "Just added";
  if (diff === 1) return "1 min";
  return `${diff} mins`;
}

export default function QueueManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [newForm, setNewForm] = useState({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", age: "", gender: "" });

  const { data: queue = [], refetch: refetchQueue, isLoading: queueLoading } = useListQueue();
  const { data: searchResults = [], isFetching: searching } = useListPatients(
    { search },
    { enabled: search.trim().length >= 2 }
  );

  const checkin = useCheckinPatient({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Patient added to queue", description: `${patient.firstName} ${patient.lastName} is now queued.` });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        setSearch("");
      },
      onError: () => toast({ title: "Failed to add to queue", variant: "destructive" }),
    },
  });

  const dequeue = useDequeuePatient({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Patient removed from queue", description: `${patient.firstName} ${patient.lastName} returned to ${patient.stage}.` });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      },
      onError: () => toast({ title: "Failed to remove from queue", variant: "destructive" }),
    },
  });

  const createPatient = useCreatePatient({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Patient registered", description: `${patient.firstName} ${patient.lastName} registered and added to queue.` });
        checkin.mutate({ id: patient.id });
        setShowRegister(false);
        setNewForm({ firstName: "", lastName: "", phone: "", email: "", dateOfBirth: "", age: "", gender: "" });
        setSearch("");
      },
      onError: () => toast({ title: "Registration failed", variant: "destructive" }),
    },
  });

  // Auto-refresh queue every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => refetchQueue(), 30000);
    return () => clearInterval(interval);
  }, [refetchQueue]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    createPatient.mutate({
      firstName: newForm.firstName,
      lastName: newForm.lastName,
      phone: newForm.phone,
      email: newForm.email,
      dateOfBirth: newForm.dateOfBirth,
      age: newForm.age ? parseInt(newForm.age) : undefined,
      gender: newForm.gender || undefined,
      stage: "Booked",
    });
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
          <Button variant="outline" size="sm" onClick={() => refetchQueue()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
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
                <div key={entry.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {entry.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-none">{entry.patientName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {entry.phone && <span className="text-xs text-muted-foreground">{entry.phone}</span>}
                      {entry.email && <span className="text-xs text-muted-foreground">{entry.email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {waitTime(entry.addedAt)}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Check this when doctor calls the patient in">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (confirm(`Mark ${entry.patientName} as called in by doctor?`)) {
                            dequeue.mutate({ id: entry.patientId });
                          } else {
                            e.target.checked = false;
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Doctor called in</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Patient to Queue */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Add Patient to Queue</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="relative">
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowRegister(false); }}
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
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                        <p className="text-xs text-muted-foreground">{patient.phone} · {patient.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Stage: <span className="font-medium text-foreground">{patient.stage}</span>
                        </p>
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
                      onClick={() => setShowRegister(true)}
                    >
                      <UserPlus className="w-4 h-4" />
                      Register New Patient
                    </Button>
                  </div>
                )}
              </div>
            )}

            {showRegister && (
              <form onSubmit={handleRegister} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                <p className="font-semibold text-sm">Register New Patient</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">First Name *</label>
                    <Input value={newForm.firstName} onChange={(e) => setNewForm((f) => ({ ...f, firstName: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Last Name *</label>
                    <Input value={newForm.lastName} onChange={(e) => setNewForm((f) => ({ ...f, lastName: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Phone *</label>
                    <Input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Email *</label>
                    <Input type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date of Birth *</label>
                    <Input type="date" value={newForm.dateOfBirth} onChange={(e) => setNewForm((f) => ({ ...f, dateOfBirth: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Age</label>
                    <Input type="number" value={newForm.age} onChange={(e) => setNewForm((f) => ({ ...f, age: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-muted-foreground">Gender</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={newForm.gender}
                      onChange={(e) => setNewForm((f) => ({ ...f, gender: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowRegister(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={createPatient.isPending}>
                    {createPatient.isPending ? "Registering..." : "Register & Add to Queue"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
