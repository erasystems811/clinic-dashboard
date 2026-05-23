import { useState } from "react";
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
  getListCallTasksQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Calendar as CalendarIcon, Clock, Mail, Phone, Trash2,
  User, CheckCircle, Activity, Stethoscope, Hash, FileText,
  Flag, Bot, MessageSquare, PhoneCall, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const FOLLOWUP_TYPES = [
  {
    value: "automated_message" as const,
    label: "Automated Message",
    sub: "AI generates a check-in message",
    icon: Bot,
    active: "border-violet-500 bg-violet-500/10 text-violet-400",
    color: "text-violet-400",
  },
  {
    value: "manual_text" as const,
    label: "Manual Text",
    sub: "Staff composes a personal text",
    icon: MessageSquare,
    active: "border-blue-500 bg-blue-500/10 text-blue-400",
    color: "text-blue-400",
  },
  {
    value: "manual_call" as const,
    label: "Manual Call",
    sub: "Staff makes a direct phone call",
    icon: PhoneCall,
    active: "border-primary bg-primary/10 text-primary",
    color: "text-primary",
  },
];

type FollowupType = typeof FOLLOWUP_TYPES[number]["value"];

interface FlagModalProps {
  patientName: string;
  patientId: number;
  onClose: () => void;
}

function FlagModal({ patientName, patientId, onClose }: FlagModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [actionType, setActionType] = useState<FollowupType>("manual_call");

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Follow-up task created",
          description: `${patientName} has been flagged. The task will appear in the receptionist's call list.`,
        });
        queryClient.invalidateQueries({ queryKey: getListCallTasksQueryKey() });
        onClose();
      },
      onError: () => toast({ title: "Failed to flag patient", variant: "destructive" }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    flagMissed.mutate({ id: patientId, data: { reason, actionType } });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-foreground">Flag for Follow-up</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient indicator */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="w-9 h-9 rounded-full bg-destructive/20 text-destructive font-bold text-sm flex items-center justify-center shrink-0">
              {patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-sm">{patientName}</p>
              <p className="text-xs text-muted-foreground">Will be added to receptionist call tasks</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for follow-up *</label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Missed appointment, needs check-up reminder…"
              required
            />
          </div>

          {/* Method picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Follow-up Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {FOLLOWUP_TYPES.map(ft => {
                const Icon = ft.icon;
                const isSelected = actionType === ft.value;
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setActionType(ft.value)}
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={!reason.trim() || flagMissed.isPending}
            >
              {flagMissed.isPending ? "Flagging…" : "Flag & Create Task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showFlagModal, setShowFlagModal] = useState(false);

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
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowFlagModal(true)}
                >
                  <Flag className="w-4 h-4" />
                  Flag for Follow-up
                </Button>
              )}
              <Link href={`/patients/${patientId}/history`}>
                <Button variant="outline" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Full History
                </Button>
              </Link>
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

      {showFlagModal && patient && (
        <FlagModal
          patientId={patientId}
          patientName={`${patient.firstName} ${patient.lastName}`}
          onClose={() => setShowFlagModal(false)}
        />
      )}
    </Layout>
  );
}
