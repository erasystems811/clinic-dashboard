-- ERA Messages doctor routing
ALTER TABLE patient_hospital_connections
  ADD COLUMN IF NOT EXISTS routed_to_doctor_id INTEGER REFERENCES hospital_doctors(id),
  ADD COLUMN IF NOT EXISTS era_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS doctor_replied BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_phc_routed_doctor ON patient_hospital_connections(routed_to_doctor_id);
CREATE INDEX IF NOT EXISTS idx_phc_era_status ON patient_hospital_connections(era_status);
