-- ERA Me private companion — diary, AI conversation, personality
CREATE TABLE IF NOT EXISTS companion_settings (
  account_id    INTEGER PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
  pin_hash      TEXT,
  entry_tab     TEXT NOT NULL DEFAULT 'profile',
  personality   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'journal',  -- 'journal' | 'conversation'
  title         TEXT,
  content       TEXT,
  mood          INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diary_messages (
  id            SERIAL PRIMARY KEY,
  entry_id      INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,  -- 'user' | 'assistant'
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_account ON diary_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_messages_entry  ON diary_messages(entry_id, created_at ASC);
