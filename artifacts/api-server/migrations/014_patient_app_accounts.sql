-- ERA Patient App — patient-facing accounts, sub-accounts, hospital connections

CREATE TABLE IF NOT EXISTS patient_accounts (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  account_type  TEXT NOT NULL DEFAULT 'individual',
  display_name  TEXT,
  gender        TEXT,
  date_of_birth DATE,
  background    TEXT,
  theme_color   TEXT NOT NULL DEFAULT 'blue',
  dark_mode     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_sub_accounts (
  id            SERIAL PRIMARY KEY,
  parent_id     INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  date_of_birth DATE,
  gender        TEXT,
  is_handed_off BOOLEAN NOT NULL DEFAULT FALSE,
  handed_off_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_hospital_connections (
  id                SERIAL PRIMARY KEY,
  account_id        INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  hospital_id       INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_record_id INTEGER NOT NULL,
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, hospital_id)
);

CREATE TABLE IF NOT EXISTS patient_otp_codes (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'register',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_reset_tokens (
  id         SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_otp_email ON patient_otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_phone ON patient_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_patient_connections_account ON patient_hospital_connections(account_id);
