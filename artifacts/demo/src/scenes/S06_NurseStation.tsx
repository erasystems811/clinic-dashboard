import { useState } from "react";
import { Plus, Loader2, CheckCircle2, Stethoscope } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props {
  prospect: Prospect;
  onNext: () => void;
  onSMSBanner: (msg: string) => void;
}

const SAMPLE_MEDICATIONS = [
  { name: "Paracetamol 500mg", dosage: "1 tablet", frequency: "3x daily", duration: "5 days" },
  { name: "Amoxicillin 250mg", dosage: "1 capsule", frequency: "2x daily", duration: "7 days" },
];

export default function S06_NurseStation({ prospect, onNext, onSMSBanner }: Props) {
  const [step, setStep] = useState<"form" | "activating" | "done">("form");

  function handleActivate() {
    setStep("activating");
    setTimeout(() => {
      setStep("done");
      onSMSBanner(`Hi ${prospect.firstName}, your care plan has been activated at ERA Hospital. Your nurse has prescribed your medications. You can view your full plan in the ERA-me app.`);
    }, 1000);
  }

  return (
    <div className="relative space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nurse Station</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create treatment plan for {prospect.firstName} {prospect.lastName}</p>
        </div>
      </div>

      {step === "done" ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <p className="font-semibold text-green-400">Care Plan Activated</p>
            <p className="text-sm text-muted-foreground">{prospect.firstName}'s plan is live. They've been notified via SMS.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Patient info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                  {prospect.firstName[0]}{prospect.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-sm">{prospect.firstName} {prospect.lastName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">ERA-001</span>
                    <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">In Care</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Care Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Care Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Diagnosis</label>
                  <Input defaultValue="Upper Respiratory Tract Infection" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Category</label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option>General Consultation</option>
                    <option>Follow-up Visit</option>
                    <option>Emergency</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Procedures / Notes</label>
                <textarea
                  rows={2}
                  defaultValue="Full physical examination performed. Throat and ears checked. No fever. Advised to rest and stay hydrated."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Medications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Medications</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SAMPLE_MEDICATIONS.map((med, i) => (
                  <div key={i} className="flex items-center gap-4 px-3 py-2.5 rounded-md bg-muted/30 border border-border">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-2">
                      <span className="text-sm font-medium col-span-2">{med.name}</span>
                      <span className="text-xs text-muted-foreground">{med.frequency}</span>
                      <span className="text-xs text-muted-foreground">{med.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activate */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline">Save Draft</Button>
            <Button onClick={handleActivate} disabled={step === "activating"}>
              {step === "activating" && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === "activating" ? "Activating…" : "Activate Care Plan"}
            </Button>
          </div>
        </>
      )}

      <NarrationBubble
        text={
          step === "form"
            ? <><strong>The nurse sets up {prospect.firstName}'s care plan</strong> — diagnosis, medications, procedures. Click to activate.</>
            : step === "activating"
            ? <>Activating plan...</>
            : <><strong>Care plan activated.</strong> {prospect.firstName} gets an SMS with their plan summary. Their nurse can also chat with them via ERA Messages.</>
        }
        onNext={step === "form" ? handleActivate : step === "done" ? onNext : undefined}
        nextLabel={step === "form" ? "Activate Care Plan →" : "Continue →"}
      />
    </div>
  );
}
