import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2, RefreshCw, X, ClipboardList, Search, CalendarPlus, Info,
  MessageSquare, Send, CheckCheck,
} from "lucide-react";

interface DoctorMsgConvo {
  connectionId: number;
  patientId: number;
  patientName: string;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageAt: string;
  unread: number;
}

interface DoctorMsgMessage {
  id: number;
  sender: "patient" | "hospital" | "system";
  messageType: string;
  content: string;
  createdAt: string;
}

interface DoctorMsgThread {
  connectionId: number;
  patientName: string;
  eraStatus: string;
  messages: DoctorMsgMessage[];
}

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
  transferredFromDoctorName?: string | null;
}

interface DoctorAppointment {
  id: number;
  patientId: number;
  patientName: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number | null;
  status: string;
  notes?: string | null;
  reassignedFromDoctorId?: number | null;
  reassignedFromDoctorName?: string | null;
  reassignmentNote?: string | null;
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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const others = doctors.filter(d => d.id !== entry.doctorId && !d.unavailable);

  const handleTransfer = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/queue/${entry.id}/transfer`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ doctorId: parseInt(targetId), note: note || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Reassign failed");
      }
      toast({ title: `${entry.patientName} reassigned` });
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
          <p className="text-sm text-muted-foreground">Reassign <strong>{entry.patientName}</strong> to another doctor:</p>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Select doctor…</option>
            {others.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}</option>
            ))}
          </select>
          {others.length === 0 && <p className="text-xs text-amber-500">No other available doctors.</p>}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reason / note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="e.g. Patient needs specialist review"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={!targetId || saving} onClick={handleTransfer}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Reassigning…</> : "Reassign"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Book Follow-Up Appointment Modal ──────────────────────────────────────────
function BookFollowUpModal({
  patient, doctorId, doctorName, token, onClose, onBooked,
}: {
  patient: Patient; doctorId: number; doctorName: string; token: string; onClose: () => void; onBooked: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleBook = async () => {
    if (!date || !time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch(apiUrl("/api/appointments"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token, "x-performed-by": `Dr. ${doctorName}` },
        body: JSON.stringify({
          patientId: patient.id,
          title: `Follow-up appointment`,
          scheduledAt,
          durationMinutes: parseInt(duration) || 30,
          notes: notes || undefined,
          doctorId,
          doctorName,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Booking failed");
      }
      toast({ title: "Appointment booked", description: `Follow-up for ${patient.firstName} ${patient.lastName} confirmed. Patient will receive an email.` });
      onBooked();
      onClose();
    } catch (err: unknown) {
      toast({ title: "Failed to book", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // Min date = today
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" /> Book Follow-Up Appointment</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            Patient: <strong>{patient.firstName} {patient.lastName}</strong>
            <span className="text-xs text-muted-foreground block mt-0.5">Appointment will be assigned to you and patient will receive a confirmation email.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              {["15","20","30","45","60","90"].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="e.g. follow up on blood pressure readings"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={!date || !time || saving} onClick={handleBook} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />}
              {saving ? "Booking…" : "Book Appointment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reassign Appointment Modal ────────────────────────────────────────────────
function ReassignAppointmentModal({
  appt, doctors, token, currentDoctorId, onClose, onReassigned,
}: {
  appt: DoctorAppointment; doctors: Doctor[]; token: string; currentDoctorId: number; onClose: () => void; onReassigned: () => void;
}) {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const others = doctors.filter(d => d.id !== currentDoctorId);

  const handleReassign = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/appointments/${appt.id}/reassign`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ newDoctorId: parseInt(targetId), note: note || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Reassign failed");
      }
      toast({ title: "Appointment reassigned", description: `${appt.patientName}'s appointment has been moved.` });
      onReassigned();
      onClose();
    } catch (err: unknown) {
      toast({ title: "Reassign failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Reassign Appointment</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Reassign <strong>{appt.patientName}</strong>'s appointment to another doctor.</p>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">Select doctor…</option>
            {others.map(d => <option key={d.id} value={d.id}>Dr. {d.fullName}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
          </select>
          {others.length === 0 && <p className="text-xs text-amber-500">No other doctors available.</p>}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note for new doctor (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="e.g. Patient needs follow-up on cardiology referral"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={!targetId || saving} onClick={handleReassign}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Reassigning…</> : "Reassign"}
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
  const [activeTab, setActiveTab] = useState<"queue" | "appointments" | "followups" | "messages">("queue");

  // ERA Messages state
  const [msgConvos, setMsgConvos] = useState<DoctorMsgConvo[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSelected, setMsgSelected] = useState<DoctorMsgThread | null>(null);
  const [msgLoadingThread, setMsgLoadingThread] = useState(false);
  const [msgReply, setMsgReply] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgResolving, setMsgResolving] = useState(false);
  const [msgTransferDoctorId, setMsgTransferDoctorId] = useState("");
  const [msgTransferring, setMsgTransferring] = useState(false);
  const [msgUnread, setMsgUnread] = useState(0);
  const msgBottomRef = useRef<HTMLDivElement>(null);

  // Follow-up tab — nurse-style patient search
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [selectedFollowUpPatient, setSelectedFollowUpPatient] = useState<Patient | null>(null);
  const [followUpCarePlans, setFollowUpCarePlans] = useState<DoctorCarePlan[]>([]);
  const [followUpCPLoading, setFollowUpCPLoading] = useState(false);
  const [flagPatient, setFlagPatient] = useState<{ name: string; id: number } | null>(null);
  const [bookFollowUpPatient, setBookFollowUpPatient] = useState<Patient | null>(null);
  const [reassignAppt, setReassignAppt] = useState<DoctorAppointment | null>(null);

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

  const msgHeaders = doctorId ? { "x-hospital-token": token, "x-doctor-id": String(doctorId) } : null;

  const fetchMsgConvos = useCallback(async () => {
    if (!msgHeaders) return;
    setMsgLoading(true);
    const r = await fetch(apiUrl("/api/era-messages/doctor"), { headers: msgHeaders });
    if (r.ok) {
      const data = await r.json() as DoctorMsgConvo[];
      setMsgConvos(data);
      setMsgUnread(data.reduce((s, c) => s + c.unread, 0));
    }
    setMsgLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId]);

  const openMsgThread = useCallback(async (convo: DoctorMsgConvo) => {
    if (!msgHeaders) return;
    setMsgLoadingThread(true);
    setMsgSelected(null);
    const r = await fetch(apiUrl(`/api/era-messages/doctor/${convo.connectionId}`), { headers: msgHeaders });
    if (r.ok) {
      setMsgSelected(await r.json());
      setMsgConvos(prev => prev.map(c => c.connectionId === convo.connectionId ? { ...c, unread: 0 } : c));
    }
    setMsgLoadingThread(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId]);

  const sendMsgReply = useCallback(async () => {
    if (!msgReply.trim() || !msgSelected || msgSending || !msgHeaders) return;
    setMsgSending(true);
    const r = await fetch(apiUrl(`/api/era-messages/${msgSelected.connectionId}/send`), {
      method: "POST",
      headers: { ...msgHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ content: msgReply.trim() }),
    });
    if (r.ok) {
      const msg = await r.json();
      setMsgSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setMsgReply("");
    }
    setMsgSending(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId, msgReply, msgSelected, msgSending]);

  const resolveConvo = useCallback(async () => {
    if (!msgSelected || msgResolving || !msgHeaders) return;
    setMsgResolving(true);
    const r = await fetch(apiUrl(`/api/era-messages/${msgSelected.connectionId}/resolve`), {
      method: "POST",
      headers: msgHeaders,
    });
    if (r.ok) {
      setMsgSelected(prev => prev ? { ...prev, eraStatus: "resolved" } : prev);
      setMsgConvos(prev => prev.filter(c => c.connectionId !== msgSelected.connectionId));
      setMsgUnread(prev => Math.max(0, prev - (msgSelected.messages.filter(m => m.sender === "patient").length)));
      // Refetch to get the resolve system message
      const tr = await fetch(apiUrl(`/api/era-messages/doctor/${msgSelected.connectionId}`), { headers: msgHeaders });
      if (tr.ok) setMsgSelected(await tr.json());
    }
    setMsgResolving(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId, msgSelected, msgResolving]);

  const transferConvo = useCallback(async () => {
    if (!msgSelected || !msgTransferDoctorId || msgTransferring || !msgHeaders) return;
    setMsgTransferring(true);
    const r = await fetch(apiUrl(`/api/era-messages/doctor/${msgSelected.connectionId}/transfer`), {
      method: "POST",
      headers: { ...msgHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ targetDoctorId: parseInt(msgTransferDoctorId) }),
    });
    if (r.ok) {
      setMsgConvos(prev => prev.filter(c => c.connectionId !== msgSelected.connectionId));
      setMsgSelected(null);
      setMsgTransferDoctorId("");
    }
    setMsgTransferring(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId, msgSelected, msgTransferDoctorId, msgTransferring]);

  useEffect(() => {
    if (selectedFollowUpPatient) fetchFollowUpCarePlans(selectedFollowUpPatient.id);
    else setFollowUpCarePlans([]);
  }, [selectedFollowUpPatient, fetchFollowUpCarePlans]);

  useEffect(() => {
    fetchQueue();
    fetchAppointments();
    fetchDoctors();
    fetchMsgConvos();
  }, [fetchQueue, fetchAppointments, fetchDoctors, fetchMsgConvos]);

  useEffect(() => {
    const t = setInterval(fetchQueue, 15_000);
    return () => clearInterval(t);
  }, [fetchQueue]);

  // Poll ERA messages every 15s
  useEffect(() => {
    const t = setInterval(fetchMsgConvos, 15_000);
    return () => clearInterval(t);
  }, [fetchMsgConvos]);

  // Scroll to bottom when thread messages change
  useEffect(() => {
    if (msgSelected) msgBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgSelected?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background thread refresh while open
  useEffect(() => {
    if (!msgSelected || !msgHeaders) return;
    const id = setInterval(async () => {
      const r = await fetch(apiUrl(`/api/era-messages/doctor/${msgSelected.connectionId}`), { headers: msgHeaders });
      if (r.ok) setMsgSelected(await r.json());
    }, 10_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgSelected?.connectionId, token, doctorId]);

  const handleCallIn = async (entry: QueueEntry) => {
    setCallingIn(entry.id);
    try {
      const res = await fetch(apiUrl(`/api/queue/${entry.id}/call-in`), {
        method: "POST", headers: { "x-hospital-token": token },
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Patient notified", description: `${entry.patientName} has been called in and moved to In Care.` });
      // Remove immediately from local state
      setQueue(prev => prev.filter(q => q.id !== entry.id));
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
      {bookFollowUpPatient && doctorId && (
        <BookFollowUpModal
          patient={bookFollowUpPatient}
          doctorId={doctorId}
          doctorName={doctorName}
          token={token}
          onClose={() => setBookFollowUpPatient(null)}
          onBooked={fetchAppointments}
        />
      )}
      {reassignAppt && doctorId && (
        <ReassignAppointmentModal
          appt={reassignAppt}
          doctors={allDoctors}
          token={token}
          currentDoctorId={doctorId}
          onClose={() => setReassignAppt(null)}
          onReassigned={() => { fetchAppointments(); setReassignAppt(null); }}
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
          <button onClick={() => setActiveTab("messages")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "messages" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Messages
              {msgUnread > 0 && <span className="min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">{msgUnread}</span>}
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
                          {entry.transferredFromDoctorName && <span className="text-amber-500 font-medium">· From Dr. {entry.transferredFromDoctorName}</span>}
                          {entry.calledInAt && <span className="text-emerald-500 font-medium">· Called in</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setTransferEntry(entry)}>
                          <ArrowRightLeft className="w-3 h-3" /> Reassign
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
                  <div key={appt.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{appt.patientName}</p>
                        <p className="text-xs text-muted-foreground">{appt.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatApptTime(appt.scheduledAt)}</p>
                        {appt.durationMinutes && <p className="text-xs text-muted-foreground">{appt.durationMinutes} min</p>}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={() => setReassignAppt(appt)}>
                        <ArrowRightLeft className="w-3 h-3" /> Reassign
                      </Button>
                    </div>
                    {appt.reassignedFromDoctorName && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
                        <Info className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          <span className="font-medium">Reassigned from Dr. {appt.reassignedFromDoctorName}</span>
                          {appt.reassignmentNote && <span className="block text-amber-500/80 mt-0.5">"{appt.reassignmentNote}"</span>}
                        </div>
                      </div>
                    )}
                    {appt.notes && !appt.reassignedFromDoctorName && (
                      <p className="text-xs text-muted-foreground italic px-0.5">{appt.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ERA Messages tab */}
        {activeTab === "messages" && (
          <div className="flex gap-4 h-[520px]">
            {/* Conversation list */}
            <div className={`flex flex-col border border-border rounded-lg bg-card shrink-0 ${msgSelected ? "hidden md:flex w-64" : "flex w-full md:w-64"}`}>
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Assigned to me</p>
                <button onClick={fetchMsgConvos} className="text-muted-foreground hover:text-foreground"><RefreshCw className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {msgLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : msgConvos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">No conversations assigned to you yet</p>
                  </div>
                ) : (
                  msgConvos.map(c => (
                    <button key={c.connectionId} onClick={() => openMsgThread(c)}
                      className={`w-full text-left px-3 py-2.5 border-b border-border transition hover:bg-muted/40 ${msgSelected?.connectionId === c.connectionId ? "bg-muted/60" : ""}`}>
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {c.patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={`text-xs truncate ${c.unread > 0 ? "font-bold" : "font-medium"}`}>{c.patientName}</p>
                            {c.unread > 0 && <span className="min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1 shrink-0">{c.unread}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{c.lastMessage}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Thread */}
            {msgLoadingThread ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : msgSelected ? (
              <div className="flex-1 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
                {/* Thread header */}
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
                  <button onClick={() => setMsgSelected(null)} className="md:hidden p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {msgSelected.patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold flex-1 min-w-0 truncate">{msgSelected.patientName}</p>
                  {/* Transfer to another doctor */}
                  {msgSelected.eraStatus !== "resolved" && allDoctors.filter(d => d.id !== doctorId).length > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select value={msgTransferDoctorId} onChange={e => setMsgTransferDoctorId(e.target.value)}
                        className="h-7 rounded-md border border-border bg-background px-2 text-xs max-w-[130px]">
                        <option value="">Transfer to…</option>
                        {allDoctors.filter(d => d.id !== doctorId && !d.unavailable).map(d => (
                          <option key={d.id} value={d.id}>Dr. {d.fullName}</option>
                        ))}
                      </select>
                      <button onClick={transferConvo} disabled={!msgTransferDoctorId || msgTransferring}
                        className="flex items-center gap-1 px-2 h-7 rounded-md border border-border text-xs font-medium hover:bg-muted transition disabled:opacity-40">
                        {msgTransferring ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                        Transfer
                      </button>
                    </div>
                  )}
                  {msgSelected.eraStatus !== "resolved" && (
                    <button onClick={resolveConvo} disabled={msgResolving}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition disabled:opacity-40 shrink-0 border border-green-500/20">
                      {msgResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                      Resolve
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {msgSelected.messages.map(m => {
                    if (m.sender === "system") {
                      return (
                        <div key={m.id} className="flex justify-center py-0.5">
                          <span className="text-[10px] text-muted-foreground bg-muted/60 border border-border rounded-full px-2.5 py-0.5">{m.content}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${m.sender === "hospital" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender === "hospital" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                          <p className="leading-relaxed">{m.content}</p>
                          <p className={`text-[9px] mt-0.5 ${m.sender === "hospital" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgBottomRef} />
                </div>

                {/* Reply input */}
                {msgSelected.eraStatus === "resolved" ? (
                  <div className="px-4 py-2.5 border-t border-border text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 shrink-0">
                    <CheckCheck className="w-3.5 h-3.5 text-green-500" /> Conversation resolved
                  </div>
                ) : (
                  <div className="px-3 py-2.5 border-t border-border flex gap-2 shrink-0">
                    <textarea value={msgReply} onChange={e => setMsgReply(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsgReply(); } }}
                      placeholder="Type a reply…" rows={1}
                      className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary transition"
                      style={{ maxHeight: 80 }} />
                    <button onClick={sendMsgReply} disabled={!msgReply.trim() || msgSending}
                      className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition disabled:opacity-40 shrink-0">
                      {msgSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-2 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">Select a conversation</p>
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
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                      onClick={() => setFlagPatient({ name: `${selectedFollowUpPatient.firstName} ${selectedFollowUpPatient.lastName}`, id: selectedFollowUpPatient.id })}>
                      <ClipboardList className="w-3.5 h-3.5" /> Flag Task
                    </Button>
                    <Button size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => setBookFollowUpPatient(selectedFollowUpPatient)}>
                      <CalendarPlus className="w-3.5 h-3.5" /> Book Appointment
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
