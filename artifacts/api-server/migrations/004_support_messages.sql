CREATE TABLE IF NOT EXISTS support_messages (
  id         BIGSERIAL PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('hospital', 'ai', 'admin')),
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON support_messages (ticket_id);

-- Migrate existing tickets: move their initial message + reply into support_messages
INSERT INTO support_messages (ticket_id, sender, message, created_at)
SELECT id, 'hospital', message, created_at
FROM support_tickets
WHERE message IS NOT NULL AND message <> ''
ON CONFLICT DO NOTHING;

INSERT INTO support_messages (ticket_id, sender, message, created_at)
SELECT id, 'admin', reply, replied_at
FROM support_tickets
WHERE reply IS NOT NULL AND reply <> '' AND replied_at IS NOT NULL
ON CONFLICT DO NOTHING;
