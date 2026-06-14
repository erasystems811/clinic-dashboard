import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr } from "../lib/camel.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { sendCarePlanEmail, sendCarePlanNotification, generateCarePlanMessages } from "../lib/automation.js";
import { generateOpenAIMessage } from "../lib/ai.js";
import { fetchAndSavePlan } from "./patient-app-plan.js";

const router: IRouter = Router();

async function resolveHospitalIntId(hospitalCode: string): Promise<number | null> {
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCode).single();
  return data?.id ?? null;
}

const CarePlanBody = z.object({
  summary: z.string().min(1),
  department: z.string().min(1),
  templateData: z.any().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryEmail: z.string().email().optional().or(z.literal("")),
  beneficiaryRelationship: z.string().optional(),
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
  // Only trigger if there are no ACTIVE plans (ended plans don't count).
  const activePlans = (data ?? []).filter((p: Record<string, unknown>) => p.status !== "ended");
  if (activePlans.length === 0 && (data ?? []).length === 0) {
    const { data: patient } = await supabase
      .from("patients")
      .select("treatment_plan, treatment_type, department, treatment_started_at, treatment_end_date, hospital_id, first_name, last_name")
      .eq("id", patientId)
      .single();

    if (patient && patient.treatment_plan) {
      const createdAt = patient.treatment_started_at ?? new Date().toISOString();
      const dept = (patient.department as string | null) || (patient.treatment_type as string | null) || "General";
      const summary = patient.treatment_plan as string;
      const treatmentEndDate = patient.treatment_end_date as string | null;
      const today = new Date().toISOString().split("T")[0];
      // If treatment_end_date exists and has already passed, the plan is ended
      const isEnded = !!treatmentEndDate && treatmentEndDate <= today;

      const { data: migrated, error: mErr } = await supabase.from("care_plans").insert({
        patient_id: patientId,
        hospital_id: hospital.code,
        summary,
        department: dept,
        template_data: treatmentEndDate
          ? { legacyEndDate: treatmentEndDate, migratedFromPatientRow: true }
          : { migratedFromPatientRow: true },
        status: isEnded ? "ended" : "active",
        ended_at: isEnded ? treatmentEndDate : null,
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

  const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).eq("hospital_id", hospital.code).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const now = new Date();

  // Insert the care plan
  const { data: plan, error: planErr } = await supabase.from("care_plans").insert({
    patient_id: patientId,
    hospital_id: hospital.code,
    summary: parsed.data.summary,
    department: parsed.data.department,
    template_data: parsed.data.templateData,
    beneficiary_name: parsed.data.beneficiaryName || null,
    beneficiary_email: parsed.data.beneficiaryEmail || null,
    beneficiary_relationship: parsed.data.beneficiaryRelationship?.trim() || null,
    status: "active",
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
      .eq("id", patientId).eq("hospital_id", hospital.code);
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
    // Only GenOut has meaningful treatment_end_date; other departments use null.
    treatment_end_date: isGeneralOutpatient ? treatmentEndDate.toISOString().split("T")[0] : null,
    pre_queue_stage: null,
  }).eq("id", patientId).eq("hospital_id", hospital.code);
  if (metaErr) console.error("[care-plans] metadata update failed:", metaErr);

  // Remove from queue (patient is now admitted to care)
  await supabase.from("queue").delete().eq("patient_id", patientId);

  // Log activity
  const patientName = `${patient.first_name} ${patient.last_name}`;
  const createdBy = (req.headers["x-performed-by"] as string | undefined) || null;
  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  await supabase.from("activity").insert({
    type: "care_plan_added",
    description: `Care plan added for ${patientName} (${parsed.data.department})`,
    patient_id: patientId,
    patient_name: patientName,
    hospital_id: hospitalIntId,
    metadata: parsed.data.summary.slice(0, 200),
    performed_by: createdBy,
  });

  // Fire automations: WhatsApp notification fires immediately;
  // care plan summary EMAIL is delayed 20 minutes via the scheduler
  // (so minor adjustments can be made before the patient receives it)
  if (hospitalIntId) {
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);
    if (phone) {
      sendCarePlanNotification(hospitalIntId, patientId, patientName, phone).catch(() => {});
    }
    // GP only: pre-generate reminder messages for all slots once — scheduler reads these instead of calling AI daily
    if (isGeneralOutpatient) {
      generateCarePlanMessages(
        (plan as Record<string, unknown>).id as number,
        hospitalIntId,
        patientName,
        parsed.data.summary,
        (parsed.data.templateData as Record<string, unknown>) ?? {},
      ).catch(() => {});
    }

    // ERA app: push care plan into patient's wellness modules + rebuild their planner
    void pushEraPlanIntegration({
      planId: (plan as Record<string, unknown>).id as number,
      patientId: patientId,
      hospitalIntId,
      summary: parsed.data.summary,
      department: parsed.data.department,
      templateData: (parsed.data.templateData as Record<string, unknown>) ?? undefined,
      durationDays: durationDays,
      startDate: now.toISOString().split("T")[0],
    });
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
    beneficiary_name: parsed.data.beneficiaryName ?? (existing.beneficiary_name as string | null),
    beneficiary_email: parsed.data.beneficiaryEmail ?? (existing.beneficiary_email as string | null),
    beneficiary_relationship: parsed.data.beneficiaryRelationship?.trim() ?? (existing.beneficiary_relationship as string | null),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error || !updated) { res.status(500).json({ error: error?.message ?? "Update failed" }); return; }

  // Also update patient's treatment_plan to the summary of the most-recently-updated plan
  await supabase.from("patients").update({
    treatment_plan: parsed.data.summary,
    department: parsed.data.department,
    updated_at: new Date().toISOString(),
  }).eq("id", existing.patient_id as number);

  const hospitalIntIdForRegen = await resolveHospitalIntId(hospital.code);
  if (hospitalIntIdForRegen) {
    const { data: patientForRegen } = await supabase.from("patients").select("first_name, last_name").eq("id", existing.patient_id as number).maybeSingle();
    const patientNameForRegen = patientForRegen ? `${patientForRegen.first_name} ${patientForRegen.last_name}` : "Patient";

    // GP only: regenerate pre-stored reminder messages to reflect the edited plan
    if (parsed.data.department === "General Outpatient") {
      generateCarePlanMessages(
        id,
        hospitalIntIdForRegen,
        patientNameForRegen,
        parsed.data.summary,
        (parsed.data.templateData as Record<string, unknown>) ?? {},
      ).catch(() => {});
    }

    // ERA app: re-sync the updated plan into patient's wellness modules + planner
    const durationDaysForUpdate = parsed.data.department === "General Outpatient"
      ? ((parsed.data.templateData as GeneralOutpatientData)?.durationDays ?? 7)
      : 30;
    void pushEraPlanIntegration({
      planId: id,
      patientId: existing.patient_id as number,
      hospitalIntId: hospitalIntIdForRegen,
      summary: parsed.data.summary,
      department: parsed.data.department,
      templateData: (parsed.data.templateData as Record<string, unknown>) ?? undefined,
      durationDays: durationDaysForUpdate,
      startDate: new Date().toISOString().split("T")[0],
    });
  }

  res.json(camelize(updated));
});

// ── End (archive) a care plan — never physically deleted ──────────────────────
// Care plans are permanently kept as a historical record. "Ending" a plan marks
// it status='ended' so nurses can review past treatment and reactivate if needed.
router.delete("/care-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Archive the plan — never delete
  await supabase.from("care_plans").update({
    status: "ended",
    ended_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).eq("id", id);

  // Check if any ACTIVE plans remain for this patient
  const { data: remainingActive } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", existing.patient_id as number)
    .eq("hospital_id", hospital.code)
    .eq("status", "active");

  const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", existing.patient_id as number).single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  if (!remainingActive || remainingActive.length === 0) {
    // No active plans left — move patient to Post Treatment
    await supabase.from("patients").update({
      stage: "Post Treatment",
      post_treatment_started_at: now.toISOString(),
      treatment_end_date: today,
      treatment_plan: null,
      treatment_type: null,
      medication_timing: null,
      updated_at: now.toISOString(),
    }).eq("id", existing.patient_id as number);

    await supabase.from("activity").insert({
      type: "stage_changed",
      description: `${patientName} moved to Post Treatment (${existing.department as string} care plan ended)`,
      patient_id: existing.patient_id as number,
      patient_name: patientName,
      metadata: "Post Treatment",
    });
  }

  await supabase.from("activity").insert({
    type: "care_plan_ended",
    description: `${existing.department as string} care plan ended for ${patientName}`,
    patient_id: existing.patient_id as number,
    patient_name: patientName,
  });

  res.sendStatus(204);
});

// ── List modules prescribed by this hospital to a connected ERA patient ────────
router.get("/patients/:id/prescribed-modules", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (!hospitalIntId) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("account_id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalIntId)
    .maybeSingle();

  if (!conn?.account_id) {
    res.json({ connected: false, modules: [] });
    return;
  }

  const { data: modules } = await supabase
    .from("wellness_modules")
    .select("module_type, enabled, source, prescribed_by_hospital_name")
    .eq("account_id", conn.account_id as number)
    .eq("source", "hospital")
    .eq("prescribed_by_hospital_id", hospitalIntId);

  res.json({
    connected: true,
    modules: (modules ?? []).map((m) => ({
      moduleType: m.module_type as string,
      enabled: m.enabled as boolean,
    })),
  });
});

// ── Prescribe or un-prescribe a wellness module for a connected ERA patient ────
const PrescribeModuleBody = z.object({
  moduleType: z.string().min(1),
  action: z.enum(["prescribe", "unprescribe"]),
});

router.post("/patients/:id/prescribe-module", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = PrescribeModuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (!hospitalIntId) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("account_id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalIntId)
    .maybeSingle();

  if (!conn?.account_id) {
    res.status(404).json({ error: "Patient does not have a connected ERA account" });
    return;
  }

  const accountId = conn.account_id as number;
  const { moduleType, action } = parsed.data;

  if (action === "unprescribe") {
    // Remove hospital attribution — revert to self-managed or delete if no prior settings
    const { data: existing } = await supabase
      .from("wellness_modules")
      .select("settings")
      .eq("account_id", accountId)
      .eq("module_type", moduleType)
      .maybeSingle();

    if (existing) {
      await supabase.from("wellness_modules").update({
        source: "self",
        prescribed_by_hospital_id: null,
        prescribed_by_hospital_name: null,
        updated_at: new Date().toISOString(),
      }).eq("account_id", accountId).eq("module_type", moduleType);
    }
    res.json({ ok: true });
    return;
  }

  // Prescribe: fetch hospital name, upsert with source='hospital'
  const { data: hosp } = await supabase.from("hospitals").select("name").eq("id", hospitalIntId).single();
  const hospitalName = (hosp?.name as string | null) ?? hospital.code;

  await supabase.from("wellness_modules").upsert({
    account_id: accountId,
    module_type: moduleType,
    enabled: true,
    settings: {},
    source: "hospital",
    prescribed_by_hospital_id: hospitalIntId,
    prescribed_by_hospital_name: hospitalName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,module_type" });

  // Notify the patient
  await supabase.from("patient_notifications").insert({
    account_id: accountId,
    type: "module_prescribed",
    title: `${hospitalName} added a health module`,
    body: `${hospitalName} has added a new health routine to your ERA plan. Check your Programs to see it.`,
    metadata: { moduleType, hospitalId: hospitalIntId },
  });

  res.json({ ok: true });
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

// ── ERA app integration: push care plan into patient's wellness modules + planner ──
// Fire-and-forget. Never throws. Called after plan create or update.
export async function pushEraPlanIntegration(opts: {
  planId: number;
  patientId: number;
  hospitalIntId: number;
  summary: string;
  department: string;
  templateData?: Record<string, unknown>;
  durationDays: number;
  startDate: string;
}): Promise<void> {
  try {
    // 1. Find connected ERA account
    const { data: conn } = await supabase
      .from("patient_hospital_connections")
      .select("account_id")
      .eq("patient_record_id", opts.patientId)
      .eq("hospital_id", opts.hospitalIntId)
      .maybeSingle();
    if (!conn?.account_id) return; // patient not on ERA app — nothing to do

    const accountId = conn.account_id as number;

    // 2. Extract medication dose times from templateData (GP structured plans)
    const td = opts.templateData ?? {};
    const medTimingTimes = (td.medicationTimingTimes as Record<string, string>) ?? {};
    const medTimes: string[] = Object.values(medTimingTimes).filter(Boolean);

    // 3. Use AI to extract medication names + dosages from the summary
    interface MedEntry { name: string; dosage?: string }
    let extractedMeds: MedEntry[] = [];
    try {
      const raw = await generateOpenAIMessage(
        "Extract medication names and dosages from a treatment plan summary. Return ONLY valid JSON: {\"meds\":[{\"name\":\"...\",\"dosage\":\"...\"}]}. If no medications, return {\"meds\":[]}. No extra text.",
        opts.summary.slice(0, 600),
        100,
      );
      const parsed = JSON.parse(raw.replace(/```json?|```/g, "").trim()) as { meds?: MedEntry[] };
      extractedMeds = parsed.meds ?? [];
    } catch {
      extractedMeds = [];
    }

    // 4. Build medication module entries
    // Fall back to a generic entry if no meds extracted but plan has medication timing
    const hasMedTiming = medTimes.length > 0 || (td.treatmentType === "medication_only" || td.treatmentType === "combination");
    if (extractedMeds.length === 0 && hasMedTiming) {
      extractedMeds = [{ name: "Prescribed medication", dosage: undefined }];
    }

    if (extractedMeds.length > 0) {
      // Default times: morning/afternoon/evening if not specified by templateData
      const doseTimes = medTimes.length > 0
        ? medTimes
        : extractedMeds.length >= 3
          ? ["07:30", "13:00", "20:00"]
          : extractedMeds.length === 2
            ? ["08:00", "20:00"]
            : ["08:00"];

      const medEntries = extractedMeds.map((m, i) => ({
        id: `plan_${opts.planId}_${i}`,
        name: m.name,
        dosage: m.dosage || undefined,
        startDate: opts.startDate,
        durationDays: opts.durationDays > 0 ? opts.durationDays : null,
        times: doseTimes,
      }));

      // Get existing medications module — preserve self-entered meds, replace hospital ones
      const { data: existingMod } = await supabase
        .from("wellness_modules")
        .select("settings")
        .eq("account_id", accountId)
        .eq("module_type", "medications")
        .maybeSingle();

      const existingMeds = ((existingMod?.settings as Record<string, unknown>)?.medications as Record<string, unknown>[]) ?? [];
      const selfMeds = existingMeds.filter((m) => !String(m.id ?? "").startsWith("plan_"));

      await supabase.from("wellness_modules").upsert({
        account_id: accountId,
        module_type: "medications",
        enabled: true,
        settings: { medications: [...selfMeds, ...medEntries] },
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id,module_type" });
    }

    // 5. If plan includes hospital visits, add a vitals module (remind patient to monitor health)
    const hasHospitalVisit = td.treatmentType === "come_to_hospital" || td.treatmentType === "combination";
    if (hasHospitalVisit) {
      const visitTimes = Object.values((td.hospitalTimingTimes as Record<string, string>) ?? {}).filter(Boolean);
      const vitalTime = visitTimes.length > 0
        ? (() => {
            // Set vitals reminder 1 hour before first visit
            const [h, m] = visitTimes[0].split(":").map(Number);
            const total = h * 60 + m - 60;
            const hh = Math.max(0, Math.floor(total / 60));
            const mm = total % 60;
            return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
          })()
        : "07:00";

      await supabase.from("wellness_modules").upsert({
        account_id: accountId,
        module_type: "vitals",
        enabled: true,
        settings: { notes: "Log the vitals recorded at your hospital visit" },
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id,module_type" });
      void vitalTime; // used in plan generator via module settings
    }

    // 6. Regenerate the weekly plan with the new modules
    await fetchAndSavePlan(accountId);

    // 7. Notify the patient
    const notifBody = extractedMeds.length > 0
      ? `Your ${opts.department} plan includes ${extractedMeds.map((m) => m.name).join(", ")}. Check your daily planner — reminders have been added to your routine.`
      : `Your ${opts.department} care plan has been added to your ERA planner.`;

    await supabase.from("patient_notifications").insert({
      account_id: accountId,
      type: "plan_integrated",
      title: "Care plan added to your planner",
      body: notifBody,
      metadata: { planId: opts.planId, department: opts.department },
    });

  } catch (err) {
    console.error("[pushEraPlanIntegration] failed:", String(err));
  }
}

export default router;
