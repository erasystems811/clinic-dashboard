-- Era Patient Management System — Supabase Schema
-- Run this entire file in your Supabase SQL Editor (https://app.supabase.com → SQL Editor)
-- All tables use RLS disabled so the anon key has full server-side access.

-- ── Hospitals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  username            TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  logo_url            TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_settings (
  id                            SERIAL PRIMARY KEY,
  hospital_id                   INTEGER NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  departments                   TEXT DEFAULT '[]',
  pipeline_post_treatment_days  INTEGER DEFAULT 7,
  pipeline_dormant_days         INTEGER DEFAULT 30,
  language                      TEXT DEFAULT 'English',
  tone                          TEXT DEFAULT 'Formal',
  clinic_description            TEXT,
  sending_email                 TEXT,
  post_treatment_checkin_days   INTEGER DEFAULT 3,
  post_care_checkin_days        INTEGER DEFAULT 7,
  whatsapp_from_number          TEXT,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_modules (
  id                        SERIAL PRIMARY KEY,
  hospital_id               INTEGER NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  appointments_enabled      BOOLEAN NOT NULL DEFAULT true,
  feedback_enabled          BOOLEAN NOT NULL DEFAULT true,
  wellness_newsletter_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled          BOOLEAN NOT NULL DEFAULT true,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_staff_credentials (
  id                         SERIAL PRIMARY KEY,
  hospital_id                INTEGER NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  nurse_username             TEXT NOT NULL,
  nurse_password_hash        TEXT NOT NULL,
  receptionist_username      TEXT NOT NULL,
  receptionist_password_hash TEXT NOT NULL,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Patients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                        SERIAL PRIMARY KEY,
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  date_of_birth             TEXT,
  hospital_id               TEXT,
  email                     TEXT NOT NULL,
  phone                     TEXT NOT NULL,
  whatsapp_number           TEXT,
  age                       INTEGER,
  gender                    TEXT,
  stage                     TEXT NOT NULL DEFAULT 'Booked',
  pre_queue_stage           TEXT,
  diagnosis                 TEXT,
  department                TEXT,
  next_appointment          TEXT,
  notes                     TEXT,
  treatment_plan            TEXT,
  treatment_type            TEXT,
  medication_timing         TEXT,
  treatment_duration_days   INTEGER,
  treatment_end_date        TEXT,
  checked_in_at             TEXT,
  treatment_started_at      TEXT,
  last_checkin_sent_at      TIMESTAMPTZ,
  last_feedback_sent_at     TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Pipeline Stages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Queue ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL,
  patient_name    TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  whatsapp_number TEXT,
  hospital_id     TEXT,
  stage           TEXT,
  position        INTEGER NOT NULL,
  appointment_id  INTEGER,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Call Tasks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_tasks (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL,
  patient_name    TEXT NOT NULL,
  phone           TEXT NOT NULL,
  whatsapp_number TEXT,
  hospital_id     TEXT,
  department      TEXT,
  reason          TEXT NOT NULL,
  task_type       TEXT NOT NULL DEFAULT 'follow_up',
  check_in_type   TEXT,
  action_type     TEXT NOT NULL DEFAULT 'manual_call',
  outcome         TEXT,
  completed_at    TIMESTAMPTZ,
  flagged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Departments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Appointments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id           SERIAL PRIMARY KEY,
  patient_id   INTEGER NOT NULL,
  patient_name TEXT NOT NULL,
  hospital_id  TEXT,
  title        TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  duration     INTEGER DEFAULT 30,
  department   TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled',
  notes        TEXT,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_2h_sent_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Activity Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,
  description  TEXT NOT NULL,
  patient_id   INTEGER,
  patient_name TEXT,
  hospital_id  TEXT,
  metadata     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Feedback ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id           SERIAL PRIMARY KEY,
  patient_id   INTEGER,
  patient_name TEXT,
  hospital_id  TEXT,
  rating       INTEGER NOT NULL,
  comment      TEXT,
  token        TEXT UNIQUE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Wellness Newsletter ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellness_newsletter (
  id           SERIAL PRIMARY KEY,
  hospital_id  INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
  week_of      TEXT NOT NULL,
  topic        TEXT,
  content      TEXT NOT NULL,
  youtube_link TEXT,
  tiktok_link  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  last_sent_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Automation Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_log (
  id               SERIAL PRIMARY KEY,
  hospital_id      INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
  patient_id       INTEGER,
  patient_name     TEXT,
  automation_type  TEXT NOT NULL,
  channel          TEXT NOT NULL DEFAULT 'whatsapp',
  status           TEXT NOT NULL DEFAULT 'queued',
  message_preview  TEXT,
  error_message    TEXT,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auto-update updated_at triggers ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hospitals_updated_at') THEN
    CREATE TRIGGER set_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hospital_settings_updated_at') THEN
    CREATE TRIGGER set_hospital_settings_updated_at BEFORE UPDATE ON hospital_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hospital_modules_updated_at') THEN
    CREATE TRIGGER set_hospital_modules_updated_at BEFORE UPDATE ON hospital_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_hospital_staff_credentials_updated_at') THEN
    CREATE TRIGGER set_hospital_staff_credentials_updated_at BEFORE UPDATE ON hospital_staff_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_patients_updated_at') THEN
    CREATE TRIGGER set_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_wellness_newsletter_updated_at') THEN
    CREATE TRIGGER set_wellness_newsletter_updated_at BEFORE UPDATE ON wellness_newsletter FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── Disable RLS on all tables (server-side service-role key access) ───────────
-- The API server uses the Supabase service-role key which bypasses RLS.
-- RLS is intentionally disabled for all tables; hospital-level isolation is
-- enforced in application logic (x-hospital-token middleware).
ALTER TABLE hospitals                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_settings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_modules           DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_staff_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages            DISABLE ROW LEVEL SECURITY;
ALTER TABLE queue                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_tasks                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments                DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_newsletter        DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log             DISABLE ROW LEVEL SECURITY;

-- ── Column additions for existing databases (run if upgrading) ────────────────
-- hospital_settings new columns
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS sending_email TEXT;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS post_treatment_checkin_days INTEGER DEFAULT 3;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS post_care_checkin_days INTEGER DEFAULT 7;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS whatsapp_from_number TEXT;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'whatsapp';
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS termii_sender_id TEXT;

-- hospital_modules new columns
ALTER TABLE hospital_modules ADD COLUMN IF NOT EXISTS wellness_newsletter_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE hospital_modules ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT true;

-- patients scheduler columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_checkin_sent_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_feedback_sent_at TIMESTAMPTZ;

-- call_tasks hospital scoping
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- appointments hospital scoping
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- appointments reminder dedup columns (24h + 2h reminders) — required by runAppointmentReminders
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent_at  TIMESTAMPTZ;

-- activity hospital scoping
ALTER TABLE activity ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- feedback hospital scoping + token
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS hospital_id TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

-- wellness_newsletter new columns
ALTER TABLE wellness_newsletter ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE;
ALTER TABLE wellness_newsletter ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE wellness_newsletter ADD COLUMN IF NOT EXISTS youtube_link TEXT;
ALTER TABLE wellness_newsletter ADD COLUMN IF NOT EXISTS tiktok_link TEXT;
ALTER TABLE wellness_newsletter ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Post-treatment follow-up plans for departmental (non-General Outpatient) patients
CREATE TABLE IF NOT EXISTS post_treatment_followup_plans (
  id           SERIAL PRIMARY KEY,
  care_plan_id INTEGER NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  patient_id   INTEGER NOT NULL,
  hospital_id  TEXT NOT NULL,
  department   TEXT NOT NULL,
  followup_days JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ptfp_care_plan_id_idx ON post_treatment_followup_plans(care_plan_id);
CREATE INDEX IF NOT EXISTS ptfp_patient_id_idx   ON post_treatment_followup_plans(patient_id);
CREATE INDEX IF NOT EXISTS ptfp_hospital_id_idx  ON post_treatment_followup_plans(hospital_id);

-- Care plan beneficiary columns (accountability contact for treatment reminders)
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS beneficiary_name  TEXT;
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS beneficiary_email TEXT;

-- Wallet system
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS wallet_balance_kobo INTEGER NOT NULL DEFAULT 0;

-- SMS flip toggles — per-hospital opt-in for email→SMS upgrade
ALTER TABLE hospital_modules ADD COLUMN IF NOT EXISTS call_task_sms_enabled         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE hospital_modules ADD COLUMN IF NOT EXISTS followup_sms_enabled           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE hospital_modules ADD COLUMN IF NOT EXISTS appointment_reminder_sms_enabled BOOLEAN NOT NULL DEFAULT false;

-- Wallet transactions log
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id               SERIAL PRIMARY KEY,
  hospital_id      INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_kobo      INTEGER NOT NULL,
  description      TEXT NOT NULL,
  flutterwave_ref  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_tx_hospital_id_idx ON wallet_transactions(hospital_id);
CREATE INDEX IF NOT EXISTS wallet_tx_flw_ref_idx     ON wallet_transactions(flutterwave_ref) WHERE flutterwave_ref IS NOT NULL;

-- Care plan archive columns — plans are never deleted, only marked ended
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS status    TEXT NOT NULL DEFAULT 'active';
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS ended_at  TIMESTAMPTZ;
