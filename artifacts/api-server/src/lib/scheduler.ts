import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import { sendEmail } from "./email.js";
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
  sendQueueLongWaitApology,
  type InCareTimeSlot,
} from "./automation.js";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng";

function log(msg: string) {
  console.log(`[scheduler] ${new Date().toISOString()} ${msg}`);
}

// ── Appointment Reminders — runs every 15 minutes ─────────────────────────────
// All reminders now go to the patient's email address.
async function runAppointmentReminders() {
  try {
    const now = new Date();
    const in24h        = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hPlus15  = new Date(in24h.getTime() + 15 * 60 * 1000);
    const in2h         = new Date(now.getTime() +  2 * 60 * 60 * 1000);
    const in2hPlus15   = new Date(in2h.getTime()  + 15 * 60 * 1000);

    // Helper: resolve hospital int id + module check for an appointment's patient
    async function resolveHospital(patient: Record<string, unknown>) {
      const { data: hospital } = await supabase.from("hospitals").select("id").eq("hospital_code", patient.hospital_id as string).single();
      if (!hospital) return null;
      const { data: mods } = await supabase.from("hospital_modules").select("appointments_enabled").eq("hospital_id", hospital.id).single();
      if (!mods?.appointments_enabled) return null;
      return hospital;
    }

    // ── 24-hour reminder ────────────────────────────────────────────────────────
    // Only fetch appointments that haven't received the 24h reminder yet.
    const { data: appts24 } = await supabase
      .from("appointments")
      .select("*, patients(id, first_name, last_name, email, hospital_id)")
      .eq("status", "scheduled")
      .is("reminder_24h_sent_at", null)
      .gte("scheduled_at", in24h.toISOString())
      .lt("scheduled_at", in24hPlus15.toISOString());

    for (const appt of appts24 ?? []) {
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = await resolveHospital(patient);
      if (!hospital) continue;
      await sendAppointmentReminderEmail(hospital.id, patient.id as number, `${patient.first_name} ${patient.last_name}`, patient.email as string, appt.scheduled_at, 24);
      await supabase.from("appointments").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", appt.id);
      log(`Sent 24h email reminder for appt ${appt.id}`);
    }

    // ── 2-hour reminder ─────────────────────────────────────────────────────────
    // Fetched independently — must run even after the 24h reminder was already sent.
    const { data: appts2 } = await supabase
      .from("appointments")
      .select("*, patients(id, first_name, last_name, email, hospital_id)")
      .eq("status", "scheduled")
      .is("reminder_2h_sent_at", null)
      .gte("scheduled_at", in2h.toISOString())
      .lt("scheduled_at", in2hPlus15.toISOString());

    for (const appt of appts2 ?? []) {
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = await resolveHospital(patient);
      if (!hospital) continue;
      await sendAppointmentReminderEmail(hospital.id, patient.id as number, `${patient.first_name} ${patient.last_name}`, patient.email as string, appt.scheduled_at, 2);
      await supabase.from("appointments").update({ reminder_2h_sent_at: now.toISOString() }).eq("id", appt.id);
      log(`Sent 2h email reminder for appt ${appt.id}`);
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

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code").eq("active", true);
    for (const h of hospitals ?? []) {
      // Source of truth: treatment_end_date — no stage filter needed
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, treatment_end_date")
        .eq("hospital_id", h.hospital_code)
        .eq("stage", "Post Treatment")
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
          // Allow a 30-day catch-up window so emails missed during hospital suspension
          // are still delivered when the hospital is unsuspended, in the correct order.
          if (daysSinceEnd > day + 30) continue; // too old — skip

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

// ── Active Wellness Emails — runs daily at 6pm ────────────────────────────────
// Sends a wellness nudge to Active/Post Care patients who haven't been queued
// (checked in) in the last 30 days. Per-patient 30-day cooldown via automation_log.
async function runPostCareEmails() {
  try {
    const now = new Date();
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: enabledModules } = await supabase
      .from("hospital_modules")
      .select("hospital_id")
      .eq("wellness_newsletter_enabled", true);

    for (const mod of enabledModules ?? []) {
      const { data: hospital } = await supabase
        .from("hospitals").select("id, hospital_code").eq("id", mod.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, stage")
        .eq("hospital_id", hospital.hospital_code)
        .eq("stage", "Active")
        .not("email", "is", null);

      for (const p of patients ?? []) {
        if (!p.email) continue;

        // Skip if patient checked in (was queued) in the last 30 days
        const { data: recentCheckin } = await supabase
          .from("activity")
          .select("id")
          .eq("patient_id", p.id)
          .eq("type", "checkin")
          .gte("created_at", cutoff30)
          .maybeSingle();

        if (recentCheckin) continue;

        // Per-patient 30-day cooldown — skip if already sent within last 30 days
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
        log(`Active wellness email → patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Active wellness emails error: ${err}`);
  }
}

// ── Dormant Detection — runs daily ────────────────────────────────────────────
// A patient becomes Dormant when they have been in "Active" stage for more than
// pipeline_dormant_days without any clinical activity (check-in, new care plan, etc.).
// "Activity" is proxied by patients.updated_at — every check-in and patient edit updates it.
// Post Treatment, In Care, and Dormant patients are excluded (only Active→Dormant transition).
async function runDormantDetection() {
  try {
    const now = new Date();

    const { data: hospitals } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_dormant_days");

    for (const hs of hospitals ?? []) {
      const dormantDays = (hs.pipeline_dormant_days as number) ?? 30;

      const { data: hospital } = await supabase
        .from("hospitals")
        .select("hospital_code, active")
        .eq("id", hs.hospital_id)
        .single();
      if (!hospital) continue;
      // Never run dormant detection for suspended hospitals — patients retain their
      // activity timestamps so counting resumes correctly after unsuspension.
      if (hospital.active === false) continue;

      // Cutoff: patient must NOT have been queued (checked in) within the dormant window.
      const cutoff = new Date(now.getTime() - dormantDays * 24 * 60 * 60 * 1000).toISOString();

      // Only target "Active" (and its DB alias "Post Care") — never overwrite Post Treatment,
      // In Care, or already-Dormant patients.
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("hospital_id", hospital.hospital_code)
        .eq("stage", "Active");

      for (const p of patients ?? []) {
        // Skip if the patient had a check-in (was queued) within the dormant window
        const { data: recentCheckin } = await supabase
          .from("activity")
          .select("id")
          .eq("patient_id", p.id)
          .eq("type", "checkin")
          .gte("created_at", cutoff)
          .maybeSingle();

        if (recentCheckin) continue;

        await supabase.from("patients")
          .update({ stage: "Dormant", updated_at: now.toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Dormant (${dormantDays} days without activity)`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Dormant",
        });
        log(`Patient ${p.id} moved to Dormant (${dormantDays}d inactivity)`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Dormant detection error: ${err}`);
  }
}


// ── Post Treatment → Active Transition — runs daily ──────────────────────────
async function runPostTreatmentTransitions() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code").eq("active", true);
    for (const h of hospitals ?? []) {
      // In Care → Post Treatment when treatment_end_date has passed
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, treatment_end_date")
        .eq("stage", "In Care")
        .eq("hospital_id", h.hospital_code)
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

    // Post Treatment → Active (configurable days)
    const { data: hsSettings } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_post_treatment_days");

    for (const hs of hsSettings ?? []) {
      const postTreatDays = (hs.pipeline_post_treatment_days as number) ?? 14;
      const cutoff = new Date(Date.now() - postTreatDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("hospital_code").eq("id", hs.hospital_id).single();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", hospital.hospital_code)
        .lt("updated_at", cutoff);

      for (const p of patients ?? []) {
        await supabase.from("patients")
          .update({ stage: "Active", updated_at: new Date().toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Active`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Active",
        });
        log(`Patient ${p.id} moved to Active`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post treatment transitions error: ${err}`);
  }
}

// ── Next-Day Feedback Emails — runs daily at 12pm, covers all previous day's patients ──
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
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("hospital_code, feedback_slug")
        .eq("id", hm.hospital_id)
        .single();
      if (!hospital || !hospital.feedback_slug) continue;

      // Build the hospital's permanent general feedback link
      const feedbackUrl = `${APP_BASE_URL}/feedback/h/${hospital.feedback_slug}`;

      // Query activity log — queue rows are deleted after patients are seen,
      // so by noon they're gone. The activity table is the permanent audit log.
      // Covers: dequeued (outpatient pass-through), care_plan_added, treatment_plan_logged.
      const { data: seenActivity } = await supabase
        .from("activity")
        .select("patient_id")
        .in("type", ["dequeued", "care_plan_added", "treatment_plan_logged"])
        .eq("hospital_id", hm.hospital_id)
        .gte("created_at", `${targetDate}T00:00:00Z`)
        .lte("created_at", `${targetDate}T23:59:59Z`)
        .not("patient_id", "is", null);

      const patientIds = [...new Set((seenActivity ?? []).map((a: Record<string, unknown>) => a.patient_id as number))];

      for (const patientId of patientIds) {
        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email")
          .eq("id", patientId)
          .eq("hospital_id", hospital.hospital_code)
          .single();

        if (!patient || !patient.email) continue;

        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("hospital_id", hm.hospital_id)
          .eq("patient_id", patientId)
          .eq("automation_type", "feedback_email")
          .eq("status", "sent")
          .gte("created_at", `${targetDate}T00:00:00Z`)
          .maybeSingle();

        if (alreadySent) continue;

        const patientName = `${patient.first_name} ${patient.last_name}`;
        await sendFeedbackEmail(hm.hospital_id as number, patientId, patientName, patient.email, feedbackUrl);
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
          .from("hospitals").select("id").eq("hospital_code", patient.hospital_id as string).single();

        if (hospital) {
          const { data: mods } = await supabase.from("hospital_modules").select("appointments_enabled").eq("hospital_id", hospital.id).single();
          if (!mods?.appointments_enabled) continue;

          // Dedup: only one follow-up per appointment (window is 30 min wide across two cron runs)
          const { data: alreadySent } = await supabase
            .from("automation_log")
            .select("id")
            .eq("hospital_id", hospital.id)
            .eq("patient_id", patient.id as number)
            .eq("automation_type", "appointment_no_show")
            .eq("status", "sent")
            .gte("created_at", appt.scheduled_at as string)
            .maybeSingle();
          if (alreadySent) continue;

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

// ── Birthday Emails — runs daily at 7 AM ──────────────────────────────────────
async function runBirthdayEmails() {
  try {
    const now = new Date();
    const todayMMDD = now.toISOString().slice(5, 10); // "MM-DD"
    const yearStart = `${now.getFullYear()}-01-01`;

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code").eq("active", true);
    for (const h of hospitals ?? []) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, date_of_birth")
        .eq("hospital_id", h.hospital_code)
        .not("email", "is", null)
        .not("date_of_birth", "is", null);

      for (const p of patients ?? []) {
        const dob = p.date_of_birth as string;
        if (!dob || dob.slice(5) !== todayMMDD) continue;

        // One per patient per calendar year
        const { data: alreadySent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("hospital_id", h.id)
          .eq("patient_id", p.id)
          .eq("automation_type", "birthday_email")
          .eq("status", "sent")
          .gte("created_at", yearStart)
          .maybeSingle();

        if (alreadySent) continue;

        const patientName = `${p.first_name} ${p.last_name}`;
        await sendBirthdayEmail(h.id, p.id as number, patientName, p.email as string);
        log(`Birthday email → patient ${p.id}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Birthday emails error: ${err}`);
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

// ── Queue Long-Wait Apology — runs every 15 minutes ───────────────────────────
// Sends an apology message to any patient who has been waiting in the queue for
// more than 45 minutes and has NOT already received an apology in the last hour.
async function runQueueLongWaitCheck() {
  try {
    const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stalledEntries } = await supabase
      .from("queue")
      .select("patient_id, patient_name, phone, whatsapp_number, hospital_id")
      .lt("added_at", fortyFiveMinAgo);

    if (!stalledEntries?.length) return;

    // Group by hospital code
    const byHospital = new Map<string, typeof stalledEntries>();
    for (const entry of stalledEntries) {
      const code = entry.hospital_id as string;
      if (!byHospital.has(code)) byHospital.set(code, []);
      byHospital.get(code)!.push(entry);
    }

    for (const [hospitalCode, patients] of byHospital) {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("id")
        .eq("hospital_code", hospitalCode)
        .single();
      if (!hospital) continue;

      const hospitalIntId = hospital.id as number;

      for (const patient of patients) {
        const phone = (patient.whatsapp_number as string) || (patient.phone as string);
        if (!phone) continue;

        // Deduplicate: skip if already sent an apology to this patient in the last hour
        const { data: recent } = await supabase
          .from("automation_log")
          .select("id")
          .eq("hospital_id", hospitalIntId)
          .eq("patient_id", patient.patient_id as number)
          .eq("automation_type", "queue_long_wait_apology")
          .gte("last_attempted_at", oneHourAgo)
          .limit(1)
          .maybeSingle();

        if (recent) continue;

        await sendQueueLongWaitApology(
          hospitalIntId,
          patient.patient_id as number,
          patient.patient_name as string,
          phone,
        );
        log(`Long-wait apology sent → patient ${patient.patient_id as number} hospital ${hospitalIntId}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`runQueueLongWaitCheck error: ${err}`);
  }
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== "true") {
    log("Scheduler disabled — set ENABLE_SCHEDULER=true to enable (production only)");
    return;
  }

  const TZ = { timezone: "Africa/Lagos" };

  // Every 15 minutes: appointment reminders + no-show detection + 1-hour follow-up email + queue long-wait check
  cron.schedule("*/15 * * * *", async () => {
    await runAppointmentReminders();
    await runNoShowDetection();
    await runNoShowFollowup();
    await runQueueLongWaitCheck();
  });

  // Daily at 7:00 AM WAT: pipeline transitions + post-treatment check-ins + dormant + birthdays
  cron.schedule("0 7 * * *", async () => {
    await runPostTreatmentTransitions();
    await runPostTreatmentCheckins();
    await runDormantDetection();
    await runBirthdayEmails();
  }, TZ);

  // Daily at 6:00 PM WAT: post-care wellness emails
  cron.schedule("0 18 * * *", async () => {
    await runPostCareEmails();
  }, TZ);

  // Daily at 12:00 PM WAT: feedback emails (covers previous day's patients)
  cron.schedule("0 12 * * *", async () => {
    await runFeedbackEmails();
  }, TZ);

  // Daily at 11:00 PM WAT: dismiss any no-shows from today
  cron.schedule("0 23 * * *", async () => {
    await runNoShowDismissal();
  }, TZ);

  // Every 6 hours: subscription expiration check
  cron.schedule("0 */6 * * *", async () => {
    await checkSubscriptionExpirations();
  });

  // Every hour: care plan reminders — time-based (General Outpatient + all departments)
  cron.schedule("0 * * * *", async () => {
    await runCarePlanRemindersHourly();
  });

  // Every 5 minutes: delayed care plan summary emails (sent 20 min after plan is created)
  cron.schedule("*/5 * * * *", async () => {
    await runCarePlanEmailDelay();
  });

  // Daily at 9:00 AM WAT: Termii credit balance alert
  cron.schedule("0 9 * * *", async () => {
    await runTermiiBalanceCheck();
  }, TZ);

  log("Scheduler started — queue messages via WhatsApp/SMS (per hospital config), scheduled automations via email");
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

      // Resolve integer hospital id — care_plans.hospital_id stores hospital_code UUID post-migration
      const { data: hosp } = await supabase
        .from("hospitals")
        .select("id")
        .eq("hospital_code", plan.hospital_id as string)
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
        message_preview: `Care plan email (20-min delay) → ${patient.email}`,
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
    // All nurse-inputted times are in WAT (Africa/Lagos = UTC+1).
    // Shift now by +1h so date components reflect the current WAT calendar date.
    const WAT_MS = 60 * 60 * 1000;
    const nowWAT = new Date(now.getTime() + WAT_MS);
    const today = nowWAT.toISOString().slice(0, 10); // WAT date (YYYY-MM-DD)
    // Convert a nurse-entered HH:MM (WAT) on today's WAT date to an actual UTC timestamp.
    const watToUTC = (hh: number, mm: number): Date =>
      new Date(new Date(nowWAT.getFullYear(), nowWAT.getMonth(), nowWAT.getDate(), hh, mm).getTime() - WAT_MS);

    // care_plans.hospital_id stores hospital_code UUID (post-migration), not the integer id
    const { data: hospitals } = await supabase.from("hospitals").select("id, username, hospital_code").eq("active", true);
    if (!hospitals?.length) return;

    for (const h of hospitals) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, summary, template_data")
        .eq("hospital_id", h.hospital_code);

      if (!plans?.length) continue;

      for (const plan of plans) {
        const dept = plan.department as string;
        const td = (plan.template_data ?? {}) as Record<string, unknown>;

        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email, stage, treatment_end_date")
          .eq("id", plan.patient_id)
          .eq("hospital_id", h.hospital_code)
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
              const visitAt = watToUTC(hh, mm);
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
              const visitAt = watToUTC(hh, mm);
              const reminderAt = new Date(visitAt.getTime() - 3 * 3600 * 1000);
              if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_hosp_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["hosp"], dept);
              log(`General Outpatient hospital reminder (3h before ${timeStr}) → patient ${patient.id} slot=${slot}`);
            }

          } else if (treatmentType === "combination") {
            // Combination — ONE combined message 2h before the single appointment time
            // (stored under medicationTiming/medicationTimingTimes; hospTiming kept for legacy compat)
            const comboSlots = medTiming.length > 0 ? medTiming : [...new Set([...medTiming, ...hospTiming])];
            for (const slot of comboSlots) {
              const refTime = medTimingTimes[slot] || hospTimingTimes[slot];
              if (!refTime) continue;
              const [hh, mm] = refTime.split(":").map(Number);
              const visitAt = watToUTC(hh, mm);
              const reminderAt = new Date(visitAt.getTime() - 2 * 3600 * 1000);
              if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_combo_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["med", "hosp"], dept);
              log(`General Outpatient combination reminder (2h before ${refTime}) → patient ${patient.id} slot=${slot}`);
            }
          }
        } else {
          // All other departments — remind 4 hours before nurse-set visit time
          const entries = extractVisitEntries(dept, td, today); // today is WAT date
          for (const entry of entries) {
            if (!entry.date || !entry.time) continue;
            const visitAt = new Date(`${entry.date}T${entry.time}:00+01:00`); // WAT (UTC+1)
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

// today must be the WAT calendar date (YYYY-MM-DD) — pass nowWAT.toISOString().slice(0,10).
// Uses >= so same-day visits are included (needed for the 4h-before window check in the caller).
function extractVisitEntries(dept: string, templateData: Record<string, unknown>, today: string): VisitEntry[] {
  const entries: VisitEntry[] = [];

  if (dept === "Antenatal / Maternity") {
    const rows = (templateData.ancSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date >= today) entries.push({ date: r.date, time: r.time });
  } else if (dept === "Paediatrics") {
    const rows = (templateData.vaccinationSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date >= today) entries.push({ date: r.date, time: r.time });
  } else if (dept === "Surgery / Post-Op" || dept === "Dental" || dept === "Eye" || dept === "Fertility / IVF" || dept === "ENT (Ear, Nose and Throat)") {
    const rows = (templateData.inCareSchedule as Array<{ date?: string; time?: string }>) ?? [];
    for (const r of rows) if (r.date && r.date >= today) entries.push({ date: r.date, time: r.time });
    if (dept === "Surgery / Post-Op") {
      const pd = templateData.procedureDate as string | undefined;
      const pt = templateData.procedureTime as string | undefined;
      if (pd && pd >= today) entries.push({ date: pd, time: pt });
    }
  }
  return entries;
}

async function runCareVisitReminders() {
  try {
    // Fire at 7pm: remind patients about tomorrow's appointment
    const WAT_MS = 60 * 60 * 1000;
    const nowWATRef = new Date(Date.now() + WAT_MS);
    const todayWAT = nowWATRef.toISOString().slice(0, 10);
    const tomorrowRef = new Date(Date.now() + WAT_MS + 24 * 60 * 60 * 1000);
    const tomorrowDate = tomorrowRef.toISOString().slice(0, 10);

    // care_plans.hospital_id stores hospital_code UUID (post-migration), not the integer id
    const { data: hospitals } = await supabase.from("hospitals").select("id, username, hospital_code").eq("active", true);
    if (!hospitals?.length) return;

    for (const h of hospitals) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, summary, template_data")
        .eq("hospital_id", h.hospital_code);

      if (!plans?.length) continue;

      for (const plan of plans) {
        const dept = plan.department as string;
        const templateData = (plan.template_data ?? {}) as Record<string, unknown>;

        // General Outpatient fires daily (handled separately via daily automation logic)
        if (dept === "General Outpatient") continue;

        const entries = extractVisitEntries(dept, templateData, todayWAT);
        const match = entries.find(e => e.date === tomorrowDate);
        if (!match) continue;

        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email")
          .eq("id", plan.patient_id)
          .eq("hospital_id", h.hospital_code)
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

// ── Termii credit balance alert — runs daily at 9 AM ─────────────────────────
// Sends an email to SUPER_ADMIN_ALERT_EMAIL when Termii balance drops below ₦50.
async function runTermiiBalanceCheck() {
  const apiKey = process.env.TERMII_API_KEY;
  const alertEmail = process.env.SUPER_ADMIN_ALERT_EMAIL;

  if (!apiKey) { log("Termii balance check skipped — TERMII_API_KEY not set"); return; }
  if (!alertEmail) { log("Termii balance check skipped — SUPER_ADMIN_ALERT_EMAIL not set"); return; }

  try {
    const res = await fetch(`https://api.ng.termii.com/api/get-balance?api_key=${apiKey}`);
    if (!res.ok) { log(`Termii balance check failed — HTTP ${res.status}`); return; }

    const json = await res.json() as { balance?: number };
    const balance = json.balance ?? null;
    if (balance === null) { log("Termii balance check — no balance in response"); return; }

    log(`Termii balance: ₦${balance.toFixed(2)}`);

    if (balance < 50) {
      const fromEmail = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
      const subject = `⚠ Low Termii Credit — ₦${balance.toFixed(2)} remaining`;
      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#161b22;border-radius:12px;padding:32px;border:1px solid #30363d">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;margin-bottom:12px"></div>
      <h1 style="font-size:20px;font-weight:700;color:#e6edf3;margin:0">Low Termii Credit</h1>
    </div>
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 16px">Your Termii SMS/WhatsApp balance is running low.</p>
    <div style="background:#0d1117;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px">
      <div style="font-size:36px;font-weight:700;color:#f59e0b">₦${balance.toFixed(2)}</div>
      <div style="font-size:13px;color:#8b949e;margin-top:4px">Current balance</div>
    </div>
    <p style="font-size:14px;color:#8b949e;margin:0 0 20px">SMS messages and WhatsApp automations will stop delivering once credits run out. Top up now to keep patient communications working.</p>
    <div style="text-align:center">
      <a href="https://termii.com" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Top Up at termii.com</a>
    </div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #30363d;font-size:12px;color:#8b949e;text-align:center">Era System · Automated credit alert</div>
  </div>
</body></html>`;

      await sendEmail({ to: alertEmail, from: fromEmail, subject, html });
      log(`Low Termii balance alert sent to ${alertEmail} (₦${balance.toFixed(2)})`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Termii balance check error: ${err}`);
  }
}

