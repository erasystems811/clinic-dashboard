import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import { generateOpenAIMessage, generateClaudeMessage, buildToneDescription } from "./ai.js";
import { sendEmail, wrapHtml } from "./email.js";
import { deliverMobileMessage } from "./messaging.js";

export type AutomationChannel = "whatsapp" | "sms" | "email";
export type AutomationStatus = "queued" | "sent" | "failed";

export interface AutomationContext {
  hospitalId: number;
  patientId?: number;
  patientName?: string;
  automationType: string;
  channel: AutomationChannel;
}

export async function logAutomation(
  ctx: AutomationContext,
  status: AutomationStatus,
  messagePreview?: string,
  errorMessage?: string,
): Promise<number> {
  const { data } = await supabase.from("automation_log").insert({
    hospital_id: ctx.hospitalId,
    patient_id: ctx.patientId ?? null,
    patient_name: ctx.patientName ?? null,
    automation_type: ctx.automationType,
    channel: ctx.channel,
    status,
    message_preview: messagePreview ? messagePreview.slice(0, 500) : null,
    error_message: errorMessage ?? null,
    last_attempted_at: new Date().toISOString(),
    sent_at: status === "sent" ? new Date().toISOString() : null,
  }).select("id").single();
  return data?.id ?? 0;
}

export async function updateAutomationLog(
  id: number,
  status: AutomationStatus,
  errorMessage?: string,
): Promise<void> {
  await supabase.from("automation_log").update({
    status,
    error_message: errorMessage ?? null,
    last_attempted_at: new Date().toISOString(),
    sent_at: status === "sent" ? new Date().toISOString() : null,
  }).eq("id", id);
}

export interface HospitalContext {
  hospitalName: string;
  hospitalUsername: string;
  /** UUID — used as hospital_id in patient-facing tables (patients, care_plans, queue) */
  hospitalCode: string;
  /** Ready-to-use "Display Name <email>" from address for Resend */
  fromAddress: string;
  notificationChannel: "whatsapp" | "sms";
  phoneNumber: string | null;
  termiiSenderId: string | null;
  /** Hospital communication language — null means default to English */
  language: string | null;
}

export async function getHospitalContext(hospitalId: number): Promise<HospitalContext> {
  const [{ data: hospital }, { data: settings }] = await Promise.all([
    supabase.from("hospitals").select("id, name, username, hospital_code, active").eq("id", hospitalId).single(),
    supabase.from("hospital_settings")
      .select("sender_name, notification_channel, phone_number, tone, termii_sender_id, language")
      .eq("hospital_id", hospitalId).single(),
  ]);
  if (hospital?.active === false) {
    throw new Error(`[automation] Hospital ${hospitalId} is suspended — automation skipped.`);
  }
  const hospitalName = hospital?.name ?? "The Hospital";
  const displayName = (settings?.sender_name as string | null)?.trim() || hospitalName;
  const rawEmail = process.env.PLATFORM_FROM_EMAIL || "onboarding@resend.dev";
  const fromAddress = `${displayName} <${rawEmail}>`;
  return {
    hospitalName,
    hospitalUsername: hospital?.username ?? "",
    hospitalCode: (hospital?.hospital_code as string) ?? "",
    fromAddress,
    notificationChannel: (settings?.notification_channel as "whatsapp" | "sms") ?? "sms",
    phoneNumber: (settings?.phone_number as string) ?? null,
    termiiSenderId: (settings?.termii_sender_id as string) ?? null,
    language: (settings?.language as string | null) ?? null,
  };
}

export function contactLine(phoneNumber: string | null): string {
  if (phoneNumber) return `contact us directly on ${phoneNumber}`;
  return "contact us directly";
}

// ── Queue Messages — WhatsApp/SMS — Templated ──────────────────────────────────

