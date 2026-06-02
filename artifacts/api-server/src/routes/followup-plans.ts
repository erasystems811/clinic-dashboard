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

export default router;
