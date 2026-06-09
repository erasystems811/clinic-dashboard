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
  post_treatment_started_at TIMESTAMPTZ,
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
  id                       SERIAL PRIMARY KEY,
  patient_id               INTEGER,
  patient_name             TEXT,
  hospital_id              TEXT,
  rating                   INTEGER NOT NULL,
  wait_time_rating         INTEGER,
  staff_friendliness_rating INTEGER,
  quality_of_care_rating   INTEGER,
  would_recommend          BOOLEAN,
  is_read                  BOOLEAN NOT NULL DEFAULT false,
  comment                  TEXT,
  token                    TEXT UNIQUE,
  submitted_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Feedback Form Config ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_form_config (
  id          SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL UNIQUE REFERENCES hospitals(id) ON DELETE CASCADE,
  questions   JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── System Feedback (staff ratings of the Era platform) ───────────────────────
CREATE TABLE IF NOT EXISTS system_feedback (
  id            SERIAL PRIMARY KEY,
  hospital_id   INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
  hospital_name TEXT,
  user_role     TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Feedback Broadcast (super-admin trigger to show popup to all staff) ────────
CREATE TABLE IF NOT EXISTS feedback_broadcast (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  triggered_at TIMESTAMPTZ NOT NULL
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
ALTER TABLE feedback_form_config       DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_feedback            DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_broadcast         DISABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_newsletter        DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log             DISABLE ROW LEVEL SECURITY;

-- ── Hospital Announcements ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_announcements (
  id           SERIAL PRIMARY KEY,
  hospital_id  INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'update')),
  published    BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  target_module TEXT CHECK (target_module IN ('appointments', 'feedback', 'wellness_newsletter', 'messages')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_announcement_reads (
  hospital_id     INTEGER NOT NULL,
  announcement_id INTEGER NOT NULL REFERENCES hospital_announcements(id) ON DELETE CASCADE,
  dismissed_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (hospital_id, announcement_id)
);

ALTER TABLE hospital_announcements      DISABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_announcement_reads DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS hospital_announcements_hospital_id_idx ON hospital_announcements(hospital_id);
CREATE INDEX IF NOT EXISTS hospital_announcements_published_idx   ON hospital_announcements(published, expires_at);

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
ALTER TABLE patients ADD COLUMN IF NOT EXISTS post_treatment_started_at TIMESTAMPTZ;

-- Backfill: patients already in Post Treatment get a started_at approximated from updated_at
UPDATE patients SET post_treatment_started_at = updated_at WHERE stage = 'Post Treatment' AND post_treatment_started_at IS NULL;

-- call_tasks hospital scoping
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- appointments hospital scoping
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- appointments reminder dedup columns (24h + 2h reminders) — required by runAppointmentReminders
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_2h_sent_at  TIMESTAMPTZ;

-- activity hospital scoping
ALTER TABLE activity ADD COLUMN IF NOT EXISTS hospital_id TEXT;

-- feedback hospital scoping + token + extended fields
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS hospital_id TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS wait_time_rating INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS staff_friendliness_rating INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS quality_of_care_rating INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- hospitals feedback slug (public feedback form URL)
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS feedback_slug TEXT UNIQUE;

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

-- ── Performance indexes for 500k+ patients per hospital ───────────────────────
-- Run these once; safe to re-run (IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS patients_hospital_id_idx       ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS patients_stage_idx             ON patients(stage);
CREATE INDEX IF NOT EXISTS patients_hospital_stage_idx    ON patients(hospital_id, stage);
CREATE INDEX IF NOT EXISTS patients_created_at_idx        ON patients(created_at DESC);
CREATE INDEX IF NOT EXISTS patients_dob_idx               ON patients(date_of_birth) WHERE date_of_birth IS NOT NULL;

CREATE INDEX IF NOT EXISTS queue_hospital_id_idx          ON queue(hospital_id);
CREATE INDEX IF NOT EXISTS queue_patient_id_idx           ON queue(patient_id);

CREATE INDEX IF NOT EXISTS appointments_hospital_id_idx   ON appointments(hospital_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_scheduled_at_idx  ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS appointments_status_idx        ON appointments(status);

CREATE INDEX IF NOT EXISTS activity_hospital_id_idx       ON activity(hospital_id);
CREATE INDEX IF NOT EXISTS activity_patient_id_idx        ON activity(patient_id);
CREATE INDEX IF NOT EXISTS activity_type_idx              ON activity(type);
CREATE INDEX IF NOT EXISTS activity_created_at_idx        ON activity(created_at DESC);

CREATE INDEX IF NOT EXISTS call_tasks_hospital_id_idx     ON call_tasks(hospital_id);
CREATE INDEX IF NOT EXISTS call_tasks_patient_id_idx      ON call_tasks(patient_id);

CREATE INDEX IF NOT EXISTS feedback_hospital_id_idx       ON feedback(hospital_id);
CREATE INDEX IF NOT EXISTS feedback_submitted_at_idx      ON feedback(submitted_at DESC);

-- Compound index for automation_log dedup — used on every scheduled send
CREATE INDEX IF NOT EXISTS automation_log_dedup_idx       ON automation_log(hospital_id, patient_id, automation_type, status);
CREATE INDEX IF NOT EXISTS automation_log_type_status_idx ON automation_log(automation_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS care_plans_hospital_id_idx     ON care_plans(hospital_id);
CREATE INDEX IF NOT EXISTS care_plans_patient_id_idx      ON care_plans(patient_id);
CREATE INDEX IF NOT EXISTS care_plans_status_idx          ON care_plans(status);

-- ── Doctors ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id            SERIAL PRIMARY KEY,
  hospital_id   INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  specialty     TEXT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  unavailable   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE hospital_doctors DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS hospital_doctors_hospital_id_idx ON hospital_doctors(hospital_id);

-- ── Appointment time blocks (recurring weekly schedule for self-booking) ───────
CREATE TABLE IF NOT EXISTS appointment_time_blocks (
  id           SERIAL PRIMARY KEY,
  hospital_id  INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE appointment_time_blocks DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS time_blocks_hospital_id_idx ON appointment_time_blocks(hospital_id);

-- ── Self bookings (patient self-booked, pending receptionist confirmation) ─────
CREATE TABLE IF NOT EXISTS self_bookings (
  id               SERIAL PRIMARY KEY,
  hospital_id      INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_name     TEXT NOT NULL,
  patient_phone    TEXT NOT NULL,
  patient_email    TEXT,
  reason           TEXT NOT NULL,
  requested_at     TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  doctor_id        INTEGER REFERENCES hospital_doctors(id) ON DELETE SET NULL,
  appointment_id   INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  duration_minutes INTEGER,
  confirmed_by     TEXT,
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE self_bookings DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS self_bookings_hospital_id_idx ON self_bookings(hospital_id);
CREATE INDEX IF NOT EXISTS self_bookings_status_idx      ON self_bookings(status);

-- ── Add doctor columns to queue ───────────────────────────────────────────────
ALTER TABLE queue ADD COLUMN IF NOT EXISTS doctor_id    INTEGER REFERENCES hospital_doctors(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS doctor_name  TEXT;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS called_in_at TIMESTAMPTZ;

-- ── Add doctor + duration columns to appointments ─────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_id                   INTEGER REFERENCES hospital_doctors(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name                 TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes            INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_3h_doctor_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_by                TEXT;

-- ── Add performed_by + staff_role to activity ─────────────────────────────────
ALTER TABLE activity ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS staff_role   TEXT;

-- ── Doctor-related indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS queue_doctor_id_idx        ON queue(doctor_id) WHERE doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON appointments(doctor_id) WHERE doctor_id IS NOT NULL;

-- ── Doctor follow-ups (doctor's personal patient follow-up list) ──────────────
CREATE TABLE IF NOT EXISTS doctor_follow_ups (
  id           SERIAL PRIMARY KEY,
  doctor_id    INTEGER NOT NULL REFERENCES hospital_doctors(id) ON DELETE CASCADE,
  hospital_id  INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  phone        TEXT,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE doctor_follow_ups DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS doctor_follow_ups_doctor_id_idx ON doctor_follow_ups(doctor_id);

-- ── Appointment reassignment tracking (doctor-to-doctor reassign with notes) ──
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reassigned_from_doctor_id   INTEGER REFERENCES hospital_doctors(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reassigned_from_doctor_name  TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reassignment_note            TEXT;
