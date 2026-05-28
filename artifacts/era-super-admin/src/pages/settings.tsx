import { useState } from "react";
import Layout from "@/components/layout";
import { api } from "@/lib/api";
import {
  Mail, MessageSquare, Clock, Zap, Calendar, Star, Newspaper,
  UserPlus, ClipboardList, BellRing, HeartPulse, Users, Gift,
  ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle2, Server,
  Cpu, AlertTriangle, ArrowRight, Activity, GitBranch, Phone,
  Loader2,
} from "lucide-react";

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Security ───────────────────────────────────────────────────────────────────
function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition";

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={ShieldCheck} title="Account Security" subtitle="Super admin password — protects access to all hospital data" />
      {done ? (
        <div className="flex items-center gap-3 py-4 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Password updated successfully</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your new password is active. Use it on next sign-in.</p>
          </div>
          <button onClick={() => setDone(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition">Change again</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Password</label>
            <div className="relative">
              <input type={showCurrent ? "text" : "password"} value={current} onChange={e => setCurrent(e.target.value)} required className={inputCls} placeholder="Current password" />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">New Password</label>
            <div className="relative">
              <input type={showNext ? "text" : "password"} value={next} onChange={e => setNext(e.target.value)} required className={inputCls} placeholder="Min. 8 characters" />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                {showNext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Confirm New</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={inputCls.replace("pr-10", "")} placeholder="Repeat new password" />
          </div>
          {error && <p className="sm:col-span-3 text-xs text-destructive">{error}</p>}
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Updating…</> : <><KeyRound className="w-3.5 h-3.5" />Update Password</>}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── Connected Services ─────────────────────────────────────────────────────────
const SERVICES = [
  {
    name: "Resend",
    icon: Mail,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    purpose: "Email delivery",
    used_for: "All automated patient emails — care plan summaries, appointment reminders, post-treatment check-ins, feedback requests, birthday greetings, wellness newsletters, in-care reminders.",
    env: "RESEND_API_KEY",
    from: "Configured per-hospital via sender name + verified domain",
  },
  {
    name: "Termii",
    icon: Phone,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    purpose: "SMS & WhatsApp",
    used_for: "Queue messages (check-in, next in line, your turn, long wait apology), care plan onboarding notifications, appointment reminders via WhatsApp.",
    env: "TERMII_API_KEY + TERMII_BASE_URL",
    from: "Per-hospital: WhatsApp sender number or SMS sender ID",
  },
  {
    name: "OpenAI",
    icon: Cpu,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    purpose: "AI message generation",
    used_for: "Personalised in-care reminders, post-treatment check-in emails, appointment reminders, no-show follow-ups, post-care wellness emails, birthday messages. All written in the patient's language and the hospital's tone.",
    env: "OPENAI_API_KEY",
    from: "gpt-4o-mini model — currently routed through Anthropic Claude as fallback",
  },
  {
    name: "Anthropic (Claude)",
    icon: Cpu,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    purpose: "Newsletter AI generation",
    used_for: "Wellness newsletter content — long-form health tips and seasonal wellness articles generated for each hospital's patient base. Also currently handling all OpenAI fallback calls.",
    env: "ANTHROPIC_API_KEY",
    from: "claude-3-5-haiku model",
  },
  {
    name: "Sentry",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    purpose: "Error monitoring",
    used_for: "Captures all API server exceptions including automation failures, scheduler errors, and database issues. Alerts in real time so nothing fails silently.",
    env: "SENTRY_DSN",
    from: "API server only — frontend errors not tracked",
  },
  {
    name: "Supabase",
    icon: Server,
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    purpose: "Database & auth",
    used_for: "Primary data store for all hospitals, patients, appointments, care plans, queue entries, automation logs, and pipeline stages. Also provides row-level security.",
    env: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
    from: "PostgreSQL — accessed via Supabase JS client",
  },
];

function ServicesSection() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={Activity} title="Connected Services" subtitle="Every external service Era depends on and what it powers" />
      <div className="grid sm:grid-cols-2 gap-3">
        {SERVICES.map(s => (
          <div key={s.name} className={`rounded-lg border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2.5 mb-2">
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div>
                <p className="text-sm font-bold text-foreground">{s.name}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${s.color}`}>{s.purpose}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.used_for}</p>
            <div className="space-y-1 border-t border-white/5 pt-2">
              <p className="text-[10px] text-muted-foreground/60"><span className="font-bold text-muted-foreground/80">Env:</span> {s.env}</p>
              <p className="text-[10px] text-muted-foreground/60"><span className="font-bold text-muted-foreground/80">Note:</span> {s.from}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Scheduler Reference ────────────────────────────────────────────────────────
const SCHEDULE = [
  { time: "Every 5 min",  jobs: ["Care plan email delay — picks up plans created 15–25 min ago, sends full summary email to patient"] },
  { time: "Every 15 min", jobs: ["Appointment reminders (24h + 1h before visit)", "No-show detection — checks for missed appointments", "No-show 1-hour follow-up email"] },
  { time: "Every hour",   jobs: ["In-care reminders — checks all active care plan patients, fires morning/afternoon/evening/night slot reminders based on department settings"] },
  { time: "Daily 7 AM",   jobs: ["Post-treatment stage transitions", "Post-treatment check-in emails (days 1, 4, 7)", "Dormant patient detection", "Birthday emails"] },
  { time: "Daily 9 AM",   jobs: ["Termii credit balance alert — warns if SMS/WhatsApp credits are low"] },
  { time: "Daily 12 PM",  jobs: ["Feedback request emails — covers previous day's completed visits"] },
  { time: "Daily 6 PM",   jobs: ["Post-care wellness emails — targets patients dormant 30+ days"] },
  { time: "Daily 11 PM",  jobs: ["No-show dismissal — clears unresolved no-shows from today's schedule"] },
  { time: "Every 6 hours", jobs: ["Subscription expiration check — flags hospitals approaching expiry, deactivates expired ones"] },
];

function SchedulerSection() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={Clock} title="Scheduler Timetable" subtitle="Exact run times for every background job — enable via ENABLE_SCHEDULER=true on Railway" />
      <div className="space-y-1">
        {SCHEDULE.map(row => (
          <div key={row.time} className="flex gap-4 py-2.5 border-b border-border/60 last:border-0">
            <div className="w-28 shrink-0">
              <span className="text-xs font-bold text-primary font-mono">{row.time}</span>
            </div>
            <ul className="space-y-0.5 flex-1 min-w-0">
              {row.jobs.map(j => (
                <li key={j} className="flex items-start gap-1.5">
                  <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{j}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pipeline Stages ────────────────────────────────────────────────────────────
const STAGES = [
  {
    id: "In Care",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    dot: "bg-blue-400",
    description: "Patient has an active care plan saved by the nurse. This is the primary treatment stage.",
    triggers: "Nurse saves a care plan from the nurse station.",
    automations: "Instant care plan SMS/WhatsApp notification → 20-min delayed care plan email → Hourly in-care reminders (based on time slots in the care plan).",
    exits: "Manual stage update or when all care plan dates pass.",
  },
  {
    id: "Post Treatment",
    color: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    dot: "bg-violet-400",
    description: "Treatment has ended. Era sends a warm check-in sequence to support recovery and retain the patient.",
    triggers: "Daily 7 AM job — patient's care plan end date has passed.",
    automations: "Check-in email on Day 1 after treatment → Day 4 → Day 7. Each is AI-written with the hospital's tone.",
    exits: "Automatically moves to Active after the 7-day check-in sequence completes.",
  },
  {
    id: "Active",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    dot: "bg-emerald-400",
    description: "Patient is in the system with no active treatment. Stays engaged through wellness content.",
    triggers: "Moves here automatically after Post Treatment, or manually set.",
    automations: "Eligible for wellness newsletter, appointment reminders, birthday emails, and feedback requests.",
    exits: "Moves to Dormant if no activity for the configured number of days (default 90).",
  },
  {
    id: "Dormant",
    color: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400",
    dot: "bg-zinc-400",
    description: "Patient has been inactive for an extended period. Era tries to bring them back.",
    triggers: "Daily 7 AM — patient has had no appointment or visit for 30+ days (configurable per hospital).",
    automations: "Daily 6 PM — post-care wellness re-engagement email. Continues until patient books again.",
    exits: "Returns to Active when patient books or visits again.",
  },
];

function PipelineSection() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={GitBranch} title="Patient Pipeline — Stage Reference" subtitle="How patients move through Era and what fires at each stage" />
      <div className="grid sm:grid-cols-2 gap-3">
        {STAGES.map((s, i) => (
          <div key={s.id} className={`rounded-lg border p-4 ${s.color.split(" ").slice(0, 2).join(" ")}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground/50">Stage {i + 1}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={`text-sm font-bold ${s.color.split(" ").slice(2).join(" ")}`}>{s.id}</span>
              </div>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed mb-3">{s.description}</p>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Triggered by</span>
                <p className="text-muted-foreground leading-relaxed">{s.triggers}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Automations</span>
                <p className="text-muted-foreground leading-relaxed">{s.automations}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Exits to</span>
                <p className="text-muted-foreground leading-relaxed">{s.exits}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Automation Reference ───────────────────────────────────────────────────────
interface AutomationDef {
  id: string;
  name: string;
  purpose: string;
  trigger: string;
  channel: "email" | "sms/whatsapp" | "both";
  icon: React.ComponentType<{ className?: string }>;
  timing: string;
  notes?: string;
}

const AUTOMATIONS: AutomationDef[] = [
  { id: "queue_join", name: "Queue Check-In", purpose: "Reassures a patient they are registered and tells them their position in line so they feel informed from the moment they arrive.", trigger: "Receptionist checks a patient into the queue", channel: "sms/whatsapp", icon: ClipboardList, timing: "Instant — fires the moment the patient is checked in" },
  { id: "queue_next_in_line", name: "Next In Line Alert", purpose: "Gives the patient time to get ready before their turn, reducing calling delays and keeping the queue moving.", trigger: "Patient reaches 2nd position in the queue", channel: "sms/whatsapp", icon: BellRing, timing: "Instant — fires when previous patient is called" },
  { id: "queue_your_turn", name: "It's Your Turn", purpose: "Calls the patient in when the doctor is ready, eliminating the need for staff to physically search the waiting area.", trigger: "Receptionist calls the patient from the queue screen", channel: "sms/whatsapp", icon: BellRing, timing: "Instant — fires when staff taps 'Call Patient'" },
  { id: "queue_long_wait_apology", name: "Long Wait Apology", purpose: "Preserves patient goodwill during unusually long waits by proactively acknowledging the delay.", trigger: "Staff manually sends from the queue screen", channel: "sms/whatsapp", icon: Clock, timing: "Manual trigger only" },
  { id: "care_plan_notification", name: "Care Plan Ready (SMS/WhatsApp)", purpose: "Immediately notifies the patient the moment their care plan is saved, directing them to check their email for full details.", trigger: "Nurse saves a care plan in the nurse station", channel: "sms/whatsapp", icon: UserPlus, timing: "Instant — fires on save" },
  { id: "care_plan_email", name: "Care Plan Summary Email", purpose: "Delivers the full care plan in plain, patient-friendly language so they understand their treatment without needing to ask questions.", trigger: "Care plan created — 20-minute delay gives nurse time for last-minute edits", channel: "email", icon: Mail, timing: "20 minutes after save — checked every 5 min by scheduler" },
  { id: "in_care_reminder", name: "Continuous In-Care Reminders", purpose: "Keeps the patient on track with medication and clinic visits throughout their treatment, reducing missed doses and no-shows.", trigger: "Patient is active in a care plan with time-slot preferences set (morning/afternoon/evening/night)", channel: "email", icon: HeartPulse, timing: "Every hour — fires based on department time slots, NOT a fixed daily time.", notes: "Each department can have different reminder frequencies and slots configured in hospital settings." },
  { id: "care_plan_visit_reminder", name: "Scheduled Care Visit Reminder", purpose: "Ensures the patient remembers a specific clinic or procedure date from their care plan.", trigger: "Patient has a scheduled care/procedure date set by the nurse in their care plan", channel: "email", icon: Calendar, timing: "Every hour — fires 4 hours before the nurse-set visit time (General Outpatient: 2 hours before). Timing is department-driven, not a fixed daily slot." },
  { id: "post_treatment_checkin", name: "Post-Treatment Check-Ins", purpose: "Shows the patient the clinic still cares about their recovery after they leave, reducing anxiety and increasing loyalty.", trigger: "Patient moves to Post-Treatment stage", channel: "email", icon: HeartPulse, timing: "Day 1, Day 4, and Day 7 after treatment ends — checked daily at 7 AM" },
  { id: "post_care_email", name: "Dormant Re-Engagement", purpose: "Gently reminds long-inactive patients the clinic exists and invites them back before they are lost.", trigger: "Patient has been dormant for 30+ days", channel: "email", icon: Users, timing: "Daily at 6 PM" },
  { id: "appointment_reminder", name: "Appointment Reminder", purpose: "Reduces no-shows by keeping the patient aware of their upcoming visit at two critical moments.", trigger: "Patient has an upcoming appointment", channel: "both", icon: Calendar, timing: "24 hours before + 1 hour before — checked every 15 minutes" },
  { id: "no_show_followup", name: "No-Show Follow-Up", purpose: "Recovers potentially lost patients by reaching out compassionately after a missed appointment.", trigger: "Patient misses an appointment (no check-in recorded)", channel: "email", icon: Calendar, timing: "1 hour after missed appointment time — checked every 15 minutes" },
  { id: "feedback_email", name: "Post-Visit Feedback Request", purpose: "Captures patient satisfaction data while the visit is fresh.", trigger: "Patient has a completed appointment from the previous day", channel: "email", icon: Star, timing: "Daily at 12 PM" },
  { id: "birthday_email", name: "Birthday Greeting", purpose: "Deepens the patient relationship with a personal touch that most clinics never bother with.", trigger: "Patient's date of birth matches today's date", channel: "email", icon: Gift, timing: "Daily at 7 AM" },
  { id: "wellness_newsletter", name: "Wellness Newsletter", purpose: "Keeps the clinic top-of-mind for all active patients between visits with relevant health tips.", trigger: "Admin manually sends from the Wellness Newsletter screen", channel: "email", icon: Newspaper, timing: "Manual trigger — admin chooses when to send" },
];

const CHANNEL_STYLE: Record<string, string> = {
  "email": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "sms/whatsapp": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "both": "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function AutomationsSection() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={Zap} title="All Automations" subtitle={`${AUTOMATIONS.length} automations — purpose, trigger, channel, and exact timing`} />
      <div className="space-y-2">
        {AUTOMATIONS.map(a => (
          <div key={a.id} className="rounded-lg border border-border bg-background/40 p-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-foreground">{a.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${CHANNEL_STYLE[a.channel]}`}>
                    {a.channel}
                  </span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed mb-2">{a.purpose}</p>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trigger</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.trigger}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Timing</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.timing}</p>
                  </div>
                </div>
                {a.notes && <p className="text-[11px] text-amber-400/80 mt-2 border-t border-border pt-2">⚠ {a.notes}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <Layout>
      <div className="mb-8">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Platform Configuration</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Everything about this platform — security, services, scheduler, pipeline stages, and all automations
        </p>
      </div>

      <div className="space-y-5">
        <SecuritySection />
        <ServicesSection />
        <SchedulerSection />
        <PipelineSection />
        <AutomationsSection />
      </div>
    </Layout>
  );
}
