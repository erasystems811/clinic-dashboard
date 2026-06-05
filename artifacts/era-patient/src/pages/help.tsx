import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import { ChevronDown, ChevronRight, Mail, MessageSquare, CheckCircle2, Lightbulb, AlertTriangle, Zap } from "lucide-react";

/* ── tiny building blocks ──────────────────────────────────────────────────── */

const STEP_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const color = STEP_COLORS[(n - 1) % STEP_COLORS.length];
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-8 h-8 rounded-full ${color} text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-md mt-0.5`}>
        {n}
      </div>
      <p className="text-sm leading-relaxed pt-1.5">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-500/10 border-l-4 border-blue-400 rounded-r-xl p-3.5">
      <Lightbulb className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
      <p className="text-sm text-blue-200 leading-relaxed">{children}</p>
    </div>
  );
}

function AutoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-xl p-3.5">
      <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
      <div className="text-sm text-emerald-200 leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

function Remember({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-500/10 border-l-4 border-amber-400 rounded-r-xl p-3.5">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-200 leading-relaxed">{children}</p>
    </div>
  );
}

function EmailPreview({ from, subject, body }: { from: string; subject: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 text-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/40 space-y-0.5">
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">From:</span> {from}</p>
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Subject:</span> {subject}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
      </div>
    </div>
  );
}

function SmsPreview({ body }: { body: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-xs bg-emerald-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 leading-relaxed">
        {body}
      </div>
    </div>
  );
}

const SECTION_COLORS = [
  "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  "from-rose-500/20 to-rose-500/5 border-rose-500/30",
  "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30",
  "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  "from-teal-500/20 to-teal-500/5 border-teal-500/30",
  "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
  "from-pink-500/20 to-pink-500/5 border-pink-500/30",
];

function Section({
  emoji, title, defaultOpen = false, children, ci = 0,
}: {
  emoji: string; title: string; defaultOpen?: boolean; children: React.ReactNode; ci?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const gradient = SECTION_COLORS[ci % SECTION_COLORS.length];
  return (
    <div className={`rounded-2xl border bg-gradient-to-b ${gradient} overflow-hidden shadow-sm`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:brightness-110 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <span className="font-bold text-base">{title}</span>
        </div>
        {open
          ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4 bg-background/60">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── shared automated messages section (used by all roles) ─────────────────── */

function AutoMessagesSection({ hospitalName = "Your Clinic" }: { hospitalName?: string }) {
  return (
    <Section emoji="📱" title="What the System Sends to Patients Automatically" ci={10}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The system sends messages to patients <strong className="text-foreground">on its own</strong> — you don't need to do anything extra.
        This is very important: if the system already sends a message, <strong className="text-foreground">you don't need to call or text the patient yourself</strong>.
        Here is every message the system sends and exactly when it sends it.
      </p>

      <div className="space-y-6">

        {/* Care plan */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <p className="font-semibold text-sm">When a care plan is created</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            The patient gets <strong className="text-foreground">an SMS right away</strong> and <strong className="text-foreground">an email 20 minutes later</strong>. The 20-minute wait is on purpose — so the nurse has time to fix any mistakes before the email goes out.
          </p>
          <div className="pl-6 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">What the SMS looks like:</p>
            <SmsPreview body={`Hi Ada, your care plan at ${hospitalName} has started. Please follow your daily schedule. Call us if you have any questions.`} />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-2">What the email looks like:</p>
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`Your care plan has started — ${hospitalName}`}
              body={`Hi Ada,\n\nYour care plan with us begins today. Please follow the schedule below carefully.\n\nIf you have any questions, don't hesitate to reach out.\n\nWarm regards,\n${hospitalName} Team`}
            />
          </div>
          <div className="pl-6">
            <Remember>You do NOT need to call the patient to tell them their plan started. The system already did it.</Remember>
          </div>
        </div>

        {/* Appointment confirmation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <p className="font-semibold text-sm">When an appointment is booked</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            The patient gets a <strong className="text-foreground">confirmation email immediately</strong> after you book it.
          </p>
          <div className="pl-6">
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`Appointment Confirmed — ${hospitalName}`}
              body={`Hi Ada,\n\nYour appointment at ${hospitalName} has been confirmed for Monday, 9 June at 10:00 AM.\n\nPlease arrive a few minutes early.\n\nWarm regards,\n${hospitalName} Team`}
            />
          </div>
        </div>

        {/* Appointment reminders */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <p className="font-semibold text-sm">Before an appointment — reminders</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            The system automatically sends <strong className="text-foreground">two reminders</strong> — one the day before and one 2 hours before. You don't need to remind patients yourself.
          </p>
          <div className="pl-6 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">24 hours before:</p>
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`Appointment reminder — ${hospitalName}`}
              body={`Hi Ada, your appointment at ${hospitalName} is tomorrow, Monday 9 June at 10:00 AM. Please call us if you need to reschedule.`}
            />
            <p className="text-xs text-muted-foreground font-medium">2 hours before:</p>
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`Appointment reminder — ${hospitalName}`}
              body={`Hi Ada, your appointment at ${hospitalName} is in 2 hours at 10:00 AM. Please call us immediately if you need to reschedule.`}
            />
          </div>
          <div className="pl-6">
            <Remember>Do NOT call patients to remind them about appointments. The system already sends two reminders.</Remember>
          </div>
        </div>

        {/* Post treatment */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🏥</span>
            <p className="font-semibold text-sm">After treatment — check-in emails</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            When a patient moves to <strong className="text-foreground">Post Treatment</strong> stage, the system automatically checks on them 3 times over 7 days. No one needs to do this manually.
          </p>
          <div className="pl-6 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="rounded-lg bg-muted/50 border border-border p-2.5">
                <p className="text-lg">1️⃣</p>
                <p className="font-semibold mt-1">Day 1</p>
                <p className="text-muted-foreground">"How are you resting?"</p>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-2.5">
                <p className="text-lg">4️⃣</p>
                <p className="font-semibold mt-1">Day 4</p>
                <p className="text-muted-foreground">"How are you feeling?"</p>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-2.5">
                <p className="text-lg">7️⃣</p>
                <p className="font-semibold mt-1">Day 7</p>
                <p className="text-muted-foreground">"One week check-in"</p>
              </div>
            </div>
          </div>
          <div className="pl-6">
            <Remember>These emails go out on their own. Do not add a follow-up call task to check on post-treatment patients — the system already does it.</Remember>
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⭐</span>
            <p className="font-semibold text-sm">After a visit — feedback request</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            The system sends a feedback email automatically after each visit. The patient clicks a link to rate their experience.
          </p>
          <div className="pl-6">
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`How was your visit? — ${hospitalName}`}
              body={`Thank you for visiting us. We'd love to hear how it went.\n\n[Click here to share your feedback]\n\nYour input helps us serve you better.\n\nWarm regards,\n${hospitalName} Team`}
            />
          </div>
        </div>

        {/* Dormant/post-care */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">💭</span>
            <p className="font-semibold text-sm">When a patient has been quiet for a while</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            If a patient has been <strong className="text-foreground">Dormant</strong> for 30 days, the system sends a friendly "thinking of you" email to invite them back.
          </p>
          <div className="pl-6">
            <EmailPreview
              from={`${hospitalName} <noreply@erasystems.io>`}
              subject={`Thinking of you — ${hospitalName}`}
              body={`Hi Ada,\n\nIt's been a while — we just wanted to check in and see how you're doing. Whenever you're ready for your next visit, we're here.\n\nWarm regards,\n${hospitalName} Team`}
            />
          </div>
        </div>

        {/* Birthday */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎂</span>
            <p className="font-semibold text-sm">On a patient's birthday</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            Every year, the system sends a birthday email automatically. You don't need to do anything.
          </p>
        </div>

        {/* Wellness */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">💌</span>
            <p className="font-semibold text-sm">Weekly wellness newsletter</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            If wellness newsletter is turned on, a health tip email goes out every week. You can also send one manually from the Wellness Newsletter page.
          </p>
        </div>

      </div>

      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
        <p className="font-semibold text-sm">Quick summary — things the system handles so you don't have to:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-muted-foreground">
          {[
            "✅ Care plan notification (SMS + email)",
            "✅ Appointment confirmation email",
            "✅ 24-hour appointment reminder",
            "✅ 2-hour appointment reminder",
            "✅ Post-treatment Day 1, 4, 7 check-ins",
            "✅ Feedback request after visits",
            "✅ Re-engagement after 30 days dormant",
            "✅ Birthday emails every year",
            "✅ Weekly wellness newsletter",
          ].map(item => <p key={item}>{item}</p>)}
        </div>
      </div>
    </Section>
  );
}

/* ── admin content ──────────────────────────────────────────────────────────── */

function AdminHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="🏠" title="Your Dashboard — What All the Numbers Mean" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">When you log in, the first thing you see is your dashboard. Here's what every number means:</p>
        <div className="space-y-3">
          {[
            { label: "Total Patients", desc: "How many patients are registered in the system in total." },
            { label: "New This Month", desc: "How many new patients you added this month." },
            { label: "Appointments Today", desc: "How many appointments are scheduled for today." },
            { label: "Patients in Queue", desc: "How many patients are currently checked in and waiting." },
            { label: "Average Wait Time", desc: "How long patients are usually waiting before they're seen." },
            { label: "Patient Satisfaction", desc: "The average star rating from patients who filled your feedback form." },
            { label: "Pipeline Breakdown", desc: "A bar showing how many patients are in each stage (Booked, In Care, etc.)." },
          ].map(item => (
            <div key={item.label} className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm"><strong>{item.label}:</strong> {item.desc}</p>
            </div>
          ))}
        </div>
        <Tip>The dashboard refreshes itself every 30 seconds. You don't need to reload the page.</Tip>
      </Section>

      <Section emoji="👤" title="Adding a New Patient" ci={1}>
        <p className="text-sm text-muted-foreground">Use this whenever a brand new patient comes to your clinic for the first time.</p>
        <div className="space-y-3">
          <Step n={1}>Click the big <strong>New Patient</strong> button in the top-left of the sidebar.</Step>
          <Step n={2}>Fill in the patient's details. <strong>Patient ID</strong>, <strong>First Name</strong>, <strong>Last Name</strong>, <strong>Email</strong>, and <strong>Phone</strong> are required. Everything else is optional but helpful.</Step>
          <Step n={3}>For the phone number — type it with the country code. For Nigeria, start with <strong>234</strong> (not 0). For example: <strong>2348012345678</strong>. The system will format it automatically.</Step>
          <Step n={4}>Click <strong>Save Patient</strong>. That's it — the patient is now in your system.</Step>
        </div>
        <Tip>If the patient already exists (duplicate Patient ID), the system will warn you and skip them.</Tip>
        <Remember>The patient doesn't automatically receive any message when you add them. Messages only go out when you create a care plan or book an appointment.</Remember>
      </Section>

      <Section emoji="📋" title="Care Plans — What They Are and How to Use Them" ci={2}>
        <p className="text-sm text-muted-foreground">A care plan is the nurse's treatment schedule for a patient. When a nurse creates one, the system tells the patient automatically.</p>
        <div className="space-y-3">
          <Step n={1}>Go to a patient's page (click their name from the Patients list).</Step>
          <Step n={2}>Scroll down to the <strong>Care Plans</strong> section.</Step>
          <Step n={3}>The nurse creates the care plan from their own login (Medication View). You can see the plan here once it's created.</Step>
          <Step n={4}>To end a care plan early (if treatment is done), click <strong>End Early</strong> next to the active plan.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">When a care plan is created, the system automatically:</p>
          <p>📱 Sends the patient an SMS right away</p>
          <p>📧 Sends the patient a full email 20 minutes later</p>
          <p className="text-emerald-300/70 text-xs mt-1">You don't need to contact the patient — the system handles it.</p>
        </AutoBox>
      </Section>

      <Section emoji="📅" title="Appointments — Booking and Managing" ci={3}>
        <p className="text-sm text-muted-foreground">Use appointments to schedule patient visits in advance.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Appointments</strong> in the sidebar.</Step>
          <Step n={2}>You'll see a weekly calendar. Each row is a time slot (every 30 minutes from 8am to 6pm).</Step>
          <Step n={3}>Click any empty slot to book an appointment. Type the patient's name to search for them, then confirm the time and click <strong>Book</strong>.</Step>
          <Step n={4}>To mark the result — click on a booked appointment and choose: <strong>Completed</strong>, <strong>No Show</strong>, or <strong>Reschedule</strong>.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">When you book an appointment, the system automatically sends:</p>
          <p>📧 A confirmation email to the patient — right away</p>
          <p>📧 A reminder email — 24 hours before the appointment</p>
          <p>📧 A reminder email — 2 hours before the appointment</p>
          <p className="text-emerald-300/70 text-xs mt-1">Do not call patients to confirm appointments. They already receive 3 emails.</p>
        </AutoBox>
        <Tip>If two appointments overlap at the same time, the system will warn you before saving.</Tip>
      </Section>

      <Section emoji="📞" title="Follow-up Tasks — Your Call & Message Queue" ci={4}>
        <p className="text-sm text-muted-foreground">Call Tasks is your to-do list for following up with patients who need extra attention.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Call Tasks</strong> in the sidebar.</Step>
          <Step n={2}>You'll see a list of patients that need a follow-up. Each task shows the patient's name, phone number, and why they need a follow-up.</Step>
          <Step n={3}>Click on a task to expand it. You can call the patient, write a message, or use the <strong>AI Draft</strong> button to auto-write a message for you.</Step>
          <Step n={4}>Once done, click <strong>Mark Complete</strong> to remove the task from your list.</Step>
        </div>
        <Remember>Some tasks are created by the system automatically (e.g., if a patient misses a treatment). Others are created manually by staff. Either way, they all appear in the same list.</Remember>
        <Tip>The AI Draft button writes a professional follow-up message for you — you can edit it before sending.</Tip>
      </Section>

      <Section emoji="🔄" title="The Pipeline — Seeing Where Every Patient Is" ci={5}>
        <p className="text-sm text-muted-foreground">The Pipeline shows all your patients in columns based on where they are in their journey.</p>
        <div className="space-y-2">
          {[
            { stage: "Booked", desc: "Patient has an appointment but hasn't visited yet." },
            { stage: "Queued", desc: "Patient has arrived and is checked in, waiting to be seen." },
            { stage: "In Care", desc: "Patient is currently receiving treatment." },
            { stage: "Post Treatment", desc: "Treatment is done. The system is following up with them automatically." },
            { stage: "Active", desc: "Regular patient who visits often." },
            { stage: "Post Care", desc: "Treatment finished. Patient may still visit occasionally." },
            { stage: "Dormant", desc: "Patient hasn't visited in a while." },
          ].map(s => (
            <div key={s.stage} className="flex gap-3 items-start">
              <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 shrink-0 mt-0.5">{s.stage}</span>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <Tip>Click any patient card in the pipeline to open their full record.</Tip>
      </Section>

      <Section emoji="⭐" title="Patient Feedback — Collecting Ratings" ci={6}>
        <p className="text-sm text-muted-foreground">The feedback section shows you star ratings and comments from patients about their experience.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Feedback</strong> in the sidebar. You'll see your overall rating and a list of responses.</Step>
          <Step n={2}>To customize the questions patients are asked, click the <strong>Editor</strong> tab and drag questions to reorder them.</Step>
          <Step n={3}>To share your feedback form link with patients directly, click <strong>Copy Link</strong>.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">The system automatically sends:</p>
          <p>📧 A feedback request email after every visit</p>
          <p className="text-emerald-300/70 text-xs mt-1">You don't need to ask patients to fill the form — the email does it for you.</p>
        </AutoBox>
      </Section>

      <Section emoji="💌" title="Wellness Newsletter — Sending Health Tips" ci={7}>
        <p className="text-sm text-muted-foreground">Use this to send health education emails to all your active patients.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Wellness Newsletter</strong> in the sidebar.</Step>
          <Step n={2}>Click <strong>New Newsletter</strong>. Choose a health topic (like "hydration" or "sleep") or type your own.</Step>
          <Step n={3}>Click <strong>Generate</strong> and the system will write the newsletter for you using AI. You can edit it before sending.</Step>
          <Step n={4}>Click <strong>Send</strong> when you're happy with it.</Step>
        </div>
        <Tip>Only patients who have an email address AND are in Active, In Care, Post Treatment, or Dormant stages will receive it.</Tip>
      </Section>

      <Section emoji="📥" title="Importing Many Patients at Once" ci={8}>
        <p className="text-sm text-muted-foreground">If you already have a list of patients in Excel or a spreadsheet, you can upload them all at once instead of adding them one by one.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Import Patients</strong> in the sidebar.</Step>
          <Step n={2}>Drag your file onto the upload area, or click to browse. The file must be a <strong>.csv</strong> or <strong>.xlsx</strong> (Excel) file.</Step>
          <Step n={3}>The system will read your columns and try to match them (First Name, Last Name, Email, Phone, etc.). Check the matches look correct.</Step>
          <Step n={4}>Click <strong>Import</strong>. The system tells you how many were added and how many were skipped (duplicates are skipped automatically).</Step>
        </div>
        <Remember>Your file must have at least a First Name and Last Name column or the import won't work.</Remember>
        <Tip>If a patient's ID already exists in the system, they will be skipped — not duplicated.</Tip>
      </Section>

      <Section emoji="👥" title="Managing Your Staff" ci={9}>
        <p className="text-sm text-muted-foreground">From Settings, you can add nurses and receptionists, reset their passwords, and see who is active.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Settings</strong> at the bottom of the sidebar.</Step>
          <Step n={2}>Scroll to the <strong>Staff Accounts</strong> section. You'll see all current staff.</Step>
          <Step n={3}>To add a new staff member — click <strong>Add Staff</strong>, fill in their name, username, password, and role (nurse or receptionist), then save.</Step>
          <Step n={4}>To reset a password — click the staff member's row and change the password field, then save.</Step>
          <Step n={5}>To deactivate someone (e.g. they left) — toggle the <strong>Active</strong> switch to off. They won't be able to log in anymore.</Step>
        </div>
        <Remember>Staff usernames cannot be changed after creation. Choose them carefully.</Remember>
      </Section>

      <AutoMessagesSection hospitalName={hospitalName} />
    </div>
  );
}

/* ── receptionist content ───────────────────────────────────────────────────── */

function ReceptionistHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="🪑" title="Queue Management — Your Most Important Job" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">The queue is where you manage patients who have arrived at the clinic today.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Queue Management</strong> in the sidebar. You'll see everyone checked in today.</Step>
          <Step n={2}>When a patient arrives, search for their name and click <strong>Check In</strong>. They'll appear in the queue.</Step>
          <Step n={3}>When a patient is done and leaving, click <strong>Dequeue</strong> next to their name. This removes them from today's list.</Step>
          <Step n={4}>If you need to update a patient's phone number or details, click the <strong>edit</strong> icon next to their name.</Step>
        </div>
        <Tip>The queue is only for today. It resets each morning. Past visits are saved in the patient's history.</Tip>
        <Remember>Do not leave patients in the queue after they've left — always Dequeue them when they go.</Remember>
      </Section>

      <Section emoji="➕" title="Adding a New Patient" ci={1}>
        <p className="text-sm text-muted-foreground">When a brand new patient comes who isn't in the system yet.</p>
        <div className="space-y-3">
          <Step n={1}>Click the <strong>New Patient</strong> button in the top of the sidebar.</Step>
          <Step n={2}>Fill in their details. <strong>Patient ID</strong>, <strong>First Name</strong>, <strong>Last Name</strong>, <strong>Email</strong>, and <strong>Phone</strong> are required.</Step>
          <Step n={3}>For phone numbers — use the country code. For Nigeria, start with <strong>234</strong> (not 0). Example: <strong>2348012345678</strong>.</Step>
          <Step n={4}>Click <strong>Save Patient</strong>.</Step>
        </div>
        <Tip>After saving, the patient is registered. You can then check them into the queue.</Tip>
      </Section>

      <Section emoji="📅" title="Booking Appointments" ci={2}>
        <p className="text-sm text-muted-foreground">Use this to schedule a patient's visit in advance.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Appointments</strong> in the sidebar.</Step>
          <Step n={2}>You'll see a calendar. Click any empty time slot to book one.</Step>
          <Step n={3}>Search for the patient by name, confirm the date and time, and click <strong>Book</strong>.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">After booking, the system automatically sends the patient:</p>
          <p>📧 A confirmation email immediately</p>
          <p>📧 A reminder email 24 hours before</p>
          <p>📧 A reminder email 2 hours before</p>
          <p className="text-emerald-300/70 text-xs mt-1">You don't need to call them to confirm.</p>
        </AutoBox>
      </Section>

      <Section emoji="📞" title="Follow-up Tasks — Calls You Need to Make" ci={3}>
        <p className="text-sm text-muted-foreground">Call Tasks is your list of patients who need a follow-up call or message.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Call Tasks</strong> in the sidebar.</Step>
          <Step n={2}>Expand any task to see the patient's phone number and reason for the call.</Step>
          <Step n={3}>Make the call or send the message, then click <strong>Mark Complete</strong>.</Step>
        </div>
        <Tip>Use the <strong>AI Draft</strong> button to auto-write a follow-up message. Edit it before sending.</Tip>
      </Section>

      <AutoMessagesSection hospitalName={hospitalName} />
    </div>
  );
}

