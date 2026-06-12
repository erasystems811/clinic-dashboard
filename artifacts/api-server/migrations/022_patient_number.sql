-- Allow hospitals to assign their own alphanumeric patient numbers
-- (e.g. "P001", "LUTH/2024/001") independently of the auto-increment id
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_number TEXT;
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(hospital_id, patient_number) WHERE patient_number IS NOT NULL;
