-- Phase 18b: Women's Health — pregnancy tracking columns + pregnancy_logs table

-- Add missing columns to womens_health_settings
ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'cycle';
ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS lmp_date DATE;
ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS due_date DATE;

-- Pregnancy daily logs
CREATE TABLE IF NOT EXISTS pregnancy_logs (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  weight_kg     NUMERIC(5,2),
  symptoms      JSONB NOT NULL DEFAULT '[]',
  mood          TEXT,
  kicks_count   INTEGER,
  blood_pressure TEXT,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_pregnancy_logs_account ON pregnancy_logs(account_id, log_date DESC);

-- Tell PostgREST to reload its schema cache so the new columns are visible immediately
NOTIFY pgrst, 'reload schema';
