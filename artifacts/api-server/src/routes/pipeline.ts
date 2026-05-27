import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { ListPipelineStagesResponse } from "@workspace/api-zod";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const DEFAULT_STAGES = [
  { name: "Booked",         color: "#14b8a6", sort_order: 1 },
  { name: "Queued",         color: "#f59e0b", sort_order: 2 },
  { name: "In Care",        color: "#3b82f6", sort_order: 3 },
  { name: "Post Treatment", color: "#8b5cf6", sort_order: 4 },
  { name: "Active",         color: "#06b6d4", sort_order: 5 },
  { name: "Dormant",        color: "#6b7280", sort_order: 6 },
];

async function ensureStagesExist() {
  const { data: existing } = await supabase.from("pipeline_stages").select("id, name, sort_order");
  const byOrder = new Map((existing ?? []).map(s => [s.sort_order as number, s as { id: number; name: string; sort_order: number }]));
  const byName = new Map((existing ?? []).map(s => [s.name as string, s as { id: number; name: string; sort_order: number }]));

  await Promise.all(DEFAULT_STAGES.map(async (stage) => {
    // Prefer matching by sort_order so we UPDATE existing rows in place (no delete needed)
    const existingByOrder = byOrder.get(stage.sort_order);
    const existingByName = byName.get(stage.name);

    if (existingByOrder) {
      // Row exists at this position — update name+color in case it has the wrong name (e.g. "Post Care")
      if (existingByOrder.name !== stage.name) {
        await supabase.from("pipeline_stages")
          .update({ name: stage.name, color: stage.color })
          .eq("id", existingByOrder.id);
      }
    } else if (!existingByName) {
      // Not found by sort_order or name — insert fresh
      await supabase.from("pipeline_stages").insert(stage);
    }
  }));
}

router.get("/pipeline/stages", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  await ensureStagesExist();

  const nowIso = new Date().toISOString();
  const [{ data: stages }, { data: patients }, { data: queueEntries }, { data: bookedAppts }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
    supabase.from("patients").select("id, stage").eq("hospital_id", hospital.username),
    supabase.from("queue").select("patient_id").eq("hospital_id", hospital.username),
    supabase.from("appointments").select("patient_id").gte("scheduled_at", nowIso).not("status", "in", '("cancelled","no_show")'),
  ]);

  // Primary stage counts (Active, Post Treatment, Dormant, In Care from patients.stage)
  const countMap: Record<string, number> = {};
  for (const p of patients ?? []) {
    countMap[p.stage] = (countMap[p.stage] ?? 0) + 1;
  }
  // Derived stage counts from their authoritative tables
  countMap["Queued"] = (queueEntries ?? []).length;
  countMap["Booked"] = (bookedAppts ?? []).length;

  const result = (stages ?? []).map((s: Record<string, unknown>) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    order: s.sort_order,
    count: countMap[s.name as string] ?? 0,
  }));

  res.json(ListPipelineStagesResponse.parse(result));
});

export default router;
