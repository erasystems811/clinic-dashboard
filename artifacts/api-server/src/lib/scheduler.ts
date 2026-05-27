import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import {
  sendPostTreatmentCheckinEmail,
  sendPostCareEmail,
  sendAppointmentReminderEmail,
  sendAppointmentNoShowEmail,
  sendFeedbackEmail,
  sendInCareAIReminder,
  sendBirthdayEmail,
  sendCareVisitReminderEmail,
  sendCarePlanEmail,
  type InCareTimeSlot,
} from "./automation.js";
import { signFeedbackToken } from "./feedbackToken.js";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://localhost";

function log(msg: string) {
  console.log(`[scheduler] ${new Date().toISOString()} ${msg}`);
}

// ── Appointment Reminders — runs every 15 minutes ─────────────────────────────
// All reminders now go to the patient's email address.
async function runAppointmentReminders() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hPlus15 = new Date(in24h.getTime() + 15 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in2hPlus15 = new Date(in2h.getTime() + 15 * 60 * 1000);

    const { data: appts } = await supabase
      .from("appointments")
      .select("*, patients(id, first_name, last_name, email, hospital_id)")
      .eq("status", "scheduled")
      .is("reminder_24h_sent_at", null);

    for (const appt of appts ?? []) {
      const scheduledAt = new Date(appt.scheduled_at);
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient || !patient.email) continue;

      const hospitalUsername = patient.hospital_id as string;
      const { data: hospital } = await supabase.from("hospitals").select("id").eq("username", hospitalUsername).single();
      if (!hospital) continue;

      const patientEmail = patient.email as string;
      const patientName = `${patient.first_name} ${patient.last_name}`;

      if (scheduledAt >= in24h && scheduledAt < in24hPlus15) {
        await sendAppointmentReminderEmail(hospital.id, patient.id as number, patientName, patientEmail, appt.scheduled_at, 24);
        await supabase.from("appointments").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", appt.id);
        log(`Sent 24h email reminder for appt ${appt.id}`);
      }

      if (scheduledAt >= in2h && scheduledAt < in2hPlus15 && !appt.reminder_2h_sent_at) {
        await sendAppointmentReminderEmail(hospital.id, patient.id as number, patientName, patientEmail, appt.scheduled_at, 2);
        await supabase.from("appointments").update({ reminder_2h_sent_at: now.toISOString() }).eq("id", appt.id);
        log(`Sent 2h email reminder for appt ${appt.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Appointment reminders error: ${err}`);
  }
}

