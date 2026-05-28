import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr } from "../lib/camel.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { sendCarePlanEmail, sendCarePlanNotification } from "../lib/automation.js";

const router: IRouter = Router();

async function resolveHospitalIntId(hospitalCode: string): Promise<number | null> {
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCode).single();
  return data?.id ?? null;
}

const CarePlanBody = z.object({
  summary: z.string().min(1),
  department: z.string().min(1),
  templateData: z.any().optional(),
});

// ── List care plans for a patient ──────────────────────────────────────────────
// Includes a lazy migration: if the patient has no care_plans rows but has a
// treatment_plan written to the patients table (old data), a real care_plans row
// is created from that legacy data so the "End Early" button and history display work.
router.get("/patients/:id/care-plans", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("care_plans")
    .select("*")
    .eq("patient_id", patientId)
    .eq("hospital_id", hospital.code)
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Lazy migration: old patients have treatment_plan on the patients row but no
  // care_plans rows yet. Create one now so the new UI works transparently.
  if ((data ?? []).length === 0) {
    const { data: patient } = await supabase
      .from("patients")
      .select("treatment_plan, treatment_type, department, treatment_started_at, treatment_end_date, hospital_id, first_name, last_name")
      .eq("id", patientId)
      .single();

    if (patient && patient.treatment_plan) {
      const createdAt = patient.treatment_started_at ?? new Date().toISOString();
      const dept = (patient.department as string | null) || (patient.treatment_type as string | null) || "General";
      const summary = patient.treatment_plan as string;

      const { data: migrated, error: mErr } = await supabase.from("care_plans").insert({
        patient_id: patientId,
        hospital_id: hospital.code,
        summary,
        department: dept,
        template_data: patient.treatment_end_date
          ? { legacyEndDate: patient.treatment_end_date, migratedFromPatientRow: true }
          : { migratedFromPatientRow: true },
        created_at: createdAt,
        updated_at: createdAt,
      }).select().single();

      if (!mErr && migrated) {
        return void res.json(camelizeArr([migrated]));
      }
    }
  }

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
    hospital_id: hospital.code,
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

  // "In Care" is a derived badge (from hasCarePlan), never a stored stage value.
  // Only transition stage when the patient is still "New" — move them to "Active"
  // so they graduate out of the onboarding state. All other stages are preserved:
  //   Active/Dormant → stays (In Care overlay will appear from hasCarePlan)
  //   Post Treatment → stays (both Post Treatment + In Care badges will show)
  //   In Care (legacy) → stays (already handled by getPatientStages)
  if (!patient.stage || patient.stage === "New") {
    const { error: stageErr } = await supabase.from("patients")
      .update({ stage: "Active", updated_at: now.toISOString() })
      .eq("id", patientId);
    if (stageErr) console.error("[care-plans] stage update failed:", stageErr);
  }

  const { error: metaErr } = await supabase.from("patients").update({
    treatment_plan: parsed.data.summary,
    treatment_type: isGeneralOutpatient ? ((parsed.data.templateData?.treatmentType as string) ?? null) : parsed.data.department,
    medication_timing: isGeneralOutpatient
      ? buildTimingString(parsed.data.templateData as GeneralOutpatientData)
      : null,
    department: parsed.data.department,
    treatment_started_at: now.toISOString(),
    treatment_duration_days: durationDays,
    treatment_end_date: treatmentEndDate.toISOString().split("T")[0],
    pre_queue_stage: null,
  }).eq("id", patientId);
  if (metaErr) console.error("[care-plans] metadata update failed:", metaErr);

  // Remove from queue (patient is now admitted to care)
  await supabase.from("queue").delete().eq("patient_id", patientId);

  // Log activity
  const patientName = `${patient.first_name} ${patient.last_name}`;
  await supabase.from("activity").insert({
    type: "care_plan_added",
    description: `Care plan added for ${patientName} (${parsed.data.department})`,
    patient_id: patientId,
    patient_name: patientName,
    metadata: parsed.data.summary.slice(0, 200),
  });

  // Fire automations: WhatsApp notification fires immediately;
  // care plan summary EMAIL is delayed 20 minutes via the scheduler
  // (so minor adjustments can be made before the patient receives it)
  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (hospitalIntId) {
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);
    if (phone) {
      sendCarePlanNotification(hospitalIntId, patientId, patientName, phone).catch(() => {});
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

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
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

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  await supabase.from("care_plans").delete().eq("id", id);

  // Check if this was the patient's last care plan
  const { data: remaining } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", existing.patient_id as number)
    .eq("hospital_id", hospital.code);

  const { data: patient } = await supabase.from("patients").select("first_name, last_name, stage").eq("id", existing.patient_id as number).single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  if (!remaining || remaining.length === 0) {
    // No more care plans — only General Outpatient completions trigger Post Treatment.
    // All other departments return the patient to Active.
    const isGeneralOutpatientEnd = (existing.department as string) === "General Outpatient";
    const nextStage = isGeneralOutpatientEnd ? "Post Treatment" : "Active";
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("patients").update({
      stage: nextStage,
      treatment_end_date: today,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.patient_id as number);

    await supabase.from("activity").insert({
      type: "stage_changed",
      description: `${patientName} moved to ${nextStage} (care plan removed)`,
      patient_id: existing.patient_id as number,
      patient_name: patientName,
      metadata: nextStage,
    });
  }

  if (patient) {
    await supabase.from("activity").insert({
      type: "care_plan_deleted",
      description: `Care plan deleted for ${patientName} (${existing.department})`,
      patient_id: existing.patient_id as number,
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
