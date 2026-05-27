import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { useGetPatientHistory, useDeletePatient, useCheckinPatient, useDequeuePatient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import { getPatientStages } from "@/lib/utils";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { FollowUpFlagModal } from "@/components/flag-modals";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Phone, Mail, Calendar, Stethoscope,
  ClipboardList, PhoneCall, MessageSquare, Bot, Activity,
  Clock, CheckCircle2, AlertTriangle, Flag, Trash2, Pencil, X, Save, Loader2,
  CheckCircle, Link2, Copy,
} from "lucide-react";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "d MMM yyyy, HH:mm"); } catch { return iso; }
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "d MMM yyyy"); } catch { return iso; }
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  automated_message: Bot,
  manual_text: MessageSquare,
  manual_call: PhoneCall,
};

const ACTION_LABELS: Record<string, string> = {
  automated_message: "Automated Message",
  manual_text: "Manual Text",
  manual_call: "Manual Call",
};

const TREATMENT_TYPE_LABELS: Record<string, string> = {
  medication_only: "Medication Only (self-administered)",
  come_to_hospital: "Come to Hospital (clinic visit)",
  combination: "Combination (medication + clinic visits)",
};

const STAGE_COLORS: Record<string, string> = {
  "Booked":          "bg-teal-500/15 text-teal-400 border-teal-500/30",
  "Queued":          "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "In Care":         "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Post Treatment":  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Active":          "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Post Care":       "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Dormant":         "bg-muted text-muted-foreground border-border",
};

const ACTIVITY_DOT: Record<string, string> = {
  patient_created:          "bg-green-500",
  stage_changed:            "bg-blue-500",
  checkin:                  "bg-primary",
  dequeued:                 "bg-muted-foreground",
  treatment_plan_logged:    "bg-violet-500",
  treatment_reminder:       "bg-amber-500",
  missed_treatment_flagged: "bg-destructive",
  check_in_flagged:         "bg-primary",
  no_show:                  "bg-destructive",
  appointment_scheduled:    "bg-teal-500",
  appointment_rescheduled:  "bg-amber-500",
  call_task_completed:      "bg-green-500",
  call_task_action_updated: "bg-muted-foreground",
};

