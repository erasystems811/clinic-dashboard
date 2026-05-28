import { Router } from "express";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { sendEmail, wrapHtml } from "../lib/email.js";
import { getHospitalContext, contactLine } from "../lib/automation.js";
import { signHospitalToken, verifyHospitalToken as _verifyHospitalToken } from "../lib/hospital-auth.js";
import { testSmsDelivery, deliverMobileMessage } from "../lib/messaging.js";
import { invalidateHospitalSessions, getHospitalSessionInvalidatedAt } from "../lib/session-invalidation.js";

const execAsync = promisify(exec);

const router = Router();

// ── Stateless HMAC token auth (survives server restarts) ─────────────────────
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function getSecret(): string {
  return process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";
}

function signToken(username: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${expiry}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expiryStr = payload.split(":")[1];
    if (Date.now() > parseInt(expiryStr, 10)) return false;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

const ADJECTIVES = ["Blue","Swift","Clear","Bright","Strong","Fresh","Bold","Smart","Pure","Calm","Sharp","Quick"];
const NOUNS = ["Star","Rock","Lake","Wave","Tree","Stone","Cloud","River","Eagle","Tiger","Falcon","Peak"];

function generatePassword(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${noun}${num}`;
}

export { verifyHospitalToken } from "../lib/hospital-auth.js";

function parseToneJson(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return raw ? [raw] : []; }
}

function requireSuperAdmin(req: any, res: any, next: any) {
  const token = req.headers["x-super-admin-token"] as string;
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ── Stored credential helpers ─────────────────────────────────────────────────
async function getStoredCredential(): Promise<{ passwordHash: string; salt: string } | null> {
  const { data } = await supabase
    .from("super_admin_credentials")
    .select("password_hash, salt")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  return { passwordHash: data.password_hash as string, salt: data.salt as string };
}

async function verifyAdminPassword(input: string): Promise<boolean> {
  const stored = await getStoredCredential();
  if (stored) {
    const hash = hashPassword(input, stored.salt);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stored.passwordHash));
  }
  // Fall back to env var
  const adminPass = process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(adminPass));
}

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post("/super-admin/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  const adminUser = process.env.SUPER_ADMIN_USERNAME ?? "era_admin";

  if (username !== adminUser) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await verifyAdminPassword(password ?? "");
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.json({ token: signToken(username) });
});

router.post("/super-admin/auth/logout", (req, res): void => {
  res.json({ ok: true });
});

// ── Config (exposes server-side APP_BASE_URL so the frontend builds correct links) ──
router.get("/super-admin/config", requireSuperAdmin, (req, res): void => {
  res.json({
    eraPatientUrl: (process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, ""),
  });
});

router.post("/super-admin/deploy", requireSuperAdmin, async (req, res): Promise<void> => {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    res.status(503).json({ error: "GITHUB_PAT not configured in environment" });
    return;
  }
  try {
    const repoUrl = `https://${pat}@github.com/erasystems811/clinic-dashboard.git`;
    const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

    // Stage all changes
    await execAsync("git add -A", { env: gitEnv });

    // Commit (skip if nothing to commit)
    const label = `Deploy from Era Super Admin ${new Date().toISOString()}`;
    try {
      await execAsync(`git commit -m "${label}"`, { env: gitEnv });
    } catch {
      // nothing to commit — that's fine, still push
    }

    // Push
    const { stdout, stderr } = await execAsync(
      `git push --force "${repoUrl}" HEAD:main`,
      { env: gitEnv, timeout: 60000 },
    );

    res.json({ ok: true, output: (stdout + stderr).trim() || "Pushed successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Strip PAT from any error output
    const safe = msg.replace(pat, "***");
    res.status(500).json({ error: safe });
  }
});

router.post("/super-admin/auth/recover", async (req, res): Promise<void> => {
  const { recoveryKey, newPassword } = req.body ?? {};
  const configuredKey = process.env.SUPER_ADMIN_RECOVERY_KEY;
  if (!configuredKey) {
    res.status(503).json({ error: "Recovery not configured — set SUPER_ADMIN_RECOVERY_KEY in Railway env vars" });
    return;
  }
  if (!recoveryKey || !newPassword) {
    res.status(400).json({ error: "recoveryKey and newPassword are required" });
    return;
  }
  if ((newPassword as string).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  if (!crypto.timingSafeEqual(Buffer.from(recoveryKey), Buffer.from(configuredKey))) {
    res.status(401).json({ error: "Invalid recovery key" });
    return;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, salt);
  await supabase
    .from("super_admin_credentials")
    .upsert({ id: 1, password_hash: newHash, salt, updated_at: new Date().toISOString() });
  res.json({ ok: true });
});

router.post("/super-admin/change-password", requireSuperAdmin, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if ((newPassword as string).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const ok = await verifyAdminPassword(currentPassword);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPassword(newPassword, salt);
  await supabase
    .from("super_admin_credentials")
    .upsert({ id: 1, password_hash: newHash, salt, updated_at: new Date().toISOString() });
  res.json({ ok: true });
});

// ── Hospitals ─────────────────────────────────────────────────────────────────
const CreateHospitalBody = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6).optional(),
  subscriptionStatus: z.enum(["active", "trial", "inactive"]).optional(),
});

router.get("/super-admin/hospitals", requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data: hospitals, error } = await supabase
    .from("hospitals")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const withModules = await Promise.all(
    (hospitals ?? []).map(async (h: Record<string, unknown>) => {
      const [{ data: settings }, { data: modules }] = await Promise.all([
        supabase.from("hospital_settings").select("*").eq("hospital_id", h.id).single(),
        supabase.from("hospital_modules").select("*").eq("hospital_id", h.id).single(),
      ]);
      return { ...camelize(h), settings: settings ? camelize(settings) : null, modules: modules ? camelize(modules) : null };
    })
  );

  res.json(withModules);
});

