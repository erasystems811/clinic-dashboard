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

function EmailPreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 text-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/40">
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
      <div className="max-w-xs bg-emerald-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 leading-relaxed">{body}</div>
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

function AutoMessagesSection({ hospitalName = "Your Clinic" }: { hospitalName?: string }) {
  return (
    <Section emoji="📱" title="What the System Sends to Patients Automatically" ci={10}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The system sends messages to patients <strong className="text-foreground">on its own</strong> — you don't need to call or message separately. Here is exactly what each message says.
      </p>

      {/* Queue */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Queue messages (SMS)</p>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>1️⃣</span> When receptionist adds patient to queue</p>
          <SmsPreview body={`Hi Ada, welcome to ${hospitalName}. You've been checked in and you're currently number 3 in the queue. Our team is working as quickly as possible and we'll keep you updated every step of the way. Please relax and make yourself comfortable. Thank you for trusting us with your care.`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>2️⃣</span> When patient is next in line</p>
          <SmsPreview body={`Hi Ada, you are next in line at ${hospitalName}. Please be ready — you will be called in shortly. Thank you for your patience.`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>3️⃣</span> When receptionist ticks the "called in" checkbox</p>
          <SmsPreview body={`Hi Ada, it is your turn now at ${hospitalName}. Please proceed, we are ready for you.`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>⏳</span> When the wait is running very long</p>
          <SmsPreview body={`Hi Ada, we sincerely apologise for the longer than usual wait today at ${hospitalName}. We are doing our best to attend to everyone as quickly as possible and we truly appreciate your patience. Thank you for being with us.`} />
          <Remember>Do NOT call patients to apologise for a long wait — the system already sends this SMS automatically.</Remember>
        </div>
      </div>

      {/* Care plan */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Care plan messages (triggered when nurse saves a care plan)</p>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📱</span> SMS — sent immediately</p>
          <SmsPreview body={`Hi Ada, your care plan at ${hospitalName} has been set up. Please check your email continuously for your full care plan details and follow up. We are with you every step of the way.`} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Email — sent 20 minutes later</p>
          <p className="text-xs text-muted-foreground">The 20-minute gap lets the nurse correct any mistakes before the detailed email goes out.</p>
          <EmailPreview
            subject={`Your care plan has started — ${hospitalName}`}
            body={`Hi Ada,\n\nYour care plan with us begins today. The team at ${hospitalName} will be with you every step of the way. Please follow the schedule carefully and take things one day at a time.\n\nIf you have any questions please do not hesitate to contact us directly. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
          <p className="text-xs text-muted-foreground">The email body is written by AI and personalised based on the patient's actual plan details.</p>
          <Remember>Do NOT call the patient to say their care plan started — the SMS and email are sent automatically the moment the nurse saves.</Remember>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Daily in-care reminders — for the whole plan duration</p>
          <p className="text-xs text-muted-foreground">At each medication time or hospital visit slot on the plan, the patient receives a reminder email. For hospital visits it arrives 2–3 hours before.</p>
          <EmailPreview
            subject={`Good morning, Ada — Outpatient reminder — ${hospitalName}`}
            body={`Good morning Ada,\n\nJust a warm reminder that it is time to take your morning medication as part of your care plan at ${hospitalName}. We are with you every step of the way — keep going, you are doing great.\n\nIf you have any concerns please contact us directly. Please do not reply to this email directly.\n— ${hospitalName} Team`}
          />
        </div>
      </div>

      {/* Appointments */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Appointment emails</p>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Confirmation — sent immediately after booking</p>
          <EmailPreview
            subject={`Appointment Confirmed — ${hospitalName}`}
            body={`Hi Ada,\n\nYour appointment at ${hospitalName} has been confirmed for Monday 9 June at 10:00 AM. Please arrive a few minutes early.\n\nIf you need to reschedule please do not hesitate to contact us as soon as possible. Please do not reply to this email directly. We look forward to seeing you.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Reminder — sent 24 hours before</p>
          <EmailPreview
            subject={`Reminder — Your appointment is tomorrow — ${hospitalName}`}
            body={`Hi Ada,\n\nThis is a friendly reminder that your appointment at ${hospitalName} is tomorrow Monday 9 June at 10:00 AM. We look forward to seeing you.\n\nIf you need to reschedule please contact us as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Reminder — sent 2 hours before</p>
          <EmailPreview
            subject={`Your appointment is in 2 hours — ${hospitalName}`}
            body={`Hi Ada,\n\nJust a quick reminder that your appointment at ${hospitalName} is in 2 hours at 10:00 AM. We will see you soon.\n\nIf you need to reschedule please contact us immediately. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
          <Remember>Do NOT call patients to remind them about appointments. They get 3 automatic emails: at booking, 24h before, and 2h before.</Remember>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Reschedule confirmation — sent when appointment is rescheduled</p>
          <EmailPreview
            subject={`Appointment Rescheduled — ${hospitalName}`}
            body={`Hi Ada,\n\nWe would like to let you know that your appointment at ${hospitalName} has been rescheduled to Tuesday 10 June at 2:00 PM. Please take note of the new date and time.\n\nIf you have any questions please contact us as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>😟</span> No-show email — sent when appointment is marked "No Show"</p>
          <EmailPreview
            subject={`We are worried about you — ${hospitalName}`}
            body={`Hi Ada,\n\nWe noticed you were not able to make your appointment at ${hospitalName} today and we just wanted to check in to make sure you are okay. Your health and wellbeing are always our priority and we care about you.\n\nWhenever you are ready to rebook or if you need anything at all please do not hesitate to contact us. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
          <Remember>Marking an appointment as No Show automatically sends this email. You do not need to contact the patient yourself.</Remember>
        </div>
      </div>

      {/* Post-treatment */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Post-treatment check-ins (sent after patient stage moves to Post Treatment)</p>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Day 1</p>
          <EmailPreview
            subject={`Checking in on you — ${hospitalName}`}
            body={`Hi Ada,\n\nWe hope you are resting and taking things easy today. Your treatment at ${hospitalName} has just concluded and we wanted to reach out on this first day to let you know we are thinking of you. Recovery takes time and that is completely okay.\n\nIf you have any questions or concerns please do not hesitate to contact us. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Day 4</p>
          <EmailPreview
            subject={`How are you feeling? — ${hospitalName}`}
            body={`Hi Ada,\n\nIt has been a few days since your treatment at ${hospitalName} and we just wanted to check in on you. We hope you are feeling a little better each day. Recovery is a journey and we want you to know we are rooting for you.\n\nIf anything feels off or you have any concerns at all please contact us. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>📧</span> Day 7</p>
          <EmailPreview
            subject={`One week check-in — ${hospitalName}`}
            body={`Hi Ada,\n\nA week has passed since your treatment at ${hospitalName} and we hope you are feeling much better. You have come a long way and we are proud of your progress.\n\nIf you need anything at all please do not hesitate to contact us. Please do not reply to this email directly. We are always here for you.\n\nWarm regards,\n${hospitalName} Team`}
          />
          <Remember>Do NOT add manual call tasks for post-treatment patients. The system sends Day 1, Day 4, and Day 7 emails automatically.</Remember>
        </div>
      </div>

      {/* Dormant & birthday */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Re-engagement and special emails</p>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>💭</span> After 30 days of no activity (Dormant stage)</p>
          <EmailPreview
            subject={`Thinking of you — ${hospitalName}`}
            body={`Hi Ada,\n\nIt has been a little while since we last saw you at ${hospitalName} and we just wanted to check in and see how you are doing. We hope you are feeling well and taking good care of yourself. Your health and wellbeing mean a lot to us.\n\nIf you ever need anything or feel it is time for a check-up please do not hesitate to contact us. Please do not reply to this email directly. We are always here when you need us.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>🎂</span> On the patient's birthday (every year, automatically)</p>
          <EmailPreview
            subject={`Happy Birthday from ${hospitalName} 🎂`}
            body={`Hi Ada,\n\nThe entire team at ${hospitalName} wants to wish you a very happy birthday! Today is your day and we are all thinking of you.\n\nOur biggest wish for you today is truly good health. And remember — an apple a day keeps the doctor away, but visiting us occasionally keeps the doctor happy 😄\n\nWarm regards,\n${hospitalName} Team`}
          />
          <p className="text-xs text-muted-foreground">The birthday message is uniquely written by AI for your clinic's personality. You don't need to do anything — it goes out automatically every year.</p>
        </div>
      </div>

      {/* Feedback */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Feedback request email</p>
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>⭐</span> Sent automatically after a patient is seen</p>
          <EmailPreview
            subject={`How was your visit? — ${hospitalName}`}
            body={`Hi Ada,\n\nThank you for visiting ${hospitalName} yesterday. We hope your experience was a positive one. We would love to hear your thoughts so we can continue to improve our service. Please take a moment to share your feedback using the link below.\n\n[Share Your Feedback →]\n\nYour feedback means a lot to us. Please do not reply to this email directly.\n\nWarm regards,\n${hospitalName} Team`}
          />
        </div>
      </div>

      {/* Wellness */}
      <div className="space-y-4">
        <p className="font-semibold text-sm border-b border-border pb-1.5">Weekly wellness newsletter</p>
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><span>💌</span> Sent when admin clicks Send on the Wellness Newsletter page</p>
          <EmailPreview
            subject={`Your weekly wellness update — ${hospitalName}`}
            body={`Dear Friends,\n\nThis week we are looking at something most people never think about — the effect of shallow breathing on daily energy levels...\n\n[Full newsletter content here]\n\nWith care, The ${hospitalName} Wellness Team\n\nThis newsletter is for general wellness information only. Please do not reply to this email.`}
          />
          <p className="text-xs text-muted-foreground">Only patients in Active, In Care, Post Treatment, or Dormant stages with an email address will receive this.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2">
        <p className="font-semibold text-sm">All messages the system handles automatically:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
          {[
            "✅ Queue joined SMS",
            "✅ Next in line SMS",
            "✅ Your turn SMS",
            "✅ Long wait apology SMS",
            "✅ Care plan SMS (instant)",
            "✅ Care plan email (20 min later)",
            "✅ Daily in-care reminders",
            "✅ Appointment confirmation email",
            "✅ Appointment reschedule email",
            "✅ 24h appointment reminder",
            "✅ 2h appointment reminder",
            "✅ No-show check-in email",
            "✅ Post-treatment Day 1 email",
            "✅ Post-treatment Day 4 email",
            "✅ Post-treatment Day 7 email",
            "✅ 30-day dormant re-engagement",
            "✅ Birthday email (every year)",
            "✅ Feedback request email",
            "✅ Weekly wellness newsletter",
          ].map(i => <p key={i}>{i}</p>)}
        </div>
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

      <AutoMessagesSection hospitalName={hospitalName} />
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

      <AutoMessagesSection hospitalName={hospitalName} />
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

      <AutoMessagesSection hospitalName={hospitalName} />
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
