-- Return visit scheduling: doctor/nurse books patient to come back on a specific date

CREATE TABLE IF NOT EXISTS patient_return_visits (
  id                   SERIAL PRIMARY KEY,
  patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  hospital_id          INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  visit_date           DATE NOT NULL,
  visit_time           TIME,
  reason               TEXT NOT NULL,
  notes                TEXT,
  scheduled_by         TEXT NOT NULL DEFAULT 'staff',
  scheduled_by_name    TEXT,
  status               TEXT NOT NULL DEFAULT 'scheduled',
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_3h_sent_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prv_patient  ON patient_return_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_prv_hospital ON patient_return_visits(hospital_id);
CREATE INDEX IF NOT EXISTS idx_prv_date     ON patient_return_visits(visit_date, status);
