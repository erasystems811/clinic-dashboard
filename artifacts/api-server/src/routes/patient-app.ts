import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { sendEmail } from "../lib/email.js";
import {
  signPatientToken,
  hashPassword,
  verifyPassword,
  generateOtp,
  generatePassword,
  generateResetToken,
  getPatientFromRequest,
} from "../lib/patient-auth.js";

const router: IRouter = Router();
const FROM = `ERA Me <${process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev"}>`;

// ── Email templates ────────────────────────────────────────────────────────────

function otpEmail(username: string, otp: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">ERA Me</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your personal health companion</p>
  </div>
  <div style="padding:32px 24px;">
    <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi <strong>${username}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Enter this code to verify your email and complete your registration:</p>
    <div style="background:#f0f7ff;border:2px dashed #93c5fd;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#2563eb;font-family:monospace;">${otp}</span>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  </div>
</div></body></html>`;
}

function welcomeEmail(username: string, password: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Welcome to ERA Me</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your account is ready</p>
  </div>
  <div style="padding:32px 24px;">
    <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi <strong>${username}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Your ERA Me account has been created. Here is your auto-generated password — save it somewhere safe:</p>
    <div style="background:#f0f7ff;border:2px dashed #93c5fd;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:700;letter-spacing:3px;color:#1e40af;font-family:monospace;">${password}</span>
    </div>
    <div style="background:#fefce8;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#92400e;font-size:14px;"><strong>Important:</strong> Change this password in your Profile settings after your first login.</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px;">Your username is: <strong style="color:#111827;">${username}</strong></p>
  </div>
</div></body></html>`;
}

