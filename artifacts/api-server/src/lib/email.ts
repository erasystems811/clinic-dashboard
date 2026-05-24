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