router.post("/super-admin/hospitals", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateHospitalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, username, subscriptionStatus } = parsed.data;
  const plainPassword = parsed.data.password ?? generatePassword();
  const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(plainPassword, salt)}`;

  const { data: hospital, error } = await supabase.from("hospitals").insert({
    name, slug, username, password_hash: passwordHash,
    current_password: plainPassword,
    active: subscriptionStatus !== "inactive",
    subscription_status: subscriptionStatus ?? "active",
    feedback_slug: crypto.randomUUID(),
    hospital_code: crypto.randomUUID(),
  }).select().single();

  if (error || !hospital) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  await supabase.from("hospital_settings").insert({ hospital_id: hospital.id });
  await supabase.from("hospital_modules").insert({ hospital_id: hospital.id });

  const prefix = name.trim().split(/\s+/)[0].toUpperCase();
  const nursePass = "nurse1234";
  const recepPass = "recep1234";
  const nurseSalt = crypto.randomBytes(16).toString("hex");
  const recepSalt = crypto.randomBytes(16).toString("hex");
  await supabase.from("hospital_staff_credentials").insert({
    hospital_id: hospital.id,
    nurse_username: `${prefix} NURSE`,
    nurse_password_hash: `${nurseSalt}:${hashPassword(nursePass, nurseSalt)}`,
    nurse_plain_password: nursePass,
    receptionist_username: `${prefix} RECEPTIONIST`,
    receptionist_password_hash: `${recepSalt}:${hashPassword(recepPass, recepSalt)}`,
    receptionist_plain_password: recepPass,
  });

  res.status(201).json({ ...camelize(hospital), currentPassword: plainPassword });
});

router.get("/super-admin/hospitals/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let { data: hospital } = await supabase.from("hospitals").select("*").eq("id", id).single();
  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

  // Backfill hospital_code for older hospitals that were created before this field existed
  if (!hospital.hospital_code) {
    const newCode = crypto.randomUUID();
    await supabase.from("hospitals").update({ hospital_code: newCode }).eq("id", id);
    hospital = { ...hospital, hospital_code: newCode };
  }

  const [{ data: settings }, { data: modules }, { data: staffCreds }] = await Promise.all([
    supabase.from("hospital_settings").select("*").eq("hospital_id", id).single(),
    supabase.from("hospital_modules").select("*").eq("hospital_id", id).single(),
    supabase.from("hospital_staff_credentials").select("*").eq("hospital_id", id).single(),
  ]);

  res.json({
    ...camelize(hospital),
    currentPassword: hospital.current_password ?? null,
    settings: settings ? camelize(settings) : null,
    modules: modules ? camelize(modules) : null,
    staffCredentials: staffCreds ? {
      nurseUsername: staffCreds.nurse_username,
      nursePlainPassword: staffCreds.nurse_plain_password ?? "nurse1234",
      receptionistUsername: staffCreds.receptionist_username,
      receptionistPlainPassword: staffCreds.receptionist_plain_password ?? "recep1234",
    } : null,
  });
});

const UpdateHospitalBody = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  subscriptionStatus: z.enum(["active", "trial", "inactive"]).optional(),
  subscriptionExpiresAt: z.string().nullable().optional(),
  password: z.string().min(6).optional(),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
});

router.patch("/super-admin/hospitals/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateHospitalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { password, name, active, subscriptionStatus, subscriptionExpiresAt, contactEmail, contactPhone } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (active !== undefined) updates.active = active;
  if (subscriptionStatus !== undefined) updates.subscription_status = subscriptionStatus;
  if (subscriptionExpiresAt !== undefined) updates.subscription_expires_at = subscriptionExpiresAt;
  if (contactEmail !== undefined) updates.contact_email = contactEmail;
  if (contactPhone !== undefined) updates.contact_phone = contactPhone;
  if (password) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.password_hash = `${salt}:${hashPassword(password, salt)}`;
    updates.current_password = password;
  }

  let { data: hospital, error } = await supabase.from("hospitals").update(updates).eq("id", id).select().single();

  // If subscription_expires_at column doesn't exist yet, retry without it
  if (error && error.message.includes("subscription_expires_at")) {
    const { subscription_expires_at: _dropped, ...updatesWithout } = updates as Record<string, unknown> & { subscription_expires_at?: unknown };
    void _dropped;
    ({ data: hospital, error } = await supabase.from("hospitals").update(updatesWithout).eq("id", id).select().single());
  }

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  res.json({ ...camelize(hospital), currentPassword: hospital.current_password ?? null });
});

// ── Regenerate hospital password ───────────────────────────────────────────────
router.post("/super-admin/hospitals/:id/regenerate-password", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const newPassword = generatePassword();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(newPassword, salt)}`;

  const { data: hospital, error } = await supabase.from("hospitals")
    .update({ password_hash: passwordHash, current_password: newPassword })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const msg = error.message.includes("current_password")
      ? "Missing column: run 'ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS current_password TEXT;' in Supabase"
      : error.message;
    res.status(500).json({ error: msg });
    return;
  }
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  res.json({ newPassword, hospital: camelize(hospital) });
});

// ── Hospital Settings ──────────────────────────────────────────────────────────
const UpdateSettingsBody = z.object({
  departments: z.array(z.string()).optional(),
  pipelinePostTreatmentDays: z.number().int().min(1).nullish(),
  pipelineDormantDays: z.number().int().min(1).nullish(),
  language: z.string().nullish(),
  tone: z.array(z.string()).optional(),
  clinicDescription: z.string().nullish(),
  senderName: z.string().nullish(),
  postTreatmentCheckinDays: z.number().int().min(1).nullish(),
  postCareCheckinDays: z.number().int().min(1).nullish(),
  whatsappFromNumber: z.string().nullish(),
  notificationChannel: z.enum(["whatsapp", "sms"]).nullish(),
  phoneNumber: z.string().nullish(),
  termiiSenderId: z.string().nullish(),
});

router.get("/super-admin/hospitals/:id/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: settings } = await supabase.from("hospital_settings").select("*").eq("hospital_id", id).single();
  if (!settings) { res.status(404).json({ error: "Not found" }); return; }

  const s = camelize<Record<string, unknown>>(settings);
  res.json({
    ...s,
    departments: JSON.parse((settings.departments as string) ?? "[]"),
    tone: parseToneJson(settings.tone as string),
  });
});

router.put("/super-admin/hospitals/:id/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { departments, tone, pipelinePostTreatmentDays, pipelineDormantDays, language, clinicDescription, senderName, postTreatmentCheckinDays, postCareCheckinDays, whatsappFromNumber, notificationChannel, phoneNumber, termiiSenderId } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (departments !== undefined) updates.departments = JSON.stringify(departments);
  if (tone !== undefined) updates.tone = JSON.stringify(tone);
  if (pipelinePostTreatmentDays !== undefined) updates.pipeline_post_treatment_days = pipelinePostTreatmentDays;
  if (pipelineDormantDays !== undefined) updates.pipeline_dormant_days = pipelineDormantDays;
  if (language !== undefined) updates.language = language;
  if (clinicDescription !== undefined) updates.clinic_description = clinicDescription;
  if (senderName !== undefined) updates.sender_name = senderName;
  if (postTreatmentCheckinDays !== undefined) updates.post_treatment_checkin_days = postTreatmentCheckinDays;
  if (postCareCheckinDays !== undefined) updates.post_care_checkin_days = postCareCheckinDays;
  if (whatsappFromNumber !== undefined) updates.whatsapp_from_number = whatsappFromNumber;
  if (notificationChannel !== undefined) updates.notification_channel = notificationChannel;
  if (phoneNumber !== undefined) updates.phone_number = phoneNumber;
  if (termiiSenderId !== undefined) updates.termii_sender_id = termiiSenderId;

  const { data: settings, error } = await supabase
    .from("hospital_settings")
    .update(updates)
    .eq("hospital_id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!settings) { res.status(404).json({ error: "Hospital settings not found" }); return; }
  const s = camelize<Record<string, unknown>>(settings);
  res.json({
    ...s,
    departments: JSON.parse((settings.departments as string) ?? "[]"),
    tone: parseToneJson(settings.tone as string),
  });
});

