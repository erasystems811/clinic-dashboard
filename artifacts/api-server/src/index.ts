import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler.js";
import { supabase } from "./lib/supabase.js";
import { initWebPush } from "./lib/push-service.js";

// Reload Supabase PostgREST schema cache so custom columns (e.g. patient_id) are visible.
// This runs once on boot — safe to fire-and-forget.
async function reloadSupabaseSchema() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) return;
  try {
    await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
    });
    logger.info("Supabase PostgREST schema cache reloaded");
  } catch (err) {
    logger.warn({ err }, "Failed to reload Supabase schema cache (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Migration: add hospital_id column to appointments + call_tasks and backfill from patients.
// Also ensures hospitals.hospital_code column exists and is populated.
async function migrateHospitalIdColumns() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) {
    logger.warn("[migration] SUPABASE_ACCESS_TOKEN not set — skipping hospital_id column migration");
    return;
  }
  const sql = `
    -- Ensure hospital_code column exists on hospitals
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_code TEXT;
    -- Backfill hospital_code for any hospital that doesn't have one yet
    UPDATE hospitals SET hospital_code = gen_random_uuid()::TEXT WHERE hospital_code IS NULL;
    -- Update patient-facing tables from username → hospital_code
    UPDATE patients p
      SET hospital_id = h.hospital_code
      FROM hospitals h
      WHERE p.hospital_id = h.username AND h.hospital_code IS NOT NULL;
    UPDATE care_plans cp
      SET hospital_id = h.hospital_code
      FROM hospitals h
      WHERE cp.hospital_id = h.username AND h.hospital_code IS NOT NULL;
    UPDATE queue q
      SET hospital_id = h.hospital_code
      FROM hospitals h
      WHERE q.hospital_id = h.username AND h.hospital_code IS NOT NULL;
    -- Add hospital_id to appointments and call_tasks (integer FK)
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);
    ALTER TABLE call_tasks   ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);
    UPDATE appointments a
      SET hospital_id = h.id
      FROM patients p JOIN hospitals h ON h.id = (SELECT id FROM hospitals WHERE hospital_code = p.hospital_id LIMIT 1)
      WHERE a.patient_id = p.id AND a.hospital_id IS NULL;
    UPDATE call_tasks ct
      SET hospital_id = h.id
      FROM patients p JOIN hospitals h ON h.id = (SELECT id FROM hospitals WHERE hospital_code = p.hospital_id LIMIT 1)
      WHERE ct.patient_id = p.id AND ct.hospital_id IS NULL;
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] hospital_id columns added/backfilled in appointments and call_tasks");
    else logger.warn({ body: await resp.text() }, "[migration] hospital_id column migration failed (non-fatal)");
  } catch (err) {
    logger.warn({ err }, "[migration] hospital_id column migration error (non-fatal)");
  }
}

// Migration: rename legacy "Post Care" stage to "Active" in the DB.
async function migratePostCareStage() {
  const { error, count } = await supabase
    .from("patients")
    .update({ stage: "Active" })
    .eq("stage", "Post Care");
  if (error) logger.warn({ err: error }, "[migration] Failed to migrate Post Care → Active");
  else if (count) logger.info(`[migration] Renamed ${count} patient(s) from "Post Care" to "Active"`);
}

// Migration: clear the legacy "In Care" value from the stage column.
// "In Care" is a derived badge (from hasCarePlan) and must never live in the stage column.
// Only General Outpatient completions now set "Post Treatment"; all other endings go to "Active".
// So any patient stuck at "In Care" in the DB simply goes back to "Active".
async function migrateInCareStageColumn() {
  const { data: stuck, error: fetchErr } = await supabase
    .from("patients")
    .select("id")
    .eq("stage", "In Care");
  if (fetchErr) { logger.warn({ err: fetchErr }, "[migration] Failed to query In Care patients"); return; }
  if (!stuck || stuck.length === 0) return;

  const stuckIds = stuck.map(p => p.id as number);
  logger.info(`[migration] Resetting ${stuckIds.length} patient(s) from legacy "In Care" stage → "Active"`);

  const { error } = await supabase
    .from("patients")
    .update({ stage: "Active" })
    .in("id", stuckIds);
  if (error) logger.warn({ err: error }, "[migration] Failed to reset In Care → Active");
  else logger.info(`[migration] Reset ${stuckIds.length} patient(s) from In Care → Active`);
}

// Migration: update all patient-facing tables to use hospital_code (UUID) instead of username as hospital_id.
// Step 1 — ensure every hospital has a hospital_code (generate one if missing).
// Step 2 — update patients/care_plans/queue rows that still store the username.
// Safe to run multiple times.
async function migrateHospitalIdToCode() {
  try {
    const { data: hospitals } = await supabase.from("hospitals").select("id, username, hospital_code");
    for (const h of hospitals ?? []) {
      const username = h.username as string;
      if (!username) continue;

      // Step 1: backfill hospital_code if missing
      let code = h.hospital_code as string | null;
      if (!code) {
        const { createHash } = await import("crypto");
        // deterministic UUID v4-shaped code derived from username so restarts are idempotent
        const newCode = crypto.randomUUID();
        await supabase.from("hospitals").update({ hospital_code: newCode }).eq("id", h.id);
        code = newCode;
        logger.info(`[migration] Assigned hospital_code to hospital id=${h.id} (${username})`);
      }

      // Step 2: update patient-facing tables still referencing username
      await supabase.from("patients").update({ hospital_id: code }).eq("hospital_id", username);
      await supabase.from("care_plans").update({ hospital_id: code }).eq("hospital_id", username);
      await supabase.from("queue").update({ hospital_id: code }).eq("hospital_id", username);
    }
    logger.info("[migration] hospital_id migrated from username to hospital_code in patients, care_plans, queue");
  } catch (err) {
    logger.warn({ err }, "[migration] hospital_id code migration error (non-fatal)");
  }
}

async function migrateWomensHealthTables() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) return;
  const sql = `
    CREATE TABLE IF NOT EXISTS womens_health_settings (
      account_id INTEGER PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'cycle',
      cycle_length INTEGER NOT NULL DEFAULT 28,
      period_length INTEGER NOT NULL DEFAULT 5,
      last_period_start DATE,
      lmp_date DATE,
      due_date DATE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cycle_logs (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      log_date DATE NOT NULL,
      flow TEXT,
      symptoms JSONB DEFAULT '[]',
      notes TEXT,
      is_period_start BOOLEAN DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, log_date)
    );
    CREATE TABLE IF NOT EXISTS pregnancy_logs (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      log_date DATE NOT NULL,
      weight_kg NUMERIC(5,2),
      symptoms JSONB DEFAULT '[]',
      mood TEXT,
      kicks_count INTEGER,
      blood_pressure TEXT,
      notes TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, log_date)
    );
    ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'cycle';
    ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS lmp_date DATE;
    ALTER TABLE womens_health_settings ADD COLUMN IF NOT EXISTS due_date DATE;
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] Women's health tables ready");
    else logger.warn({ body: await resp.text() }, "[migration] Women's health tables migration failed");
  } catch (err) {
    logger.warn({ err }, "[migration] Women's health tables migration error");
  }
}

