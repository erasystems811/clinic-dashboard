import { useState } from "react";
import { CheckCircle2, ArrowRight, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import type { Prospect } from "@/types";
import { apiUrl } from "@/lib/utils";

interface Props { prospect: Prospect; }

const HIGHLIGHTS = [
  "Automated SMS/Email at every patient stage",
  "Live pipeline & queue management",
  "4 role views: Admin, Receptionist, Nurse, Doctor",
  "ERA Messages — in-app messaging between staff & patients",
  "Post-visit feedback collected automatically",
  "EMR integration — no double entry",
  "Full patient journey analytics",
];

export default function S11_CTA({ prospect }: Props) {
  const [clicked, setClicked] = useState<"conversation" | "proposal" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleCTA(type: "conversation" | "proposal") {
    setClicked(type);
    setError("");
    try {
      await fetch(apiUrl("/api/demo/cta"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: prospect.sessionId,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          email: prospect.email,
          phone: prospect.phone,
          action: type,
        }),
      });
    } catch {
      // non-blocking — still show success state
    }
    setSent(true);
  }

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-12 text-center">
      {/* Complete badge */}
      <div className="mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm font-medium text-primary">Demo complete</p>
      </div>

      {/* Headline */}
      <div className="space-y-3 mb-8 max-w-md">
        <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
          That's ERA Patient, {prospect.firstName}.
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Queue chaos, lost care plans, silent patients, zero feedback — you just saw ERA solve every one of them. Automatically. For every patient.
        </p>
      </div>

      {/* Feature checklist */}
      <div className="text-left space-y-2 mb-10 w-full max-w-sm">
        {HIGHLIGHTS.map(h => (
          <div key={h} className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>{h}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      {!sent ? (
        <div className="flex gap-4 flex-wrap justify-center">
          <Button
            size="lg"
            className="gap-2 px-6"
            onClick={() => handleCTA("conversation")}
          >
            <MessageSquare className="w-4 h-4" /> Start a conversation
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 px-6"
            onClick={() => handleCTA("proposal")}
          >
            <FileText className="w-4 h-4" /> Get a proposal
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3 scale-in text-center">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
          <p className="font-semibold">
            {clicked === "conversation"
              ? `We'll be in touch, ${prospect.firstName}!`
              : `Proposal request received, ${prospect.firstName}!`}
          </p>
          <p className="text-sm text-muted-foreground">
            {clicked === "conversation"
              ? <>Our team will reach out to <span className="font-medium text-foreground">{prospect.email}</span> shortly to start the conversation.</>
              : <>We'll put together a personalised proposal and send it to <span className="font-medium text-foreground">{prospect.email}</span>.</>}
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">ERA Systems</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Clinic automation that actually works.</p>
      </div>
    </div>
  );
}
