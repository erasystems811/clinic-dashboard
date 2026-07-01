import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize, camelizeArr } from "../lib/camel.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { sendCarePlanEmail, sendCarePlanNotification, generateCarePlanMessages, getHospitalContext, logAutomation, updateAutomationLog } from "../lib/automation.js";
import { generateOpenAIMessage } from "../lib/ai.js";
import { fetchAndSavePlan } from "./patient-app-plan.js";
import { deliverMobileMessage } from "../lib/messaging.js";
import { deductSmsFromWallet, hasSufficientSmsBalance } from "../lib/wallet.js";

const router: IRouter = Router();

async function resolveHospitalIntId(hospitalCode: string): Promise<number | null> {
  const { data } = await supabase.from("hospitals").select("id").eq("hospital_code", hospitalCode).single();
  return data?.id ?? null;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

// Used for POST (create) — all fields optional; plan starts as "open"
const CreatePlanBody = z.object({
  summary: z.string().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryEmail: z.string().email().optional().or(z.literal("")),
  beneficiaryRelationship: z.string().optional(),
}).optional();

// Used for PATCH (update) — all optional so partial updates are allowed
const UpdatePlanBody = z.object({
  summary: z.string().optional(),
  department: z.string().optional(),
  templateData: z.any().optional(),
  beneficiaryName: z.string().optional(),
  beneficiaryEmail: z.string().email().optional().or(z.literal("")),
  beneficiaryRelationship: z.string().optional(),
});

// ── List care plans for a patient ──────────────────────────────────────────────
// Lazy migration: if no care_plans rows exist but patient has legacy treatment_plan
// on the patients table, a care_plans row is created from that legacy data.
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

  // Dedup: if multiple open drafts exist (from concurrent creation races), keep the oldest and delete the rest
  const openDrafts = (data ?? []).filter((p: Record<string, unknown>) => p.status === "open");
  if (openDrafts.length > 1) {
    const dupeIds = openDrafts.slice(1).map((p: Record<string, unknown>) => p.id as number);
    await supabase.from("care_plans").delete().in("id", dupeIds).catch(() => {});
    (data as Record<string, unknown>[]).splice(0, data!.length, ...(data ?? []).filter((p: Record<string, unknown>) => !dupeIds.includes(p.id as number)));
  }

  // Inline auto-end: end any active plans whose treatment duration has passed.
  // The daily scheduler does this overnight, but running it here too means the
  // UI always reflects reality the moment someone opens the patient record.
  const activePlans = (data ?? []).filter((p: Record<string, unknown>) => p.status === "active");
  if (activePlans.length > 0) {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("treatment_end_date, first_name, last_name, stage")
      .eq("id", patientId)
      .maybeSingle();

    const todayStr = new Date().toISOString().split("T")[0];
    const patientEndDate = patientRow?.treatment_end_date as string | null;

    const expiredPlans = activePlans.filter((p: Record<string, unknown>) => {
      const td = (p.template_data ?? {}) as Record<string, unknown>;

      // Source 1: patient-level treatment_end_date (new-format plans with meds/procs)
      if (patientEndDate && patientEndDate <= todayStr) return true;

      // Source 2: new-format plans — compute end date from updated_at + max medication/procedure duration
      const meds = (td.medications as Array<{ durationDays?: number }> | undefined) ?? [];
      const procs = (td.procedures as Array<{ durationDays?: number }> | undefined) ?? [];
      const durations = [...meds, ...procs].map(i => Number(i.durationDays ?? 0)).filter(d => d > 0);
      if (durations.length > 0) {
        const maxDays = Math.max(...durations);
        const updatedAt = p.updated_at as string | null;
        if (updatedAt) {
          const computedEnd = new Date(updatedAt);
          computedEnd.setDate(computedEnd.getDate() + maxDays);
          if (computedEnd.toISOString().split("T")[0] <= todayStr) return true;
        }
      }

      // Source 3: old specialist-format plans — check last scheduled visit date
      // (ancSchedule for Antenatal, vaccinationSchedule for Paediatrics,
      //  inCareSchedule + procedureDate for Surgery/Dental/Eye/Fertility/ENT)
      const scheduleDates: string[] = [];
      for (const key of ["ancSchedule", "vaccinationSchedule", "inCareSchedule"]) {
        const rows = (td[key] as Array<{ date?: string }> | undefined) ?? [];
        for (const r of rows) { if (r.date) scheduleDates.push(r.date); }
      }
      const procedureDate = td.procedureDate as string | undefined;
      if (procedureDate) scheduleDates.push(procedureDate);
      if (scheduleDates.length > 0) {
        const lastDate = scheduleDates.sort().pop()!;
        if (lastDate < todayStr) return true;
      }

      return false;
    });

    if (expiredPlans.length > 0) {
      const now = new Date().toISOString();
      const patientName = patientRow ? `${patientRow.first_name} ${patientRow.last_name}` : "Unknown";
      const expiredIds = new Set(expiredPlans.map((p: Record<string, unknown>) => p.id as number));

      // End expired plans and transition patient stage (fire-and-forget)
      Promise.all(
        expiredPlans.map((p: Record<string, unknown>) =>
          supabase.from("care_plans")
            .update({ status: "ended", ended_at: now, updated_at: now })
            .eq("id", p.id as number)
        )
      ).then(async () => {
        // Check if any active plans remain after ending the expired ones
        const { data: remaining } = await supabase
          .from("care_plans")
          .select("id")
          .eq("patient_id", patientId)
          .eq("hospital_id", hospital.code)
          .eq("status", "active");

        if ((!remaining || remaining.length === 0) && patientRow?.stage !== "Post Treatment") {
          const hospitalIntId = await resolveHospitalIntId(hospital.code);
          await supabase.from("patients").update({
            stage: "Post Treatment",
            post_treatment_started_at: now,
            treatment_plan: null,
            treatment_type: null,
            medication_timing: null,
            updated_at: now,
          }).eq("id", patientId);

          await supabase.from("activity").insert({
            type: "stage_changed",
            description: `${patientName} moved to Post Treatment (treatment duration complete)`,
            patient_id: patientId,
            patient_name: patientName,
            hospital_id: hospitalIntId,
            metadata: "Post Treatment",
          });
        }
      }).catch(() => {});

      // Return immediately with expired plans already marked as ended
      const updatedData = (data ?? []).map((p: Record<string, unknown>) =>
        expiredIds.has(p.id as number) ? { ...p, status: "ended", ended_at: now } : p
      );
      return void res.json(camelizeArr(updatedData));
    }
  }

  // Lazy migration: old patients have treatment_plan on the patients row but no
  // care_plans rows yet. Create one now so the new UI works transparently.
  const nonEndedPlans = (data ?? []).filter((p: Record<string, unknown>) => p.status !== "ended");
  if (nonEndedPlans.length === 0 && (data ?? []).length === 0) {
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
        // Race-condition cleanup: if concurrent requests both inserted, remove extras
        // (keep the oldest row by created_at, delete any newer duplicates)
        const { data: allRows } = await supabase
          .from("care_plans")
          .select("id, created_at")
          .eq("patient_id", patientId)
          .eq("hospital_id", hospital.code)
          .order("created_at", { ascending: true });
        if (allRows && allRows.length > 1) {
          const keepId = (allRows[0] as { id: number }).id;
          const dupeIds = allRows.slice(1).map((r: Record<string, unknown>) => r.id as number);
          await supabase.from("care_plans").delete().in("id", dupeIds);
          const kept = allRows[0] as Record<string, unknown>;
          return void res.json(camelizeArr([{ ...migrated, id: keepId, ...kept }]));
        }
        return void res.json(camelizeArr([migrated]));
      }
    }
  }

  res.json(camelizeArr(data ?? []));
});

