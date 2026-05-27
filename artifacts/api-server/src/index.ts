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

// Migration: rename legacy "Post Care" stage to "Active" in the DB.
async function migratePostCareStage() {
  const { error, count } = await supabase
    .from("patients")
    .update({ stage: "Active" })
    .eq("stage", "Post Care");
  if (error) logger.warn({ err: error }, "[migration] Failed to migrate Post Care → Active");
  else if (count) logger.info(`[migration] Renamed ${count} patient(s) from "Post Care" to "Active"`);
}

// Migration: patients with active care plans but stuck at "Active" or "Post Care"
// (those are the genuinely stuck records — stage update during care plan creation failed).
// "Post Treatment" + care plan is valid and must NOT be overwritten.
async function migrateStuckInCareStage() {
  const { data: planRows, error: planErr } = await supabase
    .from("care_plans")
    .select("patient_id");
  if (planErr) { logger.warn({ err: planErr }, "[migration] Failed to query care_plans"); return; }

  const patientIds = [...new Set((planRows ?? []).map(r => r.patient_id as number))];
  if (patientIds.length === 0) return;

  // Only fix patients who are genuinely stuck at "Active" or "Post Care" — those were
  // never properly transitioned to "In Care". Leave "Post Treatment", "Dormant" etc. alone.
  const { error, count } = await supabase
    .from("patients")
    .update({ stage: "In Care" })
    .in("id", patientIds)
    .in("stage", ["Active", "Post Care"]);
  if (error) logger.warn({ err: error }, "[migration] Failed to fix stuck In Care stage");
  else if (count) logger.info(`[migration] Fixed ${count} patient(s) stuck at Active with active care plans`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  reloadSupabaseSchema();
  migratePostCareStage();
  migrateStuckInCareStage();
});
