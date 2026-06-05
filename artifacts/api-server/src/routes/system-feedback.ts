import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { requireSuperAdmin } from "./super-admin.js";

const router: IRouter = Router();

const SubmitBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  role: z.string().max(50),
});

router.post("/system-feedback", async (req, res) => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  const { rating, comment, role } = parsed.data;

  const { data: hosp } = await supabase.from("hospitals").select("name").eq("id", hospital.intId).single();

  const { error } = await supabase.from("system_feedback").insert({
    hospital_id: hospital.intId,
    hospital_name: (hosp?.name as string | null) ?? hospital.username,
    user_role: role,
    rating,
    comment: comment ?? null,
  });

  if (error) { res.status(500).json({ error: "Failed to save feedback" }); return; }
  res.json({ ok: true });
});

router.get("/system-feedback", requireSuperAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from("system_feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: "Failed to load feedback" }); return; }
  res.json(data ?? []);
});

export default router;
