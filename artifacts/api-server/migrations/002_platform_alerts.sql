CREATE TABLE IF NOT EXISTS platform_alerts (
  service     TEXT        PRIMARY KEY,
  alerted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);
