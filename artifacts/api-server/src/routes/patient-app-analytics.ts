import { Router } from "express";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router = Router();

// ── POST /api/patient-app/track — page view tracker ──────────────────────────
// No auth required. Called on every route change in the ERA patient app.
router.post("/patient-app/track", async (req, res) => {
  // Respond immediately so the client is never blocked
  res.json({ ok: true });
  try {
    const body = z.object({
      route:      z.string().min(1).max(200),
      sessionId:  z.string().min(1).max(100),
      deviceType: z.string().max(50).optional(),
    }).parse(req.body);

    const patient = await getPatientFromRequest(req).catch(() => null);

    const { error } = await supabase.from("era_patient_analytics").insert({
      patient_id:  patient?.id ?? null,
      session_id:  body.sessionId,
      route:       body.route,
      device_type: body.deviceType ?? "unknown",
    });

    if (error) console.error("[analytics:track]", error.code, error.message);
  } catch (e) {
    console.error("[analytics:track]", e instanceof Error ? e.message : e);
  }
});

// ── POST /api/patient-app/feedback — submit in-app feedback ─────────────────
router.post("/patient-app/feedback", async (req, res) => {
  try {
    const patient = await getPatientFromRequest(req);
    if (!patient) { res.status(401).json({ error: "Unauthorized" }); return; }
    const body = z.object({
      rating:   z.number().int().min(1).max(5).optional(),
      category: z.enum(["general", "bug", "feature", "praise"]).default("general"),
      message:  z.string().min(1).max(2000),
    }).parse(req.body);

    await supabase.from("era_patient_feedback").insert({
      patient_id: patient.id,
      username:   patient.username,
      rating:     body.rating ?? null,
      category:   body.category,
      message:    body.message,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

// ── GET /api/patient-app/feedback-broadcast — client polls to detect manual nudge ──
// Public (no auth needed). Returns the last time superadmin pushed the nudge.
router.get("/patient-app/feedback-broadcast", async (_req, res) => {
  const { data } = await supabase
    .from("feedback_broadcast")
    .select("triggered_at")
    .eq("id", 2)
    .single();
  res.json({ triggeredAt: (data?.triggered_at as string | null) ?? null });
});

export default router;
