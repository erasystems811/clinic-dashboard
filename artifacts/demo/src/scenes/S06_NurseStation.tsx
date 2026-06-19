import { useState } from "react";
import { Plus, Loader2, CheckCircle2, Stethoscope, Pill, Activity, X, Mail, Phone } from "lucide-react";
import { Button, Input, Card, CardContent, Badge } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props {
  prospect: Prospect;
  onNext: () => void;
  onSMSBanner: (msg: string) => void;
}

const TIMING_SLOTS = ["Morning", "Afternoon", "Evening", "Night"];

const SAMPLE_MEDS = [
  { name: "Paracetamol 500mg", dosage: "1 tablet", durationDays: 5, times: { Morning: "08:00", Afternoon: "14:00", Evening: "20:00" } },
  { name: "Amoxicillin 250mg", dosage: "1 capsule", durationDays: 7, times: { Morning: "07:00", Evening: "19:00" } },
];

export default function S06_NurseStation({ prospect, onNext, onSMSBanner }: Props) {
  const [step, setStep] = useState<"form" | "activating" | "done">("form");

  function handleActivate() {
    setStep("activating");
    setTimeout(() => {
      setStep("done");
      onSMSBanner(`Hi ${prospect.firstName}, your care plan at ERA Hospital has been set up. Please check your email for your full care plan details and follow up. We are with you every step of the way.`);
    }, 1000);
  }

  return (
    <div className="relative space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medication View</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage treatment plans and schedule patient return visits.</p>
        </div>
      </div>

      {/* Treatment Plans section */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Treatment Plans</span>
        </div>
        <div className="p-5">
          {step === "done" ? (
            /* ── Split screen: nurse side (left) + patient side (right) ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nurse / admin view */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Nurse view
                </p>
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                  <p className="font-semibold text-green-400 text-sm">Treatment Plan Activated</p>
                  <p className="text-xs text-muted-foreground">{prospect.firstName}'s plan is live in the system.</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-foreground/80">Paracetamol 500mg</p>
                  <p className="text-muted-foreground">Morning · Afternoon · Evening · 5 days</p>
                  <p className="font-semibold text-foreground/80 mt-2">Amoxicillin 250mg</p>
                  <p className="text-muted-foreground">Morning · Evening · 7 days</p>
                </div>
              </div>

              {/* Patient view */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> What {prospect.firstName} receives
                </p>
                {/* SMS notification */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">SMS — Just now</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Hi {prospect.firstName}, your care plan at ERA Hospital has been set up. Please check your email for your full care plan details. We are with you every step of the way.
                  </p>
                </div>
                {/* Email */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400">Email — 20 mins later</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">Your care plan has started — ERA Hospital</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hi {prospect.firstName}, thank you for choosing ERA Hospital. Your care plan is now active. Here are your medications and instructions for the next 7 days…
                  </p>
                  <div className="text-xs text-foreground/70 space-y-0.5 border-t border-blue-500/20 pt-1.5">
                    <p>· Paracetamol 500mg — 3× daily, 5 days</p>
                    <p>· Amoxicillin 250mg — 2× daily, 7 days</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Patient bar */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                  {prospect.firstName[0]}{prospect.lastName[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{prospect.firstName} {prospect.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono mr-2">ERA-001</span>
                    <span>Filling draft treatment plan</span>
                  </p>
                </div>
                <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">In Care</Badge>
              </div>

              {/* Medications */}
              <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Medications</p>
                    <span className="text-xs text-muted-foreground">(pharmacist)</span>
                  </div>
                  <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                {SAMPLE_MEDS.map((med, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input defaultValue={med.name} className="text-sm h-8" readOnly />
                        <Input defaultValue={med.dosage} className="text-sm h-8" placeholder="Dosage" readOnly />
                      </div>
                      <button type="button" className="p-1.5 rounded text-muted-foreground hover:text-destructive transition shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Duration:</span>
                      <span className="text-xs font-medium">{med.durationDays} days</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {TIMING_SLOTS.map(slot => (
                        <div key={slot} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">{slot}</span>
                          <Input
                            type="time"
                            defaultValue={med.times[slot as keyof typeof med.times] ?? ""}
                            className="text-xs h-7 flex-1"
                            readOnly
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Procedures */}
              <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Procedures / Treatments</p>
                    <span className="text-xs text-muted-foreground">(nurse)</span>
                  </div>
                  <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">No procedures added</p>
              </div>

              {/* Plan Summary */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Plan Summary / Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  defaultValue="Upper Respiratory Tract Infection. Full physical exam performed. Throat and ears checked. No fever. Advised to rest and stay hydrated."
                  readOnly
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleActivate}
                  disabled={step === "activating"}
                  className="w-full gap-2"
                >
                  {step === "activating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {step === "activating" ? "Activating…" : "Close & Activate Treatment Plan"}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled={step === "activating"}>
                  Save Draft
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NarrationBubble
        text={
          step === "form"
            ? <>Medication instructions get lost on paper slips. ERA sends the <strong>full treatment plan</strong> — medications, dosage, timing — to the patient the moment it's activated.</>
            : step === "activating"
            ? <>Activating plan...</>
            : <><strong>Treatment plan sent.</strong> {prospect.firstName} has their medications, dosage, timing reminders, and instructions — delivered automatically. No paper. No confusion.</>
        }
        onNext={step === "form" ? handleActivate : step === "done" ? onNext : undefined}
        nextLabel={step === "form" ? "Close & Activate Treatment Plan →" : "Continue →"}
      />
    </div>
  );
}
