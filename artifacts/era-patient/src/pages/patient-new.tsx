import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreatePatient, useListPipelineStages, getListPipelineStagesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function calcAge(dob: string): number | undefined {
  if (!dob) return undefined;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : undefined;
}

export default function NewPatient() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isReceptionist = user?.role === "receptionist";

  const { data: stages } = useListPipelineStages({
    query: { queryKey: getListPipelineStagesQueryKey() }
  });

  const createPatient = useCreatePatient();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    age: "",
    gender: "",
    stage: "Booked",
    diagnosis: "",
    notes: "",
  });

  const field = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  function onDobChange(e: React.ChangeEvent<HTMLInputElement>) {
    const dob = e.target.value;
    const age = calcAge(dob);
    setForm(f => ({ ...f, dateOfBirth: dob, age: age !== undefined ? String(age) : f.age }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.dateOfBirth) return;

    createPatient.mutate(
      {
        data: {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          email: form.email,
          phone: form.phone,
          whatsappNumber: form.whatsappNumber || undefined,
          age: form.age ? parseInt(form.age) : undefined,
          gender: form.gender || undefined,
          stage: form.stage,
          diagnosis: form.diagnosis || undefined,
          notes: form.notes || undefined,
        }
      },
      {
        onSuccess: (result) => {
          toast({ title: "Patient created", description: "New patient record has been added." });
          setLocation(isReceptionist ? "/queue" : `/patients/${result.id}/history`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create patient. Please try again.", variant: "destructive" });
        }
      }
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/patients">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add New Patient</h1>
            <p className="text-muted-foreground mt-1 text-sm">Enter patient details to create a new record.</p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Patient Information</CardTitle>
              <CardDescription>Fields marked * are required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input placeholder="John" value={form.firstName} onChange={field("firstName")} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input placeholder="Doe" value={form.lastName} onChange={field("lastName")} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email *</label>
                  <Input type="email" placeholder="john.doe@example.com" value={form.email} onChange={field("email")} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone *</label>
                  <Input placeholder="+234 800 000 0000" value={form.phone} onChange={field("phone")} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">WhatsApp Number</label>
                  <Input placeholder="If different from phone" value={form.whatsappNumber} onChange={field("whatsappNumber")} />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date of Birth *</label>
                  <Input type="date" value={form.dateOfBirth} onChange={onDobChange} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Age</label>
                  <Input
                    type="number"
                    placeholder="Auto-filled from DOB"
                    min={0}
                    value={form.age}
                    readOnly={!!form.dateOfBirth}
                    className={form.dateOfBirth ? "bg-muted text-muted-foreground cursor-default" : ""}
                    onChange={field("age")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Gender</label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={field("gender")}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pipeline Stage</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.stage} onChange={field("stage")}>
                  {stages?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={field("notes")}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-border">
                <Link href="/patients">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={createPatient.isPending}>
                  {createPatient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Patient
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </Layout>
  );
}