// ── Create a care plan (opens a draft) ────────────────────────────────────────
// Plan starts as "open" — no automations fire until POST /care-plans/:id/close.
// Doctor calls this from the queue to hand off to nurse/pharmacist for filling.
router.post("/patients/:id/care-plans", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).eq("hospital_id", hospital.code).single();
  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  // Prevent duplicate open drafts: if one already exists, return it instead of creating another
  const { data: existingDraft } = await supabase
    .from("care_plans")
    .select("*")
    .eq("patient_id", patientId)
    .eq("hospital_id", hospital.code)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDraft) {
    res.status(409).json({ error: "An open draft already exists for this patient.", existingPlanId: existingDraft.id, existingPlan: camelize(existingDraft) });
    return;
  }

  const now = new Date();
  const body = parsed.data ?? {};

  const { data: plan, error: planErr } = await supabase.from("care_plans").insert({
    patient_id: patientId,
    hospital_id: hospital.code,
    summary: body.summary?.trim() || "",
    department: null,
    template_data: { medications: [], procedures: [], categories: [] },
    beneficiary_name: body.beneficiaryName || null,
    beneficiary_email: body.beneficiaryEmail || null,
    beneficiary_relationship: body.beneficiaryRelationship?.trim() || null,
    status: "open",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).select().single();

  if (planErr || !plan) { res.status(500).json({ error: planErr?.message ?? "Failed to create care plan" }); return; }

  // Move patient from New → Active so they graduate out of onboarding.
  // Other stages (Active, Dormant, Post Treatment) are preserved.
  if (!patient.stage || patient.stage === "New") {
    await supabase.from("patients")
      .update({ stage: "Active", updated_at: now.toISOString() })
      .eq("id", patientId).eq("hospital_id", hospital.code);
  }

  // Remove from queue (patient is now admitted to care)
  await supabase.from("queue").delete().eq("patient_id", patientId);

  const patientName = `${patient.first_name} ${patient.last_name}`;
  const createdBy = (req.headers["x-performed-by"] as string | undefined) || null;
  const hospitalIntId = await resolveHospitalIntId(hospital.code);

  await supabase.from("activity").insert({
    type: "care_plan_added",
    description: `Treatment plan opened for ${patientName}`,
    patient_id: patientId,
    patient_name: patientName,
    hospital_id: hospitalIntId,
    metadata: "draft",
    performed_by: createdBy,
  });

  res.status(201).json(camelize(plan));
});

