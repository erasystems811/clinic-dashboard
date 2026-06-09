import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { useListPatients } from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { FollowUpFlagModal } from "@/components/flag-modals";
import {
  Clock, Users, Calendar, PhoneCall, ArrowRightLeft, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, X, ClipboardList, Search,
} from "lucide-react";

interface QueueEntry {
  id: number;
  patientId: number;
  patientName: string;
  position: number;
  addedAt: string;
  phone?: string | null;
  doctorId?: number | null;
  doctorName?: string | null;
  calledInAt?: string | null;
}

interface DoctorAppointment {
  id: number;
  patientName: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number | null;
  status: string;
}

interface Doctor {
  id: number;
  fullName: string;
  specialty?: string | null;
  unavailable: boolean;
}

interface DoctorCarePlan {
  id: number;
  department: string;
  summary: string;
}

function waitTime(addedAt: string) {
  const diff = Math.floor((Date.now() - new Date(addedAt).getTime()) / 60000);
  if (diff < 1) return "Just added";
  if (diff === 1) return "1 min";
  return `${diff} mins`;
}

function TransferModal({
  entry, doctors, token, onClose, onTransferred,
}: {
  entry: QueueEntry; doctors: Doctor[]; token: string; onClose: () => void; onTransferred: () => void;
}) {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const others = doctors.filter(d => d.id !== entry.doctorId && !d.unavailable);

  const handleTransfer = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/queue/${entry.id}/transfer`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ doctorId: parseInt(targetId) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Transfer failed");
      }
      toast({ title: `${entry.patientName} transferred` });
      onTransferred();
      onClose();
    } catch (err: unknown) {
      toast({ title: "Transfer failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Transfer Patient</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Transfer <strong>{entry.patientName}</strong> to another doctor:</p>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Select doctor…</option>
            {others.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}</option>
            ))}
          </select>
          {others.length === 0 && <p className="text-xs text-amber-500">No other available doctors.</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={!targetId || saving} onClick={handleTransfer}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Transferring…</> : "Transfer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function DoctorView() {
  const { hospital, hospitalConfig, user } = useAuth();
  const { toast } = useToast();
  const token = hospital?.token ?? "";
  const doctorId = user?.doctorId;
  const specialty = user?.specialty;
  const doctorName = user?.displayName ?? "Doctor";

  const appointmentsEnabled = hospitalConfig?.modules?.appointmentsEnabled !== false;

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [callingIn, setCallingIn] = useState<number | null>(null);
  const [transferEntry, setTransferEntry] = useState<QueueEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "appointments" | "followups">("queue");

  // Follow-up tab — nurse-style patient search
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [selectedFollowUpPatient, setSelectedFollowUpPatient] = useState<Patient | null>(null);
  const [followUpCarePlans, setFollowUpCarePlans] = useState<DoctorCarePlan[]>([]);
  const [followUpCPLoading, setFollowUpCPLoading] = useState(false);
  const [flagPatient, setFlagPatient] = useState<{ name: string; id: number } | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!token || !doctorId) return;
    try {
      const r = await fetch(apiUrl(`/api/doctor/queue?doctorId=${doctorId}`), { headers: { "x-hospital-token": token } });
      if (r.ok) setQueue(await r.json() as QueueEntry[]);
    } finally { setQueueLoading(false); }
  }, [token, doctorId]);

  const fetchAppointments = useCallback(async () => {
    if (!token || !doctorId) return;
    try {
      const r = await fetch(apiUrl(`/api/doctor/appointments?doctorId=${doctorId}`), { headers: { "x-hospital-token": token } });
      if (r.ok) setAppointments(await r.json() as DoctorAppointment[]);
    } finally { setApptLoading(false); }
  }, [token, doctorId]);

  const fetchDoctors = useCallback(async () => {
    if (!token) return;
    const r = await fetch(apiUrl("/api/hospital/doctors"), { headers: { "x-hospital-token": token } });
    if (r.ok) {
      const docs = await r.json() as Doctor[];
      setAllDoctors(docs);
      const me = docs.find(d => d.id === doctorId);
      if (me) setUnavailable(me.unavailable);
    }
  }, [token, doctorId]);

  // Patient search for Follow-Ups tab
  const { data: followUpSearchResults = [], isFetching: followUpSearching } = useListPatients(
    { search: followUpSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: followUpSearch.trim().length >= 2 } as any },
  );

  const fetchFollowUpCarePlans = useCallback(async (patientId: number) => {
    if (!token) return;
    setFollowUpCPLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/patients/${patientId}/care-plans`), { headers: { "x-hospital-token": token } });
      if (r.ok) setFollowUpCarePlans(await r.json() as DoctorCarePlan[]);
      else setFollowUpCarePlans([]);
    } catch { setFollowUpCarePlans([]); }
    finally { setFollowUpCPLoading(false); }
  }, [token]);

  useEffect(() => {
    if (selectedFollowUpPatient) fetchFollowUpCarePlans(selectedFollowUpPatient.id);
    else setFollowUpCarePlans([]);
  }, [selectedFollowUpPatient, fetchFollowUpCarePlans]);

  useEffect(() => {
    fetchQueue();
    fetchAppointments();
    fetchDoctors();
  }, [fetchQueue, fetchAppointments, fetchDoctors]);

  useEffect(() => {
    const t = setInterval(fetchQueue, 15_000);
    return () => clearInterval(t);
  }, [fetchQueue]);

  const handleCallIn = async (entry: QueueEntry) => {
    setCallingIn(entry.id);
    try {
      const res = await fetch(apiUrl(`/api/queue/${entry.id}/call-in`), {
        method: "POST", headers: { "x-hospital-token": token },
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Patient notified", description: `${entry.patientName} has been called in.` });
      fetchQueue();
    } catch {
      toast({ title: "Failed to call in patient", variant: "destructive" });
    } finally { setCallingIn(null); }
  };

  const handleToggleAvailability = async () => {
    if (!doctorId) return;
    setToggleLoading(true);
    try {
      const res = await fetch(apiUrl("/api/doctor/availability"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ doctorId, unavailable: !unavailable }),
      });
      if (!res.ok) throw new Error("Failed");
      setUnavailable(v => !v);
      toast({
        title: unavailable ? "You are now available" : "Marked as unavailable",
        description: unavailable ? "Receptionist can assign patients to you." : "Receptionist has been notified.",
      });
    } catch {
      toast({ title: "Could not update availability", variant: "destructive" });
    } finally { setToggleLoading(false); }
  };

  const formatApptTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
    if (isToday) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return `${d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })} at ${time}`;
  };

  return (
    <Layout>
      {transferEntry && (
        <TransferModal
          entry={transferEntry} doctors={allDoctors} token={token}
          onClose={() => setTransferEntry(null)}
          onTransferred={() => { fetchQueue(); setTransferEntry(null); }}
        />
      )}
      {flagPatient && (
        <FollowUpFlagModal
          patientName={flagPatient.name}
          patientId={flagPatient.id}
          onClose={() => setFlagPatient(null)}
        />
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Doctor header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dr. {doctorName}</h1>
            {specialty && <p className="text-muted-foreground text-sm mt-0.5">{specialty}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {unavailable && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" /> Unavailable
              </span>
            )}
            <Button variant={unavailable ? "default" : "outline"} size="sm"
              disabled={toggleLoading} onClick={handleToggleAvailability} className="gap-1.5">
              {toggleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : unavailable ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <AlertTriangle className="w-3.5 h-3.5" />}
              {unavailable ? "Mark Available" : "Mark Unavailable"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button onClick={() => setActiveTab("queue")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "queue" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Queue</span>
          </button>
          {appointmentsEnabled && (
            <button onClick={() => setActiveTab("appointments")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "appointments" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Appointments</span>
            </button>
          )}
          <button onClick={() => setActiveTab("followups")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "followups" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Follow-Ups
            </span>
          </button>
        </div>

        {/* Queue tab */}
        {activeTab === "queue" && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">My Queue</span>
              <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">{queue.length} waiting</span>
              <button onClick={fetchQueue} className="text-muted-foreground hover:text-foreground ml-1"><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>
            {queueLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : queue.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Your queue is empty</div>
            ) : (
              <div className="divide-y divide-border">
                {queue.map(entry => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">{entry.position}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{entry.patientName}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /><span>{waitTime(entry.addedAt)}</span>
                          {entry.calledInAt && <span className="text-emerald-500 font-medium">· Called in</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setFlagPatient({ name: entry.patientName, id: entry.patientId })}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Flag for follow-up">
                          <ClipboardList className="w-3.5 h-3.5" />
                        </button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setTransferEntry(entry)}>
                          <ArrowRightLeft className="w-3 h-3" /> Transfer
                        </Button>
                        <Button size="sm" className="gap-1.5 text-xs h-8"
                          disabled={callingIn === entry.id || !!entry.calledInAt} onClick={() => handleCallIn(entry)}>
                          {callingIn === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneCall className="w-3 h-3" />}
                          {entry.calledInAt ? "Called" : "Call In"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Appointments tab */}
        {activeTab === "appointments" && appointmentsEnabled && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Upcoming Appointments</span>
              <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">{appointments.length}</span>
            </div>
            {apptLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : appointments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No upcoming appointments</div>
            ) : (
              <div className="divide-y divide-border">
                {appointments.map(appt => (
                  <div key={appt.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{appt.patientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{appt.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{formatApptTime(appt.scheduledAt)}</p>
                      {appt.durationMinutes && <p className="text-xs text-muted-foreground">{appt.durationMinutes} min</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-ups tab */}
        {activeTab === "followups" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Search a patient to view their active care plan and flag them for follow-up.</p>

            {/* Patient search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search patient name or ID… (min 2 characters)"
                value={followUpSearch}
                onChange={e => { setFollowUpSearch(e.target.value); setSelectedFollowUpPatient(null); }}
              />
              {followUpSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search results */}
            {followUpSearch.trim().length >= 2 && !selectedFollowUpPatient && followUpSearchResults.length > 0 && (
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {followUpSearchResults.map(p => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition"
                    onClick={() => { setSelectedFollowUpPatient(p); setFollowUpSearch(`${p.firstName} ${p.lastName}`); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {`${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground">{p.phone || "No phone"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {followUpSearch.trim().length >= 2 && !selectedFollowUpPatient && !followUpSearching && followUpSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No patients found</p>
            )}

            {/* Selected patient card */}
            {selectedFollowUpPatient && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {`${selectedFollowUpPatient.firstName[0] ?? ""}${selectedFollowUpPatient.lastName[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selectedFollowUpPatient.firstName} {selectedFollowUpPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">{selectedFollowUpPatient.phone || "No phone"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => setFlagPatient({ name: `${selectedFollowUpPatient.firstName} ${selectedFollowUpPatient.lastName}`, id: selectedFollowUpPatient.id })}>
                      <ClipboardList className="w-3.5 h-3.5" /> Flag Follow-Up
                    </Button>
                    <button onClick={() => { setSelectedFollowUpPatient(null); setFollowUpSearch(""); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Care plans */}
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Active Care Plans</p>
                  {followUpCPLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                  ) : followUpCarePlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active care plans on record.</p>
                  ) : (
                    <div className="space-y-2">
                      {followUpCarePlans.map(cp => (
                        <div key={cp.id} className="rounded-md bg-muted/40 px-3 py-2">
                          <p className="text-xs font-semibold text-primary mb-0.5">{cp.department}</p>
                          <p className="text-sm">{cp.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
