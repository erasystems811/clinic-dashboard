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

function AutoMessagesSection() {
  type Row = { icon: string; trigger: string; what: string; channel: string; example?: string; doNotDo?: string };

  const rows: Row[] = [
    { icon: "🪑", trigger: "Patient added to queue", what: "Welcomes the patient and tells them their queue position", channel: "SMS", doNotDo: "Do not call to say they are checked in" },
    { icon: "🔔", trigger: "Patient is next in line", what: "Tells them to get ready — they will be called shortly", channel: "SMS" },
    { icon: "✅", trigger: "Receptionist ticks 'called in' checkbox", what: "Tells the patient it is their turn to come in", channel: "SMS" },
    { icon: "⏳", trigger: "Queue wait is very long", what: "Apologises for the long wait and thanks them for their patience", channel: "SMS", doNotDo: "Do not call separately to apologise" },
    { icon: "💊", trigger: "Nurse saves a care plan", what: "Tells the patient their plan is set up and to check their email for details", channel: "SMS — immediately" },
    { icon: "💊", trigger: "Nurse saves a care plan", what: "Full AI-written explanation of the plan in plain language", channel: "Email — 20 min later", doNotDo: "Do not call the patient — SMS and email go out automatically" },
  ];

  const inCareRows: Row[] = [
    {
      icon: "💊",
      trigger: "General Outpatient — Medication Only plan",
      what: "Sent at the exact medication time (morning, afternoon, evening, or night) every day for the full plan duration. Reminds the patient to take their medication right now.",
      channel: "Email — at each medication time daily",
      example: "Good morning Ada, it is time to take your morning medication as part of your care plan. We are with you every step of the way — keep going, you are doing great.",
    },
    {
      icon: "🏨",
      trigger: "General Outpatient — Come to Hospital plan",
      what: "Sent 3 hours before each hospital visit slot. Reminds the patient their visit is coming up and to start getting ready.",
      channel: "Email — 3 hours before each visit",
      example: "Good morning Ada, just a reminder that your hospital visit today is in 3 hours at 10:00 AM. Please plan to leave on time and we will be ready for you.",
    },
    {
      icon: "💊🏨",
      trigger: "General Outpatient — Combination plan (medication + hospital visit)",
      what: "Sent 2 hours before the hospital visit. Covers both: tells the patient their medication is due now AND their visit is in 2 hours.",
      channel: "Email — 2 hours before visit",
      example: "Good afternoon Ada, your afternoon medication is due now. Also, your hospital visit today is in 2 hours at 3:00 PM. Please take your medication and start preparing to come in.",
    },
    {
      icon: "🏥",
      trigger: "Specialist department plan (Antenatal, Surgery, Dental, Eye, Fertility, ENT, Paediatrics)",
      what: "Sent 1 day before each scheduled visit or appointment in the care plan. Reminds the patient what is happening the next day and what to expect.",
      channel: "Email — 1 day before each scheduled visit",
      example: "Antenatal appointment reminder — Monday 9 June — [Hospital]. Hi Ada, just a reminder that your Antenatal visit is tomorrow. Please make sure you are prepared and arrive a few minutes early.",
      doNotDo: "Do not call patients to remind them of upcoming plan visits — this email goes out automatically the day before",
    },
  ];

  const remainingRows: Row[] = [
    { icon: "📅", trigger: "Appointment booked", what: "Confirms the appointment date and time, asks them to arrive early", channel: "Email — immediately", doNotDo: "Do not call to confirm — they already got this email" },
    { icon: "🔄", trigger: "Appointment rescheduled", what: "Informs them of the new date and time", channel: "Email" },
    { icon: "⏰", trigger: "24 hours before appointment", what: "Reminds them their appointment is tomorrow", channel: "Email" },
    { icon: "⏰", trigger: "2 hours before appointment", what: "Reminds them their appointment is in 2 hours", channel: "Email", doNotDo: "Do not call to remind — 3 emails are already sent" },
    { icon: "😟", trigger: "Appointment marked No Show", what: "Checks in on the patient and invites them to rebook", channel: "Email", doNotDo: "Do not follow up manually — this email goes out automatically" },
    { icon: "🏥", trigger: "Patient moves to Post Treatment — Day 1", what: "Checks in, wishes them a good recovery, says the team is thinking of them", channel: "Email" },
    { icon: "🏥", trigger: "Post Treatment — Day 4", what: "Checks in again, encourages them, says the team is rooting for them", channel: "Email" },
    { icon: "🏥", trigger: "Post Treatment — Day 7", what: "One-week check-in, congratulates their progress", channel: "Email", doNotDo: "Do not add manual follow-ups for post-treatment — Day 1, 4, and 7 emails are automatic" },
    { icon: "💭", trigger: "Patient dormant for 30 days with no activity", what: "A gentle 'thinking of you' email, invites them to come back if they need anything", channel: "Email" },
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

  return (
    <Section emoji="📱" title="What the System Sends to Patients Automatically" ci={10}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The system contacts patients <strong className="text-foreground">on its own</strong> after certain actions. You do not need to call or message separately. Here is what each one does.
      </p>

      <div className="space-y-2">
        {rows.map(renderRow)}
      </div>

      <p className="font-semibold text-sm border-b border-border pb-1.5 pt-2">Continuous in-care reminders — while patient is In Care</p>
      <p className="text-xs text-muted-foreground -mt-2">These run every day for the entire plan duration. What gets sent depends on the patient's department and treatment type.</p>
      <div className="space-y-2">
        {inCareRows.map(renderRow)}
      </div>

      <div className="space-y-2 pt-1">
        {remainingRows.map(renderRow)}
      </div>
    </Section>
  );
}

/* ── admin ─────────────────────────────────────────────────────────────────── */

function AdminHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="🏠" title="Your Dashboard" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">The first thing you see when you log in. It shows a live overview of your clinic. Here is what every card means:</p>
        <div className="space-y-3">
          {[
            { label: "Total Patients", desc: 'Total registered patients. The small note below shows how many joined this month — for example "+3 new this month".' },
            { label: "Appointments Today", desc: "How many appointments are scheduled for today. Also shows the total count for this week underneath." },
            { label: "Active Patients", desc: "How many patients are currently in the queue or in active care right now." },
            { label: "Avg Wait Time", desc: "The average time patients wait before being seen. The arrow shows if it is going up or down compared to last month." },
            { label: "No-show Rate", desc: "The percentage of appointments where the patient did not show up. Lower is better." },
            { label: "Patient Feedback", desc: "Your average star rating out of 5, based on all submitted feedback responses." },
            { label: "Wellness Newsletter", desc: "The date of the last wellness email you sent to patients." },
            { label: "System Status", desc: 'Shows "Healthy" when everything is working normally.' },
            { label: "Pipeline Breakdown", desc: "A bar chart showing how many patients are in each stage of care." },
          ].map(item => (
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

      <Section emoji="📅" title="Appointments" ci={3}>
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
      </Section>

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

      <Section emoji="⭐" title="Patient Feedback" ci={5}>
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
      </Section>

      <Section emoji="💌" title="Wellness Newsletter" ci={6}>
        <p className="text-sm text-muted-foreground">Send weekly health education emails to your active patients. AI writes the content for you.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Wellness Newsletter</strong> in the sidebar.</Step>
          <Step n={2}>The <strong>Compose tab</strong> — type a topic (e.g. "hydration") or leave blank and let AI pick. Add a YouTube link or TikTok link if you have one. Click <strong>Generate</strong>.</Step>
          <Step n={3}>The AI writes the newsletter. Read it, edit if needed, then click <strong>Send</strong>. Email subject: <em>"Your weekly wellness update — [Hospital]"</em></Step>
          <Step n={4}>The <strong>History tab</strong> shows all past newsletters.</Step>
          <Step n={5}>The <strong>Bulk tab</strong> is for sending to a specific group of patients.</Step>
        </div>
        <Tip>Only patients in Active, In Care, Post Treatment, or Dormant stages with an email address will receive the newsletter.</Tip>
      </Section>

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
        <p className="text-sm text-muted-foreground">Add nurses and receptionists, change passwords, and deactivate accounts from Settings.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Settings</strong> at the very bottom of the sidebar.</Step>
          <Step n={2}>The <strong>Staff Accounts</strong> section lists all your staff members.</Step>
          <Step n={3}>To add someone — click <strong>Add Staff</strong>, fill in their name, username, password, and role, then save.</Step>
          <Step n={4}>To reset a password — click the staff member's row, change the password, and save.</Step>
          <Step n={5}>To deactivate someone who has left — toggle their <strong>Active</strong> switch off. They won't be able to log in.</Step>
          <Step n={6}>The <strong>SMS Wallet</strong> shows your current balance. Top it up here so SMS messages can go out (₦7 per SMS).</Step>
        </div>
        <Remember>Usernames cannot be changed after they are created. Choose carefully.</Remember>
      </Section>

      <Section emoji="💳" title="SMS Wallet — What Gets Charged" ci={9}>
        <p className="text-sm text-muted-foreground">Most messages the system sends are <strong className="text-foreground">free emails</strong>. Only a few specific actions send an SMS, and each SMS costs <strong className="text-foreground">₦7</strong> from your wallet. Here is exactly which ones cost money:</p>
        <div className="space-y-2 mt-1">
          {[
            { label: "Appointment reminder SMS", desc: "If you have turned on SMS reminders for appointments — the 24h and 2h reminders go via SMS instead of email. Each one costs ₦7." },
            { label: "Call task message (if SMS is enabled)", desc: "When the receptionist sends a message from a Call Task — if SMS is enabled for your account, it goes via SMS (₦7). Otherwise it sends as a free email." },
            { label: "Post-treatment follow-up SMS", desc: "For Antenatal, Surgery, Dental, Eye, ENT, and Fertility departments — follow-up check-ins can go via SMS if enabled. Each one costs ₦7." },
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

      <AutoMessagesSection />
    </div>
  );
}

/* ── receptionist ──────────────────────────────────────────────────────────── */

function ReceptionistHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="🪑" title="Queue Management — Your Main Job" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">The Queue is where you manage patients who are at the clinic today. It refreshes every 5 seconds.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Queue Management</strong> in the sidebar. You see two sections: <strong>Current Queue</strong> (patients checked in today) and <strong>Add Patient to Queue</strong> (for new arrivals).</Step>
          <Step n={2}>When a patient arrives — go to <strong>Add Patient to Queue</strong>, type their name or ID (at least 2 characters), and click <strong>Add to Queue</strong>.</Step>
          <Step n={3}>When a patient is called in to see the doctor — tick the checkbox next to their name in <strong>Current Queue</strong>. This removes them from the queue.</Step>
          <Step n={4}>To edit a patient's details — click the pencil icon next to their name.</Step>
          <Step n={5}>If the patient is not found in search — click <strong>Register New Patient</strong> to add them first.</Step>
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

      <Section emoji="📅" title="Booking Appointments" ci={2}>
        <p className="text-sm text-muted-foreground">For scheduling a patient's visit in advance.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Appointments</strong> in the sidebar.</Step>
          <Step n={2}>You see a weekly calendar with 30-minute slots from 8am to 6pm.</Step>
          <Step n={3}>Click any empty slot, search for the patient, add a title, and click <strong>Confirm Booking</strong>.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">After booking, the patient automatically receives:</p>
          <p>📧 Confirmation: <em>"Your appointment at {hospitalName} has been confirmed for [date]. Please arrive a few minutes early."</em></p>
          <p>📧 24h reminder: <em>"This is a friendly reminder that your appointment is tomorrow [date]."</em></p>
          <p>📧 2h reminder: <em>"Just a quick reminder that your appointment is in 2 hours at [time]."</em></p>
        </AutoBox>
        <Remember>Do not call patients to confirm or remind them. They receive 3 emails automatically.</Remember>
      </Section>

      <AutoMessagesSection />
    </div>
  );
}

/* ── nurse ─────────────────────────────────────────────────────────────────── */

function NurseHelp({ hospitalName }: { hospitalName: string }) {
  return (
    <div className="space-y-3">

      <Section emoji="💊" title="Medication View — Managing Care Plans" defaultOpen ci={0}>
        <p className="text-sm text-muted-foreground">This is where you create and manage care plans for patients. A care plan is the treatment schedule you set up for each patient.</p>
        <div className="space-y-3">
          <Step n={1}>Click <strong>Medication View</strong> in the sidebar.</Step>
          <Step n={2}>Search for the patient by name or ID (type at least 2 characters). Click their name to select them.</Step>
          <Step n={3}>Click <strong>New Care Plan</strong>. Choose the department, fill in the plan details, and click <strong>Save</strong>.</Step>
          <Step n={4}>To view or edit an existing plan — find the patient and click on their active plan. Click the pencil icon to edit.</Step>
          <Step n={5}>To end a plan early — open it and click <strong>End Early</strong>, then confirm.</Step>
          <Step n={6}>To reuse a past plan as a starting point — click <strong>Use as template</strong> on any plan under Past Plans.</Step>
        </div>
        <AutoBox>
          <p className="font-semibold">The moment you save a care plan, the system sends:</p>
          <p>📱 SMS immediately: <em>"Hi [Name], your care plan at {hospitalName} has been set up. Please check your email continuously for your full care plan details and follow up. We are with you every step of the way."</em></p>
          <p>📧 Email 20 minutes later: a full AI-written explanation of the plan in plain language</p>
          <p>📧 Daily reminder emails at each medication time or visit slot for the whole plan duration</p>
        </AutoBox>
        <Remember>The 20-minute gap is on purpose — it gives you time to fix mistakes before the full email goes out. Do NOT call the patient to tell them their plan started. The system already did it.</Remember>
      </Section>

      <Section emoji="📋" title="Care Plan Departments" ci={1}>
        <p className="text-sm text-muted-foreground">Different departments have different plan formats. Here is what each one is for:</p>
        <div className="space-y-2">
          {[
            { dept: "General Outpatient", desc: "Treatment at home (Medication Only), at hospital (Come to Hospital), or both (Combination). Set timing slots — morning, afternoon, evening, night — and plan duration." },
            { dept: "Antenatal", desc: "Pregnancy care. Tracks the current pregnancy week and ANC visit schedule with dates and times." },
            { dept: "Paediatrics", desc: "Child health care. Includes vaccination schedule and age-based care plan." },
            { dept: "Surgery", desc: "Procedure date and time, plus in-care recovery schedule." },
            { dept: "Dental", desc: "Dental procedure and follow-up appointment schedule." },
            { dept: "Eye", desc: "Eye care treatment and appointment schedule." },
            { dept: "Fertility", desc: "Fertility treatment schedule and appointments." },
            { dept: "ENT", desc: "Ear, nose, and throat treatment and follow-up dates." },
          ].map(d => (
            <div key={d.dept} className="flex gap-3 items-start">
              <span className="text-xs font-bold bg-muted border border-border rounded px-2 py-0.5 shrink-0 mt-0.5 whitespace-nowrap">{d.dept}</span>
              <p className="text-sm text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <AutoMessagesSection />
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
  const { user, hospital } = useAuth();
  const role = user?.role ?? "admin";
  const hospitalName = hospital?.name ?? "Your Clinic";
  const g = GREETINGS[role] ?? GREETINGS.admin;

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

        {role === "admin"        && <AdminHelp        hospitalName={hospitalName} />}
        {role === "receptionist" && <ReceptionistHelp hospitalName={hospitalName} />}
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