// ── Update a care plan (save draft or edit active plan) ───────────────────────
// "open" plans: save content, no notifications.
// "active" plans: save content + push ERA update notification to patient.
router.patch("/care-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  if (existing.status === "ended") {
    res.status(409).json({ error: "Cannot edit an ended care plan" }); return;
  }

  const { data: updated, error } = await supabase.from("care_plans").update({
    ...(parsed.data.summary !== undefined && { summary: parsed.data.summary }),
    ...(parsed.data.department !== undefined && { department: parsed.data.department }),
    ...(parsed.data.templateData !== undefined && { template_data: parsed.data.templateData }),
    ...(parsed.data.beneficiaryName !== undefined && { beneficiary_name: parsed.data.beneficiaryName ?? null }),
    ...(parsed.data.beneficiaryEmail !== undefined && { beneficiary_email: parsed.data.beneficiaryEmail ?? null }),
    ...(parsed.data.beneficiaryRelationship !== undefined && { beneficiary_relationship: parsed.data.beneficiaryRelationship?.trim() ?? null }),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error || !updated) { res.status(500).json({ error: error?.message ?? "Update failed" }); return; }

  // For already-active plans: push an ERA in-app update notification
  if (existing.status === "active") {
    const hospitalIntId = await resolveHospitalIntId(hospital.code);
    if (hospitalIntId) {
      const patientId = existing.patient_id as number;
      const { data: conn } = await supabase
        .from("patient_hospital_connections")
        .select("account_id")
        .eq("patient_record_id", patientId)
        .eq("hospital_id", hospitalIntId)
        .maybeSingle();
      if (conn?.account_id) {
        const { data: hosp } = await supabase.from("hospitals").select("name").eq("id", hospitalIntId).maybeSingle();
        await supabase.from("patient_notifications").insert({
          account_id: conn.account_id as number,
          type: "plan_updated",
          title: "Your treatment plan has been updated",
          body: `${(hosp?.name as string | null) ?? "Your hospital"} has updated your care plan. Review the latest details in your ERA app.`,
          metadata: { planId: id, hospitalId: hospitalIntId },
        });
      }

      // Regenerate messages if this is an old-format GenOut plan
      const updatedTd = (updated.template_data ?? {}) as Record<string, unknown>;
      if (updated.department === "General Outpatient" && updatedTd.treatmentType) {
        const { data: patientRow } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle();
        const patientName = patientRow ? `${patientRow.first_name} ${patientRow.last_name}` : "Patient";
        generateCarePlanMessages(id, hospitalIntId, patientName, updated.summary as string, updatedTd).catch(() => {});
      }

      // Re-sync ERA wellness modules — derive duration from new-format meds/procs or fallback to GenOut field
      const updatedMeds = (updatedTd.medications as Array<{ durationDays?: number }> | undefined) ?? [];
      const updatedProcs = (updatedTd.procedures as Array<{ durationDays?: number }> | undefined) ?? [];
      const allDurs = [...updatedMeds, ...updatedProcs].map(i => i.durationDays ?? 0).filter(d => d > 0);
      const durationDays = allDurs.length > 0
        ? Math.max(...allDurs)
        : ((updatedTd.durationDays as number | undefined) ?? 7);
      const { data: patientRow } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle();
      const patientName = patientRow ? `${patientRow.first_name} ${patientRow.last_name}` : "Patient";
      void pushEraPlanIntegration({
        planId: id,
        patientId,
        hospitalIntId,
        summary: updated.summary as string,
        department: (updated.department as string | null) ?? "General Outpatient",
        templateData: updatedTd,
        durationDays,
        startDate: new Date().toISOString().split("T")[0],
      });
    }
  }

  res.json(camelize(updated));
});

