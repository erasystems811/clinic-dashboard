import { useState } from "react";
import Layout from "@/components/layout";
import {
  BookOpen, Server, Users, Zap, Database, Key, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Mail, MessageSquare,
  LifeBuoy, Calendar, ClipboardList, Activity, Settings,
  Building2, HelpCircle, RefreshCw, Clock,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        active
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ icon: Icon, text, color = "text-primary" }: { icon: React.ComponentType<{ className?: string }>; text: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-8 first:mt-0">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">{text}</h2>
    </div>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" | "tip" }) {
  const styles = {
    info:    "border-blue-500/30 bg-blue-500/8 text-blue-300",
    warning: "border-amber-500/30 bg-amber-500/8 text-amber-300",
    tip:     "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
  };
  const icons = { info: "ℹ", warning: "⚠", tip: "✓" };
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm flex gap-2.5 my-3 ${styles[type]}`}>
      <span className="shrink-0 font-bold">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/3 transition"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border text-sm text-muted-foreground space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border my-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "" : "bg-white/2"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-foreground/80 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-3">
      <pre className="bg-black/40 border border-border rounded-lg px-4 py-3 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground mt-5 mb-2">{children}</h3>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>;
}

// ── ABOUT TAB ─────────────────────────────────────────────────────────────────

function AboutTab() {
  return (
    <div className="space-y-1">

      <SectionTitle icon={BookOpen} text="What Is Era Systems?" />
      <P>Era Systems is a clinic management platform you built and own. It is a SaaS product — many different hospitals and clinics subscribe and use it, each seeing only their own data. You are the platform owner. Every hospital is a tenant on your platform.</P>
      <P>The system does three main things:</P>
      <ul className="list-disc pl-5 space-y-1 mb-3">
        <Li>Helps hospital staff manage patients, queues, appointments, and care plans</Li>
        <Li>Automatically sends emails and messages to patients on behalf of hospitals (reminders, check-ins, feedback requests, birthday emails, etc.)</Li>
        <Li>Gives you full visibility and control over all hospitals from this dashboard</Li>
      </ul>

      <SectionTitle icon={Building2} text="The Three Portals" />
      <Table
        headers={["Portal", "Who uses it", "What it is"]}
        rows={[
          ["Hospital App (era-patient)", "Hospital staff", "The daily-use app — patients, queue, appointments, care plans"],
          ["Super Admin (era-super-admin)", "You only", "This dashboard — manage all hospitals, view health, support inbox"],
          ["Feedback Form", "Patients", "A public link each hospital shares with patients to collect ratings"],
        ]}
      />

      <H3>The Three Hospital Roles</H3>
      <Table
        headers={["Role", "What they see", "What they do"]}
        rows={[
          ["Admin", "Everything", "Full access — patients, pipeline, settings, imports, analytics, care plans"],
          ["Receptionist", "Queue + Appointments + Call Tasks", "Checks patients in, manages queue, books appointments, sends messages"],
          ["Nurse", "Medication View + Call Tasks", "Views active care plans with daily schedules, flags patients who need follow-up"],
        ]}
      />

      <SectionTitle icon={Users} text="Patient Journey & Stages" />
      <P>Every patient moves through four stages. The system transitions them automatically based on their care activity.</P>
      <Table
        headers={["Stage", "Meaning", "Who is here"]}
        rows={[
          ["Active", "Registered, not yet in treatment", "New patients waiting to begin care"],
          ["In Care", "Currently receiving treatment", "Patients with an active care plan"],
          ["Post Treatment", "Treatment ended, in follow-up", "Patients getting Day 1/4/7 check-in emails"],
          ["Dormant", "No engagement in 90+ days", "Patients who have gone quiet — get a re-engagement email"],
        ]}
      />

      <SectionTitle icon={Zap} text="All Features" />

      <Accordion title="Queue Management" defaultOpen>
        <P>When patients arrive, the receptionist adds them to the queue. The system automatically sends WhatsApp/SMS messages at each step: checked in (with queue number), next in line, your turn. If someone waits too long, an apology message goes out. No-shows are detected and handled automatically.</P>
      </Accordion>

      <Accordion title="Appointments">
        <P>Admins and receptionists book appointments. The system sends a confirmation email immediately, a reminder 24 hours before, and another 2 hours before. If the patient doesn't show up, a follow-up email is sent automatically.</P>
      </Accordion>

      <Accordion title="Care Plans">
        <P>Nurses create care plans with a full treatment schedule — which medications to take at which times of day, and which clinic visits are required. The system sends the patient an email with their full care plan details 20 minutes after the nurse creates it (giving the nurse time to make last-minute edits). Daily reminder emails fire at the right time slots (morning, afternoon, evening, night). If a family member/beneficiary is listed, they get reminders too.</P>
      </Accordion>

      <Accordion title="Post-Treatment Check-ins">
        <P>After treatment ends, the system automatically sends three check-in emails:</P>
        <ul className="list-disc pl-5 space-y-1">
          <Li>Day 1: "We hope you are resting well today"</Li>
          <Li>Day 4: "Checking in — how are you feeling?"</Li>
          <Li>Day 7: "One week on — we are proud of your progress"</Li>
        </ul>
      </Accordion>

      <Accordion title="Feedback Collection">
        <P>The day after a patient's appointment, the system sends them a feedback email. They click a link and rate their experience (overall, wait time, staff, quality of care) and leave a comment. The hospital sees all results in their Feedback section. You see all results in Analytics.</P>
      </Accordion>

      <Accordion title="Wellness Newsletter">
        <P>Hospital admins choose a health topic and the system generates a full wellness newsletter using AI (Claude). It goes to all Active, In Care, Post Treatment, and Dormant patients who have an email address. Admins can also add YouTube and TikTok video links.</P>
      </Accordion>

      <Accordion title="Call Tasks">
        <P>When a nurse flags a patient from the Medication View (e.g., "missed medication"), it creates a Call Task. The system uses AI to draft a message tailored to the specific reason. The receptionist reviews, can edit it, and sends it as an email. They can also write a manual email instead.</P>
      </Accordion>

      <Accordion title="Patient Import (CSV)">
        <P>Admins can upload a spreadsheet of patients all at once. The system maps the CSV columns to the right fields (First Name, Last Name, Email, Phone, etc.) and imports them. Duplicates — same email or patient ID — are automatically skipped. Imported patients go straight into the Patients list and pipeline.</P>
      </Accordion>

      <SectionTitle icon={Clock} text="The Scheduler — When Automations Fire" />
      <Table
        headers={["Schedule", "What runs"]}
        rows={[
          ["Every 5 minutes", "Care plan summary emails (20 min delay after nurse creates plan)"],
          ["Every 15 minutes", "Appointment reminders, no-show detection, no-show follow-up emails, long queue wait alerts"],
          ["Every hour", "Care plan daily reminders (medication + visit reminders)"],
          ["Daily 7 AM WAT", "Stage transitions, post-treatment check-ins, departmental follow-ups, dormant detection, birthday emails"],
          ["Daily 9 AM WAT", "Termii SMS credit balance alert (emails you if balance is low)"],
          ["Daily noon WAT", "Feedback request emails (for previous day's patients)"],
          ["Daily 6 PM WAT", "Post-care wellness emails for dormant patients"],
          ["Daily 11 PM WAT", "Clear no-show flags from today"],
          ["Every 6 hours", "Subscription expiry check"],
        ]}
      />
      <Note type="info">The scheduler only runs when <strong>ENABLE_SCHEDULER=true</strong> is set in Railway environment variables. If automations stop working entirely, check this first.</Note>

      <SectionTitle icon={Mail} text="Email & SMS Providers" />
      <Table
        headers={["Service", "What it does", "Account"]}
        rows={[
          ["Resend", "Sends emails — free up to 3,000/month", "resend.com"],
          ["AWS SES", "Sends emails at high volume (auto-switch when Resend limit is near)", "aws.amazon.com → SES"],
          ["Termii", "Sends WhatsApp and SMS", "termii.com"],
          ["Africa's Talking", "Optional second SMS provider (Termii is fallback)", "africastalking.com"],
          ["OpenAI", "AI for some message types (visit reminders, call tasks, in-care reminders)", "platform.openai.com"],
          ["Anthropic (Claude)", "AI for care plan emails, newsletters, birthday emails, follow-ups", "console.anthropic.com"],
          ["Railway", "Hosts all your servers", "railway.app"],
          ["Supabase", "Your database", "supabase.com"],
        ]}
      />

      <SectionTitle icon={CheckCircle2} text="Hospital Suspension Behaviour" />
      <P>When you suspend a hospital, their staff can still log in but NO emails or messages are actually sent to patients. However the system still processes all scheduled events internally and creates log entries. This means when you re-activate them, there is no catch-up flood — the system continues from the current date as if nothing was paused.</P>
      <Note type="tip">This is intentional design. Suspending a hospital does not create a backlog of old messages waiting to send when they come back.</Note>
    </div>
  );
}

// ── MANUAL TAB ────────────────────────────────────────────────────────────────

function ManualTab() {
  return (
    <div className="space-y-1">

      <SectionTitle icon={Settings} text="Part 1 — Super Admin Operations" />

      <Accordion title="Creating a New Hospital Account" defaultOpen>
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click <strong>Hospitals</strong> in the sidebar</Li>
          <Li>Click <strong>New Hospital</strong> (top right)</Li>
          <Li>Fill in: Hospital Name, Username (short lowercase, e.g. <em>lagosclinic</em> — cannot be changed later), Subscription Status</Li>
          <Li>Click Create — a random password is generated automatically</Li>
          <Li>Open the hospital's detail page to get all credentials and their feedback form link</Li>
          <Li>Send the admin their username + password, and the staff credentials for receptionist and nurse</Li>
        </ol>
      </Accordion>

      <Accordion title="Resetting a Hospital's Password">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click the hospital name → open their detail page</Li>
          <Li>Click <strong>Regenerate Password</strong></Li>
          <Li>A new password is created and shown once — send it to the hospital admin</Li>
        </ol>
      </Accordion>

      <Accordion title="Suspending / Activating a Hospital">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Open hospital detail page</Li>
          <Li>Toggle <strong>Active</strong> off to suspend, or change subscription status to <em>inactive</em></Li>
          <Li>To re-activate, toggle Active back on</Li>
        </ol>
        <Note type="tip">Automations keep running silently during suspension so there is no catch-up flood when you re-activate.</Note>
      </Accordion>

      <Accordion title="Enabling or Disabling Features for a Hospital">
        <P>Each hospital can have features turned on or off. Open their detail page → Modules section → toggle on or off:</P>
        <ul className="list-disc pl-5 space-y-1">
          <Li><strong>Appointments</strong> — show/hide the appointments section</Li>
          <Li><strong>Feedback</strong> — show/hide the feedback section</Li>
          <Li><strong>Wellness Newsletter</strong> — show/hide the wellness section</Li>
          <Li><strong>WhatsApp</strong> — enable/disable WhatsApp messaging</Li>
          <Li><strong>Messages</strong> — enable/disable the messages tab</Li>
        </ul>
      </Accordion>

      <Accordion title="Responding to Support Tickets">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click <strong>Support</strong> in the sidebar</Li>
          <Li>Click any ticket to expand it and read the hospital's message</Li>
          <Li>Type your reply and click <strong>Send Reply</strong></Li>
          <Li>The system emails your reply to the hospital's contact email. The ticket closes automatically.</Li>
        </ol>
        <Note type="tip">Add your email as <strong>SUPPORT_EMAIL</strong> in Railway so you get an instant email ping whenever a hospital submits a new ticket.</Note>
      </Accordion>

      <Accordion title="Checking Platform Health">
        <P>Click <strong>Analytics</strong> in the sidebar. The health panel shows whether each service (Email, SMS, WhatsApp, Database) is working. Green = OK, Red = problem. See Part 5 for how to fix red services.</P>
      </Accordion>

      <Accordion title="Deploying a New Version">
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Click <strong>Deploy</strong> in the sidebar</Li>
          <Li>Click <strong>Deploy</strong> in the confirmation popup</Li>
          <Li>Wait 60–90 seconds — the button turns green showing "Deployed"</Li>
        </ol>
      </Accordion>

      <SectionTitle icon={LifeBuoy} text="Part 2 — Helping Hospitals (Support Guide)" />
      <Note type="info">This section covers every common problem a hospital will report to you, and exactly how to fix it.</Note>

      <Accordion title="Hospital can't log in">
        <H3>Check 1 — Right URL?</H3>
        <P>Make sure they are going to the correct era-patient URL. They should bookmark it.</P>
        <H3>Check 2 — Wrong password?</H3>
        <P>Super admin → their hospital → detail page → check or regenerate their password → send it to them.</P>
        <H3>Check 3 — Are they suspended?</H3>
        <P>Super admin → their hospital → check Active status. Re-activate if needed.</P>
        <H3>Check 4 — Staff login (receptionist/nurse)</H3>
        <P>Super admin → hospital detail → Staff Credentials section → confirm or regenerate the username and password shown there.</P>
      </Accordion>

      <Accordion title="Emails are not reaching patients">
        <H3>Step 1 — Check the automation log in Supabase</H3>
        <P>Supabase → Table Editor → <strong>automation_log</strong> table → filter status = failed → look at the error_message column.</P>
        <H3>Step 2 — Check platform health</H3>
        <P>If Email shows red: check that RESEND_API_KEY and PLATFORM_FROM_EMAIL are set in Railway Variables.</P>
        <H3>Step 3 — Is the patient's email correct?</H3>
        <P>Ask the hospital to check the email address on the patient's record. A typo is the most common cause.</P>
        <H3>Step 4 — Spam folder</H3>
        <P>Ask the patient to check their spam/junk folder.</P>
      </Accordion>

      <Accordion title="SMS/WhatsApp not sending to patients">
        <H3>Step 1 — Check Termii balance</H3>
        <P>Super admin → Analytics → check the SMS/WhatsApp health — it shows the Termii credit balance. If low, top up at <strong>termii.com</strong>. You also get a daily 9am email alert if balance drops below ₦50.</P>
        <H3>Step 2 — Phone number format</H3>
        <P>Termii requires international format. Nigerian numbers must start with 234, not 0.</P>
        <ul className="list-disc pl-5 space-y-1">
          <Li>Wrong: 08012345678</Li>
          <Li>Correct: 2348012345678</Li>
        </ul>
        <H3>Step 3 — Hospital's notification channel</H3>
        <P>Super admin → hospital detail → Settings → check Notification Channel (should be whatsapp or sms) and Termii Sender ID.</P>
        <H3>Step 4 — Check automation log</H3>
        <P>Supabase → automation_log → filter status = failed for that hospital → read error_message.</P>
      </Accordion>

      <Accordion title="Automated emails stopped working completely for a hospital">
        <H3>Check 1 — Scheduler running?</H3>
        <P>Railway → api-server → Logs. Search for "scheduler". You should see lines like [scheduler] running. If you see "Scheduler disabled", go to Variables and make sure ENABLE_SCHEDULER=true is set.</P>
        <H3>Check 2 — Hospital settings created?</H3>
        <P>The hospital admin must go to Settings in their app and press Save at least once. This creates their settings row in the database. Without it, automations cannot look up their configuration.</P>
        <H3>Check 3 — Subscription active?</H3>
        <P>A hospital with an expired subscription is auto-suspended. Check their status in your dashboard.</P>
      </Accordion>

      <Accordion title="Care plan emails not sending">
        <P>Care plan emails are delayed by design — they send 20 minutes after the nurse creates the plan. If it has been more than 30 minutes and nothing arrived:</P>
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Supabase → automation_log → filter automation_type = care_plan_email → check status and error</Li>
          <Li>Most common cause: the patient has no email address on their profile</Li>
        </ol>
        <Note type="info">The SMS/WhatsApp notification fires immediately. The email fires 20 minutes later. This gap is normal.</Note>
      </Accordion>

      <Accordion title="Appointment reminders not sending">
        <ul className="list-disc pl-5 space-y-1.5">
          <Li>24h reminder fires 24–25 hours before the appointment. 2h reminder fires 2–3 hours before. Check the appointment is in the future.</Li>
          <Li>Appointment reminders are email only — if the patient has no email, no reminder is sent.</Li>
          <Li>Supabase → automation_log → filter automation_type = appointment_reminder_24h or appointment_reminder_2h → check if already sent</Li>
        </ul>
      </Accordion>

      <Accordion title="Feedback or Appointments section missing for a hospital">
        <P>Super admin → hospital detail → Modules section → toggle Feedback or Appointments back on.</P>
      </Accordion>

      <Accordion title="CSV patient import did not work">
        <ul className="list-disc pl-5 space-y-1.5">
          <Li>The import page shows a results summary after uploading — it says how many were imported and how many skipped. Skipped = duplicates (same email already exists).</Li>
          <Li>The CSV must have at least a First Name and Last Name column. Other columns are optional.</Li>
          <Li>Supabase → patients table → filter hospital_id = their hospital code → check if rows are there</Li>
        </ul>
      </Accordion>

      <Accordion title="Hospital needs their feedback form link">
        <P>Super admin → hospital detail page → find their Feedback Slug. The full URL is:</P>
        <Code>[era-patient URL]/feedback/h/[their-slug]</Code>
      </Accordion>

      <Accordion title="Wellness newsletter sent but patients not receiving it">
        <ul className="list-disc pl-5 space-y-1.5">
          <Li>Only patients with an email address receive newsletters.</Li>
          <Li>Only patients in: Active, In Care, Post Treatment, or Dormant stages get them.</Li>
          <Li>Supabase → automation_log → filter automation_type = wellness_newsletter → check for failed rows</Li>
        </ul>
      </Accordion>

      <SectionTitle icon={Database} text="Part 3 — Supabase (Your Database)" />

      <Accordion title="Key Tables Explained" defaultOpen>
        <Table
          headers={["Table", "What it contains"]}
          rows={[
            ["hospitals", "All registered hospitals — name, username, password, hospital_code, active status, subscription"],
            ["hospital_settings", "Each hospital's config — sender name, tone, language, Termii ID, notification channel"],
            ["hospital_modules", "Which features are enabled per hospital"],
            ["hospital_staff", "Receptionist and nurse login credentials"],
            ["patients", "All patient records across all hospitals"],
            ["care_plans", "All care plans (treatment schedules)"],
            ["appointments", "All appointments"],
            ["queue_entries", "Current and past queue entries"],
            ["automation_log", "Every automated message ever attempted — status, errors, previews"],
            ["support_tickets", "Support messages from hospitals to you"],
            ["feedback_submissions", "Patient feedback responses"],
          ]}
        />
        <Note type="info">Each patient, care plan, queue entry, and appointment is tagged with that hospital's unique ID. Hospitals can never see each other's data.</Note>
      </Accordion>

      <Accordion title="Useful SQL Queries (copy-paste into Supabase SQL Editor)">
        <H3>All failed automations in the last 7 days</H3>
        <Code>{`SELECT hospital_id, automation_type, error_message, created_at
FROM automation_log
WHERE status = 'failed'
AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;`}</Code>

        <H3>All open support tickets</H3>
        <Code>{`SELECT * FROM support_tickets WHERE status = 'open' ORDER BY created_at DESC;`}</Code>

        <H3>Find a patient by email</H3>
        <Code>{`SELECT * FROM patients WHERE email = 'patient@email.com';`}</Code>

        <H3>Check if an automation already ran for a patient</H3>
        <Code>{`SELECT * FROM automation_log
WHERE patient_id = 123
ORDER BY created_at DESC;`}</Code>

        <H3>How many patients does each hospital have?</H3>
        <Code>{`SELECT h.name, COUNT(p.id) as patient_count
FROM hospitals h
LEFT JOIN patients p ON p.hospital_id = h.hospital_code
GROUP BY h.name
ORDER BY patient_count DESC;`}</Code>
      </Accordion>

      <SectionTitle icon={Key} text="Part 4 — Environment Variables (Railway)" />
      <P>These are settings stored securely in Railway. To view or change them: Railway → api-server service → Variables tab.</P>

      <Accordion title="All Variables and What They Do" defaultOpen>
        <Table
          headers={["Variable", "What it is", "Where to get it"]}
          rows={[
            ["SUPABASE_URL", "Your database address", "Supabase → Project Settings → API"],
            ["SUPABASE_SERVICE_KEY", "Secret key to access database", "Supabase → Project Settings → API"],
            ["SUPER_ADMIN_USERNAME", "Your login username", "You set this (e.g. era_admin)"],
            ["SUPER_ADMIN_PASSWORD", "Your login password", "You set this — make it strong"],
            ["SUPER_ADMIN_RECOVERY_KEY", "Backup key if you get locked out", "You set this — keep it safe offline"],
            ["SUPER_ADMIN_ALERT_EMAIL", "Email for system alerts (low balance, etc.)", "Your email address"],
            ["PLATFORM_FROM_EMAIL", "The 'from' address on all automated emails", "Must match verified Resend/SES address"],
            ["RESEND_API_KEY", "Resend account key", "resend.com → API Keys"],
            ["EMAIL_PROVIDER", "Force ses or resend (leave blank for auto)", "Leave blank unless forcing"],
            ["AWS_ACCESS_KEY_ID", "AWS key for SES email", "AWS Console → IAM"],
            ["AWS_SECRET_ACCESS_KEY", "AWS secret for SES", "AWS Console → IAM"],
            ["AWS_REGION", "Your AWS region e.g. eu-west-1", "Must match where you set up SES"],
            ["TERMII_API_KEY", "Termii API key for SMS/WhatsApp", "termii.com → API"],
            ["TERMII_SENDER_ID", "Default sender ID for Termii messages", "Your approved Termii sender ID"],
            ["AFRICAS_TALKING_API_KEY", "Africa's Talking key (optional)", "africastalking.com"],
            ["AFRICAS_TALKING_USERNAME", "Africa's Talking username (optional)", "africastalking.com"],
            ["ENABLE_SCHEDULER", "Must be true for automated jobs to run", "Set to: true"],
            ["SUPPORT_EMAIL", "Your email for support ticket notifications", "Your email address"],
            ["OPENAI_API_KEY", "OpenAI key for AI messages", "platform.openai.com"],
            ["ANTHROPIC_API_KEY", "Claude key for AI messages", "console.anthropic.com"],
            ["APP_BASE_URL", "The public URL of the hospital app", "Your era-patient Railway URL"],
          ]}
        />
        <Note type="warning">After changing any variable in Railway, the server restarts automatically within 30 seconds. No manual action needed.</Note>
      </Accordion>

      <SectionTitle icon={Server} text="Part 5 — Railway (Your Servers)" />

      <Accordion title="The Three Services">
        <Table
          headers={["Service", "What it is"]}
          rows={[
            ["api-server", "The backend engine — all logic, the scheduler, emails, SMS"],
            ["era-patient", "The hospital staff app (what hospitals use)"],
            ["era-super-admin", "This dashboard (what you use)"],
          ]}
        />
      </Accordion>

      <Accordion title="Restarting a Service">
        <P>If something seems broken and you cannot figure out why, a restart often fixes it:</P>
        <ol className="list-decimal pl-5 space-y-1.5">
          <Li>Railway → click the service (e.g. api-server)</Li>
          <Li>Deployments tab → click the latest deployment → Restart</Li>
          <Li>The service restarts within 30–60 seconds</Li>
        </ol>
      </Accordion>

      <Accordion title="Reading Logs">
        <P>Railway → click api-server → Logs tab. This shows everything happening on the server in real time.</P>
        <ul className="list-disc pl-5 space-y-1.5">
          <Li>Search for <strong>[scheduler]</strong> to see automation activity</Li>
          <Li>Search for <strong>[email]</strong> to see email activity</Li>
          <Li>Red lines = errors — copy the exact text to diagnose the problem</Li>
          <Li>Lines with HTTP 4xx or 5xx mean a request failed</Li>
        </ul>
        <Note type="tip">If automations are not running, search logs for "scheduler". You should see "[scheduler] Scheduler started" when the server boots. If you see "Scheduler disabled", add ENABLE_SCHEDULER=true to Variables.</Note>
      </Accordion>

      <SectionTitle icon={AlertTriangle} text="Part 6 — Common Error Messages" color="text-amber-400" />

      <Accordion title="Error reference table" defaultOpen>
        <Table
          headers={["Error", "Plain meaning", "How to fix"]}
          rows={[
            ["RESEND_API_KEY is not set", "Email sending is broken", "Add the key in Railway Variables"],
            ["TERMII_API_KEY not set", "SMS/WhatsApp is broken", "Add the key in Railway Variables"],
            ["Unauthorized", "Invalid or missing login token", "User logs out and back in"],
            ["Hospital not found", "Hospital ID does not exist", "Usually stale login — hospital logs out and back in"],
            ["Insufficient balance", "Termii is out of credit", "Top up at termii.com"],
            ["Invalid address", "Patient's email is not real", "Hospital corrects the email in patient's profile"],
            ["Hospital is suspended", "Account is inactive", "Re-activate in super admin if appropriate"],
            ["Subscription expired", "Hospital's subscription lapsed", "Renew their status in super admin"],
            ["Invalid import data", "CSV format issue", "Hospital checks CSV has First Name and Last Name columns"],
            ["Scheduler disabled", "Automated jobs are off", "Set ENABLE_SCHEDULER=true in Railway Variables"],
          ]}
        />
      </Accordion>

      <SectionTitle icon={RefreshCw} text="Part 7 — Monthly Maintenance Checklist" />
      <div className="space-y-2">
        {[
          ["Termii balance", "Log into termii.com and top up if low. You also get daily email alerts if it drops below ₦50."],
          ["Resend email usage", "Log into resend.com — check monthly send count. If near 3,000, the system auto-switches to SES (make sure AWS keys are set)."],
          ["OpenAI/Anthropic usage", "Check API dashboards for unexpected spikes."],
          ["Supabase storage", "Check database is not running out of space. The automation_log table grows fastest."],
          ["Subscription statuses", "Review hospitals with trial or expiring subscriptions and follow up."],
          ["Support inbox", "Check the Support section in this dashboard for any unread tickets."],
          ["Platform health check", "Analytics → make sure all services show green."],
        ].map(([title, desc]) => (
          <div key={title} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card/40">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle icon={Activity} text="Part 8 — Who Sees What" />
      <Table
        headers={["Role", "Access"]}
        rows={[
          ["Hospital Admin", "Dashboard, Patients, Patient history, Appointments, Pipeline, Activity log, Feedback, Wellness, Settings, Call Tasks, Import"],
          ["Receptionist", "Queue Management, Call Tasks, Appointments (if enabled), New Patient form"],
          ["Nurse", "Medication View (care plans with daily schedules), Call Tasks"],
          ["You (Super Admin)", "Analytics, Hospitals, Hospital details, Usage stats, Automation tests, Support inbox, Settings, Deploy"],
        ]}
      />

      <SectionTitle icon={HelpCircle} text="Part 9 — If You Are Completely Stuck" />
      <ol className="list-decimal pl-5 space-y-2.5">
        <Li><strong>Check Railway logs first</strong> — 90% of production issues show up as red error lines in the api-server logs. Copy the exact error text.</Li>
        <Li><strong>Check Supabase automation_log</strong> — For automation issues, this table shows exactly which message failed and why.</Li>
        <Li><strong>Restart the service</strong> — Railway → api-server → restart. Sometimes this is all it takes.</Li>
        <Li><strong>Bring the error to Claude Code</strong> — Open Claude Code, describe the problem, and paste the exact error message from the logs. The system is well-documented enough that Claude can usually pinpoint the issue from the error text alone.</Li>
        <Li><strong>Check this manual again</strong> — Most common issues are covered in Part 2 (Hospital Support Guide) and Part 6 (Error Messages).</Li>
      </ol>

    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [tab, setTab] = useState<"about" | "manual">("about");

  return (
    <Layout breadcrumb={[{ label: "Documentation" }]}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Documentation</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you need to run and support the platform — no tech background required.</p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border mb-8 w-fit">
          <Tab label="About the System" active={tab === "about"} onClick={() => setTab("about")} />
          <Tab label="Operations Manual" active={tab === "manual"} onClick={() => setTab("manual")} />
        </div>

        <div>
          {tab === "about" ? <AboutTab /> : <ManualTab />}
        </div>
      </div>
    </Layout>
  );
}
