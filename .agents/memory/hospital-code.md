---
name: Hospital Code
description: Auto-generated UUID per hospital for unique identification; separate from username
---

## What it is

`hospital_code` is a UUID auto-generated when a hospital is created via super admin.

- Not shown to hospital staff at any point
- Visible read-only in the super admin hospital detail page (General tab → Internal Hospital Code section)
- Uneditable — generated once, never changed

## Where it lives

- Column: `hospital_code` on the `hospitals` table in Supabase
- **Must be created manually in Supabase** — `ALTER TABLE hospitals ADD COLUMN hospital_code uuid;`
- Populated in `super-admin.ts` POST route: `hospital_code: crypto.randomUUID()`

## Relationship to hospital_id

- `hospital_id` on all patient/queue/activity/etc. tables is still `hospital.username` (the login slug)
- `hospital_code` is a separate display/governance field — it does not replace the internal `hospital_id`
- Username is already unique in the DB (login credential), so data isolation is secure via username

**Why:** User wanted a non-human-chosen, non-guessable identifier that hospitals never see, for audit/governance purposes.