export async function sendQueueJoinMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  position: number,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_join",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, welcome to ${hCtx.hospitalName}. You've been checked in and you're currently number ${position} in the queue. Our team is working as quickly as possible and we'll keep you updated every step of the way. Please relax and make yourself comfortable. Thank you for trusting us with your care.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendQueueJoinMessage] failed:", msg, { hospitalId, patientId, patientName });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendQueueNextInLine(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_next_in_line",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, you are next in line at ${hCtx.hospitalName}. Please be ready — you will be called in shortly. Thank you for your patience.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendQueueNextInLine] failed:", msg, { hospitalId, patientId, patientName });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendQueueYourTurn(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_your_turn",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, it is your turn now at ${hCtx.hospitalName}. Please proceed, we are ready for you.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendQueueYourTurn] failed:", msg, { hospitalId, patientId, patientName });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendQueueLongWaitApology(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_long_wait_apology",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, we sincerely apologise for the longer than usual wait today at ${hCtx.hospitalName}. We are doing our best to attend to everyone as quickly as possible and we truly appreciate your patience. Thank you for being with us.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendQueueLongWaitApology] failed:", msg, { hospitalId, patientId, patientName });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Care Plan — WhatsApp/SMS Notification (Templated) + Email (OpenAI) ─────────

export async function sendCarePlanNotification(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "care_plan_notification",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, your care plan at ${hCtx.hospitalName} has been set up. Please check your email continuously for your full care plan details and follow up. We are with you every step of the way.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCarePlanNotification] failed:", msg, { hospitalId, patientId, patientName });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendCarePlanEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  treatmentType: string,
  treatmentPlan: string,
  durationDays: number,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "care_plan_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];

    const emailBody = await generateClaudeMessage(
      `You are writing a care plan explanation email for a patient of ${hCtx.hospitalName}. Be warm, clear and patient-friendly. Never use clinical jargon. Never mention a diagnosis. Explain what the plan means in simple terms. Keep it under 200 words of body text. End with a closed statement — make clear the patient does not need to reply to this email and should ${contactLine(hCtx.phoneNumber)} if they have questions.`,
      `Write a warm, friendly email explaining ${firstName}'s care plan at ${hCtx.hospitalName}. Treatment type: ${treatmentType}. Duration: ${durationDays} days. Care plan details: ${treatmentPlan}. Explain what this means for the patient in plain, reassuring language — what they can expect, how the team will support them, and what they should do. End with: "If you have any questions please do not hesitate to ${contactLine(hCtx.phoneNumber)}. Please do not reply to this email directly. Warm regards, ${hCtx.hospitalName} Team."`,
      350,
    );

    const html = wrapHtml(
      `<p>${emailBody.replace(/\n/g, "</p><p>")}</p>`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject: `Your care plan has started — ${hCtx.hospitalName}`,
      html,
      text: emailBody,
    });

    await updateAutomationLog(logId, "sent", `Care plan email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCarePlanEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Post-Treatment Check-ins — Email — Templated — Day 1, 4, 7 only ──────────

export async function sendPostTreatmentCheckinEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  day: 1 | 4 | 7,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const automationType = `post_treatment_day${day}`;
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    let subject: string;
    let body: string;

    if (day === 1) {
      subject = `Checking in on you — ${hCtx.hospitalName}`;
      body = `Hi ${patientName},\n\nWe hope you are resting and taking things easy today. Your treatment at ${hCtx.hospitalName} has just concluded and we wanted to reach out on this first day to let you know we are thinking of you. Recovery takes time and that is completely okay. Please follow any instructions given to you and take care of yourself.\n\nIf you have any questions or concerns please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    } else if (day === 4) {
      subject = `How are you feeling? — ${hCtx.hospitalName}`;
      body = `Hi ${patientName},\n\nIt has been a few days since your treatment at ${hCtx.hospitalName} and we just wanted to check in on you. We hope you are feeling a little better each day. Recovery is a journey and we want you to know we are rooting for you.\n\nIf anything feels off or you have any concerns at all please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nTake good care of yourself.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    } else {
      subject = `One week check-in — ${hCtx.hospitalName}`;
      body = `Hi ${patientName},\n\nA week has passed since your treatment at ${hCtx.hospitalName} and we hope you are feeling much better. You have come a long way and we are proud of your progress. As you continue your recovery please remember to stay consistent with any ongoing instructions.\n\nIf you need anything at all please do not hesitate to ${contact}. Please do not reply to this email directly. We are always here for you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    }

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Post-treatment Day ${day} email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendPostTreatmentCheckinEmail] failed:", msg, { hospitalId, patientId, patientEmail, day });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Post-Care Wellness — Email — Templated — after 30 days ────────────────────

