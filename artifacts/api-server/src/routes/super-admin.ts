import { Router } from "express";
import crypto from "crypto";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";

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

function signHospitalToken(hospitalId: number): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `h:${hospitalId}:${expiry}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyHospitalToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const parts = payload.split(":");
    if (parts[0] !== "h") return null;
    const expiry = parseInt(parts[2], 10);
    if (Date.now() > expiry) return null;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    return parseInt(parts[1], 10);
  } catch {
    return false as unknown as null;
  }
}

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

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post("/super-admin/auth/login", (req, res): void => {
  const { username, password } = req.body ?? {};
  const adminUser = process.env.SUPER_ADMIN_USERNAME ?? "era_admin";
  const adminPass = process.env.SUPER_ADMIN_PASSWORD ?? "EraAdmin2024!";

  if (username !== adminUser || password !== adminPass) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.json({ token: signToken(username) });
});

router.post("/super-admin/auth/logout", (req, res): void => {
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

  const { data: hospital } = await supabase.from("hospitals").select("*").eq("id", id).single();
  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

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
  password: z.string().min(6).optional(),
});

router.patch("/super-admin/hospitals/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateHospitalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { password, name, active, subscriptionStatus } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (active !== undefined) updates.active = active;
  if (subscriptionStatus !== undefined) updates.subscription_status = subscriptionStatus;
  if (password) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.password_hash = `${salt}:${hashPassword(password, salt)}`;
    updates.current_password = password;
  }

  const { data: hospital, error } = await supabase.from("hospitals").update(updates).eq("id", id).select().single();
  if (error || !hospital) { res.status(404).json({ error: "Not found" }); return; }

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

  if (error || !hospital) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ newPassword, hospital: camelize(hospital) });
});

// ── Hospital Settings ──────────────────────────────────────────────────────────
const UpdateSettingsBody = z.object({
  departments: z.array(z.string()).optional(),
  pipelinePostTreatmentDays: z.number().int().min(1).optional(),
  pipelineDormantDays: z.number().int().min(1).optional(),
  language: z.string().optional(),
  tone: z.array(z.string()).optional(),
  clinicDescription: z.string().optional(),
  sendingEmail: z.string().optional(),
  postTreatmentCheckinDays: z.number().int().min(1).optional(),
  postCareCheckinDays: z.number().int().min(1).optional(),
  whatsappFromNumber: z.string().optional(),
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

  const { departments, tone, pipelinePostTreatmentDays, pipelineDormantDays, language, clinicDescription, sendingEmail, postTreatmentCheckinDays, postCareCheckinDays, whatsappFromNumber } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (departments !== undefined) updates.departments = JSON.stringify(departments);
  if (tone !== undefined) updates.tone = JSON.stringify(tone);
  if (pipelinePostTreatmentDays !== undefined) updates.pipeline_post_treatment_days = pipelinePostTreatmentDays;
  if (pipelineDormantDays !== undefined) updates.pipeline_dormant_days = pipelineDormantDays;
  if (language !== undefined) updates.language = language;
  if (clinicDescription !== undefined) updates.clinic_description = clinicDescription;
  if (sendingEmail !== undefined) updates.sending_email = sendingEmail;
  if (postTreatmentCheckinDays !== undefined) updates.post_treatment_checkin_days = postTreatmentCheckinDays;
  if (postCareCheckinDays !== undefined) updates.post_care_checkin_days = postCareCheckinDays;
  if (whatsappFromNumber !== undefined) updates.whatsapp_from_number = whatsappFromNumber;

  const { data: settings, error } = await supabase
    .from("hospital_settings")
    .update(updates)
    .eq("hospital_id", id)
    .select()
    .single();

  if (error || !settings) { res.status(404).json({ error: "Not found" }); return; }
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

  res.json(camelize(modules));
});

router.put("/super-admin/hospitals/:id/modules", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateModulesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Step 1: update schema-cached columns via standard client
  const knownUpdates: Record<string, unknown> = {};
  if (parsed.data.appointmentsEnabled !== undefined) knownUpdates.appointments_enabled = parsed.data.appointmentsEnabled;
  if (parsed.data.feedbackEnabled !== undefined) knownUpdates.feedback_enabled = parsed.data.feedbackEnabled;

  if (Object.keys(knownUpdates).length > 0) {
    const { error: knownErr } = await supabase
      .from("hospital_modules").update(knownUpdates).eq("hospital_id", id);
    if (knownErr) { res.status(500).json({ error: knownErr.message }); return; }
  }

  // Step 2: update new columns via void RPC (bypasses schema cache)
  const hasNewCols = parsed.data.wellnessNewsletterEnabled !== undefined
    || parsed.data.whatsappEnabled !== undefined
    || parsed.data.messagesEnabled !== undefined;

  if (hasNewCols) {
    const { data: current } = await supabase
      .from("hospital_modules").select("appointments_enabled,feedback_enabled").eq("hospital_id", id).single();
    if (!current) { res.status(404).json({ error: "Not found" }); return; }

    const { error: rpcErr } = await supabase.rpc("set_hospital_module_flags", {
      p_hospital_id: id,
      p_wellness_newsletter_enabled: parsed.data.wellnessNewsletterEnabled ?? true,
      p_whatsapp_enabled: parsed.data.whatsappEnabled ?? false,
      p_messages_enabled: parsed.data.messagesEnabled ?? false,
    });
    if (rpcErr) { res.status(500).json({ error: rpcErr.message }); return; }
  }

  // Step 3: return refreshed row (only schema-cached columns + known booleans)
  const { data: refreshed } = await supabase
    .from("hospital_modules").select("*").eq("hospital_id", id).single();
  if (!refreshed) { res.status(404).json({ error: "Not found" }); return; }

  // Merge the new-column values from the request since PostgREST won't return them yet
  const merged = {
    ...camelize(refreshed),
    wellnessNewsletterEnabled: parsed.data.wellnessNewsletterEnabled ?? true,
    whatsappEnabled: parsed.data.whatsappEnabled ?? false,
    messagesEnabled: parsed.data.messagesEnabled ?? false,
  };
  res.json(merged);
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
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: creds } = await supabase.from("hospital_staff_credentials").select("*").eq("hospital_id", hospitalId).single();
  if (!creds) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ nurseUsername: creds.nurse_username, receptionistUsername: creds.receptionist_username });
});

router.put("/hospital/staff-credentials", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
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

  res.json({
    id: hospital.id,
    name: hospital.name,
    username: hospital.username,
    token: signHospitalToken(hospital.id),
  });
});

// ── Hospital config ───────────────────────────────────────────────────────────
router.get("/hospital/config", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
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
    },
  });
});

// ── Reset Test Data ───────────────────────────────────────────────────────────
router.post("/super-admin/reset-test-data", requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const tables = [
      "automation_log",
      "activity",
      "queue",
      "call_tasks",
      "appointments",
      "feedback",
      "wellness_newsletter",
      "patients",
    ];
    for (const table of tables) {
      await supabase.from(table).delete().neq("id", 0);
    }
    res.json({ ok: true, message: "All test data cleared. Hospital accounts and settings are preserved." });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Reset failed" });
  }
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

export default router;
