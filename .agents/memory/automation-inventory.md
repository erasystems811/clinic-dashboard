---
name: Automation inventory
description: Complete list of all built automations, their channels, and AI models used — never get this wrong
---

## CRITICAL: Only 4 automations use AI — everything else is hard-coded template

### AI-powered (these 4 only)
| Automation | Trigger | Model | Detail |
|---|---|---|---|
| Care plan explanation email | Nurse creates care plan | **Claude** | Full explanation of what nurse logged; warm, patient-friendly; patient understands their care plan |
| General Outpatient care plan reminders | Hourly cron, time-based | **OpenAI** | Timing depends on treatment type — see "Reminder timing" section below |
| Flagged task draft (call task) | Admin OR nurse flags patient | **OpenAI** | Writes draft based on reason entered; explicitly says "I do not understand" if reason is unclear; staff reviews/edits before it sends |
| Wellness newsletter | Admin manually triggers | **Claude** | 5 generations/week limit; admin picks topic, Claude generates; admin sends to all active patients |

**Why:** User confirmed this exact list multiple times. Do not add AI to any other automation. Do not change any other template to AI.

---

## Reminder timing — ALL reminders are driven by the TIME the nurse entered per department
**THERE ARE NO FIXED TIME-OF-DAY SLOTS (no "morning/afternoon/evening/night"). Do not describe them that way — ever.**

Every reminder fires based on a specific time the nurse typed when creating the care plan, which differs per department and per patient.

| Department | When reminder fires |
|---|---|
| General Outpatient — medication only | AT the exact time the nurse set |
| General Outpatient — come to hospital only | 3 hours before the nurse-set time |
| General Outpatient — combination (both) | 2 hours before the nurse-set hospital time |
| All other departments | 4 hours before the nurse-set visit time (templated, no AI) |

`runCarePlanRemindersHourly` fires every hour and compares now against nurse-set times using a ±7.5-minute window. Each combination of (plan, date, time) is deduped via automation_log so it fires exactly once.

---

## Flagged task — both admin and nurse can flag
Both admin AND nurse roles can flag a patient and write a reason. OpenAI drafts the call task message. Staff reviews/edits, then approves to send. Sent email is marked Important. It is NOT AI at the point of send — staff owns the final text.

---

## Rule: Admin never receives any automated message
All email/WhatsApp/SMS goes to **patients only**. Admin sees only in-app counts/badges (messages unread count, feedback badge, etc.).

---

## Mobile messaging channel: WhatsApp OR SMS — hospital's choice
Queue messages and care plan notices go via **WhatsApp or SMS** — whichever channel the hospital picked in the super admin notification channel dropdown. It is NOT always WhatsApp. The scheduler reads `notification_channel` from hospital_settings and routes accordingly.

### Mobile message trigger types (3)
1. Queue milestone: joined (with position number), next in line, your turn
2. Queue 45-min stall apology (sent to all patients waiting when no movement for 45 min)
3. Care plan onboarding notice (paired with care plan email, tells patient to check email)

---

## Email only — ALL templated (no AI)
| Automation | Trigger | Notes |
|---|---|---|
| Care plan explanation | Nurse creates care plan | **Claude** generates this one — see AI table above |
| Appointment confirmation | Appointment booked | Immediate, templated |
| Appointment reminder 24h | Scheduler 15-min | Templated |
| Appointment reminder 2h | Scheduler 15-min | Templated |
| No-show follow-up | 1h after missed appt | Templated |
| Post-treatment Day 1 check-in | 6 AM daily | Templated |
| Post-treatment Day 4 check-in | 6 AM daily | Templated |
| Post-treatment Day 7 check-in | 6 AM daily | Templated |
| Active patient follow-up | Every 30 days in Active stage | Templated, **continuous** (per-patient 30-day cooldown via automation_log); skipped if patient checked in (joined queue) within last 30 days |
| Birthday email | Patient's birthday (7 AM daily) | Templated, once per calendar year per patient; requires date_of_birth on patient record |
| Dormant email | pipeline_dormant_days inactive | Templated, once per dormant transition |
| Feedback link | 12 PM next day | Hospital general link (`/feedback/h/<slug>`), covers all patients who visited the previous day |
| Flagged task confirmed send | Admin/nurse approves draft | Email marked Important — **both admin and nurse** can flag; staff wrote/edited it, NOT AI at send time |
| Wellness newsletter send | Admin sends approved draft | Sends Claude-generated content to all active patients |

---

## Scheduler cron summary
- Every 15 min: appointment reminders + no-show detection + no-show follow-up
- Every hour: care plan reminders — General Outpatient (time-based, AI) + all other depts (4h before, templated)
- 6 AM daily: pipeline transitions + post-treatment check-ins + active-patient follow-ups + dormant detection
- 12 PM daily: feedback emails (previous day's queue patients, general hospital link)
- 11 PM daily: no-show dismissal
- Every 6h: subscription expiration check

## Stage names in DB (as of current codebase)
- Scheduler queries `stage = "Active"` for post-care follow-ups and dormant detection. "Post Care" is a dead legacy value — removed from all queries. Do not reintroduce "Post Care" anywhere.

## AI model assignments
- **OpenAI gpt-4o-mini**: in-care reminders (General Outpatient), flagged task drafts
- **Claude claude-haiku-4-5**: care plan explanation email, wellness newsletter
