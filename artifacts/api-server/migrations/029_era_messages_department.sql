-- ERA Messages department-based routing
ALTER TABLE patient_hospital_connections
  ADD COLUMN IF NOT EXISTS conversation_department TEXT;

CREATE INDEX IF NOT EXISTS idx_phc_conversation_department ON patient_hospital_connections(conversation_department);