function Section({ icon: Icon, title, count, actions, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border bg-muted/20">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function PatientHistory() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const { user, hospital } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showFollowUp, setShowFollowUp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmEndPlanId, setConfirmEndPlanId] = useState<number | null>(null);
  const [endingPlanId, setEndingPlanId] = useState<number | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [feedbackLink, setFeedbackLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const startEditing = (patient: Record<string, unknown>) => {
    setEditForm({
      patientId:      String(patient.patientId ?? ""),
      firstName:      String(patient.firstName ?? ""),
      lastName:       String(patient.lastName ?? ""),
      email:          String(patient.email ?? ""),
      phone:          String(patient.phone ?? ""),
      whatsappNumber: String(patient.whatsappNumber ?? ""),
      dateOfBirth:    String(patient.dateOfBirth ?? ""),
      age:            patient.age != null ? String(patient.age) : "",
      gender:         String(patient.gender ?? ""),
      department:     String(patient.department ?? ""),
    });
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const payload: Record<string, unknown> = { ...editForm };
      if (editForm.age) payload.age = parseInt(editForm.age, 10);
      else delete payload.age;
      // Remove empty strings so we don't overwrite with blanks
      Object.keys(payload).forEach(k => { if (payload[k] === "") delete payload[k]; });

      const res = await fetch(apiUrl(`/api/patients/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save");

      await refetch();
      setEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm(f => ({ ...f, [key]: e.target.value }));

  const checkinPatient = useCheckinPatient();
  const dequeuePatient = useDequeuePatient();

  const handleCheckIn = () => {
    checkinPatient.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Patient checked in", description: "Patient moved to Queued." });
        refetch();
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleDequeue = () => {
    dequeuePatient.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Patient moved to In Care" });
        refetch();
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleGenerateFeedbackLink = async () => {
    if (!hospital?.token) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${id}/feedback-link`), {
        method: "POST",
        headers: { "x-hospital-token": hospital.token },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: (d as { error?: string }).error ?? "Could not generate link", variant: "destructive" });
        return;
      }
      const { token } = await res.json();
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const link = `${window.location.origin}${base}/feedback/${token}`;
      setFeedbackLink(link);
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
      toast({ title: "Feedback link copied!", description: "Share it with the patient after their visit." });
    } catch {
      toast({ title: "Error", description: "Could not generate link", variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = async () => {
    if (!feedbackLink) return;
    await navigator.clipboard.writeText(feedbackLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: "Link copied!" });
  };

  const handleEndPlanEarly = async (planId: number) => {
    if (!hospital?.token) return;
    setEndingPlanId(planId);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${planId}`), {
        method: "DELETE",
        headers: { "x-hospital-token": hospital.token },
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Care plan ended", description: "The treatment plan has been closed early." });
      setConfirmEndPlanId(null);
      refetch();
    } catch {
      toast({ title: "Failed to end care plan", variant: "destructive" });
    } finally {
      setEndingPlanId(null);
    }
  };

  const deletePatient = useDeletePatient();
  const handleDelete = () => {
    deletePatient.mutate({ id }, {
      onSuccess: () => setLocation("/patients"),
    });
  };

  const { data, isLoading, error, refetch } = useGetPatientHistory(id, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !isNaN(id), staleTime: 0, refetchOnMount: true } as any,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="py-20 text-center text-muted-foreground max-w-4xl mx-auto">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Patient record not found.</p>
          <Link href="/patients">
            <span className="text-primary underline text-sm mt-2 inline-block cursor-pointer">← Back to patients</span>
          </Link>
        </div>
      </Layout>
    );
  }

  const { patient, activity, appointments, callTasks, carePlans = [] } = data as typeof data & { carePlans?: Record<string, unknown>[] };
  const stageClass = STAGE_COLORS[patient.stage] ?? "bg-muted text-muted-foreground border-border";
  const patientFullName = `${patient.firstName} ${patient.lastName}`;

  const openTasks = callTasks.filter(t => !t.completedAt).length;
  const completedTasks = callTasks.filter(t => !!t.completedAt).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Back */}
        <Link href="/patients">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            All Patients
          </button>
        </Link>

        {/* ── PATIENT HEADER ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary/60 to-primary/20" />

          <div className="px-6 pt-5 pb-6 space-y-5">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary text-xl font-bold flex items-center justify-center shrink-0 border-2 border-primary/20 shadow-sm">
                {patient.firstName[0]}{patient.lastName[0]}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-2xl font-bold tracking-tight">{patientFullName}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {getPatientStages(patient as never).map((s) => (
                    <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STAGE_COLORS[s] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {s}
                    </span>
                  ))}
                  {patient.department && (
                    <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {patient.department}
                    </span>
                  )}
                </div>
                {/* Queue management — only when not editing */}
                {!editing && (
                  <div className="mt-3">
                    {!(patient as Record<string,unknown>).isInQueue ? (
                      <Button size="sm" className="gap-1.5" onClick={handleCheckIn} disabled={checkinPatient.isPending}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {checkinPatient.isPending ? "Checking in…" : "Check In to Queue"}
                      </Button>
                    ) : (
                      <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
                        <Checkbox onCheckedChange={(checked) => { if (checked) handleDequeue(); }} />
                        <label className="text-sm font-medium text-primary cursor-pointer leading-none">Patient called in</label>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => { setEditing(false); setSaveError(null); }} disabled={saving}>
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => startEditing(patient as unknown as Record<string, unknown>)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    {isAdmin && hospital?.token && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={generatingLink}
                        onClick={feedbackLink ? copyLink : handleGenerateFeedbackLink}
                      >
                        {linkCopied
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : feedbackLink
                          ? <Copy className="w-3.5 h-3.5" />
                          : <Link2 className="w-3.5 h-3.5" />
                        }
                        {generatingLink ? "Generating…" : linkCopied ? "Copied!" : feedbackLink ? "Copy Link" : "Feedback Link"}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setShowFollowUp(true)}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        Flag Follow-Up
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {editing ? (
              /* ── Inline edit form ── */
              <div className="pt-4 border-t border-border space-y-4">
                {saveError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {saveError}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input value={editForm.firstName} onChange={field("firstName")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input value={editForm.lastName} onChange={field("lastName")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Patient ID</Label>
                    <Input value={editForm.patientId} onChange={field("patientId")} placeholder="e.g. PT-00123" className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={editForm.phone} onChange={field("phone")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={editForm.whatsappNumber} onChange={field("whatsappNumber")} placeholder="+1234567890" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={editForm.email} onChange={field("email")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input type="date" value={editForm.dateOfBirth} onChange={field("dateOfBirth")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Age</Label>
                    <Input type="number" min={0} max={150} value={editForm.age} onChange={field("age")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gender</Label>
                    <Input value={editForm.gender} onChange={field("gender")} placeholder="e.g. Female" />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-xs">Department</Label>
                    <Input value={editForm.department} onChange={field("department")} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Read-only info grid ── */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t border-border">
                <InfoRow label="Patient ID" value={patient.patientId} />
                <InfoRow label="Date of Birth" value={fmtDate(patient.dateOfBirth)} />
                <InfoRow label="Age / Gender" value={[patient.age ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(" · ") || null} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Phone</span>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    {patient.phone}
                  </span>
                </div>
                {patient.whatsappNumber && patient.whatsappNumber !== patient.phone && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">WhatsApp</span>
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      {patient.whatsappNumber}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Email</span>
                  <span className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                    <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{patient.email}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Registered</span>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {fmtDate(patient.createdAt)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feedback link banner */}
        {feedbackLink && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 flex-1 truncate font-mono">{feedbackLink}</p>
            <button onClick={copyLink} className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0 font-medium">
              {linkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {/* ── CARE PLANS ── */}
        <Section icon={ClipboardList} title="Care Plans" count={carePlans.length}>
          {carePlans.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No care plans on record.</div>
          ) : (
            <div className="divide-y divide-border">
              {carePlans.map((plan, idx) => {
                const planId = plan.id as number;
                const createdAt = plan.createdAt as string | null;
                const summary = plan.summary as string | null;
                const department = plan.department as string | null;
                const isLatest = idx === 0;
                return (
                  <div key={planId} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{fmt(createdAt)}</span>
                        {department && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground flex items-center gap-1">
                            <Stethoscope className="w-3 h-3" />
                            {department}
                          </span>
                        )}
                        {isLatest && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      {isAdmin && confirmEndPlanId !== planId && (
                        <Button
                          size="sm" variant="outline"
                          className="shrink-0 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                          onClick={() => setConfirmEndPlanId(planId)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          End Early
                        </Button>
                      )}
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
                    </div>
                    {isAdmin && confirmEndPlanId === planId && (
                      <div className="px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                        <p className="text-xs text-amber-300">End this {department} care plan early? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmEndPlanId(null)}>Cancel</Button>
                          <Button
                            type="button" size="sm"
                            className="flex-1 text-xs bg-amber-600 hover:bg-amber-600/90 text-white border-0"
                            onClick={() => handleEndPlanEarly(planId)}
                            disabled={endingPlanId === planId}
                          >
                            {endingPlanId === planId ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, End Early"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── APPOINTMENTS ── */}
        <Section icon={Calendar} title="Appointment History" count={appointments.length}>
          {appointments.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No appointments on record.</div>
          ) : (
            <div className="divide-y divide-border">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-11 h-11 rounded-lg bg-secondary border border-border flex flex-col items-center justify-center shrink-0 text-xs">
                    <span className="font-bold text-primary uppercase">{format(parseISO(appt.scheduledAt), "MMM")}</span>
                    <span className="font-bold text-sm leading-none">{format(parseISO(appt.scheduledAt), "d")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{appt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(appt.scheduledAt), "h:mm a")} · {appt.duration} min
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    appt.status === "completed"    ? "bg-green-500/10 text-green-400" :
                    appt.status === "no_show"      ? "bg-destructive/10 text-destructive" :
                    appt.status === "rescheduled"  ? "bg-amber-500/10 text-amber-400" :
                                                     "bg-primary/10 text-primary"
                  }`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── CALL TASKS / FOLLOW-UPS ── */}
        <Section
          icon={PhoneCall}
          title="Call Tasks & Follow-Ups"
          actions={
            callTasks.length > 0 ? (
              <div className="flex items-center gap-2">
                {openTasks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    {openTasks} open
                  </span>
                )}
                {completedTasks > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                    {completedTasks} done
                  </span>
                )}
              </div>
            ) : undefined
          }
        >
          {callTasks.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No call tasks on record.</div>
          ) : (
            <div className="divide-y divide-border">
              {[...callTasks].reverse().map((task) => {
                const Icon = ACTION_ICONS[task.actionType] ?? PhoneCall;
                const isCheckIn = (task as any).taskType === "check_in";
                const checkInType = (task as any).checkInType as string | null | undefined;
                const isComplete = !!task.completedAt;

                return (
                  <div key={task.id} className="px-5 py-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete ? "bg-green-500/10" : isCheckIn ? "bg-primary/10" : "bg-amber-500/10"
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${
                          isComplete ? "text-green-400" : isCheckIn ? "text-primary" : "text-amber-400"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Task type badge */}
                          {isCheckIn ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {checkInType ?? "Check-In"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                              <Flag className="w-3 h-3" />
                              Follow-Up
                            </span>
                          )}
                          {/* Method */}
                          <span className="text-xs text-muted-foreground">{ACTION_LABELS[task.actionType] ?? task.actionType}</span>
                          {/* Status */}
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            isComplete ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {isComplete ? "Completed" : "Open"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Flagged {fmt(task.flaggedAt)}</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="ml-11 rounded-md bg-muted/30 border border-border px-3 py-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Reason</p>
                      <p className="text-sm">{task.reason}</p>
                    </div>

                    {/* Outcome / Response */}
                    {isComplete && task.outcome ? (
                      <div className="ml-11 rounded-md bg-green-500/5 border border-green-500/20 px-3 py-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Receptionist Response</span>
                          <span className="text-xs text-muted-foreground ml-auto">{fmt(task.completedAt)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{task.outcome}</p>
                      </div>
                    ) : !isComplete ? (
                      <div className="ml-11">
                        <span className="text-xs text-muted-foreground italic">Awaiting receptionist response…</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── FULL ACTIVITY LOG ── */}
        <Section icon={Activity} title="Full Activity Log" count={activity.length}>
          {activity.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No activity recorded.</div>
          ) : (
            <div className="relative px-5 py-4">
              <div className="absolute left-[2.125rem] top-4 bottom-4 w-px bg-border" />
              <div className="space-y-4">
                {[...activity].reverse().map((item) => {
                  const dotColor = ACTIVITY_DOT[item.type] ?? "bg-muted-foreground";
                  return (
                    <div key={item.id} className="flex items-start gap-4 relative">
                      <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 border-2 border-card z-10 ${dotColor}`} />
                      <div className="flex-1 min-w-0 pb-2">
                        <p className="text-sm leading-snug">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">{fmt(item.createdAt)}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                            {item.type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Admin-only: subtle delete at very bottom */}
      {isAdmin && (
        <div className="pt-2 border-t border-border/40">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />
                Delete patient record
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete patient record?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove all data for {patientFullName} including appointments, activity history, and call tasks. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Permanently Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Modals */}
      {showFollowUp && (
        <FollowUpFlagModal
          patientId={id}
          patientName={patientFullName}
          onClose={() => { setShowFollowUp(false); queryClient.invalidateQueries(); }}
        />
      )}
    </Layout>
  );
}
