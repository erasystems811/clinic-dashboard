-- Optional anniversary date for patients (e.g. wedding anniversary).
-- Nullable — most patients will not provide one. Patients who have it set
-- receive a warm anniversary message each year, mirroring the birthday flow.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS anniversary date;
