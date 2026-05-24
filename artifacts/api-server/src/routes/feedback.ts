import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";
import crypto from "crypto";
import { verifyHospitalToken } from "./super-admin.js";

const router: IRouter = Router();

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "fallback-feedback-secret";

function signFeedbackToken(patientId: number, hospitalId: number): string {
  const payload = `f:${patientId}:${hospitalId}`;
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return `${encoded}.${sig}`;
}

function verifyFeedbackToken(token: string): { patientId: number; hospitalId: number } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
    if (sig !== expected) return null;
    const parts = payload.split(":");
    if (parts[0] !== "f" || parts.length !== 3) return null;
    const patientId = parseInt(parts[1], 10);
    const hospitalId = parseInt(parts[2], 10);
    if (isNaN(patientId) || isNaN(hospitalId)) return null;
    return { patientId, hospitalId };
  } catch {
    return null;
  }
}

router.post("/patients/:id/feedback-link", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) { res.status(400).json({ error: "Invalid patient ID" }); return; }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("id", patientId)
    .single();

  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }

  const token = signFeedbackToken(patientId, hospitalId);
  res.json({ token });
});

router.get("/feedback/form/:token", async (req, res): Promise<void> => {
  const decoded = verifyFeedbackToken(req.params.token);
  if (!decoded) { res.status(400).json({ error: "Invalid or expired link" }); return; }

  const { patientId, hospitalId } = decoded;

  const [{ data: patient }, { data: hospital }] = await Promise.all([
    supabase.from("patients").select("id, first_name, last_name").eq("id", patientId).single(),
    supabase.from("hospitals").select("id, name").eq("id", hospitalId).single(),
  ]);

  if (!patient) { res.status(404).json({ error: "Patient not found" }); return; }
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const { data: existing } = await supabase
    .from("feedback")
    .select("id")
    .eq("feedback_token", req.params.token)
    .maybeSingle();

  res.json({
    patientId: patient.id,
    patientName: `${patient.first_name} ${patient.last_name}`,
    hospitalName: hospital.name,
    alreadySubmitted: !!existing,
  });
});

const SubmitFeedbackBody = z.object({
  token: z.string().optional(),
  patientId: z.number().int().optional(),
  patientName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  waitTimeRating: z.number().int().min(1).max(5).optional(),
  staffFriendlinessRating: z.number().int().min(1).max(5).optional(),
  qualityOfCareRating: z.number().int().min(1).max(5).optional(),
  wouldRecommend: z.boolean().optional(),
  comment: z.string().optional(),
});

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  let resolvedPatientId = d.patientId ?? null;
  let resolvedPatientName = d.patientName ?? null;
  let resolvedHospitalId: number | null = null;

  if (d.token) {
    const decoded = verifyFeedbackToken(d.token);
    if (!decoded) { res.status(400).json({ error: "Invalid feedback token" }); return; }

    const { data: existing } = await supabase
      .from("feedback")
      .select("id")
      .eq("feedback_token", d.token)
      .maybeSingle();
    if (existing) { res.status(409).json({ error: "Feedback already submitted for this link" }); return; }

    resolvedPatientId = decoded.patientId;
    resolvedHospitalId = decoded.hospitalId;

    const { data: patient } = await supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", decoded.patientId)
      .single();
    if (patient) resolvedPatientName = `${patient.first_name} ${patient.last_name}`;
  }

  const { data, error } = await supabase.from("feedback").insert({
    patient_id: resolvedPatientId,
    patient_name: resolvedPatientName,
    hospital_id: resolvedHospitalId,
    rating: d.rating,
    wait_time_rating: d.waitTimeRating ?? null,
    staff_friendliness_rating: d.staffFriendlinessRating ?? null,
    quality_of_care_rating: d.qualityOfCareRating ?? null,
    would_recommend: d.wouldRecommend ?? null,
    comment: d.comment ?? null,
    feedback_token: d.token ?? null,
  }).select().single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }
  res.status(201).json(camelize(data));
});

router.get("/feedback", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;

  let query = supabase.from("feedback").select("*").order("submitted_at", { ascending: false });
  if (hospitalId) {
    query = query.eq("hospital_id", hospitalId);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const entries = data ?? [];

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0;

  const overallRatings = entries.map(e => e.rating).filter(Boolean) as number[];
  const waitRatings = entries.map(e => e.wait_time_rating).filter(Boolean) as number[];
  const staffRatings = entries.map(e => e.staff_friendliness_rating).filter(Boolean) as number[];
  const careRatings = entries.map(e => e.quality_of_care_rating).filter(Boolean) as number[];
  const recommends = entries.filter(e => e.would_recommend != null);

  const distribution = [1, 2, 3, 4, 5].map(star => ({
    star,
    count: overallRatings.filter(r => r === star).length,
  }));

  res.json({
    entries: entries.map(e => camelize(e)),
    total: entries.length,
    avgRating: avg(overallRatings),
    avgWaitTime: avg(waitRatings),
    avgStaffFriendliness: avg(staffRatings),
    avgQualityOfCare: avg(careRatings),
    recommendRate: recommends.length > 0
      ? Math.round((recommends.filter(e => e.would_recommend).length / recommends.length) * 100)
      : null,
    distribution,
  });
});

export default router;
