/**
 * Email delivery — supports Resend (default) and Amazon SES.
 *
 * Switch provider by setting:
 *   EMAIL_PROVIDER=ses   → uses Amazon SES (much cheaper at volume)
 *   EMAIL_PROVIDER=resend (or unset) → uses Resend (easier setup, good for early stage)
 *
 * Resend:  RESEND_API_KEY
 * SES:     AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (e.g. eu-west-1)
 *
 * When to switch to SES:
 *   Resend free tier: 3,000 emails/month
 *   Resend paid: ~$20/month for 50k emails
 *   SES: $0.10 per 1,000 emails — 50k costs $5. Switch when you have many hospitals.
 */

import { Resend } from "resend";
import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { supabase } from "./supabase.js";

export interface EmailPayload {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
}

// ── Resend ────────────────────────────────────────────────────────────────────

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

async function sendViaResend(payload: EmailPayload): Promise<string> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: payload.from,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? "sent";
}

// ── Amazon SES ────────────────────────────────────────────────────────────────

let _sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (!_sesClient) {
    const region = process.env.AWS_REGION ?? "eu-west-1";
    const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set for SES");
    }
    _sesClient = new SESClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _sesClient;
}

async function sendViaSes(payload: EmailPayload): Promise<string> {
  const ses = getSesClient();
  const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to];

  // SES requires the from address to be a verified identity.
  // The "Display Name <email@domain.com>" format is supported.
  const params: SendEmailCommandInput = {
    Source: payload.from,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: payload.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: payload.html, Charset: "UTF-8" },
        ...(payload.text ? { Text: { Data: payload.text, Charset: "UTF-8" } } : {}),
      },
    },
  };

  const result = await ses.send(new SendEmailCommand(params));
  return result.MessageId ?? "sent";
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── Monthly volume tracking for automatic Resend → SES switchover ─────────────
// Resend's free tier is 3,000 emails/month. Once this month's email count crosses
// the threshold, all further emails route through SES automatically — keeping you
// inside the free tier without any manual change.
//
// The count is kept in a dedicated `email_counters` table that is ONLY ever
// touched by this function — so every single email (including bulk sends) is
// counted exactly, and the count survives server restarts.
const RESEND_MONTHLY_THRESHOLD = 2900;

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Read the current month's count from the exact counter table.
async function getMonthCount(monthKey: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("email_counters")
      .select("count")
      .eq("month_key", monthKey)
      .maybeSingle();
    return (data?.count as number) ?? 0;
  } catch {
    return 0; // if read fails, assume under threshold — worst case we use Resend slightly longer
  }
}

