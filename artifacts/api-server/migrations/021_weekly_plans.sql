CREATE TABLE IF NOT EXISTS weekly_plans (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  plan_data    JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_account ON weekly_plans(account_id, week_start DESC);
