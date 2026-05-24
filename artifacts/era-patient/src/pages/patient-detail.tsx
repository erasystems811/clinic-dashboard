import { useState } from "react";
import { apiUrl } from "@/lib/api";
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
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Calendar as CalendarIcon, Clock, Mail, Phone, Trash2,
  CheckCircle, Activity, Stethoscope, Hash, FileText, Link2, Copy, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

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
    if (confirm("Move this patient out of the queue and into care?")) {
      dequeuePatient.mutate({ id: patientId }, {
        onSuccess: () => {
          toast({ title: "Patient moved to In Care" });
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      });
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete patient?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the record for {patient.firstName} {patient.lastName}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {feedbackLink && (
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
              <div className="flex flex-col items-center text-center pb-6 border-b border-border">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-3">
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <h2 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h2>
                <Badge className="mt-2" variant="secondary">{patient.stage}</Badge>

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
                {patient.hospitalId && (
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Hospital ID</p>
                      <p className="font-medium font-mono text-sm">{patient.hospitalId}</p>
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
            </CardContent>
          </Card>

          {/* Main panel */}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Treatment Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {patient.treatmentPlan && (
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Treatment Plan
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
      </div>
    </Layout>
  );
}
