-- Knowledge base for support AI — feature documentation + changelog

CREATE TABLE IF NOT EXISTS platform_knowledge_base (
  id        SERIAL PRIMARY KEY,
  section   TEXT NOT NULL, -- "features", "changes", "troubleshooting", etc.
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, title)
);

CREATE INDEX IF NOT EXISTS kb_section_idx ON platform_knowledge_base(section);

-- Track deployments/releases for auto-changelog
CREATE TABLE IF NOT EXISTS platform_deployments (
  id          SERIAL PRIMARY KEY,
  version     TEXT, -- git commit hash or release tag
  title       TEXT, -- feature summary
  description TEXT, -- what changed
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deployments_deployed_at_idx ON platform_deployments(deployed_at DESC);
