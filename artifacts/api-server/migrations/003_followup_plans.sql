-- Post-treatment follow-up plans for non-General Outpatient departments.
-- Nurse sets up to 5 day offsets (e.g. [7, 14, 30]); AI sends a check-in email
-- on each day after treatment_end_date.
-- Run in Supabase SQL Editor if upgrading an existing database.

CREATE TABLE IF NOT EXISTS post_treatment_followup_plans (
  id           SERIAL PRIMARY KEY,
  care_plan_id INTEGER NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  patient_id   INTEGER NOT NULL,
  hospital_id  TEXT NOT NULL,
  department   TEXT NOT NULL,
  followup_days JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ptfp_care_plan_id_idx ON post_treatment_followup_plans(care_plan_id);
CREATE INDEX IF NOT EXISTS ptfp_patient_id_idx   ON post_treatment_followup_plans(patient_id);
CREATE INDEX IF NOT EXISTS ptfp_hospital_id_idx  ON post_treatment_followup_plans(hospital_id);
