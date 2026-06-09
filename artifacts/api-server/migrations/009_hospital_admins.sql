-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New Query > paste & run

-- Individual named admin accounts per hospital
-- The master hospital login (hospitals.username) continues to work.
-- Sub-admins log in via the same Admin Login form but are tracked by name.
CREATE TABLE IF NOT EXISTS hospital_admins (
  id           SERIAL PRIMARY KEY,
  hospital_id  INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  username     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hospital_admins DISABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS hospital_admins_username_lower_idx ON hospital_admins(LOWER(username));
CREATE INDEX IF NOT EXISTS hospital_admins_hospital_id_idx ON hospital_admins(hospital_id);

-- Clean up queue entries that were marked called_in but never deleted (legacy bug).
-- The call-in endpoint now deletes the row outright; old rows with called_in_at set are orphaned.
DELETE FROM queue WHERE called_in_at IS NOT NULL;
