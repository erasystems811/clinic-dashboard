# Era Systems — Operations Manual

This manual covers everything you need to run the platform day-to-day, fix common problems, and help hospitals when they contact support. No technical background required.

---

## PART 1: Accessing the System

### Your Super Admin Dashboard
- **URL:** Your era-super-admin Railway deployment URL
- **Username:** Set via `SUPER_ADMIN_USERNAME` env var (default: `era_admin`)
- **Password:** Set via `SUPER_ADMIN_PASSWORD` env var

### The Hospital App
- **URL:** Your era-patient Railway deployment URL
- Hospitals log in with the username and password you assigned them when you created their account

### Your Database
- Go to **supabase.com** → Sign in → Open your project
- **Table Editor:** Browse and edit data visually (like a spreadsheet)
- **SQL Editor:** Run queries (use the examples in this manual)

### Railway (Your Server)
- Go to **railway.app** → Sign in → Open your project
- You will see three services: `api-server`, `era-patient`, `era-super-admin`

---

## PART 2: Super Admin — Day to Day Operations

### Creating a New Hospital Account

1. Log into your super admin dashboard
2. Click **Hospitals** in the sidebar
3. Click **New Hospital** (top right)
4. Fill in:
   - **Hospital Name** — their full clinic/hospital name
   - **Username** — a short lowercase identifier (e.g., `lagosclinic`). This is what they type to log in. Cannot be changed later.
   - **Subscription Status** — set to `active` or `trial`
5. Click Create. The system generates a random password automatically.
6. Go to the hospital's detail page to see:
   - Their generated password
   - Their receptionist and nurse staff credentials
   - Their feedback form link
7. Send these details to the hospital admin.

**What the hospital gets:**
- Admin login: their username + generated password
- Receptionist login: auto-generated username + password
- Nurse login: auto-generated username + password
- Feedback URL for patient forms

### Viewing a Hospital's Details
Click any hospital name in the Hospitals list. You will see:
- Their subscription status and expiry date
- Patient count
- Contact email and phone
- Their settings and modules
- Staff credentials
- Option to regenerate their password

### Resetting a Hospital's Password
1. Open the hospital's detail page
2. Click **Regenerate Password**
3. Confirm — a new password is created and shown once
4. Send the new password to the hospital admin

### Suspending a Hospital
1. Open the hospital's detail page
2. Toggle **Active** to off (or change subscription status to `inactive`)
3. Their staff can still log in but no emails or messages will actually be sent to patients
4. When you re-activate them, everything resumes normally — no catch-up flood

### Enabling/Disabling Features for a Hospital
Each hospital can have features turned on or off:
1. Open the hospital's detail page
2. Go to the **Modules** section
3. Toggle:
   - **Appointments** — show/hide the appointments section
   - **Feedback** — show/hide the feedback section
   - **Wellness Newsletter** — show/hide the wellness section
   - **WhatsApp** — enable/disable WhatsApp messaging
   - **Messages** — enable/disable the messaging tab

### Viewing the Support Inbox
When a hospital sends you a support message through the floating help button in their app:
1. Click **Support** in your sidebar
2. You see all tickets — filter by Open / Closed / All
3. Click any ticket to expand it and read the full message
4. Type your reply in the box and click **Send Reply**
5. The system emails your reply to the hospital's contact email (if they have one set)
6. The ticket is automatically marked as Closed

> **Tip:** Add your email as `SUPPORT_EMAIL` in Railway env vars so you also get an email notification the moment a hospital submits a ticket.

### Checking Platform Health
Click **Analytics** → scroll to the Health section, or check the indicator in the top bar.

This shows you whether each service is working:
- **Email** — is Resend/SES configured and sending?
- **SMS (Termii)** — is Termii configured, is the balance OK?
- **WhatsApp (Termii)** — same Termii account, but checks WhatsApp specifically
- **Database** — is Supabase reachable?

If any are red, that service has a problem. See Part 5 for how to fix.

### Deploying a New Version
When your developer pushes code changes and you are ready to go live:
1. Click **Deploy** in the sidebar of the super admin dashboard
2. Click **Deploy** again in the confirmation popup
3. Wait about 60–90 seconds. The button will turn green showing "Deployed"

