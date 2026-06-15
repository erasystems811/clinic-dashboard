-- Allow system messages in patient_hospital_messages
ALTER TABLE patient_hospital_messages
  DROP CONSTRAINT IF EXISTS patient_hospital_messages_sender_check;

ALTER TABLE patient_hospital_messages
  ADD CONSTRAINT patient_hospital_messages_sender_check
  CHECK (sender IN ('patient', 'hospital', 'system'));

ALTER TABLE patient_hospital_messages
  DROP CONSTRAINT IF EXISTS patient_hospital_messages_message_type_check;

ALTER TABLE patient_hospital_messages
  ADD CONSTRAINT patient_hospital_messages_message_type_check
  CHECK (message_type IN ('text', 'consultation_request', 'event'));
