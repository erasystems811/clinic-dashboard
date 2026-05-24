import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreateFeedbackBody = z.object({
  patientId: z.number().int().optional(),
  patientName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

router.get("/feedback", async (req, res): Promise<void> => {
  const { data, error } = await supabase.from("feedback").select("*").order("submitted_at", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }

  const entries = data ?? [];
  const avgRating = entries.length > 0
    ? Math.round((entries.reduce((s, e) => s + (e.rating ?? 0), 0) / entries.length) * 10) / 10
    : 0;

  res.json({
    entries: entries.map((e) => camelize(e)),
    avgRating,
    total: entries.length,
  });
});

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data, error } = await supabase.from("feedback").insert({
    patient_id: parsed.data.patientId ?? null,
    patient_name: parsed.data.patientName ?? null,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  }).select().single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }
  res.status(201).json(camelize(data));
});

export default router;
