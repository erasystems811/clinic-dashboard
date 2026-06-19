import { Database, ArrowRight, CheckCircle2, Layers, Link2 } from "lucide-react";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

const FEATURES = [
  { icon: Database, label: "EMR Sync",        desc: "Patient records, history, and prescriptions pulled directly from your EMR — zero re-entry." },
  { icon: Layers,   label: "Any EMR System",  desc: "Works with major EMR platforms. ERA Patient sits on top without replacing your existing workflow." },
  { icon: Link2,    label: "Two-Way Sync",    desc: "Updates made in ERA Patient flow back to the EMR in real time. Always one source of truth." },
  { icon: CheckCircle2, label: "Verified & Secure", desc: "Data is encrypted in transit and at rest. HIPAA-aligned standards with audit trail." },
];

export default function S10_EMRCallout({ prospect, onNext }: Props) {

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-12 text-center space-y-10">
      {/* Headline */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
          <Database className="w-3.5 h-3.5" /> EMR Integration
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold leading-snug max-w-lg">
          Already using an EMR?{" "}
          <span className="text-primary">ERA connects to it.</span>
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
          Entering the same patient data in two systems creates errors and wastes time. ERA connects to your existing EMR so <strong>every entry flows automatically</strong> — one record, always in sync.
        </p>
      </div>

      {/* Flow diagram */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="px-5 py-4 rounded-xl bg-card border border-border text-center min-w-[130px]">
          <p className="text-xs text-muted-foreground font-medium mb-2">Your EMR</p>
          <div className="w-8 h-8 rounded-lg bg-secondary border border-border mx-auto flex items-center justify-center">
            <Database className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Any EMR system</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowRight className="w-5 h-5 text-primary" />
          <span className="text-[10px] text-muted-foreground">Live sync</span>
          <ArrowRight className="w-5 h-5 text-primary rotate-180" />
        </div>
        <div className="px-5 py-3.5 rounded-xl bg-primary/10 border border-primary/40 text-center min-w-[120px]">
          <div className="w-8 h-8 rounded-lg bg-primary/20 mx-auto mb-2 flex items-center justify-center">
            <div className="w-4 h-4 rounded-sm bg-primary" />
          </div>
          <p className="text-xs font-semibold text-primary">ERA Patient</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Your complete clinical suite</p>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
        {FEATURES.map(f => (
          <div key={f.label} className="text-left px-4 py-3.5 rounded-xl bg-card border border-border space-y-1.5">
            <div className="flex items-center gap-2">
              <f.icon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">{f.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <NarrationBubble
        text={<>Your existing EMR and ERA Patient stay in sync — <strong>your team enters data once</strong>. Everything flows automatically. No chaos, no duplication.</>}
        onNext={onNext}
        nextLabel="See the wrap-up →"
      />
    </div>
  );
}
