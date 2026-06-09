import { useState } from "react";
import Layout from "@/components/layout";
import { ChevronDown, ChevronUp } from "lucide-react";

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Tab({ label, emoji, active, onClick }: { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
        active
          ? "bg-primary text-primary-foreground shadow"
          : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
      }`}
    >
      <span className="text-base">{emoji}</span>
      {label}
    </button>
  );
}

function SectionHead({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8 first:mt-0">
      <span className="text-2xl">{emoji}</span>
      <div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Acc({ title, emoji, children, open: defaultOpen = false }: { title: string; emoji?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/3 transition"
      >
        <span className="text-sm font-semibold text-foreground flex items-center gap-2.5">
          {emoji && <span className="text-base">{emoji}</span>}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-border text-sm text-muted-foreground space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoBox({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const s = {
    info:    { box: "border-blue-500/30 bg-blue-500/8 text-blue-300",    icon: "ℹ️" },
    warning: { box: "border-amber-500/30 bg-amber-500/8 text-amber-300", icon: "⚠️" },
    tip:     { box: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300", icon: "✅" },
  }[type];
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex gap-3 my-3 ${s.box}`}>
      <span className="shrink-0 text-base">{s.icon}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border my-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-white/2 transition">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-foreground/80 align-top text-xs leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3">
      <pre className="bg-black/40 border border-border rounded-xl px-4 py-3 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{children}</h3>;
}

// ── TAB 1: The Platform ───────────────────────────────────────────────────────

const STAGE_CARDS = [
  {
    name: "💊 In Care",
    color: "border-blue-500/30 bg-blue-500/8",
    nameColor: "text-blue-400",
    desc: "Patient has an active care plan. Primary treatment stage.",
    enters: "Nurse saves a care plan from the nurse station",
    automations: "SMS notification instantly → AI care plan email 20 min later → hourly in-care reminders timed to treatment type",
    exits: "Manual stage update or when all care plan dates pass",
  },
  {
    name: "🔄 Post Treatment",
    color: "border-violet-500/30 bg-violet-500/8",
    nameColor: "text-violet-400",
    desc: "Treatment ended. Era sends 3 warm check-in emails to support recovery.",
    enters: "Daily 7 AM — care plan end date has passed",
    automations: "AI check-in email: Day 1 → Day 4 → Day 7 after treatment end",
    exits: "Automatically moves to Active after the Day 7 email",
  },
  {
    name: "✅ Active",
    color: "border-emerald-500/30 bg-emerald-500/8",
    nameColor: "text-emerald-400",
    desc: "Engaged patient — no active treatment. Stays connected via automation.",
    enters: "After Post-Treatment completes, or manually set",
    automations: "Birthday emails, wellness newsletter, appointment reminders, feedback requests. 30-day wellness nudge if no check-in for 30+ days.",
    exits: "Moves to Dormant after configured days without a queue check-in (default 30)",
  },
  {
    name: "😴 Dormant",
    color: "border-zinc-500/30 bg-zinc-500/8",
    nameColor: "text-zinc-400",
    desc: "Patient gone quiet. Nothing targets dormant patients — the wellness nudge fires while still Active, before this stage.",
    enters: "Daily 7 AM — Active patient with no check-in for the hospital's dormant threshold",
    automations: "None. The 30-day wellness nudge (from Active stage) fires before this point.",
    exits: "Returns to Active when manually moved or re-books",
  },
];

