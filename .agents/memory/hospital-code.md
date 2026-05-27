---
name: Hospital Code
description: hospital_code UUID — usage, DB state, fallback pattern, and critical select("*") rule
---

## What it is
`hospital_code` is a UUID used as `hospital_id` in patient-facing tables (patients, care_plans, queue). New hospitals get it auto-generated at creation. Existing hospitals created before the column existed may have it NULL.

## CRITICAL: always use select("*") in getHospitalFromRequest
`getHospitalFromRequest` in `hospital-auth.ts` must use `.select("*")` — NEVER `.select("id, username, hospital_code")`. If the `hospital_code` column doesn't exist in the DB, an explicit named select causes Supabase to error and return `data = null`, making every protected route return 401 (all patient data disappears).

## Fallback pattern (active)
```typescript
const code = (data.hospital_code as string | null) ?? (data.username as string);
```
Falls back to username if hospital_code is null/missing, so existing patients stored under username remain visible.

## Startup migration
`migrateHospitalIdColumns()` in `index.ts` runs SQL via Supabase Management API on every startup:
1. `ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_code TEXT`
2. `UPDATE hospitals SET hospital_code = gen_random_uuid()::TEXT WHERE hospital_code IS NULL`
3. Updates patients/care_plans/queue rows from username → hospital_code UUID
Requires `SUPABASE_ACCESS_TOKEN` env var. If Supabase Management API is down (502), migration is skipped but fallback keeps app working.

## Data isolation
- New hospitals: always use UUID (auto-generated at creation in super-admin POST route)
- Old hospitals: username fallback until migration runs — no cross-hospital leakage risk (same display name → different UUID)

**Why:** Column added to code before existing in DB schema; old hospitals needed backfill; explicit column select broke auth for all data routes.
