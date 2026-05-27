-- Run this SQL in your Supabase SQL Editor to create the care_plans table.
-- Navigate to: Supabase Dashboard > SQL Editor > New Query > paste & run

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

CREATE INDEX IF NOT EXISTS care_plans_patient_id_idx ON care_plans(patient_id);
CREATE INDEX IF NOT EXISTS care_plans_hospital_id_idx ON care_plans(hospital_id);
