import { Router } from "express";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { sendEmail, wrapHtml } from "../lib/email.js";
import { signHospitalToken, verifyHospitalToken as _verifyHospitalToken } from "../lib/hospital-auth.js";
import { testSmsDelivery } from "../lib/messaging.js";
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
    eraPatientUrl: (process.env.APP_BASE_URL ?? "https://app.erasystem.com.ng").replace(/\/$/, ""),
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
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // 1. Database
  try {
    const { error } = await supabase.from("hospitals").select("id").limit(1);
    checks.push({ name: "Database", ok: !error, detail: error ? error.message : "Connected" });
  } catch (e) {
    checks.push({ name: "Database", ok: false, detail: e instanceof Error ? e.message : "Unreachable" });
  }

  const isProd = process.env.NODE_ENV === "production";

  // 2. SMS (Termii)
  const hasTermii = !!process.env.TERMII_API_KEY;
  const hasSender = !!process.env.TERMII_SENDER_ID;
  const smsOk = hasTermii && hasSender;
  checks.push({
    name: "SMS (Termii)",
    ok: smsOk || !isProd,
    warning: !smsOk && !isProd,
    detail: smsOk ? "API key + sender ID configured" : isProd ? (!hasTermii ? "TERMII_API_KEY not set" : "TERMII_SENDER_ID not set") : (!hasTermii ? "TERMII_API_KEY not set" : "TERMII_SENDER_ID not set in dev — configured on Railway"),
  });

  // 3. WhatsApp (Termii) — same API key as SMS; from-number is per-hospital config
  checks.push({
    name: "WhatsApp (Termii)",
    ok: hasTermii || !isProd,
    warning: !hasTermii && !isProd,
    detail: hasTermii ? "Shared API key configured — from-number set per hospital" : isProd ? "TERMII_API_KEY not set" : "TERMII_API_KEY not set in dev — configured on Railway",
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
      checks.push({
        name: "Email (Resend)",
        ok: !error,
        detail: error ? `API key invalid: ${error.message}` : "Connected — key is valid",
      });
    } catch (e) {
      checks.push({ name: "Email (Resend)", ok: false, detail: e instanceof Error ? e.message : "Resend error" });
    }
  }

  // 4. Scheduler
  const schedulerEnabled = process.env.ENABLE_SCHEDULER === "true";
  checks.push({
    name: "Scheduler",
    ok: schedulerEnabled || !isProd,
    warning: !schedulerEnabled && !isProd,
    detail: schedulerEnabled ? "Running" : isProd ? "Not running — set ENABLE_SCHEDULER=true" : "Off in dev — runs automatically on Railway",
  });

  const allOk = checks.every(c => c.ok);
  const anyWarning = !allOk ? false : checks.some((c: Record<string, unknown>) => c.warning);
  res.json({ ok: allOk, anyWarning, checks });
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

  await supabase.from("automation_log").update({
    status: "queued",
    error_message: null,
    retry_count: (log.retry_count as number ?? 0) + 1,
    last_attempted_at: new Date().toISOString(),
  }).eq("id", id);

  res.json({ ok: true, message: "Marked for retry. The automation will be re-attempted on the next scheduler run." });
});

// ── Test SMS delivery ─────────────────────────────────────────────────────────
// POST /super-admin/test-sms  { to: "2348012345678", senderId?: "Era" }
router.post("/super-admin/test-sms", requireSuperAdmin, async (req, res): Promise<void> => {
  const { to, senderId } = req.body ?? {};
  if (!to) { res.status(400).json({ error: "Missing 'to' phone number" }); return; }
  // Normalise Nigerian local format → international (09012345678 → 2349012345678)
  let phone = String(to).replace(/\s+/g, "");
  if (phone.startsWith("0")) phone = "234" + phone.slice(1);
  const result = await testSmsDelivery(phone, senderId ? String(senderId) : undefined);
  res.status(200).json(result);
});

export default router;
