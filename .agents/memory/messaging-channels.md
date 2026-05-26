---
name: Messaging channel split
description: Which automations use WhatsApp/SMS vs email in Era Patient
---

## Rule

**WhatsApp / SMS** is used for exactly 3 types of patient-facing messages:
1. Queue milestone notifications (3 checkpoints as patient moves up the line)
2. Queue stall alert (line has not moved in 45 minutes)
3. Care plan onboarding notice

**Everything else uses Email:**
- Appointment reminders
- Post-visit feedback form link sent to patient
- Wellness check-ins
- Call task follow-ups
- New patient registration confirmation
- Any other admin or patient notification

**Why:** User explicitly corrected this — WhatsApp/SMS is reserved for time-critical, real-time queue updates only. All other communications are email-first by design (confirmed by scheduler log comment: "email-first").

**How to apply:** Before wiring any new automation, check if it falls in the 3 WhatsApp/SMS categories. If not, route it through email (Resend) regardless of the hospital's channel setting.
