---
name: Automation inventory
description: Complete list of all built automations, their channels, and AI models used — never get this wrong
---

## CRITICAL: Only 4 automations use AI — everything else is hard-coded template

### AI-powered (these 4 only)
| Automation | Trigger | Model | Detail |
|---|---|---|---|
| Care plan explanation email | Nurse creates care plan | **Claude** | Full explanation of what nurse logged; warm, patient-friendly; patient understands their care plan |
| In-care daily reminders | 4x daily (8am/1pm/6pm/10pm) | **OpenAI** | Fires only for patients whose `medication_timing` has that slot; aware of whether it's medication or hospital visit |
| Flagged task draft (call task) | Nurse flags patient | **OpenAI** | Writes draft based on reason nurse entered; explicitly says "I do not understand" if reason is unclear; staff reviews/edits before it sends |
| Wellness newsletter | Admin manually triggers | **Claude** | 5 generations/week limit; admin picks topic, Claude generates; admin sends to all active patients |

**Why:** User confirmed this exact list multiple times. Do not add AI to any other automation. Do not change any other template to AI.

---

## Rule: Admin never receives any automated message
All email/WhatsApp/SMS goes to **patients only**. Admin sees only in-app counts/badges (messages unread count, feedback badge, etc.).

---

## WhatsApp / SMS only (3 trigger types)
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
| Post-care follow-up | 30 days in Post Care stage | Templated, once only |
| Dormant email | 250 days inactive | Templated, once only |
| End-of-day feedback link | 9 PM daily | Per-patient JWT link |
| Flagged task confirmed send | Staff approves draft | Email marked Important — **not** AI, staff wrote/edited it |
| Wellness newsletter send | Admin sends approved draft | Sends Claude-generated content to all active patients |

---

## Scheduler cron summary
- Every 15 min: appointment reminders + no-show detection + no-show follow-up
- 6 AM daily: pipeline transitions + post-treatment check-ins + post-care + dormant
- 8 AM / 1 PM / 6 PM / 10 PM daily: in-care AI reminders (slot-gated by medication_timing)
- 9 PM daily: feedback form link emails
- 11 PM daily: no-show dismissal
- Every 6h: subscription expiration check

## AI model assignments
- **OpenAI gpt-4o-mini**: in-care reminders, flagged task drafts
- **Claude claude-haiku-4-5**: care plan explanation email, wellness newsletter
