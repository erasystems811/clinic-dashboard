import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export interface EmailPayload {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<string> {
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