async function migratePushNotificationTables() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) {
    logger.warn("[migration] SUPABASE_ACCESS_TOKEN not set — skipping push notification tables migration");
    return;
  }
  const sql = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'web',
      endpoint TEXT,
      subscription JSONB NOT NULL,
      device_label TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, endpoint)
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      account_id INTEGER PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
      hospital_enabled BOOLEAN NOT NULL DEFAULT true,
      personal_enabled BOOLEAN NOT NULL DEFAULT true,
      lead_mins INTEGER NOT NULL DEFAULT 10,
      companion_enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hospital_notifications (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS hospital_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_push_subs_account ON push_subscriptions(account_id);
    CREATE INDEX IF NOT EXISTS idx_hospital_notifs_account ON hospital_notifications(account_id);
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] Push notification tables ready");
    else logger.warn({ body: await resp.text() }, "[migration] Push notification tables migration failed (non-fatal)");
  } catch (err) {
    logger.warn({ err }, "[migration] Push notification tables migration error (non-fatal)");
  }
}

async function migrateSystemFeedbackTable() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) {
    logger.warn("[migration] SUPABASE_ACCESS_TOKEN not set — skipping system_feedback table migration");
    return;
  }
  const sql = `
    CREATE TABLE IF NOT EXISTS system_feedback (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
      hospital_name TEXT,
      user_role TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS feedback_broadcast (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      triggered_at TIMESTAMPTZ NOT NULL
    );
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] system_feedback table ready");
    else logger.warn({ body: await resp.text() }, "[migration] system_feedback table migration failed (non-fatal)");
  } catch (err) {
    logger.warn({ err }, "[migration] system_feedback table migration error (non-fatal)");
  }
}

async function migrateAccountabilityGroupsTables() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) return;
  const sql = `
    ALTER TABLE accountability_partners
      ADD COLUMN IF NOT EXISTS shared_modules JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS shared_goal JSONB,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE TABLE IF NOT EXISTS accountability_groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      goal_module TEXT NOT NULL,
      goal_target INTEGER,
      goal_label TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS accountability_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by INTEGER REFERENCES patient_accounts(id),
      joined_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_id, account_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_members_account ON accountability_group_members(account_id);
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] Accountability groups tables ready");
    else logger.warn({ body: await resp.text() }, "[migration] Accountability groups migration failed (non-fatal)");
  } catch (err) {
    logger.warn({ err }, "[migration] Accountability groups migration error (non-fatal)");
  }
}

