import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import {
  sendPostTreatmentCheckin,
  sendPostCareWellness,
  sendAppointmentReminder,
  sendFeedbackEmail,
} from "./automation.js";
import { signFeedbackToken } from "./feedbackToken.js";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://localhost";

function log(msg: string) {
  console.log(`[scheduler] ${new Date().toISOString()} ${msg}`);
}

// ── Appointment Reminders — runs every 15 minutes ─────────────────────────────
async function runAppointmentReminders() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hPlus15 = new Date(in24h.getTime() + 15 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in2hPlus15 = new Date(in2h.getTime() + 15 * 60 * 1000);

    const { data: appts } = await supabase
      .from("appointments")
      .select("*, patients(id, first_name, last_name, phone, whatsapp_number, hospital_id)")
      .eq("status", "scheduled")
      .is("reminder_24h_sent_at", null);

    for (const appt of appts ?? []) {
      const scheduledAt = new Date(appt.scheduled_at);
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient || !patient.phone) continue;

      const hospitalUsername = patient.hospital_id as string;
      const { data: hospital } = await supabase.from("hospitals").select("id").eq("username", hospitalUsername).single();
      if (!hospital) continue;

      const phone = (patient.whatsapp_number as string) || (patient.phone as string);
      const patientName = `${patient.first_name} ${patient.last_name}`;

      if (scheduledAt >= in24h && scheduledAt < in24hPlus15) {
        await sendAppointmentReminder(hospital.id, patient.id as number, patientName, phone, appt.title, appt.scheduled_at, 24);
        await supabase.from("appointments").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", appt.id);
        log(`Sent 24h reminder for appt ${appt.id}`);
      }

      if (scheduledAt >= in2h && scheduledAt < in2hPlus15 && !appt.reminder_2h_sent_at) {
        await sendAppointmentReminder(hospital.id, patient.id as number, patientName, phone, appt.title, appt.scheduled_at, 2);
        await supabase.from("appointments").update({ reminder_2h_sent_at: now.toISOString() }).eq("id", appt.id);
        log(`Sent 2h reminder for appt ${appt.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Appointment reminders error: ${err}`);
  }
}

