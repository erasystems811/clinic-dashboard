---
name: Automation inventory
description: Complete list of all built automations, their channels, and AI models used
---

## Rule: Admin never receives any automated message
All email/WhatsApp/SMS goes to patients only. Admin sees only in-app counts/badges.

## WhatsApp / SMS only (3 types — via hospital's configured channel)
1. Queue milestone: joined (#position), next in line, your turn
2. Queue 45-min stall apology
3. Care plan onboarding notice (WhatsApp/SMS) — paired with OpenAI care plan email

## Email only (everything else patient-facing)
| Automation | Trigger | AI? | Notes |
|---|---|---|---|
| Appointment confirmation | Appointment booked | No | Immediate, templated |
| Appointment reminder 24h | Scheduler 15-min | No | Templated |
| Appointment reminder 2h | Scheduler 15-min | No | Templated |
| No-show detection | Scheduler 15-min | No | Auto-marks + activity log |
| No-show follow-up email | 1h after no-show | No | Templated |
| No-show dismissal | 11 PM daily | No | Clears today's no-shows |
| Care plan email | Care plan logged | OpenAI | Full plan explained, warm tone |
| In-care morning reminder | 8 AM daily | OpenAI | Based on treatment_plan field |
| In-care evening reminder | 6 PM daily | OpenAI | Based on treatment_plan field |
| Post-treatment Day 1 check-in | 6 AM daily | No | Templated |
| Post-treatment Day 4 check-in | 6 AM daily | No | Templated |
| Post-treatment Day 7 check-in | 6 AM daily | No | Templated |
| Post-care follow-up | 30 days in Post Care | No | Templated, once only |
| Dormant email | 250 days inactive | No | Templated, once only |
| End-of-day feedback link | 9 PM daily | No | Per-patient JWT link |
| Flagged task draft (call task) | Staff flags patient | OpenAI | Draft only — staff reviews before sending |
| Flagged task confirmed send | Staff approves | No | Email marked Important |
| Wellness newsletter | Manual (admin UI) | Claude | 5 generations/week limit enforced |
| Subscription expiration | Every 6h | No | Suspends hospital, no patient email |

## AI model split
- **OpenAI (gpt-4o-mini)**: care plan email, in-care reminders, flagged task drafts
- **Claude (claude-haiku-4-5)**: wellness newsletter content only

## Scheduler cron summary
- Every 15 min: appointment reminders + no-show detection + no-show follow-up
- 6 AM daily: pipeline transitions + post-treatment check-ins + post-care + dormant
- 8 AM daily: in-care morning AI reminders
- 6 PM daily: in-care evening AI reminders
- 9 PM daily: feedback form link emails
- 11 PM daily: no-show dismissal
- Every 6h: subscription expiration check

**Why:** Documented after full code audit of automation.ts + scheduler.ts. User confirmed this list.