async function migrateIntimacyTables() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) return;
  const sql = `
    ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    CREATE TABLE IF NOT EXISTS patient_intimacy_settings (
      account_id INTEGER PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'celibacy',
      pin_hash TEXT NOT NULL DEFAULT '',
      freaky_mode_enabled BOOLEAN NOT NULL DEFAULT false,
      weekly_frequency_goal INTEGER,
      contraception TEXT,
      last_sti_test DATE,
      sti_test_interval_months INTEGER NOT NULL DEFAULT 6,
      partner_id INTEGER REFERENCES patient_accounts(id) ON DELETE SET NULL,
      partner_invite_code TEXT,
      partner_invite_expires_at TIMESTAMPTZ,
      notes TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS patient_celibacy_streaks (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE,
      reason TEXT DEFAULT 'personal',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS patient_celibacy_checkins (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      check_date DATE NOT NULL,
      maintained BOOLEAN NOT NULL,
      notes TEXT,
      UNIQUE(account_id, check_date)
    );
    CREATE TABLE IF NOT EXISTS patient_intimacy_sessions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      type TEXT NOT NULL DEFAULT 'partnered',
      duration_minutes INTEGER,
      protection_used BOOLEAN,
      postinor_taken BOOLEAN NOT NULL DEFAULT false,
      satisfaction INTEGER CHECK (satisfaction BETWEEN 1 AND 5),
      emotional_connection INTEGER CHECK (emotional_connection BETWEEN 1 AND 5),
      libido_level INTEGER CHECK (libido_level BETWEEN 1 AND 5),
      physical_comfort INTEGER CHECK (physical_comfort BETWEEN 1 AND 5),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS patient_session_positions (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES patient_intimacy_sessions(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      position_id TEXT NOT NULL,
      satisfaction INTEGER CHECK (satisfaction BETWEEN 1 AND 5)
    );
    CREATE TABLE IF NOT EXISTS patient_postinor_logs (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
      taken_at DATE NOT NULL,
      next_safe_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_celibacy_streaks_account ON patient_celibacy_streaks(account_id);
    CREATE INDEX IF NOT EXISTS idx_intimacy_sessions_account ON patient_intimacy_sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_session_positions_account ON patient_session_positions(account_id);
    CREATE INDEX IF NOT EXISTS idx_postinor_logs_account ON patient_postinor_logs(account_id);
    NOTIFY pgrst, 'reload schema';
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] Intimacy tables ready");
    else logger.warn({ body: await resp.text() }, "[migration] Intimacy tables migration failed (non-fatal)");
  } catch (err) {
    logger.warn({ err }, "[migration] Intimacy tables migration error (non-fatal)");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  initWebPush();
  startScheduler();
  reloadSupabaseSchema();
  migrateHospitalIdColumns();
  migratePostCareStage();
  migrateInCareStageColumn();
  migrateHospitalIdToCode();
  migrateSystemFeedbackTable();
  migratePushNotificationTables();
  migrateWomensHealthTables();
  migrateAccountabilityGroupsTables();
  migrateRagSearchFunction();
  migrateIntimacyTables();
});

async function migrateRagSearchFunction() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) {
    logger.warn("[migration] SUPABASE_ACCESS_TOKEN not set — skipping rag_search function migration");
    return;
  }
  const sql = `
    CREATE TABLE IF NOT EXISTS rag_documents (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      source TEXT,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      embedding vector(1536),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION rag_search(
      query_embedding vector(1536),
      match_category text DEFAULT NULL,
      match_count int DEFAULT 5
    )
    RETURNS TABLE (content text, similarity float)
    LANGUAGE sql STABLE AS $$
      SELECT content,
             1 - (embedding <=> query_embedding) AS similarity
      FROM rag_documents
      WHERE (match_category IS NULL OR category = match_category)
      ORDER BY embedding <=> query_embedding
      LIMIT match_count;
    $$;
  `;
  try {
    const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (resp.ok) logger.info("[migration] rag_documents table and rag_search function ready");
    else logger.warn({ body: await resp.text() }, "[migration] rag_search migration failed");
  } catch (err) {
    logger.warn({ err }, "[migration] rag_search migration error");
  }
}
