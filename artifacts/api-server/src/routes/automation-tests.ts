import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import {
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendAppointmentNoShowEmail,
  sendPostTreatmentCheckinEmail,
  sendPostCareEmail,
  sendBirthdayEmail,
  sendFeedbackEmail,
  sendCarePlanEmail,
  sendInCareAIReminder,
  sendCareVisitReminderEmail,
  sendCallTaskManualEmail,
} from "../lib/automation.js";

const router = Router();

function getSecret() {
  return process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    if (Date.now() > parseInt(payload.split(":")[1], 10)) return false;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-super-admin-token"] as string | undefined;
  if (!token || !verifyToken(token)) return void res.status(401).json({ error: "Unauthorized" });
  next();
}

// Test patient ID — non-existent so it never pollutes real dedup keys
const TEST_PATIENT_ID = -1;
const TEST_PATIENT_NAME = "Test Patient";

// POST /super-admin/automation-test
// Fires a specific email automation send function with a provided test email.
// Uses patientId = -1 so automation_log entries (if created) don't affect real dedup.
router.post("/super-admin/automation-test", auth, async (req: Request, res: Response) => {
  const { automationType, hospitalId, toEmail } = req.body as {
    automationType: string;
    hospitalId: number;
    toEmail: string;
  };

  if (!automationType || !hospitalId || !toEmail) {
    return void res.status(400).json({ error: "automationType, hospitalId, and toEmail are required" });
  }

  if (!toEmail.includes("@")) {
    return void res.status(400).json({ error: "Invalid toEmail" });
  }

  const hId = Number(hospitalId);

  // Verify hospital exists
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("id, name")
    .eq("id", hId)
    .single();

  if (!hospital) {
    return void res.status(404).json({ error: "Hospital not found" });
  }

  try {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const in2h = new Date(Date.now() + 2 * 3_600_000).toISOString();
    const in24h = new Date(Date.now() + 24 * 3_600_000).toISOString();

    const SAMPLE_PLAN = "Patient has been diagnosed with hypertension and is on blood pressure management. Medication: Amlodipine 5mg to be taken once daily in the morning. Dietary guidance: reduce salt intake, avoid processed foods and caffeine. Monitoring: check blood pressure weekly and report any readings above 160/100 to the clinic immediately. Follow-up appointment in 2 weeks.";

    switch (automationType) {
      case "appointment_confirmation":
        await sendAppointmentConfirmationEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in2h);
        break;
      case "appointment_reminder_24h":
        await sendAppointmentReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in24h, 24);
        break;
      case "appointment_reminder_2h":
        await sendAppointmentReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in2h, 2);
        break;
      case "no_show_followup":
        await sendAppointmentNoShowEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "post_treatment_day1":
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 1);
        break;
      case "post_treatment_day4":
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 4);
        break;
      case "post_treatment_day7":
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 7);
        break;
      case "post_care_email":
        await sendPostCareEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "birthday_email":
        await sendBirthdayEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "feedback_email":
        await sendFeedbackEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "https://era.hospital/feedback/test");
        break;
      case "care_plan_email":
        await sendCarePlanEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "General Outpatient", SAMPLE_PLAN, 7);
        break;
      case "in_care_reminder_morning":
        await sendInCareAIReminder(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, SAMPLE_PLAN, "morning", ["med", "hosp"], "General Outpatient");
        break;
      case "care_visit_reminder":
        await sendCareVisitReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "Cardiology", SAMPLE_PLAN, tomorrow, 9999, "09:00");
        break;
      case "call_task_manual":
        await sendCallTaskManualEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "This is a test message from the Era automation system. Your care team is thinking of you and wants to remind you to stay consistent with your prescribed routine. Please do not hesitate to reach out if you have any questions.");
        break;
      default:
        return void res.status(400).json({ error: `Unknown automation type: ${automationType}` });
    }

    res.json({ ok: true, automationType, sentTo: toEmail });
  } catch (err: unknown) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, automationType, error: message });
  }
});

export default router;