function PlatformTab() {
  return (
    <div className="space-y-1">

      <SectionHead emoji="🏥" title="What Is Era Systems?" />
      <P>Era Systems is a clinic management SaaS you own and built. Many hospitals subscribe and each sees only their own data. You are the platform owner — you control everything from this super admin dashboard.</P>
      <P>Era does three things: manages patients, queues, appointments, and care plans; automatically sends emails and messages to patients on the hospital's behalf; gives you full visibility over all hospitals.</P>

      <SectionHead emoji="🚪" title="The Three Portals" />
      <DataTable
        headers={["Portal", "Used by", "Purpose"]}
        rows={[
          ["Hospital App (era-patient)", "Hospital staff", "Daily-use app — patients, queue, appointments, care plans, settings"],
          ["Super Admin (era-super-admin)", "You only", "This dashboard — manage hospitals, health check, support inbox, announcements"],
          ["Feedback Form", "Patients", "Public link each hospital shares — patients rate their visits"],
        ]}
      />

      <SectionHead emoji="👥" title="Hospital Roles" />
      <DataTable
        headers={["Role", "What they can do"]}
        rows={[
          ["Admin", "Full access — patients, pipeline, settings, imports, analytics, care plans, announcements"],
          ["Receptionist", "Queue management, appointments, call tasks, new patient form"],
          ["Nurse", "Medication View — active care plans with daily schedules, flag patients for follow-up"],
        ]}
      />
      <InfoBox type="info"><strong>Nurse note:</strong> Nurses do NOT see Call Tasks. That feature is for receptionists only.</InfoBox>

      <SectionHead emoji="🔄" title="Patient Pipeline Stages" sub="How patients flow through Era and what fires at each stage" />
      <div className="grid sm:grid-cols-2 gap-3 my-3">
        {STAGE_CARDS.map(s => (
          <div key={s.name} className={`rounded-xl border p-4 ${s.color}`}>
            <p className={`text-sm font-bold mb-1.5 ${s.nameColor}`}>{s.name}</p>
            <p className="text-xs text-foreground/80 leading-relaxed mb-3">{s.desc}</p>
            <div className="space-y-1.5 text-[11px]">
              <div><span className="font-bold text-muted-foreground/50 uppercase tracking-wide">Enters: </span><span className="text-muted-foreground">{s.enters}</span></div>
              <div><span className="font-bold text-muted-foreground/50 uppercase tracking-wide">Auto: </span><span className="text-muted-foreground">{s.automations}</span></div>
              <div><span className="font-bold text-muted-foreground/50 uppercase tracking-wide">Exits: </span><span className="text-muted-foreground">{s.exits}</span></div>
            </div>
          </div>
        ))}
      </div>
      <InfoBox type="info"><strong>"In Care" is a badge, not a real stage.</strong> It overlays a patient's actual stage when they have an active care plan. A patient can be Active AND show "In Care" at the same time.</InfoBox>

      <SectionHead emoji="⚡" title="All Features" sub="Click any to expand" />

      <Acc emoji="🪑" title="Queue Management" open>
        <P>Patients arrive → receptionist adds to queue. SMS/WhatsApp fires at each step: checked in (with position), next in line, your turn. If wait exceeds 45 minutes, an apology message goes out automatically. No-shows detected and handled automatically.</P>
      </Acc>

      <Acc emoji="📅" title="Appointments">
        <P>Admins and receptionists book appointments. Confirmation email fires immediately. Reminder at 24h before and 2h before. If patient doesn't show within 1 hour of the appointment time, a follow-up email goes out automatically.</P>
      </Acc>

      <Acc emoji="💊" title="Care Plans">
        <P>Nurses create care plans — medications at specific times, clinic visits on specific dates. SMS notification fires immediately. Full AI-written care plan email fires 20 minutes later (giving the nurse time to make edits). Daily reminder emails then fire at the right time slots based on department and treatment type. If a family member is listed on the plan, they also get reminder emails.</P>
      </Acc>

      <Acc emoji="🏥" title="Post-Treatment Check-Ins">
        <P>After treatment ends, three AI-written check-in emails fire automatically:</P>
        <ul className="list-disc pl-5 space-y-1 mt-1">
          <Li>Day 1 — "We hope you are resting well today"</Li>
          <Li>Day 4 — "Checking in — how are you feeling?"</Li>
          <Li>Day 7 — "One week on — we are proud of your progress"</Li>
        </ul>
      </Acc>

      <Acc emoji="💌" title="30-Day Active Patient Wellness Nudge">
        <P>If an Active patient hasn't had a queue check-in for 30+ days, the system sends a warm "we're thinking of you" email. It fires every 30 days until the patient visits again or moves to Dormant. This is SEPARATE from dormancy — it fires while the patient is still Active.</P>
        <InfoBox type="tip">Only works when <strong>Wellness Newsletter</strong> module is enabled for the hospital.</InfoBox>
      </Acc>

      <Acc emoji="⭐" title="Feedback Collection">
        <P>The day after a completed appointment, a feedback email is sent. Patient clicks a link and rates their experience. Hospital sees results in their Feedback section. You see all results in Analytics.</P>
      </Acc>

      <Acc emoji="📰" title="Wellness Newsletter">
        <P>Admin chooses a health topic and the system generates a full newsletter using Claude (AI). Goes to all patients with an email address across Active, Post Treatment, In Care, and Dormant stages. Admins can also add YouTube and TikTok video links.</P>
      </Acc>

      <Acc emoji="📞" title="Call Tasks">
        <P>When a nurse flags a patient from Medication View (e.g. "missed medication"), a Call Task is created. AI drafts a message tailored to the reason. Receptionist reviews, edits if needed, and sends it as an email. They can also write a manual email instead.</P>
        <InfoBox type="warning">Call Tasks are <strong>receptionist-only</strong> — do not appear in nurse or admin sidebar.</InfoBox>
      </Acc>

      <Acc emoji="📥" title="Patient Import (CSV/Excel)">
        <P>Admins upload a CSV or Excel file to import patients in bulk. System maps columns to fields. Duplicates matched by Hospital Patient ID / MRN only — email is never used for duplicate detection (a parent can share an email across several children). All fields optional, but at minimum you need a first name or full name column.</P>
      </Acc>

      <SectionHead emoji="🚫" title="Hospital Suspension Behaviour" />
      <P>When you suspend a hospital, logged-in staff are kicked within 30 seconds. New logins are blocked. Automations still process internally but nothing is delivered to patients. When you re-activate, there is no backlog — the system continues from today.</P>
      <InfoBox type="tip">Intentional design — suspending does not create a flood of old messages on reactivation.</InfoBox>

    </div>
  );
}

