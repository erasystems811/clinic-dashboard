-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New Query > paste & run

-- Individual named staff accounts per hospital
CREATE TABLE IF NOT EXISTS hospital_staff (
  id         SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  username   TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('nurse', 'receptionist')),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, username)
);

CREATE INDEX IF NOT EXISTS hospital_staff_hospital_id_idx ON hospital_staff(hospital_id);

-- Track who performed each action in the activity log
ALTER TABLE activity ADD COLUMN IF NOT EXISTS performed_by TEXT;
