CREATE TABLE IF NOT EXISTS support_tickets (
  id             BIGSERIAL PRIMARY KEY,
  hospital_id    INTEGER NOT NULL,
  hospital_name  TEXT NOT NULL,
  subject        TEXT NOT NULL,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  reply          TEXT,
  replied_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_hospital_id_idx ON support_tickets (hospital_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx      ON support_tickets (status);
