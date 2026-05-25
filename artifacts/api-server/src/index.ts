import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler.js";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  reloadSupabaseSchema();
});