// ── Hospital Modules ───────────────────────────────────────────────────────────
const UpdateModulesBody = z.object({
  appointmentsEnabled: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
  wellnessNewsletterEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  messagesEnabled: z.boolean().optional(),
});

router.get("/super-admin/hospitals/:id/modules", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: modules } = await supabase.from("hospital_modules").select("*").eq("hospital_id", id).single();
  if (!modules) { res.status(404).json({ error: "Not found" }); return; }

  const base = camelize(modules) as Record<string, unknown>;

  // Columns added via RPC may not be in PostgREST schema cache —
  // always emit them with explicit defaults so the UI never silently resets.
  res.json({
    ...base,
    wellnessNewsletterEnabled: base.wellnessNewsletterEnabled ?? true,
    whatsappEnabled: base.whatsappEnabled ?? false,
    messagesEnabled: base.messagesEnabled ?? false,
  });
});

router.put("/super-admin/hospitals/:id/modules", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateModulesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.appointmentsEnabled !== undefined) updates.appointments_enabled = parsed.data.appointmentsEnabled;
  if (parsed.data.feedbackEnabled !== undefined) updates.feedback_enabled = parsed.data.feedbackEnabled;
  if (parsed.data.wellnessNewsletterEnabled !== undefined) updates.wellness_newsletter_enabled = parsed.data.wellnessNewsletterEnabled;
  if (parsed.data.whatsappEnabled !== undefined) updates.whatsapp_enabled = parsed.data.whatsappEnabled;
  if (parsed.data.messagesEnabled !== undefined) updates.messages_enabled = parsed.data.messagesEnabled;

  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from("hospital_modules").update(updates).eq("hospital_id", id);
    if (updateErr) { res.status(500).json({ error: updateErr.message }); return; }
    // Invalidate all active sessions for this hospital so users are forced to re-login
    // and pick up the new module configuration.
    invalidateHospitalSessions(id);
  }

  const { data: refreshed } = await supabase
    .from("hospital_modules").select("*").eq("hospital_id", id).single();
  if (!refreshed) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    ...camelize(refreshed),
    wellnessNewsletterEnabled: (refreshed as Record<string, unknown>).wellness_newsletter_enabled ?? parsed.data.wellnessNewsletterEnabled ?? true,
    whatsappEnabled: (refreshed as Record<string, unknown>).whatsapp_enabled ?? parsed.data.whatsappEnabled ?? false,
    messagesEnabled: (refreshed as Record<string, unknown>).messages_enabled ?? parsed.data.messagesEnabled ?? false,
  });
  return;
});

// ── Staff login ──────────────────────────────────────────────────────────────
router.post("/staff/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

  const usernameUpper = username.trim().toUpperCase();

  const { data: allCreds } = await supabase.from("hospital_staff_credentials").select("*");
  let matchedCreds: Record<string, unknown> | null = null;
  let matchedRole: "nurse" | "receptionist" | null = null;

  for (const creds of allCreds ?? []) {
    if ((creds.nurse_username as string).toUpperCase() === usernameUpper) {
      matchedCreds = creds; matchedRole = "nurse"; break;
    }
    if ((creds.receptionist_username as string).toUpperCase() === usernameUpper) {
      matchedCreds = creds; matchedRole = "receptionist"; break;
    }
  }

  if (!matchedCreds || !matchedRole) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const hashField = matchedRole === "nurse"
    ? matchedCreds.nurse_password_hash as string
    : matchedCreds.receptionist_password_hash as string;
  const [salt, storedHash] = hashField.split(":");
  if (hashPassword(password, salt) !== storedHash) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const { data: hospital } = await supabase.from("hospitals").select("*").eq("id", matchedCreds.hospital_id).single();
  if (!hospital || !hospital.active) { res.status(403).json({ error: "Account inactive" }); return; }

  const [{ data: settings }, { data: modules }] = await Promise.all([
    supabase.from("hospital_settings").select("*").eq("hospital_id", hospital.id).single(),
    supabase.from("hospital_modules").select("*").eq("hospital_id", hospital.id).single(),
  ]);

  res.json({
    role: matchedRole,
    token: signHospitalToken(hospital.id),
    hospital: { id: hospital.id, name: hospital.name, username: hospital.username },
    departments: JSON.parse((settings?.departments as string) ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointments_enabled ?? true,
      feedbackEnabled: modules?.feedback_enabled ?? true,
      messagesEnabled: modules?.messages_enabled ?? false,
    },
  });
});

// ── Staff credentials ──────────────────────────────────────────────────────────
router.get("/hospital/staff-credentials", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? _verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: creds } = await supabase.from("hospital_staff_credentials").select("*").eq("hospital_id", hospitalId).single();
  if (!creds) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ nurseUsername: creds.nurse_username, receptionistUsername: creds.receptionist_username });
});

router.put("/hospital/staff-credentials", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? _verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { nursePassword, receptionistPassword } = req.body ?? {};
  const updates: Record<string, string> = {};

  if (nursePassword) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.nurse_password_hash = `${salt}:${hashPassword(nursePassword, salt)}`;
  }
  if (receptionistPassword) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.receptionist_password_hash = `${salt}:${hashPassword(receptionistPassword, salt)}`;
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No updates provided" }); return; }

  await supabase.from("hospital_staff_credentials").update(updates).eq("hospital_id", hospitalId);
  res.json({ ok: true });
});

// ── Public hospital lookup ────────────────────────────────────────────────────
router.get("/hospital/lookup/:username", async (req, res): Promise<void> => {
  const username = req.params.username?.toLowerCase();
  const { data: hospital } = await supabase.from("hospitals").select("*").eq("username", username).single();

  if (!hospital || !hospital.active) { res.status(404).json({ error: "Hospital not found" }); return; }

  const [{ data: settings }, { data: modules }] = await Promise.all([
    supabase.from("hospital_settings").select("*").eq("hospital_id", hospital.id).single(),
    supabase.from("hospital_modules").select("*").eq("hospital_id", hospital.id).single(),
  ]);

  res.json({
    id: hospital.id,
    name: hospital.name,
    username: hospital.username,
    departments: JSON.parse((settings?.departments as string) ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointments_enabled ?? true,
      feedbackEnabled: modules?.feedback_enabled ?? true,
      messagesEnabled: modules?.messages_enabled ?? false,
    },
  });
});

