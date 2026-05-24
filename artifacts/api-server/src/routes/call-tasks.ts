import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const CallOutcomeBody = z.object({
  outcome: z.string().min(1),
  actionType: z.string().optional(),
});

const UpdateActionTypeBody = z.object({
  actionType: z.enum(["automated_message", "manual_text", "manual_call"]),
});

router.get("/call-tasks", async (req, res): Promise<void> => {
  const completed = req.query.completed === "true";

  let q = supabase.from("call_tasks").select("*").order("flagged_at", { ascending: true });
  if (completed) {
    q = q.not("completed_at", "is", null);
  } else {
    q = q.is("completed_at", null);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map((t) => camelize(t)));
});

router.patch("/call-tasks/:id/outcome", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CallOutcomeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .update({ outcome: parsed.data.outcome, completed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  await supabase.from("activity").insert({
    type: "call_task_completed",
    description: `Call task completed for ${task.patient_name} (${task.action_type}): ${parsed.data.outcome}`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    metadata: parsed.data.outcome,
  });

  res.json(camelize(task));
});

router.patch("/call-tasks/:id/action-type", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateActionTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .update({ action_type: parsed.data.actionType })
    .eq("id", id)
    .select()
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  await supabase.from("activity").insert({
    type: "call_task_action_updated",
    description: `Follow-up method changed to ${parsed.data.actionType} for ${task.patient_name}`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    metadata: parsed.data.actionType,
  });

  res.json(camelize(task));
});

export default router;
