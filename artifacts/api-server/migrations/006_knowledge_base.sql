-- Auto-tracked deployments for support AI context
-- AI reads git commits directly when answering questions

CREATE TABLE IF NOT EXISTS platform_deployments (
  id          SERIAL PRIMARY KEY,
  commit_hash TEXT,
  title       TEXT NOT NULL,
  deployed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deployments_deployed_at_idx ON platform_deployments(deployed_at DESC);