// ── Hospital Login ────────────────────────────────────────────────────────────
router.post("/auth/hospital-login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

  const { data: hospital } = await supabase
    .from("hospitals")
    .select("*")
    .eq("username", username.toLowerCase())
    .single();

  if (!hospital) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!hospital.active) { res.status(403).json({ error: "Account inactive" }); return; }

  const [salt, storedHash] = hospital.password_hash.split(":");
  if (hashPassword(password, salt) !== storedHash) { res.status(401).json({ error: "Invalid credentials" }); return; }

  // Auto-generate feedback_slug if the hospital doesn't have one yet
  let feedbackSlug = hospital.feedback_slug as string | null;
  if (!feedbackSlug) {
    feedbackSlug = crypto.randomUUID();
    await supabase.from("hospitals").update({ feedback_slug: feedbackSlug }).eq("id", hospital.id);
  }

  res.json({
    id: hospital.id,
    name: hospital.name,
    username: hospital.username,
    feedbackSlug,
    token: signHospitalToken(hospital.id),
  });
});

// ── Hospital config ───────────────────────────────────────────────────────────
router.get("/hospital/config", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? _verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [{ data: settings }, { data: modules }] = await Promise.all([
    supabase.from("hospital_settings").select("*").eq("hospital_id", hospitalId).single(),
    supabase.from("hospital_modules").select("*").eq("hospital_id", hospitalId).single(),
  ]);

  res.json({
    departments: JSON.parse((settings?.departments as string) ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointments_enabled ?? true,
      feedbackEnabled: modules?.feedback_enabled ?? true,
      messagesEnabled: modules?.messages_enabled ?? false,
      wellnessNewsletterEnabled: (modules as Record<string, unknown>)?.wellness_newsletter_enabled ?? true,
    },
    // Unix ms timestamp of last module change for this hospital.
    // The era-patient client uses this to force re-login if modules changed after login.
    sessionInvalidatedAt: getHospitalSessionInvalidatedAt(hospitalId),
  });
});

// ── Reset Test Data ───────────────────────────────────────────────────────────
router.post("/super-admin/reset-test-data", requireSuperAdmin, async (req, res): Promise<void> => {
  const { hospitalId } = req.body ?? {};
  if (!hospitalId || isNaN(Number(hospitalId))) {
    res.status(400).json({ error: "hospitalId is required — reset is scoped to a single hospital to protect other accounts." });
    return;
  }
  const hid = Number(hospitalId);
  try {
    const patientTables = ["automation_log", "activity", "queue", "call_tasks", "appointments", "feedback", "wellness_newsletter"];
    for (const table of patientTables) {
      await supabase.from(table).delete().eq("hospital_id", hid);
    }
    // patients table uses hospital_id too
    await supabase.from("patients").delete().eq("hospital_id", hid);
    res.json({ ok: true, message: "All patient data cleared for this hospital. Accounts and settings are preserved." });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Reset failed" });
  }
});

