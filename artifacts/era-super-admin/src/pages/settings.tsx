import Layout from "@/components/layout";
import { Settings2, Globe, Mail, ShieldCheck, Server, Info, Zap, Clock } from "lucide-react";

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
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  note?: string;
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
        <span className="text-[11px] text-muted-foreground shrink-0 ml-4 font-mono whitespace-nowrap">{value}</span>
      )}
    </div>
  );
}

function SubHeading({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1 bg-white/[0.02]">
      <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.14em]">{label}</p>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "green" | "gold" | "gray" | "blue" }) {
  const styles = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    gold:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gray:  "bg-white/5 text-muted-foreground border-border",
    blue:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
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
            <p className="text-xs text-muted-foreground mt-0.5">ERA Systems configuration, platform information, and complete automation reference</p>
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
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Base address for all patient-facing links and feedback URLs</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-mono shrink-0 ml-4 truncate max-w-[200px]">{appUrl}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">Scheduler</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Runs automated patient communications — controlled by ENABLE_SCHEDULER=true env var (production only)</p>
              </div>
            </div>
            <Badge label="Active" color="green" />
          </div>
        </Section>

        {/* Messaging infrastructure */}
        <Section title="Messaging">
          <Row
            icon={Mail}
            label="Outbound email"
            note="All automated patient emails are sent via Resend using the platform's verified sender identity. Each hospital's display name (or configured sender name) is used as the From name."
            value="Resend"
          />
          <Row
            label="SMS / WhatsApp"
            note="Mobile notifications are delivered via Termii using each hospital's configured channel (SMS or WhatsApp) and their own Termii sender ID. Falls back to the platform-level TERMII_SENDER_ID env var if none is set per-hospital."
            value="Termii · per-hospital"
          />
          <Row
            label="Termii balance alert"
            note="Daily at 9 AM the scheduler checks the Termii account balance. If it falls below ₦50, an alert email is sent to SUPER_ADMIN_ALERT_EMAIL. SMS/WhatsApp stops delivering when credits run out."
            value="Daily 9 AM · < ₦50"
          />
          <Row
            label="AI model — care plan emails"
            note="Care plan summary emails are written by Claude (Anthropic) — warm, plain-English, patient-friendly. Never mentions diagnosis. Ends with a do-not-reply instruction."
            value="Claude (Anthropic)"
          />
          <Row
            label="AI model — in-care reminders"
            note="In-care visit reminders (medication, hospital visit, combination) are generated by OpenAI — personalised per care plan summary, department, and slot type."
            value="OpenAI"
          />
          <Row
            label="AI model — newsletter"
            note="Wellness newsletter content is generated by Claude — curated health tips tailored to the hospital's patient demographic."
            value="Claude (Anthropic)"
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">Super Admin password</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Change via the Security option in the sidebar</p>
              </div>
            </div>
            <Badge label="Protected" color="gold" />
          </div>
          <Row
            label="Hospital isolation"
            note="Every API query is scoped to hospital_code (UUID). No cross-tenant data access is possible — patients, care_plans, queue, and activity all filter by hospital_code, never by integer id."
            value="Enforced"
          />
          <Row
            label="Session management"
            note="Super admin sessions are token-based and expire on browser close. Hospital staff sessions (nurse/receptionist/admin) are stored in localStorage and expire on logout."
          />
        </Section>

        {/* ── AUTOMATIONS ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.16em]">Automations</h2>
            <span className="text-[9px] text-muted-foreground/40 font-mono">— complete reference</span>
          </div>

          {/* Cron cadence summary */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-white/[0.02]">
              <Clock className="w-3.5 h-3.5 text-primary/60" />
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Scheduler cadence</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                ["Every 5 min", "Care plan summary email (20-min delay window)"],
                ["Every 10 min", "Queue long-wait apology (> 20 min threshold)"],
                ["Every 15 min", "Appt reminders · no-show detection · no-show follow-up"],
                ["Every hour", "In-care visit reminders (dept-specific lead times)"],
                ["Every 6 hours", "Subscription expiration check"],
                ["Daily 7 AM", "Pipeline transitions · post-treatment check-ins · dormant detection · birthdays"],
                ["Daily 9 AM", "Termii balance alert (< ₦50 threshold)"],
                ["Daily 12 PM", "Feedback emails (previous day's patients)"],
                ["Daily 6 PM", "Active patient follow-ups (30-day cooldown)"],
                ["Daily 11 PM", "No-show dismissal (cleans up unresolved no-shows)"],
              ].map(([time, desc]) => (
                <div key={time} className="flex items-baseline gap-2 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-mono text-primary/70 whitespace-nowrap shrink-0 w-[90px]">{time}</span>
                  <span className="text-[10px] text-muted-foreground/60 leading-snug">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time automations */}
          <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            <SubHeading label="Real-time · triggered instantly by staff actions" />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Zap className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Care plan</p>
            </div>
            <Row
              label="Care plan onboarding — SMS / WhatsApp"
              note="Fires the moment a nurse saves a care plan (POST /care-plans or POST /patients/:id/treatment-plan). Message: 'Hi [name], your care plan at [hospital] has been set up. Please check your email for the full details.' Channel is per-hospital (SMS or WhatsApp via Termii). No dedup needed — fires exactly once per care plan creation."
              value="Instant · on save"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Zap className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Queue (4 messages)</p>
            </div>
            <Row
              label="Queue: you're in — SMS / WhatsApp"
              note="Fires when receptionist checks a patient in (POST /patients/:id/checkin). Confirms their position and reassures them the team is ready. Appointment patients are inserted at position 1; walk-ins get the next available position."
              value="On check-in"
            />
            <Row
              label="Queue: you're next — SMS / WhatsApp"
              note="Auto-fires to whoever moves to position 1 after the patient ahead is called in (POST /patients/:id/dequeue → remaining[0]). No manual action needed — purely automatic."
              value="Auto · new position 1"
            />
            <Row
              label="Queue: it's your turn — SMS / WhatsApp"
              note="Fires to the patient being called in the moment the receptionist ticks 'Called in' (POST /patients/:id/dequeue). Message: 'It is your turn now at [hospital]. Please proceed, we are ready for you.'"
              value="On called-in"
            />
            <Row
              label="Queue: long-wait apology — SMS / WhatsApp"
              note="Scheduler fires every 10 min. Any patient who has been in the queue for > 20 minutes and hasn't yet received an apology for this queue session gets one. Dedup key: queue_long_wait_{entry.id} — fires at most once per check-in session, regardless of how long the wait continues."
              value="Every 10 min · > 20 min wait"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Zap className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Appointments</p>
            </div>
            <Row
              label="Appointment confirmation — Email"
              note="Fires immediately when an appointment is booked. Includes the full date/time and instructions for rescheduling. Dedup: each appointment has one confirmation record."
              value="On booking"
            />
          </div>

          {/* Scheduled automations */}
          <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            <SubHeading label="Scheduled · automated by the system" />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Care plan — every 5 min</p>
            </div>
            <Row
              label="Care plan summary — Email (AI: Claude)"
              note="Picks up care plans created 15-25 minutes ago that haven't had a care_plan_email sent yet — targeting a 20-minute delay to give the nurse time for last-minute edits. AI-written by Claude: warm, plain-English, explains the plan to the patient, ends with a do-not-reply instruction. Dedup key: care_plan_email_{plan.id}."
              value="Every 5 min · 15–25 min window"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">In-care reminders — every hour</p>
            </div>
            <Row
              label="In-care visit reminders — Email (AI: OpenAI)"
              note="Fires every hour using a ±25-minute matching window. Lead times are department-specific based on what the nurse configures in the care plan: General Outpatient / medication-only → fires AT the exact medication time (0h lead). General Outpatient / come-to-hospital → 3 hours before. General Outpatient / combination → 2 hours before. All other departments (Antenatal, Paediatrics, Surgery/Post-Op, Dental, Eye, Fertility/IVF, ENT) → 4 hours before the nurse-set visit time. AI-written by OpenAI per care plan summary. Dedup: per-plan-slot-date key prevents re-send on the same day."
              value="Hourly · dept-specific lead"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Appointments — every 15 min</p>
            </div>
            <Row
              label="Appointment reminder 24h — Email"
              note="Fires when a scheduled appointment is exactly 24h-24h15m away. Dedup: reminder_24h_sent_at column on the appointment — set once, never re-fires."
              value="24h before · 15-min window"
            />
            <Row
              label="Appointment reminder 2h — Email"
              note="Fires when a scheduled appointment is exactly 2h-2h15m away. Dedup: reminder_2h_sent_at column on the appointment."
              value="2h before · 15-min window"
            />
            <Row
              label="No-show detection + follow-up — Email"
              note="Runs every 15 min. Marks an appointment as no-show if the scheduled time has passed and the patient hasn't been checked in. A follow-up email ('We missed you today') fires approximately 1 hour after the no-show is detected. At 11 PM the scheduler dismisses all unresolved no-shows for the day."
              value="Every 15 min + 11 PM cleanup"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Daily 7 AM</p>
            </div>
            <Row
              label="Post-treatment stage transitions"
              note="Checks all patients with a treatment_end_date in the past and transitions them to Post Treatment stage. Runs at 7 AM so the clinic starts each day with an accurate patient roster."
              value="Daily 7 AM"
            />
            <Row
              label="Post-treatment check-ins — Email (Day 1, 4, 7)"
              note="Fires on the 1st, 4th, and 7th day after a patient's treatment_end_date. Each has a 2-day send window to avoid permanently missing the email if the server was down. Dedup is scoped to the current treatment cycle — a patient who re-enrolls receives these emails again on their next treatment end. 7 AM firing."
              value="Daily 7 AM · Day 1/4/7"
            />
            <Row
              label="Dormant detection"
              note="Active patients who have had no clinical activity (check-in, care plan, or patient record update) for the hospital's configured pipeline_dormant_days threshold are moved to Dormant stage. Runs at 7 AM."
              value="Daily 7 AM · per-hospital threshold"
            />
            <Row
              label="Birthday messages — Email"
              note="Sends a personal birthday email to every patient with a matching date of birth. Fires at 7 AM. Dedup: one birthday email per patient per calendar year (checked via automation_log)."
              value="Daily 7 AM · once/year"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Daily 12 PM</p>
            </div>
            <Row
              label="Feedback requests — Email"
              note="Patients who were checked in (queued) the previous day receive a feedback link at noon. Captures their impression while the visit is still fresh. Dedup: automation_log feedback_email per patient per day — one send per visit day."
              value="Daily 12 PM · previous day's patients"
            />

            <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.015]">
              <Clock className="w-3 h-3 text-primary/50" />
              <p className="text-[10px] text-muted-foreground/50 font-medium">Daily 6 PM</p>
            </div>
            <Row
              label="Active patient follow-ups — Email"
              note="Patients in the Active stage who have not been checked in within the last 30 days and have not received this email in the last 30 days receive a warm 'Thinking of you' message. Runs at 6 PM. Requires wellness_newsletter_enabled = true for the hospital. Dedup: 30-day cooldown per patient via automation_log post_care_email type."
              value="Daily 6 PM · 30-day cooldown"
            />
          </div>
        </div>

      </div>
    </Layout>
  );
}
