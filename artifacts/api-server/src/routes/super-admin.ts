import { Router } from "express";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db, hospitalsTable, hospitalSettingsTable, hospitalModulesTable, hospitalStaffCredentialsTable } from "@workspace/db";
import { z } from "zod/v4";

const router = Router();

// ── Stateless HMAC token auth (survives server restarts) ─────────────────────
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    return null;
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
  // Stateless — client just drops the token
  res.json({ ok: true });
});

// ── Hospitals ─────────────────────────────────────────────────────────────────
const CreateHospitalBody = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  subscriptionStatus: z.enum(["active", "trial", "inactive"]).optional(),
});

router.get("/super-admin/hospitals", requireSuperAdmin, async (_req, res): Promise<void> => {
  const hospitals = await db
    .select()
    .from(hospitalsTable)
    .orderBy(hospitalsTable.createdAt);

  const withModules = await Promise.all(
    hospitals.map(async (h) => {
      const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, h.id));
      const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, h.id));
      return { ...h, settings: settings ?? null, modules: modules ?? null };
    })
  );

  res.json(withModules);
});

router.post("/super-admin/hospitals", requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateHospitalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, username, password, subscriptionStatus } = parsed.data;
  const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(password, salt)}`;

  const [hospital] = await db.insert(hospitalsTable).values({
    name, slug, username, passwordHash,
    active: subscriptionStatus !== "inactive",
    subscriptionStatus: subscriptionStatus ?? "active",
  }).returning();

  await db.insert(hospitalSettingsTable).values({ hospitalId: hospital.id });
  await db.insert(hospitalModulesTable).values({ hospitalId: hospital.id });

  // Auto-generate staff credentials from hospital name (first word = prefix)
  const prefix = name.trim().split(/\s+/)[0].toUpperCase();
  const nurseSalt = crypto.randomBytes(16).toString("hex");
  const recepSalt = crypto.randomBytes(16).toString("hex");
  await db.insert(hospitalStaffCredentialsTable).values({
    hospitalId: hospital.id,
    nurseUsername: `${prefix} NURSE`,
    nursePasswordHash: `${nurseSalt}:${hashPassword("nurse1234", nurseSalt)}`,
    receptionistUsername: `${prefix} RECEPTIONIST`,
    receptionistPasswordHash: `${recepSalt}:${hashPassword("recep1234", recepSalt)}`,
  });

  res.status(201).json(hospital);
});

router.get("/super-admin/hospitals/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, id));
  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

  const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, id));
  const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, id));

  res.json({ ...hospital, settings: settings ?? null, modules: modules ?? null });
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

  const { password, ...rest } = parsed.data;
  const updates: Record<string, any> = { ...rest };

  if (password) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.passwordHash = `${salt}:${hashPassword(password, salt)}`;
  }

  const [hospital] = await db.update(hospitalsTable).set(updates).where(eq(hospitalsTable.id, id)).returning();
  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

  res.json(hospital);
});

// ── Hospital Settings ──────────────────────────────────────────────────────────
const UpdateSettingsBody = z.object({
  departments: z.array(z.string()).optional(),
  pipelinePostTreatmentDays: z.number().int().min(1).optional(),
  pipelineDormantDays: z.number().int().min(1).optional(),
  language: z.string().optional(),
  tone: z.array(z.string()).optional(),
  clinicDescription: z.string().optional(),
});

router.get("/super-admin/hospitals/:id/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, id));
  if (!settings) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    ...settings,
    departments: JSON.parse(settings.departments ?? "[]"),
    tone: parseToneJson(settings.tone),
  });
});

router.put("/super-admin/hospitals/:id/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { departments, tone, ...rest } = parsed.data;
  const updates: Record<string, any> = { ...rest };
  if (departments !== undefined) updates.departments = JSON.stringify(departments);
  if (tone !== undefined) updates.tone = JSON.stringify(tone);

  const [settings] = await db
    .update(hospitalSettingsTable)
    .set(updates)
    .where(eq(hospitalSettingsTable.hospitalId, id))
    .returning();

  if (!settings) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    ...settings,
    departments: JSON.parse(settings.departments ?? "[]"),
    tone: parseToneJson(settings.tone),
  });
});

// ── Hospital Modules ───────────────────────────────────────────────────────────
const UpdateModulesBody = z.object({
  appointmentsEnabled: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
});

router.get("/super-admin/hospitals/:id/modules", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, id));
  if (!modules) { res.status(404).json({ error: "Not found" }); return; }

  res.json(modules);
});

router.put("/super-admin/hospitals/:id/modules", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateModulesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [modules] = await db
    .update(hospitalModulesTable)
    .set(parsed.data)
    .where(eq(hospitalModulesTable.hospitalId, id))
    .returning();

  if (!modules) { res.status(404).json({ error: "Not found" }); return; }
  res.json(modules);
});

// ── Staff login (public — nurse/receptionist authenticate with their username + password) ──
router.post("/staff/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

  const usernameUpper = username.trim().toUpperCase();

  // Search all hospitals for matching nurse or receptionist username
  const allCreds = await db.select().from(hospitalStaffCredentialsTable);
  let matchedCreds = null;
  let matchedRole: "nurse" | "receptionist" | null = null;

  for (const creds of allCreds) {
    if (creds.nurseUsername.toUpperCase() === usernameUpper) {
      matchedCreds = creds; matchedRole = "nurse"; break;
    }
    if (creds.receptionistUsername.toUpperCase() === usernameUpper) {
      matchedCreds = creds; matchedRole = "receptionist"; break;
    }
  }

  if (!matchedCreds || !matchedRole) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const hashField = matchedRole === "nurse" ? matchedCreds.nursePasswordHash : matchedCreds.receptionistPasswordHash;
  const [salt, storedHash] = hashField.split(":");
  if (hashPassword(password, salt) !== storedHash) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, matchedCreds.hospitalId));
  if (!hospital || !hospital.active) { res.status(403).json({ error: "Account inactive" }); return; }

  const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, hospital.id));
  const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, hospital.id));

  res.json({
    role: matchedRole,
    hospital: { id: hospital.id, name: hospital.name, username: hospital.username },
    departments: JSON.parse(settings?.departments ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointmentsEnabled ?? true,
      feedbackEnabled: modules?.feedbackEnabled ?? true,
    },
  });
});

// ── Staff credentials (admin can read + update nurse/receptionist passwords) ──
router.get("/hospital/staff-credentials", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [creds] = await db.select().from(hospitalStaffCredentialsTable).where(eq(hospitalStaffCredentialsTable.hospitalId, hospitalId));
  if (!creds) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ nurseUsername: creds.nurseUsername, receptionistUsername: creds.receptionistUsername });
});

router.put("/hospital/staff-credentials", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { nursePassword, receptionistPassword } = req.body ?? {};
  const updates: Record<string, string> = {};

  if (nursePassword) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.nursePasswordHash = `${salt}:${hashPassword(nursePassword, salt)}`;
  }
  if (receptionistPassword) {
    const salt = crypto.randomBytes(16).toString("hex");
    updates.receptionistPasswordHash = `${salt}:${hashPassword(receptionistPassword, salt)}`;
  }

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No updates provided" }); return; }

  await db.update(hospitalStaffCredentialsTable).set(updates).where(eq(hospitalStaffCredentialsTable.hospitalId, hospitalId));
  res.json({ ok: true });
});

// ── Public hospital lookup (for staff login — returns name + config, no auth needed)
router.get("/hospital/lookup/:username", async (req, res): Promise<void> => {
  const username = req.params.username?.toLowerCase();
  const [hospital] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.username, username));

  if (!hospital || !hospital.active) { res.status(404).json({ error: "Hospital not found" }); return; }

  const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, hospital.id));
  const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, hospital.id));

  res.json({
    id: hospital.id,
    name: hospital.name,
    username: hospital.username,
    departments: JSON.parse(settings?.departments ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointmentsEnabled ?? true,
      feedbackEnabled: modules?.feedbackEnabled ?? true,
    },
  });
});

// ── Hospital Login (used by era-patient to validate hospital admin credentials)
router.post("/auth/hospital-login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

  const [hospital] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.username, username.toLowerCase()));

  if (!hospital) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!hospital.active) { res.status(403).json({ error: "Account inactive" }); return; }

  const [salt, storedHash] = hospital.passwordHash.split(":");
  const inputHash = hashPassword(password, salt);

  if (inputHash !== storedHash) { res.status(401).json({ error: "Invalid credentials" }); return; }

  res.json({
    id: hospital.id,
    name: hospital.name,
    username: hospital.username,
    token: signHospitalToken(hospital.id),
  });
});

// ── Hospital config (used by era-patient after hospital login) ────────────────
router.get("/hospital/config", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, hospitalId));
  const [modules] = await db.select().from(hospitalModulesTable).where(eq(hospitalModulesTable.hospitalId, hospitalId));

  res.json({
    departments: JSON.parse(settings?.departments ?? "[]"),
    modules: {
      appointmentsEnabled: modules?.appointmentsEnabled ?? true,
      feedbackEnabled: modules?.feedbackEnabled ?? true,
    },
  });
});

export default router;
