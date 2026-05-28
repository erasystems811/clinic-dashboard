---
name: Hospital ID in Scheduler
description: Which variable to use when querying patients/care_plans/queue inside the scheduler — h.hospital_code NOT h.id.
---

**Rule:** Inside `scheduler.ts`, whenever filtering `patients`, `care_plans`, or `queue` by hospital, ALWAYS use `h.hospital_code` — NEVER `h.id`.

**Why:** After the hospital_code migration, these three tables store a UUID string in their `hospital_id` column (the `hospital_code`), NOT the integer `hospitals.id`. Using `h.id` returns zero rows silently — no error, just nothing fires.

**How to apply:**
- Scheduler fetches hospitals as: `supabase.from("hospitals").select("id, username, hospital_code")`
- Patient/care_plan/queue queries: `.eq("hospital_id", h.hospital_code)` ← UUID string
- `automation_log`, `hospital_settings`, `hospital_modules`, `appointments`, `call_tasks` — these use integer FK: `.eq("hospital_id", h.id)` ← integer — this is CORRECT for those tables

**In routes:** The equivalent is `hospital.code` from the auth middleware (same UUID, different variable name).

**The failure mode:** Using `h.id` on patients/care_plans/queue compiles fine and runs without error — the query just returns empty, causing the automation to silently skip every patient. Very hard to notice without checking logs.
