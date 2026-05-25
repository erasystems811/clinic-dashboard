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
  { name: "Post Care",      color: "#06b6d4", sort_order: 5 },
  { name: "Dormant",        color: "#6b7280", sort_order: 6 },
];

async function ensureStagesExist() {
  const { data: existing } = await supabase.from("pipeline_stages").select("id");
  if (!existing || existing.length === 0) {
    await supabase.from("pipeline_stages").insert(DEFAULT_STAGES);
  }
}

router.get("/pipeline/stages", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  await ensureStagesExist();

  const [{ data: stages }, { data: patients }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
    supabase.from("patients").select("stage").eq("hospital_id", hospital.username),
  ]);

  const countMap: Record<string, number> = {};
  for (const p of patients ?? []) {
    countMap[p.stage] = (countMap[p.stage] ?? 0) + 1;
  }

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
