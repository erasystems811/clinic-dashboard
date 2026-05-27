import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { getPatientStages } from "@/lib/utils";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPatient,
  getGetPatientQueryKey,
  useListAppointments,
  getListAppointmentsQueryKey,
  useDeletePatient,
  useCheckinPatient,
  useDequeuePatient,
  useFlagMissedTreatment,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Calendar as CalendarIcon, Clock, Mail, Phone, Trash2,
  CheckCircle, Activity, Stethoscope, Hash, FileText, Link2, Copy, CheckCircle2,
  Pencil, X, Save, Flag, PhoneCall, MessageSquare, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const FOLLOWUP_TYPES = [
  { value: "manual_call", label: "Call", sub: "Call patient and log the outcome", icon: PhoneCall, color: "text-primary", active: "border-primary bg-primary/10 text-primary" },
  { value: "manual_text", label: "Text", sub: "Compose or AI-generate a message", icon: MessageSquare, color: "text-blue-400", active: "border-blue-500 bg-blue-500/10 text-blue-400" },
] as const;
type FollowupType = typeof FOLLOWUP_TYPES[number]["value"];

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hospital } = useAuth();

  const [generatingLink, setGeneratingLink] = useState(false);
  const [feedbackLink, setFeedbackLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  interface CarePlan { id: number; department: string; summary: string; templateData: Record<string, unknown>; createdAt: string; }
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [carePlansLoading, setCarePlansLoading] = useState(false);
  const [confirmEndPlanId, setConfirmEndPlanId] = useState<number | null>(null);
  const [endingPlanId, setEndingPlanId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const [flagReason, setFlagReason] = useState("");
  const [flagActionType, setFlagActionType] = useState<FollowupType>("manual_call");

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Patient flagged", description: "A follow-up task has been created for the receptionist." });
        setFlagReason("");
        setFlagActionType("manual_call");
      },
      onError: () => toast({ title: "Failed to flag patient", variant: "destructive" }),
    },
  });

  const { data: patient, isLoading } = useGetPatient(patientId, {
    query: { enabled: !isNaN(patientId), queryKey: getGetPatientQueryKey(patientId) }
  });

  const { data: appointments, isLoading: isLoadingAppointments } = useListAppointments(
    { patientId },
    { query: { enabled: !isNaN(patientId), queryKey: getListAppointmentsQueryKey({ patientId }) } }
  );

  const deletePatient = useDeletePatient();
  const checkinPatient = useCheckinPatient();
  const dequeuePatient = useDequeuePatient();

  const handleDelete = () => {
    deletePatient.mutate({ id: patientId }, {
      onSuccess: () => {
        toast({ title: "Patient deleted" });
        setLocation("/patients");
      },
      onError: () => toast({ title: "Error", description: "Failed to delete patient.", variant: "destructive" }),
    });
  };

  const handleCheckIn = () => {
    checkinPatient.mutate({ id: patientId }, {
      onSuccess: () => {
        toast({ title: "Patient checked in", description: "Patient has been moved to Queued." });
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleDequeue = () => {
    dequeuePatient.mutate({ id: patientId }, {
      onSuccess: () => {
        toast({ title: "Patient moved to In Care" });
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const authHeader = useCallback((): Record<string, string> => {
    if (hospital?.token) return { "x-hospital-token": hospital.token };
    const token = localStorage.getItem("auth_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }, [hospital?.token]);

  const fetchCarePlans = useCallback(async () => {
    if (isNaN(patientId)) return;
    setCarePlansLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/care-plans`), { headers: authHeader() });
      if (!res.ok) throw new Error();
      setCarePlans(await res.json());
    } catch {
      setCarePlans([]);
    } finally {
      setCarePlansLoading(false);
    }
  }, [patientId, authHeader]);

  useEffect(() => { fetchCarePlans(); }, [fetchCarePlans]);

  const handleEndPlanEarly = async (planId: number) => {
    setEndingPlanId(planId);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${planId}`), {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Care plan ended", description: "The treatment plan has been closed early." });
      setConfirmEndPlanId(null);
      await fetchCarePlans();
    } catch {
      toast({ title: "Failed to end care plan", variant: "destructive" });
    } finally {
      setEndingPlanId(null);
    }
  };

  const handleGenerateFeedbackLink = async () => {
    if (!hospital?.token) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/feedback-link`), {
        method: "POST",
        headers: { "x-hospital-token": hospital.token },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Error", description: d.error ?? "Could not generate link", variant: "destructive" });
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

  const startEditing = () => {
    if (!patient) return;
    setEditForm({
      firstName: (patient.firstName as string) ?? "",
      lastName: (patient.lastName as string) ?? "",
      email: (patient.email as string) ?? "",
      phone: (patient.phone as string) ?? "",
      whatsappNumber: (patient.whatsappNumber as string) ?? "",
      dateOfBirth: (patient.dateOfBirth as string) ?? "",
      age: patient.age != null ? String(patient.age) : "",
      gender: (patient.gender as string) ?? "",
      department: (patient.department as string) ?? "",
      diagnosis: (patient.diagnosis as string) ?? "",
      notes: (patient.notes as string) ?? "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const payload: Record<string, unknown> = { ...editForm };
      if (editForm.age) payload.age = parseInt(editForm.age, 10);
      else delete payload.age;

      const res = await fetch(apiUrl(`/api/patients/${patientId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      toast({ title: "Patient record updated" });
      queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
      setEditing(false);
    } catch (err: unknown) {
      toast({
        title: "Could not save changes",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [key]: e.target.value }));

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-2xl font-bold mb-2">Patient Not Found</h2>
          <Link href="/patients"><Button>Return to Patients</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/patients">
            <Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Patient Profile</h1>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" className="gap-2" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                  <Link href={`/patients/${patientId}/history`}>
                    <Button variant="outline" className="gap-2">
                      <FileText className="w-4 h-4" />
                      Full History
                    </Button>
                  </Link>
                  {user?.role === "admin" && hospital?.token && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={generatingLink}
                      onClick={feedbackLink ? copyLink : handleGenerateFeedbackLink}
                    >
                      {linkCopied
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : feedbackLink
                        ? <Copy className="w-4 h-4" />
                        : <Link2 className="w-4 h-4" />
                      }
                      {generatingLink
                        ? "Generating…"
                        : linkCopied
                        ? "Copied!"
                        : feedbackLink
                        ? "Copy Link"
                        : "Feedback Link"
                      }
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {feedbackLink && !editing && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 flex-1 truncate font-mono">{feedbackLink}</p>
            <button
              onClick={copyLink}
              className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0 font-medium"
            >
              {linkCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              {editing ? (
                /* ── Edit Form ── */
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Edit Patient Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input value={editForm.firstName} onChange={field("firstName")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input value={editForm.lastName} onChange={field("lastName")} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={editForm.email} onChange={field("email")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={editForm.phone} onChange={field("phone")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp Number</Label>
                    <Input value={editForm.whatsappNumber} onChange={field("whatsappNumber")} placeholder="+1234567890" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input type="date" value={editForm.dateOfBirth} onChange={field("dateOfBirth")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Age</Label>
                      <Input type="number" min={0} max={150} value={editForm.age} onChange={field("age")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gender</Label>
                      <Input value={editForm.gender} onChange={field("gender")} placeholder="e.g. Female" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Department</Label>
                    <Input value={editForm.department} onChange={field("department")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Diagnosis</Label>
                    <Input value={editForm.diagnosis} onChange={field("diagnosis")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea rows={3} value={editForm.notes} onChange={field("notes")} className="resize-none" />
                  </div>
                  <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              ) : (
                /* ── Read-only view ── */
                <>
                  <div className="flex flex-col items-center text-center pb-6 border-b border-border">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-3">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </div>
                    <h2 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h2>
                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                      {getPatientStages(patient as never).map(s => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>

                    {patient.stage === "Booked" && (
                      <Button className="w-full mt-4" onClick={handleCheckIn} disabled={checkinPatient.isPending}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Check In to Queue
                      </Button>
                    )}

                    {patient.stage === "Queued" && (
                      <div className="w-full mt-4 p-3 border border-primary/30 bg-primary/5 rounded-lg flex items-center gap-3">
                        <Checkbox onCheckedChange={(checked) => { if (checked) handleDequeue(); }} />
                        <label className="text-sm font-medium leading-none cursor-pointer text-primary">
                          Patient called in
                        </label>
                      </div>
                    )}

                  </div>

                  <div className="pt-5 space-y-4">
                    {patient.patientId && (
                      <div className="flex items-center gap-3">
                        <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Patient ID</p>
                          <p className="font-medium font-mono text-sm">{patient.patientId}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm break-all">{patient.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium text-sm">{patient.phone}</p>
                      </div>
                    </div>
                    {patient.dateOfBirth && (
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date of Birth</p>
                          <p className="font-medium text-sm">
                            {(() => { try { return format(new Date(patient.dateOfBirth), "MMMM d, yyyy"); } catch { return patient.dateOfBirth; } })()}
                          </p>
                        </div>
                      </div>
                    )}
                    {patient.department && (
                      <div className="flex items-center gap-3">
                        <Stethoscope className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Department</p>
                          <p className="font-medium text-sm">{patient.department}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Main panel */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Treatment Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Care Plans with per-plan End Treatment Early */}
              <div>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4" />
                  Care Plans
                </h3>
                {carePlansLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : carePlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No care plans on file.</p>
                ) : (
                  <div className="space-y-2">
                    {carePlans.map(plan => (
                      <div key={plan.id} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-primary uppercase tracking-wide">{plan.department}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(plan.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{plan.summary}</p>
                          </div>
                          {confirmEndPlanId !== plan.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                              onClick={() => setConfirmEndPlanId(plan.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              End Early
                            </Button>
                          )}
                        </div>
                        {confirmEndPlanId === plan.id && (
                          <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/20 space-y-2">
                            <p className="text-xs text-amber-300">End this {plan.department} care plan early? This cannot be undone.</p>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmEndPlanId(null)}>Cancel</Button>
                              <Button
                                type="button" size="sm"
                                className="flex-1 text-xs bg-amber-600 hover:bg-amber-600/90 text-white border-0"
                                onClick={() => handleEndPlanEarly(plan.id)}
                                disabled={endingPlanId === plan.id}
                              >
                                {endingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, End Early"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {patient.treatmentPlan && (
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4" />
                    Active Treatment Plan
                  </h3>
                  <div className="bg-primary/5 p-4 rounded-md border border-primary/20 whitespace-pre-wrap text-sm">
                    {patient.treatmentPlan}
                  </div>
                </div>
              )}

              {/* Appointment quick-list */}
              <div>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Upcoming Appointments</h3>
                {isLoadingAppointments ? (
                  <Skeleton className="h-16 w-full" />
                ) : appointments && appointments.length > 0 ? (
                  <div className="space-y-2">
                    {appointments.slice(0, 3).map(apt => (
                      <div key={apt.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card text-sm">
                        <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex flex-col items-center justify-center text-xs shrink-0">
                          <span className="font-bold text-primary">{format(new Date(apt.scheduledAt), "MMM")}</span>
                          <span className="font-bold leading-none">{format(new Date(apt.scheduledAt), "d")}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{apt.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(apt.scheduledAt), "h:mm a")} · {apt.duration} min
                          </p>
                        </div>
                        <Badge variant={apt.status === "scheduled" ? "default" : "secondary"}>{apt.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground text-sm bg-secondary/20 rounded-lg border border-border">
                    No upcoming appointments
                  </div>
                )}
              </div>

              <div className="text-right pt-2">
                <Link href={`/patients/${patientId}/history`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Open Full Patient File
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* ── Flag for Follow-up ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Flag className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Flag for Follow-up</span>
            <span className="text-xs text-muted-foreground ml-1">— creates a task for the receptionist</span>
          </div>
          <div className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                flagMissed.mutate({ id: patientId, data: { reason: flagReason, actionType: flagActionType } });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for flag *</label>
                <Input
                  value={flagReason}
                  onChange={e => setFlagReason(e.target.value)}
                  placeholder="e.g. Missed 2 consecutive treatment sessions"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Follow-up Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  {FOLLOWUP_TYPES.map(ft => {
                    const Icon = ft.icon;
                    const isSelected = flagActionType === ft.value;
                    return (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => setFlagActionType(ft.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center text-xs transition-colors ${
                          isSelected ? ft.active : "border-border hover:border-border/60 text-muted-foreground"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? "" : ft.color}`} />
                        <span className="font-semibold">{ft.label}</span>
                        <span className="leading-snug opacity-80">{ft.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="destructive" disabled={flagMissed.isPending || !flagReason.trim()}>
                  {flagMissed.isPending ? "Flagging..." : "Flag & Create Follow-up Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {user?.role === "admin" && (
          <div className="pt-4 border-t border-border/40">
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
                    This will permanently remove all data for {patient.firstName} {patient.lastName} including appointments, activity history, and call tasks. This cannot be undone.
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
      </div>
    </Layout>
  );
}
