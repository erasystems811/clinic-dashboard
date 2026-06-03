# Era Systems — What This System Is

## The Big Picture

Era Systems is a **clinic management platform** you built and own. It is a SaaS product — meaning many different hospitals and clinics can subscribe and use it, each seeing only their own data. You are the platform owner (super-admin). Every hospital is a tenant on your platform.

The system does three main things:
1. Helps hospital staff manage patients, queues, appointments, and care plans
2. Automatically sends emails and messages to patients on behalf of hospitals (reminders, check-ins, feedback requests, birthday emails, etc.)
3. Gives you (the platform owner) full visibility and control over all hospitals from a central dashboard

---

## The Three Portals

### 1. The Hospital App (era-patient)
This is what hospital staff use every day. It has three login roles:

| Role | What they see | What they do |
|---|---|---|
| **Admin** | Everything | Full access — manages patients, pipeline, settings, imports, analytics, care plans |
| **Receptionist** | Queue + Appointments + Call Tasks | Checks patients in, manages the queue, books appointments, sends messages |
| **Nurse** | Medication View + Call Tasks | Views active care plans with daily medication/hospital schedules, flags patients who need follow-up |

Each hospital has one login page but the admin sets up separate usernames/passwords for each role. All three land on the same URL but see different screens based on who logged in.

### 2. The Super Admin Dashboard (era-super-admin)
This is your private control panel. Only you have access. From here you can:
- Create new hospital accounts
- Suspend or activate hospitals
- View each hospital's settings and usage
- See the Support inbox (hospitals contact you here)
- Check platform health (are emails and SMS working?)
- Deploy new versions to production
- View automation logs and retry failed sends
- Run automation tests

### 3. The Patient Feedback Form
A public-facing form that patients fill in after their visit. Each hospital has a unique link (their feedback slug). Patients tap the link from an email, rate their experience, and submit. Hospitals see the results in their Feedback section.

---

## The Features, Explained

### Patient Management
Hospital admins create patient records with name, phone, email, date of birth, and other details. Each patient has a **stage** that tracks where they are in their care journey:

```
Active → In Care → Post Treatment → Dormant
```

- **Active** — newly registered, not yet in treatment
- **In Care** — currently receiving treatment (has an active care plan)
- **Post Treatment** — treatment ended, receiving follow-up check-ins
- **Dormant** — has not engaged in 90+ days

Patients can also be imported in bulk via a CSV file (spreadsheet).

### The Pipeline
A visual board showing all patients grouped by stage. Admins use this to see at a glance who needs attention, who has finished treatment, and who has gone quiet.

### Queue Management (Receptionist)
When patients arrive at the clinic, the receptionist adds them to the queue. The system:
- Sends the patient a WhatsApp/SMS saying they are checked in and their queue number
- Sends another message when they are next in line
- Sends a final message when it is their turn
- Detects if a patient has been waiting too long and sends an apology message
- Detects no-shows (appointments missed) and marks them automatically

### Appointments
Admins and receptionists can book appointments. The system automatically:
- Sends a confirmation email when an appointment is booked
- Sends a reminder email 24 hours before
- Sends a reminder email 2 hours before
- Detects if the patient did not show up and sends a follow-up email

### Care Plans
Nurses create care plans for patients. A care plan contains the treatment schedule — which medications to take at which times of day, and which clinic visits are required. The system:
- Sends the patient an email with their full care plan details (20 minutes after the nurse creates it, giving them time to make last-minute edits)
- Sends a WhatsApp/SMS confirming the plan was set up
- Sends daily reminder emails at the right time slots (morning, afternoon, evening, night) based on the patient's schedule
- Sends reminder emails the day before each scheduled clinic visit
- If a beneficiary/family contact is listed, sends them reminders too

### Post-Treatment Check-ins
After a patient finishes treatment, the system automatically sends three caring emails:
- Day 1 after treatment ends: "We hope you are resting well today"
- Day 4: "Checking in — how are you feeling?"
- Day 7: "One week on — we are proud of your progress"

### Post-Care Email
For patients who have been in the Dormant stage, the system sends a warm re-engagement email after 30 days.

### Feedback Collection
After a patient's appointment or visit, the system sends them a feedback request email the next day at noon. They can rate their experience (overall, wait time, staff friendliness, quality of care) and leave a comment. Hospitals see all feedback in their dashboard.

### Wellness Newsletter
Admins can send a weekly wellness email to all their patients (Active, In Care, Post Treatment, and Dormant stages). The system uses AI to generate the newsletter content based on a health topic chosen by the admin. Hospitals can also add YouTube and TikTok video links.

### Call Tasks
When a nurse flags a patient from the Medication View (e.g., "patient missed medication today"), it creates a Call Task. The system uses AI to draft a message for that specific situation. The receptionist reviews the draft, can edit it, and sends it as an email. Alternatively, they can write a manual email directly.

### Activity Log
A full history of every automated message sent by that hospital — who it went to, what type, whether it succeeded or failed.

