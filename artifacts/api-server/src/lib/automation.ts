import * as Sentry from "@sentry/node";
import { supabase } from "./supabase.js";
import { generateOpenAIMessage, generateClaudeMessage, buildToneDescription } from "./ai.js";
import { sendEmail, wrapHtml } from "./email.js";
import { deliverWhatsApp } from "./whatsapp.js";

export type AutomationChannel = "whatsapp" | "email";
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

async function getHospitalContext(hospitalId: number) {
  const [{ data: hospital }, { data: settings }, { data: modules }] = await Promise.all([
    supabase.from("hospitals").select("id, name, username").eq("id", hospitalId).single(),
    supabase.from("hospital_settings").select("tone, sending_email, departments, language").eq("hospital_id", hospitalId).single(),
    supabase.from("hospital_modules").select("messages_enabled").eq("hospital_id", hospitalId).maybeSingle(),
  ]);
  const tones: string[] = settings?.tone ? JSON.parse(settings.tone) : [];
  const departments: string[] = settings?.departments ? JSON.parse(settings.departments) : [];
  return {
    hospitalName: hospital?.name ?? "The Hospital",
    hospitalUsername: hospital?.username ?? "",
    sendingEmail: settings?.sending_email ?? "onboarding@resend.dev",
    tone: buildToneDescription(tones),
    departments,
    language: settings?.language ?? "English",
    messagesEnabled: (modules?.messages_enabled as boolean) ?? false,
  };
}

// Appends a no-reply notice when the Messages inbox module is disabled,
// so patients know their reply won't be seen.
function withNoReply(body: string, messagesEnabled: boolean): string {
  if (messagesEnabled) return body;
  return `${body}\n\n_(This is a one-way notification — replies are not monitored.)_`;
}

// ── Queue WhatsApp ─────────────────────────────────────────────────────────────