// ── Close a treatment plan — fires all automations ────────────────────────────
// Call this when the plan is fully filled. Status moves from "open" → "active".
// All patient notifications fire here — nothing fires on save-draft or create.
router.post("/care-plans/:id/close", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }
  if (existing.status !== "open") { res.status(409).json({ error: "Plan is not in draft state" }); return; }

  const bodyRaw = (req.body ?? {}) as {
    summary?: string;
    templateData?: Record<string, unknown>;
    beneficiaryName?: string;
    beneficiaryEmail?: string;
    beneficiaryRelationship?: string;
  };
  const now = new Date();

  // Merge incoming form data with whatever was last saved — incoming wins.
  // This ensures "Close & Activate" captures the current form state even if the
  // nurse never clicked "Save Draft" first.
  const td = {
    ...(existing.template_data ?? {}) as Record<string, unknown>,
    ...(bodyRaw.templateData ?? {}),
  };

  const finalSummary = bodyRaw.summary?.trim() || (existing.summary as string) || "";
  const finalBeneficiaryName = bodyRaw.beneficiaryName?.trim() ?? (existing.beneficiary_name as string | null) ?? null;
  const finalBeneficiaryEmail = bodyRaw.beneficiaryEmail?.trim() ?? (existing.beneficiary_email as string | null) ?? null;
  const finalBeneficiaryRelationship = bodyRaw.beneficiaryRelationship?.trim() ?? (existing.beneficiary_relationship as string | null) ?? null;

  // Derive department from template data
  const categories = (td.categories as Array<{ type: string }> | undefined) ?? [];
  const medications = (td.medications as Array<{ durationDays?: number; name?: string; timing?: Record<string, string> }> | undefined) ?? [];
  const procedures = (td.procedures as Array<{ durationDays?: number; name?: string; timing?: Record<string, string> }> | undefined) ?? [];
  const hasMeds = medications.length > 0;
  const hasProcs = procedures.length > 0;

  let department = existing.department as string | null;
  if (!department) {
    if (categories.length === 1) {
      department = categories[0].type;
    } else if (categories.length > 1) {
      department = "Multiple";
    } else {
      department = "General Outpatient";
    }
  }

  // Compute treatment duration: max of all medication/procedure durations
  const allDurations = [...medications, ...procedures]
    .map(i => i.durationDays ?? 0)
    .filter(d => d > 0);
  const durationDays = allDurations.length > 0 ? Math.max(...allDurations) : 1;
  const treatmentEndDate = new Date(now);
  treatmentEndDate.setDate(treatmentEndDate.getDate() + durationDays);

  const { data: closed, error: closeErr } = await supabase.from("care_plans").update({
    status: "active",
    summary: finalSummary,
    department,
    template_data: td,
    beneficiary_name: finalBeneficiaryName,
    beneficiary_email: finalBeneficiaryEmail,
    beneficiary_relationship: finalBeneficiaryRelationship,
    updated_at: now.toISOString(),
  }).eq("id", id).select().single();

  if (closeErr || !closed) { res.status(500).json({ error: closeErr?.message ?? "Failed to close plan" }); return; }

  const patientId = existing.patient_id as number;

  // Update patient treatment metadata
  const treatmentType = hasMeds && hasProcs ? "combination" : hasMeds ? "medication_only" : hasProcs ? "come_to_hospital" : null;
  await supabase.from("patients").update({
    treatment_plan: finalSummary,
    treatment_type: treatmentType,
    department,
    treatment_started_at: now.toISOString(),
    treatment_duration_days: durationDays,
    treatment_end_date: (hasMeds || hasProcs) ? treatmentEndDate.toISOString().split("T")[0] : null,
    pre_queue_stage: null,
  }).eq("id", patientId).eq("hospital_id", hospital.code);

  const { data: patient } = await supabase.from("patients").select("first_name, last_name, whatsapp_number, phone, email").eq("id", patientId).single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";
  const createdBy = (req.headers["x-performed-by"] as string | undefined) || null;
  const hospitalIntId = await resolveHospitalIntId(hospital.code);

  await supabase.from("activity").insert({
    type: "care_plan_added",
    description: `Treatment plan closed for ${patientName} (${department})`,
    patient_id: patientId,
    patient_name: patientName,
    hospital_id: hospitalIntId,
    metadata: finalSummary.slice(0, 200),
    performed_by: createdBy,
  });

  // Fire automations
  if (hospitalIntId && patient) {
    const phone = (patient.whatsapp_number as string) || (patient.phone as string);
    if (phone) {
      sendCarePlanNotification(hospitalIntId, patientId, patientName, phone).catch(() => {});
    }

    // Send care plan email immediately and mark dedup key so scheduler won't re-send
    if (patient.email) {
      sendCarePlanEmail(hospitalIntId, patientId, patientName, patient.email as string, department, finalSummary, durationDays).catch(() => {});
      supabase.from("automation_log").insert({
        hospital_id: hospitalIntId,
        patient_id: patientId,
        automation_type: `care_plan_email_${id}`,
        status: "sent",
        channel: "email",
        message_preview: `Care plan email (on close) → ${patient.email as string}`,
        created_at: now.toISOString(),
      }).then(() => {}, () => {});
    }

    // For old-format GenOut plans (have treatmentType set), pre-generate reminder messages
    if (department === "General Outpatient" && (td.treatmentType as string | undefined)) {
      generateCarePlanMessages(id, hospitalIntId, patientName, finalSummary, td).catch(() => {});
    }

    void pushEraPlanIntegration({
      planId: id,
      patientId,
      hospitalIntId,
      summary: finalSummary,
      department,
      templateData: td,
      durationDays,
      startDate: now.toISOString().split("T")[0],
    });
  }

  res.json(camelize(closed));
});