### Settings (Hospital)
Admins configure:
- Their sender name (what name appears in emails)
- Their notification channel (WhatsApp or SMS for queue/care plan messages)
- Their phone number (included at the bottom of emails)
- Communication language (default: English)
- Tone (Warm, Professional, Empathetic, etc.)
- Pipeline thresholds (how many days before a patient becomes Dormant, etc.)
- Departments
- Modules (can disable appointments, feedback, WhatsApp/SMS, wellness newsletter)

### Patient Import
Admins can upload a CSV spreadsheet of patients. The system maps the columns to the right fields and imports them all at once. Duplicates (same email or patient ID) are automatically skipped.

---

## How the Technology Works (Plain Language)

You do not need to understand this deeply, but it helps to know the names of the pieces when you are troubleshooting.

### The Backend (API Server)
This is the "engine" of the system. It runs on a server on **Railway** and handles all the logic — storing data, sending emails, running scheduled jobs. When any of the apps (hospital app, super admin) need to do something, they send a request to this server.

### The Database (Supabase)
This is where all the data is stored — hospitals, patients, care plans, appointments, messages, automation logs, etc. It is a cloud PostgreSQL database hosted by Supabase. You can log in at **supabase.com** and view or edit any data directly from the browser using the Table Editor or SQL Editor.

### The Frontend Apps
The hospital app and super admin dashboard are web apps that run in the browser. They are also hosted on Railway. They communicate with the Backend to get and save data.

### The Scheduler
A piece of code inside the Backend that runs automatically on a timer. It is responsible for all scheduled automations:

| Schedule | What runs |
|---|---|
| Every 15 minutes | Appointment reminders, no-show detection, no-show follow-up emails, long queue wait alerts |
| Every hour | Care plan reminders (medication + visit reminders) |
| Every 5 minutes | Delayed care plan summary emails (sent 20 min after nurse creates plan) |
| Daily at 7 AM (WAT) | Stage transitions, post-treatment check-ins, departmental follow-ups, dormant detection, birthday emails |
| Daily at 9 AM (WAT) | Termii balance alert (warns you if SMS credit is low) |
| Daily at noon (WAT) | Feedback request emails |
| Daily at 6 PM (WAT) | Post-care wellness emails |
| Daily at 11 PM (WAT) | Clear no-show flags from today |
| Every 6 hours | Subscription expiry check |

### Email (Resend + AWS SES)
All emails are sent through either **Resend** (easy setup, free up to 3,000/month) or **Amazon SES** (cheaper at high volume, $0.10 per 1,000 emails). The system switches automatically from Resend to SES when you approach the monthly free limit. You need both configured for the auto-switch to work.

### SMS & WhatsApp (Termii + Africa's Talking)
Queue messages and care plan notifications are sent as SMS or WhatsApp. **Termii** is the primary provider and handles both WhatsApp and SMS. **Africa's Talking** is an optional second SMS provider — if configured, it handles SMS and Termii handles WhatsApp. If Africa's Talking is not configured, Termii handles everything.

### AI (OpenAI + Claude)
Some messages are written by AI rather than from a template:
- Care plan summary emails (Claude)
- Care visit reminder emails (OpenAI)
- Birthday emails (Claude)
- Call task draft messages (OpenAI)
- In-care daily reminders (OpenAI)
- Wellness newsletter (Claude)
- Departmental follow-up emails (Claude)

---

## Hospital Suspension Behaviour

When you suspend a hospital:
- Their staff can still log in (tokens are not invalidated immediately)
- All automations still run internally and create log entries — but **no emails or messages are actually sent**
- When you re-activate them, the system picks up exactly where it left off — it will NOT flood patients with emails that were skipped during suspension

This is intentional. It prevents a situation where re-activating a hospital causes a wave of old emails to suddenly hit all their patients.

---

## Data Isolation (Hospital Privacy)

Each hospital can only ever see their own data. This is enforced in two ways:
1. Every hospital has a unique secret token. Every API request from hospital staff includes this token. The backend rejects anything with a missing or invalid token.
2. Every patient, care plan, queue entry, and appointment in the database is tagged with that hospital's unique ID. Even if someone guessed another hospital's ID, they could not see that hospital's data because they do not have the right token.

---

## Key Services You Pay For / Need Accounts With

| Service | What it does | Where to manage |
|---|---|---|
| **Railway** | Hosts all your servers (backend + 2 frontends) | railway.app |
| **Supabase** | Hosts your database | supabase.com |
| **Resend** | Sends emails (free tier, auto-fallback) | resend.com |
| **AWS SES** | Sends emails at high volume (cheaper) | aws.amazon.com → SES |
| **Termii** | Sends WhatsApp and SMS to patients | termii.com |
| **Africa's Talking** | Optional second SMS provider | africastalking.com |
| **OpenAI** | AI for some message generation | platform.openai.com |
| **Anthropic (Claude)** | AI for care plan emails, newsletters, etc. | console.anthropic.com |
| **Sentry** | Error monitoring (optional) | sentry.io |
