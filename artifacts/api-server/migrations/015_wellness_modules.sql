-- Wellness module settings per patient account
CREATE TABLE IF NOT EXISTS wellness_modules (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  settings    JSONB NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_type)
);

-- Daily log entries for each module
CREATE TABLE IF NOT EXISTS wellness_logs (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  log_date    DATE NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, module_type, log_date)
);

CREATE INDEX IF NOT EXISTS idx_wellness_modules_account ON wellness_modules(account_id);
CREATE INDEX IF NOT EXISTS idx_wellness_logs_account_date ON wellness_logs(account_id, log_date);
