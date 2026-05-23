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
  useLogTreatmentPlan,
  getListActivityQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Edit, 
  Mail, 
  Phone, 
  Trash2, 
  User,
  ClipboardList,
  CheckCircle,
  Activity,
  Heart
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [treatmentPlanOpen, setTreatmentPlanOpen] = useState(false);
  const [tpTreatmentPlan, setTpTreatmentPlan] = useState("");
  const [tpDiagnosis, setTpDiagnosis] = useState("");
  const [tpDoctor, setTpDoctor] = useState("");
  const [tpReminderDays, setTpReminderDays] = useState("7");

  const { data: patient, isLoading } = useGetPatient(patientId, {
    query: { 
      enabled: !isNaN(patientId), 
      queryKey: getGetPatientQueryKey(patientId) 
    }
  });

  const { data: appointments, isLoading: isLoadingAppointments } = useListAppointments(
    { patientId },
    { 
      query: { 
        enabled: !isNaN(patientId), 
        queryKey: getListAppointmentsQueryKey({ patientId }) 
      } 
    }
  );

  const deletePatient = useDeletePatient();
  const checkinPatient = useCheckinPatient();
  const dequeuePatient = useDequeuePatient();
  const logTreatmentPlan = useLogTreatmentPlan();

  const handleDelete = () => {
    deletePatient.mutate(
      { id: patientId },
      {
        onSuccess: () => {
          toast({ title: "Patient deleted", description: "The patient record has been removed." });
          setLocation("/patients");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete patient.", variant: "destructive" });
        }
      }
    );
  };

  const handleCheckIn = () => {
    checkinPatient.mutate({ id: patientId }, {
      onSuccess: () => {
        toast({ title: "Patient checked in", description: "Patient has been moved to Queued." });
        queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to check in patient.", variant: "destructive" });
      }
    });
  };

  const handleDequeue = () => {
    if (confirm("Confirm marking this patient as called in by doctor?")) {
      dequeuePatient.mutate({ id: patientId }, {
        onSuccess: () => {
          toast({ title: "Patient called in", description: "Patient has been moved to In Care." });
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to call in patient.", variant: "destructive" });
        }
      });
    }
  };

  const handleLogTreatmentPlan = () => {
    if (!tpTreatmentPlan) {
      toast({ title: "Validation Error", description: "Treatment plan is required.", variant: "destructive" });
      return;
    }

    logTreatmentPlan.mutate(
      { 
        id: patientId, 
        data: {
          treatmentPlan: tpTreatmentPlan,
          diagnosis: tpDiagnosis || undefined,
          doctor: tpDoctor || undefined,
          reminderIntervalDays: parseInt(tpReminderDays, 10) || 7
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "Treatment plan logged", description: "Reminders have been scheduled." });
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patientId) });
          queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() });
          setTreatmentPlanOpen(false);
          setTpTreatmentPlan("");
          setTpDiagnosis("");
          setTpDoctor("");
          setTpReminderDays("7");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to log treatment plan.", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                <Skeleton className="h-6 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
              <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
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
          <p className="text-muted-foreground mb-6">The patient record you are looking for does not exist.</p>
          <Link href="/patients">
            <Button>Return to Patients</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const showWellnessNote = !patient.treatmentPlan && (patient.stage === 'Booked' || patient.stage === 'Dormant');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/patients">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Patient Profile</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the patient
                      record for {patient.firstName} {patient.lastName} and remove their data from our servers.
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
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center pb-6 border-b border-border">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold mb-4">
                  {patient.firstName[0]}{patient.lastName[0]}
                </div>
                <h2 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h2>
                <Badge className="mt-2 mb-2" variant="secondary">{patient.stage}</Badge>
                
                {showWellnessNote && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full mt-2 border border-emerald-200 dark:border-emerald-800">
                    <Heart className="w-3 h-3" />
                    <span>Receiving wellness newsletter</span>
                  </div>
                )}
                
                {patient.stage === 'Booked' && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={handleCheckIn}
                    disabled={checkinPatient.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Check In
                  </Button>
                )}

                {patient.stage === 'Queued' && (
                  <div className="w-full mt-4 p-3 border border-primary/30 bg-primary/5 rounded-lg flex items-center gap-3">
                    <Checkbox 
                      id="dequeue-checkbox" 
                      onCheckedChange={(checked) => {
                        if (checked) handleDequeue();
                      }} 
                    />
                    <label 
                      htmlFor="dequeue-checkbox" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-primary"
                    >
                      Called in by doctor
                    </label>
                  </div>
                )}
                
                {!patient.treatmentPlan && (patient.stage === 'In Care' || patient.stage === 'Queued') && (
                  <Dialog open={treatmentPlanOpen} onOpenChange={setTreatmentPlanOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4 border-primary/50 text-primary hover:bg-primary/10">
                        <Activity className="w-4 h-4 mr-2" />
                        Log Treatment Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Log Treatment Plan</DialogTitle>
                        <DialogDescription>
                          Record the patient's treatment plan. This will automatically schedule follow-up reminders.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="tp">Treatment Plan <span className="text-destructive">*</span></Label>
                          <Textarea 
                            id="tp" 
                            value={tpTreatmentPlan} 
                            onChange={(e) => setTpTreatmentPlan(e.target.value)} 
                            placeholder="Detailed treatment plan..." 
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="diag">Diagnosis (Optional)</Label>
                          <Input 
                            id="diag" 
                            value={tpDiagnosis} 
                            onChange={(e) => setTpDiagnosis(e.target.value)} 
                            placeholder="Primary diagnosis" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="doc">Doctor (Optional)</Label>
                            <Input 
                              id="doc" 
                              value={tpDoctor} 
                              onChange={(e) => setTpDoctor(e.target.value)} 
                              placeholder="Doctor's name" 
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="rem">Reminder Interval (Days)</Label>
                            <Input 
                              id="rem" 
                              type="number" 
                              value={tpReminderDays} 
                              onChange={(e) => setTpReminderDays(e.target.value)} 
                              min="1"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTreatmentPlanOpen(false)}>Cancel</Button>
                        <Button onClick={handleLogTreatmentPlan} disabled={logTreatmentPlan.isPending || !tpTreatmentPlan}>
                          Save & Schedule
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              <div className="py-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="font-medium">{patient.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <span className="font-medium">{patient.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{format(new Date(patient.dateOfBirth), "MMMM d, yyyy")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Primary Doctor</span>
                    <span className="font-medium">{patient.doctor || "Not assigned"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Clinical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="appointments">Appointments</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6">
                  {patient.treatmentPlan && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2 text-primary">
                        <ClipboardList className="w-4 h-4" />
                        TREATMENT PLAN
                      </h3>
                      <div className="bg-primary/5 p-4 rounded-md border border-primary/20 whitespace-pre-wrap text-sm">
                        {patient.treatmentPlan}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 text-primary">DIAGNOSIS</h3>
                    <div className="bg-secondary/30 p-4 rounded-md border border-border">
                      {patient.diagnosis || "No diagnosis recorded."}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 text-primary">CLINICAL NOTES</h3>
                    <div className="bg-secondary/30 p-4 rounded-md border border-border min-h-[150px] whitespace-pre-wrap">
                      {patient.notes || "No notes recorded."}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
                    <span>Patient ID: {patient.id}</span>
                    <span>Created: {format(new Date(patient.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </TabsContent>
                
                <TabsContent value="appointments">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium">Appointment History</h3>
                      <Button size="sm" variant="outline">Schedule New</Button>
                    </div>
                    
                    {isLoadingAppointments ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : appointments && appointments.length > 0 ? (
                      <div className="space-y-3">
                        {appointments.map(apt => (
                          <div key={apt.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-secondary flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-primary">{format(new Date(apt.scheduledAt), "MMM")}</span>
                                <span className="text-lg font-bold leading-none">{format(new Date(apt.scheduledAt), "d")}</span>
                              </div>
                              <div>
                                <h4 className="font-semibold">{apt.title}</h4>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(apt.scheduledAt), "h:mm a")}</span>
                                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {apt.doctor}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant={apt.status === 'scheduled' ? 'default' : apt.status === 'completed' ? 'secondary' : 'destructive'}>
                              {apt.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg border border-border">
                        No appointments found for this patient.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
