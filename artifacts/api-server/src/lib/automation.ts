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
      `You are a real person on the care team at ${hCtx.hospitalName} sending a WhatsApp text. Tone: ${hCtx.tone}. Write exactly like a human would text — casual, warm, natural. No formal greetings, no sign-offs, no "Best regards", no "This is an automated message". Short sentences. Contractions. The kind of message a receptionist would actually send from their phone. Never sound like a bot or system notification.`,
      `${firstName} just joined the queue and is number ${position}. Text them like a real person — just a quick, friendly heads-up so they know where they stand and feel looked after. Keep it natural, under 2-3 short sentences.`,
      120,
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
      `You are a real person on the care team at ${hCtx.hospitalName} sending a WhatsApp text. Tone: ${hCtx.tone}. Write exactly like a human would text — casual, warm, natural. No formal greetings, no sign-offs. Short and direct. Never sound like a bot or automated update.`,
      `${firstName}'s queue position just moved to number ${newPosition}. Send them a quick, human text letting them know — friendly, like you're genuinely keeping them in the loop. 1-2 sentences max.`,
      100,
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
  treatmentPlan: string,
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
      `You are a compassionate patient communication specialist for ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write WhatsApp messages that are warm, clear, and reassuring. NEVER mention the patient's diagnosis or illness. NEVER use clinical jargon. Make the patient feel supported and cared for throughout their care journey. Keep the message under 200 words.`,
      `Write a warm care summary WhatsApp message for ${firstName} who has just had a treatment plan set up. The care involves: ${treatmentType} over ${durationDays} days. Explain what their care process will be like in simple, reassuring language. Let them know the team is with them throughout. Do NOT mention any diagnosis or medical condition.`,
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
      `You are a real person on the care team at ${hCtx.hospitalName} checking in on a patient via WhatsApp. Tone: ${hCtx.tone}. Write exactly how a human would text — natural, warm, personal. No formal greetings, no sign-offs, no bullet points. Sound like someone who genuinely knows and cares about this person. Contractions, casual phrasing. Never sound like an automated wellness reminder.`,
      `It's check-in number ${checkinNumber} for ${firstName} who's been recovering. Write a short, genuinely human message checking how they're doing — like a nurse who actually cares, texting from their phone. Different each time — vary how you open it, what you ask, how you close. 2-3 sentences, natural and warm.`,
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
      `You are a real person from the care team at ${hCtx.hospitalName} sending a casual WhatsApp message. Tone: ${hCtx.tone}. Write like a human — conversational, warm, zero jargon. No formal intro or sign-off. No "Dear [Name]". Just a genuine, friendly message that sounds like it came from a real person who cares. Never sound like a wellness app notification.`,
      `${firstName} has finished their treatment and is in their wellness phase — this is message number ${messageNumber}. Send something genuinely human: a bit of friendly encouragement, maybe a simple wellness thought, but keep it light and natural. Like a friend who happens to work in healthcare. 2-3 sentences, casual and warm.`,
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
      `You are a receptionist at ${hCtx.hospitalName} texting a patient on WhatsApp. Tone: ${hCtx.tone}. Write exactly like a real person would text — natural, friendly, no corporate language. No "Dear [Name]", no formal sign-off. The kind of message a real receptionist would actually type. Include the key info but keep it human and brief.`,
      `${firstName} just booked an appointment: ${appointmentTitle} on ${dateStr}. Send a quick, friendly confirmation text — natural, like a real person confirming their booking. Include the date/time clearly but wrap it in natural conversation. 2-3 sentences.`,
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
      `You are a receptionist at ${hCtx.hospitalName} sending a quick reminder via WhatsApp. Tone: ${hCtx.tone}. Write like a real person texting — short, natural, friendly. No formal language, no sign-off. The kind of reminder a real receptionist would dash off.`,
      `Quick reminder for ${firstName}: their appointment (${appointmentTitle}) is ${hoursAway === 24 ? "tomorrow" : "in about 2 hours"} at ${timeStr}. Text them a brief, human reminder — friendly, not robotic. Just the key info wrapped in a natural, warm sentence or two.`,
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
      `You are a real person from the care team at ${hCtx.hospitalName} texting a patient on WhatsApp. Tone: ${hCtx.tone}. Write like a genuine human — gentle, natural, non-judgmental. No formal language, no robotic phrasing. Like a colleague who noticed and genuinely wants to check in. Short and warm.`,
      `${firstName} missed their appointment (${appointmentTitle}) and nobody reached out yet. Send them a gentle, human text — not accusatory at all, just checking they're okay and leaving the door open to reschedule. Natural and caring, 2-3 sentences.`,
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
      `You are a real person from the care team at ${hCtx.hospitalName} reaching out to a patient on WhatsApp. Tone: ${hCtx.tone}. Write exactly like a human would text — natural, genuine, appropriate to the situation. No formal greetings, no sign-offs. Read the reason carefully and match your tone to it: gentle if it's sensitive, warm and encouraging if they need a boost, casual if it's a simple check-in. Never sound automated.`,
      `You need to reach out to ${firstName} because: "${flagReason}". Write the most natural, human WhatsApp message for this specific situation — the kind a real care team member would actually send. 2-3 sentences, genuine and fitting to the situation.`,
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
