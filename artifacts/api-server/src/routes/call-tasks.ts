import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";
import {
  generateCallTaskDraft,
  sendCallTaskConfirmedMessage,
  sendCallTaskManualEmail,
} from "../lib/automation.js";
import { verifyHospitalToken, getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const CallOutcomeBody = z.object({
  outcome: z.string().min(1),
  actionType: z.string().optional(),
});

const UpdateActionTypeBody = z.object({
  actionType: z.enum(["manual_text", "manual_call"]),
});

const SendMessageConfirmBody = z.object({
  message: z.string().min(1),
});

const SendManualEmailBody = z.object({
  message: z.string().min(1),
});

async function resolveHospitalIntId(hospitalCodeOrNull: string | null): Promise<number | null> {
  if (!hospitalCodeOrNull) return null;
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCodeOrNull).single();
  return data?.id ?? null;
}

const DEFAULT_AI_DRAFT_DAILY_LIMIT = 20;

async function getDailyDraftCount(hospitalId: number): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("automation_log")
    .select("*", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("automation_type", "call_task_draft_generated")
    .gte("created_at", `${today}T00:00:00Z`)
    .lte("created_at", `${today}T23:59:59Z`);
  return count ?? 0;
}

async function getAiDraftDailyLimit(hospitalId: number): Promise<number> {
  const { data } = await supabase
    .from("hospital_settings")
    .select("call_task_ai_daily_limit")
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  return (data?.call_task_ai_daily_limit as number | null) ?? DEFAULT_AI_DRAFT_DAILY_LIMIT;
}

// ── Daily automated message rate limit check ──────────────────────────────────
// Max 5 automated messages (call_task_automated) per hospital per calendar day.
async function getDailyAutomatedCount(hospitalId: number): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("automation_log")
    .select("*", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("automation_type", "call_task_automated")
    .eq("status", "sent")
    .gte("created_at", `${today}T00:00:00Z`)
    .lte("created_at", `${today}T23:59:59Z`);
  return count ?? 0;
}

router.get("/call-tasks/ai-draft-count", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const hospitalIntId = await (async () => {
    const { data } = await supabase.from("hospitals").select("id").eq("username", hospital.username.toLowerCase()).single();
    return data?.id ?? null;
  })();

  if (!hospitalIntId) { res.json({ dailyCount: 0, dailyLimit: DEFAULT_AI_DRAFT_DAILY_LIMIT }); return; }

  const [count, dailyLimit] = await Promise.all([
    getDailyDraftCount(hospitalIntId),
    getAiDraftDailyLimit(hospitalIntId),
  ]);
  res.json({ dailyCount: count, dailyLimit });
});

router.get("/call-tasks", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("call_tasks")
    .select("*")
    .eq("hospital_id", hospital.intId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("flagged_at", { ascending: true })
    .limit(200);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map((t) => camelize(t)));
});

router.patch("/call-tasks/:id/outcome", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CallOutcomeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .update({ outcome: parsed.data.outcome, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("hospital_id", hospital.intId)
    .select()
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  const performedByOutcome = (req.headers["x-performed-by"] as string | undefined) || null;
  await supabase.from("activity").insert({
    type: "call_task_completed",
    description: `${performedByOutcome ?? "Staff"} completed a follow-up task for ${task.patient_name}`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    hospital_id: hospital.intId,
    metadata: parsed.data.outcome,
    performed_by: performedByOutcome,
  });

  res.json(camelize(task));
});

router.patch("/call-tasks/:id/action-type", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdateActionTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .update({ action_type: parsed.data.actionType })
    .eq("id", id)
    .eq("hospital_id", hospital.intId)
    .select()
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  const performedByAction = (req.headers["x-performed-by"] as string | undefined) || null;
  await supabase.from("activity").insert({
    type: "call_task_action_updated",
    description: `${performedByAction ?? "Staff"} changed follow-up method to ${parsed.data.actionType} for ${task.patient_name}`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    hospital_id: hospital.intId,
    metadata: parsed.data.actionType,
    performed_by: performedByAction,
  });

  res.json(camelize(task));
});

// ── Generate AI draft — does NOT send, returns draft for receptionist to review ─
router.post("/call-tasks/:id/generate-draft", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [currentCount, dailyLimit] = await Promise.all([
    getDailyDraftCount(hospitalId),
    getAiDraftDailyLimit(hospitalId),
  ]);
  if (currentCount >= dailyLimit) {
    res.status(429).json({ error: `Daily AI generation limit reached (${dailyLimit}/day)`, dailyCount: currentCount, dailyLimit });
    return;
  }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .select("*")
    .eq("id", id)
    .eq("hospital_id", hospitalId)
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  try {
    const draft = await generateCallTaskDraft(
      hospitalId,
      task.patient_id as number,
      task.patient_name as string,
      task.reason as string,
    );

    await supabase.from("automation_log").insert({
      hospital_id: hospitalId,
      automation_type: "call_task_draft_generated",
      status: "sent",
    });

    const newCount = currentCount + 1;
    res.json({ draft, dailyCount: newCount, dailyLimit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: msg });
  }
});

