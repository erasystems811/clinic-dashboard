-- Enable pgvector for RAG embeddings
create extension if not exists vector;

-- ── RAG knowledge base ────────────────────────────────────────────────────────
-- Stores chunked + embedded documents uploaded by admin for weight loss coach
-- and diary companion to use as supplementary context.
create table if not exists rag_documents (
  id          bigserial primary key,
  title       text not null,
  category    text not null check (category in ('weightloss','psychology','nutrition','fitness','general')),
  source      text,                        -- filename or URL
  chunk_index integer not null default 0,
  content     text not null,
  embedding   vector(1536),               -- OpenAI text-embedding-3-small
  uploaded_by text,
  created_at  timestamptz not null default now()
);

create index if not exists rag_documents_category_idx on rag_documents(category);
-- Vector similarity index (cosine) for fast retrieval
create index if not exists rag_documents_embedding_idx
  on rag_documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ── Weight loss profile (onboarding answers + calculated targets) ─────────────
create table if not exists weightloss_profile (
  id                    bigserial primary key,
  account_id            bigint not null unique references patient_accounts(id) on delete cascade,
  -- Body stats
  current_weight_kg     numeric(5,1) not null,
  goal_weight_kg        numeric(5,1) not null,
  height_cm             integer not null,
  -- Goals
  timeline_weeks        integer not null,
  -- Lifestyle
  lifestyle             text not null,   -- student|working_office|working_physical|stay_home|business
  cooking_ability       text not null,   -- love_cooking|can_cook|limited|rarely|cant_cook
  budget                text not null,   -- tight|moderate|comfortable
  food_preferences      jsonb not null default '[]',  -- ["no_pork","vegetarian",...]
  -- Schedule
  wake_time             text not null default '07:00',
  sleep_time            text not null default '23:00',
  active_period         text not null,   -- morning|afternoon|evening|night
  -- Fasting
  fasting_interested    boolean not null default false,
  fasting_start         text,            -- e.g. "20:00" (previous day)
  fasting_end           text,            -- e.g. "12:00"
  -- Workout
  workout_location      text not null,   -- home|gym|outdoor|any
  workout_days_per_week integer not null default 3,
  -- Medical
  medical_notes         text,
  -- Calculated by server
  bmr                   integer,
  tdee                  integer,
  daily_calorie_target  integer,
  weekly_loss_target_kg numeric(3,2),
  -- Coins + milestone tracking
  total_coins_earned    integer not null default 0,
  cheat_days_available  integer not null default 0,
  -- Meta
  onboarding_complete   boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Weekly weight loss plan ───────────────────────────────────────────────────
create table if not exists weightloss_plan (
  id           bigserial primary key,
  account_id   bigint not null references patient_accounts(id) on delete cascade,
  week_start   date not null,
  plan         jsonb not null,           -- full plan JSON (meals + workouts per day)
  generated_at timestamptz not null default now(),
  unique(account_id, week_start)
);

-- ── Daily logs ────────────────────────────────────────────────────────────────
create table if not exists weightloss_logs (
  id                      bigserial primary key,
  account_id              bigint not null references patient_accounts(id) on delete cascade,
  log_date                date not null,
  -- Meals
  meals_logged            jsonb not null default '[]',
  -- Each entry: {id, name, calories, time, planned_meal_id, is_planned, logged_at}
  total_calories_consumed integer not null default 0,
  meal_adherence_pct      integer,        -- 0–100, computed at end of day
  -- Workouts
  workouts_completed      jsonb not null default '[]',
  -- Each entry: {workout_id, exercise_id, completed, completed_at}
  workout_adherence_pct   integer,        -- 0–100
  -- Weight check-in (optional daily)
  weight_kg               numeric(5,1),
  -- Flags
  cheat_day_used          boolean not null default false,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(account_id, log_date)
);

-- ── Coach adjustments (punishments + rewards) ─────────────────────────────────
create table if not exists weightloss_adjustments (
  id                  bigserial primary key,
  account_id          bigint not null references patient_accounts(id) on delete cascade,
  type                text not null check (type in ('punishment','reward')),
  reason              text not null,      -- "You skipped your evening workout on Monday"
  description         text not null,      -- "I'm adding 15 minutes to Wednesday's session"
  announced_date      date not null,
  applies_date        date not null,
  applied             boolean not null default false,
  -- Punishment fields
  calorie_adjustment  integer not null default 0,   -- negative = reduce target
  workout_mins_extra  integer not null default 0,
  -- Reward fields
  coins_earned        integer not null default 0,
  cheat_day_granted   boolean not null default false,
  milestone_message   text,
  created_at          timestamptz not null default now()
);

create index if not exists weightloss_adjustments_account_date_idx
  on weightloss_adjustments(account_id, applies_date, applied);

-- ── RAG vector search function ────────────────────────────────────────────────
create or replace function rag_search(
  query_embedding vector(1536),
  match_category  text,
  match_count     int default 5
)
returns table(id bigint, content text, similarity float)
language sql stable
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from rag_documents
  where
    (match_category is null or category = match_category)
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
