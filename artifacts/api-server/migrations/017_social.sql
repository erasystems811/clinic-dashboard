-- Phase 7: Social — accountability partners

CREATE TABLE IF NOT EXISTS accountability_partners (
  id           SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined' | 'removed'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_partners_requester ON accountability_partners(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_partners_recipient ON accountability_partners(recipient_id, status);
