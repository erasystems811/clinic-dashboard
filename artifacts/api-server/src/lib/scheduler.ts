import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import {
  sendPostTreatmentCheckin,
  sendPostCareWellness,
  sendAppointmentReminder,
  sendAppointmentNoShowFollowUp,
  sendFeedbackEmail,
  sendInCareDailyMessage,
  sendCareReminder,
  type MedicationPeriod,
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

// ── In-Care Daily Messages — runs daily ───────────────────────────────────────
async function runInCareDailyMessages() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number, treatment_plan, medication_timing, treatment_type, treatment_duration_days, treatment_started_at")
        .eq("stage", "In Care")
        .eq("hospital_id", h.username);

      for (const p of patients ?? []) {
        const phone = (p.whatsapp_number as string) || (p.phone as string);
        if (!phone) continue;

        // Check if we already sent a daily message today
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", "in_care_daily")
          .eq("status", "sent")
          .gte("created_at", `${today}T00:00:00Z`)
          .lte("created_at", `${today}T23:59:59Z`)
          .maybeSingle();

        if (alreadySent) continue;

        const startedAt = p.treatment_started_at ? new Date(p.treatment_started_at as string) : new Date();
        const dayNumber = Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const totalDays = (p.treatment_duration_days as number) ?? 30;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendInCareDailyMessage(
          h.id,
          p.id as number,
          patientName,
          phone,
          (p.treatment_plan as string) ?? "",
          (p.medication_timing as string | null) ?? null,
          (p.treatment_type as string) ?? "treatment",
          dayNumber,
          totalDays,
        );
        log(`In-care daily message sent to patient ${p.id} (day ${dayNumber}/${totalDays})`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`In-care daily messages error: ${err}`);
  }
}

// ── Medication Timing Reminders — runs every 30 min ──────────────────────────
// Nigeria WAT = UTC+1. Windows (UTC hours):
//   Morning   → 6–9   (7am–10am WAT)
//   Afternoon → 11–14 (12pm–3pm WAT)
//   Night     → 18–20 (7pm–9pm WAT)

function currentPeriod(): MedicationPeriod | null {
  const utcHour = new Date().getUTCHours();
  if (utcHour >= 6 && utcHour < 9) return "morning";
  if (utcHour >= 11 && utcHour < 14) return "afternoon";
  if (utcHour >= 18 && utcHour < 20) return "night";
  return null;
}

function hasPeriod(timing: string, period: MedicationPeriod): boolean {
  const t = timing.toLowerCase();
  if (period === "night") return t.includes("night") || t.includes("evening");
  return t.includes(period);
}

async function runMedicationReminders() {
  const period = currentPeriod();
  if (!period) return; // outside all reminder windows

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number, treatment_plan, medication_timing, treatment_type, treatment_duration_days, treatment_started_at")
        .eq("stage", "In Care")
        .eq("hospital_id", h.username);

      for (const p of patients ?? []) {
        const medicationTiming = (p.medication_timing as string | null) ?? "";
        if (!medicationTiming || !hasPeriod(medicationTiming, period)) continue;

        const phone = (p.whatsapp_number as string) || (p.phone as string);
        if (!phone) continue;

        // Skip if already sent this period today
        const automationType = `care_reminder_${period}`;
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", automationType)
          .eq("status", "sent")
          .gte("created_at", `${today}T00:00:00Z`)
          .lte("created_at", `${today}T23:59:59Z`)
          .maybeSingle();

        if (alreadySent) continue;

        const startedAt = p.treatment_started_at ? new Date(p.treatment_started_at as string) : new Date();
        const dayNumber = Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const totalDays = (p.treatment_duration_days as number) ?? 30;
        const patientName = `${p.first_name} ${p.last_name}`;

        await sendCareReminder(
          h.id,
          p.id as number,
          patientName,
          phone,
          (p.treatment_plan as string) ?? "",
          medicationTiming,
          period,
          dayNumber,
          totalDays,
        );
        log(`Medication reminder (${period}) sent to patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Medication reminders error: ${err}`);
  }
}

