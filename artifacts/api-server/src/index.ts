import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler.js";
import { supabase } from "./lib/supabase.js";

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
async function migrateHospitalIdColumns() {
  const projectRef = (process.env.SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !token) {
    logger.warn("[migration] SUPABASE_ACCESS_TOKEN not set — skipping hospital_id column migration");
    return;
  }
  const sql = `
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);
    ALTER TABLE call_tasks   ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);
    UPDATE appointments a
      SET hospital_id = h.id
      FROM patients p JOIN hospitals h ON h.username = p.hospital_id
      WHERE a.patient_id = p.id AND a.hospital_id IS NULL;
    UPDATE call_tasks ct
      SET hospital_id = h.id
      FROM patients p JOIN hospitals h ON h.username = p.hospital_id
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
// Safe to run multiple times — only updates rows that still contain the old username value.
async function migrateHospitalIdToCode() {
  try {
    const { data: hospitals } = await supabase.from("hospitals").select("id, username, hospital_code");
    for (const h of hospitals ?? []) {
      const code = h.hospital_code as string | null;
      const username = h.username as string;
      if (!code || !username) continue;
      await supabase.from("patients").update({ hospital_id: code }).eq("hospital_id", username);
      await supabase.from("care_plans").update({ hospital_id: code }).eq("hospital_id", username);
      await supabase.from("queue").update({ hospital_id: code }).eq("hospital_id", username);
    }
    logger.info("[migration] hospital_id migrated from username to hospital_code in patients, care_plans, queue");
  } catch (err) {
    logger.warn({ err }, "[migration] hospital_id code migration error (non-fatal)");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  reloadSupabaseSchema();
  migrateHospitalIdColumns();
  migratePostCareStage();
  migrateInCareStageColumn();
  migrateHospitalIdToCode();
});