export async function sendPostCareEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "post_care_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `Thinking of you — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nIt has been a little while since we last saw you at ${hCtx.hospitalName} and we just wanted to check in and see how you are doing. We hope you are feeling well and taking good care of yourself. Your health and wellbeing mean a lot to us.\n\nIf you ever need anything or feel it is time for a check-up please do not hesitate to ${contact}. Please do not reply to this email directly. We are always here when you need us.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Post-care email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendPostCareEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Appointment Messages — Email — Templated ──────────────────────────────────

export async function sendAppointmentConfirmationEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  scheduledAt: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_confirmation",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
    const subject = `Appointment Confirmed — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nYour appointment at ${hCtx.hospitalName} has been confirmed for ${dateStr}. Please arrive a few minutes early.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly. We look forward to seeing you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Appointment confirmation → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendAppointmentConfirmationEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendAppointmentReminderEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  scheduledAt: string,
  hoursAway: 24 | 2,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const automationType = hoursAway === 24 ? "appointment_reminder_24h" : "appointment_reminder_2h";
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
    const timeStr = new Date(scheduledAt).toLocaleString("en-GB", { timeStyle: "short" });
    const subject = hoursAway === 24
      ? `Reminder — Your appointment is tomorrow — ${hCtx.hospitalName}`
      : `Your appointment is in 2 hours — ${hCtx.hospitalName}`;
    const body = hoursAway === 24
      ? `Hi ${patientName},\n\nThis is a friendly reminder that your appointment at ${hCtx.hospitalName} is tomorrow ${dateStr}. We look forward to seeing you.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`
      : `Hi ${patientName},\n\nJust a quick reminder that your appointment at ${hCtx.hospitalName} is in 2 hours at ${timeStr}. We will see you soon.\n\nIf you need to reschedule please do not hesitate to ${contact} immediately. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Appointment reminder (${hoursAway}h) → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendAppointmentReminderEmail] failed:", msg, { hospitalId, patientId, patientEmail, hoursAway });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendAppointmentNoShowEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_no_show",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `We missed you today — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nWe noticed you were not able to make your appointment at ${hCtx.hospitalName} today. We hope you are good? We completely understand that life gets busy too sometimes.\n\nWhenever you are ready to rebook please do not hesitate to ${contact}. Please do not reply to this email directly. We are here for you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `No-show email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendAppointmentNoShowEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Feedback Email — Templated ─────────────────────────────────────────────────

export async function sendFeedbackEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  feedbackUrl: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "feedback_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `How was your visit? — ${hCtx.hospitalName}`;
    const intro = `Hi ${patientName},\n\nThank you for visiting ${hCtx.hospitalName} yesterday. We hope your experience was a positive one. We would love to hear your thoughts so we can continue to improve our service. Please take a moment to share your feedback using the link below.`;
    const closing = `Your feedback means a lot to us. Please do not reply to this email directly — if you need to reach us please ${contact}.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(
      `<p>${intro.replace(/\n/g, "</p><p>")}</p>
       <p style="text-align:center"><a href="${feedbackUrl}" class="btn">Share Your Feedback →</a></p>
       <p>${closing.replace(/\n/g, "</p><p>")}</p>`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: `${intro}\n\nShare your feedback: ${feedbackUrl}\n\n${closing}`,
    });

    await updateAutomationLog(logId, "sent", `Feedback email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendFeedbackEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
  }
}

// ── Birthday Email — Templated — Fires once per year on patient's birthday ─────