// ── TAB 2: Automations ────────────────────────────────────────────────────────

const SERVICES = [
  { name: "Resend", emoji: "📧", border: "border-blue-500/20", bg: "bg-blue-500/8", label: "text-blue-400", purpose: "Email delivery", detail: "All automated patient emails. Free up to 3,000/month, then auto-switches to AWS SES.", env: "RESEND_API_KEY" },
  { name: "AWS SES", emoji: "📧", border: "border-sky-500/20", bg: "bg-sky-500/8", label: "text-sky-400", purpose: "High-volume email", detail: "Auto-used when Resend is near monthly limit. Backup email provider.", env: "AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION" },
  { name: "Termii", emoji: "💬", border: "border-emerald-500/20", bg: "bg-emerald-500/8", label: "text-emerald-400", purpose: "SMS & WhatsApp", detail: "Queue messages, care plan notifications, appointment SMS reminders. ₦7 per SMS charged to hospital wallet.", env: "TERMII_API_KEY" },
  { name: "Anthropic (Claude)", emoji: "🤖", border: "border-orange-500/20", bg: "bg-orange-500/8", label: "text-orange-400", purpose: "All AI generation", detail: "All AI-written messages — care plans, reminders, newsletters, birthdays. Model: claude-haiku-4-5-20251001.", env: "ANTHROPIC_API_KEY" },
  { name: "OpenAI", emoji: "🤖", border: "border-violet-500/20", bg: "bg-violet-500/8", label: "text-violet-400", purpose: "Key held — not active", detail: "Key is validated in health checks but all AI calls currently route through Anthropic. Will switch when routing is toggled.", env: "OPENAI_API_KEY" },
  { name: "Supabase", emoji: "🗄️", border: "border-teal-500/20", bg: "bg-teal-500/8", label: "text-teal-400", purpose: "Database", detail: "All hospital data — patients, care plans, queue, appointments, automations, support tickets, wallet.", env: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" },
  { name: "Sentry", emoji: "🚨", border: "border-red-500/20", bg: "bg-red-500/8", label: "text-red-400", purpose: "Error monitoring", detail: "Captures all API server exceptions in real time. API server only — frontend errors are not tracked.", env: "SENTRY_DSN" },
];

const SCHEDULE_ROWS = [
  { time: "Every 5 min",   jobs: "Care plan email delay — picks up plans saved 20+ min ago, sends full AI-written care plan email" },
  { time: "Every 15 min",  jobs: "Appointment reminders (24h + 2h before) · No-show detection · No-show follow-up email after 1h · Long queue wait apology (45+ min)" },
  { time: "Every hour",    jobs: "In-care reminders: Medication-only fires AT medication time · Come to Hospital fires 3h before · Combination fires 2h before · Specialist dept visit reminders fire 4h before" },
  { time: "Daily 7 AM",    jobs: "Post-treatment stage transitions · Post-treatment check-in emails (Day 1, Day 4, Day 7) · Dormant detection · Birthday emails" },
  { time: "Daily 9 AM",    jobs: "Termii credit balance alert — emails you if balance is low" },
  { time: "Daily 12 PM",   jobs: "Feedback request emails (for previous day's completed visits)" },
  { time: "Daily 6 PM",    jobs: "30-day wellness nudge — Active patients with no queue check-in for 30+ days · 30-day per-patient cooldown" },
  { time: "Daily 11 PM",   jobs: "Clear no-show flags from today's schedule" },
  { time: "Every 6 hours", jobs: "Subscription expiry check — flags hospitals near expiry, deactivates expired ones" },
];

interface AutomationItem {
  name: string; purpose: string; trigger: string; channel: "email" | "sms/whatsapp" | "both"; note?: string;
}
interface AutomationGroup {
  label: string; emoji: string; timing: string; desc: string; accent: string; badge: string; items: AutomationItem[];
}

const AUTOMATION_GROUPS: AutomationGroup[] = [
  {
    label: "Immediate", emoji: "⚡", timing: "Fires instantly",
    desc: "No scheduler. Sends the exact moment a staff action or system event occurs.",
    accent: "border-l-emerald-500 bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    items: [
      { name: "Queue Check-In Confirmation", channel: "sms/whatsapp", trigger: "Receptionist checks patient into queue", purpose: "Tells patient they are registered and shows their queue position" },
      { name: "Next In Line Alert", channel: "sms/whatsapp", trigger: "Patient moves to position 2 in queue", purpose: "Warns patient their turn is coming so they are ready" },
      { name: "It's Your Turn", channel: "sms/whatsapp", trigger: "Receptionist taps 'Call Patient' on queue screen", purpose: "Calls patient in the moment the doctor is ready" },
      { name: "Long Wait Apology", channel: "sms/whatsapp", trigger: "Patient waiting 45+ minutes (checked every 15 min, sent at most once/hour)", purpose: "Proactively apologises — reduces walk-outs during busy periods" },
      { name: "Care Plan Ready (SMS)", channel: "sms/whatsapp", trigger: "Nurse saves a care plan", purpose: "Instantly tells patient their plan is saved and to check email for full details" },
      { name: "Appointment Booking Confirmation", channel: "email", trigger: "Receptionist or admin books an appointment", purpose: "Gives patient written confirmation the moment it is booked" },
    ],
  },
  {
    label: "20-Minute Delay", emoji: "⏱️", timing: "20 minutes after nurse saves",
    desc: "Waits so the nurse can make last-minute edits before the full care plan email reaches the patient.",
    accent: "border-l-sky-500 bg-sky-500/5",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    items: [
      { name: "Care Plan Summary Email (AI — Claude)", channel: "email", trigger: "Scheduler picks up plans saved 20+ min ago (checks every 5 min)", purpose: "Full AI-written care plan in plain language — medications, visit schedule, instructions" },
    ],
  },
  {
    label: "In-Care Reminders", emoji: "💊", timing: "Checked every hour — exact time set by treatment type",
    desc: "One hourly job handles all active care plan patients. When it fires depends on department and treatment type.",
    accent: "border-l-violet-500 bg-violet-500/5",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/25",
    items: [
      { name: "General Outpatient — Medication Only", channel: "email", trigger: "Fires AT the nurse-set medication time (e.g. 8:00 AM → sends at 8:00 AM)", purpose: "Reminds patient to take medication at the exact moment it is due" },
      { name: "General Outpatient — Come to Hospital", channel: "email", trigger: "Fires 3 hours before the nurse-set visit slot", purpose: "Gives patient time to prepare and travel to the clinic" },
      { name: "General Outpatient — Combination (Medication + Visit)", channel: "email", trigger: "Fires 2 hours before visit — one message covers both medication reminder and visit reminder", purpose: "Patient is never double-messaged. One combined reminder handles both." },
      { name: "Specialist Dept — Care Visit Reminder", channel: "email", trigger: "Fires 4h before nurse-set visit (Antenatal, Surgery, Dental, Eye, Fertility, ENT, Paediatrics)", purpose: "Reminds patient of specific upcoming procedure/appointment in their care plan" },
    ],
  },
  {
    label: "Appointment-Driven", emoji: "📅", timing: "Checked every 15 minutes",
    desc: "Polls appointments so reminders and no-show detection are never more than 15 minutes late.",
    accent: "border-l-amber-500 bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    items: [
      { name: "Appointment Reminder", channel: "both", trigger: "24 hours before appointment · then again 2 hours before", purpose: "Two timely reminders to reduce no-shows" },
      { name: "No-Show Follow-Up", channel: "email", trigger: "No check-in within 1 hour of appointment time", purpose: "Compassionate outreach so patient feels cared for and is encouraged to rebook" },
    ],
  },
  {
    label: "Scheduled Daily", emoji: "🗓️", timing: "Fixed times each day",
    desc: "Run at exact times. Each job only sends to patients whose conditions are met on that specific day.",
    accent: "border-l-primary bg-primary/5",
    badge: "bg-primary/10 text-primary border-primary/25",
    items: [
      { name: "Post-Treatment Check-In Sequence", channel: "email", trigger: "Post-Treatment stage patient — Day 1, Day 4, Day 7 after treatment end · checked at 7 AM", purpose: "Shows patient the clinic still cares during recovery. Each email is AI-written." },
      { name: "Birthday Greeting", channel: "email", trigger: "Patient's birthday matches today · checked at 7 AM", purpose: "Warm personal birthday message — small gesture that builds real loyalty" },
      { name: "Post-Visit Feedback Request", channel: "email", trigger: "Patient had a completed appointment yesterday · checked at 12 PM", purpose: "Asks for feedback while experience is still fresh" },
      { name: "30-Day Active Patient Wellness Nudge", channel: "email", trigger: "Active patient with no queue check-in for 30+ days · checked at 6 PM · 30-day per-patient cooldown", purpose: "Gently nudges inactive Active patients to come back. Repeats every 30 days until they visit or go dormant." },
    ],
  },
  {
    label: "Manual / Staff-Triggered", emoji: "✍️", timing: "Only when staff takes action",
    desc: "These never send automatically. A staff member must deliberately trigger them.",
    accent: "border-l-zinc-500 bg-zinc-500/5",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
    items: [
      { name: "Call Task — AI Draft (Staff-Reviewed)", channel: "email", trigger: "Staff generates draft from call tasks screen, reviews it, then confirms send", purpose: "AI-written 'IMPORTANT' email to flagged patient — staff always reviews before it goes out", note: "Max 5 AI-drafted call task emails per hospital per day" },
      { name: "Call Task — Manual Email (Staff-Written)", channel: "email", trigger: "Staff chooses 'Write Manually', types message, taps Send", purpose: "Fully staff-written 'IMPORTANT' email — for when staff prefers to write their own message" },
      { name: "Wellness Newsletter", channel: "email", trigger: "Admin sends manually from the Wellness Newsletter screen", purpose: "AI-generated health education email to all patients with an email address" },
    ],
  },
];

