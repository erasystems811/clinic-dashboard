---
name: Messaging channel split
description: Which automations use WhatsApp/SMS vs email, and who receives them
---

## Core Rule

ALL outbound messages (email, WhatsApp, SMS) go to **patients only**.
The hospital admin NEVER receives any email or SMS/WhatsApp from the system.

## Admin notifications are in-app only
- Unread feedback count badge
- In-app indicators of new submissions
- No email, no SMS, no WhatsApp to admin ever

## Patient messages by channel

**WhatsApp / SMS** (exactly 3 types):
1. Queue milestone notifications (3 checkpoints as patient moves up the line)
2. Queue stall alert (line has not moved in 45 minutes)
3. Care plan onboarding notice

**Email** (everything else patient-facing):
- Appointment reminders
- Post-visit feedback form link
- Wellness check-ins
- Call task follow-ups
- New patient registration confirmation
- Any other patient notification

**Why:** User explicitly confirmed — messaging infrastructure is patient-facing only. Hospital admin interacts exclusively through the in-app dashboard. WhatsApp/SMS reserved for time-critical real-time queue updates only.

**How to apply:** Before wiring any automation, ask "who receives this?" If it's the admin → in-app only, never send. If it's the patient → email unless it's one of the 3 WhatsApp/SMS types.

## Termii SMS channel: MUST be `generic`, NOT `dnd`

`dnd` channel returns HTTP 400 "Country Inactive" even when the account is active and Nigeria is enabled. The Termii app and generic API route both use `generic`. **Never change `deliverSms` back to `dnd`.**

**Why:** Confirmed working after switching `deliverSms` in messaging.ts from `dnd` → `generic`. User verified message received.