export async function sendBirthdayEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "birthday_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const subject = `Happy Birthday from ${hCtx.hospitalName} 🎂`;
    const body = `Happy Birthday ${firstName}!\n\nToday we pause to celebrate you. At ${hCtx.hospitalName}, you are never just a name in our system — you are someone we genuinely care about, and your birthday gives us a reason to say that out loud.\n\nWe hope today brings you warmth, laughter, and the company of people who love you. And in this new year of your life, we wish you the one thing that makes everything else possible — good health.\n\nFrom everyone at ${hCtx.hospitalName}, Happy Birthday. We are glad you are here.`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Birthday email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendBirthdayEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Care Visit Reminder Email — fires daily at 8am, 1 day before each scheduled date ──

export async function sendCareVisitReminderEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  department: string,
  visitDescription: string,
  visitDate: string,
  planId: number,
  visitTime?: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const dedupeKey = `PLAN:${planId}:${visitDate}:${visitTime ?? ""}`;
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "care_plan_visit_reminder",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued", dedupeKey);
  try {
    const firstName = patientName.split(" ")[0];
    const formatted = new Date(visitDate).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = visitTime ? ` at ${visitTime}` : "";
    const lang = hCtx.language ?? "English";
    const contact = contactLine(hCtx.phoneNumber);

    const tones = await (async () => {
      const { data } = await supabase.from("hospital_settings").select("tone").eq("hospital_id", hospitalId).single();
      return data?.tone ? (Array.isArray(data.tone) ? data.tone : JSON.parse(data.tone as string)) as string[] : [];
    })();
    const tone = buildToneDescription(tones);

    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a visit reminder email. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. Start with "Hi ${firstName},". Write 2–3 warm sentences reminding the patient about their upcoming ${department} appointment. Read and understand the care plan details before writing — then explain to the patient in very simple, clear words what they need to know for this visit. Mention the specific department (${department}). End with: "If you have any questions please ${contact}. Please do not reply to this email directly. Warm regards, ${hCtx.hospitalName} Team"`,
      `Department: ${department}\nAppointment: ${formatted}${timeStr}\nCare plan details (read and understand before writing): ${visitDescription.slice(0, 500)}`,
      280,
    );

    const subject = `${department} appointment reminder — ${formatted} — ${hCtx.hospitalName}`;
    const html = wrapHtml(`<p>${message.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: message });
    await updateAutomationLog(logId, "sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCareVisitReminderEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Call Task — Nurse-Flagged Automated Message — OpenAI — WhatsApp/SMS ───────
// Returns the generated draft message WITHOUT sending.
// The receptionist edits and confirms, then calls sendCallTaskConfirmedMessage.

export async function generateCallTaskDraft(
  hospitalId: number,
  patientId: number,
  patientName: string,
  flagReason: string,
): Promise<string> {
  const hCtx = await getHospitalContext(hospitalId);
  const firstName = patientName.split(" ")[0];
  const tones = await (async () => {
    const { data } = await supabase.from("hospital_settings").select("tone").eq("hospital_id", hospitalId).single();
    return data?.tone ? (Array.isArray(data.tone) ? data.tone : JSON.parse(data.tone as string)) as string[] : [];
  })();
  const tone = buildToneDescription(tones);
  const contact = contactLine(hCtx.phoneNumber);

  const message = await generateOpenAIMessage(
    `You are a care team member at ${hCtx.hospitalName} reaching out to a patient via text message. Tone: ${tone}. Start with "Hi ${firstName},". Read the reason carefully and write a message that directly addresses that specific situation — gentle if sensitive, encouraging if they need support, friendly if it is a routine check-in. Write like a real, caring person. Never sound automated or generic. End by telling the patient to ${contact} if they have any questions. IMPORTANT: If the reason is unclear, too vague, or you cannot understand what situation it refers to, reply with exactly this and nothing else: "I could not understand the reason provided. Please write the message manually."`,
    `You need to contact ${firstName} because: "${flagReason}". Write a warm, specific message addressing this exact reason. 2-4 sentences.`,
    200,
  );
  return message;
}

// Receptionist reviews/edits the AI draft, then sends it as an Important email.
export async function sendCallTaskConfirmedMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  message: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "call_task_automated",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const subject = `IMPORTANT - ${hCtx.hospitalName}`;
    const contact = contactLine(hCtx.phoneNumber);
    const body = `${message}\n\nIf you have any questions please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCallTaskConfirmedMessage] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
  }
}

// ── Call Task — Manual Email — Templated — Marked Important ───────────────────

export async function sendCallTaskManualEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  customMessage: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "call_task_manual_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `Important message from ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nWe are reaching out from ${hCtx.hospitalName} regarding your care.\n\n${customMessage}\n\nIf you have any questions please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Manual email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCallTaskManualEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
  }
}

