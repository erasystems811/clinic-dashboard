import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const FollowupPlanBody = z.object({
  days: z.array(z.number().int().min(1).max(365)).max(3),
});

// ── GET follow-up plan for a care plan ────────────────────────────────────────
router.get("/care-plans/:id/followup-plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Verify the care plan belongs to this hospital
  const { data: plan } = await supabase.from("care_plans").select("id").eq("id", id).eq("hospital_id", hospital.code).maybeSingle();
  if (!plan) { res.status(404).json({ error: "Care plan not found" }); return; }

  const { data } = await supabase
    .from("post_treatment_followup_plans")
    .select("followup_days")
    .eq("care_plan_id", id)
    .maybeSingle();

  res.json({ days: (data?.followup_days as number[]) ?? [] });
});

// ── PUT (create or replace) follow-up plan for a care plan ────────────────────
router.put("/care-plans/:id/followup-plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = FollowupPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid plan data" }); return; }

  // Verify the care plan belongs to this hospital
  const { data: plan } = await supabase
    .from("care_plans")
    .select("id, patient_id, department")
    .eq("id", id)
    .eq("hospital_id", hospital.code)
    .single();
  if (!plan) { res.status(404).json({ error: "Care plan not found" }); return; }

  // Sort days ascending and deduplicate
  const days = [...new Set(parsed.data.days)].sort((a, b) => a - b);

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("post_treatment_followup_plans")
    .select("id")
    .eq("care_plan_id", id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_treatment_followup_plans")
      .update({ followup_days: days, updated_at: now })
      .eq("id", existing.id);
  } else {
    await supabase.from("post_treatment_followup_plans").insert({
      care_plan_id: id,
      patient_id: plan.patient_id,
      hospital_id: hospital.code,
      department: plan.department,
      followup_days: days,
      created_at: now,
      updated_at: now,
    });
  }

  res.json({ days });
});

// ── POST dismiss follow-up for a care plan (nurse decides: no follow-up needed) ──
// Saves an empty followup_days=[] record so the plan is removed from the queue.
// If the patient has no other active care plans, moves them to Active stage.
router.post("/care-plans/:id/dismiss-followup", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: plan } = await supabase
    .from("care_plans")
    .select("id, patient_id, department")
    .eq("id", id)
    .eq("hospital_id", hospital.code)
    .single();
  if (!plan) { res.status(404).json({ error: "Care plan not found" }); return; }

  const now = new Date().toISOString();

  // Save empty record — convention: record exists → nurse has made a decision
  const { data: existing } = await supabase
    .from("post_treatment_followup_plans")
    .select("id")
    .eq("care_plan_id", id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_treatment_followup_plans")
      .update({ followup_days: [], updated_at: now })
      .eq("id", existing.id);
  } else {
    await supabase.from("post_treatment_followup_plans").insert({
      care_plan_id: id,
      patient_id: plan.patient_id,
      hospital_id: hospital.code,
      department: plan.department,
      followup_days: [],
      created_at: now,
      updated_at: now,
    });
  }

  // If patient has no other active care plans, move them to Active
  const { data: activePlans } = await supabase
    .from("care_plans")
    .select("id")
    .eq("patient_id", plan.patient_id as number)
    .eq("hospital_id", hospital.code)
    .eq("status", "active");

  if (!activePlans || activePlans.length === 0) {
    await supabase
      .from("patients")
      .update({ stage: "Active", updated_at: now })
      .eq("id", plan.patient_id as number);
  }

  res.json({ ok: true });
});

// ── GET recently ended non-GenOut care plans (last 48h) for nurse follow-up queue ─
router.get("/nurse/post-treatment-queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: plans } = await supabase
    .from("care_plans")
    .select("id, department, summary, ended_at, patient_id")
    .eq("hospital_id", hospital.code)
    .eq("status", "ended")
    .neq("department", "General Outpatient")
    .gte("ended_at", cutoff)
    .order("ended_at", { ascending: false });

  if (!plans || plans.length === 0) { res.json([]); return; }

  const planIds = plans.map(p => p.id as number);
  const patientIds = [...new Set(plans.map(p => p.patient_id as number))];

  const [{ data: patients }, { data: followupPlans }] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name, patient_id").in("id", patientIds),
    supabase.from("post_treatment_followup_plans").select("care_plan_id, followup_days").in("care_plan_id", planIds),
  ]);

  const patientMap = new Map((patients ?? []).map(p => [p.id as number, p]));
  const followupMap = new Map((followupPlans ?? []).map(f => [f.care_plan_id as number, f.followup_days as number[]]));

  // Only include plans where the nurse hasn't yet made a decision (no record in followup table)
  res.json(
    plans
      .filter(plan => !followupMap.has(plan.id as number))
      .map(plan => {
        const p = patientMap.get(plan.patient_id as number);
        return {
          id: plan.id as number,
          department: plan.department as string,
          summary: plan.summary as string,
          endedAt: plan.ended_at as string,
          patient: p ? { id: p.id as number, firstName: p.first_name as string, lastName: p.last_name as string, patientId: p.patient_id as string | null } : null,
        };
      })
  );
});

export default router;
