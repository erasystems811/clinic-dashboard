-- Patient in-app notifications
-- Stores hospital-triggered notifications (feedback requests, appointment updates, etc.)
-- Sits alongside the email channel — same data, different delivery mechanism

CREATE TABLE IF NOT EXISTS patient_notifications (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- 'feedback_request' | 'appointment_confirmed' | 'appointment_cancelled' | 'general'
  title       TEXT NOT NULL,
  body        TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,            -- null = unread
  actioned_at TIMESTAMPTZ,            -- null = not yet acted on (e.g. feedback not yet submitted)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE patient_notifications DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS patient_notif_account_idx    ON patient_notifications(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_notif_unread_idx     ON patient_notifications(account_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_notif_unactioned_idx ON patient_notifications(account_id) WHERE actioned_at IS NULL;
