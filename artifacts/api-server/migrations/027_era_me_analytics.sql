-- ERA-me patient app analytics & feedback tables
-- Also fixes feedback_broadcast to allow both id=1 (hospital staff) and id=2 (patient app)

-- ── ERA-me page-view tracking ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_patient_analytics (
  id          BIGSERIAL PRIMARY KEY,
  patient_id  INTEGER REFERENCES patient_accounts(id) ON DELETE SET NULL,
  session_id  TEXT NOT NULL,
  route       TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_era_patient_analytics_patient ON era_patient_analytics(patient_id);
CREATE INDEX IF NOT EXISTS idx_era_patient_analytics_created ON era_patient_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_era_patient_analytics_route   ON era_patient_analytics(route, created_at);

-- ── ERA-me in-app feedback ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS era_patient_feedback (
  id         BIGSERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patient_accounts(id) ON DELETE SET NULL,
  username   TEXT,
  rating     INTEGER CHECK (rating >= 1 AND rating <= 5),
  category   TEXT NOT NULL DEFAULT 'general',
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_era_patient_feedback_created ON era_patient_feedback(created_at);

-- ── Fix feedback_broadcast — drop the id=1 constraint so id=2 (patient app) works ──
-- id=1 → hospital staff popup
-- id=2 → ERA-me patient app nudge
ALTER TABLE feedback_broadcast DROP CONSTRAINT IF EXISTS feedback_broadcast_id_check;