// ── Post-Treatment Check-ins — runs daily ─────────────────────────────────────
async function runPostTreatmentCheckins() {
  try {
    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, post_treatment_checkin_days");

    for (const hs of hospitals ?? []) {
      const freqDays = (hs.post_treatment_checkin_days as number) ?? 3;
      const cutoff = new Date(Date.now() - freqDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", hospital.username)
        .or(`last_checkin_sent_at.is.null,last_checkin_sent_at.lt.${cutoff}`);

      for (const p of patients ?? []) {
        const phone = (p.whatsapp_number as string) || (p.phone as string);
        if (!phone) continue;
        const patientName = `${p.first_name} ${p.last_name}`;

        const { count } = await supabase
          .from("automation_log")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", p.id)
          .eq("automation_type", "post_treatment_checkin");

        await sendPostTreatmentCheckin(hs.hospital_id as number, p.id as number, patientName, phone, (count ?? 0) + 1);
        await supabase.from("patients").update({ last_checkin_sent_at: new Date().toISOString() }).eq("id", p.id);
        log(`Post-treatment check-in sent to patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-treatment checkins error: ${err}`);
  }
}

// ── Post-Care Wellness Messages — runs daily ──────────────────────────────────
async function runPostCareWellness() {
  try {
    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, post_care_checkin_days");

    for (const hs of hospitals ?? []) {
      const freqDays = (hs.post_care_checkin_days as number) ?? 7;
      const cutoff = new Date(Date.now() - freqDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number")
        .eq("stage", "Post Care")
        .eq("hospital_id", hospital.username)
        .or(`last_wellness_sent_at.is.null,last_wellness_sent_at.lt.${cutoff}`);

      for (const p of patients ?? []) {
        const phone = (p.whatsapp_number as string) || (p.phone as string);
        if (!phone) continue;
        const patientName = `${p.first_name} ${p.last_name}`;

        const { count } = await supabase
          .from("automation_log")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", p.id)
          .eq("automation_type", "post_care_wellness");

        await sendPostCareWellness(hs.hospital_id as number, p.id as number, patientName, phone, (count ?? 0) + 1);
        await supabase.from("patients").update({ last_wellness_sent_at: new Date().toISOString() }).eq("id", p.id);
        log(`Post-care wellness sent to patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-care wellness error: ${err}`);
  }
}

// ── Dormant Detection — runs daily ────────────────────────────────────────────
async function runDormantDetection() {
  try {
    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_dormant_days");

    for (const hs of hospitals ?? []) {
      const dormantDays = (hs.pipeline_dormant_days as number) ?? 30;
      const cutoff = new Date(Date.now() - dormantDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, updated_at")
        .eq("stage", "Post Care")
        .eq("hospital_id", hospital.username)
        .lt("updated_at", cutoff);

      for (const p of patients ?? []) {
        await supabase.from("patients")
          .update({ stage: "Dormant", updated_at: new Date().toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Dormant (${dormantDays} days inactive)`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Dormant",
        });
        log(`Patient ${p.id} moved to Dormant`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Dormant detection error: ${err}`);
  }
}

// ── Post Treatment → Post Care Transition — runs daily ───────────────────────
async function runPostTreatmentTransitions() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, treatment_end_date")
        .eq("stage", "In Care")
        .eq("hospital_id", h.username)
        .lte("treatment_end_date", today);

      for (const p of patients ?? []) {
        await supabase.from("patients")
          .update({ stage: "Post Treatment", updated_at: new Date().toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Post Treatment (treatment ended)`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Post Treatment",
        });
        log(`Patient ${p.id} moved to Post Treatment`);
      }
    }

    // Post Treatment → Post Care
    const { data: hsSettings } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_post_treatment_days");

    for (const hs of hsSettings ?? []) {
      const postTreatDays = (hs.pipeline_post_treatment_days as number) ?? 14;
      const cutoff = new Date(Date.now() - postTreatDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", hospital.username)
        .lt("updated_at", cutoff);

      for (const p of patients ?? []) {
        await supabase.from("patients")
          .update({ stage: "Post Care", updated_at: new Date().toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Post Care`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Post Care",
        });
        log(`Patient ${p.id} moved to Post Care`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post treatment transitions error: ${err}`);
  }
}

// ── End-of-Day Feedback Emails — runs daily at 9pm ───────────────────────────
async function runFeedbackEmails() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase
      .from("hospital_modules")
      .select("hospital_id, feedback_enabled")
      .eq("feedback_enabled", true);

    for (const hm of hospitals ?? []) {
      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hm.hospital_id).single();
      if (!hospital) continue;

      const { data: seenPatients } = await supabase
        .from("queue")
        .select("patient_id, patient_name")
        .eq("hospital_id", hospital.username)
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`);

      const patientIds = [...new Set((seenPatients ?? []).map((q: Record<string, unknown>) => q.patient_id as number))];

      for (const patientId of patientIds) {
        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email")
          .eq("id", patientId)
          .single();

        if (!patient || !patient.email) continue;

        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", patientId)
          .eq("automation_type", "feedback_email")
          .eq("status", "sent")
          .gte("created_at", `${today}T00:00:00Z`)
          .maybeSingle();

        if (alreadySent) continue;

        const token = signFeedbackToken(patientId, hm.hospital_id as number);
        const feedbackUrl = `${APP_BASE_URL}/feedback/${token}`;
        const patientName = `${patient.first_name} ${patient.last_name}`;

        await sendFeedbackEmail(hm.hospital_id as number, patientId, patientName, patient.email, token, feedbackUrl);
        log(`Feedback email sent to patient ${patientId}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Feedback emails error: ${err}`);
  }
}

export function startScheduler() {
  // Every 15 minutes: appointment reminders
  cron.schedule("*/15 * * * *", runAppointmentReminders);

  // Daily at 6am: pipeline transitions + check-ins
  cron.schedule("0 6 * * *", async () => {
    await runPostTreatmentTransitions();
    await runPostTreatmentCheckins();
    await runPostCareWellness();
    await runDormantDetection();
  });

  // Daily at 9pm: end-of-day feedback emails
  cron.schedule("0 21 * * *", runFeedbackEmails);

  log("Scheduler started");
}
