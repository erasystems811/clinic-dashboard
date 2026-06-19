import { useState } from "react";
import { Calendar, Clock, CheckCircle2, User, Phone, FileText } from "lucide-react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

const SLOTS = [
  { id: "1", label: "Mon · 9:00 AM" },
  { id: "2", label: "Mon · 10:30 AM" },
  { id: "3", label: "Mon · 2:00 PM" },
  { id: "4", label: "Tue · 9:00 AM" },
  { id: "5", label: "Tue · 11:00 AM" },
  { id: "6", label: "Wed · 3:30 PM" },
];

interface Props { prospect: Prospect; onNext: () => void; }

export default function S_SelfBooking({ prospect, onNext }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "submitting" | "done">("pick");

  function handleBook() {
    if (!selectedSlot) return;
    setStep("submitting");
    setTimeout(() => setStep("done"), 1300);
  }

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-8 space-y-6">

      {/* Label showing this is a public page */}
      <div className="text-center space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Public booking page · erasystems.com.ng/book/era-hospital</span>
        <h2 className="text-xl font-bold">Self-Booking</h2>
        <p className="text-sm text-muted-foreground">Patients book their own appointment — no phone call, no receptionist</p>
      </div>

      <div className="w-full max-w-sm">
        {step === "done" ? (
          <Card className="border-green-500/30 bg-green-500/5 text-center">
            <CardContent className="pt-8 pb-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              <p className="font-semibold text-green-400 text-lg">Request Sent!</p>
              <p className="text-sm text-muted-foreground">
                ERA Hospital will confirm your slot via SMS. You'll receive a confirmation once the clinic approves.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-5 space-y-5">

              {/* Hospital header inside card */}
              <div className="flex items-center gap-3 pb-1 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <div className="w-4.5 h-4.5 rounded-sm bg-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">ERA Hospital</p>
                  <p className="text-xs text-muted-foreground">Lagos · General Practice</p>
                </div>
                <span className="ml-auto text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">Slots available</span>
              </div>

              {/* Slot picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Calendar className="w-3.5 h-3.5" /> Pick a time slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SLOTS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSlot(s.id)}
                      className={`text-xs px-3 py-2.5 rounded-lg border text-left transition-all ${
                        selectedSlot === s.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Clock className="w-3 h-3 inline mr-1 mb-0.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient details */}
              <div className="space-y-2">
                <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <User className="w-3.5 h-3.5" /> Your details
                </label>
                <Input defaultValue={`${prospect.firstName} ${prospect.lastName}`} placeholder="Full name" />
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8" defaultValue={prospect.phone} placeholder="Phone number" />
                </div>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Reason for visit (optional)" />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selectedSlot || step === "submitting"}
                onClick={handleBook}
              >
                {step === "submitting" ? "Sending request…" : "Request Appointment →"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">No account needed · Confirmation sent via SMS</p>
            </CardContent>
          </Card>
        )}
      </div>

      <NarrationBubble
        text={
          step !== "done"
            ? <>Every hospital gets a <strong>public booking link</strong>. Patients pick a slot, enter their details, and submit — no phone tag, no receptionist needed. Select a slot and try it.</>
            : <><strong>Booking request received.</strong> It lands instantly in the admin's appointments tab. They confirm — and ERA sends the patient an SMS confirmation. {prospect.firstName} booked without a single phone call.</>
        }
        onNext={step === "done" ? onNext : undefined}
        nextLabel="Continue →"
      />
    </div>
  );
}