// ── Wellness Newsletter — Claude API ──────────────────────────────────────────

export async function generateWellnessNewsletter(
  hospitalId: number,
  topic: string,
  departments: string[],
  fixedSubtopic?: string,
): Promise<{ subtopic: string; angle: string; content: string }> {
  const hCtx = await getHospitalContext(hospitalId);
  const tones = await (async () => {
    const { data } = await supabase.from("hospital_settings").select("tone").eq("hospital_id", hospitalId).single();
    return data?.tone ? (Array.isArray(data.tone) ? data.tone : JSON.parse(data.tone as string)) as string[] : [];
  })();
  const tone = buildToneDescription(tones);
  const deptList = departments.length > 0 ? departments.join(", ") : "General Practice";

  const userPrompt = fixedSubtopic
    ? `You are given a specific wellness subtopic. Your job is to choose a fresh, surprising angle on it — one that is DIFFERENT from anything obvious — then write the newsletter.

Broad category: ${topic}
Subtopic (fixed — do not change): ${fixedSubtopic}

Choose a NEW angle: a specific, surprising, or overlooked perspective on "${fixedSubtopic}" — something most people don't think about. The angle must be genuinely different from the obvious take on this subtopic.

Write a detailed weekly wellness newsletter for the community of ${hCtx.hospitalName} (departments: ${deptList}) focused on this new angle.

The newsletter content field must begin with exactly this greeting on its own line:
Dear Friends,

Then continue with the following sections:
- A warm, engaging 1-2 sentence opening referencing the specific angle (immediately after the greeting)
- What is it? (2-3 sentences explaining simply)
- Why it matters (2-3 sentences)
- Common causes or triggers (3-4 bullet points)
- Benefits of good practice (3-4 bullet points)
- What to avoid (3-4 bullet points)
- One Simple Action Step for this week (1 concrete, easy thing they can do)
- A warm closing sign-off from ${hCtx.hospitalName} — e.g. "With care, The ${hCtx.hospitalName} Wellness Team"
- End with: "This newsletter is for general wellness information only. Please do not reply to this email. For any health concerns please contact us directly."

IMPORTANT: Never use the word "patients" anywhere in the newsletter. Use "friends", "you", or "our community" instead.
Write in plain language, warm and encouraging. No markdown symbols in the content.

Respond with this exact JSON structure (no extra keys, no markdown wrapping):
{
  "subtopic": "${fixedSubtopic}",
  "angle": "the new angle you chose (max 12 words)",
  "content": "the full newsletter text"
}`
    : `You are given a broad wellness category. Your job is to choose TWO levels of focus, then write a newsletter about the specific combination:

LEVEL 1 — Subtopic: A specific area or branch within the broad category.
LEVEL 2 — Angle: A specific, surprising, or overlooked perspective on that subtopic.

Broad category: ${topic}

Write a detailed weekly wellness newsletter for the community of ${hCtx.hospitalName} (departments: ${deptList}) focused on the specific angle within the chosen subtopic.

The newsletter content field must begin with exactly this greeting on its own line:
Dear Friends,

Then continue with the following sections:
- A warm, engaging 1-2 sentence opening referencing the specific angle (immediately after the greeting)
- What is it? (2-3 sentences explaining simply)
- Why it matters (2-3 sentences)
- Common causes or triggers (3-4 bullet points)
- Benefits of good practice (3-4 bullet points)
- What to avoid (3-4 bullet points)
- One Simple Action Step for this week (1 concrete, easy thing they can do)
- A warm closing sign-off from ${hCtx.hospitalName} — e.g. "With care, The ${hCtx.hospitalName} Wellness Team"
- End with: "This newsletter is for general wellness information only. Please do not reply to this email. For any health concerns please contact us directly."

IMPORTANT: Never use the word "patients" anywhere in the newsletter. Use "friends", "you", or "our community" instead.
Write in plain language, warm and encouraging. No markdown symbols in the content.

Respond with this exact JSON structure (no extra keys, no markdown wrapping):
{
  "subtopic": "the subtopic you chose within the broad category (2-5 words)",
  "angle": "the specific angle or perspective on that subtopic (max 12 words)",
  "content": "the full newsletter text"
}`;

  const raw = await generateClaudeMessage(
    `You are a wellness content writer for ${hCtx.hospitalName}. Write in a ${tone} tone. You write detailed, helpful wellness newsletters that educate the community. Never mention diagnoses or specific patient cases. Write at a general public level. Always address recipients as "friends" — never use the word "patients". Always respond with valid JSON only — no markdown, no code fences, no extra text.`,
    userPrompt,
    1800,
  );

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as { subtopic: string; angle: string; content: string };
    if (typeof parsed.subtopic === "string" && typeof parsed.angle === "string" && typeof parsed.content === "string") {
      const content = parsed.content.trimStart();
      const greeting = "Dear Friends,";
      const finalContent = content.startsWith(greeting) ? content : `${greeting}\n\n${content}`;
      return { subtopic: parsed.subtopic, angle: parsed.angle, content: finalContent };
    }
  } catch {
    // fall through
  }

  return { subtopic: topic, angle: topic, content: raw };
}