// GET /super-admin/health
router.get("/super-admin/health", requireSuperAdmin, async (_req, res): Promise<void> => {
  const checks: { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string; flagged?: boolean; flaggedAt?: string }[] = [];

  // 1. Database
  try {
    const { error } = await supabase.from("hospitals").select("id").limit(1);
    checks.push({ name: "Database", ok: !error, detail: error ? error.message : "Connected" });
  } catch (e) {
    checks.push({ name: "Database", ok: false, detail: e instanceof Error ? e.message : "Unreachable" });
  }

  // Load manual service flags (set by super admin when billing alert email arrives)
  const { data: alertFlags } = await supabase.from("platform_alerts").select("service, alerted_at");
  const flagMap = new Map<string, string>((alertFlags ?? []).map((a: Record<string, string>) => [a.service, a.alerted_at]));

  const isProd = process.env.NODE_ENV === "production";

  // 2. SMS + WhatsApp (Termii) — fetch balance + check last real delivery attempt
  const hasTermii = !!process.env.TERMII_API_KEY;
  const hasSender = !!process.env.TERMII_SENDER_ID;
  const smsOk = hasTermii && hasSender;
  let termiiBalance: number | null = null;
  let termiiBalanceDetail = "";
  if (hasTermii) {
    try {
      const balRes = await fetch(`https://api.ng.termii.com/api/get-balance?api_key=${process.env.TERMII_API_KEY}`);
      if (balRes.ok) {
        const balJson = await balRes.json() as { balance?: number };
        termiiBalance = balJson.balance ?? null;
        termiiBalanceDetail = termiiBalance !== null ? `Balance: ₦${termiiBalance.toFixed(2)}` : "Balance unavailable";
      }
    } catch { termiiBalanceDetail = "Balance check failed"; }
  }
  const lowBalance = termiiBalance !== null && termiiBalance < 50;
  const balanceLabel = termiiBalance !== null ? `₦${termiiBalance.toFixed(2)}` : null;

  // Check last real SMS delivery attempt from automation_log
  const { data: lastSms } = await supabase
    .from("automation_log")
    .select("status, error_message, last_attempted_at")
    .eq("channel", "sms")
    .order("last_attempted_at", { ascending: false })
    .limit(1)
    .single();

  const lastSmsFailure = lastSms?.status === "failed" ? lastSms.error_message : null;

  // Check last real WhatsApp delivery attempt
  const { data: lastWa } = await supabase
    .from("automation_log")
    .select("status, error_message, last_attempted_at")
    .eq("channel", "whatsapp")
    .order("last_attempted_at", { ascending: false })
    .limit(1)
    .single();

  const lastWaFailure = lastWa?.status === "failed" ? lastWa.error_message : null;

  // Red if: low balance OR last real send failed; amber if config missing in dev
  checks.push({
    name: "SMS (Termii)",
    ok: lowBalance || lastSmsFailure ? false : (smsOk || !isProd),
    warning: !lowBalance && !lastSmsFailure && !smsOk && !isProd,
    detail: !hasTermii
      ? (isProd ? "TERMII_API_KEY not set" : "Not set in dev — on Railway")
      : !hasSender
        ? (isProd ? "TERMII_SENDER_ID not set" : "Sender ID not set in dev")
        : lowBalance
          ? "Low credit — top up at termii.com"
          : lastSmsFailure
            ? lastSmsFailure
            : "Configured",
    ...(balanceLabel ? { balance: balanceLabel } : {}),
  });

  // 3. WhatsApp (Termii) — same API key + balance, plus last WA delivery check
  checks.push({
    name: "WhatsApp (Termii)",
    ok: lowBalance || lastWaFailure ? false : (hasTermii || !isProd),
    warning: !lowBalance && !lastWaFailure && !hasTermii && !isProd,
    detail: !hasTermii
      ? (isProd ? "TERMII_API_KEY not set" : "Not set in dev — on Railway")
      : lowBalance
        ? "Low credit — top up at termii.com"
        : lastWaFailure
          ? lastWaFailure
          : "Configured",
    ...(balanceLabel ? { balance: balanceLabel } : {}),
  });

  // 4. Email (Resend)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    checks.push({ name: "Email (Resend)", ok: false, detail: "RESEND_API_KEY not set" });
  } else {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const { error } = await resend.domains.list();

      // Also check last real email delivery attempt from automation_log
      const { data: lastEmail } = await supabase
        .from("automation_log")
        .select("status, error_message, last_attempted_at")
        .eq("channel", "email")
        .order("last_attempted_at", { ascending: false })
        .limit(1)
        .single();

      const lastEmailFailure = lastEmail?.status === "failed" ? lastEmail.error_message : null;
      const keyOk = !error;

      checks.push({
        name: "Email (Resend)",
        ok: keyOk && !lastEmailFailure,
        detail: !keyOk
          ? `API key invalid: ${error!.message}`
          : lastEmailFailure
            ? lastEmailFailure
            : lastEmail?.status === "sent"
              ? "Last email delivered"
              : "Connected — key is valid",
      });
    } catch (e) {
      checks.push({ name: "Email (Resend)", ok: false, detail: e instanceof Error ? e.message : "Resend error" });
    }
  }

  // 4. OpenAI — try billing endpoint for credit balance, fall back to key validity
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    try {
      const billingRes = await fetch("https://api.openai.com/v1/dashboard/billing/credit_grants", {
        headers: { Authorization: `Bearer ${openAIKey}` },
      });
      if (billingRes.ok) {
        const billing = await billingRes.json() as { total_available?: number };
        const available = billing.total_available ?? 0;
        checks.push({
          name: "OpenAI",
          ok: available > 1,
          detail: available > 1 ? "Credits available" : "Credits low or exhausted",
          balance: `$${available.toFixed(2)} left`,
        });
      } else {
        // Billing API not accessible — fall back to key validity via models list
        const modelsRes = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${openAIKey}` },
        });
        checks.push({ name: "OpenAI", ok: modelsRes.ok, detail: modelsRes.ok ? "Key valid" : `Key error (${modelsRes.status})` });
      }
    } catch (e) {
      checks.push({ name: "OpenAI", ok: false, detail: e instanceof Error ? e.message : "OpenAI unreachable" });
    }
  } else {
    checks.push({ name: "OpenAI", ok: !isProd, warning: !isProd, detail: isProd ? "OPENAI_API_KEY not set" : "Not set in dev — on Railway" });
  }

  // 5. Scheduler — check automation_log for last activity
  {
    const schedulerEnabled = process.env.ENABLE_SCHEDULER === "true";
    const { data: lastLog } = await supabase
      .from("automation_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastLog) {
      const hoursAgo = (Date.now() - new Date(lastLog.created_at as string).getTime()) / (1000 * 60 * 60);
      const ok = hoursAgo < 25;
      checks.push({
        name: "Scheduler",
        ok,
        detail: ok ? `Last ran ${Math.round(hoursAgo)}h ago` : `Silent for ${Math.round(hoursAgo)}h`,
      });
    } else {
      checks.push({
        name: "Scheduler",
        ok: !schedulerEnabled,
        warning: !schedulerEnabled,
        detail: schedulerEnabled ? "No automations have run yet" : "No activity yet",
      });
    }
  }

  // Merge manual flags — overrides auto state to red
  for (const c of checks) {
    const flaggedAt = flagMap.get(c.name);
    if (flaggedAt) {
      c.flagged = true;
      c.flaggedAt = flaggedAt;
      c.ok = false;
      c.warning = false;
    }
  }

  const allOk = checks.every(c => c.ok);
  const anyWarning = !allOk ? false : checks.some((c: Record<string, unknown>) => c.warning);
  res.json({ ok: allOk, anyWarning, checks });
});

// POST /super-admin/service-alert — manually flag a service as having a billing issue
router.post("/super-admin/service-alert", requireSuperAdmin, async (req, res): Promise<void> => {
  const { service } = req.body as { service?: string };
  if (!service) { res.status(400).json({ error: "service required" }); return; }
  const { error } = await supabase.from("platform_alerts").upsert({ service, alerted_at: new Date().toISOString() });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// DELETE /super-admin/service-alert/:service — clear a manual flag
router.delete("/super-admin/service-alert/:service", requireSuperAdmin, async (req, res): Promise<void> => {
  const { error } = await supabase.from("platform_alerts").delete().eq("service", req.params.service);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// POST /webhooks/inbound-email — called by Resend inbound routing when a billing alert email arrives
// No auth middleware — secured by INBOUND_EMAIL_SECRET query param instead
// Setup: resend.com → Inbound → route alerts@yourdomain.com → POST https://your-api.railway.app/api/webhooks/inbound-email?secret=INBOUND_EMAIL_SECRET
router.post("/webhooks/inbound-email", async (req, res): Promise<void> => {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (secret && req.query.secret !== secret) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  const { from = "", subject = "", text = "" } = req.body as { from?: string; subject?: string; text?: string };
  const fromLower = (from || "").toLowerCase();
  const subjectLower = (subject || "").toLowerCase();
  const textLower = (text || "").toLowerCase();

  function identifyService(): string | null {
    if (fromLower.includes("openai.com")) return "OpenAI";
    if (fromLower.includes("anthropic.com")) return "Claude (Anthropic)";
    if (fromLower.includes("resend.com") || fromLower.includes("resend.io")) return "Email (Resend)";
    if (fromLower.includes("supabase.io") || fromLower.includes("supabase.com")) return "Database";
    if (fromLower.includes("railway.app")) return "Scheduler";
    if (subjectLower.includes("openai")) return "OpenAI";
    if (subjectLower.includes("anthropic") || subjectLower.includes("claude")) return "Claude (Anthropic)";
    if (subjectLower.includes("resend")) return "Email (Resend)";
    if (subjectLower.includes("supabase")) return "Database";
    if (subjectLower.includes("railway")) return "Scheduler";
    return null;
  }

  const alertKeywords = ["credit", "balance", "billing", "payment", "invoice", "limit", "usage", "low", "threshold", "spending"];
  const isAlert = alertKeywords.some(kw => subjectLower.includes(kw) || textLower.includes(kw));
  const service = identifyService();

  if (!service || !isAlert) {
    console.log(`[inbound-email] Skipped — service=${service ?? "unknown"} isAlert=${isAlert} from="${from}" subject="${subject}"`);
    res.json({ ok: true, action: "skipped" }); return;
  }

  console.log(`[inbound-email] Auto-flagging service=${service} from="${from}" subject="${subject}"`);
  const { error } = await supabase.from("platform_alerts").upsert({ service, alerted_at: new Date().toISOString(), note: `Email: ${subject}` });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, action: "flagged", service });
});

// ── Automation Log (Failed Automations) ───────────────────────────────────────
router.get("/super-admin/automation-log", requireSuperAdmin, async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const hospitalId = req.query.hospitalId ? parseInt(req.query.hospitalId as string, 10) : null;

  let q = supabase
    .from("automation_log")
    .select("*, hospitals(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);
  if (hospitalId) q = q.eq("hospital_id", hospitalId);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map((row: Record<string, unknown>) => ({
    ...camelize(row),
    hospitalName: (row.hospitals as Record<string, unknown> | null)?.name ?? null,
  })));
});

router.post("/super-admin/automation-log/:id/retry", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: log } = await supabase.from("automation_log").select("*").eq("id", id).single();
  if (!log) { res.status(404).json({ error: "Log entry not found" }); return; }

  const channel = log.channel as string;
  const messagePreview = log.message_preview as string | null;
  const hospitalId = log.hospital_id as number;
  const patientId = log.patient_id as number | null;
  const automationType = log.automation_type as string;

  // ── Email retry — reconstruct template and resend directly ────────────────
  if (channel === "email") {
    // Types that require AI regeneration or human approval cannot be auto-retried
    const nonRetryableTypes = ["care_plan_email", "care_plan_visit_reminder", "flagged_task_confirmed", "flagged_task_send", "wellness_newsletter"];
    if (nonRetryableTypes.includes(automationType)) {
      res.status(400).json({ ok: false, message: "This email contains AI-generated or human-approved content and cannot be auto-retried. Re-trigger it manually from the patient or hospital record." });
      return;
    }

    if (!patientId) {
      res.status(400).json({ ok: false, message: "No patient linked to this log entry — cannot retry." });
      return;
    }

    // Look up patient + hospital context in parallel
    const [{ data: patient }, hCtx] = await Promise.all([
      supabase.from("patients").select("first_name, last_name, email").eq("id", patientId).single(),
      getHospitalContext(hospitalId).catch((e: unknown) => { throw e; }),
    ]);

    if (!patient) { res.status(404).json({ ok: false, message: "Patient not found." }); return; }
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const patientEmail = patient.email as string | null;
    if (!patientEmail) { res.status(400).json({ ok: false, message: "Patient has no email address stored." }); return; }

    const contact = contactLine(hCtx.phoneNumber);

    // Mark original entry as in-progress
    await supabase.from("automation_log").update({
      status: "queued",
      error_message: null,
      retry_count: (log.retry_count as number ?? 0) + 1,
      last_attempted_at: new Date().toISOString(),
    }).eq("id", id);

    try {
      let subject = "";
      let body = "";
      let html = "";

      if (automationType === "post_treatment_day1" || automationType === "post_treatment_day4" || automationType === "post_treatment_day7") {
        const day = parseInt(automationType.replace("post_treatment_day", ""), 10) as 1 | 4 | 7;
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
        html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);

      } else if (automationType === "post_care_email") {
        subject = `Thinking of you — ${hCtx.hospitalName}`;
        body = `Hi ${patientName},\n\nIt has been a little while since we last saw you at ${hCtx.hospitalName} and we just wanted to check in and see how you are doing. We hope you are feeling well and taking good care of yourself. Your health and wellbeing mean a lot to us.\n\nIf you ever need anything or feel it is time for a check-up please do not hesitate to ${contact}. Please do not reply to this email directly. We are always here when you need us.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);

      } else if (automationType === "appointment_no_show") {
        subject = `We missed you today — ${hCtx.hospitalName}`;
        body = `Hi ${patientName},\n\nWe noticed you were not able to make your appointment at ${hCtx.hospitalName} today. We hope you are good? We completely understand that life gets busy too sometimes.\n\nWhenever you are ready to rebook please do not hesitate to ${contact}. Please do not reply to this email directly. We are here for you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);

      } else if (automationType === "birthday_email") {
        const firstName = patientName.split(" ")[0];
        subject = `Happy Birthday from ${hCtx.hospitalName} 🎂`;
        body = `Happy Birthday ${firstName}!\n\nToday we pause to celebrate you. At ${hCtx.hospitalName}, you are never just a name in our system — you are someone we genuinely care about, and your birthday gives us a reason to say that out loud.\n\nWe hope today brings you warmth, laughter, and the company of people who love you. And in this new year of your life, we wish you the one thing that makes everything else possible — good health.\n\nFrom everyone at ${hCtx.hospitalName}, Happy Birthday. We are glad you are here.`;
        html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);

      } else if (automationType === "feedback_email") {
        const { data: hosp } = await supabase.from("hospitals").select("feedback_slug").eq("id", hospitalId).single();
        const feedbackSlug = hosp?.feedback_slug as string | null;
        if (!feedbackSlug) { throw new Error("Hospital has no feedback slug configured."); }
        const APP_BASE_URL = process.env.APP_BASE_URL ?? process.env.REPLIT_DEV_DOMAIN ?? "";
        const feedbackUrl = `${APP_BASE_URL}/feedback/h/${feedbackSlug}`;
        subject = `How was your visit? — ${hCtx.hospitalName}`;
        const intro = `Hi ${patientName},\n\nThank you for visiting ${hCtx.hospitalName} yesterday. We hope your experience was a positive one. We would love to hear your thoughts so we can continue to improve our service. Please take a moment to share your feedback using the link below.`;
        const closing = `Your feedback means a lot to us. Please do not reply to this email directly — if you need to reach us please ${contact}.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        html = wrapHtml(
          `<p>${intro.replace(/\n/g, "</p><p>")}</p>
           <p style="text-align:center"><a href="${feedbackUrl}" class="btn">Share Your Feedback →</a></p>
           <p>${closing.replace(/\n/g, "</p><p>")}</p>`,
          hCtx.hospitalName,
        );
        body = `${intro}\n\nShare your feedback: ${feedbackUrl}\n\n${closing}`;

      } else if (automationType === "appointment_confirmation" || automationType === "appointment_reminder_24h" || automationType === "appointment_reminder_2h") {
        const { data: appt } = await supabase.from("appointments")
          .select("scheduled_at").eq("patient_id", patientId).order("scheduled_at", { ascending: false }).limit(1).single();
        if (!appt?.scheduled_at) { throw new Error("Could not find an appointment for this patient."); }
        const scheduledAt = appt.scheduled_at as string;
        const dateStr = new Date(scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
        const timeStr = new Date(scheduledAt).toLocaleString("en-GB", { timeStyle: "short" });
        if (automationType === "appointment_confirmation") {
          subject = `Appointment Confirmed — ${hCtx.hospitalName}`;
          body = `Hi ${patientName},\n\nYour appointment at ${hCtx.hospitalName} has been confirmed for ${dateStr}. Please arrive a few minutes early.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly. We look forward to seeing you.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        } else if (automationType === "appointment_reminder_24h") {
          subject = `Reminder — Your appointment is tomorrow — ${hCtx.hospitalName}`;
          body = `Hi ${patientName},\n\nThis is a friendly reminder that your appointment at ${hCtx.hospitalName} is tomorrow ${dateStr}. We look forward to seeing you.\n\nIf you need to reschedule please do not hesitate to ${contact} as soon as possible. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        } else {
          subject = `Your appointment is in 2 hours — ${hCtx.hospitalName}`;
          body = `Hi ${patientName},\n\nJust a quick reminder that your appointment at ${hCtx.hospitalName} is in 2 hours at ${timeStr}. We will see you soon.\n\nIf you need to reschedule please do not hesitate to ${contact} immediately. Please do not reply to this email directly.\n\nWarm regards,\n${hCtx.hospitalName} Team`;
        }
        html = wrapHtml(`<p>${body.replace(/\n/g, "</p><p>")}</p>`, hCtx.hospitalName);

      } else {
        res.status(400).json({ ok: false, message: `Email retry not supported for automation type: ${automationType}.` });
        return;
      }

      await sendEmail({ to: patientEmail, from: hCtx.fromAddress, subject, html, text: body });
      await supabase.from("automation_log").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_attempted_at: new Date().toISOString(),
        message_preview: `${subject} → ${patientEmail}`,
      }).eq("id", id);
      res.json({ ok: true, message: "Email resent successfully." });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await supabase.from("automation_log").update({
        status: "failed",
        error_message: errMsg,
        last_attempted_at: new Date().toISOString(),
      }).eq("id", id);
      res.status(500).json({ ok: false, message: `Email retry failed: ${errMsg}` });
    }
    return;
  }

  // SMS / WhatsApp — re-send the stored message to the patient's current phone
  if (!messagePreview) {
    res.status(400).json({ ok: false, message: "No message content stored — cannot retry." });
    return;
  }

  if (!patientId) {
    res.status(400).json({ ok: false, message: "No patient linked to this log entry — cannot retry." });
    return;
  }

  // Look up patient phone and hospital sender ID in parallel
  const [{ data: patient }, { data: hSettings }] = await Promise.all([
    supabase.from("patients").select("phone, whatsapp_number").eq("id", patientId).single(),
    supabase.from("hospital_settings").select("termii_sender_id, notification_channel").eq("hospital_id", log.hospital_id).single(),
  ]);

  if (!patient) {
    res.status(404).json({ ok: false, message: "Patient not found." });
    return;
  }

  const phone = (channel === "whatsapp"
    ? (patient.whatsapp_number as string | null) || (patient.phone as string | null)
    : (patient.phone as string | null));

  if (!phone) {
    res.status(400).json({ ok: false, message: "Patient has no phone number stored." });
    return;
  }

  const sendChannel = (channel === "whatsapp" ? "whatsapp" : "sms") as "whatsapp" | "sms";
  const senderId = (hSettings?.termii_sender_id as string | null) ?? undefined;

  // Mark as in-progress and send
  await supabase.from("automation_log").update({
    status: "queued",
    error_message: null,
    retry_count: (log.retry_count as number ?? 0) + 1,
    last_attempted_at: new Date().toISOString(),
  }).eq("id", id);

  try {
    await deliverMobileMessage(sendChannel, phone, messagePreview, { senderId });
    await supabase.from("automation_log").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
    }).eq("id", id);
    res.json({ ok: true, message: "Retry sent successfully." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase.from("automation_log").update({
      status: "failed",
      error_message: errMsg,
      last_attempted_at: new Date().toISOString(),
    }).eq("id", id);
    res.status(500).json({ ok: false, message: `Retry failed: ${errMsg}` });
  }
});