// ── Post-Treatment Check-ins — runs daily — Day 1, 4, 7 emails only ───────────
// Reads from treatment_end_date directly — pipeline stage is a reflection, not a trigger.
// Supports multi-cycle patients: automation_log check is scoped to the current treatment cycle.
async function runPostTreatmentCheckins() {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      // Source of truth: treatment_end_date — no stage filter needed
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, treatment_end_date")
        .eq("hospital_id", h.username)
        .not("treatment_end_date", "is", null)
        .not("email", "is", null)
        .lte("treatment_end_date", today);

      for (const p of patients ?? []) {
        if (!p.email || !p.treatment_end_date) continue;

        const endDate = new Date(p.treatment_end_date as string);
        const daysSinceEnd = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        const patientName = `${p.first_name} ${p.last_name}`;

        for (const day of [1, 4, 7] as const) {
          if (daysSinceEnd < day) continue; // not yet time
          if (daysSinceEnd > day + 2) continue; // missed window — skip to avoid very delayed sends

          const automationType = `post_treatment_day${day}`;
          // Scope the sent-check to the current treatment cycle (gte treatment_end_date)
          // so a patient who re-enrolls and finishes again receives these emails again
          const { data: alreadySent } = await supabase
            .from("automation_log")
            .select("id")
            .eq("patient_id", p.id)
            .eq("automation_type", automationType)
            .eq("status", "sent")
            .gte("created_at", p.treatment_end_date as string)
            .maybeSingle();

          if (alreadySent) continue;

          await sendPostTreatmentCheckinEmail(h.id, p.id as number, patientName, p.email as string, day);
          log(`Post-treatment Day ${day} email → patient ${p.id} (${daysSinceEnd} days since treatment end)`);
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-treatment checkins error: ${err}`);
  }
}

// ── Post-Care Email — runs daily — every 30 days once patient has entered Post Care ─
// Post Care entry is derived from treatment_end_date + pipeline_post_treatment_days.
// Pipeline stage is a reflection — automations read from records, not stage.
async function runPostCareEmails() {
  try {
    const now = new Date();
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: hsSettings } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_post_treatment_days");

    for (const hs of hsSettings ?? []) {
      const postTreatDays = (hs.pipeline_post_treatment_days as number) ?? 14;
      const { data: hospital } = await supabase
        .from("hospitals").select("id, username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      // Post Care entry ≈ treatment_end_date + postTreatDays days.
      // Send every 30 days: find patients whose Post Care start was >= 30 days ago.
      // i.e. treatment_end_date + postTreatDays + 30 <= today
      // → treatment_end_date <= today − (postTreatDays + 30) days
      const cutoffDate = new Date(now.getTime() - (postTreatDays + 30) * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, treatment_end_date")
        .eq("hospital_id", hospital.username)
        .not("treatment_end_date", "is", null)
        .not("email", "is", null)
        .lte("treatment_end_date", cutoffDate);

      for (const p of patients ?? []) {
        if (!p.email) continue;

        // Send every 30 days — skip if one was already sent within the last 30 days
        const { data: recentSend } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", "post_care_email")
          .eq("status", "sent")
          .gte("created_at", cutoff30)
          .maybeSingle();

        if (recentSend) continue;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendPostCareEmail(hospital.id, p.id as number, patientName, p.email as string);
        log(`Post-care email → patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-care emails error: ${err}`);
  }
}

// ── Dormant Detection — runs daily ────────────────────────────────────────────
// Derives dormant threshold from treatment_end_date + post_treatment_days + dormant_days.
// Pipeline stage is a reflection — only neq("stage","Dormant") used to avoid double-processing.
async function runDormantDetection() {
  try {
    const now = new Date();

    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_dormant_days, pipeline_post_treatment_days");

    for (const hs of hospitals ?? []) {
      const dormantDays = (hs.pipeline_dormant_days as number) ?? 30;
      const postTreatDays = (hs.pipeline_post_treatment_days as number) ?? 14;

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      // Dormant threshold: treatment ended long enough ago that post-care + dormant window has elapsed.
      // treatment_end_date + postTreatDays + dormantDays < today
      // → treatment_end_date < today − (postTreatDays + dormantDays)
      const cutoffDate = new Date(now.getTime() - (postTreatDays + dormantDays) * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, treatment_end_date")
        .eq("hospital_id", hospital.username)
        .not("treatment_end_date", "is", null)
        .lte("treatment_end_date", cutoffDate)
        .neq("stage", "Dormant"); // skip already-dormant to avoid redundant writes

      for (const p of patients ?? []) {
        await supabase.from("patients")
          .update({ stage: "Dormant", updated_at: now.toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Dormant (${dormantDays} days inactive after treatment)`,
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
      // In Care → Post Treatment when treatment_end_date has passed
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

    // Post Treatment → Post Care (configurable days)
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

// ── End-of-Day Feedback Emails — runs daily at 7pm, covers previous day's patients ──
async function runFeedbackEmails() {
  try {
    // Cover patients seen yesterday so late-evening visits are never missed
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split("T")[0];

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
        .gte("added_at", `${targetDate}T00:00:00Z`)
        .lte("added_at", `${targetDate}T23:59:59Z`);

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
          .gte("created_at", `${targetDate}T00:00:00Z`)
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

// ── Auto No-Show Detection ────────────────────────────────────────────────────
async function runNoShowDetection() {
  try {
    const now = new Date();

    const { data: pastAppts } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, patient_id, patient_name")
      .eq("status", "scheduled")
      .lt("scheduled_at", now.toISOString());

    for (const appt of pastAppts ?? []) {
      await supabase.from("appointments").update({ status: "no_show" }).eq("id", appt.id);

      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, hospital_id")
        .eq("id", appt.patient_id)
        .single();

      if (patient) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        await supabase.from("activity").insert({
          type: "no_show",
          description: `Auto no-show: ${patientName} missed appointment "${appt.title}"`,
          patient_id: appt.patient_id,
          patient_name: patientName,
          metadata: appt.scheduled_at,
        }).then(() => {}).catch(() => {});
      }

      log(`Auto no-show: appt ${appt.id} (${appt.patient_name})`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`No-show detection error: ${err}`);
  }
}

// ── Auto No-Show Follow-up Email (1 hour after missed) ───────────────────────
async function runNoShowFollowup() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000);

    const { data: appts } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, patient_id, patient_name")
      .eq("status", "no_show")
      .lt("scheduled_at", oneHourAgo.toISOString())
      .gt("scheduled_at", ninetyMinAgo.toISOString());

    for (const appt of appts ?? []) {
      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, hospital_id")
        .eq("id", appt.patient_id)
        .single();

      if (patient && patient.email) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        const { data: hospital } = await supabase
          .from("hospitals").select("id").eq("username", (patient.hospital_id as string).toLowerCase()).single();

        if (hospital) {
          await sendAppointmentNoShowEmail(hospital.id, patient.id, patientName, patient.email).catch(() => {});
          log(`No-show follow-up email: appt ${appt.id} (${patientName})`);
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`No-show follow-up error: ${err}`);
  }
}

// ── Auto No-Show Dismissal at 11 PM ──────────────────────────────────────────
async function runNoShowDismissal() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const { data: appts } = await supabase
      .from("appointments")
      .select("id, patient_name")
      .eq("status", "no_show")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString());

    for (const appt of appts ?? []) {
      await supabase.from("appointments").update({ status: "dismissed" }).eq("id", appt.id);
      log(`Dismissed no-show appt ${appt.id} (${appt.patient_name}) at end of day`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`No-show dismissal error: ${err}`);
  }
}

// runInCareReminders (slot-based, read from patients.medication_timing) was removed.
// Superseded by runCarePlanRemindersHourly which reads directly from the care_plans table.

// ── Subscription Expiration Auto-Suspend ──────────────────────────────────────
async function checkSubscriptionExpirations() {
  try {
    const now = new Date().toISOString();
    const { data: expired } = await supabase
      .from("hospitals")
      .select("id, name, subscription_expires_at")
      .eq("active", true)
      .not("subscription_expires_at", "is", null)
      .lte("subscription_expires_at", now);

    if (!expired?.length) return;
    log(`Subscription check: ${expired.length} hospital(s) expired, suspending…`);

    for (const h of expired) {
      await supabase
        .from("hospitals")
        .update({ active: false, subscription_status: "inactive" })
        .eq("id", h.id);
      log(`Suspended hospital id=${h.id} name="${h.name}" — subscription expired`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Subscription expiration check failed: ${err}`);
  }
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== "true") {
    log("Scheduler disabled — set ENABLE_SCHEDULER=true to enable (production only)");
    return;
  }

  // Every 15 minutes: appointment reminders + no-show detection + 1-hour follow-up email
  cron.schedule("*/15 * * * *", async () => {
    await runAppointmentReminders();
    await runNoShowDetection();
    await runNoShowFollowup();
  });

  // Daily at 7:00 AM: pipeline transitions + post-treatment check-ins + dormant detection
  cron.schedule("0 7 * * *", async () => {
    await runPostTreatmentTransitions();
    await runPostTreatmentCheckins();
    await runDormantDetection();
  });

  // Daily at 6:00 PM: post-care wellness emails
  cron.schedule("0 18 * * *", async () => {
    await runPostCareEmails();
  });


  // Daily at 12:00 PM: feedback emails (covers previous day's patients)
  cron.schedule("0 12 * * *", async () => {
    await runFeedbackEmails();
  });

  // Daily at 11:00 PM: dismiss any no-shows from today
  cron.schedule("0 23 * * *", async () => {
    await runNoShowDismissal();
  });

  // Every 6 hours: subscription expiration check
  cron.schedule("0 */6 * * *", async () => {
    await checkSubscriptionExpirations();
  });

  // Daily at 8am: birthday emails
  cron.schedule("0 8 * * *", async () => {
    await runBirthdayEmails();
  });

  // Every hour: care plan reminders — time-based (General Outpatient + all departments)
  cron.schedule("0 * * * *", async () => {
    await runCarePlanRemindersHourly();
  });

  // Every 5 minutes: delayed care plan summary emails (sent 20 min after plan is created)
  cron.schedule("*/5 * * * *", async () => {
    await runCarePlanEmailDelay();
  });

  log("Scheduler started — all automations are email-first");
}

// ── Delayed care plan summary emails (20 min after plan creation) ─────────────
// Runs every 5 min. Picks up care plans created 15–25 min ago that haven't had
// a care_plan_email sent yet — giving nurses time for minor last-minute edits.
async function runCarePlanEmailDelay() {
  try {
    const now = new Date();
    const minAge = new Date(now.getTime() - 25 * 60 * 1000); // 25 min ago
    const maxAge = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago

    const { data: plans } = await supabase
      .from("care_plans")
      .select("id, patient_id, hospital_id, department, summary, template_data, created_at")
      .gte("created_at", minAge.toISOString())
      .lte("created_at", maxAge.toISOString());

    if (!plans?.length) return;

    for (const plan of plans) {
      const key = `care_plan_email_${plan.id}`;

      // Resolve integer hospital id
      const { data: hosp } = await supabase
        .from("hospitals")
        .select("id")
        .eq("username", plan.hospital_id as string)
        .single();
      if (!hosp) continue;

      if (await checkSentLog(hosp.id, key)) continue;

      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .eq("id", plan.patient_id as number)
        .single();
      if (!patient?.email) continue;

      const patientName = `${patient.first_name} ${patient.last_name}`;
      const isGeneralOutpatient = (plan.department as string) === "General Outpatient";
      const durationDays = isGeneralOutpatient
        ? ((plan.template_data as Record<string, unknown>)?.durationDays as number | undefined) ?? 1
        : 1;

      await sendCarePlanEmail(
        hosp.id,
        patient.id as number,
        patientName,
        patient.email as string,
        plan.department as string,
        plan.summary as string,
        durationDays,
      );

      // Mark as sent using a unique key so the 5-min cron won't re-send
      await supabase.from("automation_log").insert({
        hospital_id: hosp.id,
        patient_id: patient.id,
        automation_type: key,
        status: "sent",
        channel: "email",
        message: `Care plan email (20-min delay) → ${patient.email}`,
        created_at: new Date().toISOString(),
      });

      log(`Care plan email (delayed) → patient ${patient.id} plan ${plan.id}`);
    }
  } catch (err) {
    Sentry.captureException(err);
  }
}

// ── Dedup helper — checks automation_log for a unique per-event key ──────────
async function checkSentLog(hospitalId: number, key: string): Promise<boolean> {
  const { data } = await supabase
    .from("automation_log")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("automation_type", key)
    .eq("status", "sent")
    .maybeSingle();
  return !!data;
}

// ── Hourly Care Plan Reminders ────────────────────────────────────────────────
// Replaces static slot crons. Fires the right lead time before nurse-set times:
//   General Outpatient — Come to Hospital: 3h before | Medication/Combination: 2h before
//   All other departments: 4h before the scheduled visit time

async function runCarePlanRemindersHourly() {
  try {
    const now = new Date();
    const WINDOW_MS = 25 * 60 * 1000; // ±25 min window around the cron firing time
    const today = now.toISOString().slice(0, 10);

    const { data: hospitals } = await supabase.from("hospitals").select("id, username").eq("active", true);
    if (!hospitals?.length) return;

    for (const h of hospitals) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, summary, template_data")
        .eq("hospital_id", h.id);

      if (!plans?.length) continue;

      for (const plan of plans) {
        const dept = plan.department as string;
        const td = (plan.template_data ?? {}) as Record<string, unknown>;

        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email, stage, treatment_end_date")
          .eq("id", plan.patient_id)
          .eq("hospital_id", h.id)
          .single();

        if (!patient?.email) continue;

        const patientName = `${patient.first_name} ${patient.last_name}`;

        if (dept === "General Outpatient") {
          // Skip if treatment has ended
          const endDate = patient.treatment_end_date as string | undefined;
          if (endDate && today > endDate) continue;

          const treatmentType = (td.treatmentType as string) ?? "";
          const medTiming = (td.medicationTiming as string[]) ?? [];
          const medTimingTimes = (td.medicationTimingTimes as Record<string, string>) ?? {};
          const hospTiming = (td.hospitalTiming as string[]) ?? [];
          const hospTimingTimes = (td.hospitalTimingTimes as Record<string, string>) ?? {};

          if (treatmentType === "medication_only") {
            // Medication only — fire AT the exact time (0h lead)
            for (const slot of medTiming) {
              const timeStr = medTimingTimes[slot];
              if (!timeStr) continue;
              const [hh, mm] = timeStr.split(":").map(Number);
              const visitAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
              if (Math.abs(visitAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_med_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["med"], dept);
              log(`General Outpatient med reminder (at ${timeStr}) → patient ${patient.id} slot=${slot}`);
            }

          } else if (treatmentType === "come_to_hospital") {
            // Come to hospital — fire 3h before
            for (const slot of hospTiming) {
              const timeStr = hospTimingTimes[slot];
              if (!timeStr) continue;
              const [hh, mm] = timeStr.split(":").map(Number);
              const visitAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
              const reminderAt = new Date(visitAt.getTime() - 3 * 3600 * 1000);
              if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_hosp_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["hosp"], dept);
              log(`General Outpatient hospital reminder (3h before ${timeStr}) → patient ${patient.id} slot=${slot}`);
            }

          } else if (treatmentType === "combination") {
            // Combination — ONE combined message 2h before, covering both med + hospital
            const allSlots = new Set([...medTiming, ...hospTiming]);
            for (const slot of allSlots) {
              // Reference time: prefer hospital time (more time-sensitive), fall back to med time
              const refTime = hospTimingTimes[slot] || medTimingTimes[slot];
              if (!refTime) continue;
              const [hh, mm] = refTime.split(":").map(Number);
              const visitAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
              const reminderAt = new Date(visitAt.getTime() - 2 * 3600 * 1000);
              if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_combo_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              const types: Array<"med" | "hosp"> = [];
              if (medTiming.includes(slot)) types.push("med");
              if (hospTiming.includes(slot)) types.push("hosp");
              await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, types, dept);
              log(`General Outpatient combination reminder (2h before ${refTime}) → patient ${patient.id} slot=${slot} types=${types.join("+")}`);
            }
          }
        } else {
          // All other departments — remind 4 hours before nurse-set visit time
          const entries = extractVisitEntries(dept, td);
          for (const entry of entries) {
            if (!entry.date || !entry.time) continue;
            const visitAt = new Date(`${entry.date}T${entry.time}:00`);
            const reminderAt = new Date(visitAt.getTime() - 4 * 3600 * 1000);
            if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
            const key = `care_visit_${plan.id}_${entry.date}_${entry.time.replace(":", "")}`;
            const alreadySent = await checkSentLog(h.id, key);
            if (alreadySent) continue;
            await sendCareVisitReminderEmail(
              h.id, patient.id as number, patientName, patient.email as string,
              dept, plan.summary as string, entry.date, plan.id as number, entry.time,
            );
            log(`${dept} visit reminder (4h before ${entry.time}) → patient ${patient.id} on ${entry.date}`);
          }
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Care plan hourly reminders error: ${err}`);
  }
}

// ── Care Visit Reminders — (kept for reference, superseded by runCarePlanRemindersHourly) ──

interface VisitEntry { date: string; time?: string; }

function extractVisitEntries(dept: string, templateData: Record<string, unknown>): VisitEntry[] {
  const entries: VisitEntry[] = [];
  const today = new Date().toISOString().slice(0, 10);

  if (dept === "Antenatal / Maternity") {
    const rows = (templateData.ancSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date > today) entries.push({ date: r.date, time: r.time });
  } else if (dept === "Paediatrics") {
    const rows = (templateData.vaccinationSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date > today) entries.push({ date: r.date, time: r.time });
  } else if (dept === "Surgery / Post-Op" || dept === "Dental" || dept === "Eye" || dept === "Fertility / IVF") {
    const rows = (templateData.inCareSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date > today) entries.push({ date: r.date, time: r.time });
    if (dept === "Surgery / Post-Op") {
      const pd = templateData.procedureDate as string | undefined;
      const pt = templateData.procedureTime as string | undefined;
      if (pd && pd > today) entries.push({ date: pd, time: pt });
    }
  }
  return entries;
}

async function runCareVisitReminders() {
  try {
    // Fire at 7pm: remind patients about tomorrow's appointment
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);

    const { data: hospitals } = await supabase.from("hospitals").select("id, username").eq("active", true);
    if (!hospitals?.length) return;

    for (const h of hospitals) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, summary, template_data")
        .eq("hospital_id", h.id);

      if (!plans?.length) continue;

      for (const plan of plans) {
        const dept = plan.department as string;
        const templateData = (plan.template_data ?? {}) as Record<string, unknown>;

        // General Outpatient fires daily (handled separately via daily automation logic)
        if (dept === "General Outpatient") continue;

        const entries = extractVisitEntries(dept, templateData);
        const match = entries.find(e => e.date === tomorrowDate);
        if (!match) continue;

        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email")
          .eq("id", plan.patient_id)
          .eq("hospital_id", h.id)
          .single();

        if (!patient?.email) continue;

        const alreadySent = await checkSentLog(h.id, `care_visit_${plan.id}_${tomorrowDate}`);
        if (alreadySent) continue;

        const patientName = `${patient.first_name} ${patient.last_name}`;
        await sendCareVisitReminderEmail(
          h.id, patient.id as number, patientName, patient.email as string,
          dept, plan.summary as string, tomorrowDate, plan.id as number, match.time,
        );
        log(`Care visit reminder → patient ${patient.id} (${patientName}) dept=${dept} date=${tomorrowDate} time=${match.time ?? "n/a"}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Care visit reminders error: ${err}`);
  }
}

// ── Birthday Emails — runs daily at 8am ───────────────────────────────────────
async function runBirthdayEmails() {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayMD = `${month}-${day}`; // e.g. "05-27"

    const { data: hospitals } = await supabase.from("hospitals").select("id, username").eq("active", true);

    for (const h of hospitals ?? []) {
      // Find patients whose date_of_birth month+day matches today
      // date_of_birth is stored as YYYY-MM-DD; we match on MM-DD suffix
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, date_of_birth")
        .eq("hospital_id", h.username)
        .not("email", "is", null)
        .not("date_of_birth", "is", null)
        .like("date_of_birth", `%-${todayMD}`);

      for (const p of patients ?? []) {
        if (!p.email) continue;

        // Only send once per year — check if birthday email already sent this calendar year
        const yearStart = `${now.getFullYear()}-01-01T00:00:00Z`;
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", "birthday_email")
          .eq("status", "sent")
          .gte("created_at", yearStart)
          .maybeSingle();

        if (alreadySent) continue;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendBirthdayEmail(h.id, p.id as number, patientName, p.email as string);
        log(`Birthday email → patient ${p.id} (${patientName})`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Birthday emails error: ${err}`);
  }
}