// Atomically add to the counter and return the new total.
async function bumpMonthCount(monthKey: string, by: number): Promise<number> {
  try {
    const { data } = await supabase.rpc("increment_email_count", { p_month_key: monthKey, p_by: by });
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}

export async function sendEmail(payload: EmailPayload): Promise<string> {
  const explicitProvider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();

  // If the operator has explicitly forced a provider, always honour it
  // (no counting needed).
  if (explicitProvider === "ses") {
    return sendViaSes(payload);
  }
  if (explicitProvider === "resend") {
    return sendViaResend(payload);
  }

  // Auto mode (no EMAIL_PROVIDER set): use Resend until the monthly threshold,
  // then automatically switch to SES for the rest of the month.
  const monthKey = currentMonthKey();
  const recipients = Array.isArray(payload.to) ? payload.to.length : 1;

  const countSoFar = await getMonthCount(monthKey);
  const useSes = countSoFar >= RESEND_MONTHLY_THRESHOLD && !!process.env.AWS_ACCESS_KEY_ID;

  const id = useSes ? await sendViaSes(payload) : await sendViaResend(payload);

  // Record this send exactly (atomic increment) — only after a successful send
  const newTotal = await bumpMonthCount(monthKey, recipients);

  if (newTotal >= RESEND_MONTHLY_THRESHOLD && countSoFar < RESEND_MONTHLY_THRESHOLD) {
    if (process.env.AWS_ACCESS_KEY_ID) {
      console.log(`[email] Monthly Resend threshold (${RESEND_MONTHLY_THRESHOLD}) reached — routing further emails via SES for the rest of ${monthKey}`);
    } else {
      console.warn(`[email] Monthly Resend threshold (${RESEND_MONTHLY_THRESHOLD}) reached but AWS/SES is not configured — still using Resend. Set AWS keys to enable auto-switch.`);
    }
  }

  return id;
}

// ── Email template ────────────────────────────────────────────────────────────

export interface FeedbackEmailData {
  hospitalName: string;
  patientName?: string | null;
  rating: number;
  waitTimeRating?: number | null;
  staffFriendlinessRating?: number | null;
  qualityOfCareRating?: number | null;
  wouldRecommend?: boolean | null;
  comment?: string | null;
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function buildFeedbackEmail(data: FeedbackEmailData): { subject: string; html: string; text: string } {
  const subject = `New Feedback Received — ${data.hospitalName}`;

  const rows: string[] = [];
  rows.push(`<tr><td style="padding:6px 0;color:#8b949e;font-size:13px;width:160px">Overall Experience</td><td style="padding:6px 0;color:#e6edf3;font-size:15px;font-weight:700">${stars(data.rating)} ${data.rating}/5</td></tr>`);
  if (data.waitTimeRating) rows.push(`<tr><td style="padding:6px 0;color:#8b949e;font-size:13px">Wait Time</td><td style="padding:6px 0;color:#e6edf3;font-size:13px">${stars(data.waitTimeRating)} ${data.waitTimeRating}/5</td></tr>`);
  if (data.staffFriendlinessRating) rows.push(`<tr><td style="padding:6px 0;color:#8b949e;font-size:13px">Staff Friendliness</td><td style="padding:6px 0;color:#e6edf3;font-size:13px">${stars(data.staffFriendlinessRating)} ${data.staffFriendlinessRating}/5</td></tr>`);
  if (data.qualityOfCareRating) rows.push(`<tr><td style="padding:6px 0;color:#8b949e;font-size:13px">Quality of Care</td><td style="padding:6px 0;color:#e6edf3;font-size:13px">${stars(data.qualityOfCareRating)} ${data.qualityOfCareRating}/5</td></tr>`);
  if (data.wouldRecommend != null) rows.push(`<tr><td style="padding:6px 0;color:#8b949e;font-size:13px">Would Recommend</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:${data.wouldRecommend ? "#22c55e" : "#ef4444"}">${data.wouldRecommend ? "✓ Yes" : "✗ No"}</td></tr>`);

  const fromLine = data.patientName
    ? `<p style="font-size:14px;color:#8b949e;margin:0 0 20px">From <strong style="color:#c9d1d9">${data.patientName}</strong></p>`
    : `<p style="font-size:14px;color:#8b949e;margin:0 0 20px">Anonymous submission</p>`;

  const commentBlock = data.comment
    ? `<div style="margin-top:20px;padding:14px 16px;background:#0d1117;border-left:3px solid #14b8a6;border-radius:0 8px 8px 0"><p style="margin:0;font-size:14px;color:#c9d1d9;font-style:italic">"${data.comment}"</p></div>`
    : "";

  const body = `
    <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 6px">A patient just submitted feedback.</p>
    ${fromLine}
    <table style="width:100%;border-collapse:collapse">${rows.join("")}</table>
    ${commentBlock}
  `;

  const html = wrapHtml(body, data.hospitalName);

  const text = [
    `New Feedback — ${data.hospitalName}`,
    data.patientName ? `From: ${data.patientName}` : "Anonymous",
    `Overall: ${data.rating}/5`,
    data.waitTimeRating ? `Wait Time: ${data.waitTimeRating}/5` : "",
    data.staffFriendlinessRating ? `Staff Friendliness: ${data.staffFriendlinessRating}/5` : "",
    data.qualityOfCareRating ? `Quality of Care: ${data.qualityOfCareRating}/5` : "",
    data.wouldRecommend != null ? `Would Recommend: ${data.wouldRecommend ? "Yes" : "No"}` : "",
    data.comment ? `Comment: ${data.comment}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

export function wrapHtml(body: string, hospitalName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0d1117; color:#e6edf3; margin:0; padding:20px; }
    .card { max-width:600px; margin:0 auto; background:#161b22; border-radius:12px; padding:32px; border:1px solid #30363d; }
    .header { text-align:center; margin-bottom:24px; }
    .logo { display:inline-block; width:48px; height:48px; background:linear-gradient(135deg,#14b8a6,#0d9488); border-radius:12px; margin-bottom:12px; }
    h1 { font-size:20px; font-weight:700; color:#e6edf3; margin:0 0 4px; }
    .subtitle { font-size:13px; color:#8b949e; }
    .content { font-size:15px; line-height:1.7; color:#c9d1d9; }
    .btn { display:inline-block; margin:20px 0; padding:12px 28px; background:#14b8a6; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }
    .footer { margin-top:24px; padding-top:20px; border-top:1px solid #30363d; font-size:12px; color:#8b949e; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo"></div>
      <h1>${hospitalName}</h1>
    </div>
    <div class="content">${body}</div>
    <div class="footer">${hospitalName} · Sent via Era Patient</div>
  </div>
</body>
</html>`;
}
