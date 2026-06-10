-- Tracks whether a hospital's Termii Sender ID has been approved by Termii.
-- Set to TRUE by super admin once Termii confirms approval.
-- smsReady logic: Africa's Talking configured OR (sender ID exists AND this is TRUE).
-- Run in Supabase SQL Editor.

ALTER TABLE hospital_settings
  ADD COLUMN IF NOT EXISTS sms_sender_id_approved BOOLEAN NOT NULL DEFAULT FALSE;