// ── End (archive) a care plan — never physically deleted ──────────────────────
// ?cancelOnly=true  → end the plan without moving the patient to Post Treatment
//                    (for cases where the patient was added to treatment by mistake)
router.delete("/care-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const cancelOnly = req.query.cancelOnly === "true";

  const { data: existing } = await supabase.from("care_plans").select("*").eq("id", id).eq("hospital_id", hospital.code).single();
  if (!existing) { res.status(404).json({ error: "Care plan not found" }); return; }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  await supabase.from("care_plans").update({
    status: "ended",
    ended_at: now.toISOString(),
    updated_at: now.toISOString(),
  }).eq("id", id);

  const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", existing.patient_id as number).single();
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

  // Only transition to Post Treatment if no remaining non-ended plans exist.
  // "open" plans count — a draft plan means the patient is still being treated.
  const { data: remainingPlans } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", existing.patient_id as number)
    .eq("hospital_id", hospital.code)
    .neq("status", "ended");

  if (!remainingPlans || remainingPlans.length === 0) {
    if (cancelOnly) {
      // Cancelled by mistake — clear treatment fields but keep patient at their current stage
      await supabase.from("patients").update({
        treatment_plan: null,
        treatment_type: null,
        medication_timing: null,
        treatment_end_date: today,
        updated_at: now.toISOString(),
      }).eq("id", existing.patient_id as number);
    } else if (existing.status === "active") {
      // Normal end: move to Post Treatment
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
        description: `${patientName} moved to Post Treatment (${(existing.department as string | null) ?? "treatment"} care plan ended)`,
        patient_id: existing.patient_id as number,
        patient_name: patientName,
        metadata: "Post Treatment",
      });
    } else {
      // Draft plan discarded — touch updated_at only
      await supabase.from("patients").update({
        updated_at: now.toISOString(),
      }).eq("id", existing.patient_id as number);
    }
  }

  await supabase.from("activity").insert({
    type: "care_plan_ended",
    description: cancelOnly
      ? `${(existing.department as string | null) ?? "Treatment"} plan cancelled for ${patientName} (added by mistake)`
      : `${(existing.department as string | null) ?? "Treatment"} plan ended for ${patientName}`,
    patient_id: existing.patient_id as number,
    patient_name: patientName,
  });

  res.sendStatus(204);
});