export async function sendWellnessNewsletterEmails(
  hospitalId: number,
  newsletterContent: string,
  topic: string,
  youtubeLink: string | null,
  tiktokLink: string | null,
): Promise<{ sent: number; failed: number }> {
  const hCtx = await getHospitalContext(hospitalId);

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, email, stage")
    .eq("hospital_id", hCtx.hospitalCode)
    .in("stage", ["Post Treatment", "Active", "In Care", "Dormant"]);

  let sent = 0;
  let failed = 0;

  const formattedContent = newsletterContent.replace(/\n/g, "<br/>");
  let mediaSection = "";
  if (youtubeLink || tiktokLink) {
    mediaSection = `<div style="margin-top:20px;padding:16px;background:#1c2128;border-radius:8px;border:1px solid #30363d;">
      <p style="margin:0 0 8px;font-size:13px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">This Week's Wellness Video</p>
      ${youtubeLink ? `<p style="margin:4px 0"><a href="${youtubeLink}" style="color:#14b8a6;">▶ Watch on YouTube</a></p>` : ""}
      ${tiktokLink ? `<p style="margin:4px 0"><a href="${tiktokLink}" style="color:#14b8a6;">▶ Watch on TikTok</a></p>` : ""}
    </div>`;
  }

  for (const patient of patients ?? []) {
    const firstName = patient.first_name;
    if (!patient.email) continue;
    const ctx: AutomationContext = {
      hospitalId,
      patientId: patient.id as number,
      patientName: `${patient.first_name} ${patient.last_name}`,
      automationType: "wellness_newsletter",
      channel: "email",
    };
    const logId = await logAutomation(ctx, "queued");
    try {
      const html = wrapHtml(
        `<p style="font-size:13px;color:#8b949e;margin-bottom:16px;">Weekly Wellness — ${topic}</p>
         <div style="font-size:15px;line-height:1.8;color:#c9d1d9;">${formattedContent}</div>
         ${mediaSection}
         <p style="font-size:12px;color:#8b949e;margin-top:24px;border-top:1px solid #30363d;padding-top:16px;">This newsletter is for general wellness information only. Please do not reply to this email.</p>`,
        hCtx.hospitalName,
      );
      await sendEmail({
        to: patient.email as string,
        from: hCtx.fromAddress,
        subject: `Your weekly wellness update — ${hCtx.hospitalName}`,
        html,
        text: `Hi ${firstName},\n\n${newsletterContent}\n\nThis newsletter is for general wellness information only. Please do not reply to this email.\n\n${hCtx.hospitalName} Team`,
      });
      await updateAutomationLog(logId, "sent");
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? (err as Error).message : String(err);
      console.error("[sendWellnessNewsletterEmails] failed for patient", patient.id, ":", msg);
      await updateAutomationLog(logId, "failed", msg);
      failed++;
    }
  }

  return { sent, failed };
}

