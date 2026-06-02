-- Exact monthly email counter for automatic Resend → SES switchover.
-- Incremented on every single email send (including bulk), independent of
-- automation_log, so the 2,900/month threshold is precise.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS email_counters (
  month_key TEXT PRIMARY KEY,   -- e.g. "2026-06"
  count     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic increment function — avoids race conditions under concurrent sends.
CREATE OR REPLACE FUNCTION increment_email_count(p_month_key TEXT, p_by INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO email_counters (month_key, count, updated_at)
  VALUES (p_month_key, p_by, NOW())
  ON CONFLICT (month_key)
  DO UPDATE SET count = email_counters.count + p_by, updated_at = NOW()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