// ── Return Visits ──────────────────────────────────────────────────────────────

const ReturnVisitBody = z.object({
  visitDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitTime:         z.string().optional(),
  reason:            z.string().min(1),
  notes:             z.string().optional(),
  scheduledBy:       z.enum(["doctor", "nurse", "staff"]).optional(),
  scheduledByName:   z.string().optional(),
  sendSms:           z.boolean().optional(),
});

router.get("/patients/:id/return-visits", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (!hospitalIntId) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { data, error } = await supabase
    .from("patient_return_visits")
    .select("*")
    .eq("patient_id", patientId)
    .eq("hospital_id", hospitalIntId)
    .order("visit_date", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(v => ({
    id: v.id,
    visitDate: v.visit_date,
    visitTime: v.visit_time ?? null,
    reason: v.reason,
    notes: v.notes ?? null,
    scheduledBy: v.scheduled_by,
    scheduledByName: v.scheduled_by_name ?? null,
    status: v.status,
    createdAt: v.created_at,
  })));
});

router.post("/patients/:id/return-visits", async (req, res): Promise<void> => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ReturnVisitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (!hospitalIntId) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { visitDate, visitTime, reason, notes, scheduledBy, scheduledByName, sendSms } = parsed.data;

  const { data, error } = await supabase.from("patient_return_visits").insert({
    patient_id:        patientId,
    hospital_id:       hospitalIntId,
    visit_date:        visitDate,
    visit_time:        visitTime ?? null,
    reason,
    notes:             notes ?? null,
    scheduled_by:      scheduledBy ?? "staff",
    scheduled_by_name: scheduledByName ?? null,
    status:            "scheduled",
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("account_id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalIntId)
    .maybeSingle();

  if (conn?.account_id) {
    const { data: hosp } = await supabase.from("hospitals").select("name").eq("id", hospitalIntId).maybeSingle();
    const hospitalName = (hosp?.name as string | null) ?? "Your hospital";
    const formatted = new Date(visitDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    await supabase.from("patient_notifications").insert({
      account_id: conn.account_id as number,
      type: "return_visit_scheduled",
      title: `Return visit scheduled — ${formatted}`,
      body: `${hospitalName} has scheduled a return visit for you on ${formatted}${visitTime ? ` at ${visitTime}` : ""}. Reason: ${reason}`,
      metadata: { returnVisitId: (data as Record<string, unknown>).id, hospitalId: hospitalIntId, visitDate },
    });
  }

  // Optional immediate SMS confirmation
  let smsSent = false;
  let smsError: string | null = null;
  if (sendSms) {
    try {
      const hCtx = await getHospitalContext(hospitalIntId);
      const { data: patientRow } = await supabase.from("patients").select("first_name, last_name, phone").eq("id", patientId).maybeSingle();
      const phone = patientRow?.phone as string | null;
      if (!phone) throw new Error("Patient has no phone number");
      const canAfford = await hasSufficientSmsBalance(hospitalIntId);
      if (!canAfford) throw new Error("Insufficient SMS wallet balance");
      const patientName = `${patientRow?.first_name ?? ""} ${patientRow?.last_name ?? ""}`.trim();
      const formatted = new Date(visitDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
      const smsBody = `Hi ${patientName}, your return visit at ${hCtx.hospitalName} has been scheduled for ${formatted}${visitTime ? ` at ${visitTime}` : ""}. Reason: ${reason}.`;
      const logId = await logAutomation({ hospitalId: hospitalIntId, patientId, patientName, automationType: "return_visit_sms", channel: "sms" }, "queued");
      await deliverMobileMessage("sms", phone, smsBody, { senderId: hCtx.termiiSenderId });
      await deductSmsFromWallet(hospitalIntId, `Return visit SMS — ${patientName}`);
      await updateAutomationLog(logId, "sent", `Return visit SMS → ${phone}`);
      smsSent = true;
    } catch (smsErr) {
      smsError = smsErr instanceof Error ? smsErr.message : String(smsErr);
      console.error("[return-visits] SMS send failed:", smsError);
    }
  }

  res.status(201).json({ id: (data as Record<string, unknown>).id, smsSent, smsError });
});

router.delete("/return-visits/:id", async (req, res): Promise<void> => {
  const visitId = parseInt(req.params.id, 10);
  if (isNaN(visitId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const hospitalIntId = await resolveHospitalIntId(hospital.code);
  if (!hospitalIntId) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { error } = await supabase
    .from("patient_return_visits")
    .delete()
    .eq("id", visitId)
    .eq("hospital_id", hospitalIntId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

// ── ERA app integration: push care plan into patient's wellness modules + planner ──
// Fire-and-forget. Never throws. Handles both old GenOut format and new medications[] format.
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
    const { data: conn } = await supabase
      .from("patient_hospital_connections")
      .select("account_id")
      .eq("patient_record_id", opts.patientId)
      .eq("hospital_id", opts.hospitalIntId)
      .maybeSingle();
    if (!conn?.account_id) return;

    const accountId = conn.account_id as number;
    const td = opts.templateData ?? {};

    // New format: medications array with per-drug timing
    const newFormatMeds = (td.medications as Array<{ name?: string; dosage?: string; timing?: Record<string, string> }> | undefined) ?? [];

    // Old format: medicationTimingTimes map
    const medTimingTimes = (td.medicationTimingTimes as Record<string, string>) ?? {};
    const oldFormatMedTimes: string[] = Object.values(medTimingTimes).filter(Boolean);

    interface MedEntry { name: string; dosage?: string }
    let extractedMeds: MedEntry[] = [];
    let medTimes: string[] = [];

    if (newFormatMeds.length > 0) {
      // Use structured medication data directly — no AI needed
      extractedMeds = newFormatMeds.filter(m => m.name).map(m => ({ name: m.name!, dosage: m.dosage }));
      // Collect all unique timing values across all medications
      const allTimes = newFormatMeds.flatMap(m => Object.values(m.timing ?? {})).filter(Boolean);
      medTimes = [...new Set(allTimes)].sort();
    } else {
      // Old format: use AI to extract medication names from summary
      medTimes = oldFormatMedTimes;
      const hasMedTiming = medTimes.length > 0 || (td.treatmentType === "medication_only" || td.treatmentType === "combination");
      if (hasMedTiming) {
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
        if (extractedMeds.length === 0 && hasMedTiming) {
          extractedMeds = [{ name: "Prescribed medication" }];
        }
      }
    }

    if (extractedMeds.length > 0) {
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

      const { data: existingMod } = await supabase
        .from("wellness_modules")
        .select("settings")
        .eq("account_id", accountId)
        .eq("module_type", "medications")
        .maybeSingle();

      const existingMeds = ((existingMod?.settings as Record<string, unknown>)?.medications as Record<string, unknown>[]) ?? [];
      const selfMeds = existingMeds.filter((m) => !String(m.id ?? "").startsWith("plan_"));

      const { data: hospRow } = await supabase.from("hospitals").select("name").eq("id", opts.hospitalIntId).maybeSingle();
      const hospitalName = (hospRow?.name as string | null) ?? "Your hospital";

      await supabase.from("wellness_modules").upsert({
        account_id: accountId,
        module_type: "medications",
        enabled: true,
        settings: { medications: [...selfMeds, ...medEntries] },
        source: "hospital",
        prescribed_by_hospital_id: opts.hospitalIntId,
        prescribed_by_hospital_name: hospitalName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id,module_type" });
    }

    await fetchAndSavePlan(accountId);

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
