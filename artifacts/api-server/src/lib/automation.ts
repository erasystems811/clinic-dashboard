import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import { generateOpenAIMessage, generateClaudeMessage, buildToneDescription } from "./ai.js";
import { sendEmail, wrapHtml } from "./email.js";
import { deliverMobileMessage } from "./messaging.js";
import { deductSmsFromWallet, hasSufficientSmsBalance } from "./wallet.js";
import { signFeedbackToken } from "./feedbackToken.js";

export type AutomationChannel = "whatsapp" | "sms" | "email";
export type AutomationStatus = "queued" | "sent" | "failed";

// ── ERA App dual-delivery helpers ─────────────────────────────────────────────
// Called alongside email/SMS for patients who have the ERA app connected.
// All helpers are non-fatal — a failure here must never block the main delivery.

function stripEmailLine(text: string): string {
  return text
    .replace(/Please do not reply to this (email|message) directly\.?/gi, "")
    .replace(/If you have any questions[^.\n]*\.?[^\n]*/gi, "")
    .replace(/Do not hesitate to (reach out|contact)[^.\n]*\.?[^\n]*/gi, "")
    .replace(/Feel free to (contact|reach out)[^.\n]*\.?[^\n]*/gi, "")
    .replace(/\nWarm regards[,.][\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function pushEraNotification(
  patientId: number, hospitalId: number,
  type: string, title: string, notifBody: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { data: conn } = await supabase
    .from("patient_hospital_connections")
    .select("account_id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (!conn) return;
  await supabase.from("patient_notifications").insert({
    account_id: conn.account_id as number,
    type,
    title,
    body: notifBody,
    metadata,
  });
}

async function pushEraChatMessage(
  patientId: number, hospitalId: number,
  content: string,
): Promise<void> {
  const { data: conn, error: connErr } = await supabase
    .from("patient_hospital_connections")
    .select("id")
    .eq("patient_record_id", patientId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
  if (connErr) console.error("[pushEraChatMessage] connection lookup error:", connErr.message, { patientId, hospitalId });
  if (!conn) { console.warn("[pushEraChatMessage] no connection found", { patientId, hospitalId }); return; }
  const { error: insertErr } = await supabase.from("patient_hospital_messages").insert({
    connection_id: conn.id as number,
    sender: "hospital",
    message_type: "text",
    content,
    metadata: {},
  });
  if (insertErr) console.error("[pushEraChatMessage] insert error:", insertErr.message, { connectionId: conn.id });
}

async function setPatientDndBlocked(patientId: number, blocked: boolean): Promise<void> {
  await supabase.from("patients").update({ dnd_blocked: blocked }).eq("id", patientId);
}

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
  /** Communication tone tags — e.g. ["Warm", "Empathetic"]. Empty array = default warm/professional. */
  tone: string[];
  /** Short description of the clinic — used to personalise AI-generated messages. Null if not set. */
  clinicDescription: string | null;
  /** True when the hospital is suspended. Send functions must log as "sent" (dedup) but not deliver. */
  suspended: boolean;
  /** True when the Queue + Feedback module is enabled for this hospital. */
  feedbackEnabled: boolean;
  /** Hospital booking slug — used to build public booking link in patient emails. Null if not configured. */
  slug: string | null;
  /** Hospital admin contact email — used to notify about configuration issues. */
  contactEmail: string | null;
  /** Whether the Termii Sender ID has been approved by Termii (set by super admin). */
  senderIdApproved: boolean;
}

export async function getHospitalContext(hospitalId: number): Promise<HospitalContext> {
  const [{ data: hospital }, { data: settings }, { data: mods }] = await Promise.all([
    supabase.from("hospitals").select("id, name, username, hospital_code, slug, active").eq("id", hospitalId).single(),
    supabase.from("hospital_settings")
      .select("sender_name, notification_channel, phone_number, tone, termii_sender_id, sms_sender_id_approved, language, clinic_description")
      .eq("hospital_id", hospitalId).maybeSingle(),
    supabase.from("hospital_modules").select("feedback_enabled, wellness_newsletter_enabled").eq("hospital_id", hospitalId).maybeSingle(),
  ]);
  const suspended = hospital?.active === false;
  const hospitalName = hospital?.name ?? "The Hospital";
  const displayName = (settings?.sender_name as string | null)?.trim() || hospitalName;
  const rawEmail = process.env.PLATFORM_FROM_EMAIL || "onboarding@resend.dev";
  const fromAddress = `${displayName} <${rawEmail}>`;
  const rawTone = settings?.tone;
  const tone: string[] = rawTone
    ? (Array.isArray(rawTone)
        ? rawTone as string[]
        : (() => { try { return JSON.parse(rawTone as string) as string[]; } catch { return [String(rawTone)]; } })())
    : [];
  return {
    hospitalName,
    hospitalUsername: hospital?.username ?? "",
    hospitalCode: (hospital?.hospital_code as string) ?? "",
    fromAddress,
    notificationChannel: (settings?.notification_channel as "whatsapp" | "sms") ?? "sms",
    phoneNumber: (settings?.phone_number as string) ?? null,
    termiiSenderId: (settings?.termii_sender_id as string) ?? null,
    senderIdApproved: (settings?.sms_sender_id_approved as boolean | null) ?? false,
    language: (settings?.language as string | null) ?? null,
    tone,
    clinicDescription: (settings?.clinic_description as string | null) ?? null,
    suspended,
    feedbackEnabled: mods?.feedback_enabled !== false,
    slug: (hospital?.slug as string | null) ?? null,
    contactEmail: null,
  };
}

/**
 * When a hospital is suspended, log the automation as "sent" (so dedup fires on re-activation)
 * without delivering anything. Returns true if the caller should return early.
 */
async function skipIfSuspended(hCtx: HospitalContext, ctx: AutomationContext): Promise<boolean> {
  if (!hCtx.suspended) return false;
  await logAutomation(ctx, "sent", "[hospital suspended — not delivered]");
  return true;
}

async function skipIfQueueModuleDisabled(hCtx: HospitalContext, ctx: AutomationContext): Promise<boolean> {
  if (hCtx.feedbackEnabled) return false;
  await logAutomation(ctx, "sent", "[queue+feedback module disabled — not delivered]");
  return true;
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  if (await skipIfQueueModuleDisabled(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, welcome to ${hCtx.hospitalName}. You've been checked in and you're currently number ${String(position).padStart(3, "0")} in the queue. Our team is working as quickly as possible and we'll keep you updated every step of the way. Please relax and make yourself comfortable. Thank you for trusting us with your care.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId, smsChannel: "dnd" });
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  if (await skipIfQueueModuleDisabled(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, you are next in line at ${hCtx.hospitalName}. Please be ready — you will be called in shortly. Thank you for your patience.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId, smsChannel: "dnd" });
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  if (await skipIfQueueModuleDisabled(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, it is your turn now at ${hCtx.hospitalName}. Please proceed, we are ready for you.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId, smsChannel: "dnd" });
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  if (await skipIfQueueModuleDisabled(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const message = `Hi ${patientName}, we sincerely apologise for the longer than usual wait today at ${hCtx.hospitalName}. We are doing our best to attend to everyone as quickly as possible and we truly appreciate your patience. Thank you for being with us.`;
    await deliverMobileMessage(hCtx.notificationChannel, phone, message, { senderId: hCtx.termiiSenderId, smsChannel: "dnd" });
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
  if (await skipIfSuspended(hCtx, ctx)) return;
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const tone = buildToneDescription(hCtx.tone);
    const lang = hCtx.language ?? "English";

    const emailBody = await generateClaudeMessage(
      `You are writing a care plan explanation email for a patient of ${hCtx.hospitalName}. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. NEVER say you are happy, glad, pleased, or excited to see the patient or that they are visiting — focus on care and support instead. NEVER express that you are glad, happy, pleased, or fortunate that the patient is unwell or receiving treatment — it is not appropriate to be glad someone is sick. Instead, thank the patient for choosing ${hCtx.hospitalName} and assure them they will receive the very best possible care. Never use clinical jargon. Never mention a diagnosis. Explain what the plan means in simple terms. Keep it under 200 words of body text. End with a closed statement — make clear the patient does not need to reply to this email and should ${contactLine(hCtx.phoneNumber)} if they have questions.`,
      `Write a ${tone} email explaining ${firstName}'s care plan at ${hCtx.hospitalName}. Thank them for choosing ${hCtx.hospitalName} and assure them of the best possible care. Treatment type: ${treatmentType}. Duration: ${durationDays} days. Care plan details: ${treatmentPlan}. Explain what this means for the patient in plain, reassuring language — what they can expect, how the team will support them, and what they should do. End with: "If you have any questions please do not hesitate to ${contactLine(hCtx.phoneNumber)}. Please do not reply to this email directly. Warm regards, ${hCtx.hospitalName} Team."`,
      350,
    );

    const html = wrapHtml(
      `<p>${emailBody.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
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
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(emailBody)); } catch { /* non-fatal */ }
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
  const automationType = `post_treatment_patient${patientId}_day${day}`;
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
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

    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book a follow-up appointment online →</a></p>` : "";
    const textBody = bookingUrl ? `${body}\n\nBook a follow-up appointment online: ${bookingUrl}` : body;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: textBody,
    });

    await updateAutomationLog(logId, "sent", `Post-treatment Day ${day} email → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `Thinking of you — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nIt has been a little while since we last saw you at ${hCtx.hospitalName} and we just wanted to check in and see how you are doing. We hope you are feeling well and taking good care of yourself. Your health and wellbeing mean a lot to us.\n\nIf you ever need anything or feel it is time for a check-up please do not hesitate to ${contact}. Please do not reply to this email directly. We are always here when you need us.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book a check-up appointment online →</a></p>` : "";
    const textBody = bookingUrl ? `${body}\n\nBook a check-up appointment online: ${bookingUrl}` : body;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: textBody,
    });

    await updateAutomationLog(logId, "sent", `Post-care email → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
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
): Promise<{ dndBlocked: boolean }> {
  const hCtx = await getHospitalContext(hospitalId);

  const { data: modules } = await supabase.from("hospital_modules").select("appointment_reminder_sms_enabled").eq("hospital_id", hospitalId).maybeSingle();
  const smsFlipEnabled = (modules?.appointment_reminder_sms_enabled as boolean | null) ?? false;
  let useSms = false;
  if (smsFlipEnabled) {
    const smsReady = !!hCtx.termiiSenderId && hCtx.senderIdApproved;
    if (smsReady) useSms = await hasSufficientSmsBalance(hospitalId);
  }

  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_confirmation",
    channel: useSms ? "sms" : "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return { dndBlocked: false };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });

    if (useSms) {
      const { data: patient } = await supabase.from("patients").select("phone").eq("id", patientId).maybeSingle();
      const phone = patient?.phone as string | null;
      if (phone) {
        try {
          const smsBody = `Hi ${patientName}, your appointment at ${hCtx.hospitalName} is confirmed for ${dateStr}. Please arrive a few minutes early. To reschedule call ${hCtx.phoneNumber ?? hCtx.hospitalName}.`;
          await deliverMobileMessage("sms", phone, smsBody, { senderId: hCtx.termiiSenderId });
          await deductSmsFromWallet(hospitalId, `Appointment confirmation SMS — ${patientName}`);
          await setPatientDndBlocked(patientId, false);
          await updateAutomationLog(logId, "sent", `Appointment confirmation SMS → ${phone}`);
          try { await pushEraChatMessage(patientId, hospitalId, smsBody); } catch { /* non-fatal */ }
          try { await pushEraNotification(patientId, hospitalId, "appointment_confirmed", `Appointment Confirmed — ${hCtx.hospitalName}`, `Your appointment at ${hCtx.hospitalName} is confirmed for ${dateStr}.`, { hospitalId, hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
          return { dndBlocked: false };
        } catch (smsErr) {
          const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr);
          if (smsMsg.startsWith("DND_BLOCKED:")) {
            await setPatientDndBlocked(patientId, true);
            await updateAutomationLog(logId, "failed", smsMsg);
            return { dndBlocked: true };
          }
          // Non-DND SMS error — update log channel before falling through to email
          await supabase.from("automation_log").update({ channel: "email" }).eq("id", logId);
        }
      }
    }

    const subject = `Appointment Confirmed — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nYour appointment at ${hCtx.hospitalName} has been confirmed for ${dateStr}. Please arrive a few minutes early.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly. We look forward to seeing you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Need to reschedule? Book online →</a></p>` : "";
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: bookingUrl ? `${body}\n\nNeed to reschedule? Book online: ${bookingUrl}` : body });
    await updateAutomationLog(logId, "sent", `Appointment confirmation → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
    try { await pushEraNotification(patientId, hospitalId, "appointment_confirmed", `Appointment Confirmed — ${hCtx.hospitalName}`, `Your appointment at ${hCtx.hospitalName} is confirmed for ${dateStr}.`, { hospitalId, hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
    return { dndBlocked: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendAppointmentConfirmationEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    return { dndBlocked: false };
  }
}

export async function sendAppointmentRescheduleEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  scheduledAt: string,
): Promise<{ dndBlocked: boolean }> {
  const hCtx = await getHospitalContext(hospitalId);

  const { data: modules } = await supabase.from("hospital_modules").select("appointment_reminder_sms_enabled").eq("hospital_id", hospitalId).maybeSingle();
  const smsFlipEnabled = (modules?.appointment_reminder_sms_enabled as boolean | null) ?? false;
  let useSms = false;
  if (smsFlipEnabled) {
    const smsReady = !!hCtx.termiiSenderId && hCtx.senderIdApproved;
    if (smsReady) useSms = await hasSufficientSmsBalance(hospitalId);
  }

  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_rescheduled_email",
    channel: useSms ? "sms" : "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return { dndBlocked: false };
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });

    if (useSms) {
      const { data: patient } = await supabase.from("patients").select("phone").eq("id", patientId).maybeSingle();
      const phone = patient?.phone as string | null;
      if (phone) {
        try {
          const smsBody = `Hi ${patientName}, your appointment at ${hCtx.hospitalName} has been rescheduled to ${dateStr}. To make further changes call ${hCtx.phoneNumber ?? hCtx.hospitalName}.`;
          await deliverMobileMessage("sms", phone, smsBody, { senderId: hCtx.termiiSenderId });
          await deductSmsFromWallet(hospitalId, `Appointment reschedule SMS — ${patientName}`);
          await setPatientDndBlocked(patientId, false);
          await updateAutomationLog(logId, "sent", `Appointment reschedule SMS → ${phone}`);
          try { await pushEraChatMessage(patientId, hospitalId, smsBody); } catch { /* non-fatal */ }
          try { await pushEraNotification(patientId, hospitalId, "appointment_rescheduled", `Appointment Rescheduled — ${hCtx.hospitalName}`, `Your appointment at ${hCtx.hospitalName} has been rescheduled to ${dateStr}.`, { hospitalId, hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
          return { dndBlocked: false };
        } catch (smsErr) {
          const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr);
          if (smsMsg.startsWith("DND_BLOCKED:")) {
            await setPatientDndBlocked(patientId, true);
            await updateAutomationLog(logId, "failed", smsMsg);
            return { dndBlocked: true };
          }
          // Non-DND SMS error — update log channel before falling through to email
          await supabase.from("automation_log").update({ channel: "email" }).eq("id", logId);
        }
      }
    }

    const subject = `Appointment Rescheduled — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nWe would like to let you know that your appointment at ${hCtx.hospitalName} has been rescheduled to ${dateStr}. Please take note of the new date and time and plan accordingly.\n\nIf you have any questions or need to make further changes please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly. We look forward to seeing you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Need to make another change? Book online →</a></p>` : "";
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: bookingUrl ? `${body}\n\nNeed to make another change? Book online: ${bookingUrl}` : body });
    await updateAutomationLog(logId, "sent", `Appointment reschedule confirmation → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
    try { await pushEraNotification(patientId, hospitalId, "appointment_rescheduled", `Appointment Rescheduled — ${hCtx.hospitalName}`, `Your appointment at ${hCtx.hospitalName} has been rescheduled to ${dateStr}.`, { hospitalId, hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
    return { dndBlocked: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendAppointmentRescheduleEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    return { dndBlocked: false };
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

  // Check if SMS flip is enabled for this hospital
  const { data: modules } = await supabase.from("hospital_modules").select("appointment_reminder_sms_enabled").eq("hospital_id", hospitalId).maybeSingle();
  const smsFlipEnabled = (modules?.appointment_reminder_sms_enabled as boolean | null) ?? false;

  let useSms = false;
  if (smsFlipEnabled) {
    const smsReady = !!hCtx.termiiSenderId && hCtx.senderIdApproved;
    if (!smsReady) {
      console.log(`[sendAppointmentReminderEmail] No Termii sender ID configured — falling back to email for hospital ${hospitalId}`);
    } else {
      useSms = await hasSufficientSmsBalance(hospitalId);
      if (!useSms) console.log(`[sendAppointmentReminderEmail] Insufficient wallet — falling back to email for hospital ${hospitalId}`);
    }
  }

  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: useSms ? "sms" : "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });
    const timeStr = new Date(scheduledAt).toLocaleString("en-GB", { timeStyle: "short", timeZone: "Africa/Lagos" });

    if (useSms) {
      const { data: patient } = await supabase.from("patients").select("phone").eq("id", patientId).maybeSingle();
      const phone = patient?.phone as string | null;
      if (!phone) throw new Error("Patient has no phone number for SMS");
      const smsBody = hoursAway === 24
        ? `Hi ${patientName}, reminder: your appointment at ${hCtx.hospitalName} is tomorrow ${dateStr}. To reschedule call ${hCtx.phoneNumber ?? hCtx.hospitalName}.`
        : `Hi ${patientName}, your appointment at ${hCtx.hospitalName} is in 2 hours at ${timeStr}. To reschedule call ${hCtx.phoneNumber ?? hCtx.hospitalName} immediately.`;
      try {
        await deliverMobileMessage("sms", phone, smsBody, { senderId: hCtx.termiiSenderId });
        await deductSmsFromWallet(hospitalId, `Appointment reminder SMS (${hoursAway}h) — ${patientName}`);
        await setPatientDndBlocked(patientId, false);
        await updateAutomationLog(logId, "sent", `Appointment reminder SMS (${hoursAway}h) → ${phone}`);
        try { await pushEraChatMessage(patientId, hospitalId, smsBody); } catch { /* non-fatal */ }
        return;
      } catch (smsErr) {
        const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr);
        if (smsMsg.startsWith("DND_BLOCKED:")) {
          await setPatientDndBlocked(patientId, true);
          // Update log channel before falling through to email
          await supabase.from("automation_log").update({ channel: "email" }).eq("id", logId);
          console.log(`[sendAppointmentReminderEmail] DND blocked for ${phone} — falling back to email for hospital ${hospitalId}`);
        } else {
          throw smsErr;
        }
      }
    }

    const body = hoursAway === 24
      ? `Hi ${patientName},\n\nThis is a friendly reminder that your appointment at ${hCtx.hospitalName} is tomorrow ${dateStr}. We look forward to seeing you.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`
      : `Hi ${patientName},\n\nJust a quick reminder that your appointment at ${hCtx.hospitalName} is in 2 hours at ${timeStr}. We will see you soon.\n\nIf you need to reschedule please do not hesitate to ${contact} immediately. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const subject = hoursAway === 24
      ? `Reminder — Your appointment is tomorrow — ${hCtx.hospitalName}`
      : `Your appointment is in 2 hours — ${hCtx.hospitalName}`;
    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hoursAway === 24 && hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Need to reschedule? Book online →</a></p>` : "";
    const textBody = bookingUrl ? `${body}\n\nNeed to reschedule? Book online: ${bookingUrl}` : body;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: textBody });
    await updateAutomationLog(logId, "sent", `Appointment reminder (${hoursAway}h) → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
    try { await pushEraNotification(patientId, hospitalId, "appointment_reminder", subject, `Your appointment at ${hCtx.hospitalName} is ${hoursAway === 24 ? "tomorrow" : "in 2 hours"}.`, { hospitalId, hospitalName: hCtx.hospitalName, hoursAway }); } catch { /* non-fatal */ }
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `We are worried about you — ${hCtx.hospitalName}`;
    const body = `Hi ${patientName},\n\nWe noticed you were not able to make your appointment at ${hCtx.hospitalName} today and we just wanted to check in to make sure you are okay. Your health and wellbeing are always our priority and we care about you.\n\nWhenever you are ready to rebook or if you need anything at all please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Ready to rebook? Book online →</a></p>` : "";
    const textBody = bookingUrl ? `${body}\n\nReady to rebook? Book online: ${bookingUrl}` : body;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: textBody,
    });

    await updateAutomationLog(logId, "sent", `No-show email → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
    try { await pushEraNotification(patientId, hospitalId, "appointment_reminder", subject, `${hCtx.hospitalName} noticed you missed your appointment and is checking in on you.`, { hospitalId, hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const contact = contactLine(hCtx.phoneNumber);
    const subject = `How was your visit? — ${hCtx.hospitalName}`;
    const intro = `Hi ${patientName},\n\nThank you for visiting ${hCtx.hospitalName} yesterday. We hope your experience was a positive one. We would love to hear your thoughts so we can continue to improve our service. Please take a moment to share your feedback using the link below.`;
    const closing = `Your feedback means a lot to us. Please do not reply to this email directly — if you need to reach us please ${contact}.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:16px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book your next appointment online →</a></p>` : "";
    const toParagraphs = (text: string) =>
      text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

    const html = wrapHtml(
      `${toParagraphs(intro)}
       <p style="text-align:center"><a href="${feedbackUrl}" class="btn">Share Your Feedback →</a></p>
       ${toParagraphs(closing)}${bookingHtml}`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: bookingUrl ? `${intro}\n\nShare your feedback: ${feedbackUrl}\n\n${closing}\n\nBook your next appointment online: ${bookingUrl}` : `${intro}\n\nShare your feedback: ${feedbackUrl}\n\n${closing}`,
    });

    await updateAutomationLog(logId, "sent", `Feedback email → ${patientEmail}`);

    // Also push an in-app notification if this patient has a connected ERA account
    try {
      const { data: conn } = await supabase
        .from("patient_hospital_connections")
        .select("account_id")
        .eq("patient_record_id", patientId)
        .eq("hospital_id", hospitalId)
        .maybeSingle();

      if (conn) {
        const token = signFeedbackToken(patientId, hospitalId);
        await supabase.from("patient_notifications").insert({
          account_id: conn.account_id,
          type: "feedback_request",
          title: "Share your experience",
          body: `${hCtx.hospitalName} would like to hear about your recent visit.`,
          metadata: { token, hospitalId, patientId, hospitalName: hCtx.hospitalName },
        });
      }
    } catch {
      // Non-fatal — ERA notification is a bonus alongside the email
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendFeedbackEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    // Do NOT re-throw — caller iterates over multiple patients; one failure must not abort the rest.
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const tone = buildToneDescription(hCtx.tone);
    const lang = hCtx.language ?? "English";

    const clinicContext = hCtx.clinicDescription
      ? `About ${hCtx.hospitalName}: ${hCtx.clinicDescription}. Let this shape the personality and voice of the email — a cardiology clinic writes differently from a dental practice or a general hospital.`
      : "";
    const body = await generateClaudeMessage(
      `You are writing a birthday email on behalf of ${hCtx.hospitalName} to a patient. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. ${clinicContext} Write something genuinely warm, memorable, and a little creative — this is someone's birthday and you want them to smile when they read it and remember that ${hCtx.hospitalName} truly cares about them. Every hospital's email should have its own distinct personality shaped by its tone and type of clinic. STRICT RULES: (1) Never reference age, milestones, getting older, or how many years have passed. (2) Never reference religion, God, prayers, or any spiritual practice. (3) Never reference tribe, ethnicity, culture, or traditions. (4) Never assume gender — use gender-neutral language throughout, never say he/she/his/her. (5) Do NOT highlight or invent personal traits about the person — the hospital does not know them personally. (6) Never say you are happy or glad the patient is a patient. STRUCTURE — exactly 3 to 4 paragraphs: (1) A warm, enthusiastic birthday opening that makes ${firstName} feel genuinely celebrated and special to the ${hCtx.hospitalName} team — express that they matter and that the whole team is thinking of them today. (2) A heartfelt paragraph about how ${hCtx.hospitalName} is committed to always being there for them, always giving their best, and how the biggest wish for ${firstName} today is truly good health — write this with genuine warmth, not like a sales pitch. (3) One lighthearted, slightly funny health-related birthday tip — keep it playful and gentle, something creative and fun that fits the personality of ${hCtx.hospitalName} — make it feel like a joke from a caring friend, not a lecture. (4) A warm, genuine closing that feels personal and sends them off with a smile. End with a sign-off from the ${hCtx.hospitalName} Team. Do not add contact lines or "please do not reply".`,
      `Write a warm, creative, memorable birthday email for ${firstName} from ${hCtx.hospitalName}. 3-4 paragraphs. Celebrate them, express genuine care, wish them good health, include one light funny health tip that matches this clinic's personality. Make it feel real, human, and unique to ${hCtx.hospitalName}.`,
      420,
    );

    const subject = `Happy Birthday from ${hCtx.hospitalName} 🎂`;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Birthday email → ${patientEmail}`);
    try { await pushEraNotification(patientId, hospitalId, "birthday", "Happy Birthday! 🎂", `${hCtx.hospitalName} sent you a birthday message.`, { hospitalName: hCtx.hospitalName }); } catch { /* non-fatal */ }
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
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued", dedupeKey);
  try {
    const firstName = patientName.split(" ")[0];
    const formatted = new Date(visitDate).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = visitTime ? ` at ${visitTime}` : "";
    const lang = hCtx.language ?? "English";
    const contact = contactLine(hCtx.phoneNumber);

    const tone = buildToneDescription(hCtx.tone);

    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a visit reminder email. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. NEVER say you are happy, glad, pleased, or excited to see the patient or that they are visiting — focus on care and support instead. NEVER express gladness or happiness that the patient is unwell — thank them for choosing ${hCtx.hospitalName} and assure them of the best possible care. Start with "Hi ${firstName},". Write 2–3 warm sentences reminding the patient about their upcoming ${department} appointment. Read and understand the care plan details before writing — then explain to the patient in very simple, clear words what they need to know for this visit. Mention the specific department (${department}). End with: "If you have any questions please ${contact}. Please do not reply to this email directly. Warm regards, ${hCtx.hospitalName} Team"`,
      `Department: ${department}\nAppointment: ${formatted}${timeStr}\nCare plan details (read and understand before writing): ${visitDescription.slice(0, 500)}`,
      280,
    );

    const subject = `${department} appointment reminder — ${formatted} — ${hCtx.hospitalName}`;
    const appUrl2 = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl2 = hCtx.slug ? `${appUrl2}/book/${hCtx.slug}` : null;
    const bookingHtml2 = bookingUrl2 ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl2}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book an appointment online →</a></p>` : "";
    const html = wrapHtml(`<p>${message.replace(/\n/g, "</p><p>")}</p>${bookingHtml2}`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: bookingUrl2 ? `${message}\n\nBook an appointment online: ${bookingUrl2}` : message });
    await updateAutomationLog(logId, "sent");
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(message)); } catch { /* non-fatal */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCareVisitReminderEmail] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Return Visit Reminder — 24h and 3h before the visit ──────────────────────

export async function sendReturnVisitReminderEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  visitDate: string,
  visitTime: string | null,
  reason: string,
  hoursUntil: 24 | 3,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const automationType = hoursUntil === 24 ? "return_visit_reminder_24h" : "return_visit_reminder_3h";
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const formatted = new Date(visitDate + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = visitTime ? ` at ${visitTime}` : "";
    const contact = contactLine(hCtx.phoneNumber);
    const whenPhrase = hoursUntil === 24 ? "tomorrow" : "in about 3 hours";
    const body = `Hi ${firstName},\n\nThis is a friendly reminder that you have a return visit scheduled at ${hCtx.hospitalName} ${whenPhrase} — ${formatted}${timeStr}.\n\nReason: ${reason}\n\nPlease make sure you are available. If you need to reschedule please ${contact} as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    const subject = `Return visit reminder — ${formatted} — ${hCtx.hospitalName}`;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: body });
    await updateAutomationLog(logId, "sent", `Return visit reminder (${hoursUntil}h) → ${patientEmail}`);
    try {
      await pushEraNotification(patientId, hospitalId, "return_visit_reminder",
        `Return visit ${whenPhrase} — ${hCtx.hospitalName}`,
        `You have a visit scheduled at ${hCtx.hospitalName} ${whenPhrase}${timeStr}. Reason: ${reason}`,
        { hospitalId, visitDate, visitTime },
      );
    } catch { /* non-fatal */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendReturnVisitReminderEmail] failed:", msg, { hospitalId, patientId, patientEmail });
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
  const tone = buildToneDescription(hCtx.tone);
  const contact = contactLine(hCtx.phoneNumber);

  const message = await generateOpenAIMessage(
    `You are a care team member at ${hCtx.hospitalName} reaching out to a patient via text message. Tone: ${tone}. Start with "Hi ${firstName},". Read the reason carefully and write a message that directly addresses that specific situation — gentle if sensitive, encouraging if they need support, friendly if it is a routine check-in. Write like a real, caring person. Never sound automated or generic. End by telling the patient to ${contact} if they have any questions. IMPORTANT: If the reason is unclear, too vague, or you cannot understand what situation it refers to, reply with exactly this and nothing else: "I could not understand the reason provided. Please write the message manually."`,
    `You need to contact ${firstName} because: "${flagReason}". Write a warm, specific message addressing this exact reason. 2-4 sentences.`,
    200,
  );
  return message;
}

// Receptionist reviews/edits the AI draft, then sends it as an Important email (or SMS if wallet funded).
export async function sendCallTaskConfirmedMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  message: string,
): Promise<{ sentViaSms: boolean; insufficientFunds: boolean; senderIdMissing: boolean; dndBlocked: boolean }> {
  const hCtx = await getHospitalContext(hospitalId);

  const { data: modules } = await supabase.from("hospital_modules").select("call_task_sms_enabled").eq("hospital_id", hospitalId).maybeSingle();
  const smsFlipEnabled = (modules?.call_task_sms_enabled as boolean | null) ?? false;

  let useSms = false;
  let insufficientFunds = false;
  let senderIdMissing = false;
  if (smsFlipEnabled) {
    const smsReady = !!process.env.AFRICAS_TALKING_API_KEY || (!!hCtx.termiiSenderId && hCtx.senderIdApproved);
    if (!smsReady) {
      senderIdMissing = true;
    } else {
      useSms = await hasSufficientSmsBalance(hospitalId);
      insufficientFunds = !useSms;
      if (!useSms) console.log(`[sendCallTaskConfirmedMessage] Insufficient wallet — falling back to email for hospital ${hospitalId}`);
    }
  }

  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "call_task_automated",
    channel: useSms ? "sms" : "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return { sentViaSms: false, insufficientFunds, senderIdMissing, dndBlocked: false };
  const logId = await logAutomation(ctx, "queued");
  try {
    if (useSms) {
      const { data: patient } = await supabase.from("patients").select("phone").eq("id", patientId).maybeSingle();
      const phone = patient?.phone as string | null;
      if (!phone) throw new Error("Patient has no phone number for SMS");
      await deliverMobileMessage("sms", phone, message, { senderId: hCtx.termiiSenderId });
      await deductSmsFromWallet(hospitalId, `Call task SMS — ${patientName}`);
      await setPatientDndBlocked(patientId, false);
      await updateAutomationLog(logId, "sent", `SMS → ${phone}`);
      try { await pushEraChatMessage(patientId, hospitalId, message); } catch { /* non-fatal */ }
      return { sentViaSms: true, insufficientFunds: false, senderIdMissing: false, dndBlocked: false };
    }

    const contact = contactLine(hCtx.phoneNumber);
    const body = `${message}\n\nIf you have any questions please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject: `IMPORTANT - ${hCtx.hospitalName}`, html, text: body });
    await updateAutomationLog(logId, "sent", message);
    try { await pushEraChatMessage(patientId, hospitalId, message); } catch { /* non-fatal */ }
    return { sentViaSms: false, insufficientFunds, senderIdMissing, dndBlocked: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendCallTaskConfirmedMessage] failed:", msg, { hospitalId, patientId, patientEmail });
    await updateAutomationLog(logId, "failed", msg);
    if (msg.startsWith("DND_BLOCKED:")) {
      await setPatientDndBlocked(patientId, true);
      return { sentViaSms: false, insufficientFunds, senderIdMissing, dndBlocked: true };
    }
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
  if (await skipIfSuspended(hCtx, ctx)) return;
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
    try { await pushEraChatMessage(patientId, hospitalId, customMessage); } catch { /* non-fatal */ }
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
  const tone = buildToneDescription(hCtx.tone);
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
  if (hCtx.suspended) return { sent: 0, failed: 0 };

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

// ── Departmental Post-Treatment Follow-up — Claude — Email ────────────────────
// Fired on nurse-scheduled follow-up days (e.g. Day 7, Day 14) after treatment ends.
// Only for non-General Outpatient departments — GenOut uses the templated Day 1/4/7 path.

export async function sendDepartmentalFollowupEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  department: string,
  dayNumber: number,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const automationType = `departmental_followup_day${dayNumber}`;

  const { data: modules } = await supabase.from("hospital_modules").select("followup_sms_enabled").eq("hospital_id", hospitalId).maybeSingle();
  const smsFlipEnabled = (modules?.followup_sms_enabled as boolean | null) ?? false;

  let useSms = false;
  if (smsFlipEnabled) {
    const smsReady = !!process.env.AFRICAS_TALKING_API_KEY || (!!hCtx.termiiSenderId && hCtx.senderIdApproved);
    if (!smsReady) {
      console.log(`[sendDepartmentalFollowupEmail] No SMS provider configured (no AT or Termii sender ID) — falling back to email for hospital ${hospitalId}`);
    } else {
      useSms = await hasSufficientSmsBalance(hospitalId);
      if (!useSms) console.log(`[sendDepartmentalFollowupEmail] Insufficient wallet — falling back to email for hospital ${hospitalId}`);
    }
  }

  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: useSms ? "sms" : "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const tone = buildToneDescription(hCtx.tone);
    const lang = hCtx.language ?? "English";
    const contact = contactLine(hCtx.phoneNumber);

    if (useSms) {
      const { data: patient } = await supabase.from("patients").select("phone").eq("id", patientId).maybeSingle();
      const phone = patient?.phone as string | null;
      if (!phone) throw new Error("Patient has no phone number for SMS");
      const smsBody = `Hi ${firstName}, checking in from ${hCtx.hospitalName}. How are you doing after your ${department} treatment (Day ${dayNumber})? Reach us at ${hCtx.phoneNumber ?? hCtx.hospitalName} if you need anything.`;
      await deliverMobileMessage("sms", phone, smsBody, { senderId: hCtx.termiiSenderId });
      await deductSmsFromWallet(hospitalId, `Follow-up SMS Day ${dayNumber} (${department}) — ${patientName}`);
      await updateAutomationLog(logId, "sent", `Follow-up Day ${dayNumber} SMS → ${phone}`);
      try { await pushEraChatMessage(patientId, hospitalId, smsBody); } catch { /* non-fatal */ }
      return;
    }

    const body = await generateClaudeMessage(
      `You are writing a post-treatment follow-up email on behalf of ${hCtx.hospitalName} to a patient who has recently completed their ${department} treatment. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. This is day ${dayNumber} after treatment ended. Write a warm, caring check-in that feels personal — ask how the patient is doing, acknowledge the stage of their recovery (early days vs. weeks in), and encourage them to stay well and reach out if anything feels off. NEVER say you are happy, glad, or pleased that they needed treatment. NEVER use clinical jargon. Keep it to 3–4 short paragraphs. Start with "Hi ${firstName},". End with: "If you need anything at all please do not hesitate to ${contact}. Please do not reply to this email directly. Warm regards, ${hCtx.hospitalName} Team"`,
      `Department: ${department}. Days since treatment ended: ${dayNumber}. Write a warm follow-up for ${firstName}.`,
      220,
    );

    const subject = `Checking in on you — ${hCtx.hospitalName}`;
    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book a follow-up appointment online →</a></p>` : "";
    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: bookingUrl ? `${body}\n\nBook a follow-up appointment online: ${bookingUrl}` : body });
    await updateAutomationLog(logId, "sent", `Departmental follow-up Day ${dayNumber} (${department}) → ${patientEmail}`);
    try { await pushEraChatMessage(patientId, hospitalId, stripEmailLine(body)); } catch { /* non-fatal */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendDepartmentalFollowupEmail] failed:", msg, { hospitalId, patientId, patientEmail, department, dayNumber });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Beneficiary Accountability Reminder — Email — Templated ───────────────────
// Sent at the same time as the patient's care plan reminder.
// Tells the named beneficiary to check on the patient and ensure they follow through.

export async function sendBeneficiaryReminderEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  beneficiaryName: string,
  beneficiaryEmail: string,
  actionDescription: string,
  relationship?: string | null,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "beneficiary_reminder",
    channel: "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const patientFirst = patientName.split(" ")[0];
    const contact = contactLine(hCtx.phoneNumber);
    const patientRef = relationship?.trim()
      ? `${patientName}, your ${relationship.trim()},`
      : `${patientName}`;
    const subject = `A gentle nudge about ${patientFirst} — ${hCtx.hospitalName}`;
    const body = `Hi ${beneficiaryName},\n\nThis is just a little reminder from ${hCtx.hospitalName} — ${patientRef} is due to ${actionDescription} right now. A quick check-in from you could make all the difference.\n\nYour care and support mean so much to ${patientFirst}'s recovery. Thank you for being there for them.\n\nIf you have any concerns please do not hesitate to ${contact}. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;

    const html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);
    await sendEmail({
      to: beneficiaryEmail,
      from: hCtx.fromAddress,
      subject,
      html,
      text: body,
    });

    await updateAutomationLog(logId, "sent", `Beneficiary reminder → ${beneficiaryEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendBeneficiaryReminderEmail] failed:", msg, { hospitalId, patientId, beneficiaryEmail });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Pre-generated In-Care Messages — generated once at plan creation ──────────

export type InCareTimeSlot = "morning" | "afternoon" | "evening" | "night";

export interface PregeneratedMessages {
  type: "uniform" | "varied";
  messages: Record<string, unknown>;
}

/**
 * Called once when a GP care plan is created or edited.
 * Makes a single AI call, reads the plan summary, decides whether all days are
 * the same (uniform → 3 messages) or vary (varied → one message per day per slot),
 * and stores the result in care_plans.pregenerated_messages.
 * Fire-and-forget — never throws.
 */
export async function generateCarePlanMessages(
  planId: number,
  hospitalIntId: number,
  patientName: string,
  summary: string,
  templateData: Record<string, unknown>,
): Promise<void> {
  try {
    const hCtx = await getHospitalContext(hospitalIntId);
    const firstName = patientName.split(" ")[0];
    const tone = buildToneDescription(hCtx.tone);
    const lang = hCtx.language ?? "English";
    const contact = contactLine(hCtx.phoneNumber);

    const treatmentType = (templateData.treatmentType as string) ?? "";
    const medTiming = (templateData.medicationTiming as string[]) ?? [];
    const medTimingTimes = (templateData.medicationTimingTimes as Record<string, string>) ?? {};
    const hospTiming = (templateData.hospitalTiming as string[]) ?? [];
    const hospTimingTimes = (templateData.hospitalTimingTimes as Record<string, string>) ?? {};
    const durationDays = Math.max(1, (templateData.durationDays as number) ?? 7);

    // Determine which slots are active for this plan
    let activeSlots: string[] = [];
    if (treatmentType === "medication_only") {
      activeSlots = medTiming.filter(s => medTimingTimes[s]);
    } else if (treatmentType === "come_to_hospital") {
      activeSlots = hospTiming.filter(s => hospTimingTimes[s]);
    } else if (treatmentType === "combination") {
      const base = medTiming.length > 0 ? medTiming : hospTiming;
      activeSlots = base.filter(s => medTimingTimes[s] || hospTimingTimes[s]);
    }

    if (!activeSlots.length) {
      console.warn(`[generateCarePlanMessages] No active slots found for plan ${planId}, treatmentType=${treatmentType}`);
      return;
    }

    // Build timing context so AI knows when messages fire and what to tell the patient
    let timingContext = "";
    if (treatmentType === "medication_only") {
      const lines = activeSlots.map(s => `  - ${s}: ${medTimingTimes[s]} — message arrives at this exact time, patient takes medication NOW`).join("\n");
      timingContext = `Treatment type: MEDICATION ONLY — patient takes medication at home, they do NOT come to hospital.\nMessage delivery: AT the exact medication time.\nSlots and times:\n${lines}`;
    } else if (treatmentType === "come_to_hospital") {
      const lines = activeSlots.map(s => `  - ${s}: visit at ${hospTimingTimes[s]} — message arrives 3 hours before, tell patient their visit is in 3 hours`).join("\n");
      timingContext = `Treatment type: COME TO HOSPITAL — patient must physically attend their hospital visit.\nMessage delivery: 3 HOURS BEFORE the visit time.\nSlots and times:\n${lines}`;
    } else if (treatmentType === "combination") {
      const lines = activeSlots.map(s => {
        const medTime = medTimingTimes[s] ?? "";
        const visitTime = hospTimingTimes[s] ?? medTimingTimes[s] ?? "";
        return `  - ${s}: medication at ${medTime || "same time"}, hospital visit at ${visitTime} — message arrives 2 hours before the visit, address BOTH: medication due now and visit coming in 2 hours`;
      }).join("\n");
      timingContext = `Treatment type: COMBINATION — patient takes medication at home AND comes to hospital.\nMessage delivery: 2 HOURS BEFORE the hospital visit time.\nSlots and times:\n${lines}`;
    }

    // Cap per-day generation at 14 days to stay within token limits
    const generateDays = Math.min(durationDays, 14);

    const systemPrompt = `You are generating pre-stored patient care reminder emails for a General Outpatient care plan at ${hCtx.hospitalName}. Tone: ${tone}. Write ALL messages in ${lang}.

Rules:
1. Start each message with the appropriate time-of-day greeting and patient first name (e.g. "Good morning ${firstName},").
2. Keep each message to 4-5 lines — warm, caring, and personal. Not robotic.
3. Never mention diagnoses or use clinical jargon.
4. Never say you are happy, glad, or pleased the patient is unwell.
5. Every message must end with exactly: "If you have any concerns please ${contact}. Please do not reply to this email directly. — ${hCtx.hospitalName} Team"
6. Return ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON.`;

    const uniformExample = `{"type":"uniform","messages":{"morning":"Good morning ${firstName}, ...","evening":"Good evening ${firstName}, ..."}}`;
    const variedExample = `{"type":"varied","messages":{"1":{"morning":"Good morning ${firstName}, it's day 1 of your care plan...","evening":"Good evening ${firstName}..."},"2":{"morning":"Good morning ${firstName}, day 2...","evening":"..."}}}`;

    const userPrompt = `Patient first name: ${firstName}
${timingContext}

Care plan summary (read carefully before writing):
${summary.slice(0, 700)}

Duration: ${durationDays} days
Active slots to generate: ${activeSlots.join(", ")}

DECISION RULE — read the plan summary carefully:
- If every day has the SAME medication and instructions throughout the plan → set type = "uniform", generate ONE message per slot (this same message will be sent every day).
- If different days have DIFFERENT medications or instructions (e.g. "Day 1-3: Drug A, Day 4-7: Drug A + Drug B") → set type = "varied", generate a unique message for each day (day 1 through ${generateDays}).

For uniform, return:
${uniformExample}

For varied, return (one entry per day, 1 through ${generateDays}):
${variedExample}

Generate messages for all ${generateDays} days if varied. Return ONLY the JSON object.`;

    const raw = await generateOpenAIMessage(systemPrompt, userPrompt, 4000);

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as PregeneratedMessages;

    if (!parsed.type || !parsed.messages) throw new Error("Invalid pregenerated_messages structure");

    await supabase.from("care_plans").update({
      pregenerated_messages: parsed,
    }).eq("id", planId);

    console.log(`[generateCarePlanMessages] Stored ${parsed.type} messages for plan ${planId}`);
  } catch (err) {
    console.error("[generateCarePlanMessages] failed:", err instanceof Error ? err.message : err);
    Sentry.captureException(err);
  }
}

// ── Continuous In-Care AI Reminders — OpenAI — Email ─────────────────────────
// Runs 4 times daily (morning/afternoon/evening/night).
// Only fires for patients who have that time slot checked in their treatment plan.
// timingTypes: which types apply at this slot — e.g. ["med"] or ["hosp"] or ["med","hosp"]

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
  const rawDept = department ?? "General Outpatient";
  const deptLabel = rawDept === "General Outpatient" ? "Outpatient" : rawDept;
  const automationType = `in_care_reminder_${slot}_${deptLabel.replace(/\s+/g, "_").toLowerCase()}`;
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType,
    channel: "email",
  };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const tone = buildToneDescription(hCtx.tone);
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
      `You are a care team member at ${hCtx.hospitalName} sending a care reminder email to a patient. Department: ${deptLabel}. Tone: ${tone}. IMPORTANT: Write the entire email in ${lang}. NEVER say you are happy, glad, pleased, or excited to see the patient or that they are visiting. NEVER express gladness or happiness that the patient is unwell. Start with "Hi ${firstName},". Write around 6 lines — warm and caring, not robotic. Clearly tell the patient what they need to do right now in simple language, reassure them the team is with them, and encourage them to stay consistent with their care. Never use clinical jargon. End with: "If you have any concerns please ${contact}. Please do not reply to this email directly. — ${hCtx.hospitalName} Team"`,
      `${slotContext[slot]}\n${typeContext}\n\nCare plan details: ${treatmentPlan.slice(0, 400)}\n\nWrite a warm, caring reminder for ${firstName}. Around 6 lines.`,
      170,
    );

    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book an appointment online →</a></p>` : "";
    const html = wrapHtml(
      `<p>${message.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject: `${greetings[slot]}, ${firstName} — ${deptLabel} reminder — ${hCtx.hospitalName}`,
      html,
      text: bookingUrl ? `${message}\n\nBook an appointment online: ${bookingUrl}` : message,
    });

    await updateAutomationLog(logId, "sent", `In-care ${slot} reminder (${deptLabel}) → ${patientEmail}`);
    const stripped = stripEmailLine(message);
    try { await pushEraChatMessage(patientId, hospitalId, stripped); } catch (e) {
      console.error("[sendInCareAIReminder] pushEraChatMessage failed:", e instanceof Error ? e.message : String(e), { patientId, hospitalId, slot });
      Sentry.captureException(e, { extra: { fn: "pushEraChatMessage", patientId, hospitalId, slot } });
    }
    try {
      await pushEraNotification(patientId, hospitalId, "care_reminder",
        `${greetings[slot]}, ${firstName} — ${deptLabel} reminder`,
        stripped.slice(0, 200),
      );
    } catch (e) {
      console.error("[sendInCareAIReminder] pushEraNotification failed:", e instanceof Error ? e.message : String(e), { patientId, hospitalId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendInCareAIReminder] failed:", msg, { hospitalId, patientId, patientEmail, slot, deptLabel });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Send a pre-generated in-care reminder — no AI call ────────────────────────
// Used by the scheduler when pregenerated_messages exist on the care plan.
// Identical delivery path to sendInCareAIReminder but skips AI generation.

// ── Doctor: new appointment assigned notification ─────────────────────────────
export async function sendDoctorAppointmentAssignedEmail(
  doctorEmail: string,
  doctorFullName: string,
  hospitalName: string,
  patientName: string,
  appointmentTitle: string,
  scheduledAt: string,
  durationMinutes: number | null,
  notes: string | null,
): Promise<void> {
  const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
  const fromEmail = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
  const fromName = process.env.PLATFORM_FROM_NAME ?? "Era Systems";

  const scheduledDate = new Date(scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  const dateStr = scheduledDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
  const durationRow = durationMinutes
    ? `<tr><td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:110px;vertical-align:top">Duration</td><td style="padding:8px 0;color:#c9d1d9;font-size:14px">${durationMinutes} minutes</td></tr>`
    : "";
  const notesRow = notes?.trim()
    ? `<tr><td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Notes</td><td style="padding:8px 0;color:#c9d1d9;font-size:14px;font-style:italic">${notes.trim()}</td></tr>`
    : "";

  const subject = `New Appointment — ${patientName} — ${hospitalName}`;
  const body = `
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">Hi <strong style="color:#e6edf3">Dr. ${doctorFullName}</strong>,</p>
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">
      A new appointment has been scheduled and assigned to you.
    </p>
    <div style="background:#0d1117;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #30363d">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:110px;vertical-align:top">Patient</td>
          <td style="padding:8px 0;color:#e6edf3;font-size:15px;font-weight:700">${patientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Appointment</td>
          <td style="padding:8px 0;color:#c9d1d9;font-size:14px">${appointmentTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Date &amp; Time</td>
          <td style="padding:8px 0;font-size:14px">
            <span style="color:#e6edf3;font-weight:700">${timeStr}</span>
            <span style="color:#8b949e;font-size:13px"> · ${dateStr}</span>
          </td>
        </tr>
        ${durationRow}
        ${notesRow}
      </table>
    </div>
    <div style="text-align:center;margin-bottom:8px">
      <a href="${appUrl}/login" style="display:inline-block;padding:11px 28px;background:#14b8a6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View Your Schedule →</a>
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:12px 0 0">This is an automated notification. Please do not reply to this email.</p>
  `;

  await sendEmail({ to: doctorEmail, from: `${fromName} <${fromEmail}>`, subject, html: wrapHtml(body, hospitalName) });
}

// ── Doctor: appointment reassigned to them notification ───────────────────────
export async function sendDoctorAppointmentReassignedEmail(
  doctorEmail: string,
  doctorFullName: string,
  hospitalName: string,
  patientName: string,
  appointmentTitle: string,
  scheduledAt: string,
  durationMinutes: number | null,
  reassignedFromDoctorName: string,
  note: string | null,
): Promise<void> {
  const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
  const fromEmail = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
  const fromName = process.env.PLATFORM_FROM_NAME ?? "Era Systems";

  const scheduledDate = new Date(scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  const dateStr = scheduledDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
  const durationRow = durationMinutes
    ? `<tr><td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:110px;vertical-align:top">Duration</td><td style="padding:8px 0;color:#c9d1d9;font-size:14px">${durationMinutes} minutes</td></tr>`
    : "";
  const noteBlock = note?.trim()
    ? `<div style="margin-bottom:20px;padding:14px 16px;background:#0d1117;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:0.06em">Reason for reassignment</p>
        <p style="margin:0;font-size:14px;color:#c9d1d9;font-style:italic">"${note.trim()}"</p>
       </div>`
    : "";

  const subject = `Appointment Reassigned to You — ${patientName} — ${hospitalName}`;
  const body = `
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">Hi <strong style="color:#e6edf3">Dr. ${doctorFullName}</strong>,</p>
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">
      An appointment has been reassigned to you by <strong style="color:#e6edf3">Dr. ${reassignedFromDoctorName}</strong>.
    </p>
    ${noteBlock}
    <div style="background:#0d1117;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #30363d">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:120px;vertical-align:top">Patient</td>
          <td style="padding:8px 0;color:#e6edf3;font-size:15px;font-weight:700">${patientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Appointment</td>
          <td style="padding:8px 0;color:#c9d1d9;font-size:14px">${appointmentTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Date &amp; Time</td>
          <td style="padding:8px 0;font-size:14px">
            <span style="color:#e6edf3;font-weight:700">${timeStr}</span>
            <span style="color:#8b949e;font-size:13px"> · ${dateStr}</span>
          </td>
        </tr>
        ${durationRow}
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Reassigned by</td>
          <td style="padding:8px 0;color:#c9d1d9;font-size:14px">Dr. ${reassignedFromDoctorName}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:8px">
      <a href="${appUrl}/login" style="display:inline-block;padding:11px 28px;background:#14b8a6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View Your Schedule →</a>
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:12px 0 0">This is an automated notification. Please do not reply to this email.</p>
  `;

  await sendEmail({ to: doctorEmail, from: `${fromName} <${fromEmail}>`, subject, html: wrapHtml(body, hospitalName) });
}

// ── Doctor appointment reminder — sent 3 hours before the appointment ─────────
// This goes to the doctor's own email, not the patient.
export async function sendDoctorAppointmentReminderEmail(
  doctorEmail: string,
  doctorFullName: string,
  hospitalName: string,
  patientName: string,
  appointmentTitle: string,
  scheduledAt: string,
): Promise<void> {
  const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
  const fromEmail = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
  const fromName = process.env.PLATFORM_FROM_NAME ?? "Era Systems";

  const scheduledDate = new Date(scheduledAt);
  const timeStr = scheduledDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  const dateStr = scheduledDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });

  const subject = `Appointment in 3 hours — ${patientName} — ${hospitalName}`;

  const body = `
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">Hi <strong style="color:#e6edf3">Dr. ${doctorFullName}</strong>,</p>
    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px">
      You have an appointment coming up in approximately <strong style="color:#e6edf3">3 hours</strong>.
      Please ensure you are available and prepared for the session.
    </p>

    <div style="background:#0d1117;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #30363d">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:110px;vertical-align:top">Patient</td>
          <td style="padding:8px 0;color:#e6edf3;font-size:15px;font-weight:700">${patientName}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Appointment</td>
          <td style="padding:8px 0;color:#c9d1d9;font-size:14px">${appointmentTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Date &amp; Time</td>
          <td style="padding:8px 0;font-size:14px">
            <span style="color:#e6edf3;font-weight:700">${timeStr}</span>
            <span style="color:#8b949e;font-size:13px"> · ${dateStr}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#8b949e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top">Hospital</td>
          <td style="padding:8px 0;color:#c9d1d9;font-size:14px">${hospitalName}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:8px">
      <a href="${appUrl}/login" style="display:inline-block;padding:11px 28px;background:#14b8a6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View Your Schedule →</a>
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:12px 0 0">This is an automated reminder. Please do not reply to this email.</p>
  `;

  const html = wrapHtml(body, hospitalName);
  await sendEmail({ to: doctorEmail, from: `${fromName} <${fromEmail}>`, subject, html });
}

export async function sendStoredCarePlanReminder(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  message: string,
  slot: InCareTimeSlot,
  department: string,
): Promise<void> {
  const hCtx = await getHospitalContext(hospitalId);
  const deptLabel = department === "General Outpatient" ? "Outpatient" : department;
  const automationType = `in_care_reminder_${slot}_${deptLabel.replace(/\s+/g, "_").toLowerCase()}`;
  const ctx: AutomationContext = { hospitalId, patientId, patientName, automationType, channel: "email" };
  if (await skipIfSuspended(hCtx, ctx)) return;
  const logId = await logAutomation(ctx, "queued");
  try {
    const firstName = patientName.split(" ")[0];
    const greetings: Record<InCareTimeSlot, string> = {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
      night: "Good evening",
    };
    const appUrl = (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "");
    const bookingUrl = hCtx.slug ? `${appUrl}/book/${hCtx.slug}` : null;
    const bookingHtml = bookingUrl ? `<p style="text-align:center;margin:20px 0 0"><a href="${bookingUrl}" style="color:#14b8a6;font-size:13px;text-decoration:none;">Book an appointment online →</a></p>` : "";
    const html = wrapHtml(`<p>${message.replace(/\n/g, "</p><p>")}</p>${bookingHtml}`, hCtx.hospitalName);
    await sendEmail({
      to: patientEmail,
      from: hCtx.fromAddress,
      subject: `${greetings[slot]}, ${firstName} — ${deptLabel} reminder — ${hCtx.hospitalName}`,
      html,
      text: bookingUrl ? `${message}\n\nBook an appointment online: ${bookingUrl}` : message,
    });
    await updateAutomationLog(logId, "sent", `In-care ${slot} reminder (pre-generated, ${deptLabel}) → ${patientEmail}`);
    const stripped = stripEmailLine(message);
    try { await pushEraChatMessage(patientId, hospitalId, stripped); } catch (e) {
      console.error("[sendStoredCarePlanReminder] pushEraChatMessage failed:", e instanceof Error ? e.message : String(e), { patientId, hospitalId, slot });
      Sentry.captureException(e, { extra: { fn: "pushEraChatMessage", patientId, hospitalId, slot } });
    }
    try {
      await pushEraNotification(patientId, hospitalId, "care_reminder",
        `${greetings[slot]}, ${firstName} — ${deptLabel} reminder`,
        stripped.slice(0, 200),
      );
    } catch (e) {
      console.error("[sendStoredCarePlanReminder] pushEraNotification failed:", e instanceof Error ? e.message : String(e), { patientId, hospitalId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendStoredCarePlanReminder] failed:", msg, { hospitalId, patientId, patientEmail, slot, deptLabel });
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

