-- Patient wellness coins (reward for completing daily habits)
alter table patient_accounts add column if not exists coins integer not null default 0;

create table if not exists patient_coin_transactions (
  id bigint generated always as identity primary key,
  account_id bigint not null references patient_accounts(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists patient_coin_transactions_account_id_idx
  on patient_coin_transactions (account_id, created_at desc);
