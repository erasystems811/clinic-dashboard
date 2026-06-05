-- Add optional module targeting to announcements
-- If set, only hospitals with that module enabled will see the announcement

ALTER TABLE hospital_announcements
  ADD COLUMN IF NOT EXISTS target_module TEXT
    CHECK (target_module IN ('appointments', 'feedback', 'wellness_newsletter', 'messages'));