// ── Post-Treatment Check-ins — runs daily ─────────────────────────────────────
async function runPostTreatmentCheckins() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, post_treatment_checkin_days");

    for (const hs of hospitals ?? []) {
      // post_treatment_checkin_days = total number of days to send daily check-ins after treatment ends
      const durationDays = (hs.post_treatment_checkin_days as number) ?? 14;
      const windowStart = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: hospital } = await supabase.from("hospitals").select("username").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      // Only patients whose treatment ended within the check-in window
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number, treatment_end_date")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", hospital.username)
        .gte("treatment_end_date", windowStart);

      for (const p of patients ?? []) {
        const phone = (p.whatsapp_number as string) || (p.phone as string);
        if (!phone) continue;

        // Only once per day — skip if already sent today
        const { data: sentToday } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", "post_treatment_checkin")
          .eq("status", "sent")
          .gte("created_at", `${today}T00:00:00Z`)
          .lte("created_at", `${today}T23:59:59Z`)
          .maybeSingle();

        if (sentToday) continue;

        const patientName = `${p.first_name} ${p.last_name}`;

        const { count } = await supabase
          .from("automation_log")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", p.id)
          .eq("automation_type", "post_treatment_checkin");

        await sendPostTreatmentCheckin(hs.hospital_id as number, p.id as number, patientName, phone, (count ?? 0) + 1);
        log(`Post-treatment check-in sent to patient ${p.id} (day ${(count ?? 0) + 1} of ${durationDays})`);
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
      const freqDays = (hs.post_care_checkin_days as number) ?? 30;
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

// ── Auto No-Show Detection ────────────────────────────────────────────────────
// Runs every 15 min — marks past-due scheduled appointments as no_show and
// creates a receptionist call task. The follow-up message is intentionally
// NOT sent here; it goes out 1 hour later via runNoShowFollowup().
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
        .select("id, first_name, last_name, phone, whatsapp_number, hospital_id")
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

// ── Auto No-Show Follow-up (1 hour after missed) ──────────────────────────────
// Runs every 15 min — finds no_show appointments where exactly 1 hour has
// passed since the scheduled time (uses a rolling 30-min window so the check
// fires once and never re-fires for the same appointment).
async function runNoShowFollowup() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000);

    // Only appointments where scheduled_at is between 60 and 90 minutes ago
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, title, scheduled_at, patient_id, patient_name")
      .eq("status", "no_show")
      .lt("scheduled_at", oneHourAgo.toISOString())
      .gt("scheduled_at", ninetyMinAgo.toISOString());

    for (const appt of appts ?? []) {
      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, whatsapp_number, hospital_id")
        .eq("id", appt.patient_id)
        .single();

      if (patient) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        const { data: hospital } = await supabase
          .from("hospitals").select("id").eq("username", (patient.hospital_id as string).toLowerCase()).single();

        if (hospital) {
          const phone = (patient.whatsapp_number as string) || (patient.phone as string);
          if (phone) {
            await sendAppointmentNoShowFollowUp(hospital.id, patient.id, patientName, phone, appt.title).catch(() => {});
            log(`No-show follow-up sent: appt ${appt.id} (${patientName})`);
          }
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`No-show follow-up error: ${err}`);
  }
}

// ── Auto No-Show Dismissal at 11 PM ──────────────────────────────────────────
// Runs at 23:00 daily — dismisses all no_show appointments from that calendar
// day so they are cleared from the tab overnight.
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
  // Every 15 minutes: appointment reminders + no-show detection + 1-hour follow-up
  cron.schedule("*/15 * * * *", async () => {
    await runAppointmentReminders();
    await runNoShowDetection();
    await runNoShowFollowup();
  });

  // 11:00 PM daily: dismiss no-show appointments from today
  cron.schedule("0 23 * * *", runNoShowDismissal);

  // Every 30 minutes: in-care daily general message + medication timing reminders
  cron.schedule("*/30 * * * *", async () => {
    await runInCareDailyMessages();
    await runMedicationReminders();
  });

  // Every 10 minutes: pipeline stage transitions + dormant detection (pure data flow, no patient messages)
  cron.schedule("*/10 * * * *", async () => {
    await runPostTreatmentTransitions();
    await runDormantDetection();
  });

  // Post-treatment check-ins: 7am and 6pm daily (dedup prevents double-sends on same day)
  cron.schedule("0 7 * * *", runPostTreatmentCheckins);
  cron.schedule("0 18 * * *", runPostTreatmentCheckins);

  // Daily at 9pm: end-of-day feedback emails
  cron.schedule("0 21 * * *", runFeedbackEmails);

  // Daily at 10am: post-care wellness (sends once to patients with 30+ days no contact, then every 30 days)
  cron.schedule("0 10 * * *", runPostCareWellness);

  // Daily at 1am UTC (2am WAT): auto-suspend hospitals with expired subscriptions
  cron.schedule("0 1 * * *", checkSubscriptionExpirations);

  log("Scheduler started");
}