const CHANNEL_BADGE: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "sms/whatsapp": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  both: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function AutomationsTab() {
  return (
    <div className="space-y-1">

      <SectionHead emoji="🔌" title="Connected Services" sub="Every external service Era depends on and what it powers" />
      <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
        {SERVICES.map(s => (
          <div key={s.name} className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{s.emoji}</span>
              <span className="text-sm font-bold text-foreground">{s.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto border ${s.border} ${s.bg} ${s.label}`}>{s.purpose}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.detail}</p>
            <p className="text-[10px] font-mono text-muted-foreground/40 border-t border-white/5 pt-1.5">{s.env}</p>
          </div>
        ))}
      </div>

      <SectionHead emoji="⏰" title="Scheduler Timetable" sub="Exact run times — enable with ENABLE_SCHEDULER=true in Railway" />
      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        {SCHEDULE_ROWS.map((row, i) => (
          <div key={row.time} className={`flex gap-4 px-4 py-3 ${i < SCHEDULE_ROWS.length - 1 ? "border-b border-border/40" : ""}`}>
            <div className="w-28 shrink-0">
              <span className="text-xs font-bold text-primary font-mono">{row.time}</span>
            </div>
            <span className="text-xs text-muted-foreground leading-relaxed">{row.jobs}</span>
          </div>
        ))}
      </div>
      <InfoBox type="warning">If automations stop working completely, check <strong>ENABLE_SCHEDULER=true</strong> in Railway Variables first.</InfoBox>

      <SectionHead
        emoji="🤖"
        title="All Automations"
        sub={`${AUTOMATION_GROUPS.reduce((a, g) => a + g.items.length, 0)} automations across ${AUTOMATION_GROUPS.length} groups`}
      />
      <div className="space-y-4">
        {AUTOMATION_GROUPS.map(group => (
          <div key={group.label}>
            <div className={`flex items-center gap-3 px-4 py-2.5 border-l-2 rounded-r-xl mb-2 ${group.accent}`}>
              <span className="text-xl">{group.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground">{group.label}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${group.badge}`}>{group.timing}</span>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{group.desc}</p>
              </div>
            </div>
            <div className="space-y-1.5 pl-4">
              {group.items.map(a => (
                <div key={a.name} className="border border-border bg-card/40 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13px] font-bold text-foreground">{a.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase tracking-wider ${CHANNEL_BADGE[a.channel]}`}>{a.channel}</span>
                  </div>
                  <p className="text-[11px] text-foreground/60 leading-relaxed mb-1">{a.purpose}</p>
                  <p className="text-[10px] text-muted-foreground/50">
                    <span className="font-bold text-muted-foreground/40 uppercase tracking-widest">Trigger · </span>{a.trigger}
                  </p>
                  {a.note && <p className="text-[10px] text-amber-400/70 mt-1.5 border-t border-border/40 pt-1.5">↳ {a.note}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB 3: Operations ─────────────────────────────────────────────────────────

const ENV_VARS: string[][] = [
  ["SUPABASE_URL", "Database address", "Supabase → Project Settings → API"],
  ["SUPABASE_SERVICE_KEY", "Database secret key", "Supabase → Project Settings → API"],
  ["SUPER_ADMIN_USERNAME", "Your login username", "You set this"],
  ["SUPER_ADMIN_PASSWORD", "Your login password", "You set this — make it strong"],
  ["SUPER_ADMIN_RECOVERY_KEY", "Backup key if locked out", "Keep this safe offline"],
  ["SUPER_ADMIN_ALERT_EMAIL", "Email for system alerts (low balance, etc.)", "Your email address"],
  ["PLATFORM_FROM_EMAIL", "The 'from' address on all automated emails", "Must match verified Resend/SES address"],
  ["RESEND_API_KEY", "Resend account key", "resend.com → API Keys"],
  ["EMAIL_PROVIDER", "Force ses or resend (leave blank for auto)", "Leave blank normally"],
  ["AWS_ACCESS_KEY_ID", "AWS key for SES email", "AWS Console → IAM"],
  ["AWS_SECRET_ACCESS_KEY", "AWS secret for SES", "AWS Console → IAM"],
  ["AWS_REGION", "Your AWS region (e.g. eu-west-1)", "Must match where SES is configured"],
  ["TERMII_API_KEY", "Termii key for SMS/WhatsApp", "termii.com → API"],
  ["TERMII_SENDER_ID", "Default Termii sender ID", "Your approved Termii sender ID"],
  ["AFRICAS_TALKING_API_KEY", "Africa's Talking key (optional fallback)", "africastalking.com"],
  ["AFRICAS_TALKING_USERNAME", "Africa's Talking username (optional)", "africastalking.com"],
  ["ENABLE_SCHEDULER", "Must be true for automated jobs to run", "Set to: true"],
  ["SUPPORT_EMAIL", "Your email for support ticket notifications", "Your email address"],
  ["OPENAI_API_KEY", "OpenAI key (held — all AI currently routes to Anthropic)", "platform.openai.com"],
  ["ANTHROPIC_API_KEY", "Claude key for all AI messages", "console.anthropic.com"],
  ["APP_BASE_URL", "Public URL of the hospital app", "Your era-patient Railway URL"],
];

const DB_TABLES: string[][] = [
  ["hospitals", "All registered hospitals — name, username, hashed password, hospital_code, active, subscription, wallet_balance_kobo"],
  ["hospital_settings", "Per-hospital config — sender name, tone, language, Termii sender ID, notification channel, dormant threshold"],
  ["hospital_modules", "Feature flags per hospital — appointments, feedback, wellness newsletter, WhatsApp, messages"],
  ["hospital_staff", "Individual named staff accounts (nurse/receptionist) — username, hashed password, role, active"],
  ["patients", "All patients — first name, last name, email, phone, DOB, stage, department, hospital_id, MRN"],
  ["care_plans", "Treatment plans — patient, department, treatment type, medications, visit schedule, start/end dates, beneficiary info"],
  ["appointments", "Appointments — patient, date/time, status, no-show flag"],
  ["queue_entries", "Queue records — patient, check-in time, call time, status, wait duration"],
  ["activity", "Activity log entries — patient actions, stage transitions, staff actions with actor name"],
  ["automation_log", "Every automation ever attempted — type, status (sent/failed/skipped/queued), error message, channel, patient_id"],
  ["support_tickets", "Support conversations — message, AI reply, escalation status, hospital_id"],
  ["feedback_submissions", "Patient feedback — ratings (overall, wait, staff, quality), comment, appointment reference"],
  ["hospital_announcements", "Platform announcements — title, message, type (info/update/warning), published flag, expiry"],
  ["hospital_announcement_reads", "Tracks which hospitals dismissed which announcements (dedup table)"],
  ["platform_deployments", "Deployment log — title, deployed_at — used as context for auto-draft announcements"],
  ["wallet_transactions", "Wallet deduction and top-up history — hospital_id, amount_kobo, type (debit/credit), description, reference"],
];

function OperationsTab() {
  return (
    <div className="space-y-1">

      <SectionHead emoji="🏗️" title="Managing Hospitals" />

      <Acc emoji="✨" title="Creating a New Hospital Account" open>
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click <strong>Hospitals</strong> in the sidebar</Li>
          <Li>Click <strong>New Hospital</strong> (top right)</Li>
          <Li>Fill in: Hospital Name, Username (short lowercase e.g. <em>lagosclinic</em> — <strong>cannot be changed later</strong>), Subscription Status</Li>
          <Li>Click Create — a random password is generated automatically</Li>
          <Li>Open the hospital's detail page → get all credentials + their feedback form link</Li>
          <Li>Send the admin their username + password, and staff credentials for receptionist and nurse</Li>
        </ol>
      </Acc>

      <Acc emoji="🔑" title="Resetting a Hospital's Password">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click hospital name → open detail page</Li>
          <Li>Click <strong>Regenerate Password</strong></Li>
          <Li>New password shown once — send it to the hospital admin</Li>
        </ol>
      </Acc>

      <Acc emoji="⏸️" title="Suspending / Re-activating a Hospital">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Open hospital detail page</Li>
          <Li>Toggle <strong>Active</strong> off to suspend, or change subscription status to <em>inactive</em></Li>
          <Li>To re-activate, toggle Active back on</Li>
        </ol>
        <InfoBox type="tip">Automations run silently during suspension — no catch-up flood on reactivation.</InfoBox>
      </Acc>

      <Acc emoji="🔧" title="Enabling/Disabling Features for a Hospital">
        <P>Hospital detail page → Modules section → toggle:</P>
        <ul className="list-disc pl-5 space-y-1">
          <Li><strong>Appointments</strong> — show/hide appointments section</Li>
          <Li><strong>Feedback</strong> — show/hide feedback section</Li>
          <Li><strong>Wellness Newsletter</strong> — must be ON for the 30-day wellness nudge to work</Li>
          <Li><strong>WhatsApp</strong> — enable/disable WhatsApp messaging</Li>
          <Li><strong>Messages</strong> — enable/disable messages tab</Li>
        </ul>
      </Acc>

      <SectionHead emoji="🆘" title="Support Guide" sub="Every common problem a hospital will report and exactly how to fix it" />

      <Acc emoji="🔐" title="Hospital can't log in">
        <H3>1 — Right URL?</H3>
        <P>Make sure they are going to the correct era-patient URL. They should bookmark it.</P>
        <H3>2 — Wrong password?</H3>
        <P>Super admin → their hospital → detail page → check or regenerate password → send it to them.</P>
        <H3>3 — Are they suspended?</H3>
        <P>Super admin → their hospital → check Active status. Re-activate if needed.</P>
        <H3>4 — Staff login issue?</H3>
        <P>Super admin → hospital detail → Staff Credentials → confirm or regenerate username/password.</P>
      </Acc>

      <Acc emoji="📧" title="Emails not reaching patients">
        <H3>1 — Check automation_log in Supabase</H3>
        <P>Filter status = failed → read the error_message column.</P>
        <H3>2 — Check platform health</H3>
        <P>Analytics → Email shows red → check RESEND_API_KEY and PLATFORM_FROM_EMAIL in Railway.</P>
        <H3>3 — Patient email correct?</H3>
        <P>Typo is the most common cause. Ask hospital to check the patient's profile.</P>
        <H3>4 — Spam folder</H3>
        <P>Ask patient to check spam/junk folder.</P>
      </Acc>

      <Acc emoji="📱" title="SMS/WhatsApp not sending">
        <H3>1 — Check Termii balance</H3>
        <P>Analytics → SMS/WhatsApp health shows Termii credit balance. Top up at termii.com if low. You also get a daily 9am alert if balance drops below ₦50.</P>
        <H3>2 — Phone number format</H3>
        <P>Termii requires international format. Nigerian numbers must start with 234, not 0.</P>
        <ul className="list-disc pl-5 space-y-1">
          <Li>Wrong: 08012345678</Li>
          <Li>Correct: 2348012345678</Li>
        </ul>
        <H3>3 — Hospital notification channel</H3>
        <P>Hospital detail → Settings → check Notification Channel (whatsapp or sms) and Termii Sender ID.</P>
      </Acc>

      <Acc emoji="🤖" title="Automated emails stopped completely">
        <H3>1 — Is the scheduler running?</H3>
        <P>Railway → api-server → Logs → search "scheduler". Should see "[scheduler] running". If "Scheduler disabled" → add ENABLE_SCHEDULER=true in Variables.</P>
        <H3>2 — Hospital settings created?</H3>
        <P>Hospital admin must go to Settings in their app and press Save at least once. Without it, automations can't look up their config.</P>
        <H3>3 — Subscription active?</H3>
        <P>Expired subscriptions are auto-suspended. Check their status.</P>
      </Acc>

      <Acc emoji="💊" title="Care plan emails not sending">
        <P>Care plan emails are delayed 20 minutes by design. If over 30 minutes and nothing arrived:</P>
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>automation_log → filter automation_type = care_plan_email → check status and error_message</Li>
          <Li>Most common cause: patient has no email address</Li>
        </ol>
        <InfoBox type="info">SMS fires immediately. Email fires 20 minutes later. This gap is normal.</InfoBox>
      </Acc>

      <Acc emoji="🔗" title="Hospital needs their feedback form link">
        <P>Super admin → hospital detail page → find Feedback Slug. Full URL:</P>
        <CodeBlock>[era-patient URL]/feedback/h/[their-slug]</CodeBlock>
      </Acc>

      <SectionHead emoji="⚠️" title="Error Reference" />
      <DataTable
        headers={["Error message", "Plain meaning", "Fix"]}
        rows={[
          ["RESEND_API_KEY is not set", "Email sending is broken", "Add key in Railway Variables"],
          ["TERMII_API_KEY not set", "SMS/WhatsApp is broken", "Add key in Railway Variables"],
          ["AI not configured", "ANTHROPIC_API_KEY missing", "Add key in Railway Variables"],
          ["Unauthorized", "Invalid or missing login token", "User logs out and back in"],
          ["Hospital not found", "Hospital ID doesn't exist", "Stale login — hospital logs out and back in"],
          ["Insufficient balance", "Termii is out of credit", "Top up at termii.com"],
          ["Invalid address", "Patient's email is not valid", "Hospital corrects email on patient's profile"],
          ["Hospital is suspended", "Account is inactive", "Re-activate in super admin"],
          ["Subscription expired", "Subscription lapsed", "Renew their status in super admin"],
          ["Scheduler disabled", "Automated jobs are off", "Set ENABLE_SCHEDULER=true in Railway"],
        ]}
      />

      <SectionHead emoji="🔑" title="Environment Variables" sub="All Railway variables — Railway → api-server → Variables tab" />
      <DataTable headers={["Variable", "What it does", "Where to get it"]} rows={ENV_VARS} />
      <InfoBox type="warning">After changing any variable, Railway restarts the server within 30 seconds automatically.</InfoBox>

      <SectionHead emoji="🚂" title="Railway Services" />
      <DataTable
        headers={["Service", "What it is"]}
        rows={[
          ["api-server", "The backend engine — all logic, scheduler, emails, SMS, API routes"],
          ["era-patient", "Hospital staff app — what hospitals log into every day"],
          ["era-super-admin", "This dashboard — what you use"],
        ]}
      />
      <Acc emoji="📋" title="Reading Logs">
        <P>Railway → api-server → Logs tab. Real-time view of everything.</P>
        <ul className="list-disc pl-5 space-y-1.5">
          <Li>Search <strong>[scheduler]</strong> — automation activity</Li>
          <Li>Search <strong>[email]</strong> — email activity</Li>
          <Li>Red lines = errors — copy exact text to diagnose</Li>
          <Li>HTTP 4xx/5xx = a request failed</Li>
        </ul>
        <InfoBox type="tip">If automations aren't running: search "scheduler" in logs. Should see "[scheduler] Scheduler started" on boot. "Scheduler disabled" = set ENABLE_SCHEDULER=true.</InfoBox>
      </Acc>

      <SectionHead emoji="🗄️" title="Database Tables" sub="What lives where in Supabase" />
      <DataTable headers={["Table", "What it contains"]} rows={DB_TABLES} />
      <InfoBox type="info">Every patient, care plan, queue entry, and appointment is tagged with that hospital's unique ID. Hospitals can never see each other's data.</InfoBox>

      <SectionHead emoji="💾" title="Useful SQL Queries" sub="Copy-paste into Supabase SQL Editor" />

      <H3>All failed automations in the last 7 days</H3>
      <CodeBlock>{`SELECT hospital_id, automation_type, error_message, created_at
FROM automation_log
WHERE status = 'failed'
AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;`}</CodeBlock>

      <H3>All escalated support tickets</H3>
      <CodeBlock>{`SELECT * FROM support_tickets WHERE status = 'escalated' ORDER BY created_at DESC;`}</CodeBlock>

      <H3>Find a patient by email</H3>
      <CodeBlock>{`SELECT * FROM patients WHERE email = 'patient@example.com';`}</CodeBlock>

      <H3>All automations for a specific patient</H3>
      <CodeBlock>{`SELECT * FROM automation_log WHERE patient_id = 123 ORDER BY created_at DESC;`}</CodeBlock>

      <H3>Patient count per hospital</H3>
      <CodeBlock>{`SELECT h.name, COUNT(p.id) AS patient_count
FROM hospitals h
LEFT JOIN patients p ON p.hospital_id = h.hospital_code
GROUP BY h.name
ORDER BY patient_count DESC;`}</CodeBlock>

      <H3>SMS wallet balance per hospital</H3>
      <CodeBlock>{`SELECT name, wallet_balance_kobo / 100.0 AS balance_naira
FROM hospitals
ORDER BY balance_naira ASC;`}</CodeBlock>

      <H3>Recent wallet transactions for a hospital</H3>
      <CodeBlock>{`SELECT * FROM wallet_transactions
WHERE hospital_id = 5
ORDER BY created_at DESC
LIMIT 20;`}</CodeBlock>

      <SectionHead emoji="✅" title="Monthly Checklist" />
      <div className="space-y-2">
        {[
          ["💬", "Termii balance", "Log into termii.com and top up if low. Daily 9am alert fires if balance drops below ₦50."],
          ["📧", "Resend email usage", "Check resend.com monthly send count. If near 3,000, system auto-switches to SES — ensure AWS keys are set."],
          ["🤖", "Anthropic/OpenAI usage", "Check API dashboards for unexpected spikes."],
          ["🗄️", "Supabase storage", "Check database size — automation_log grows fastest."],
          ["🏥", "Subscription statuses", "Review hospitals with trial or expiring subscriptions."],
          ["🎫", "Support inbox", "Check Support section for any unread tickets."],
          ["🟢", "Platform health", "Analytics → confirm all services show green."],
        ].map(([emoji, title, desc]) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/40">
            <span className="text-base shrink-0 mt-0.5">{emoji}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [tab, setTab] = useState<"platform" | "automations" | "operations">("platform");

  return (
    <Layout breadcrumb={[{ label: "Docs & Settings" }]}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-[9px] font-bold text-primary/60 uppercase tracking-[0.3em] mb-2">Era Systems</p>
          <h1 className="text-xl font-bold">Docs & Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you need to run, understand, and support the platform.</p>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-card/50 divide-y divide-border">
          <div className="px-4 py-2.5">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.25em]">Quick Links</p>
          </div>
          {[
            { label: "Hospital Pricing Calculator", url: "https://admin.erasystems.com.ng/pricing", desc: "Share with hospitals to generate a quote" },
            { label: "ERA Patient App", url: "https://app.erasystems.com.ng", desc: "Main hospital-facing application" },
          ].map(link => (
            <div key={link.url} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
              </div>
              <a href={link.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition font-mono">
                {link.url}
              </a>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 p-1.5 rounded-2xl bg-muted/20 border border-border mb-8 flex-wrap">
          <Tab label="The Platform" emoji="🌟" active={tab === "platform"} onClick={() => setTab("platform")} />
          <Tab label="Automations" emoji="🤖" active={tab === "automations"} onClick={() => setTab("automations")} />
          <Tab label="Operations" emoji="🛠️" active={tab === "operations"} onClick={() => setTab("operations")} />
        </div>

        <div className="pb-16">
          {tab === "platform" && <PlatformTab />}
          {tab === "automations" && <AutomationsTab />}
          {tab === "operations" && <OperationsTab />}
        </div>
      </div>
    </Layout>
  );
}
