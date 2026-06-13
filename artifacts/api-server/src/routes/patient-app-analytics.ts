import { Router } from "express";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router = Router();

// ── POST /api/patient-app/track — fire-and-forget page view ─────────────────
// No auth required. Called on every route change in the ERA patient app.
router.post("/api/patient-app/track", async (req, res) => {
  // Always respond immediately — tracking must never slow the app
  res.json({ ok: true });
  try {
    const body = z.object({
      route:      z.string().min(1).max(200),
      sessionId:  z.string().min(1).max(100),
      deviceType: z.string().max(50).optional(),
    }).parse(req.body);

    const patient = await getPatientFromRequest(req).catch(() => null);

    void supabase.from("era_patient_analytics").insert({
      patient_id:  patient?.id ?? null,
      session_id:  body.sessionId,
      route:       body.route,
      device_type: body.deviceType ?? "unknown",
    });
  } catch { /* ignore */ }
});

// ── POST /api/patient-app/feedback — submit in-app feedback ─────────────────
router.post("/api/patient-app/feedback", async (req, res) => {
  try {
    const patient = await getPatientFromRequest(req);
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

export default router;