// ── Test SMS delivery ─────────────────────────────────────────────────────────
// POST /super-admin/test-sms  { to: "2348012345678", senderId?: "Era", channel?: "dnd"|"generic" }
router.post("/super-admin/test-sms", requireSuperAdmin, async (req, res): Promise<void> => {
  const { to, senderId, channel } = req.body ?? {};
  if (!to) { res.status(400).json({ error: "Missing 'to' phone number" }); return; }
  let phone = String(to).replace(/\s+/g, "");
  if (phone.startsWith("0")) phone = "234" + phone.slice(1);
  const ch = channel === "dnd" ? "dnd" : "generic";
  const result = await testSmsDelivery(phone, senderId ? String(senderId) : undefined, ch);
  res.status(200).json(result);
});

router.post("/super-admin/test-email", requireSuperAdmin, async (req, res): Promise<void> => {
  const { to } = req.body ?? {};
  if (!to || typeof to !== "string" || !to.includes("@")) {
    res.status(400).json({ error: "Missing or invalid 'to' email address" });
    return;
  }
  const fromEmail = process.env.PLATFORM_FROM_EMAIL || "onboarding@resend.dev";
  const from = `Era Systems <${fromEmail}>`;
  try {
    await sendEmail({
      to,
      from,
      subject: "Era Platform — Email Delivery Test",
      html: wrapHtml(
        `<p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 12px">Email delivery confirmed ✓</p>
         <p>This is a test message from your Era Systems platform. If you received this, your Resend configuration is working correctly.</p>
         <p style="margin-top:16px;color:#8b949e;font-size:13px">Sent from: <strong style="color:#c9d1d9">${fromEmail}</strong></p>`,
        "Era Systems"
      ),
      text: `Era Platform email test — if you received this, Resend is configured correctly. Sent from: ${fromEmail}`,
    });
    res.json({ ok: true, to, from });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

// ── GET /super-admin/usage-stats ─────────────────────────────────────────────
// Current-month rolling averages (patients/day, emails/day, sms/day) — resets 1st.
// History: each past month's own avg/day (events in that month ÷ days in that month),
// mirroring exactly what the live counter showed at month-end before it reset.
router.get("/super-admin/usage-stats", requireSuperAdmin, async (_req, res) => {
  const now      = new Date();
  const nowMs    = now.getTime();
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Current month window
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const daysElapsed = Math.max(1, now.getDate());

  function monthLabel(y: number, m: number) { return `${MONTH_NAMES[m]} ${y}`; }
  function endOfMonth(y: number, m: number) { return new Date(y, m + 1, 0, 23, 59, 59, 999).getTime(); }

  // 48 completed months (4 years): each has a startMs, endMs, daysInMonth, label
  const completedMonths = Array.from({ length: 48 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 48 + i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const startMs = d.getTime();
    const endMs   = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime(); // last ms of the month
    const nextMs  = new Date(y, m + 1, 1).getTime();                  // exclusive upper bound for counting
    const daysInMonth = new Date(y, m + 1, 0).getDate();              // 28/29/30/31
    return { y, m, startMs, endMs, nextMs, daysInMonth, label: monthLabel(y, m) };
  });

  // Fetch all data in parallel (all-time, no date cutoff)
  const [hospitalsRes, allAutoRes, allPatientsRes, allActivityRes] = await Promise.all([
    supabase.from("hospitals").select("id, name, active, hospital_code, created_at").order("name"),
    // All automation_log ever — need created_at and channel
    supabase.from("automation_log").select("hospital_id, channel, created_at")
      .neq("patient_id", -1).limit(500000),
    // All patients — for totalPatients count and patient_id→hospital fallback
    supabase.from("patients").select("id, hospital_id").limit(500000),
    // Activity log: every queue check-in event (checkin = re-visit, patient_created = new registration)
    supabase.from("activity").select("type, hospital_id, patient_id, created_at")
      .in("type", ["checkin", "patient_created"]).limit(500000),
  ]);

  const hospitals = hospitalsRes.data ?? [];

  // Build lookup: hospital_code (TEXT) → integer id
  const codeToId = new Map<string, number>();
  for (const h of hospitals) {
    if (h.hospital_code) codeToId.set(h.hospital_code, h.id);
  }

  // Total registered patients per hospital (keyed by hospital_code UUID)
  const patientCountByCode = new Map<string, number>();
  // patient integer id → integer hospital id (fallback for old activity rows missing hospital_id)
  const pidToHid = new Map<number, number>();
  for (const p of (allPatientsRes.data ?? []) as { id: number; hospital_id: string }[]) {
    if (p.hospital_id) {
      patientCountByCode.set(p.hospital_id, (patientCountByCode.get(p.hospital_id) ?? 0) + 1);
      const intId = codeToId.get(p.hospital_id);
      if (intId !== undefined) pidToHid.set(p.id, intId);
    }
  }

  // Build per-hospital event lists (sorted timestamps for efficient cumulative scan)
  // patientTs: keyed by integer hospital id, one timestamp per queue check-in event
  const patientTs = new Map<number, number[]>();
  const emailTs   = new Map<number, number[]>();
  const smsTs     = new Map<number, number[]>();

  for (const a of (allActivityRes.data ?? []) as { type: string; hospital_id: number | null; patient_id: number | null; created_at: string }[]) {
    // hospital_id is an integer on activity rows; fall back to pid lookup for old rows
    const id = a.hospital_id ?? (a.patient_id != null ? pidToHid.get(a.patient_id) : undefined);
    if (id === undefined) continue;
    const ts = new Date(a.created_at).getTime();
    if (isNaN(ts)) continue;
    if (!patientTs.has(id)) patientTs.set(id, []);
    patientTs.get(id)!.push(ts);
  }
  for (const r of (allAutoRes.data ?? []) as { hospital_id: number; channel: string; created_at: string }[]) {
    const ts  = new Date(r.created_at).getTime();
    const map = (r.channel === "email") ? emailTs : smsTs;
    if (!map.has(r.hospital_id)) map.set(r.hospital_id, []);
    map.get(r.hospital_id)!.push(ts);
  }

  // Sort all lists ascending
  for (const arr of [...patientTs.values(), ...emailTs.values(), ...smsTs.values()]) arr.sort((a,b) => a-b);

  // countUpTo: how many timestamps in arr are <= cutoffMs
  function countUpTo(arr: number[] | undefined, cutoffMs: number): number {
    if (!arr || arr.length === 0) return 0;
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; arr[mid] <= cutoffMs ? (lo = mid + 1) : (hi = mid); }
    return lo;
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const currentMonthLabel = monthLabel(now.getFullYear(), now.getMonth());
  const currentMonthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const stats = hospitals.map(h => {
    const createdAtDate = h.created_at ? new Date(h.created_at as string) : null;
    const createdAtMs   = createdAtDate ? createdAtDate.getTime() : nowMs;
    const daysSince     = Math.max(1, (nowMs - createdAtMs) / 86_400_000);
    // Days this hospital was actually active in the current month (handles mid-month creation)
    const createdThisMonth = createdAtDate &&
      createdAtDate.getFullYear() === now.getFullYear() &&
      createdAtDate.getMonth() === now.getMonth();
    const effectiveDaysThisMonth = createdThisMonth
      ? Math.max(1, daysElapsed - createdAtDate!.getDate() + 1)
      : daysElapsed;

    const hq = patientTs.get(h.id);
    const he = emailTs.get(h.id);
    const hs = smsTs.get(h.id);

    // Current month counts (events >= monthStart)
    const allPatients = countUpTo(hq, nowMs);
    const beforeMonth = countUpTo(hq, currentMonthStartMs - 1);
    const allEmails   = countUpTo(he, nowMs);
    const beforeEmail = countUpTo(he, currentMonthStartMs - 1);
    const allSms      = countUpTo(hs, nowMs);
    const beforeSms   = countUpTo(hs, currentMonthStartMs - 1);

    const cPatients = allPatients - beforeMonth;
    const cEmails   = allEmails   - beforeEmail;
    const cSms      = allSms      - beforeSms;

    // History: per-month avg/day — events IN that month ÷ days in that month
    // This is exactly what the Live tab would have shown at month-end before resetting.
    const history = completedMonths.map(cm => {
      // Hospital didn't exist yet → blank slot (keeps all 12 columns aligned)
      if (cm.endMs <= createdAtMs) {
        return { label: cm.label, patients: 0, emails: 0, sms: 0, avgPatientsDay: 0, avgEmailsDay: 0, avgSmsDay: 0 };
      }
      // Count events strictly within this calendar month
      const beforeStart = countUpTo(hq, cm.startMs - 1);
      const atEnd       = countUpTo(hq, cm.endMs);
      const monthPatients = atEnd - beforeStart;

      const eBeforeStart = countUpTo(he, cm.startMs - 1);
      const eAtEnd       = countUpTo(he, cm.endMs);
      const monthEmails  = eAtEnd - eBeforeStart;

      const sBeforeStart = countUpTo(hs, cm.startMs - 1);
      const sAtEnd       = countUpTo(hs, cm.endMs);
      const monthSms     = sAtEnd - sBeforeStart;

      // Divide by days hospital was active in this month, not the full month length
      const createdInHistMonth = createdAtDate &&
        createdAtDate.getFullYear() === cm.y && createdAtDate.getMonth() === cm.m;
      const effectiveDays = createdInHistMonth
        ? Math.max(1, cm.daysInMonth - createdAtDate!.getDate() + 1)
        : cm.daysInMonth;
      return {
        label:          cm.label,
        patients:       monthPatients,
        emails:         monthEmails,
        sms:            monthSms,
        avgPatientsDay: r1(monthPatients / effectiveDays),
        avgEmailsDay:   r1(monthEmails   / effectiveDays),
        avgSmsDay:      r1(monthSms      / effectiveDays),
      };
    });

    const totalPatients = patientCountByCode.get(h.hospital_code ?? "") ?? 0;

    return {
      id:             h.id,
      name:           h.name,
      active:         h.active,
      createdAt:      h.created_at as string | null,
      daysSince:      Math.floor(daysSince),
      totalPatients,
      currentMonth: {
        label:          currentMonthLabel,
        daysElapsed:    effectiveDaysThisMonth,
        patients:       cPatients,
        emails:         cEmails,
        sms:            cSms,
        avgPatientsDay: r1(cPatients / effectiveDaysThisMonth),
        avgEmailsDay:   r1(cEmails   / effectiveDaysThisMonth),
        avgSmsDay:      r1(cSms      / effectiveDaysThisMonth),
      },
      history,
    };
  });

  stats.sort((a, b) => b.currentMonth.avgPatientsDay - a.currentMonth.avgPatientsDay);
  res.json({ stats });
});

export default router;
