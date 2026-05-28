import Layout from "@/components/layout";
import {
  Mail, MessageSquare, Clock, Zap, Calendar, Star, Newspaper,
  UserPlus, ClipboardList, BellRing, HeartPulse, Users, Gift,
  Server, Cpu, AlertTriangle, ArrowRight, Activity, GitBranch, Phone,
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
    name: "Anthropic (Claude)",
    icon: Cpu,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    purpose: "All AI message generation",
    used_for: "Every AI-written message in Era — in-care reminders, post-treatment check-ins, appointment reminders, no-show follow-ups, birthday greetings, post-care wellness emails, and wellness newsletters. All written in the patient's language with the hospital's configured tone.",
    env: "ANTHROPIC_API_KEY",
    from: "Model: claude-haiku-4-5-20251001 — used for both short patient messages and long-form newsletter content",
  },
  {
    name: "OpenAI",
    icon: Cpu,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    purpose: "Key held — not currently active",
    used_for: "OpenAI (gpt-4o-mini) is the intended AI provider for patient message generation. All calls are currently routed through Anthropic Claude to use existing credits. OpenAI will take over when routing is switched back in ai.ts.",
    env: "OPENAI_API_KEY",
    from: "Key is validated in health checks but not used for live generation at this time",
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
  { time: "Every 15 min", jobs: ["Appointment reminders (24h + 2h before visit)", "No-show detection — checks for missed appointments", "No-show 1-hour follow-up email"] },
  { time: "Every hour",   jobs: ["In-care reminders — checks all active care plan patients, fires morning/afternoon/evening/night slot reminders based on department settings", "Scheduled care visit reminders — fires 4h before nurse-set visit time (General Outpatient: 2h before)"] },
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
  note?: string;
}

interface AutomationGroup {
  label: string;
  timingBadge: string;
  description: string;
  accentBorder: string;
  accentText: string;
  accentBg: string;
  badgeBg: string;
  items: AutomationDef[];
}