// ── Confirm and send the reviewed AI draft as an Important email ───────────────
router.post("/call-tasks/:id/send-message", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SendMessageConfirmBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "message is required" }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .select("*")
    .eq("id", id)
    .eq("hospital_id", hospitalId)
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  // Fetch email directly from patients — avoids relying on a FK join
  const { data: patientRow } = await supabase
    .from("patients")
    .select("email")
    .eq("id", task.patient_id as number)
    .maybeSingle();
  const email = patientRow?.email as string | undefined;
  if (!email) { res.status(400).json({ error: "No email on record for this patient" }); return; }

  try {
    const { sentViaSms, insufficientFunds, senderIdMissing, dndBlocked } = await sendCallTaskConfirmedMessage(
      hospitalId,
      task.patient_id as number,
      task.patient_name as string,
      email,
      parsed.data.message,
    );

    const performedBy = (req.headers["x-performed-by"] as string | undefined) || null;
    await supabase.from("call_tasks").update({ action_type: "automated_message" }).eq("id", id);
    await supabase.from("activity").insert({
      type: "automated_message_sent",
      description: sentViaSms
        ? `SMS sent to ${task.patient_name} via call task`
        : `Important email sent to ${task.patient_name} via call task`,
      patient_id: task.patient_id,
      patient_name: task.patient_name,
      hospital_id: hospitalId,
      metadata: parsed.data.message.slice(0, 200),
      performed_by: performedBy,
    });

    res.json({ ok: true, sentViaSms, insufficientFunds, senderIdMissing, dndBlocked });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    res.status(500).json({ error: msg });
  }
});

// ── Manual email — sends as Important email to patient ────────────────────────
router.post("/call-tasks/:id/send-manual-email", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SendManualEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "message is required" }); return; }

  const { data: task, error } = await supabase
    .from("call_tasks")
    .select("*")
    .eq("id", id)
    .eq("hospital_id", hospitalId)
    .single();

  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  // Fetch email directly from patients — avoids relying on a FK join
  const { data: patientRow } = await supabase
    .from("patients")
    .select("email")
    .eq("id", task.patient_id as number)
    .maybeSingle();
  const email = patientRow?.email as string | undefined;
  if (!email) { res.status(400).json({ error: "No email on record for this patient" }); return; }

  try {
    await sendCallTaskManualEmail(
      hospitalId,
      task.patient_id as number,
      task.patient_name as string,
      email,
      parsed.data.message,
    );

    const performedByEmail = (req.headers["x-performed-by"] as string | undefined) || null;
    await supabase.from("call_tasks").update({ action_type: "manual_text" }).eq("id", id);
    await supabase.from("activity").insert({
      type: "manual_email_sent",
      description: `${performedByEmail ? `${performedByEmail} sent an important email to` : "Important email sent to"} ${task.patient_name}`,
      patient_id: task.patient_id,
      patient_name: task.patient_name,
      hospital_id: hospitalId,
      metadata: parsed.data.message.slice(0, 200),
      performed_by: performedByEmail,
    });

    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    res.status(500).json({ error: msg });
  }
});

// ── Send directly to patient's ERA app chat (no email/SMS) ───────────────────
router.post("/call-tasks/:id/send-era", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SendMessageConfirmBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "message is required" }); return; }

  const { data: task, error } = await supabase.from("call_tasks").select("*").eq("id", id).eq("hospital_id", hospitalId).single();
  if (error || !task) { res.status(404).json({ error: "Call task not found" }); return; }

  const patientId = task.patient_id as number;

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("id, account_id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();

  if (!conn) { res.status(404).json({ error: "Patient is not connected to the hospital on the ERA app" }); return; }

  await supabase.from("patient_hospital_messages").insert({
    connection_id: conn.id as number,
    sender: "hospital",
    message_type: "text",
    content: parsed.data.message,
    metadata: {},
  });

  if (conn.account_id) {
    void supabase.from("patient_notifications").insert({
      account_id: conn.account_id as number,
      type: "message",
      title: "New message from your hospital",
      body: parsed.data.message.slice(0, 100),
      metadata: { connectionId: conn.id },
    });
  }

  const performedBy = (req.headers["x-performed-by"] as string | undefined) || null;
  await supabase.from("call_tasks").update({ action_type: "manual_text" }).eq("id", id);
  await supabase.from("activity").insert({
    type: "era_message_sent",
    description: `${performedBy ?? "Staff"} sent follow-up to ${task.patient_name as string} via ERA app`,
    patient_id: patientId,
    patient_name: task.patient_name as string,
    hospital_id: hospitalId,
    metadata: parsed.data.message.slice(0, 200),
    performed_by: performedBy,
  });

  res.json({ ok: true });
});

router.delete("/call-tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: task } = await supabase
    .from("call_tasks")
    .select("patient_id, patient_name")
    .eq("id", id)
    .eq("hospital_id", hospital.intId)
    .single();

  if (!task) { res.status(404).json({ error: "Call task not found" }); return; }

  await supabase.from("call_tasks").delete().eq("id", id).eq("hospital_id", hospital.intId);

  const performedBy = (req.headers["x-performed-by"] as string | undefined) || null;
  await supabase.from("activity").insert({
    type: "call_task_deleted",
    description: `${performedBy ?? "Staff"} deleted a follow-up task for ${task.patient_name}`,
    patient_id: task.patient_id,
    patient_name: task.patient_name,
    hospital_id: hospital.intId,
    performed_by: performedBy,
  });

  res.sendStatus(204);
});

export default router;
