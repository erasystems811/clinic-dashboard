-- Track which doctor a patient was transferred from in the queue
ALTER TABLE queue ADD COLUMN IF NOT EXISTS transferred_from_doctor_name TEXT;
