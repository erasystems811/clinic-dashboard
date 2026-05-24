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
  const [{ data: hospital }, { data: settings }] = await Promise.all([
    supabase.from("hospitals").select("id, name, username").eq("id", hospitalId).single(),
    supabase.from("hospital_settings").select("tone, sending_email, departments, language").eq("hospital_id", hospitalId).single(),
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
  };
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
      `You are a warm, caring healthcare assistant for ${hCtx.hospitalName}. Your tone is ${hCtx.tone}. Write short WhatsApp messages (under 100 words). Never mention diagnoses or medical details. Always use the patient's first name.`,
      `Write a warm WhatsApp message for ${firstName} who has just been added to the queue at position ${position}. Let them know their queue number and that the care team is ready for them. Make them feel welcome and seen.`,
      150,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a warm, caring healthcare assistant for ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Keep WhatsApp messages under 80 words. Never robotic.`,
      `Write a brief, warm WhatsApp message for ${firstName} letting them know their queue position has updated to #${newPosition}. Make them feel informed and cared for.`,
      120,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a caring healthcare coordinator at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write warm, genuine WhatsApp check-in messages that feel personal. The patient is in their recovery phase. Make them feel genuinely cared for as a person, not just a patient. Under 120 words.`,
      `Write check-in message #${checkinNumber} for ${firstName} who is in their post-treatment recovery phase. Ask how they are feeling, remind them the team is there if they need anything, and give them warm encouragement. Keep it personal and human.`,
      180,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a wellness coordinator at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write uplifting, wellness-focused WhatsApp messages. Encouraging, positive, focused on healthy living. Under 120 words.`,
      `Write wellness message #${messageNumber} for ${firstName} who has completed their treatment and is now in the wellness phase. Share an encouraging wellness tip or uplifting message focused on maintaining good health and wellbeing.`,
      180,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a receptionist at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write warm, professional appointment messages under 100 words.`,
      `Write an appointment confirmation WhatsApp message for ${firstName}. Appointment: ${appointmentTitle} on ${dateStr}. Confirm the appointment and let them know you look forward to seeing them.`,
      150,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a receptionist at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write friendly appointment reminder messages under 80 words.`,
      `Write a ${hoursAway === 24 ? "24-hour" : "2-hour"} reminder WhatsApp message for ${firstName} about their upcoming appointment: ${appointmentTitle} at ${timeStr} ${hoursAway === 2 ? "today" : "tomorrow"}.`,
      120,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a caring healthcare coordinator at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. Write gentle, non-judgmental follow-up messages under 100 words.`,
      `Write a gentle WhatsApp follow-up message for ${firstName} who missed their appointment: ${appointmentTitle}. Express that the team noticed they missed it, check if everything is okay, and offer to reschedule. Warm and caring, not accusatory.`,
      150,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
      `You are a caring care coordinator at ${hCtx.hospitalName}. Tone: ${hCtx.tone}. You must read the reason for reaching out and choose the most appropriate, compassionate tone and message. Under 120 words.`,
      `Write the best WhatsApp message for ${firstName} given this situation: "${flagReason}". Choose the most appropriate tone — whether that's gentle concern, warm encouragement, or friendly reminder — and write the most helpful message for this specific patient situation.`,
      180,
    );
    await deliverWhatsApp({ to: phone, body: message });
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
): Promise<{ subtopic: string; content: string }> {
  const hCtx = await getHospitalContext(hospitalId);
  const deptList = departments.length > 0 ? departments.join(", ") : "General Practice";

  const raw = await generateClaudeMessage(
    `You are a wellness content writer for ${hCtx.hospitalName}. Write in a ${hCtx.tone} tone. You write detailed, helpful wellness newsletters that educate the community. Never mention diagnoses or specific patient cases. Write at a general public level. Always address recipients as "friends" — never use the word "patients". Always respond with valid JSON only — no markdown, no code fences, no extra text.`,
    `You are given a broad wellness category. Your job is to:
1. Choose a specific, fresh, interesting subtopic or angle within that category that most people overlook or find surprising. Make it concrete and specific — not the obvious take.
2. Write a detailed weekly wellness newsletter for the community of ${hCtx.hospitalName} (departments: ${deptList}) focused on that specific subtopic.

Broad category: ${topic}

The newsletter must include all of these sections:
- A warm, engaging opening addressed to "Dear Friends" (1-2 sentences referencing the specific subtopic)
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
  "subtopic": "the specific angle or subtopic you chose (short phrase, max 10 words)",
  "content": "the full newsletter text"
}`,
    1600,
  );

  try {
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { subtopic: string; content: string };
    if (typeof parsed.subtopic === "string" && typeof parsed.content === "string") {
      return parsed;
    }
  } catch {
    // Fall back gracefully if Claude returns non-JSON
  }

  // Fallback: treat entire response as content with generic subtopic
  return { subtopic: topic, content: raw };
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
