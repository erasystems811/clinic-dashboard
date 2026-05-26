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
async function runPostTreatmentCheckins() {
  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, treatment_end_date")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", h.username);

      for (const p of patients ?? []) {
        if (!p.email || !p.treatment_end_date) continue;

        const endDate = new Date(p.treatment_end_date as string);
        const daysSinceEnd = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        const patientName = `${p.first_name} ${p.last_name}`;

        for (const day of [1, 4, 7] as const) {
          if (daysSinceEnd < day) continue; // not yet time
          if (daysSinceEnd > day + 2) continue; // too late (missed window — skip to avoid very delayed sends)

          const automationType = `post_treatment_day${day}`;
          const { data: alreadySent } = await supabase
            .from("automation_log")
            .select("id")
            .eq("patient_id", p.id)
            .eq("automation_type", automationType)
            .eq("status", "sent")
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

// ── Post-Care Email — runs daily — every 30 days while patient stays in Post Care ─
async function runPostCareEmails() {
  try {
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, updated_at")
        .eq("stage", "Post Care")
        .eq("hospital_id", h.username)
        .lt("updated_at", cutoff30);

      for (const p of patients ?? []) {
        if (!p.email) continue;

        // Only send once — skip if already sent at any point
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", "post_care_email")
          .eq("status", "sent")
          .maybeSingle();

        if (alreadySent) continue;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendPostCareEmail(h.id, p.id as number, patientName, p.email as string);
        log(`Post-care email → patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-care emails error: ${err}`);
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

// ── Continuous In-Care AI Reminders — 4x daily based on nurse's timing boxes ──
// medication_timing is stored as "med:morning,hosp:afternoon,med:evening" etc.
// Only patients who have the given slot checked will receive a reminder.
async function runInCareReminders(slot: InCareTimeSlot) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const automationType = `in_care_reminder_${slot}`;

    const { data: hospitals } = await supabase.from("hospitals").select("id, username");
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, treatment_plan, medication_timing")
        .eq("stage", "In Care")
        .eq("hospital_id", h.username)
        .not("treatment_plan", "is", null)
        .not("email", "is", null)
        .not("medication_timing", "is", null);

      for (const p of patients ?? []) {
        if (!p.email || !p.treatment_plan || !p.medication_timing) continue;

        // Parse which types are active for this slot: "med:morning,hosp:afternoon" → ["med","hosp"] for morning
        const timingEntries = (p.medication_timing as string).split(",").map(s => s.trim());
        const slotEntries = timingEntries.filter(e => e.endsWith(`:${slot}`));
        if (slotEntries.length === 0) continue; // nurse didn't check this time slot for this patient

        const timingTypes = slotEntries
          .map(e => e.split(":")[0] as "med" | "hosp")
          .filter((t): t is "med" | "hosp" => t === "med" || t === "hosp");

        // Only send once per slot per patient per day
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("patient_id", p.id)
          .eq("automation_type", automationType)
          .eq("status", "sent")
          .gte("created_at", `${today}T00:00:00Z`)
          .maybeSingle();

        if (alreadySent) continue;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendInCareAIReminder(
          h.id,
          p.id as number,
          patientName,
          p.email as string,
          p.treatment_plan as string,
          slot,
          timingTypes,
        );
        log(`In-care ${slot} reminder (${timingTypes.join("+")}) → patient ${p.id} (${patientName})`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`In-care ${slot} reminders error: ${err}`);
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
  // Every 15 minutes: appointment reminders + no-show detection + 1-hour follow-up email
  cron.schedule("*/15 * * * *", async () => {
    await runAppointmentReminders();
    await runNoShowDetection();
    await runNoShowFollowup();
  });

  // Daily at 6:00 AM: pipeline transitions + post-treatment check-ins + post-care + dormant detection
  cron.schedule("0 6 * * *", async () => {
    await runPostTreatmentTransitions();
    await runPostTreatmentCheckins();
    await runPostCareEmails();
    await runDormantDetection();
  });

  // Daily at 8:00 AM: in-care morning reminders
  cron.schedule("0 8 * * *", async () => {
    await runInCareReminders("morning");
  });

  // Daily at 1:00 PM: in-care afternoon reminders
  cron.schedule("0 13 * * *", async () => {
    await runInCareReminders("afternoon");
  });

  // Daily at 6:00 PM: in-care evening reminders
  cron.schedule("0 18 * * *", async () => {
    await runInCareReminders("evening");
  });

  // Daily at 10:00 PM: in-care night reminders
  cron.schedule("0 22 * * *", async () => {
    await runInCareReminders("night");
  });

  // Daily at 9:00 PM: end-of-day feedback emails
  cron.schedule("0 21 * * *", async () => {
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

  log("Scheduler started — all automations are email-first");
}
