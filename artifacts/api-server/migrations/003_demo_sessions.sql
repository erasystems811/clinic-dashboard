-- Demo session tracking — stores every prospect who runs the interactive demo
CREATE TABLE IF NOT EXISTS demo_sessions (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL UNIQUE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT NOT NULL,
  stage_reached TEXT,
  completed   BOOLEAN NOT NULL DEFAULT false,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Run this if the table already exists (adds email column safely)
ALTER TABLE demo_sessions ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE demo_sessions DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS demo_sessions_started_at_idx ON demo_sessions(started_at DESC);