/* ── nurse content ──────────────────────────────────────────────────────────── */

function NurseHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="💊" title="Your Medication View — Reading Care Plans" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">Your Medication View shows you all the active care plans — what each patient is supposed to receive and when.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Medication View</strong> in the sidebar.</Step>
          <Step n={2}>You'll see a list of patients grouped by department (General, Antenatal, Paediatrics, Surgery, etc.).</Step>
          <Step n={3}>Click on any patient to expand their care plan. You'll see the full schedule — dates, times, and what treatment they need.</Step>
          <Step n={4}>Once you've reviewed a patient's plan, click it to mark it as read.</Step>
        </div>
        <Tip>You only see <strong>active</strong> care plans here. Plans that have ended are not shown.</Tip>
        <AutoBox>
          <p className="font-semibold">When you create a care plan:</p>
          <p>📱 The patient receives an SMS immediately</p>
          <p>📧 The patient receives a full email 20 minutes later</p>
          <p className="text-emerald-300/70 text-xs mt-1">The 20-minute wait gives you time to fix any mistakes before the email goes out.</p>
        </AutoBox>
      </Section>

      <Section emoji="📅" title="Reading the Schedule — What Each Department Looks Like" ci={1}>
        <p className="text-sm text-muted-foreground">Different departments have different care plan formats. Here's what each one shows:</p>
        <div className="space-y-2">
          {[
            { dept: "General Outpatient", desc: "Shows treatment type (medication only, clinic visit, or both), timing, and how long it runs." },
            { dept: "Antenatal", desc: "Shows the current pregnancy week and a schedule of upcoming ANC visits with dates and times." },
            { dept: "Paediatrics", desc: "Shows the child's age and their vaccination schedule." },
            { dept: "Surgery", desc: "Shows the procedure date and time, plus the in-care recovery schedule." },
            { dept: "Dental / Eye / ENT / Fertility", desc: "Shows the specific appointments and procedures scheduled for that patient." },
          ].map(d => (
            <div key={d.dept} className="flex gap-3 items-start">
              <span className="text-xs font-bold bg-muted border border-border rounded px-2 py-0.5 shrink-0 mt-0.5">{d.dept}</span>
              <p className="text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="📞" title="Follow-up Tasks — Calls You Need to Make" ci={2}>
        <p className="text-sm text-muted-foreground">Call Tasks is your list of patients who need a follow-up.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Call Tasks</strong> in the sidebar.</Step>
          <Step n={2}>Expand any task to see the patient's phone number and the reason they need a call.</Step>
          <Step n={3}>Make the call or send the message, then click <strong>Mark Complete</strong>.</Step>
        </div>
        <Tip>Use the <strong>AI Draft</strong> button to auto-write a follow-up message. You can edit it before sending.</Tip>
      </Section>

      <AutoMessagesSection hospitalName={hospitalName} />
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────────────────── */

const ROLE_GREETINGS: Record<string, { title: string; subtitle: string; emoji: string }> = {
  admin:        { emoji: "👋", title: "Welcome, Admin!",        subtitle: "This is your full guide to running the system. Everything is here — step by step, in plain English." },
  receptionist: { emoji: "👋", title: "Welcome, Receptionist!", subtitle: "This guide covers everything you do — from checking patients in to booking appointments." },
  nurse:        { emoji: "👋", title: "Welcome, Nurse!",        subtitle: "This guide covers your Medication View, care plans, and follow-up tasks." },
};

export default function HelpPage() {
  const { user, hospital } = useAuth();
  const role = user?.role ?? "admin";
  const hospitalName = hospital?.name ?? "Your Clinic";
  const greeting = ROLE_GREETINGS[role] ?? ROLE_GREETINGS.admin;

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-5 space-y-1.5">
          <p className="text-3xl">{greeting.emoji}</p>
          <h1 className="text-2xl font-bold">{greeting.title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{greeting.subtitle}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 capitalize">
              {role}
            </span>
            <span className="text-xs text-muted-foreground">at {hospitalName}</span>
          </div>
        </div>

        {/* Role content */}
        {role === "admin"        && <AdminHelp        hospitalName={hospitalName} />}
        {role === "receptionist" && <ReceptionistHelp hospitalName={hospitalName} />}
        {role === "nurse"        && <NurseHelp        hospitalName={hospitalName} />}

        <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start">
          <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Still confused? We're here to help.</p>
            <p className="text-sm text-muted-foreground">Use the <strong>Support</strong> button (bottom right of your screen) to send us a message. We'll reply quickly.</p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