const AUTOMATION_GROUPS: AutomationGroup[] = [
  {
    label: "Immediate",
    timingBadge: "Fires instantly",
    description: "No scheduler involved — sends the moment an action is taken by staff or the system.",
    accentBorder: "border-l-emerald-500",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/5",
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    items: [
      { id: "queue_join", name: "Queue Check-In", purpose: "Reassures a patient they are registered and tells them their position in line so they feel informed from the moment they arrive.", trigger: "Receptionist checks a patient into the queue", channel: "sms/whatsapp", icon: ClipboardList },
      { id: "queue_next_in_line", name: "Next In Line Alert", purpose: "Gives the patient time to get ready before their turn, reducing calling delays and keeping the queue moving.", trigger: "Patient reaches 2nd position in the queue", channel: "sms/whatsapp", icon: BellRing },
      { id: "queue_your_turn", name: "It's Your Turn", purpose: "Calls the patient in when the doctor is ready, eliminating the need for staff to physically search the waiting area.", trigger: "Receptionist taps 'Call Patient' on the queue screen", channel: "sms/whatsapp", icon: BellRing },
      { id: "care_plan_notification", name: "Care Plan Ready", purpose: "Immediately notifies the patient the moment their care plan is saved, directing them to check their email for full details.", trigger: "Nurse saves a care plan in the nurse station", channel: "sms/whatsapp", icon: UserPlus },
    ],
  },
  {
    label: "Delayed Send",
    timingBadge: "20 min after trigger",
    description: "Waits before sending to give staff time to make last-minute edits.",
    accentBorder: "border-l-sky-500",
    accentText: "text-sky-400",
    accentBg: "bg-sky-500/5",
    badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    items: [
      { id: "care_plan_email", name: "Care Plan Summary Email", purpose: "Delivers the full care plan in plain, patient-friendly language so they understand their treatment without needing to ask questions.", trigger: "Care plan saved — 20-minute hold gives the nurse time for last-minute edits before the email goes out", channel: "email", icon: Mail },
    ],
  },
  {
    label: "In-Care Reminders",
    timingBadge: "Checked every hour · timing varies by dept",
    description: "One hourly job handles all active care plan patients. Exactly when each message fires depends on the department and treatment type — broken down below.",
    accentBorder: "border-l-violet-500",
    accentText: "text-violet-400",
    accentBg: "bg-violet-500/5",
    badgeBg: "bg-violet-500/10 text-violet-400 border-violet-500/25",
    items: [
      {
        id: "genout_med_only",
        name: "General Outpatient — Medication Only",
        purpose: "Reminds the patient to take their medication at the exact time it is due. No lead time — the message fires at the moment of the medication slot.",
        trigger: "Treatment type is Medication Only · fires AT the nurse-set medication time (e.g. medication at 08:00 → message at 08:00)",
        channel: "email",
        icon: HeartPulse,
      },
      {
        id: "genout_hospital",
        name: "General Outpatient — Come to Hospital",
        purpose: "Gives the patient time to prepare and travel before a scheduled hospital visit.",
        trigger: "Treatment type is Come to Hospital · fires 3 hours before the nurse-set visit slot",
        channel: "email",
        icon: HeartPulse,
      },
      {
        id: "genout_combo",
        name: "General Outpatient — Combination (Medication + Hospital)",
        purpose: "Sends ONE combined message covering both medication and the hospital visit, so the patient isn't double-messaged.",
        trigger: "Treatment type is Combination · fires 2 hours before — one message covering both medication reminders and the visit",
        channel: "email",
        icon: HeartPulse,
      },
      {
        id: "care_plan_visit_reminder",
        name: "Scheduled Care Visit — All Other Departments",
        purpose: "Reminds the patient of a specific upcoming clinic or procedure date set by the nurse in their care plan. Gives enough lead time to travel and prepare.",
        trigger: "Nurse has set a visit date/time in the care plan · fires 4 hours before · applies to: Antenatal/Maternity, Paediatrics, Surgery/Post-Op, Dental, Eye, Fertility/IVF, ENT",
        channel: "email",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Appointment-Driven",
    timingBadge: "Checked every 15 min",
    description: "Polls appointments frequently so reminders and no-show detection are never more than 15 minutes late.",
    accentBorder: "border-l-amber-500",
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/5",
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    items: [
      { id: "appointment_reminder", name: "Appointment Reminder", purpose: "Reduces no-shows by keeping the patient aware of their upcoming visit at two critical moments — far out and close in.", trigger: "Patient has an upcoming appointment — sends at 24 hours before, then again at 2 hours before", channel: "both", icon: Calendar },
      { id: "no_show_followup", name: "No-Show Follow-Up", purpose: "Recovers potentially lost patients by reaching out compassionately after a missed appointment.", trigger: "No check-in recorded within 1 hour of the scheduled appointment time — sends 1 hour after the missed slot", channel: "email", icon: MessageSquare },
    ],
  },
  {
    label: "Scheduled Daily",
    timingBadge: "Fixed daily times",
    description: "Run by the scheduler at exact times each day. Each job checks only the patients whose conditions are met that day.",
    accentBorder: "border-l-primary",
    accentText: "text-primary",
    accentBg: "bg-primary/5",
    badgeBg: "bg-primary/10 text-primary border-primary/25",
    items: [
      { id: "post_treatment_checkin", name: "Post-Treatment Check-Ins", purpose: "Shows the patient the clinic still cares about their recovery after they leave, reducing anxiety and increasing loyalty.", trigger: "Patient is in Post-Treatment stage — sends on Day 1, Day 4, and Day 7 after treatment ends. Checked daily at 7 AM.", channel: "email", icon: HeartPulse },
      { id: "birthday_email", name: "Birthday Greeting", purpose: "Deepens the patient relationship with a personal touch that most clinics never bother with.", trigger: "Patient's date of birth matches today's date — checked daily at 7 AM", channel: "email", icon: Gift },
      { id: "feedback_email", name: "Post-Visit Feedback Request", purpose: "Captures patient satisfaction data while the visit is fresh, covering the previous day's completed appointments.", trigger: "Patient had a completed appointment yesterday — checked daily at 12 PM", channel: "email", icon: Star },
      { id: "post_care_email", name: "Dormant Re-Engagement", purpose: "Gently reminds long-inactive patients the clinic exists and invites them back before they are lost.", trigger: "Patient has been dormant for 30+ days — checked daily at 6 PM", channel: "email", icon: Users },
    ],
  },
  {
    label: "Manual",
    timingBadge: "Staff-triggered",
    description: "Sent only when a staff member or admin deliberately triggers them — never automatic.",
    accentBorder: "border-l-zinc-500",
    accentText: "text-zinc-400",
    accentBg: "bg-zinc-500/5",
    badgeBg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
    items: [
      { id: "queue_long_wait_apology", name: "Long Wait Apology", purpose: "Preserves patient goodwill during unusually long waits by proactively acknowledging the delay.", trigger: "Staff manually taps 'Send Apology' on the queue screen during a long wait", channel: "sms/whatsapp", icon: Clock },
      { id: "wellness_newsletter", name: "Wellness Newsletter", purpose: "Keeps the clinic top-of-mind for all active patients between visits with relevant health tips.", trigger: "Admin manually sends from the Wellness Newsletter screen — content is AI-generated per hospital", channel: "email", icon: Newspaper },
    ],
  },
];

const CHANNEL_STYLE: Record<string, string> = {
  "email": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "sms/whatsapp": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "both": "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const totalCount = AUTOMATION_GROUPS.reduce((acc, g) => acc + g.items.length, 0);

function AutomationsSection() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionHeader icon={Zap} title="All Automations" subtitle={`${totalCount} automations across ${AUTOMATION_GROUPS.length} categories`} />
      <div className="space-y-5">
        {AUTOMATION_GROUPS.map(group => (
          <div key={group.label}>
            {/* Group header */}
            <div className={`flex items-center gap-3 px-4 py-2.5 border-l-2 mb-2 ${group.accentBorder} ${group.accentBg}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase tracking-widest ${group.accentText}`}>{group.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border uppercase tracking-wider ${group.badgeBg}`}>{group.timingBadge}</span>
                  <span className="text-[10px] text-muted-foreground/30 font-mono">{group.items.length} automation{group.items.length !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">{group.description}</p>
              </div>
            </div>
            {/* Automation cards */}
            <div className="space-y-1.5 pl-3">
              {group.items.map(a => (
                <div key={a.id} className="border border-border bg-background/40 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <a.icon className="w-3 h-3 text-muted-foreground/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-bold text-foreground">{a.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border uppercase tracking-wider ${CHANNEL_STYLE[a.channel]}`}>
                          {a.channel}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground/60 leading-relaxed mb-1.5">{a.purpose}</p>
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Trigger · </span>
                        <span className="text-[11px] text-muted-foreground/50">{a.trigger}</span>
                      </div>
                      {a.note && (
                        <p className="text-[10px] text-amber-400/60 mt-1.5 border-t border-border/60 pt-1.5">↳ {a.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
      <div className="mb-6">
        <p className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-2">Configuration</p>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Platform Settings</h1>
        <p className="text-[11px] text-muted-foreground/40 mt-1 tracking-wide">
          Connected services · scheduler · pipeline stages · automations reference
        </p>
      </div>
      <div className="space-y-5">
        <ServicesSection />
        <SchedulerSection />
        <PipelineSection />
        <AutomationsSection />
      </div>
    </Layout>
  );
}
