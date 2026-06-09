import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/contexts/auth-context";
import { ChevronDown, ChevronRight, Mail, Lightbulb, AlertTriangle, Zap } from "lucide-react";

/* ── building blocks ──────────────────────────────────────────────────────── */

const STEP_COLORS = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500"];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const color = STEP_COLORS[(n - 1) % STEP_COLORS.length];
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-8 h-8 rounded-full ${color} text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-md mt-0.5`}>{n}</div>
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

function Section({ emoji, title, defaultOpen = false, children, ci = 0 }: {
  emoji: string; title: string; defaultOpen?: boolean; children: React.ReactNode; ci?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const gradient = SECTION_COLORS[ci % SECTION_COLORS.length];
  return (
    <div className={`rounded-2xl border bg-gradient-to-b ${gradient} overflow-hidden shadow-sm`}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:brightness-110 transition">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <span className="font-bold text-base">{title}</span>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4 bg-background/60">{children}</div>}
    </div>
  );
}

/* ── automated messages (shared by all roles) ─────────────────────────────── */

function AutoMessagesSection({ role, modules }: { role: "admin" | "nurse" | "receptionist"; modules: { appointmentsEnabled: boolean; feedbackEnabled: boolean; wellnessNewsletterEnabled?: boolean } }) {
  type Row = { icon: string; trigger: string; what: string; channel: string; example?: string; doNotDo?: string };

  const queueRows: Row[] = [
    { icon: "🪑", trigger: "You add a patient to the queue", what: "Welcomes the patient and tells them their queue position", channel: "SMS", doNotDo: "Do not call to say they are checked in — they already received this message" },
    { icon: "🔔", trigger: "Patient becomes next in line", what: "Tells them to get ready — they will be called shortly", channel: "SMS" },
    { icon: "✅", trigger: "You tick the 'called in' checkbox", what: "Tells the patient it is their turn to come in", channel: "SMS" },
    { icon: "⏳", trigger: "Queue wait is very long (45+ minutes)", what: "Apologises for the long wait and thanks them for their patience", channel: "SMS", doNotDo: "Do not call separately to apologise — this goes out automatically" },
  ];

  const appointmentRows: Row[] = [
    { icon: "📅", trigger: "You book an appointment", what: "Confirms the appointment date and time, asks them to arrive early", channel: "Email — immediately", doNotDo: "Do not call to confirm — they already got this email" },
    { icon: "🔄", trigger: "Appointment is rescheduled", what: "Informs them of the new date and time", channel: "Email" },
    { icon: "⏰", trigger: "24 hours before appointment", what: "Reminds them their appointment is tomorrow", channel: "Email" },
    { icon: "⏰", trigger: "2 hours before appointment", what: "Reminds them their appointment is in 2 hours", channel: "Email", doNotDo: "Do not call to remind — 3 emails are already sent automatically" },
    { icon: "😟", trigger: "Patient does not show up for appointment", what: "Checks in on the patient and invites them to rebook", channel: "Email", doNotDo: "Do not follow up manually — this email goes out automatically" },
  ];

  const carePlanRows: Row[] = [
    { icon: "💊", trigger: "You save a care plan", what: "Tells the patient their plan is set up and to check their email for full details", channel: "SMS — immediately" },
    { icon: "📧", trigger: "You save a care plan (20 minutes later)", what: "Full AI-written explanation of the plan — medications, times, visit dates — in plain language the patient can understand", channel: "Email — 20 min after saving", doNotDo: "Do not call the patient to explain the plan — the email already does this for you" },
  ];

  const inCareRows: Row[] = [
    {
      icon: "💊",
      trigger: "General Outpatient — Medication Only plan (every day, at each medication time)",
      what: "Sent at the exact medication time you set (morning, afternoon, evening, or night). Reminds the patient to take their medication right now.",
      channel: "Email — at each medication time daily",
      example: "Good morning Ada, it is time to take your morning medication as part of your care plan. We are with you every step of the way — keep going, you are doing great.",
    },
    {
      icon: "🏨",
      trigger: "General Outpatient — Come to Hospital plan (each visit day)",
      what: "Sent 3 hours before each hospital visit. Reminds the patient their visit is coming up and to start getting ready.",
      channel: "Email — 3 hours before each visit",
      example: "Good morning Ada, just a reminder that your hospital visit today is in 3 hours at 10:00 AM. Please plan to leave on time and we will be ready for you.",
    },
    {
      icon: "💊🏨",
      trigger: "General Outpatient — Combination plan (medication + hospital visit)",
      what: "One email sent 2 hours before the visit. Covers both: medication reminder AND visit reminder together. Patient is never sent two separate emails.",
      channel: "Email — 2 hours before visit",
      example: "Good afternoon Ada, your afternoon medication is due now. Also, your hospital visit today is in 2 hours at 3:00 PM. Please take your medication and start preparing to come in.",
    },
    {
      icon: "🏥",
      trigger: "Specialist department plan — each scheduled visit date (Antenatal, Surgery, Dental, Eye, Fertility, ENT, Paediatrics)",
      what: "Sent 1 day before each scheduled visit or appointment in the care plan. Reminds the patient what is happening the next day.",
      channel: "Email — 1 day before each scheduled visit",
      example: "Antenatal appointment reminder — Monday 9 June — [Hospital]. Hi Ada, just a reminder that your Antenatal visit is tomorrow. Please make sure you are prepared and arrive a few minutes early.",
      doNotDo: "Do not call patients to remind them of upcoming plan visits — this email goes out automatically the day before",
    },
  ];

  const postTreatmentRows: Row[] = [
    { icon: "🏥", trigger: "Care plan end date passes — Day 1 after treatment ends", what: "Checks in, wishes them a good recovery, says the team is thinking of them", channel: "Email — automatic, no action needed from you" },
    { icon: "🏥", trigger: "Day 4 after treatment ends", what: "Checks in again, encourages them, says the team is rooting for them", channel: "Email — automatic" },
    { icon: "🏥", trigger: "Day 7 after treatment ends", what: "One-week check-in, congratulates their progress", channel: "Email — automatic", doNotDo: "Do not add manual follow-ups — Day 1, 4, and 7 emails are sent automatically when the plan ends" },
  ];

  const adminOnlyRows: Row[] = [
    { icon: "💌", trigger: "Active patient — no queue check-in for 30+ days (wellness re-engagement)", what: "A warm 'thinking of you' email. Repeats every 30 days until they visit again or go dormant. Fires before the patient becomes dormant.", channel: "Email (free) — runs daily at 6 PM", example: "Hi Ada, it has been a little while since we last saw you at City Clinic and we just wanted to check in and see how you are doing. We hope you are feeling well and taking good care of yourself. We are always here when you need us." },
    { icon: "🎂", trigger: "Patient's birthday (every year)", what: "A warm, personalised birthday email written by AI — unique to your clinic's personality", channel: "Email" },
    { icon: "⭐", trigger: "After a patient visit", what: "Asks them to rate their experience and share feedback via a link", channel: "Email" },
    { icon: "💌", trigger: "Admin sends from Wellness Newsletter page", what: "Weekly health education email sent to all active patients", channel: "Email" },
  ];

  const renderRow = (row: Row, i: number) => (
    <div key={i} className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5">{row.icon}</span>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">When:</span> {row.trigger}</p>
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Message:</span> {row.what}</p>
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">How:</span> {row.channel}</p>
          {row.example && (
            <p className="text-xs text-muted-foreground/70 italic border-l-2 border-muted pl-2 mt-1">"{row.example}"</p>
          )}
        </div>
      </div>
      {row.doNotDo && (
        <div className="flex gap-1.5 items-start pl-6">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">{row.doNotDo}</p>
        </div>
      )}
    </div>
  );

  if (role === "receptionist") {
    return (
      <Section emoji="📱" title="Messages Your Actions Trigger" ci={10}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every time you check in a patient or book an appointment, the system automatically contacts them. You do <strong className="text-foreground">not</strong> need to call or message separately.
        </p>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-1">Queue messages</p>
        <div className="space-y-2">{queueRows.map(renderRow)}</div>
        {modules.appointmentsEnabled && <>
          <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Appointment messages</p>
          <div className="space-y-2">{appointmentRows.map(renderRow)}</div>
        </>}
      </Section>
    );
  }

  if (role === "nurse") {
    return (
      <Section emoji="📱" title="Messages Your Care Plans Trigger" ci={10}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every time you save a care plan, the system automatically contacts the patient for the entire duration of the plan. You do <strong className="text-foreground">not</strong> need to call or send anything manually.
        </p>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-1">When you first save the plan</p>
        <div className="space-y-2">{carePlanRows.map(renderRow)}</div>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Every day while the patient is In Care</p>
        <p className="text-xs text-muted-foreground -mt-2 pb-2">These run automatically every day for the whole plan duration. What gets sent depends on the department and treatment type you selected.</p>
        <div className="space-y-2">{inCareRows.map(renderRow)}</div>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">After the plan ends — Post-Treatment check-ins</p>
        <p className="text-xs text-muted-foreground -mt-2 pb-2">When the care plan end date passes, the system sends 3 automatic check-in emails to make sure the patient is recovering well.</p>
        <div className="space-y-2">{postTreatmentRows.map(renderRow)}</div>
      </Section>
    );
  }

  // Admin: full list (filtered by enabled modules)
  const visibleAdminRows = adminOnlyRows.filter(r => {
    if (r.icon === "⭐") return modules.feedbackEnabled;
    if (r.icon === "💌" && r.trigger.includes("Wellness Newsletter")) return modules.wellnessNewsletterEnabled ?? true;
    return true;
  });
  return (
    <Section emoji="📱" title="All Messages the System Sends to Patients Automatically" ci={10}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The system contacts patients <strong className="text-foreground">on its own</strong> after certain actions. No manual calls or messages needed. Here is the full list.
      </p>
      <p className="font-semibold text-sm border-b border-border pb-1.5 pt-1">Queue messages (receptionist-triggered)</p>
      <div className="space-y-2">{queueRows.map(renderRow)}</div>
      {modules.appointmentsEnabled && <>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Appointment messages (receptionist-triggered)</p>
        <div className="space-y-2">{appointmentRows.map(renderRow)}</div>
      </>}
      <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Care plan messages (nurse-triggered)</p>
      <div className="space-y-2">{carePlanRows.map(renderRow)}</div>
      <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Daily in-care reminders — while patient is In Care</p>
      <p className="text-xs text-muted-foreground -mt-2 pb-2">These run every day for the full plan duration. Depends on department and treatment type set by the nurse.</p>
      <div className="space-y-2">{inCareRows.map(renderRow)}</div>
      <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Post-Treatment check-ins (automatic after plan ends)</p>
      <div className="space-y-2">{postTreatmentRows.map(renderRow)}</div>
      {visibleAdminRows.length > 0 && <>
        <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Other automatic messages</p>
        <div className="space-y-2">{visibleAdminRows.map(renderRow)}</div>
      </>}
    </Section>
  );
}

/* ── admin ─────────────────────────────────────────────────────────────────── */

function AdminHelp({ hospitalName, modules }: { hospitalName: string; modules: { appointmentsEnabled: boolean; feedbackEnabled: boolean; wellnessNewsletterEnabled?: boolean } }) {
  return (
    <div className="space-y-3">

      <Section emoji="🏠" title="Your Dashboard" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">The first thing you see when you log in. It shows a live overview of your clinic. Here is what every card means:</p>
        <div className="space-y-3">
          {[
            { label: "Total Patients", desc: 'Total registered patients. The small note below shows how many joined this month — for example "+3 new this month".' },
            modules.appointmentsEnabled ? { label: "Appointments Today", desc: "How many appointments are scheduled for today. Also shows the total count for this week underneath." } : null,
            { label: "Active Patients", desc: "How many patients are currently in the queue or in active care right now." },
            { label: "Avg Wait Time", desc: "The average time patients wait before being seen. The arrow shows if it is going up or down compared to last month." },
            modules.appointmentsEnabled ? { label: "No-show Rate", desc: "The percentage of appointments where the patient did not show up. Lower is better." } : null,
            modules.feedbackEnabled ? { label: "Patient Feedback", desc: "Your average star rating out of 5, based on all submitted feedback responses." } : null,
            (modules.wellnessNewsletterEnabled ?? true) ? { label: "Wellness Newsletter", desc: "The date of the last wellness email you sent to patients." } : null,
            { label: "System Status", desc: 'Shows "Healthy" when everything is working normally.' },
            { label: "Pipeline Breakdown", desc: "A bar chart showing how many patients are in each stage of care." },
          ].filter((x): x is { label: string; desc: string } => Boolean(x)).map(item => (
            <div key={item.label} className="flex gap-3 items-start">
              <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 shrink-0 mt-0.5 whitespace-nowrap">{item.label}</span>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
        <Tip>The dashboard refreshes every 30 seconds. You do not need to reload the page.</Tip>
        <Tip>If Era Systems has sent you a notice, it will appear as a banner at the top of this page. You can dismiss it once read.</Tip>
      </Section>

      <Section emoji="👤" title="Adding a New Patient" ci={1}>
        <p className="text-sm text-muted-foreground">Do this whenever a brand new patient comes to your clinic for the first time.</p>
        <div className="space-y-3">
          <Step n={1}>Click the green <strong>New Patient</strong> button at the top of the sidebar.</Step>
          <Step n={2}>Fill in the <strong>Patient ID</strong>, <strong>First Name</strong>, <strong>Last Name</strong>, <strong>Email</strong>, and <strong>Phone</strong>. These are required. Date of birth, gender, WhatsApp number, and notes are optional but helpful.</Step>
          <Step n={3}>For phone numbers — type with the country code. For Nigeria start with <strong>234</strong> (not 0). Example: <strong>2348012345678</strong>.</Step>
          <Step n={4}>Click <strong>Save Patient</strong>. Done.</Step>
        </div>
        <Remember>Adding a patient does NOT send them any message. Messages only go out when a care plan is created or an appointment is booked.</Remember>
      </Section>

      <Section emoji="📋" title="Care Plans" ci={2}>
        <p className="text-sm text-muted-foreground">A care plan is the treatment schedule the nurse sets up from the Medication View. As admin, you can view and end plans from each patient's record.</p>
        <div className="space-y-3">
          <Step n={1}>Go to the <strong>Patients</strong> page and click on a patient's name to open their record.</Step>
          <Step n={2}>Scroll down to the <strong>Care Plans</strong> section. Active and past plans are listed there.</Step>
          <Step n={3}>If you need to end an active plan early, click <strong>End Early</strong> next to it and confirm.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">When a care plan is created by the nurse, the system automatically sends:</p>
          <p>📱 SMS immediately: <em>"Your care plan at [Hospital] has been set up. Please check your email for full details..."</em></p>
          <p>📧 Email 20 minutes later: full AI-written explanation of the plan</p>
          <p>📧 Daily reminder emails at each medication or visit time for the whole plan duration</p>
        </AutoBox>
      </Section>

      {modules.appointmentsEnabled && <Section emoji="📅" title="Appointments" ci={3}>
        <p className="text-sm text-muted-foreground">Schedule patient visits in advance on a weekly calendar.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Appointments</strong> in the sidebar.</Step>
          <Step n={2}>You see a weekly calendar with 30-minute slots from 8am to 6pm.</Step>
          <Step n={3}>Click any empty slot to book. Search for the patient, add a title, confirm date and time, click <strong>Confirm Booking</strong>.</Step>
          <Step n={4}>To log the outcome — click any existing appointment and mark it <strong>Completed</strong>, <strong>No Show</strong>, or <strong>Rescheduled</strong>.</Step>
          <Step n={5}>Use the arrows at the top to move between weeks.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">After booking, the patient automatically gets:</p>
          <p>📧 Confirmation email immediately</p>
          <p>📧 Reminder email 24 hours before: <em>"This is a friendly reminder that your appointment is tomorrow [date]."</em></p>
          <p>📧 Reminder email 2 hours before: <em>"Just a quick reminder that your appointment is in 2 hours at [time]."</em></p>
          <p>📧 If No Show: <em>"We noticed you were not able to make your appointment today and we just wanted to check in..."</em></p>
        </AutoBox>
      </Section>}

      <Section emoji="🔄" title="The Pipeline" ci={4}>
        <p className="text-sm text-muted-foreground">The Pipeline shows all patients in columns by their current care stage. It is a live read-only view — you cannot take actions from here. It simply shows you where all your patients are at a glance.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Pipeline</strong> in the sidebar.</Step>
          <Step n={2}>Each column is one stage. The count badge shows how many patients are there. Cards show the patient's name, ID, and department.</Step>
          <Step n={3}>To open a patient's full record — go to the <strong>Patients</strong> page and search by name or ID. You cannot open records from the Pipeline directly.</Step>
          <Step n={4}>If a column has more than 200 patients, it shows a number summary. Click <strong>Show all cards</strong> to expand it.</Step>
        </div>
        <Tip>The pipeline updates every 30 seconds. Stages are configured for your hospital — they are not fixed labels.</Tip>
      </Section>

      {modules.feedbackEnabled && <Section emoji="⭐" title="Patient Feedback" ci={5}>
        <p className="text-sm text-muted-foreground">See star ratings and comments left by patients about their experience.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Feedback</strong> in the sidebar.</Step>
          <Step n={2}>The <strong>Dashboard tab</strong> shows your overall rating, star distribution, category scores (wait time, staff friendliness, quality of care), recommend rate, and recent responses.</Step>
          <Step n={3}>The <strong>Editor tab</strong> lets you customise the questions on your feedback form — drag to reorder, toggle required, edit labels.</Step>
          <Step n={4}>Click <strong>Copy Link</strong> to share the feedback form directly with patients.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">After a visit, the system automatically sends:</p>
          <p>📧 <em>"Thank you for visiting [Hospital] yesterday. Please take a moment to share your feedback..."</em></p>
        </AutoBox>
      </Section>}

      {(modules.wellnessNewsletterEnabled ?? true) && <Section emoji="💌" title="Wellness Newsletter" ci={6}>
        <p className="text-sm text-muted-foreground">Send weekly health education emails to your active patients. AI writes the content for you.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Wellness Newsletter</strong> in the sidebar.</Step>
          <Step n={2}>The <strong>Compose tab</strong> — type a topic (e.g. "hydration") or leave blank and let AI pick. Add a YouTube link or TikTok link if you have one. Click <strong>Generate</strong>.</Step>
          <Step n={3}>The AI writes the newsletter. Read it, edit if needed, then click <strong>Send</strong>. Email subject: <em>"Your weekly wellness update — [Hospital]"</em></Step>
          <Step n={4}>The <strong>History tab</strong> shows all past newsletters.</Step>
          <Step n={5}>The <strong>Bulk tab</strong> is for sending to a specific group of patients.</Step>
        </div>
        <Tip>Only patients in Active, In Care, Post Treatment, or Dormant stages with an email address will receive the newsletter.</Tip>
      </Section>}

      <Section emoji="📥" title="Importing Many Patients at Once" ci={7}>
        <p className="text-sm text-muted-foreground">If you have a list of patients in Excel or a spreadsheet, upload them all at once.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Import Patients</strong> in the sidebar.</Step>
          <Step n={2}>Drag your file onto the upload box or click to browse. Supports <strong>.csv</strong>, <strong>.xlsx</strong>, and <strong>.xls</strong>.</Step>
          <Step n={3}>The system reads your column headings and auto-detects common names like "DOB", "Mobile", "MRN". Check the matches look correct and adjust any that are wrong.</Step>
          <Step n={4}>Click <strong>Import</strong>. The system tells you how many were added and how many were skipped.</Step>
        </div>
        <Tip>All fields are optional — just map whatever your EMR exports. If your file has a combined "Name" column instead of separate first/last names, map it to <strong>Full Name (combined)</strong> and it will be split automatically.</Tip>
        <Tip>If you include a <strong>Last Visit Date</strong> column, patients whose last visit is older than your dormant threshold will be imported as Dormant. All others import as Active.</Tip>
        <Remember>Duplicates are checked by Hospital Patient ID / MRN only. The same email can appear on multiple patients — for example a parent with several children. You must map at least a Name or First Name column or the import won't start.</Remember>
      </Section>

      <Section emoji="👥" title="Managing Your Staff" ci={8}>
        <p className="text-sm text-muted-foreground">Add nurses, receptionists, and doctors — each with their own login — from Settings.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Settings</strong> at the very bottom of the sidebar.</Step>
          <Step n={2}><strong>Staff Accounts</strong> — add nurses and receptionists here. Each gets their own username, password, and role. To remove someone, click the trash icon next to their name.</Step>
          <Step n={3}><strong>Doctors</strong> — add doctors here. The system auto-generates a username (e.g. DR.JAMES.OKAFOR) and a temporary password, then emails their login details. You can edit a doctor's name, email, or specialty later using the pencil icon. To remove a doctor, click the trash icon.</Step>
          <Step n={4}><strong>Online Booking Schedule</strong> — set the days and hours patients can self-book online. Add time blocks per day of the week with a slot duration (e.g. every 30 minutes on Mondays 9am–1pm). Your patient booking link is shown at the top of this section — copy and share it.</Step>
          <Step n={5}>The <strong>SMS Wallet</strong> shows your current balance. Top it up here so SMS messages can go out (₦7 per SMS).</Step>
        </div>
        <Remember>Usernames cannot be changed after they are created. Choose carefully. Doctor login uses the Staff Login tab on the login page.</Remember>
      </Section>

      <Section emoji="🩺" title="Doctors — How They Work" ci={9}>
        <p className="text-sm text-muted-foreground">Each doctor gets their own login and private view showing only their assigned patients.</p>
        <div className="space-y-3">
          <Step n={1}>Add doctors in <strong>Settings → Doctors</strong>. They receive their username and password by email automatically.</Step>
          <Step n={2}>When checking a patient into the queue, the receptionist can assign them to a specific doctor. The patient appears in that doctor's queue.</Step>
          <Step n={3}>In the doctor's view — they see their queue, can <strong>Call In</strong> a patient (sends SMS to the patient), and can <strong>Transfer</strong> to another available doctor.</Step>
          <Step n={4}>Doctors can mark themselves <strong>Unavailable</strong> — the receptionist is notified and will stop assigning new patients to them.</Step>
          <Step n={5}>The <strong>Follow-Ups tab</strong> works like the nurse station — search any patient, view their active care plan, and flag them for follow-up. The doctor can handle it themselves (send email or log a call) or send it to the receptionist as a Call Task. From the queue, the clipboard icon next to each patient also opens the same follow-up flow.</Step>
          <Step n={6}>Doctors receive a reminder email 3 hours before each scheduled appointment.</Step>
        </div>
        <Tip>The doctor sees specialty shown in brackets on the receptionist's doctor dropdown — so patients being triaged can be sent to the right specialist.</Tip>
      </Section>

      <Section emoji="🌐" title="Online Self-Booking" ci={10}>
        <p className="text-sm text-muted-foreground">Patients can book their own appointments online without calling the clinic.</p>
        <div className="space-y-3">
          <Step n={1}>First set up time blocks in <strong>Settings → Online Booking Schedule</strong>. Each block defines a recurring weekly window (e.g. Mondays 9am–1pm, every 30 minutes).</Step>
          <Step n={2}>Your booking link is shown in <strong>Settings → Online Booking Schedule</strong> at the top — click <em>Copy</em> to copy it. Share it via WhatsApp, your website, or as a QR code. The link looks like: <strong>https://[your-app]/book/[your-clinic-name]</strong>.</Step>
          <Step n={3}>Patients fill in their name, phone, reason, and pick a slot. They receive a message saying their request is under review.</Step>
          <Step n={4}>The receptionist sees pending bookings on the <strong>Appointments</strong> page under <em>Pending Online Bookings</em>. They confirm, assign a doctor and duration, and the patient receives a confirmation email.</Step>
        </div>
        <Remember>If no time blocks are set up, the booking page will show "No available slots" to patients. Set your schedule in Settings first.</Remember>
      </Section>

      <Section emoji="💳" title="SMS Wallet — What Gets Charged" ci={11}>
        <p className="text-sm text-muted-foreground">Most messages the system sends are <strong className="text-foreground">free emails</strong>. Only a few specific actions send an SMS, and each SMS costs <strong className="text-foreground">₦7</strong> from your wallet. Here is exactly which ones cost money:</p>
        <div className="space-y-2 mt-1">
          {[
            { label: "Appointment reminder SMS", desc: "If you have turned on SMS reminders for appointments — the 24h and 2h reminders go via SMS instead of email. Each one costs ₦7." },
            { label: "Call task message (if SMS is enabled)", desc: "When the receptionist sends a message from a Call Task — if SMS is enabled for your account, it goes via SMS (₦7). Otherwise it sends as a free email." },
            { label: "Flag for Follow-up SMS", desc: "When a patient is flagged for follow-up — if SMS is enabled, the follow-up message goes via SMS. Each one costs ₦7." },
            { label: "Doctor Call-In SMS", desc: "When a doctor clicks 'Call In' for a patient in their queue — the patient receives an SMS notification. Each one costs ₦7." },
            { label: "Bulk SMS", desc: "When you send a bulk SMS from Wellness → Bulk SMS. Each patient message costs ₦7. Sending stops automatically if the wallet runs out." },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-border bg-card/50 px-4 py-3 flex gap-3 items-start">
              <span className="text-base shrink-0">📱</span>
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-sm border-b border-border pb-1.5 mt-2">Everything else is free email — no wallet charge:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground pl-1">
            {["Care plan confirmation email","Daily in-care reminder emails","Appointment confirmation email","Birthday email","Post-treatment Day 1, 4, 7 emails","Dormant re-engagement email","Feedback request email","Queue SMS (these use a separate system — not your wallet)","Wellness newsletter"].map(i => <p key={i}>✅ {i}</p>)}
          </div>
        </div>
        <Tip>To top up your wallet or check your balance, go to <strong>Settings</strong> → <strong>SMS Wallet</strong> at the bottom of the page. If the wallet runs out, SMS messages automatically fall back to email so nothing is missed.</Tip>
      </Section>

      <AutoMessagesSection role="admin" modules={modules} />
    </div>
  );
}

/* ── receptionist ──────────────────────────────────────────────────────────── */

function ReceptionistHelp({ hospitalName, modules }: { hospitalName: string; modules: { appointmentsEnabled: boolean; feedbackEnabled: boolean; wellnessNewsletterEnabled?: boolean } }) {
  return (
    <div className="space-y-3">

      <Section emoji="🪑" title="Queue Management — Your Main Job" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">The Queue is where you manage patients who are at the clinic today. It refreshes every 5 seconds.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Queue Management</strong> in the sidebar. You see two sections: <strong>Current Queue</strong> (patients checked in today) and <strong>Add Patient to Queue</strong> (for new arrivals).</Step>
          <Step n={2}>When a patient arrives — go to <strong>Add Patient to Queue</strong>, type their name or ID (at least 2 characters), and click <strong>Add to Queue</strong>.</Step>
          <Step n={3}>If doctors are set up, you will see a <strong>doctor dropdown</strong> when adding a patient. Assign the patient to the right doctor — the specialty is shown in brackets to help you decide. The patient will appear in that doctor's personal queue.</Step>
          <Step n={4}>When a patient is called in to see the doctor — tick the checkbox next to their name in <strong>Current Queue</strong>. This removes them from the queue.</Step>
          <Step n={5}>To edit a patient's details — click the pencil icon next to their name.</Step>
          <Step n={6}>If the patient is not found in search — click <strong>Register New Patient</strong> to add them first.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">When you add a patient to the queue, the system sends:</p>
          <p>📱 SMS: <em>"Hi [Name], welcome to {hospitalName}. You've been checked in and you're currently number X in the queue. Our team is working as quickly as possible..."</em></p>
          <p className="font-semibold mt-2">When the patient is next in line:</p>
          <p>📱 SMS: <em>"Hi [Name], you are next in line at {hospitalName}. Please be ready — you will be called in shortly."</em></p>
          <p className="font-semibold mt-2">When you tick the checkbox (calling them in):</p>
          <p>📱 SMS: <em>"Hi [Name], it is your turn now at {hospitalName}. Please proceed, we are ready for you."</em></p>
        </AutoBox>
        <Remember>Always tick the checkbox when a patient is called in. Do not leave patients in the queue after they have been seen.</Remember>
      </Section>

      <Section emoji="➕" title="Adding a New Patient" ci={1}>
        <p className="text-sm text-muted-foreground">For brand new patients who are not yet in the system.</p>
        <div className="space-y-3">
          <Step n={1}>Click the green <strong>New Patient</strong> button at the top of the sidebar.</Step>
          <Step n={2}>Fill in <strong>Patient ID</strong>, <strong>First Name</strong>, <strong>Last Name</strong>, <strong>Email</strong>, and <strong>Phone</strong>. These are required.</Step>
          <Step n={3}>For phone numbers — type with country code. Nigeria: start with <strong>234</strong> not 0. Example: <strong>2348012345678</strong>.</Step>
          <Step n={4}>Click <strong>Save Patient</strong>. You can then add them to the queue.</Step>
        </div>
        <Remember>Adding a patient does NOT send them any message. Messages go out when a care plan is created or an appointment is booked.</Remember>
      </Section>

      {modules.appointmentsEnabled && <Section emoji="📅" title="Booking Appointments" ci={2}>
        <p className="text-sm text-muted-foreground">For scheduling a patient's visit in advance — either you book it directly, or you confirm a patient's own online request.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Appointments</strong> in the sidebar.</Step>
          <Step n={2}>You see a weekly calendar. Click any empty slot, search for the patient, assign a doctor and duration, and click <strong>Confirm Booking</strong>.</Step>
          <Step n={3}><strong>Pending Online Bookings</strong> — at the top of the Appointments page you will see any self-bookings submitted by patients online. Click <strong>Confirm</strong> to review, assign a doctor and duration, and send the patient a confirmation email. Or click <strong>Cancel</strong> to decline.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">After booking, the patient automatically receives:</p>
          <p>📧 Confirmation: <em>"Your appointment at {hospitalName} has been confirmed for [date]. Please arrive a few minutes early."</em></p>
          <p>📧 24h reminder: <em>"This is a friendly reminder that your appointment is tomorrow [date]."</em></p>
          <p>📧 2h reminder: <em>"Just a quick reminder that your appointment is in 2 hours at [time]."</em></p>
        </AutoBox>
        <Remember>Do not call patients to confirm or remind them. They receive 3 emails automatically. The assigned doctor also receives a reminder 3 hours before the appointment.</Remember>
      </Section>}

      <Section emoji="📞" title="Call Tasks — Following Up on Flagged Patients" ci={3}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tasks appear here when a nurse flags a patient for follow-up, or when a doctor sends a follow-up to the receptionist. Click <strong className="text-foreground">Call Tasks</strong> in the sidebar.
        </p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Each task card shows the patient's name, phone number, the reason the nurse flagged them, and whether the task is a <strong className="text-foreground">Call</strong> or an <strong className="text-foreground">Email</strong>. Open tasks appear at the top. Completed tasks appear below.
        </p>

        <p className="font-semibold text-sm pt-1">If the task is a Phone Call:</p>
        <div className="space-y-3">
          <Step n={1}>Look at the phone number shown on the card. Call the patient on that number.</Step>
          <Step n={2}>After the call, click <strong>Log Call Outcome</strong> on the card.</Step>
          <Step n={3}>Type what happened — what the patient said, what was agreed, any next steps. Example: <em>"Patient picked up. Said she forgot. Will come in Thursday."</em></Step>
          <Step n={4}>Click <strong>Save &amp; Complete</strong>. The task moves to Completed.</Step>
        </div>

        <p className="font-semibold text-sm pt-2">If the task is an Email:</p>
        <div className="space-y-3">
          <Step n={1}>You will see a message box on the card. Either type your own message, or click the purple <strong>AI Draft</strong> button and the system will write a message for you based on the reason the nurse provided. You can edit the AI draft before sending.</Step>
          <Step n={2}>Read the message carefully. Make sure it sounds right for the patient.</Step>
          <Step n={3}>Click <strong>Send Text</strong>. If your clinic has SMS turned on and the wallet has credit (₦7), it goes as an SMS to the patient's phone. If not, it goes as a free email to their inbox.</Step>
          <Step n={4}>Sending automatically marks the task as completed.</Step>
        </div>

        <div className="space-y-2 mt-2">
          <p className="font-semibold text-sm">Switching between Call and Email:</p>
          <p className="text-xs text-muted-foreground">Each task has a small badge showing the current method (Call or Email). Click it to change — a picker will appear and you can switch to the other option.</p>
        </div>

        <Tip>The AI Draft button shows how many drafts you have left today — e.g. <em>"AI Draft (4/5)"</em>. There is a daily limit on how many AI messages can be generated. If you run out, just write the message yourself.</Tip>
        <Remember>Tasks are created by nurses — you do not create them yourself. Your job is to action them: either call the patient and log what happened, or send them the message.</Remember>
      </Section>

      <AutoMessagesSection role="receptionist" modules={modules} />
    </div>
  );
}

/* ── nurse ─────────────────────────────────────────────────────────────────── */

function NurseHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="💊" title="How to Create a Care Plan — Step by Step" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A care plan is what you set up for a patient after the doctor has seen them. It tells the system what treatment the patient is getting, how long it lasts, and what reminders to send. <strong className="text-foreground">This is one of the most important things you do</strong> — take your time and fill it in carefully.
        </p>

        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">Before you start — read the doctor's notes first</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The doctor will have written what the patient needs — the medication name, the dose, how many times per day, and for how many days. Some doctors write it on paper, some write it on the patient's file, and some may tell you directly. <strong className="text-foreground">Read everything carefully before you touch the screen.</strong> If you are not sure, ask the doctor before you start.
          </p>
          <p className="text-xs text-muted-foreground">What you are looking for: <strong className="text-foreground">the medication name + dose</strong> (e.g. "Amoxicillin 500mg"), <strong className="text-foreground">how often</strong> (e.g. "3 times a day"), <strong className="text-foreground">how many days</strong> (e.g. "7 days"), and <strong className="text-foreground">any special instructions</strong> (e.g. "take after food", "come back on Monday").</p>
        </div>

        <div className="space-y-3 pt-1">
          <Step n={1}>
            Click <strong>Medication View</strong> in the sidebar on the left.
          </Step>
          <Step n={2}>
            You will see a search box at the top. Type the patient's name or ID — at least 2 letters. A list will appear below. Click the patient's name to select them. Their details will open on the right side of the screen.
          </Step>
          <Step n={3}>
            Click the button that says <strong>New Care Plan</strong>. A form will open.
          </Step>
          <Step n={4}>
            <strong>Choose the Department.</strong> This is the type of care the patient is getting. Look at the list below to pick the right one. <em>For most general medicine patients, choose "General Outpatient".</em>
          </Step>
          <Step n={5}>
            <strong>Write the Treatment Summary.</strong> This is where you type what the doctor wrote. Use the doctor's own words — the medication name, the dose, and any instructions. Example: <em>"Amoxicillin 500mg — 3 times daily. Take after meals. Paracetamol 500mg for fever as needed. Return in 7 days if no improvement."</em> The system will use this to write a clear email to the patient explaining their treatment — so the more you write, the better the patient understands their care.
          </Step>
          <Step n={6}>
            <strong>For General Outpatient only — choose the Treatment Type:</strong>
            <div className="mt-2 space-y-1.5 pl-2">
              <div className="flex gap-2 items-start"><span className="text-xs font-bold bg-muted rounded px-1.5 py-0.5 shrink-0 mt-px">Medication Only</span><p className="text-xs text-muted-foreground">The patient takes medicine at home. You will set the times: morning, afternoon, evening, or night. Tick all the times that apply.</p></div>
              <div className="flex gap-2 items-start"><span className="text-xs font-bold bg-muted rounded px-1.5 py-0.5 shrink-0 mt-px">Come to Hospital</span><p className="text-xs text-muted-foreground">The patient comes to the hospital for each treatment. You will add the specific dates and times they should come in.</p></div>
              <div className="flex gap-2 items-start"><span className="text-xs font-bold bg-muted rounded px-1.5 py-0.5 shrink-0 mt-px">Combination</span><p className="text-xs text-muted-foreground">Both — the patient takes medicine at home AND comes to the hospital. You set both the medication times and the visit dates.</p></div>
            </div>
          </Step>
          <Step n={7}>
            <strong>Set the start date and end date.</strong> The start date is today (or whenever the treatment begins). The end date is the last day of the treatment — for example, if it is a 7-day plan and today is the 5th, the end date is the 12th. Count carefully.
          </Step>
          <Step n={8}>
            Look over everything one more time — patient name, department, treatment summary, dates. If anything looks wrong, fix it now.
          </Step>
          <Step n={9}>
            Click <strong>Save</strong>. The plan is now created.
          </Step>
        </div>

        <AutoBox>
          <p className="font-semibold">The moment you click Save, the system automatically sends:</p>
          <p>📱 SMS right away: <em>"Hi [Name], your care plan at {hospitalName} has been set up. Please check your email for full details."</em></p>
          <p className="mt-1">📧 Email 20 minutes later: the system reads your treatment summary and writes a full, easy-to-understand explanation for the patient — what their medication is, when to take it, and what to expect.</p>
          <p className="mt-1">📧 Daily reminder emails: every day for the whole plan — sent at the medication times or before each visit.</p>
        </AutoBox>

        <Remember>The 20-minute delay before the email is on purpose. It gives you time to go back and fix any mistake before the full email goes out. If you realise you made an error — go back, edit the plan, and save again. Do NOT call the patient — the system has already sent them a message.</Remember>

        <div className="space-y-2 mt-1">
          <p className="font-semibold text-sm text-foreground">Other things you can do with care plans:</p>
          {[
            { action: "Edit a plan", how: "Find the patient, click on their active plan, click the pencil (edit) icon, change what you need, and save again." },
            { action: "End a plan early", how: "Open the patient's active plan, scroll to the bottom and click 'End Early', then confirm. Only do this if the doctor says treatment is done." },
            { action: "Use a past plan as a template", how: "Under the patient's 'Past Plans' section, find the old plan and click 'Use as template'. It will pre-fill the form with the same details — you just change the dates and update the summary." },
          ].map(x => (
            <div key={x.action} className="rounded-lg border border-border bg-card/50 px-4 py-2.5 flex gap-3 items-start">
              <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 shrink-0 mt-px whitespace-nowrap">{x.action}</span>
              <p className="text-xs text-muted-foreground">{x.how}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section emoji="📋" title="Care Plan Departments — Which One to Choose" ci={1}>
        <p className="text-sm text-muted-foreground">When you open a new care plan, you must choose the department. Here is what each one means:</p>
        <div className="space-y-2">
          {[
            { dept: "General Outpatient", desc: "For most everyday patients — cough, fever, malaria, infections, general medicine. This is the most common department you will use. Choose Medication Only, Come to Hospital, or Combination depending on the doctor's instruction." },
            { dept: "Antenatal", desc: "For pregnant patients. You will record the pregnancy week and schedule their ANC (antenatal care) clinic visits with dates and times." },
            { dept: "Paediatrics", desc: "For children. You will record vaccinations and age-specific care visits." },
            { dept: "Surgery", desc: "For patients having a procedure or operation. You set the procedure date and the recovery schedule after surgery." },
            { dept: "Dental", desc: "For dental treatments — tooth extraction, cleaning, braces. You set the procedure date and any follow-up appointments." },
            { dept: "Eye", desc: "For eye treatments and checkups. You set the treatment and visit schedule." },
            { dept: "Fertility", desc: "For fertility treatment. You set the treatment schedule and appointments." },
            { dept: "ENT", desc: "For ear, nose and throat conditions. You set the treatment and follow-up dates." },
          ].map(d => (
            <div key={d.dept} className="flex gap-3 items-start">
              <span className="text-xs font-bold bg-muted border border-border rounded px-2 py-0.5 shrink-0 mt-0.5 whitespace-nowrap">{d.dept}</span>
              <p className="text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
        <Tip>If you are not sure which department to choose, use <strong>General Outpatient</strong>. It covers the widest range of conditions.</Tip>
      </Section>

      <Section emoji="🏥" title="Post-Treatment Follow-up — Your Action Is Required for Specialist Patients" ci={2}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          After a care plan ends, the system needs to check in on the patient to make sure they are recovering well. <strong className="text-foreground">How this works depends on the department:</strong>
        </p>

        <div className="space-y-2 mt-1">
          <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-foreground">General Outpatient — automatic, no action needed</p>
            <p className="text-xs text-muted-foreground">When a General Outpatient care plan ends, the system automatically sends check-in emails on Day 1, Day 4, and Day 7. You do not need to do anything for these patients.</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-foreground">All other departments — <span className="text-primary">you must take action within 48 hours</span></p>
            <p className="text-xs text-muted-foreground">For Antenatal, Surgery, Dental, Eye, Fertility, ENT, and Paediatrics — when the plan ends, the patient appears in the <strong className="text-foreground">Post-Treatment Follow-up</strong> section at the bottom of your Medication View page. You have 48 hours to decide what to do.</p>
          </div>
        </div>

        <p className="font-semibold text-sm pt-1">How to set up follow-up for a specialist patient:</p>
        <div className="space-y-3">
          <Step n={1}>Scroll to the bottom of the <strong>Medication View</strong> page. You will see a section called <strong>Post-Treatment Follow-up</strong>. Any specialist patients whose plans ended in the last 48 hours will appear here.</Step>
          <Step n={2}>For each patient, you have two choices:
            <div className="mt-2 space-y-1.5 pl-2">
              <div className="flex gap-2 items-start"><span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0 mt-px">Set up</span><p className="text-xs text-muted-foreground">Click this if the patient needs follow-up emails. You will then choose which days to send them (e.g. Day 7, Day 14). You can add up to 3 follow-up dates. Think about the type of treatment — a surgery patient may need follow-up sooner than an ENT patient.</p></div>
              <div className="flex gap-2 items-start"><span className="text-xs font-bold bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0 mt-px">No follow-up</span><p className="text-xs text-muted-foreground">Click this if the patient does not need any follow-up — for example, the doctor said they are fully discharged. This removes the patient from the queue.</p></div>
            </div>
          </Step>
          <Step n={3}>If you chose <strong>Set up</strong> — the default starts at Day 7. You can change this number to whatever day makes sense. Click <strong>Add follow-up day</strong> to add a second or third date. When you are done, click <strong>Save</strong>. The system will email the patient on those exact days.</Step>
        </div>

        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-4 py-3 mt-1 space-y-1">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">Important — you have 48 hours</p>
          <p className="text-xs text-muted-foreground">The patient only stays in the Post-Treatment Follow-up queue for 48 hours after their plan ends. After that, they disappear from the list and no follow-up will be sent. <strong className="text-foreground">Check this section every day</strong> — especially on days when specialist care plans are likely to end.</p>
        </div>

        <Remember>General Outpatient follow-up is fully automatic — Day 1, 4, 7. All other departments need you to set the follow-up days manually. If you do nothing within 48 hours, no follow-up email will be sent to that patient.</Remember>
      </Section>

      <Section emoji="🚩" title="Flag Patient for Follow-up" ci={3}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you notice a patient who needs attention — missed a dose, not responding to treatment, you are worried about them, or they just need someone to check in — you can flag them from Medication View. This is at the <strong className="text-foreground">bottom of the page</strong>, under the Post-Treatment section.
        </p>

        <div className="space-y-3 pt-1">
          <Step n={1}>Scroll to the bottom of <strong>Medication View</strong>. You will see a section called <strong>Flag Patient for Follow-up</strong>.</Step>
          <Step n={2}>Type the patient's name or ID in the search box. Click their name to open the follow-up modal.</Step>
          <Step n={3}>
            A window will open asking: <strong>"Who will handle this follow-up?"</strong> You have two choices:
            <div className="mt-2 space-y-1.5 pl-2">
              <div className="flex gap-2 items-start">
                <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0 mt-px whitespace-nowrap">I'll handle it myself</span>
                <p className="text-xs text-muted-foreground">You contact the patient directly right now. Choose Email (you write or AI generates a message, then you send it) or Phone Call (you call them and type what happened on the call to log it). Good for urgent matters where you want to act immediately.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 shrink-0 mt-px whitespace-nowrap">Send to receptionist</span>
                <p className="text-xs text-muted-foreground">You pass the task to the receptionist. Type the reason (e.g. "Missed last 2 medications — please call"), choose Phone Call or Email, and click Create Task. It will appear in the receptionist's Call Tasks list for them to action.</p>
              </div>
            </div>
          </Step>
        </div>

        <div className="space-y-2 mt-2">
          <p className="font-semibold text-sm text-foreground">If you choose "I'll handle it myself" — Email:</p>
          <div className="space-y-1.5 pl-2">
            <div className="flex gap-2 items-start"><span className="text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">Step 1</span><p className="text-xs text-muted-foreground">Type a reason in the Reason box — even one sentence is fine (e.g. "Has not come in for check-up this week"). This is for your records.</p></div>
            <div className="flex gap-2 items-start"><span className="text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">Step 2</span><p className="text-xs text-muted-foreground">Either type your message directly in the message box, or click <strong className="text-foreground">AI Draft</strong> and the system will write a message for you based on the reason you typed. You can edit the AI draft before sending.</p></div>
            <div className="flex gap-2 items-start"><span className="text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">Step 3</span><p className="text-xs text-muted-foreground">Click <strong className="text-foreground">Send Email</strong>. If your clinic has SMS enabled and the wallet has credit, it goes as SMS (₦7). Otherwise it goes as a free email.</p></div>
          </div>

          <p className="font-semibold text-sm text-foreground pt-1">If you choose "I'll handle it myself" — Phone Call:</p>
          <div className="pl-2">
            <p className="text-xs text-muted-foreground">You call the patient yourself on the phone. After the call, come back and type what happened in the <strong className="text-foreground">Call outcome</strong> box (e.g. "Patient said she is recovering well and will come in on Friday"). Click <strong className="text-foreground">Log Call</strong> to save it to the patient's activity record.</p>
          </div>
        </div>

        <Tip>Use <strong>Send to receptionist</strong> when you are busy with other patients and can't contact them right now. Use <strong>I'll handle it myself</strong> when it is urgent and you want it done immediately.</Tip>
        <Remember>The AI Draft button only works after you have typed a reason. Fill in the reason first, then click AI Draft.</Remember>
      </Section>

      <AutoMessagesSection role="nurse" modules={{ appointmentsEnabled: true, feedbackEnabled: true, wellnessNewsletterEnabled: true }} />
    </div>
  );
}

/* ── main page ─────────────────────────────────────────────────────────────── */

const GREETINGS: Record<string, { emoji: string; title: string; subtitle: string }> = {
  admin:        { emoji: "👋", title: "Welcome, Admin!",        subtitle: "Your full guide to running the system. Everything is here — step by step, in plain English." },
  receptionist: { emoji: "👋", title: "Welcome, Receptionist!", subtitle: "Everything you need to know — from checking patients in to booking appointments." },
  nurse:        { emoji: "👋", title: "Welcome, Nurse!",        subtitle: "Your guide to creating care plans, reading schedules, and understanding what the system sends to patients." },
};

export default function HelpPage() {
  const { user, hospital, hospitalConfig } = useAuth();
  const role = user?.role ?? "admin";
  const hospitalName = hospital?.name ?? "Your Clinic";
  const g = GREETINGS[role] ?? GREETINGS.admin;
  const modules = {
    appointmentsEnabled: hospitalConfig?.modules?.appointmentsEnabled ?? true,
    feedbackEnabled: hospitalConfig?.modules?.feedbackEnabled ?? true,
    wellnessNewsletterEnabled: hospitalConfig?.modules?.wellnessNewsletterEnabled ?? true,
  };

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">

        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-5 space-y-1.5">
          <p className="text-4xl">{g.emoji}</p>
          <h1 className="text-2xl font-bold">{g.title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{g.subtitle}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 capitalize">{role}</span>
            <span className="text-xs text-muted-foreground">at {hospitalName}</span>
          </div>
        </div>

        {role === "admin"        && <AdminHelp        hospitalName={hospitalName} modules={modules} />}
        {role === "receptionist" && <ReceptionistHelp hospitalName={hospitalName} modules={modules} />}
        {role === "nurse"        && <NurseHelp        hospitalName={hospitalName} />}

        <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start">
          <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Still confused? We're here.</p>
            <p className="text-sm text-muted-foreground">Use the <strong>Need Help?</strong> button at the bottom-right of your screen to send us a message. We'll reply quickly.</p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
