import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";
import { sendCallTaskAutomatedMessage } from "../lib/automation.js";
import { verifyHospitalToken, getHospitalFromRequest, getPatientIdsForHospital } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const CallOutcomeBody = z.object({
  outcome: z.string().min(1),
  actionType: z.string().optional(),
});

const UpdateActionTypeBody = z.object({
  actionType: z.enum(["automated_message", "manual_text", "manual_call"]),
});

async function resolveHospitalIntId(usernameOrNull: string | null): Promise<number | null> {
  if (!usernameOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("username", usernameOrNull.toLowerCase()).single();
  return data?.id ?? null;
}

router.get("/call-tasks", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const completed = req.query.completed === "true";

  const patientIds = await getPatientIdsForHospital(hospital.username);
  const safePatientIds = patientIds.length ? patientIds : [-1];

  let q = supabase.from("call_tasks").select("*").in("patient_id", safePatientIds).order("flagged_at", { ascending: true });
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

router.post("/call-tasks/:id/send-message", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  const phone = (task.whatsapp_number as string) || (task.phone as string);
  if (!phone) { res.status(400).json({ error: "No phone number on record for this patient" }); return; }

  const message = await sendCallTaskAutomatedMessage(
    hospitalId,
    task.patient_id as number,
    task.patient_name as string,
    phone,
    task.reason as string,
  );

  await supabase.from("call_tasks")
    .update({ action_type: "automated_message" })
    .eq("id", id);

  await supabase.from("activity").insert({
    type: "automated_message_sent",
    description: `Automated WhatsApp message sent to ${task.patient_name} (call task)`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    metadata: message.slice(0, 200),
  });

  res.json({ ok: true, message });
});

export default router;
