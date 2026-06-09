CREATE TABLE IF NOT EXISTS crm_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  stage         TEXT NOT NULL DEFAULT 'identified',
  last_contacted DATE,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  date_added DATE NOT NULL,
  date_done  DATE,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
