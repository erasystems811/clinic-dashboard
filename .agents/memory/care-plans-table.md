---
name: Care Plans Table
description: The care_plans table does not auto-migrate; it must be created manually in the Supabase SQL editor.
---

The Supabase JS client cannot execute DDL. There is no pg package in the sandbox. The Supabase management API (api.supabase.com) requires the SUPABASE_ACCESS_TOKEN PAT which returned auth errors when tested.

**Rule:** Any new tables for this project must either be created manually in the Supabase SQL editor, or via a pg-based migration script run from within the api-server container (which does have the schema accessible via drizzle/pg internally).

**Migration file location:** `artifacts/api-server/migrations/001_care_plans.sql`

**Table schema:**
```sql
CREATE TABLE IF NOT EXISTS care_plans (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  hospital_id VARCHAR NOT NULL,
  summary TEXT NOT NULL,
  department VARCHAR NOT NULL,
  template_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**How to apply:** Open Supabase Dashboard → SQL Editor → paste and run the file contents.
