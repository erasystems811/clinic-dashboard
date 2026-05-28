import Layout from "@/components/layout";
import { Settings2, Globe, Mail, ShieldCheck, Server, Info } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.16em]">{title}</h2>
      <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  note,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  note?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm text-foreground font-medium">{label}</p>
          {note && <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{note}</p>}
        </div>
      </div>
      {value && (
        <span className={`text-xs text-muted-foreground shrink-0 ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "green" | "gold" | "gray" }) {
  const styles = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    gold:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray:  "bg-white/5 text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[color]}`}>
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin;

  return (
    <Layout title="Settings">
      <div className="max-w-2xl space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Settings2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Platform Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">ERA Systems configuration and platform information</p>
          </div>
        </div>

        {/* Platform */}
        <Section title="Platform">
          <Row
            icon={Server}
            label="ERA Systems"
            value="Multi-tenant Hospital Platform"
            note="Manages all hospital tenants, subscriptions, and platform-wide automations."
          />
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Globe className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">Platform URL</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">The base address for all patient-facing links and feedback URLs</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-mono shrink-0 ml-4 truncate max-w-[200px]">{appUrl}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">Scheduler</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Runs automated patient communications — appointment reminders, care plan follow-ups, birthday messages, and feedback requests</p>
              </div>
            </div>
            <Badge label="Active" color="green" />
          </div>
        </Section>

        {/* Email */}
        <Section title="Email">
          <Row
            icon={Mail}
            label="Outbound Email"
            note="All automated patient emails — care plans, reminders, newsletters, and check-ins — are sent via Resend using the platform's verified sender identity."
            value="Resend"
          />
          <Row
            label="Sender identity"
            note="Each hospital's display name is used as the sender name. Replies are not accepted — patients are directed to contact their clinic directly."
            value="Per-hospital display name"
          />
          <Row
            label="Termii SMS / WhatsApp"
            note="Mobile notifications (queue updates, care plan alerts) are routed through Termii using each hospital's chosen channel — SMS or WhatsApp."
            value="Per-hospital channel"
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">Super Admin Password</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Change the ERA Systems administrator login password. Use the Security option in the sidebar.</p>
              </div>
            </div>
            <Badge label="Protected" color="gold" />
          </div>
          <Row
            label="Hospital isolation"
            note="Each hospital's data is fully isolated by hospital_code. No cross-tenant data access is possible at the API level."
            value="Enforced"
          />
          <Row
            label="Session management"
            note="Super admin sessions are token-based and expire on browser close. No persistent sessions are stored."
          />
        </Section>

        {/* Automations summary */}
        <Section title="Automations">
          <Row
            label="Care plan emails"
            note="Sent 20 minutes after a nurse creates a care plan — giving staff time for edits before the patient is notified."
            value="20-min delay"
          />
          <Row
            label="Appointment reminders"
            note="Sent automatically 24 hours and 2 hours before each scheduled appointment."
            value="24h + 2h"
          />
          <Row
            label="Post-treatment check-ins"
            note="Patients who complete treatment receive personal check-in emails on Day 1, 4, and 7 after their treatment ends."
            value="Day 1 · 4 · 7"
          />
          <Row
            label="Active patient follow-ups"
            note="Patients in the Active stage who haven't visited in 30 days receive a warm check-in — keeping your clinic present in their lives."
            value="30-day cadence"
          />
          <Row
            label="Birthday emails"
            note="Every patient with a date of birth on file receives a personal birthday message from the hospital — once per calendar year."
            value="Annual"
          />
          <Row
            label="Feedback requests"
            note="Patients who visited the previous day receive a feedback link at noon — capturing responses while the visit is still fresh."
            value="Next day, 12pm"
          />
        </Section>

      </div>
    </Layout>
  );
}