Alternatively, in Railway, click on any service → **Deploy** → Railway redeploys from the latest code.

### Running Automation Tests
Click **Automation Tests** in the sidebar. You can:
- Send a test email to any address to confirm email delivery is working
- Send a test SMS to any phone number to confirm SMS delivery is working

---

## PART 3: Helping Hospitals with Support Issues

This section covers every common problem a hospital will report to you and exactly how to fix it.

---

### "We can't log in"

**Check 1 — Are they using the right URL?**
Make sure they are going to the correct era-patient URL. They should bookmark it.

**Check 2 — Wrong username or password?**
1. Go to super admin → find their hospital → open detail page
2. Check their current password (shown in the credentials section)
3. Send them the correct credentials

**Check 3 — Is the hospital suspended?**
1. Go to super admin → find their hospital
2. Check if **Active** is toggled off or subscription status is `inactive`
3. If suspended, re-activate and let them try again

**Check 4 — Staff login (receptionist/nurse) not working**
1. Open hospital detail page
2. Scroll to **Staff Credentials**
3. Confirm the username and password shown there
4. If needed, regenerate staff credentials

---

### "A staff member needs a new password"

**Admin password:**
1. Super admin → hospital detail → Regenerate Password
2. Send new password to the admin

**Receptionist or nurse password:**
1. Super admin → hospital detail → Settings tab
2. Edit the receptionist or nurse credentials directly
3. OR: in Supabase, Table Editor → `hospital_staff` table → find the row → update `plain_password` and the hashed version

> For now, the simplest fix is to regenerate all credentials from the hospital detail page (it resets all staff credentials at once).

---

### "Emails are not being received by patients"

Work through this checklist:

**Step 1 — Check the automation log**
1. Super admin → click the hospital → there is no direct log per hospital in the UI, so go to Supabase
2. Table Editor → `automation_log` table
3. Filter: `hospital_id = [their ID]` and `status = failed`
4. Look at the `error_message` column — this tells you exactly what went wrong

**Step 2 — Check platform health**
Super admin → Analytics → Health section. If Email shows red:
- Check that `RESEND_API_KEY` is set in Railway env vars
- Check that `PLATFORM_FROM_EMAIL` is set (e.g., `Era Systems <noreply@yourdomain.com>`)
- Check that the from address is verified in your Resend account

**Step 3 — Is the patient's email correct?**
Ask the hospital to double check the email address they have on file for that patient.

**Step 4 — Check spam folder**
Ask the patient to check their spam/junk folder. Emails sometimes land there.

**Step 5 — Is the email address real?**
If Resend shows "bounced" or "invalid address" in the error, the patient's email address is wrong.

---

### "SMS/WhatsApp messages are not sending to patients"

**Step 1 — Check the automation log (Supabase)**
`automation_log` table → filter `status = failed` for that hospital → check `error_message`

**Step 2 — Check Termii balance**
1. Super admin → Analytics → look at SMS/WhatsApp health check — it shows the Termii balance
2. If balance is low (below ₦50), top up at **termii.com**
3. You will also get an email alert every morning at 9am if balance is low

**Step 3 — Is the patient's phone number in the right format?**
Termii requires international format. Nigerian numbers must start with `234` not `0`.
- Wrong: `08012345678`
- Correct: `2348012345678`

If a hospital says SMS is not reaching a specific patient, ask them to check the phone number format.

**Step 4 — Is the hospital's notification channel set?**
1. Super admin → hospital detail → Settings
2. Check **Notification Channel** — should be `whatsapp` or `sms`
3. Check **Termii Sender ID** — this must match a registered sender on their Termii account

**Step 5 — WhatsApp specifically**
WhatsApp via Termii requires pre-approved message templates. If a hospital says WhatsApp works sometimes but not others, the message content may have changed and no longer matches the approved template.

---

### "Automated emails are not going out at all for our hospital"

**Check 1 — Is the scheduler running?**
In Railway → api-server service → Logs. Look for lines like:
```
[scheduler] Post-treatment checkins...
[scheduler] Appointment reminders...
```
If you see these, the scheduler is running. If you see nothing, check that `ENABLE_SCHEDULER=true` is set in Railway env vars for the api-server service.