// ── Continuous In-Care AI Reminders — OpenAI — Email ─────────────────────────
// Runs 4 times daily (morning/afternoon/evening/night).
// Only fires for patients who have that time slot checked in their treatment plan.
// timingTypes: which types apply at this slot — e.g. ["med"] or ["hosp"] or ["med","hosp"]

export type InCareTimeSlot = "morning" | "afternoon" | "evening" | "night";

export async function sendInCareAIReminder(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  treatmentPlan: string,
  slot: InCareTimeSlot,
  timingTypes: Array<"med" | "hosp">,
  department?: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const deptLabel = department ?? "General Outpatient";
  const automationType = `in_care_reminder_${slot}_${deptLabel.replace(/\s+/g, "_").toLowerCase()}`;
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const tones = await (async () => {
      const { data } = await supabase.from("hospital_settings").select("tone").eq("hospital_id", hospitalId).single();
      return data?.tone ? (Array.isArray(data.tone) ? data.tone : JSON.parse(data.tone as string)) as string[] : [];
    })();
    const tone = buildToneDescription(tones);
    const contact = contactLine(hCtx.phoneNumber);
    const lang = hCtx.language ?? "English";

    const greetings: Record<InCareTimeSlot, string> = {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      night: "Good evening",
    };

    const hasMed = timingTypes.includes("med");
    const hasHosp = timingTypes.includes("hosp");
    const typeContext = hasMed && hasHosp
      ? `The patient has BOTH medication to take AND a ${deptLabel} clinic visit at this time — this reminder covers both.`
      : hasMed
        ? `The patient has medication to take at this time (home dose — they do NOT need to come in). This is from their ${deptLabel} care plan.`
        : `The patient has a ${deptLabel} clinic or hospital visit at this time.`;

    const slotContext: Record<InCareTimeSlot, string> = {
      morning: "It is morning — start of the day.",
      afternoon: "It is the afternoon.",
      evening: "It is the evening.",
      night: "It is night time — end of the day.",
    };

    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a care reminder email to a patient. Department: ${deptLabel}. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. Start with "Hi ${firstName},". Read and understand the care plan details first, then write 2–3 warm, specific sentences about what the patient needs to do right now — in very simple, clear language anyone can understand. Always mention the department (${deptLabel}). Never use clinical jargon. End with: "If you have any concerns please ${contact}. Please do not reply to this email directly. — ${hCtx.hospitalName} Team"`,
      `${slotContext[slot]}\n${typeContext}\n\nCare plan details (read and understand before writing): ${treatmentPlan.slice(0, 600)}\n\nWrite a short, warm care reminder email for ${firstName}.`,
      230,
    );

    const html = wrapHtml(
      `<p>${message.replace(/\n/g, "</p><p>")}</p>`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject: `${greetings[slot]}, ${firstName} — ${deptLabel} reminder — ${hCtx.hospitalName}`,
      html,
      text: message,
    });

    await updateAutomationLog(logId, "sent", `In-care ${slot} reminder (${deptLabel}) → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendInCareAIReminder] failed:", msg, { hospitalId, patientId, patientEmail, slot, deptLabel });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