export async function sendQueueJoinMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  position: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_join",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a WhatsApp message. Tone: ${hCtx.tone}. Write in a warm, human way — like a real person on the team. Start with "Hi ${firstName}!" and use the hospital name. Make the patient feel seen and valued, not just like a number. Include their queue position clearly. End with a warm, encouraging note about patience.`,
      `${firstName} has just joined the queue at position number ${position} at ${hCtx.hospitalName}. Write a welcoming message that tells them their queue number, makes them feel seen, and thanks them for their patience. Example feel: "Hi ${firstName}! Welcome to ${hCtx.hospitalName}. You are currently number ${position} in the queue. We see you and we will keep you updated as things move. Thank you for your patience today." — keep this exact tone but write it naturally.`,
      140,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendQueuePositionUpdate(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  newPosition: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "queue_position_update",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a WhatsApp message. Tone: ${hCtx.tone}. Keep it short, warm and reassuring — like a real person giving a quick update. Start with "Hi ${firstName}".`,
      `${firstName}'s queue position has updated to number ${newPosition}. Write a short, friendly update. Example feel: "Hi ${firstName}, just a quick update — you are now number ${newPosition} in the queue. It will not be long now. We appreciate your patience." — same warmth, written naturally.`,
      110,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Care Summary (Claude) ─────────────────────────────────────────────────────

export async function sendCareSummary(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  treatmentType: string,
  durationDays: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "care_summary",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateClaudeMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a WhatsApp message to a patient whose care plan is now in place. Tone: ${hCtx.tone}. Be warm, reassuring and informative — but NEVER mention the diagnosis or any medical condition. No clinical jargon. Start with "Hi ${firstName}," and include the hospital name. Explain the care process simply, reassure them the team is with them every step, and let them know what to expect over the coming days. Keep it under 5 sentences.`,
      `${firstName}'s care plan at ${hCtx.hospitalName} has just been set up — it involves ${treatmentType} over ${durationDays} days. Write a warm, reassuring WhatsApp message letting them know their care is in place and the team is with them. Example feel: "Hi ${firstName}, your care plan at ${hCtx.hospitalName} is now in place. Over the next ${durationDays} days our team will be actively supporting your health journey. You will have a combination of care and check-ins — we will guide you through every step. You are not alone in this, and we are here for you." — write in this tone, naturally.`,
      300,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── In-Care Daily Message (OpenAI) ────────────────────────────────────────────

export async function sendInCareDailyMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  treatmentPlan: string,
  medicationTiming: string | null,
  treatmentType: string,
  dayNumber: number,
  totalDays: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "in_care_daily",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const timingNote = medicationTiming
      ? `Their medication is scheduled for: ${medicationTiming}.`
      : "They may have medication or a hospital visit today.";
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a daily WhatsApp check-in to a patient who is currently in their treatment. Tone: ${hCtx.tone}. Write like a real, caring human — warm, direct, personal. Greet them by first name with a time-appropriate greeting (good morning/afternoon). Mention any relevant care activities for today based on the plan. Encourage them not to miss it. Keep it short — 2-3 sentences. No sign-off. Never sound automated.`,
      `Today is day ${dayNumber} of ${totalDays} for ${firstName}'s treatment at ${hCtx.hospitalName}. Treatment type: ${treatmentType}. Treatment plan details: ${treatmentPlan}. ${timingNote} Write a warm daily message that references today's specific care — medication, a hospital visit, or both. Example feel: "Good morning ${firstName}, you have medication this morning and are expected to visit the hospital today — please don't miss this, it's important for your recovery. Wishing you a good day 💙" or "Good afternoon ${firstName}, don't forget your medication this afternoon. Make sure you rest well and take care of yourself."`,
      160,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Medication Timing Reminder (OpenAI) ──────────────────────────────────────

export type MedicationPeriod = "morning" | "afternoon" | "night";

export async function sendCareReminder(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  treatmentPlan: string,
  medicationTiming: string,
  period: MedicationPeriod,
  dayNumber: number,
  totalDays: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: `care_reminder_${period}`,
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const greetMap: Record<MedicationPeriod, string> = {
      morning: "Good morning",
      afternoon: "Good afternoon",
      night: "Good evening",
    };
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a WhatsApp care reminder for the ${period}. Tone: ${hCtx.tone}. You must read the FULL treatment plan carefully and identify EVERY care activity that applies to the ${period} — this includes medication, hospital visits, procedures, exercises, dietary instructions, or any other care step scheduled for this time of day. Combine all ${period} activities into ONE warm, human message. Start with "${greetMap[period]} ${firstName},". Be warm and encouraging, not clinical. Keep it brief (2-3 sentences max). Never mention just one activity if multiple apply — always cover everything the patient needs to do in this ${period}.`,
      `Today is day ${dayNumber} of ${totalDays} for ${firstName}'s treatment at ${hCtx.hospitalName}.

FULL TREATMENT PLAN:
${treatmentPlan}

MEDICATION SCHEDULE (time-of-day breakdown):
${medicationTiming}

TIME WINDOW: ${period.toUpperCase()}

Carefully read the treatment plan above. Identify ALL activities for the ${period} — for example, if the plan says they have a hospital visit AND morning medication, mention BOTH in the message. If they only have medication, mention just that. If they have a hospital visit but no medication at this time, focus on the visit. Write ONE combined message covering everything relevant to the ${period}. 

Example when both apply: "${greetMap[period]} ${firstName}, remember to take your morning medication and also come in to the hospital for your treatment session today — we are expecting you! 💙"
Example medication only: "${greetMap[period]} ${firstName}, just a reminder to take your ${period} medication 💊 — keep it up, you're doing great!"
Example hospital visit only: "${greetMap[period]} ${firstName}, don't forget you have a hospital visit at ${hCtx.hospitalName} this ${period} — we will see you soon! 💙"

Write naturally in the hospital's tone. Never sound automated.`,
      180,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Post Treatment Check-in (OpenAI) ─────────────────────────────────────────

export async function sendPostTreatmentCheckin(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  checkinNumber: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "post_treatment_checkin",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a post-treatment check-in WhatsApp message. Tone: ${hCtx.tone}. Write like a genuinely caring person, not a system. Start with "Hi ${firstName},". Let them know their treatment has ended, check how they are feeling, and remind them you are there if they need anything.`,
      `This is check-in number ${checkinNumber} for ${firstName} whose treatment at ${hCtx.hospitalName} has ended. Write a warm, caring message checking how they are doing. Example feel: "Hi ${firstName}, we are just checking in on you. Your treatment period has ended and we want to know how you are feeling. Please do not hesitate to reach out if you need anything — we are always here for you." — write with this warmth, naturally. Vary the phrasing from previous check-ins.`,
      160,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Post Care Wellness (OpenAI) ───────────────────────────────────────────────

export async function sendPostCareWellness(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  messageNumber: number,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "post_care_wellness",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} sending a wellness WhatsApp message to a patient who has completed their treatment. Tone: ${hCtx.tone}. Write like a genuine, caring person — warm, encouraging, personal. Start with "Hi ${firstName},". Share a simple wellness thought or encouragement. Keep it brief and uplifting.`,
      `This is wellness message number ${messageNumber} for ${firstName} who has completed their treatment at ${hCtx.hospitalName} and is in their wellness phase. Write a friendly, encouraging message — share a simple wellness reminder or tip and let them know the team is thinking of them. Start with "Hi ${firstName}," and keep it warm, brief, and human. Vary the wellness focus each message.`,
      160,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Appointment WhatsApp (OpenAI) ─────────────────────────────────────────────

export async function sendAppointmentConfirmation(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  appointmentTitle: string,
  scheduledAt: string,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_confirmation",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
    const message = await generateOpenAIMessage(
      `You are a receptionist at ${hCtx.hospitalName} sending an appointment confirmation via WhatsApp. Tone: ${hCtx.tone}. Write warmly and clearly — start with "Hi ${firstName},", include the hospital name, state the appointment clearly, and end on a welcoming note.`,
      `${firstName} has just booked an appointment: "${appointmentTitle}" on ${dateStr} at ${hCtx.hospitalName}. Write a warm confirmation message. Example feel: "Hi ${firstName}, your appointment at ${hCtx.hospitalName} is confirmed for ${dateStr}. We look forward to seeing you!" — write with this clarity and warmth, naturally.`,
      140,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendAppointmentReminder(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  appointmentTitle: string,
  scheduledAt: string,
  hoursAway: 24 | 2,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: hoursAway === 24 ? "appointment_reminder_24h" : "appointment_reminder_2h",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const timeStr = new Date(scheduledAt).toLocaleString("en-GB", { timeStyle: "short" });
    const message = await generateOpenAIMessage(
      `You are a receptionist at ${hCtx.hospitalName} sending a WhatsApp appointment reminder. Tone: ${hCtx.tone}. Start with "Hi ${firstName},". Include the hospital name and appointment time clearly. Keep it short and friendly.`,
      hoursAway === 24
        ? `${firstName} has an appointment (${appointmentTitle}) tomorrow at ${timeStr} at ${hCtx.hospitalName}. Write a friendly 24-hour reminder. Example feel: "Hi ${firstName}, just a reminder that your appointment at ${hCtx.hospitalName} is tomorrow at ${timeStr}. See you soon!" — same warmth, written naturally.`
        : `${firstName} has an appointment (${appointmentTitle}) in about 2 hours at ${timeStr} at ${hCtx.hospitalName}. Write a short 2-hour reminder. Example feel: "Hi ${firstName}, your appointment at ${hCtx.hospitalName} is in 2 hours at ${timeStr}. We will see you shortly!" — same energy, written naturally.`,
      110,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

export async function sendAppointmentNoShowFollowUp(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  appointmentTitle: string,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "appointment_no_show",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} following up with a patient who missed their appointment, via WhatsApp. Tone: ${hCtx.tone}. Start with "Hi ${firstName},". Be gentle and caring — not accusatory. Check if they are okay, and invite them to reschedule.`,
      `${firstName} missed their appointment "${appointmentTitle}" at ${hCtx.hospitalName}. Write a warm, caring follow-up. Example feel: "Hi ${firstName}, we noticed you were not able to make your appointment today — we hope you are well? Please reach out if you would like to reschedule, we are here for you." — write with this gentleness and care, naturally.`,
      140,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
  }
}

// ── Call Task Automated Message (OpenAI) ──────────────────────────────────────

export async function sendCallTaskAutomatedMessage(
  hospitalId: number,
  patientId: number,
  patientName: string,
  phone: string,
  flagReason: string,
): Promise<string> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "call_task_automated",
    channel: "whatsapp",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];
    const message = await generateOpenAIMessage(
      `You are a care team member at ${hCtx.hospitalName} reaching out to a patient via WhatsApp. Tone: ${hCtx.tone}. Start with "Hi ${firstName},". Read the reason carefully and choose the right tone — gentle if sensitive, encouraging if they need support, friendly if it is a simple check-in. Write like a real, caring person. Never sound automated.`,
      `You need to contact ${firstName} because: "${flagReason}". Write a warm, human WhatsApp message appropriate to this exact situation. Match your tone to the reason — be caring and specific, not generic. 2-3 sentences, genuine and human.`,
      160,
    );
    await deliverWhatsApp({ to: phone, body: withNoReply(message, hCtx.messagesEnabled) });
    await updateAutomationLog(logId, "sent", message);
    return message;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
  }
}

// ── Feedback Email (Resend + OpenAI) ─────────────────────────────────────────

export async function sendFeedbackEmail(
  hospitalId: number,
  patientId: number,
  patientName: string,
  patientEmail: string,
  feedbackToken: string,
  feedbackUrl: string,
): Promise<void> {
  const ctx: AutomationContext = {
    hospitalId, patientId, patientName,
    automationType: "feedback_email",
    channel: "email",
  };
  const logId = await logAutomation(ctx, "queued");
  try {
    const hCtx = await getHospitalContext(hospitalId);
    const firstName = patientName.split(" ")[0];

    const emailBody = await generateOpenAIMessage(
      `You are writing a patient feedback request email for ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write warm, personal emails. The email should make the patient feel their feedback truly matters and will be used to improve care. Keep it under 150 words of body text.`,
      `Write a feedback request email for ${firstName} who visited ${hCtx.hospitalName} today. Ask them to share their experience using the button below. Make it personal and warm.`,
      200,
    );

    const html = wrapHtml(
      `<p>${emailBody.replace(/\n/g, "</p><p>")}</p>
       <p style="text-align:center"><a href="${feedbackUrl}" class="btn">Share Your Feedback →</a></p>
       <p style="font-size:13px;color:#8b949e;text-align:center">This link is unique to you and expires after submission.</p>`,
      hCtx.hospitalName,
    );

    await sendEmail({
      to: patientEmail,
      from: hCtx.sendingEmail,
      subject: `How was your visit today, ${firstName}? — ${hCtx.hospitalName}`,
      html,
      text: `${emailBody}\n\nShare your feedback: ${feedbackUrl}`,
    });

    await updateAutomationLog(logId, "sent", `Feedback email → ${patientEmail}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAutomationLog(logId, "failed", msg);
    Sentry.captureException(err, { extra: { ...ctx } });
    throw err;
  }
}

// ── Wellness Newsletter Email (Claude + Resend) ───────────────────────────────

export async function generateWellnessNewsletter(
  hospitalId: number,
  topic: string,
  departments: string[],
  fixedSubtopic?: string,
): Promise<{ subtopic: string; angle: string; content: string }> {
  const hCtx = await getHospitalContext(hospitalId);
  const deptList = departments.length > 0 ? departments.join(", ") : "General Practice";

  // When a subtopic is fixed, skip subtopic selection and only vary the angle
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

IMPORTANT: Never use the word "patients" anywhere in the newsletter. Use "friends", "you", or "our community" instead.
Write in plain language, warm and encouraging. No markdown symbols in the content.

Respond with this exact JSON structure (no extra keys, no markdown wrapping):
{
  "subtopic": "${fixedSubtopic}",
  "angle": "the new angle you chose (max 12 words)",
  "content": "the full newsletter text"
}`
    : `You are given a broad wellness category. Your job is to choose TWO levels of focus, then write a newsletter about the specific combination:

LEVEL 1 — Subtopic: A specific area or branch within the broad category (e.g. if category is "Sleep Hygiene", a subtopic could be "Sleep Cycles" or "Pre-Sleep Nutrition" or "Napping Science").
LEVEL 2 — Angle: A specific, surprising, or overlooked perspective on that subtopic — something most people don't think about (e.g. subtopic "Sleep Cycles" → angle "Why timing your wake-up to the end of a 90-minute cycle prevents morning grogginess").

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

IMPORTANT: Never use the word "patients" anywhere in the newsletter. Use "friends", "you", or "our community" instead.
Write in plain language, warm and encouraging. No markdown symbols in the content.

Respond with this exact JSON structure (no extra keys, no markdown wrapping):
{
  "subtopic": "the subtopic you chose within the broad category (2-5 words)",
  "angle": "the specific angle or perspective on that subtopic (max 12 words)",
  "content": "the full newsletter text"
}`;

  const raw = await generateClaudeMessage(
    `You are a wellness content writer for ${hCtx.hospitalName}. Write in a ${hCtx.tone} tone. You write detailed, helpful wellness newsletters that educate the community. Never mention diagnoses or specific patient cases. Write at a general public level. Always address recipients as "friends" — never use the word "patients". Always respond with valid JSON only — no markdown, no code fences, no extra text.`,
    userPrompt,
    1800,
  );

  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { subtopic: string; angle: string; content: string };
    if (typeof parsed.subtopic === "string" && typeof parsed.angle === "string" && typeof parsed.content === "string") {
      // Guarantee the newsletter always starts with "Dear Friends,"
      const content = parsed.content.trimStart();
      const greeting = "Dear Friends,";
      const finalContent = content.startsWith(greeting) ? content : `${greeting}\n\n${content}`;
      return { subtopic: parsed.subtopic, angle: parsed.angle, content: finalContent };
    }
  } catch {
    // Fall back gracefully if Claude returns non-JSON
  }

  // Fallback: treat entire response as content with generic labels
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
    const ctx: AutomationContext = {
      hospitalId,
      patientId: patient.id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      automationType: "wellness_newsletter",
      channel: "email",
    };
    const logId = await logAutomation(ctx, "queued");
    try {
      const html = wrapHtml(
        `<h2 style="font-size:18px;font-weight:700;margin:0 0 16px;">This Week: ${topic}</h2>
         <p>Hi ${firstName},</p>
         <div style="line-height:1.8;">${formattedContent}</div>
         ${mediaSection}`,
        hCtx.hospitalName,
      );

      await sendEmail({
        to: patient.email,
        from: hCtx.sendingEmail,
        subject: `${hCtx.hospitalName} Wellness Newsletter — ${topic}`,
        html,
        text: `${newsletterContent}${youtubeLink ? `\n\nWatch: ${youtubeLink}` : ""}`,
      });

      await updateAutomationLog(logId, "sent", `Newsletter → ${patient.email}`);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateAutomationLog(logId, "failed", msg);
      Sentry.captureException(err, { extra: { ...ctx } });
      failed++;
    }
  }

  return { sent, failed };
}
