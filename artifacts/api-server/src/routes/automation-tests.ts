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
  sendCallTaskConfirmedMessage,
  sendDepartmentalFollowupEmail,
  sendBeneficiaryReminderEmail,
  sendQueueJoinMessage,
  sendQueueNextInLine,
  sendQueueYourTurn,
  sendQueueLongWaitApology,
  sendCarePlanNotification,
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

const SAMPLE_PLAN = "Patient has been diagnosed with hypertension and is on blood pressure management. Medication: Amlodipine 5mg to be taken once daily in the morning. Dietary guidance: reduce salt intake, avoid processed foods and caffeine. Monitoring: check blood pressure weekly and report any readings above 160/100 to the clinic immediately. Follow-up appointment in 2 weeks.";

// POST /super-admin/automation-test
// Fires a specific automation send function.
// Email automations: requires toEmail.
// SMS/WhatsApp automations: requires toPhone.
// Uses patientId = -1 so automation_log entries don't affect real dedup.
router.post("/super-admin/automation-test", auth, async (req: Request, res: Response) => {
  const { automationType, hospitalId, toEmail, toPhone } = req.body as {
    automationType: string;
    hospitalId: number;
    toEmail?: string;
    toPhone?: string;
  };

  if (!automationType || !hospitalId) {
    return void res.status(400).json({ error: "automationType and hospitalId are required" });
  }

  const hId = Number(hospitalId);

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
    const in2h  = new Date(Date.now() + 2  * 3_600_000).toISOString();
    const in24h = new Date(Date.now() + 24 * 3_600_000).toISOString();

    // ── Email automations ──────────────────────────────────────────────────
    switch (automationType) {
      case "appointment_confirmation":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendAppointmentConfirmationEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in2h);
        break;
      case "appointment_reminder_24h":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendAppointmentReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in24h, 24);
        break;
      case "appointment_reminder_2h":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendAppointmentReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, in2h, 2);
        break;
      case "no_show_followup":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendAppointmentNoShowEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "post_treatment_day1":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 1);
        break;
      case "post_treatment_day4":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 4);
        break;
      case "post_treatment_day7":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendPostTreatmentCheckinEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, 7);
        break;
      case "post_care_email":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendPostCareEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "birthday_email":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendBirthdayEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail);
        break;
      case "feedback_email":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendFeedbackEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "https://era.hospital/feedback/test");
        break;
      case "care_plan_email":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendCarePlanEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "General Outpatient", SAMPLE_PLAN, 7);
        break;
      case "in_care_reminder_morning":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendInCareAIReminder(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, SAMPLE_PLAN, "morning", ["med", "hosp"], "General Outpatient");
        break;
      case "care_visit_reminder":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendCareVisitReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "Cardiology", SAMPLE_PLAN, tomorrow, 9999, "09:00");
        break;
      case "call_task_manual":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendCallTaskManualEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "This is a test message from the Era automation system. Your care team is thinking of you and wants to remind you to stay consistent with your prescribed routine. Please do not hesitate to reach out if you have any questions.");
        break;
      case "call_task_automated":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendCallTaskConfirmedMessage(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "This is a test AI-drafted follow-up message. Your care team reviewed your recent visit and wanted to check in to make sure you are feeling well. Please reach out if you have any concerns.");
        break;
      case "departmental_followup":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendDepartmentalFollowupEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toEmail, "Cardiology", 7);
        break;
      case "beneficiary_reminder":
        if (!toEmail) return void res.status(400).json({ error: "toEmail required" });
        await sendBeneficiaryReminderEmail(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, "Test Family Member", toEmail, "take their 9am medication", "wife");
        break;

      // ── SMS / WhatsApp automations ─────────────────────────────────────
      case "queue_join":
        if (!toPhone) return void res.status(400).json({ error: "toPhone required" });
        await sendQueueJoinMessage(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toPhone, 3);
        break;
      case "queue_next_in_line":
        if (!toPhone) return void res.status(400).json({ error: "toPhone required" });
        await sendQueueNextInLine(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toPhone);
        break;
      case "queue_your_turn":
        if (!toPhone) return void res.status(400).json({ error: "toPhone required" });
        await sendQueueYourTurn(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toPhone);
        break;
      case "queue_long_wait":
        if (!toPhone) return void res.status(400).json({ error: "toPhone required" });
        await sendQueueLongWaitApology(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toPhone);
        break;
      case "care_plan_notification":
        if (!toPhone) return void res.status(400).json({ error: "toPhone required" });
        await sendCarePlanNotification(hId, TEST_PATIENT_ID, TEST_PATIENT_NAME, toPhone);
        break;

      default:
        return void res.status(400).json({ error: `Unknown automation type: ${automationType}` });
    }

    res.json({ ok: true, automationType });
  } catch (err: unknown) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, automationType, error: message });
  }
});

export default router;
