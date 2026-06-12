-- Phase 8: Women's Health

CREATE TABLE IF NOT EXISTS womens_health_settings (
  account_id     INTEGER PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
  cycle_length   INTEGER NOT NULL DEFAULT 28,
  period_length  INTEGER NOT NULL DEFAULT 5,
  last_period_start DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cycle_logs (
  id             SERIAL PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  log_date       DATE NOT NULL,
  flow           TEXT,         -- 'spotting' | 'light' | 'medium' | 'heavy' | null
  symptoms       JSONB NOT NULL DEFAULT '[]',
  notes          TEXT,
  is_period_start BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_cycle_logs_account ON cycle_logs(account_id, log_date DESC);
