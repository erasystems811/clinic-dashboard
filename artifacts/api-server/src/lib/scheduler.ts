import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import { sendEmail, wrapHtml } from "./email.js";
import { sendPushToAccount } from "./push-service.js";
import {
  sendPostTreatmentCheckinEmail,
  sendPostCareEmail,
  sendAppointmentReminderEmail,
  sendAppointmentNoShowEmail,
  sendFeedbackEmail,
  sendInCareAIReminder,
  sendStoredCarePlanReminder,
  sendBirthdayEmail,
  sendCareVisitReminderEmail,
  sendCarePlanEmail,
  sendQueueLongWaitApology,
  sendBeneficiaryReminderEmail,
  sendDoctorAppointmentReminderEmail,
  sendReturnVisitReminderEmail,
  sendWeeklyMedicationSummaryEmail,
  type InCareTimeSlot,
  type PregeneratedMessages,
} from "./automation.js";

const APP_BASE_URL = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");

function log(msg: string) {
  console.log(`[scheduler] ${new Date().toISOString()} ${msg}`);
}

// Returns a string like "2025_W23" — used to dedup weekly medication summaries
function isoWeekKey(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.round((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return `${d.getFullYear()}_W${week}`;
}

// ── Appointment Reminders — runs every 15 minutes ─────────────────────────────
// All reminders go to the patient's email address.
// Each reminder uses a TWO-PART query:
//   1. Normal window  — appointments exactly N hours away (±15 min)
//   2. Catch-up window — appointments already past the normal window but still in the future
//      and not yet reminded (handles server downtime / scheduler gaps).
async function runAppointmentReminders() {
  try {
    const now = new Date();
    const in24h        = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hPlus15  = new Date(in24h.getTime() + 15 * 60 * 1000);
    const in2h         = new Date(now.getTime() +  2 * 60 * 60 * 1000);
    const in2hPlus15   = new Date(in2h.getTime()  + 15 * 60 * 1000);
    // Catch-up floor: at least 15 min in the future (no point reminding < 15 min out)
    const in15min      = new Date(now.getTime() + 15 * 60 * 1000);
    const in3h         = new Date(now.getTime() +  3 * 60 * 60 * 1000);
    const in3hPlus15   = new Date(in3h.getTime()  + 15 * 60 * 1000);

    // Helper: resolve hospital int id + module check for an appointment's patient
    async function resolveHospital(patient: Record<string, unknown>) {
      const { data: hospital } = await supabase.from("hospitals").select("id").eq("hospital_code", patient.hospital_id as string).maybeSingle();
      if (!hospital) return null;
      const { data: mods } = await supabase.from("hospital_modules").select("appointments_enabled").eq("hospital_id", hospital.id).maybeSingle();
      if (!mods?.appointments_enabled) return null;
      return hospital;
    }

    // ── 24-hour reminder ────────────────────────────────────────────────────────
    // Normal window + catch-up for missed windows (appointment still ≥ 15 min away).
    const [{ data: appts24Normal }, { data: appts24CatchUp }] = await Promise.all([
      supabase.from("appointments")
        .select("*, patients(id, first_name, last_name, email, hospital_id)")
        .eq("status", "scheduled").is("reminder_24h_sent_at", null)
        .gte("scheduled_at", in24h.toISOString()).lt("scheduled_at", in24hPlus15.toISOString()),
      supabase.from("appointments")
        .select("*, patients(id, first_name, last_name, email, hospital_id)")
        .eq("status", "scheduled").is("reminder_24h_sent_at", null)
        .gte("scheduled_at", in15min.toISOString()).lt("scheduled_at", in24h.toISOString()),
    ]);

    const seen24 = new Set<number>();
    for (const appt of [...(appts24Normal ?? []), ...(appts24CatchUp ?? [])]) {
      if (seen24.has(appt.id as number)) continue;
      seen24.add(appt.id as number);
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = await resolveHospital(patient);
      if (!hospital) continue;
      await sendAppointmentReminderEmail(hospital.id, patient.id as number, `${patient.first_name} ${patient.last_name}`, patient.email as string, appt.scheduled_at, 24);
      await supabase.from("appointments").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", appt.id);
      log(`Sent 24h email reminder for appt ${appt.id}`);
    }

    // ── 2-hour reminder ─────────────────────────────────────────────────────────
    // Normal window + catch-up for missed windows (appointment still ≥ 15 min away).
    const [{ data: appts2Normal }, { data: appts2CatchUp }] = await Promise.all([
      supabase.from("appointments")
        .select("*, patients(id, first_name, last_name, email, hospital_id)")
        .eq("status", "scheduled").is("reminder_2h_sent_at", null)
        .gte("scheduled_at", in2h.toISOString()).lt("scheduled_at", in2hPlus15.toISOString()),
      supabase.from("appointments")
        .select("*, patients(id, first_name, last_name, email, hospital_id)")
        .eq("status", "scheduled").is("reminder_2h_sent_at", null)
        .gte("scheduled_at", in15min.toISOString()).lt("scheduled_at", in2h.toISOString()),
    ]);

    const seen2 = new Set<number>();
    for (const appt of [...(appts2Normal ?? []), ...(appts2CatchUp ?? [])]) {
      if (seen2.has(appt.id as number)) continue;
      seen2.add(appt.id as number);
      const patient = (appt as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = await resolveHospital(patient);
      if (!hospital) continue;
      await sendAppointmentReminderEmail(hospital.id, patient.id as number, `${patient.first_name} ${patient.last_name}`, patient.email as string, appt.scheduled_at, 2);
      await supabase.from("appointments").update({ reminder_2h_sent_at: now.toISOString() }).eq("id", appt.id);
      log(`Sent 2h email reminder for appt ${appt.id}`);
    }
    // ── 3-hour doctor reminder ──────────────────────────────────────────────────
    const [{ data: appts3hDocNormal }, { data: appts3hDocCatchUp }] = await Promise.all([
      supabase.from("appointments")
        .select("id, title, scheduled_at, patient_name, doctor_id, hospital_id")
        .not("doctor_id", "is", null)
        .is("reminder_3h_doctor_sent_at", null)
        .not("status", "in", '("cancelled","no_show","completed")')
        .gte("scheduled_at", in3h.toISOString()).lt("scheduled_at", in3hPlus15.toISOString()),
      supabase.from("appointments")
        .select("id, title, scheduled_at, patient_name, doctor_id, hospital_id")
        .not("doctor_id", "is", null)
        .is("reminder_3h_doctor_sent_at", null)
        .not("status", "in", '("cancelled","no_show","completed")')
        .gte("scheduled_at", in15min.toISOString()).lt("scheduled_at", in3h.toISOString()),
    ]);

    const seen3hDoc = new Set<number>();
    for (const appt of [...(appts3hDocNormal ?? []), ...(appts3hDocCatchUp ?? [])]) {
      if (seen3hDoc.has(appt.id as number)) continue;
      seen3hDoc.add(appt.id as number);

      const { data: doctor } = await supabase
        .from("hospital_doctors")
        .select("email, full_name")
        .eq("id", appt.doctor_id as number)
        .eq("active", true)
        .maybeSingle();
      if (!doctor?.email) continue;

      const { data: hosp } = await supabase
        .from("hospitals").select("name").eq("id", appt.hospital_id as number).maybeSingle();
      const hospitalName = (hosp?.name as string) ?? "Your Hospital";

      await sendDoctorAppointmentReminderEmail(
        doctor.email as string,
        doctor.full_name as string,
        hospitalName,
        appt.patient_name as string,
        appt.title as string,
        appt.scheduled_at as string,
      ).catch(err => log(`Doctor 3h reminder email error: ${err}`));
      await supabase.from("appointments").update({ reminder_3h_doctor_sent_at: now.toISOString() }).eq("id", appt.id as number);
      log(`Sent 3h doctor reminder for appt ${appt.id as number} → Dr. ${(doctor.full_name as string).split(" ")[0]}`);
    }

  } catch (err) {
    Sentry.captureException(err);
    log(`Appointment reminders error: ${err}`);
  }
}

// ── Post-Treatment Check-ins — runs daily — Day 1, 4, 7 emails ───────────────
// Per-patient templated Day 1/4/7 check-ins for ALL departments.
// Triggered once per patient when they enter Post Treatment stage, keyed on
// patients.post_treatment_started_at so multiple ended care plans don't produce
// duplicate sequences.
async function runPostTreatmentCheckins() {
  try {
    const now = new Date();

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code, active");
    for (const h of hospitals ?? []) {
      // Query all patients currently in Post Treatment with a recorded start date
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, post_treatment_started_at")
        .eq("hospital_id", h.hospital_code)
        .eq("stage", "Post Treatment")
        .not("post_treatment_started_at", "is", null);

      for (const patient of patients ?? []) {
        if (!patient.post_treatment_started_at || !patient.email) continue;

        const startDate = new Date(patient.post_treatment_started_at as string);
        const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const patientName = `${patient.first_name} ${patient.last_name}`;

        for (const day of [1, 4, 7] as const) {
          if (daysSinceStart < day) continue;
          if (daysSinceStart > day + 30) continue; // 30-day catch-up window

          // Dedup key per patient — one sequence per Post Treatment entry.
          // Use limit(1) instead of maybeSingle() so multiple records (race condition / retry)
          // don't cause the check to return null and trigger a re-send.
          const automationType = `post_treatment_patient${patient.id}_day${day}`;
          const { data: alreadySentRows } = await supabase
            .from("automation_log")
            .select("id")
            .eq("patient_id", patient.id)
            .eq("automation_type", automationType)
            .eq("status", "sent")
            .limit(1);

          if (alreadySentRows && alreadySentRows.length > 0) continue;

          await sendPostTreatmentCheckinEmail(h.id, patient.id as number, patientName, patient.email as string, day);
          log(`Post-treatment Day ${day} email → patient ${patient.id} (${daysSinceStart}d since Post Treatment start)`);
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Post-treatment checkins error: ${err}`);
  }
}

// ── Active Wellness Emails — runs daily at 6pm ────────────────────────────────
// Sends a wellness nudge to Active patients who haven't checked in within 30 days.
// Uses bulk queries per hospital to eliminate per-patient N+1 patterns.
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
        .from("hospitals").select("id, hospital_code").eq("id", mod.hospital_id).maybeSingle();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .eq("hospital_id", hospital.hospital_code)
        .eq("stage", "Active")
        .not("email", "is", null);

      if (!patients?.length) continue;
      const patientIds = patients.map(p => p.id as number);

      // Bulk: patient IDs that checked in within the last 30 days — skip these
      const { data: recentCheckins } = await supabase
        .from("activity")
        .select("patient_id")
        .eq("hospital_id", hospital.id)
        .eq("type", "checkin")
        .gte("created_at", cutoff30)
        .in("patient_id", patientIds);
      const recentlyCheckedIn = new Set((recentCheckins ?? []).map(r => r.patient_id as number));

      // Bulk: patient IDs that have ever checked in — skip never-visited patients
      const { data: everCheckedIn } = await supabase
        .from("activity")
        .select("patient_id")
        .eq("hospital_id", hospital.id)
        .eq("type", "checkin")
        .in("patient_id", patientIds);
      const hasEverCheckedIn = new Set((everCheckedIn ?? []).map(r => r.patient_id as number));

      // Bulk: patient IDs that already received a wellness email in the last 30 days
      const { data: recentSends } = await supabase
        .from("automation_log")
        .select("patient_id")
        .eq("automation_type", "post_care_email")
        .eq("status", "sent")
        .gte("created_at", cutoff30)
        .in("patient_id", patientIds);
      const alreadyEmailed = new Set((recentSends ?? []).map(r => r.patient_id as number));

      for (const p of patients) {
        if (!hasEverCheckedIn.has(p.id as number)) continue; // never visited
        if (recentlyCheckedIn.has(p.id as number)) continue;  // visited within 30 days
        if (alreadyEmailed.has(p.id as number)) continue;     // already sent

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
// pipeline_dormant_days without any queue check-in.
// The clock resets whenever checked_in_at is updated — on every queue check-in,
// on every transition back into Active (Post Treatment→Active, manual stage set),
// and on initial patient creation/import.
async function runDormantDetection() {
  try {
    const now = new Date();

    // Start from ALL hospitals — not just those with a settings row.
    // A hospital with no settings row uses the default of 90 days.
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("id, hospital_code, active");

    for (const hospital of hospitals ?? []) {
      // Skip suspended hospitals — patients retain their activity timestamps
      // so counting resumes correctly after unsuspension.
      if (hospital.active === false) continue;
      if (!hospital.hospital_code) continue;

      // Look up dormant days config — default 90 if no settings row exists yet.
      const { data: settings } = await supabase
        .from("hospital_settings")
        .select("pipeline_dormant_days")
        .eq("hospital_id", hospital.id)
        .maybeSingle();

      const dormantDays = (settings?.pipeline_dormant_days as number | null) ?? 90;
      const cutoff = new Date(now.getTime() - dormantDays * 24 * 60 * 60 * 1000).toISOString();

      // ── Step 1: Active patients old enough to qualify ─────────────────────────
      const { data: candidates } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("hospital_id", hospital.hospital_code)
        .eq("stage", "Active")
        .lt("created_at", cutoff);

      if (!candidates?.length) continue;
      const candidateIds = candidates.map(p => p.id as number);

      // ── Step 2: Clock is PAUSED for patients with any current second stage ────
      // Queued — currently in the reception queue
      const { data: queuedRows } = await supabase
        .from("queue")
        .select("patient_id")
        .eq("hospital_id", hospital.hospital_code);
      const currentlyQueuedIds = new Set((queuedRows ?? []).map(r => r.patient_id as number));

      // In Care — has an active or open (draft) care plan
      const { data: activePlanRows } = await supabase
        .from("care_plans")
        .select("patient_id")
        .eq("hospital_id", hospital.hospital_code)
        .neq("status", "ended");
      const activePlanIds = new Set((activePlanRows ?? []).map(r => r.patient_id as number));

      // Booked — has an upcoming appointment
      const { data: bookedRows } = await supabase
        .from("appointments")
        .select("patient_id")
        .in("patient_id", candidateIds)
        .gte("scheduled_at", now.toISOString())
        .not("status", "in", '("cancelled","no_show","completed","dismissed")');
      const bookedIds = new Set((bookedRows ?? []).map(r => r.patient_id as number));

      // ── Step 3: Clock RESTARTED recently for patients who had clinical activity ─
      // Any event that is not a pure admin/automated action counts — it means the
      // patient entered another stage and returned to Active within the window,
      // so their solo-Active clock is younger than dormantDays.
      const NON_INTERACTION = ["patient_created", "patient_info_updated", "treatment_reminder", "automated_message", "no_show"];
      const { data: recentActivityRows } = await supabase
        .from("activity")
        .select("patient_id")
        .eq("hospital_id", hospital.id)
        .not("type", "in", `(${NON_INTERACTION.map(t => `"${t}"`).join(",")})`)
        .gte("created_at", cutoff)
        .not("patient_id", "is", null);
      const recentlyActiveIds = new Set((recentActivityRows ?? []).map(r => r.patient_id as number));

      // ── Step 4: Mark dormant — only pure-Active patients with no recent activity ─
      for (const p of candidates) {
        if (currentlyQueuedIds.has(p.id as number)) continue; // clock paused — in queue
        if (activePlanIds.has(p.id as number))      continue; // clock paused — in care
        if (bookedIds.has(p.id as number))          continue; // clock paused — booked
        if (recentlyActiveIds.has(p.id as number))  continue; // clock restarted within window

        await supabase.from("patients")
          .update({ stage: "Dormant", updated_at: now.toISOString() })
          .eq("id", p.id);
        await supabase.from("activity").insert({
          type: "stage_changed",
          description: `${p.first_name} ${p.last_name} moved to Dormant (only Active for ${dormantDays}+ days with no other stage)`,
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          metadata: "Dormant",
        });
        log(`Patient ${p.id} → Dormant (pure Active for ${dormantDays}d)`);
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

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code, active");
    for (const h of hospitals ?? []) {
      // Auto-end GenOut care plans when their treatment_end_date has passed.
      // "In Care" is a derived display badge — never stored in patients.stage.
      // Source of truth: active GenOut care plans + patients.treatment_end_date.
      const { data: activeGenOutPlans } = await supabase
        .from("care_plans")
        .select("id, patient_id")
        .eq("hospital_id", h.hospital_code)
        .eq("department", "General Outpatient")
        .eq("status", "active");

      for (const cp of activeGenOutPlans ?? []) {
        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, treatment_end_date")
          .eq("id", cp.patient_id as number)
          .not("treatment_end_date", "is", null)
          .lte("treatment_end_date", today)
          .maybeSingle();

        if (!patient) continue; // treatment_end_date hasn't passed or is null

        const now = new Date().toISOString();
        const patientName = `${patient.first_name} ${patient.last_name}`;

        // Archive this care plan
        await supabase.from("care_plans")
          .update({ status: "ended", ended_at: now, updated_at: now })
          .eq("id", cp.id);

        // Only transition patient stage if no other active plans remain
        const { data: remainingActive } = await supabase
          .from("care_plans")
          .select("id")
          .eq("patient_id", patient.id)
          .eq("hospital_id", h.hospital_code)
          .eq("status", "active");

        if (!remainingActive || remainingActive.length === 0) {
          await supabase.from("patients")
            .update({ stage: "Post Treatment", post_treatment_started_at: now, treatment_plan: null, treatment_type: null, medication_timing: null, updated_at: now })
            .eq("id", patient.id);

          await supabase.from("activity").insert({
            type: "stage_changed",
            description: `${patientName} moved to Post Treatment (General Outpatient treatment duration complete)`,
            patient_id: patient.id,
            patient_name: patientName,
            metadata: "Post Treatment",
          });
          log(`Patient ${patient.id} moved to Post Treatment (GenOut treatment_end_date passed)`);
        }
      }
    }

    // Post Treatment → Active (configurable days)
    const { data: hsSettings } = await supabase
      .from("hospital_settings")
      .select("hospital_id, pipeline_post_treatment_days");

    for (const hs of hsSettings ?? []) {
      const postTreatDays = (hs.pipeline_post_treatment_days as number) ?? 14;
      const cutoff = new Date(Date.now() - postTreatDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: hospital } = await supabase.from("hospitals").select("hospital_code").eq("id", hs.hospital_id).maybeSingle();
      if (!hospital) continue;

      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("stage", "Post Treatment")
        .eq("hospital_id", hospital.hospital_code)
        .not("post_treatment_started_at", "is", null)
        .lt("post_treatment_started_at", cutoff);

      for (const p of patients ?? []) {
        const nowIso = new Date().toISOString();
        await supabase.from("patients")
          .update({ stage: "Active", post_treatment_started_at: null, updated_at: nowIso })
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
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = weekAgo.toISOString();

    const { data: hospitals } = await supabase
      .from("hospital_modules")
      .select("hospital_id, feedback_enabled")
      .eq("feedback_enabled", true);

    for (const hm of hospitals ?? []) {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("hospital_code, feedback_slug")
        .eq("id", hm.hospital_id)
        .maybeSingle();
      if (!hospital || !hospital.feedback_slug) continue;

      const feedbackUrl = `${APP_BASE_URL}/feedback/h/${hospital.feedback_slug}`;

      // All distinct patients who visited this hospital in the past 7 days
      const { data: seenActivity } = await supabase
        .from("activity")
        .select("patient_id")
        .in("type", ["dequeued", "care_plan_added", "treatment_plan_logged"])
        .eq("hospital_id", hm.hospital_id)
        .gte("created_at", weekStart)
        .not("patient_id", "is", null);

      const patientIds = [...new Set((seenActivity ?? []).map((a: Record<string, unknown>) => a.patient_id as number))];
      if (!patientIds.length) continue;

      // Bulk dedup: skip anyone who already got a feedback email this week
      const { data: recentSends } = await supabase
        .from("automation_log")
        .select("patient_id")
        .eq("hospital_id", hm.hospital_id)
        .eq("automation_type", "feedback_email")
        .eq("status", "sent")
        .gte("created_at", weekStart)
        .in("patient_id", patientIds);
      const alreadyEmailed = new Set((recentSends ?? []).map(r => r.patient_id as number));

      for (const patientId of patientIds) {
        if (alreadyEmailed.has(patientId)) continue;

        const { data: patient } = await supabase
          .from("patients")
          .select("id, first_name, last_name, email")
          .eq("id", patientId)
          .eq("hospital_id", hospital.hospital_code)
          .maybeSingle();

        if (!patient || !patient.email) continue;

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
        .maybeSingle();

      if (patient) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        await supabase.from("activity").insert({
          type: "no_show",
          description: `Auto no-show: ${patientName} missed appointment "${appt.title}"`,
          patient_id: appt.patient_id,
          patient_name: patientName,
          metadata: appt.scheduled_at,
        }).then(() => {}, () => {});
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
        .maybeSingle();

      if (patient && patient.email) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        const { data: hospital } = await supabase
          .from("hospitals").select("id").eq("hospital_code", patient.hospital_id as string).maybeSingle();

        if (hospital) {
          const { data: mods } = await supabase.from("hospital_modules").select("appointments_enabled").eq("hospital_id", hospital.id).maybeSingle();
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

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code, active");
    for (const h of hospitals ?? []) {
      // Filter by today's MM-DD directly in the DB — avoids loading all patients
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .eq("hospital_id", h.hospital_code)
        .not("email", "is", null)
        .like("date_of_birth", `____-${todayMMDD}`);

      if (!patients?.length) continue;

      // Batch dedup — one query for all birthday patients this year instead of one per patient
      const patientIds = patients.map(p => p.id as number);
      const { data: alreadySentRows } = await supabase
        .from("automation_log")
        .select("patient_id")
        .eq("hospital_id", h.id)
        .eq("automation_type", "birthday_email")
        .eq("status", "sent")
        .gte("created_at", yearStart)
        .in("patient_id", patientIds);
      const alreadySentIds = new Set((alreadySentRows ?? []).map(r => r.patient_id as number));

      for (const p of patients) {
        if (alreadySentIds.has(p.id as number)) continue;
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
        .maybeSingle();
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

// ── Auto-end non-GenOut care plans after last scheduled date passes ────────────
// Runs daily. For each active non-General Outpatient care plan, checks whether the
// last visit date in the department template has passed. If so, archives the plan
// and transitions the patient to Post Treatment exactly as "End Early" would.
async function runCarePlanCompletionDetection() {
  try {
    const WAT_MS = 60 * 60 * 1000;
    const nowWAT = new Date(Date.now() + WAT_MS);
    const todayWAT = nowWAT.toISOString().slice(0, 10); // WAT date

    const { data: hospitals } = await supabase.from("hospitals").select("id, hospital_code, active");
    for (const h of hospitals ?? []) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, template_data")
        .eq("hospital_id", h.hospital_code)
        .eq("status", "active")
        .neq("department", "General Outpatient");

      for (const plan of plans ?? []) {
        const dept = plan.department as string;
        const td = (plan.template_data ?? {}) as Record<string, unknown>;

        // ── New-format plans (medications[]/procedures[]) ──────────────────────
        // These don't have inCareSchedule entries — they end when treatment_end_date passes.
        const newMeds  = (td.medications as Array<unknown> | undefined) ?? [];
        const newProcs = (td.procedures  as Array<unknown> | undefined) ?? [];
        if (newMeds.length > 0 || newProcs.length > 0) {
          const { data: patRec } = await supabase
            .from("patients")
            .select("treatment_end_date, first_name, last_name")
            .eq("id", plan.patient_id as number)
            .maybeSingle();
          if (!patRec?.treatment_end_date || (patRec.treatment_end_date as string) >= todayWAT) continue;

          const now = new Date().toISOString();
          await supabase.from("care_plans").update({ status: "ended", ended_at: now, updated_at: now }).eq("id", plan.id);

          const { data: remainingNewFormat } = await supabase
            .from("care_plans").select("id")
            .eq("patient_id", plan.patient_id as number)
            .eq("hospital_id", h.hospital_code)
            .eq("status", "active");

          if (!remainingNewFormat || remainingNewFormat.length === 0) {
            const patientName = `${patRec.first_name} ${patRec.last_name}`;
            await supabase.from("patients").update({
              stage: "Post Treatment",
              post_treatment_started_at: now,
              treatment_plan: null,
              treatment_type: null,
              medication_timing: null,
              updated_at: now,
            }).eq("id", plan.patient_id as number);
            await supabase.from("activity").insert({
              type: "stage_changed",
              description: `${patientName} moved to Post Treatment (${dept} treatment duration complete)`,
              patient_id: plan.patient_id as number,
              patient_name: patientName,
              metadata: "Post Treatment",
            });
            log(`Auto-ended new-format plan ${plan.id} for patient ${plan.patient_id as number} (treatment_end_date ${patRec.treatment_end_date as string} passed)`);
          }
          continue;
        }

        // ── Old specialist-format plans (inCareSchedule / ancSchedule / etc.) ──
        // extractVisitEntries filters to future dates only, so we can't use it here.
        // Instead, collect ALL scheduled dates (past and future) and check if the
        // last one has already passed — that means treatment is complete.
        const allScheduledDates: string[] = [];
        for (const key of ["ancSchedule", "vaccinationSchedule", "inCareSchedule"]) {
          const rows = (td[key] as Array<{ date?: string }> | undefined) ?? [];
          for (const r of rows) { if (r.date) allScheduledDates.push(r.date); }
        }
        const procedureDate = td.procedureDate as string | undefined;
        if (procedureDate) allScheduledDates.push(procedureDate);
        if (!allScheduledDates.length) continue;

        const lastDate = allScheduledDates.sort().pop()!;
        if (lastDate >= todayWAT) continue; // last visit hasn't passed yet

        // Archive the plan
        const now = new Date().toISOString();
        await supabase.from("care_plans").update({
          status: "ended",
          ended_at: now,
          updated_at: now,
        }).eq("id", plan.id);

        // Check if any active plans remain
        const { data: remainingActive } = await supabase
          .from("care_plans")
          .select("id")
          .eq("patient_id", plan.patient_id as number)
          .eq("hospital_id", h.hospital_code)
          .eq("status", "active");

        if (!remainingActive || remainingActive.length === 0) {
          const { data: patient } = await supabase.from("patients").select("first_name, last_name").eq("id", plan.patient_id as number).maybeSingle();
          const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

          await supabase.from("patients").update({
            stage: "Post Treatment",
            post_treatment_started_at: now,
            treatment_end_date: lastDate,
            treatment_plan: null,
            treatment_type: null,
            medication_timing: null,
            updated_at: now,
          }).eq("id", plan.patient_id as number);

          await supabase.from("activity").insert({
            type: "stage_changed",
            description: `${patientName} moved to Post Treatment (${dept} care plan completed — last visit ${lastDate})`,
            patient_id: plan.patient_id as number,
            patient_name: patientName,
            metadata: "Post Treatment",
          });
          log(`Auto-ended ${dept} plan ${plan.id} for patient ${plan.patient_id as number} (last date ${lastDate})`);
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Care plan completion detection error: ${err}`);
  }
}


// ── Personal health reminder push — every minute ──────────────────────────────
// Finds plan items whose time (in WAT) falls exactly lead_mins from now,
// and sends a push notification to each patient who has enabled personal reminders.
async function runPersonalReminderPush() {
  try {
    const WAT_OFFSET = 60 * 60 * 1000; // UTC+1
    const now = new Date();
    const nowWAT = new Date(now.getTime() + WAT_OFFSET);
    const todayWAT = nowWAT.toISOString().slice(0, 10);

    // Get all accounts with personal reminders enabled and a push subscription
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("account_id, lead_mins")
      .eq("personal_enabled", true);

    if (!prefs?.length) return;

    const accountIds = prefs.map(p => p.account_id as number);

    // Get this week's plans for those accounts
    const weekStart = (() => {
      const d = new Date(nowWAT);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return d.toISOString().slice(0, 10);
    })();

    const { data: plans } = await supabase
      .from("weekly_plans")
      .select("account_id, plan_data")
      .eq("week_start", weekStart)
      .in("account_id", accountIds);

    if (!plans?.length) return;

    const prefMap = new Map(prefs.map(p => [p.account_id as number, p.lead_mins as number]));

    for (const plan of plans) {
      const accountId = plan.account_id as number;
      const leadMins  = prefMap.get(accountId) ?? 10;

      // Target time = now + leadMins, rounded to nearest minute, in WAT HH:MM
      const target = new Date(nowWAT.getTime() + leadMins * 60 * 1000);
      const targetHH = String(target.getHours()).padStart(2, "0");
      const targetMM = String(target.getMinutes()).padStart(2, "0");
      const targetTime = `${targetHH}:${targetMM}`;

      const pd = plan.plan_data as { days?: Array<{ date: string; items: Array<{ time?: string; label: string; emoji: string }> }> };
      const todayPlan = pd?.days?.find(d => d.date === todayWAT);
      if (!todayPlan) continue;

      const dueItems = todayPlan.items.filter(item => item.time === targetTime);
      if (!dueItems.length) continue;

      const firstItem = dueItems[0];
      const title = dueItems.length === 1
        ? `${firstItem.emoji} ${firstItem.label} in ${leadMins} mins`
        : `${dueItems.length} health tasks in ${leadMins} mins`;
      const body = dueItems.length === 1
        ? "Tap to open your ERA Health plan"
        : dueItems.map(i => `${i.emoji} ${i.label}`).join(" · ");

      await sendPushToAccount(accountId, { title, body, url: "/", tag: `personal-${targetTime}` });
      log(`Personal reminder push → account ${accountId} at ${targetTime} (${dueItems.length} item(s))`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Personal reminder push error: ${err}`);
  }
}

// ── Companion evening nudge — daily at 8 PM WAT ───────────────────────────────
// Sends a push to users who have companion notifications enabled and haven't
// opened a diary entry today.
async function runCompanionEveningNudge() {
  try {
    const WAT_OFFSET = 60 * 60 * 1000;
    const nowWAT = new Date(Date.now() + WAT_OFFSET);
    const todayWAT = nowWAT.toISOString().slice(0, 10);

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("account_id")
      .eq("companion_enabled", true);

    if (!prefs?.length) return;
    const accountIds = prefs.map(p => p.account_id as number);

    // Find accounts that already have a diary entry today
    const { data: todayEntries } = await supabase
      .from("diary_entries")
      .select("account_id")
      .in("account_id", accountIds)
      .gte("created_at", `${todayWAT}T00:00:00+01:00`);

    const alreadyCheckedIn = new Set((todayEntries ?? []).map(e => e.account_id as number));
    const targets = accountIds.filter(id => !alreadyCheckedIn.has(id));

    for (const accountId of targets) {
      await sendPushToAccount(accountId, {
        title: "Check in with your diary 📔",
        body: "A moment of reflection can make a real difference. Your diary is waiting.",
        url: "/companion",
        tag: "companion-nudge",
      });
    }

    if (targets.length) log(`Companion evening nudge → ${targets.length} account(s)`);
  } catch (err) {
    Sentry.captureException(err);
    log(`Companion evening nudge error: ${err}`);
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
    await runReturnVisitReminders();
    await runNoShowDetection();
    await runNoShowFollowup();
    await runQueueLongWaitCheck();
  });

  // Daily at 7:00 AM WAT: pipeline transitions + post-treatment check-ins + dormant + birthdays
  cron.schedule("0 7 * * *", async () => {
    await runCarePlanCompletionDetection();
    await runPostTreatmentCheckins();
    await runPostTreatmentTransitions();
    await runDormantDetection();
    await runBirthdayEmails();
  }, TZ);

  // Daily at 6:00 PM WAT: post-care wellness emails
  cron.schedule("0 18 * * *", async () => {
    await runPostCareEmails();
  }, TZ);

  // Every Monday at 12:00 PM WAT: feedback emails (covers all patients who visited the past 7 days)
  cron.schedule("0 12 * * 1", async () => {
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

  // Every minute: personal health reminder push notifications
  cron.schedule("* * * * *", async () => {
    await runPersonalReminderPush();
  });

  // Daily at 8 PM WAT: companion evening nudge
  cron.schedule("0 20 * * *", async () => {
    await runCompanionEveningNudge();
  }, TZ);

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
      .eq("status", "active")
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
        .maybeSingle();
      if (!hosp) continue;

      if (await checkSentLog(hosp.id, key)) continue;

      const { data: patient } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .eq("id", plan.patient_id as number)
        .maybeSingle();
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
    const { data: hospitals } = await supabase.from("hospitals").select("id, username, hospital_code, active");
    if (!hospitals?.length) return;

    for (const h of hospitals) {
      const { data: plans } = await supabase
        .from("care_plans")
        .select("id, patient_id, department, summary, template_data, beneficiary_name, beneficiary_email, beneficiary_relationship, pregenerated_messages, created_at")
        .eq("hospital_id", h.hospital_code)
        .eq("status", "active");

      if (!plans?.length) continue;

      // Pre-fetch all patients for this hospital in one query — eliminates N per-plan lookups
      const planPatientIds = [...new Set(plans.map(p => p.patient_id as number))];
      const { data: patientRows } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, stage, treatment_end_date")
        .eq("hospital_id", h.hospital_code)
        .in("id", planPatientIds);
      const patientMap = new Map((patientRows ?? []).map(p => [p.id as number, p]));

      for (const plan of plans) {
        const dept = plan.department as string;
        const td = (plan.template_data ?? {}) as Record<string, unknown>;
        const beneficiaryName = plan.beneficiary_name as string | null;
        const beneficiaryEmail = plan.beneficiary_email as string | null;
        const beneficiaryRelationship = plan.beneficiary_relationship as string | null;

        const patient = patientMap.get(plan.patient_id as number);

        if (!patient?.email) continue;

        const patientName = `${patient.first_name} ${patient.last_name}`;

        // ── New-format plans: medications[] and/or procedures[] arrays ────────
        const newMeds = (td.medications as Array<{ id?: string; name?: string; timing?: Record<string, string> }> | undefined) ?? [];
        const newProcs = (td.procedures as Array<{ id?: string; name?: string; timing?: Record<string, string> }> | undefined) ?? [];
        if (newMeds.length > 0 || newProcs.length > 0) {
          const storedEnd = patient.treatment_end_date as string | undefined;
          if (storedEnd && today > storedEnd) continue;

          // Medications: daily for first 5 days from first reminder, then weekly summary
          // Group by slot+time so one email covers multiple drugs taken at the same hour
          const medsBySlotTime = new Map<string, { slot: string; time: string; names: string[] }>();
          for (const med of newMeds) {
            for (const [slot, timeStr] of Object.entries(med.timing ?? {})) {
              if (!timeStr) continue;
              const key = `${slot}_${timeStr}`;
              if (!medsBySlotTime.has(key)) medsBySlotTime.set(key, { slot, time: timeStr, names: [] });
              medsBySlotTime.get(key)!.names.push(med.name || "medication");
            }
          }

          if (newMeds.length > 0) {
            // Check when first med reminder was sent for this plan
            const { data: firstMedLog } = await supabase
              .from("automation_log")
              .select("created_at")
              .eq("hospital_id", h.id)
              .eq("patient_id", patient.id as number)
              .like("automation_type", `med_${plan.id}_%`)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

            const firstMedDate = firstMedLog?.created_at ? new Date(firstMedLog.created_at as string) : null;
            const daysSinceFirst = firstMedDate
              ? Math.floor((now.getTime() - firstMedDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            if (firstMedDate && daysSinceFirst >= 5) {
              // After day 5: weekly summary on the same day of week as the first reminder
              const summaryDayOfWeek = firstMedDate.getDay();
              if (now.getDay() === summaryDayOfWeek) {
                const sortedSlots = [...medsBySlotTime.values()].sort((a, b) => a.time.localeCompare(b.time));
                const firstSlot = sortedSlots[0];
                if (firstSlot) {
                  const [hh, mm] = firstSlot.time.split(":").map(Number);
                  const fireAt = watToUTC(hh, mm);
                  if (Math.abs(fireAt.getTime() - now.getTime()) <= WINDOW_MS) {
                    const weeklyKey = `med_weekly_${plan.id}_${isoWeekKey(now)}`;
                    if (!(await checkSentLog(h.id, weeklyKey))) {
                      const allMedNames = newMeds.map(m => m.name || "medication");
                      await sendWeeklyMedicationSummaryEmail(h.id, patient.id as number, patientName, patient.email as string, allMedNames, dept);
                      await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: weeklyKey, status: "sent", channel: "email", message_preview: `Weekly medication summary → ${patient.email as string}`, created_at: new Date().toISOString() });
                      log(`Weekly medication summary → patient ${patient.id}`);
                    }
                  }
                }
              }
            } else if (firstMedDate && daysSinceFirst >= 1) {
              // Days 2–5: one daily summary at the earliest medication time
              const sortedSlots = [...medsBySlotTime.values()].sort((a, b) => a.time.localeCompare(b.time));
              const firstSlot = sortedSlots[0];
              if (firstSlot) {
                const [hh, mm] = firstSlot.time.split(":").map(Number);
                const fireAt = watToUTC(hh, mm);
                if (Math.abs(fireAt.getTime() - now.getTime()) <= WINDOW_MS) {
                  const dailyKey = `med_daily_summary_${plan.id}_${today}`;
                  if (!(await checkSentLog(h.id, dailyKey))) {
                    const allMedNames = newMeds.map(m => m.name || "medication");
                    await sendWeeklyMedicationSummaryEmail(h.id, patient.id as number, patientName, patient.email as string, allMedNames, dept);
                    await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: dailyKey, status: "sent", channel: "email", message_preview: `Daily medication summary → ${patient.email as string}`, created_at: new Date().toISOString() });
                    log(`Daily medication summary → patient ${patient.id} (day ${daysSinceFirst + 1})`);
                  }
                }
              }
            } else {
              // Day 1: per-slot reminders (up to 3×)
              for (const { slot, time, names } of medsBySlotTime.values()) {
                const [hh, mm] = time.split(":").map(Number);
                const fireAt = watToUTC(hh, mm);
                if (Math.abs(fireAt.getTime() - now.getTime()) > WINDOW_MS) continue;
                const dedupeKey = `med_${plan.id}_${slot}_${time}_${today}`;
                if (await checkSentLog(h.id, dedupeKey)) continue;
                const message = `Reminder: Time to take your ${names.join(", ")}. Please take your medication as prescribed.`;
                await sendStoredCarePlanReminder(h.id, patient.id as number, patientName, patient.email as string, message, slot as InCareTimeSlot, dept);
                await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: dedupeKey, status: "sent", channel: "email", message_preview: `Medication reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
                log(`Medication reminder → patient ${patient.id} slot=${slot} time=${time}`);
              }
            }
          }

          // Procedures: fire reminder 3h before timing time
          for (const proc of newProcs) {
            for (const [slot, timeStr] of Object.entries(proc.timing ?? {})) {
              if (!timeStr) continue;
              const [hh, mm] = timeStr.split(":").map(Number);
              const visitAt = watToUTC(hh, mm);
              const fireAt = new Date(visitAt.getTime() - 3 * 60 * 60 * 1000);
              if (Math.abs(fireAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const dedupeKey = `proc_${plan.id}_${proc.id ?? slot}_${slot}_${today}`;
              if (await checkSentLog(h.id, dedupeKey)) continue;
              const message = `Reminder: You are scheduled for ${proc.name || "a procedure"} at ${timeStr} today. Please arrive on time.`;
              await sendStoredCarePlanReminder(h.id, patient.id as number, patientName, patient.email as string, message, slot as InCareTimeSlot, dept);
              await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: dedupeKey, status: "sent", channel: "email", message_preview: `Procedure reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
              log(`Procedure reminder → patient ${patient.id} ${proc.name} slot=${slot}`);
            }
          }

          // Categories: specialist appointment reminders — 4h before each scheduled visit
          const newCats = (td.categories as Array<{ type?: string; data?: Record<string, unknown> }> | undefined) ?? [];
          for (const cat of newCats) {
            if (!cat.type || !cat.data) continue;
            const entries = extractVisitEntries(cat.type, cat.data, today);
            for (const entry of entries) {
              if (!entry.date || !entry.time) continue;
              const visitAt = new Date(`${entry.date}T${entry.time}:00+01:00`);
              const fireAt = new Date(visitAt.getTime() - 4 * 60 * 60 * 1000);
              if (Math.abs(fireAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const dedupeKey = `cat_visit_${plan.id}_${cat.type.replace(/\W+/g, "_")}_${entry.date}_${entry.time.replace(":", "")}`;
              if (await checkSentLog(h.id, dedupeKey)) continue;
              await sendCareVisitReminderEmail(h.id, patient.id as number, patientName, patient.email as string, cat.type, plan.summary as string, entry.date, plan.id as number, entry.time);
              await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: dedupeKey, status: "sent", channel: "email", message_preview: `${cat.type} visit reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
              if (beneficiaryName && beneficiaryEmail) {
                await sendBeneficiaryReminderEmail(h.id, patient.id as number, patientName, beneficiaryName, beneficiaryEmail, `attend their ${cat.type} visit`, beneficiaryRelationship);
              }
              log(`${cat.type} visit reminder (4h before ${entry.time}) → patient ${patient.id} on ${entry.date}`);
            }
          }
          continue;
        }

        if (dept === "General Outpatient") {
          // Compute effective end date — use patient.treatment_end_date if set, otherwise
          // fall back to plan creation date + (durationDays - 1) from template_data.
          const storedEnd = patient.treatment_end_date as string | undefined;
          const fallbackEnd = (() => {
            const dur = Math.max(1, (td.durationDays as number | undefined) ?? 1);
            const created = new Date(plan.created_at as string);
            const last = new Date(created.getTime() + (dur - 1) * 86400000);
            return last.toISOString().split("T")[0];
          })();
          const effectiveEndDate = storedEnd ?? fallbackEnd;
          if (today > effectiveEndDate) continue;

          const treatmentType = (td.treatmentType as string) ?? "";
          const medTiming = (td.medicationTiming as string[]) ?? [];
          const medTimingTimes = (td.medicationTimingTimes as Record<string, string>) ?? {};
          const hospTiming = (td.hospitalTiming as string[]) ?? [];
          const hospTimingTimes = (td.hospitalTimingTimes as Record<string, string>) ?? {};

          // Pre-generated message lookup — avoids calling AI at send time.
          // Day 1 = plan creation date. Used for "varied" plans where each day has unique messages.
          const pregeneratedMessages = (plan.pregenerated_messages as PregeneratedMessages | null) ?? null;
          const planCreatedAt = new Date(plan.created_at as string);
          const dayNumber = Math.floor((now.getTime() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          const getStoredMessage = (slot: string): string | null => {
            if (!pregeneratedMessages?.messages) return null;
            if (pregeneratedMessages.type === "uniform") {
              return (pregeneratedMessages.messages as Record<string, string>)[slot] ?? null;
            }
            // varied — try exact day, fallback to last generated day
            const dayMsgs = (pregeneratedMessages.messages as Record<string, Record<string, string>>)[String(dayNumber)];
            if (dayMsgs?.[slot]) return dayMsgs[slot];
            const days = Object.keys(pregeneratedMessages.messages).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
            return (pregeneratedMessages.messages as Record<string, Record<string, string>>)[String(days[0])]?.[slot] ?? null;
          };

          if (treatmentType === "medication_only") {
            // Check whether this plan is past the 5-day daily window
            const { data: firstGenoutMedLog } = await supabase
              .from("automation_log")
              .select("created_at")
              .eq("hospital_id", h.id)
              .eq("patient_id", patient.id as number)
              .like("automation_type", `genout_med_${plan.id}_%`)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

            const firstGenoutDate = firstGenoutMedLog?.created_at ? new Date(firstGenoutMedLog.created_at as string) : null;
            const genoutDaysSinceFirst = firstGenoutDate
              ? Math.floor((now.getTime() - firstGenoutDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            if (firstGenoutDate && genoutDaysSinceFirst >= 5) {
              // After day 5: weekly summary on the same day of week as the first reminder
              const summaryDay = firstGenoutDate.getDay();
              if (now.getDay() === summaryDay) {
                const firstSlot = medTiming[0];
                const firstTime = firstSlot ? medTimingTimes[firstSlot] : null;
                if (firstTime) {
                  const [hh, mm] = firstTime.split(":").map(Number);
                  const fireAt = watToUTC(hh, mm);
                  if (Math.abs(fireAt.getTime() - now.getTime()) <= WINDOW_MS) {
                    const weeklyKey = `genout_med_weekly_${plan.id}_${isoWeekKey(now)}`;
                    if (!(await checkSentLog(h.id, weeklyKey))) {
                      await sendWeeklyMedicationSummaryEmail(h.id, patient.id as number, patientName, patient.email as string, ["your prescribed medications"], dept);
                      await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: weeklyKey, status: "sent", channel: "email", message_preview: `Weekly GenOut med summary → ${patient.email as string}`, created_at: new Date().toISOString() });
                      log(`Weekly GenOut med summary → patient ${patient.id}`);
                    }
                  }
                }
              }
            } else if (firstGenoutDate && genoutDaysSinceFirst >= 1) {
              // Days 2–5: one daily summary at the first medication time
              const firstSlot = medTiming[0];
              const firstTime = firstSlot ? medTimingTimes[firstSlot] : null;
              if (firstTime) {
                const [hh, mm] = firstTime.split(":").map(Number);
                const visitAt = watToUTC(hh, mm);
                if (Math.abs(visitAt.getTime() - now.getTime()) <= WINDOW_MS) {
                  const dailyKey = `genout_med_daily_summary_${plan.id}_${today}`;
                  if (!(await checkSentLog(h.id, dailyKey))) {
                    await sendWeeklyMedicationSummaryEmail(h.id, patient.id as number, patientName, patient.email as string, ["your prescribed medications"], dept);
                    await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: dailyKey, status: "sent", channel: "email", message_preview: `Daily GenOut med summary → ${patient.email as string}`, created_at: new Date().toISOString() });
                    log(`Daily GenOut med summary → patient ${patient.id} (day ${genoutDaysSinceFirst + 1})`);
                  }
                }
              }
            } else {
              // Day 1: per-slot reminders (up to 3×), fire AT the exact time
              for (const slot of medTiming) {
                const timeStr = medTimingTimes[slot];
                if (!timeStr) continue;
                const [hh, mm] = timeStr.split(":").map(Number);
                const visitAt = watToUTC(hh, mm);
                if (Math.abs(visitAt.getTime() - now.getTime()) > WINDOW_MS) continue;
                const key = `genout_med_${plan.id}_${slot}_${today}`;
                if (await checkSentLog(h.id, key)) continue;
                const stored = getStoredMessage(slot);
                if (stored) {
                  await sendStoredCarePlanReminder(h.id, patient.id as number, patientName, patient.email as string, stored, slot as InCareTimeSlot, dept);
                } else {
                  await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["med"], dept);
                }
                await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: key, status: "sent", channel: "email", message_preview: `GenOut med reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
                if (beneficiaryName && beneficiaryEmail) {
                  await sendBeneficiaryReminderEmail(h.id, patient.id as number, patientName, beneficiaryName, beneficiaryEmail, "take their medication", beneficiaryRelationship);
                }
                log(`General Outpatient med reminder (at ${timeStr}) → patient ${patient.id} slot=${slot} source=${stored ? "stored" : "live-ai"}`);
              }
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
              const stored = getStoredMessage(slot);
              if (stored) {
                await sendStoredCarePlanReminder(h.id, patient.id as number, patientName, patient.email as string, stored, slot as InCareTimeSlot, dept);
              } else {
                await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["hosp"], dept);
              }
              await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: key, status: "sent", channel: "email", message_preview: `GenOut hospital reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
              if (beneficiaryName && beneficiaryEmail) {
                await sendBeneficiaryReminderEmail(h.id, patient.id as number, patientName, beneficiaryName, beneficiaryEmail, "attend their hospital visit", beneficiaryRelationship);
              }
              log(`General Outpatient hospital reminder (3h before ${timeStr}) → patient ${patient.id} slot=${slot} source=${stored ? "stored" : "live-ai"}`);
            }

          } else if (treatmentType === "combination") {
            // Combination — ONE combined message 2h before the visit time
            const comboSlots = medTiming.length > 0 ? medTiming : [...new Set([...medTiming, ...hospTiming])];
            for (const slot of comboSlots) {
              // Use visit time (hospTimingTimes) as the 2h-before reference; fall back to med time
              const refTime = hospTimingTimes[slot] || medTimingTimes[slot];
              if (!refTime) continue;
              const [hh, mm] = refTime.split(":").map(Number);
              const visitAt = watToUTC(hh, mm);
              const reminderAt = new Date(visitAt.getTime() - 2 * 3600 * 1000);
              if (Math.abs(reminderAt.getTime() - now.getTime()) > WINDOW_MS) continue;
              const key = `genout_combo_${plan.id}_${slot}_${today}`;
              if (await checkSentLog(h.id, key)) continue;
              const stored = getStoredMessage(slot);
              if (stored) {
                await sendStoredCarePlanReminder(h.id, patient.id as number, patientName, patient.email as string, stored, slot as InCareTimeSlot, dept);
              } else {
                await sendInCareAIReminder(h.id, patient.id as number, patientName, patient.email as string, plan.summary as string, slot as InCareTimeSlot, ["med", "hosp"], dept);
              }
              await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: key, status: "sent", channel: "email", message_preview: `GenOut combo reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
              if (beneficiaryName && beneficiaryEmail) {
                await sendBeneficiaryReminderEmail(h.id, patient.id as number, patientName, beneficiaryName, beneficiaryEmail, "take their medication and attend their hospital visit", beneficiaryRelationship);
              }
              log(`General Outpatient combination reminder (2h before visit at ${refTime}) → patient ${patient.id} slot=${slot} source=${stored ? "stored" : "live-ai"}`);
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
            await supabase.from("automation_log").insert({ hospital_id: h.id, patient_id: patient.id as number, automation_type: key, status: "sent", channel: "email", message_preview: `${dept} visit reminder → ${patient.email as string}`, created_at: new Date().toISOString() });
            if (beneficiaryName && beneficiaryEmail) {
              await sendBeneficiaryReminderEmail(h.id, patient.id as number, patientName, beneficiaryName, beneficiaryEmail, `attend their ${dept} visit`, beneficiaryRelationship);
            }
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

// ── Return Visit Reminders — runs every 15 minutes ───────────────────────────
// 24h before and 3h before — email + ERA in-app notification.
async function runReturnVisitReminders() {
  try {
    const now = new Date();
    const in24h       = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24hPlus15 = new Date(in24h.getTime() + 15 * 60 * 1000);
    const in3h        = new Date(now.getTime() +  3 * 60 * 60 * 1000);
    const in3hPlus15  = new Date(in3h.getTime()  + 15 * 60 * 1000);
    const in15min     = new Date(now.getTime() + 15 * 60 * 1000);

    // Build datetime from visit_date + optional visit_time (default noon if no time)
    // We query by date range covering ±24h window; filter by visit_datetime in code.
    // Simpler: query just by date proximity.
    const todayDate   = now.toISOString().split("T")[0];
    const tomorrowDate = in24hPlus15.toISOString().split("T")[0];
    const in3dDate    = in3hPlus15.toISOString().split("T")[0];

    // ── 24-hour reminder ────────────────────────────────────────────────────────
    const { data: visits24 } = await supabase
      .from("patient_return_visits")
      .select("*, patients(id, first_name, last_name, email), hospitals(id, name)")
      .eq("status", "scheduled")
      .is("reminder_24h_sent_at", null)
      .gte("visit_date", todayDate)
      .lte("visit_date", tomorrowDate);

    for (const visit of visits24 ?? []) {
      const visitAt = new Date(`${visit.visit_date as string}T${(visit.visit_time as string | null) ?? "12:00:00"}`);
      const hoursAway = (visitAt.getTime() - now.getTime()) / 3600000;
      if (hoursAway < 20 || hoursAway > 28) continue; // only in the 24h ±4h window + catch-up
      const patient = (visit as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = (visit as Record<string, unknown>).hospitals as Record<string, unknown> | null;
      const hospitalId = hospital?.id as number | null;
      if (!hospitalId) continue;
      await sendReturnVisitReminderEmail(
        hospitalId,
        patient.id as number,
        `${patient.first_name} ${patient.last_name}`,
        patient.email as string,
        visit.visit_date as string,
        (visit.visit_time as string | null) ?? null,
        visit.reason as string,
        24,
      );
      await supabase.from("patient_return_visits").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", visit.id as number);
      log(`Sent 24h return visit reminder for visit ${visit.id as number}`);
    }

    // ── 3-hour reminder ─────────────────────────────────────────────────────────
    const { data: visits3h } = await supabase
      .from("patient_return_visits")
      .select("*, patients(id, first_name, last_name, email), hospitals(id, name)")
      .eq("status", "scheduled")
      .is("reminder_3h_sent_at", null)
      .gte("visit_date", todayDate)
      .lte("visit_date", in3dDate);

    for (const visit of visits3h ?? []) {
      const visitAt = new Date(`${visit.visit_date as string}T${(visit.visit_time as string | null) ?? "12:00:00"}`);
      const hoursAway = (visitAt.getTime() - now.getTime()) / 3600000;
      if (hoursAway < 2.5 || hoursAway > 4) continue; // only in the 3h ±1.5h window + catch-up (min 15 min away)
      if (visitAt.getTime() < in15min.getTime()) continue;
      const patient = (visit as Record<string, unknown>).patients as Record<string, unknown> | null;
      if (!patient?.email) continue;
      const hospital = (visit as Record<string, unknown>).hospitals as Record<string, unknown> | null;
      const hospitalId = hospital?.id as number | null;
      if (!hospitalId) continue;
      await sendReturnVisitReminderEmail(
        hospitalId,
        patient.id as number,
        `${patient.first_name} ${patient.last_name}`,
        patient.email as string,
        visit.visit_date as string,
        (visit.visit_time as string | null) ?? null,
        visit.reason as string,
        3,
      );
      await supabase.from("patient_return_visits").update({ reminder_3h_sent_at: now.toISOString() }).eq("id", visit.id as number);
      log(`Sent 3h return visit reminder for visit ${visit.id as number}`);
    }
  } catch (err) {
    Sentry.captureException(err);
    log(`Return visit reminders error: ${err}`);
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

