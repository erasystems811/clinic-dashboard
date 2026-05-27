import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr } from "../lib/camel.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { sendCarePlanEmail, sendCarePlanNotification } from "../lib/automation.js";

const router: IRouter = Router();

async function resolveHospitalIntId(username: string): Promise<number | null> {
  const { data } = await supabase.from("hospitals").select("id").eq("username", username.toLowerCase()).single();
  return data?.id ?? null;
}

const CarePlanBody = z.object({
  summary: z.string().min(1),
  department: z.string().min(1),
  templateData: z.any().optional(),
});

// ── List care plans for a patient ──────────────────────────────────────────────
router.get("/patients/:id/care-plans", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("care_plans")
    .select("*")
    .eq("patient_id", patientId)
    .eq("hospital_id", hospital.username)
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(camelizeArr(data ?? []));
});

// ── Create a care plan ─────────────────────────────────────────────────────────
router.post("/patients/:id/care-plans", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CarePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();

  // Insert the care plan
  const { data: plan, error: planErr } = await supabase.from("care_plans").insert({
    patient_id: patientId,
    hospital_id: hospital.username,
    summary: parsed.data.summary,
    department: parsed.data.department,
    template_data: parsed.data.templateData,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).select().single();

  if (planErr || !plan) { res.status(500).json({ error: planErr?.message ?? "Failed to create care plan" }); return; }

  // If General Outpatient, compute treatment end date from templateData duration
  const isGeneralOutpatient = parsed.data.department === "General Outpatient";
  const durationDays = isGeneralOutpatient
    ? (parsed.data.templateData?.durationDays as number | undefined) ?? 1
    : 1;
  const treatmentEndDate = new Date(now);
  treatmentEndDate.setDate(treatmentEndDate.getDate() + durationDays);

  // Creating a care plan always moves the patient to "In Care" — pipeline stage is a reflection of actions.
  // This applies whether the patient was New, Queued, Post Treatment, or any other stage.
  const patientStage = patient.stage as string;
  const wasQueued = patientStage === "Queued";

  const updateData: Record<string, unknown> = {
    stage: "In Care",
    treatment_plan: parsed.data.summary,
    treatment_type: isGeneralOutpatient ? ((parsed.data.templateData?.treatmentType as string) ?? null) : parsed.data.department,
    medication_timing: isGeneralOutpatient
      ? buildTimingString(parsed.data.templateData as GeneralOutpatientData)
      : null,
    department: parsed.data.department,
    treatment_started_at: now.toISOString(),
    treatment_end_date: isGeneralOutpatient ? treatmentEndDate.toISOString().split("T")[0] : null,
    treatment_duration_days: isGeneralOutpatient ? durationDays : null,
    pre_queue_stage: null,
    updated_at: now.toISOString(),
  };

  await supabase.from("patients").update(updateData).eq("id", patientId);

  // Remove from queue if the patient was queued
  if (wasQueued) {
    await supabase.from("queue").delete().eq("patient_id", patientId);
  }

  // Log activity
  const patientName = `${patient.first_name} ${patient.last_name}`;
  const wasReturning = !["New", "Queued", ""].includes(patientStage) && patientStage !== "In Care";
  const activityRows = [
    {
      type: "care_plan_added",
      description: `Care plan added for ${patientName} (${parsed.data.department})`,
      patient_id: patientId,
      patient_name: patientName,
      metadata: parsed.data.summary.slice(0, 200),
    },
    ...(wasReturning ? [{
      type: "stage_changed",
      description: `${patientName} returned to In Care (new care plan created from ${patientStage})`,
      patient_id: patientId,
      patient_name: patientName,
      metadata: "In Care",
    }] : []),
  ];
  await supabase.from("activity").insert(activityRows);

  // Fire automations: Care Plan Summary email + mobile notification
  const hospitalIntId = await resolveHospitalIntId(hospital.username);
  if (hospitalIntId) {
    const email = patient.email as string | null;
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);

    if (phone) {
      sendCarePlanNotification(hospitalIntId, patientId, patientName, phone).catch(() => {});
    }
    if (email) {
      sendCarePlanEmail(
        hospitalIntId, patientId, patientName, email,
        parsed.data.department,
        parsed.data.summary,
        durationDays,
      ).catch(() => {});
    }
  }

  res.status(201).json(camelize(plan));
});

// ── Update a care plan ─────────────────────────────────────────────────────────
router.patch("/care-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CarePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.username).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  const { data: updated, error } = await supabase.from("care_plans").update({
    summary: parsed.data.summary,
    department: parsed.data.department,
    template_data: parsed.data.templateData,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error || !updated) { res.status(500).json({ error: error?.message ?? "Update failed" }); return; }

  // Also update patient's treatment_plan to the summary of the most-recently-updated plan
  await supabase.from("patients").update({
    treatment_plan: parsed.data.summary,
    department: parsed.data.department,
    updated_at: new Date().toISOString(),
  }).eq("id", existing.patient_id as number);

  res.json(camelize(updated));
});

// ── Delete a care plan ─────────────────────────────────────────────────────────
router.delete("/care-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.username).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  await supabase.from("care_plans").delete().eq("id", id);

  const patientId = existing.patient_id as number;
  const now = new Date();

  // Check how many care plans remain for this patient
  const { data: remainingPlans } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("hospital_id", hospital.username);

  const hasPlansLeft = (remainingPlans ?? []).length > 0;

  // If no plans remain, move patient to Post Treatment — stage is a reflection of active care plans
  if (!hasPlansLeft) {
    const today = now.toISOString().split("T")[0];
    await supabase.from("patients").update({
      stage: "Post Treatment",
      treatment_end_date: today,
      treatment_plan: null,
      updated_at: now.toISOString(),
    }).eq("id", patientId);
  }

  // Log activity
  const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).single();
  if (patient) {
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const description = hasPlansLeft
      ? `Care plan ended early for ${patientName} (${existing.department})`
      : `Last care plan ended for ${patientName} — moved to Post Treatment`;
    await supabase.from("activity").insert({
      type: "care_plan_deleted",
      description,
      patient_id: patientId,
      patient_name: patientName,
    });
  }

  res.sendStatus(204);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

interface GeneralOutpatientData {
  treatmentType?: string;
  medicationTiming?: string[];
  medicationTimingTimes?: Record<string, string>;
  hospitalTiming?: string[];
  hospitalTimingTimes?: Record<string, string>;
  durationDays?: number;
}

function buildTimingString(data: GeneralOutpatientData): string | null {
  if (!data) return null;
  const parts: string[] = [
    ...(data.medicationTiming ?? []).map((t) => `med:${t}`),
    ...(data.hospitalTiming ?? []).map((t) => `hosp:${t}`),
  ];
  return parts.length > 0 ? parts.join(",") : null;
}

export default router;