function resetEmail(username: string, resetUrl: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">ERA Me</h1>
  </div>
  <div style="padding:32px 24px;">
    <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi <strong>${username}</strong>,</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">We received a request to reset your password. Click the button below:</p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">Reset My Password</a>
    </div>
    <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">This link expires in <strong>1 hour</strong>. If you did not request this, ignore this email.</p>
  </div>
</div></body></html>`;
}

// ── Register: send OTP ─────────────────────────────────────────────────────────
router.post("/patient-app/register/send-otp", async (req, res): Promise<void> => {
  const body = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
    email: z.email(),
    phone: z.string().min(7),
    accountType: z.enum(["individual", "family"]).default("individual"),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  const { username, email } = body.data;

  const { data: existingEmail } = await supabase.from("patient_accounts").select("id").eq("email", email).maybeSingle();
  if (existingEmail) { res.status(409).json({ error: "An account with this email already exists. Try logging in instead.", code: "EMAIL_EXISTS" }); return; }

  const { data: existingUsername } = await supabase.from("patient_accounts").select("id").eq("username", username).maybeSingle();
  if (existingUsername) { res.status(409).json({ error: "This username is already taken. Please choose another.", code: "USERNAME_TAKEN" }); return; }

  // Invalidate previous unused OTPs for this email
  await supabase.from("patient_otp_codes").update({ used_at: new Date().toISOString() }).eq("email", email).is("used_at", null);

  const otp = generateOtp();
  await supabase.from("patient_otp_codes").insert({
    email,
    code: otp,
    purpose: "register",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  try {
    await sendEmail({ to: email, from: FROM, subject: "Your ERA Me verification code", html: otpEmail(username, otp) });
  } catch (err) {
    console.error("[patient-app] OTP email failed:", err);
    res.status(500).json({ error: "Failed to send verification email. Check your email address and try again." });
    return;
  }

  res.json({ ok: true });
});

// ── Register: verify OTP and create account ────────────────────────────────────
router.post("/patient-app/register/verify", async (req, res): Promise<void> => {
  const body = z.object({
    username: z.string().min(3).max(30),
    email: z.email(),
    phone: z.string().min(7),
    accountType: z.enum(["individual", "family"]).default("individual"),
    otp: z.string().length(6),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  const { username, email, phone, accountType, otp } = body.data;

  const { data: otpRow } = await supabase
    .from("patient_otp_codes")
    .select("id")
    .eq("email", email)
    .eq("code", otp)
    .eq("purpose", "register")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow) { res.status(400).json({ error: "Invalid or expired code. Please request a new one." }); return; }

  await supabase.from("patient_otp_codes").update({ used_at: new Date().toISOString() }).eq("id", otpRow.id);

  const { data: existingEmail } = await supabase.from("patient_accounts").select("id").eq("email", email).maybeSingle();
  if (existingEmail) { res.status(409).json({ error: "An account with this email already exists." }); return; }

  const { data: existingUser } = await supabase.from("patient_accounts").select("id").eq("username", username).maybeSingle();
  if (existingUser) { res.status(409).json({ error: "This username was just taken. Please choose another." }); return; }

  const plainPassword = generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  const { data: account, error } = await supabase.from("patient_accounts").insert({
    username,
    email,
    phone,
    account_type: accountType,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id, username, email, account_type, theme_color, dark_mode").single();

  if (error || !account) { res.status(500).json({ error: "Failed to create account. Please try again." }); return; }

  sendEmail({ to: email, from: FROM, subject: "Your ERA Me password", html: welcomeEmail(username, plainPassword) }).catch(() => {});

  const token = signPatientToken(account.id as number);

  res.status(201).json({
    token,
    account: {
      id: account.id,
      username: account.username,
      email: account.email,
      accountType: account.account_type,
      themeColor: (account.theme_color as string) ?? "blue",
      darkMode: (account.dark_mode as boolean) ?? false,
    },
  });
});

// ── Login: look up accounts by phone ──────────────────────────────────────────
router.post("/patient-app/login/lookup", async (req, res): Promise<void> => {
  const body = z.object({ phone: z.string().min(7) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid phone number" }); return; }

  const { data } = await supabase
    .from("patient_accounts")
    .select("username, display_name")
    .eq("phone", body.data.phone);

  if (!data || data.length === 0) {
    res.status(404).json({ error: "No account found with this phone number." });
    return;
  }

  res.json({
    accounts: data.map((a) => ({
      username: a.username as string,
      displayName: (a.display_name as string | null) ?? (a.username as string),
    })),
  });
});

// ── Login: authenticate ────────────────────────────────────────────────────────
router.post("/patient-app/login", async (req, res): Promise<void> => {
  const body = z.object({ username: z.string(), password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Username and password are required" }); return; }

  const { data: account } = await supabase
    .from("patient_accounts")
    .select("id, username, email, account_type, password_hash, theme_color, dark_mode, display_name")
    .eq("username", body.data.username)
    .maybeSingle();

  if (!account) { res.status(401).json({ error: "Incorrect username or password" }); return; }

  const valid = await verifyPassword(body.data.password, account.password_hash as string);
  if (!valid) { res.status(401).json({ error: "Incorrect username or password" }); return; }

  const token = signPatientToken(account.id as number);

  res.json({
    token,
    account: {
      id: account.id,
      username: account.username,
      email: account.email,
      accountType: account.account_type,
      displayName: (account.display_name as string | null) ?? null,
      themeColor: (account.theme_color as string) ?? "blue",
      darkMode: (account.dark_mode as boolean) ?? false,
    },
  });
});

// ── Forgot password ────────────────────────────────────────────────────────────
router.post("/patient-app/forgot-password", async (req, res): Promise<void> => {
  const body = z.object({ email: z.email() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Valid email required" }); return; }

  const { data: account } = await supabase
    .from("patient_accounts")
    .select("id, username")
    .eq("email", body.data.email)
    .maybeSingle();

  if (!account) { res.json({ ok: true }); return; } // no enumeration

  const token = generateResetToken();
  await supabase.from("patient_reset_tokens").insert({
    account_id: account.id,
    token,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const appUrl = (process.env.ERA_ME_URL ?? "http://localhost:3001").replace(/\/$/, "");
  sendEmail({
    to: body.data.email,
    from: FROM,
    subject: "Reset your ERA Me password",
    html: resetEmail(account.username as string, `${appUrl}/reset-password?token=${token}`),
  }).catch(() => {});

  res.json({ ok: true });
});

// ── Reset password ─────────────────────────────────────────────────────────────
router.post("/patient-app/reset-password", async (req, res): Promise<void> => {
  const body = z.object({
    token: z.string(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  const { data: resetRow } = await supabase
    .from("patient_reset_tokens")
    .select("id, account_id")
    .eq("token", body.data.token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!resetRow) { res.status(400).json({ error: "This reset link is invalid or has expired." }); return; }

  await supabase.from("patient_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", resetRow.id);
  await supabase.from("patient_accounts").update({
    password_hash: await hashPassword(body.data.newPassword),
    updated_at: new Date().toISOString(),
  }).eq("id", resetRow.account_id);

  res.json({ ok: true });
});

// ── Get current account ────────────────────────────────────────────────────────
router.get("/patient-app/me", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_accounts")
    .select("id, username, email, phone, account_type, display_name, gender, date_of_birth, background, theme_color, dark_mode, created_at")
    .eq("id", account.id)
    .single();

  if (!data) { res.status(404).json({ error: "Account not found" }); return; }

  res.json({
    id: data.id,
    username: data.username,
    email: data.email,
    phone: data.phone,
    accountType: data.account_type,
    displayName: data.display_name,
    gender: data.gender,
    dateOfBirth: data.date_of_birth,
    background: data.background,
    themeColor: (data.theme_color as string) ?? "blue",
    darkMode: (data.dark_mode as boolean) ?? false,
    createdAt: data.created_at,
  });
});

// ── Update profile ─────────────────────────────────────────────────────────────
router.patch("/patient-app/me", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({
    displayName: z.string().max(60).optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().optional(),
    background: z.string().optional(),
    themeColor: z.enum(["blue", "purple", "green", "orange", "teal", "rose", "slate"]).optional(),
    darkMode: z.boolean().optional(),
    newPassword: z.string().min(8).optional(),
    currentPassword: z.string().optional(),
  }).safeParse(req.body);

  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.displayName !== undefined) updates.display_name = body.data.displayName;
  if (body.data.gender !== undefined) updates.gender = body.data.gender;
  if (body.data.dateOfBirth !== undefined) updates.date_of_birth = body.data.dateOfBirth;
  if (body.data.background !== undefined) updates.background = body.data.background;
  if (body.data.themeColor !== undefined) updates.theme_color = body.data.themeColor;
  if (body.data.darkMode !== undefined) updates.dark_mode = body.data.darkMode;

  if (body.data.newPassword) {
    if (!body.data.currentPassword) { res.status(400).json({ error: "Current password required to set a new password" }); return; }
    const { data: current } = await supabase.from("patient_accounts").select("password_hash").eq("id", account.id).single();
    const valid = await verifyPassword(body.data.currentPassword, current?.password_hash as string);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    updates.password_hash = await hashPassword(body.data.newPassword);
  }

  await supabase.from("patient_accounts").update(updates).eq("id", account.id);
  res.json({ ok: true });
});

export default router;