**Check 2 — Does the hospital have hospital_settings configured?**
In Supabase → `hospital_settings` table → filter by `hospital_id` = their ID. If no row exists, the hospital needs to complete their settings in their app (Settings page → save at least once). Creating a settings row can be done by the hospital admin — they just need to go to Settings and press Save.

**Check 3 — Is their subscription active?**
A hospital whose subscription has expired will be auto-suspended. Check their status in your dashboard.

---

### "Our care plan emails are not sending"

Care plan emails are delayed intentionally — they send 20 minutes after the nurse creates the plan, to give them time to make edits.

**If it has been more than 30 minutes and still nothing:**
1. Supabase → `automation_log` → filter `automation_type = care_plan_email` and that hospital's ID
2. Check `status` — if `failed`, check `error_message`
3. Most common cause: patient has no email address on their profile

**If the patient received the SMS but not the email:**
The SMS is sent immediately (no delay). The email is sent 20 minutes later. This is normal.

---

### "Appointment reminders are not sending"

**Check 1 — Does the appointment have a date/time in the future?**
Reminders only go out for appointments that are in the future. The 24-hour reminder fires 24–25 hours before the appointment. The 2-hour reminder fires 2–3 hours before.

**Check 2 — Does the patient have an email address?**
Appointment reminders are email only. If the patient has no email, no reminder is sent.

**Check 3 — Has the reminder already sent?**
Supabase → `automation_log` → filter `automation_type = appointment_reminder_24h` or `appointment_reminder_2h` → check if `status = sent` for this patient already

---

### "We can't see the Feedback section"

1. Super admin → hospital detail → Modules section
2. Make sure **Feedback** is enabled (toggled on)

---

### "We can't see Appointments"

Same as above — Modules → toggle **Appointments** on

---

### "We imported patients from a CSV but they did not show up"

**Check 1 — Did the import show an error message?**
The import page shows a results summary after uploading — it says how many were imported and how many were skipped. Skipped patients are usually duplicates (same email already exists).

**Check 2 — Are the patients visible in Supabase?**
Supabase → `patients` table → filter `hospital_id = [their hospital code]` → see if the rows are there

**Check 3 — CSV format issues**
The CSV must have at least a First Name and Last Name column. The system allows you to map which CSV column goes to which field. If the mapping was wrong, no rows import.

---

### "We forgot our feedback form link"

1. Super admin → hospital detail page
2. Look for **Feedback Slug** in their details
3. The full URL is: `[era-patient URL]/feedback/h/[their-slug]`

---

### "The wellness newsletter sent but patients are not receiving it"

**Check 1 — Do the patients have emails?**
Only patients with an email address get newsletters.

**Check 2 — Are the patients in the right stage?**
Newsletters only go to patients in: Active, In Care, Post Treatment, Dormant. Patients in other stages (if any custom ones exist) do not receive them.

**Check 3 — Automation log**
Supabase → `automation_log` → filter `automation_type = wellness_newsletter` and that hospital → look for `failed` rows with error messages

---

## PART 4: Supabase (Your Database)

### Logging In
Go to **supabase.com** → Sign in → Open your project

### Key Tables You Need to Know

| Table | What it contains |
|---|---|
| `hospitals` | All registered hospitals — name, username, password, hospital_code, active status, subscription |
| `hospital_settings` | Each hospital's configuration — sender name, tone, language, Termii ID, notification channel |
| `hospital_modules` | Which features are enabled per hospital |
| `hospital_staff` | Receptionist and nurse login credentials per hospital |
| `patients` | All patient records across all hospitals (each tagged with hospital_id) |
| `care_plans` | All care plans (treatment schedules) |
| `appointments` | All appointments |
| `queue_entries` | Current and past queue entries |
| `automation_log` | Every automated message ever attempted — status, errors, previews |
| `support_tickets` | Support messages from hospitals to you |
| `feedback_submissions` | Patient feedback responses |
| `wellness_newsletters` | Generated newsletter content |

### How to Look Up a Hospital's ID

In Supabase → Table Editor → `hospitals` table → find by name or username → note the `id` (integer) and `hospital_code` (UUID string). Some tables use the integer ID, some use the UUID — use whichever matches the column name.

### How to Reset a Patient's Data (For Testing)

Super admin dashboard → bottom of Analytics page → **Reset Test Data** (only for test hospitals, do not do this on real hospitals — it deletes all their patients).

