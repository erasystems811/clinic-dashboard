-- Patient ↔ Hospital messaging
create table if not exists patient_hospital_messages (
  id bigint generated always as identity primary key,
  connection_id bigint not null references patient_hospital_connections(id) on delete cascade,
  sender text not null check (sender in ('patient', 'hospital')),
  message_type text not null default 'text' check (message_type in ('text', 'consultation_request')),
  content text not null,
  metadata jsonb default '{}',
  hospital_read_at timestamptz,
  patient_read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists patient_hospital_messages_connection_id_idx
  on patient_hospital_messages (connection_id, created_at desc);
