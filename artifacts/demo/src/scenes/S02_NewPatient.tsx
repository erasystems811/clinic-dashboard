import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

export default function S02_NewPatient({ prospect, onNext }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function doRegister() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(onNext, 1200);
    }, 900);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doRegister();
  }

  return (
    <div className="relative max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Patient</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Register a new patient record.</p>
        </div>
      </div>

      {submitted ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 text-center space-y-2">
            <div className="text-3xl">✓</div>
            <p className="font-semibold text-green-400">Patient registered successfully</p>
            <p className="text-sm text-muted-foreground">
              {prospect.firstName} {prospect.lastName} is now in the system.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Patient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Patient ID / MRN *</label>
                  <Input defaultValue="ERA-DEMO-001" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Date of Birth *</label>
                  <Input type="date" defaultValue="1990-03-15" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">First Name *</label>
                  <Input defaultValue={prospect.firstName} className="border-primary/50 ring-1 ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Last Name *</label>
                  <Input defaultValue={prospect.lastName} className="border-primary/50 ring-1 ring-primary/20" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Email Address *</label>
                <Input type="email" defaultValue={`${prospect.firstName.toLowerCase()}.${prospect.lastName.toLowerCase()}@gmail.com`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Phone Number *</label>
                  <Input defaultValue={prospect.phone} className="border-primary/50 ring-1 ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">WhatsApp (if different)</label>
                  <Input placeholder="Leave blank if same" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Gender</label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Age</label>
                  <Input type="number" defaultValue="34" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Notes</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Any additional notes about this patient..."
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-border gap-2">
                <Button variant="outline" type="button">Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Adding…" : "Add Patient"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {!submitted && (
        <NarrationBubble
          text={<>One registration. <strong>That single entry powers everything that follows</strong> — queue, care plan, SMS automations, pipeline, feedback. Nothing needs to be entered twice.</>}
          onNext={doRegister}
          nextLabel="Add Patient →"
        />
      )}
    </div>
  );
}