### Useful SQL Queries (Copy-Paste Into Supabase SQL Editor)

**See all failed automations in the last 7 days:**
```sql
SELECT hospital_id, automation_type, error_message, created_at
FROM automation_log
WHERE status = 'failed'
AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

**See all open support tickets:**
```sql
SELECT * FROM support_tickets WHERE status = 'open' ORDER BY created_at DESC;
```

**Find a patient by email:**
```sql
SELECT * FROM patients WHERE email = 'patient@email.com';
```

**Check if an automation already ran for a patient:**
```sql
SELECT * FROM automation_log
WHERE patient_id = 123
ORDER BY created_at DESC;
```

**See how many patients a hospital has:**
```sql
SELECT h.name, COUNT(p.id) as patient_count
FROM hospitals h
LEFT JOIN patients p ON p.hospital_id = h.hospital_code
GROUP BY h.name
ORDER BY patient_count DESC;
```

---

## PART 5: Environment Variables (Railway)

These are settings stored securely in Railway that control how the system behaves. To view or change them:
1. Go to Railway → click on the `api-server` service → **Variables** tab

### The Variables and What They Do

| Variable | What it is | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Your database address | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Secret key to access database | Supabase → Project Settings → API |
| `SUPER_ADMIN_USERNAME` | Your login username for the super admin | You set this — e.g., `era_admin` |
| `SUPER_ADMIN_PASSWORD` | Your login password for the super admin | You set this — make it strong |
| `SUPER_ADMIN_RECOVERY_KEY` | A backup key to reset your password if locked out | You set this — keep it safe offline |
| `SUPER_ADMIN_ALERT_EMAIL` | Email address that gets system alerts (Termii balance, etc.) | Your email |
| `PLATFORM_FROM_EMAIL` | The "from" address on all automated emails | Must match a verified Resend/SES address e.g. `Era Systems <noreply@yourdomain.com>` |
| `RESEND_API_KEY` | Resend account API key | resend.com → API Keys |
| `EMAIL_PROVIDER` | Force email to use `ses` or `resend` (leave blank for auto) | Leave blank unless forcing |
| `AWS_ACCESS_KEY_ID` | AWS key for SES email | AWS Console → IAM |
| `AWS_SECRET_ACCESS_KEY` | AWS secret for SES email | AWS Console → IAM |
| `AWS_REGION` | Your AWS region e.g. `eu-west-1` | Must match where you set up SES |
| `TERMII_API_KEY` | Your Termii API key for SMS/WhatsApp | termii.com → API |
| `TERMII_SENDER_ID` | Default sender ID for Termii messages | Your approved Termii sender ID |
| `AFRICAS_TALKING_API_KEY` | Africa's Talking API key (optional) | africastalking.com |
| `AFRICAS_TALKING_USERNAME` | Africa's Talking username (optional) | africastalking.com |
| `AFRICAS_TALKING_SENDER_ID` | Africa's Talking sender ID (optional) | Your AT sender ID |
| `ENABLE_SCHEDULER` | Must be `true` for automated jobs to run | Set to `true` in production |
| `SUPPORT_EMAIL` | Your email to receive support ticket notifications | Your email |
| `OPENAI_API_KEY` | OpenAI API key for AI message generation | platform.openai.com |
| `ANTHROPIC_API_KEY` | Claude API key for AI message generation | console.anthropic.com |
| `APP_BASE_URL` | The public URL of the hospital app | Your era-patient Railway URL |
| `SENTRY_DSN` | Sentry error tracking (optional) | sentry.io |

### How to Change a Variable
1. Railway → api-server → Variables
2. Find the variable → click to edit → save
3. Railway will automatically restart the server with the new value

---

## PART 6: Railway — Managing Your Servers

### The Three Services

| Service | What it is |
|---|---|
| `api-server` | The backend — handles all logic, scheduler, emails, SMS |
| `era-patient` | The hospital staff app (frontend) |
| `era-super-admin` | Your admin dashboard (frontend) |

### Restarting a Service
If something seems frozen or broken and you cannot figure out why:
1. Railway → click the service → **Deployments** tab → click the latest deployment → **Restart**
2. The service will restart within 30–60 seconds

### Reading Logs
Logs show you everything that happened on the server in real time.
1. Railway → click `api-server` → **Logs** tab
2. Look for lines with `[scheduler]` to see scheduler activity
3. Look for lines with `[email]` to see email activity
4. Error lines are highlighted in red
5. You can search the logs with keywords

**What to look for when something breaks:**
- `Error:` lines — these describe what failed
- `HTTP 4xx` or `HTTP 5xx` lines — these mean a request failed
- `TERMII_API_KEY not set` — a required variable is missing

### Checking if the Scheduler is Running
In api-server logs, search for `scheduler`. You should see entries like:
```
[scheduler] Scheduler started — queue messages via WhatsApp/SMS...
```
appearing when the server starts. And then job-specific lines every time a job runs.

If you see `Scheduler disabled — set ENABLE_SCHEDULER=true`, go to Variables and add `ENABLE_SCHEDULER=true`.

---

## PART 7: Common Error Messages and What They Mean

| Error | Plain meaning | How to fix |
|---|---|---|
| `RESEND_API_KEY is not set` | Email sending is broken | Add the API key in Railway Variables |
| `TERMII_API_KEY not set` | SMS/WhatsApp is broken | Add the API key in Railway Variables |
| `Unauthorized` | Invalid or missing login token | User needs to log out and log back in |
| `Hospital not found` | The hospital ID in the request does not exist | Usually a stale login — hospital needs to log out and back in |
| `Insufficient balance` (Termii) | Termii account is out of credit | Top up at termii.com |
| `Invalid address` (email) | Patient's email is not a real email address | Hospital needs to correct the patient's email |
| `Network error` | No internet connection on the server | Railway service may be down — check railway.app status |
| `Hospital is suspended` | Hospital account is inactive | Re-activate in super admin if appropriate |
| `Subscription expired` | Hospital subscription has lapsed | Renew their subscription status in super admin |
| `Invalid import data` | CSV import had the wrong format | Hospital needs to check their CSV has First Name and Last Name columns |

---

## PART 8: Things to Check Monthly

Run through this list once a month to keep the platform healthy:

1. **Termii balance** — Log into termii.com and check the balance. Top up before it runs low. You should also get daily email alerts when it drops below ₦50 (if `SUPER_ADMIN_ALERT_EMAIL` is set).

2. **Resend email usage** — Log into resend.com and check how many emails have been sent this month. If you are approaching 3,000, the system will auto-switch to SES — just make sure AWS credentials are set.

3. **OpenAI/Anthropic usage** — Check your API dashboards for any unexpected usage spikes. If AI costs are very high, one of the automation loops may be generating more messages than expected.

4. **Supabase storage** — Check that your database is not running out of row quotas. Supabase free tier allows 500MB. The `automation_log` table grows the fastest — it logs every message sent.

5. **Subscription statuses** — Review hospitals with trial or expiring subscriptions and follow up.

6. **Support inbox** — Check the Support section for any unread tickets.

7. **Platform health check** — Super admin → Analytics → make sure all green.

---

## PART 9: Quick Reference — Who Sees What

### Hospital Admin Sees:
Dashboard, Patients list, Patient history, Appointments, Pipeline, Activity log, Feedback, Wellness Newsletter, Settings, Call Tasks, Import Patients

### Receptionist Sees:
Queue Management, Call Tasks, Appointments (if enabled), New Patient form

### Nurse Sees:
Medication View (care plans with daily schedules), Call Tasks

### You (Super Admin) See:
Analytics, Hospitals list, Hospital detail pages, Usage stats, Automation tests, Support inbox, Settings, Deploy button

---

## PART 10: If You Are Completely Stuck

1. **Check Railway logs first** — 90% of production issues show up clearly in the api-server logs as red error lines. Copy the exact error text.

2. **Check Supabase automation_log** — For automation issues, this table tells you exactly which message failed and why.

3. **Restart the service** — Railway → api-server → restart. Sometimes this is all it takes.

4. **Bring the error to Claude Code** — If you cannot fix it yourself, open a new Claude Code session, describe the error, and paste the exact error message from the logs. The system is documented well enough that Claude can usually pinpoint the issue from the error text alone.

5. **Check this manual again** — Most common issues are covered in Part 3 and Part 7.
