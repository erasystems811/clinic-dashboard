import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useGetPatient, 
  getGetPatientQueryKey,
  useListAppointments,
  getListAppointmentsQueryKey,
  useDeletePatient
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Edit, 
  Mail, 
  Phone, 
  Trash2, 
  User 
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
                <Badge className="mt-2" variant="secondary">{patient.stage}</Badge>
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