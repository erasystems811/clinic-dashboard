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

interface HospitalContext {
  hospitalName: string;
  hospitalUsername: string;
  sendingEmail: string;
  notificationChannel: "whatsapp" | "sms";
  phoneNumber: string | null;
  termiiSenderId: string | null;
}

async function getHospitalContext(hospitalId: number): Promise<HospitalContext> {
  const [{ data: hospital }, { data: settings }] = await Promise.all([
    supabase.from("hospitals").select("id, name, username").eq("id", hospitalId).single(),
    supabase.from("hospital_settings")
      .select("sending_email, notification_channel, phone_number, tone, termii_sender_id")
      .eq("hospital_id", hospitalId).single(),
  ]);
  return {
    hospitalName: hospital?.name ?? "The Hospital",
    hospitalUsername: hospital?.username ?? "",
    sendingEmail: settings?.sending_email ?? "onboarding@resend.dev",
    notificationChannel: (settings?.notification_channel as "whatsapp" | "sms") ?? "whatsapp",
    phoneNumber: (settings?.phone_number as string) ?? null,
    termiiSenderId: (settings?.termii_sender_id as string) ?? null,
  };
}

function contactLine(phoneNumber: string | null): string {
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
    const message = `Hi ${patientName}, welcome to ${hCtx.hospitalName}! You are currently number ${position} in the queue. We appreciate your patience and will keep you updated. Thank you for choosing us.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    const message = `Hi ${patientName}, it is your turn now at ${hCtx.hospitalName}. Please proceed, We are ready for you.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    const message = `Hi ${patientName}, your care plan at ${hCtx.hospitalName} has started. Please check your email for your full care plan details and your daily care reminders. We are with you every step of the way.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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

    const emailBody = await generateOpenAIMessage(
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
      from: hCtx.sendingEmail,
      subject: `Your care plan has started — ${hCtx.hospitalName}`,
      html,
      text: emailBody,
    });

    await updateAutomationLog(logId, "sent", `Care plan email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      body = `Hi ${patientName},\n\nWe hope you are resting and taking things easy today. Your treatment at ${hCtx.hospitalName} has just concluded and we wanted to reach out on this first day to let you know we are thinking of you. Recovery takes time and that is completely okay. Please take care of yourself.\n\nIf you have any questions or concerns please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    } else if (day === 4) {
      subject = `How are you feeling? — ${hCtx.hospitalName}`;
      body = `Hi ${patientName},\n\nIt has been a few days since your treatment at ${hCtx.hospitalName} and we just wanted to check in on you. We hope you are feeling a little better each day. Recovery is a journey and we want you to know we are rooting for you.\n\nIf anything feels off or you have any concerns at all please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nTake good care of yourself.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    } else {
      subject = `One week check-in — ${hCtx.hospitalName}`;
      body = `Hi ${patientName},\n\nA week has passed since your treatment at ${hCtx.hospitalName} and we hope you are feeling much better. You have come a long way and we are proud of your progress.\n\nIf you need anything at all please do not hesitate to ${contact}. Please do not reply to this email directly. We are always here for you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    }

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Post-treatment Day ${day} email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Post-care email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Dormant — Email — Templated — after 250 days inactivity ──────────────────

export async function sendDormantEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "dormant_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `Just saying hi — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nIt has been a while since we last saw you at ${hCtx.hospitalName} and honestly that could be really good news — it might mean you have been staying healthy and feeling well. We just wanted to pop in and say hi and let you know we are thinking of you. We hope you are taking care of yourself and staying on top of your health.\n\nWhenever you need us we are right here. Please do not reply to this email directly — to reach us please ${contact}.\n\nTake good care of yourself.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Dormant email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Appointment confirmation → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Appointment reminder (${hoursAway}h) → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    const body = `Hi ${patientName},\n\nWe noticed you were not able to make your appointment at ${hCtx.hospitalName} today. We hope you are doing good?\n\nIf you want to rebook please do not hesitate to ${contact}. Please do not reply to this email directly. We are here for you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `No-show email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
  _feedbackToken: string,
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
    const intro = `Hi ${patientName},\n\nThank you for visiting ${hCtx.hospitalName} today. We hope your experience was a positive one. We would love to hear your thoughts so we can continue to improve our service. Please take a moment to share your feedback using the link below.`;
    const closing = `Your feedback means a lot to us. Please do not reply to this email directly — if you need to reach us please ${contact}.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(
      `<p>${intro.replace(/\n/g, "</p><p>")}</p>
       <p style="text-align:center"><a href="${feedbackUrl}" class="btn">Share Your Feedback →</a></p>
       <p style="font-size:13px;color:#8b949e;text-align:center">This link is unique to you and expires after submission.</p>
       <p>${closing.replace(/\n/g, "</p><p>")}</p>`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.sendingEmail,
      subject,
      html,
      text: `${intro}\n\nShare your feedback: ${feedbackUrl}\n\n${closing}`,
    });

    await updateAutomationLog(logId, "sent", `Feedback email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
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
    `You are a care team member at ${hCtx.hospitalName} reaching out to a patient via ${hCtx.notificationChannel === "sms" ? "SMS" : "WhatsApp"}. Tone: ${tone}. Start with "Hi ${firstName},". Read the reason carefully and choose the right tone — gentle if sensitive, encouraging if they need support, friendly if it is a simple check-in. Write like a real, caring person. Never sound automated. End with a closed statement — tell the patient not to reply to this message and to ${contact} if they have any questions.`,
    `You need to contact ${firstName} because: "${flagReason}". Write a warm, human message appropriate to this exact situation. Match your tone to the reason — be caring and specific, not generic. 2-4 sentences, genuine and human.`,
    180,
  );
  return message;
}

export async function sendCallTaskConfirmedMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  message: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "call_task_automated",
    channel: hCtx.notificationChannel,
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      from: hCtx.sendingEmail,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Manual email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
    .eq("hospital_id", hCtx.hospitalUsername)
    .in("stage", ["Post Treatment", "Post Care", "Dormant", "In Care", "Booked", "Queued"]);

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
        from: hCtx.sendingEmail,
        subject: `Your weekly wellness update — ${hCtx.hospitalName}`,
        html,
        text: `Hi ${firstName},\n\n${newsletterContent}\n\nThis newsletter is for general wellness information only. Please do not reply to this email.\n\n${hCtx.hospitalName} Team`,
      });
      await updateAutomationLog(logId, "sent");
      sent++;
    } catch {
      await updateAutomationLog(logId, "failed");
      failed++;
    }
  }

  return { sent, failed };
}
