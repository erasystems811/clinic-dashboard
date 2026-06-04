-- Run in Supabase SQL Editor

-- Platform-level notices pushed by super admin to hospital dashboards
CREATE TABLE IF NOT EXISTS hospital_announcements (
  id          SERIAL PRIMARY KEY,
  hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE, -- NULL = broadcast to all hospitals
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'update')),
  published   BOOLEAN NOT NULL DEFAULT false, -- false = draft (hidden from hospitals), true = visible
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- set when published
  expires_at  TIMESTAMPTZ -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS hospital_announcements_hospital_id_idx ON hospital_announcements(hospital_id);

-- Track which hospitals have dismissed each notice
CREATE TABLE IF NOT EXISTS hospital_announcement_reads (
  hospital_id     INTEGER NOT NULL,
  announcement_id INTEGER NOT NULL REFERENCES hospital_announcements(id) ON DELETE CASCADE,
  dismissed_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (hospital_id, announcement_id)
);
