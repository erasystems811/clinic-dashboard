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

          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em]">Real-time · Triggered immediately</p>
          </div>

          <Row
            label="Care plan onboarding — SMS / WhatsApp"
            note="The moment a nurse saves a care plan, the patient receives an SMS or WhatsApp message letting them know their plan is ready and to check their email for the full details. Channel is per-hospital (SMS or WhatsApp)."
            value="Instant"
          />
          <Row
            label="Queue: you're in — SMS / WhatsApp"
            note="Sent the moment a patient is checked in. Confirms their position in the queue and reassures them the team is ready."
            value="On check-in"
          />
          <Row
            label="Queue: you're next — SMS / WhatsApp"
            note="Sent automatically to whoever moves to position 1 after the patient ahead of them is called in. No manual action needed."
            value="Auto on position 1"
          />
          <Row
            label="Queue: it's your turn — SMS / WhatsApp"
            note="Sent to a patient the moment the receptionist ticks 'Called in' — confirming they should proceed to the consultation room."
            value="On called-in"
          />
          <Row
            label="Queue: long-wait apology — SMS / WhatsApp"
            note="Sent once to any patient who has been waiting more than 20 minutes. Fires automatically — the receptionist doesn't need to do anything."
            value="After 20 min"
          />
          <Row
            label="Appointment confirmation — Email"
            note="Sent immediately when a receptionist or admin books an appointment. Includes the date, time, and a note on how to reschedule."
            value="On booking"
          />

          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em]">Scheduled · Automated by the system</p>
          </div>

          <Row
            label="Care plan summary — Email"
            note="Sent 20 minutes after a nurse creates a care plan — giving staff time for edits before the patient receives the full AI-written explanation of their plan."
            value="20-min delay"
          />
          <Row
            label="In-care visit reminders — Email"
            note="Fire based on the exact times the nurse sets in the care plan. Lead times are per-department: medication-only fires at the exact time, come-to-hospital fires 3 hours before, combination fires 2 hours before, and all other departments (Antenatal, Paediatrics, Surgery, Dental, Eye, ENT, Fertility) fire 4 hours before the scheduled visit. The scheduler checks every hour and fires within a ±25-minute window of the correct lead time."
            value="Hourly check · dept-specific lead"
          />
          <Row
            label="Appointment reminders — Email"
            note="Two reminders fire automatically before every scheduled appointment: one the day before and one 2 hours ahead."
            value="24h + 2h"
          />
          <Row
            label="Appointment no-show follow-up — Email"
            note="Patients who miss an appointment receive a warm follow-up the next morning — acknowledging the missed visit and inviting them to rebook."
            value="Next morning"
          />
          <Row
            label="Post-treatment check-ins — Email"
            note="Patients who complete treatment receive personal check-in emails on Day 1, 4, and 7 after their treatment ends — keeping the clinic present during recovery."
            value="Day 1 · 4 · 7"
          />
          <Row
            label="Active patient follow-ups — Email"
            note="Patients in the Active stage who haven't visited or received this message in the last 30 days get a warm 'thinking of you' email. Runs daily at 6 PM. A 30-day per-patient cooldown prevents repeat sends."
            value="Daily 6 PM · 30-day cooldown"
          />
          <Row
            label="Birthday messages — Email"
            note="Every patient with a date of birth on file receives a personal birthday message from their hospital — once per calendar year, on their birthday."
            value="Annual"
          />
          <Row
            label="Feedback requests — Email"
            note="Patients who visited the previous day receive a feedback link at noon — capturing their impression while the visit is still fresh."
            value="Next day, 12pm"
          />
        </Section>

      </div>
    </Layout>
  );
}
