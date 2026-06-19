import { Router } from "express";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { requireSuperAdmin } from "./super-admin.js";

const router = Router();

const RegisterBody = z.object({
  sessionId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
});

const ProgressBody = z.object({
  sessionId: z.string().min(1),
  stageReached: z.string().min(1),
  completed: z.boolean().optional(),
});

// POST /api/demo/register — called at the start of a demo session
router.post("/demo/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });

  const { sessionId, firstName, lastName, phone } = parsed.data;

  const { error } = await supabase.from("demo_sessions").upsert({
    session_id: sessionId,
    first_name: firstName,
    last_name: lastName,
    phone,
  }, { onConflict: "session_id" });

  if (error) {
    console.error("[demo] register error:", error.message);
    return void res.status(500).json({ error: "Failed to save session" });
  }

  res.json({ ok: true, sessionId });
});

// POST /api/demo/progress — update which scene the prospect reached
router.post("/demo/progress", async (req, res) => {
  const parsed = ProgressBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });

  const { sessionId, stageReached, completed } = parsed.data;

  const update: Record<string, unknown> = { stage_reached: stageReached };
  if (completed) {
    update.completed = true;
    update.completed_at = new Date().toISOString();
  }

  await supabase.from("demo_sessions").update(update).eq("session_id", sessionId);
  res.json({ ok: true });
});

// GET /api/demo/sessions — super-admin only, list all demo prospects
router.get("/demo/sessions", requireSuperAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from("demo_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) return void res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

export default router;
