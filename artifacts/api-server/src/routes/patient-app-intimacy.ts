import { createHash } from "crypto";
import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { z } from "zod/v4";

const router: IRouter = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

function hashPin(pin: string, accountId: number): string {
  return createHash("sha256").update(`${pin}:${accountId}:era-intimacy`).digest("hex");
}

async function getAge(accountId: number): Promise<number | null> {
  const { data } = await supabase.from("patient_accounts").select("date_of_birth").eq("id", accountId).single();
  const dob = data?.date_of_birth as string | null;
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

// ── POST save DOB — one-time only, locked after first save ───────────────────
router.post("/patient-app/intimacy/save-dob", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  // If DOB is already on the account, do not allow changing it — return existing age
  const { data: existing } = await supabase.from("patient_accounts").select("date_of_birth").eq("id", account.id).single();
  if (existing?.date_of_birth) {
    const age = Math.floor((Date.now() - new Date(existing.date_of_birth as string).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    res.json({ ok: true, age, ageOk: age >= 18 });
    return;
  }

  const body = z.object({ dob: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid date" }); return; }

  await supabase.from("patient_accounts").update({ date_of_birth: body.data.dob }).eq("id", account.id);

  const age = Math.floor((Date.now() - new Date(body.data.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  res.json({ ok: true, age, ageOk: age >= 18 });
});

// ── GET settings ──────────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/settings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const age = await getAge(account.id);
  const ageOk = age !== null && age >= 18;

  const { data } = await supabase
    .from("patient_intimacy_settings")
    .select("mode, freaky_mode_enabled, weekly_frequency_goal, contraception, last_sti_test, sti_test_interval_months, partner_id, notes")
    .eq("account_id", account.id)
    .maybeSingle();

  res.json({
    isSetUp: !!data,
    ageOk,
    age,
    settings: data ? {
      mode: data.mode as string,
      freakyMode: data.freaky_mode_enabled as boolean,
      weeklyGoal: data.weekly_frequency_goal as number | null,
      contraception: data.contraception as string | null,
      lastStiTest: data.last_sti_test as string | null,
      stiTestIntervalMonths: (data.sti_test_interval_months as number) ?? 6,
      hasPartner: !!(data.partner_id),
      notes: data.notes as string | null,
    } : null,
  });
});

// ── POST setup (first time) ───────────────────────────────────────────────────
router.post("/patient-app/intimacy/setup", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({
    pin: z.string().min(4).max(8).regex(/^\d+$/),
    mode: z.enum(["celibacy", "active"]),
    dob: z.string().optional(),
    celibacyStartDate: z.string().optional(),
    weeklyGoal: z.number().int().min(1).max(21).optional(),
    contraception: z.string().max(100).optional(),
    celibacyReason: z.string().max(50).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid input" }); return; }

  // Age verification
  if (body.data.dob) {
    await supabase.from("patient_accounts").update({ date_of_birth: body.data.dob }).eq("id", account.id);
  }
  const age = await getAge(account.id);
  if (age === null) { res.status(403).json({ error: "Date of birth required" }); return; }
  if (age < 18) { res.status(403).json({ error: "This feature is only available for ages 18 and above" }); return; }

  const pinHash = hashPin(body.data.pin, account.id);
  const { error } = await supabase.from("patient_intimacy_settings").upsert({
    account_id: account.id,
    mode: body.data.mode,
    pin_hash: pinHash,
    weekly_frequency_goal: body.data.weeklyGoal ?? null,
    contraception: body.data.contraception ?? null,
    sti_test_interval_months: 6,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });

  if (error) { res.status(500).json({ error: "Setup failed" }); return; }

  if (body.data.mode === "celibacy") {
    await supabase.from("patient_celibacy_streaks").insert({
      account_id: account.id,
      start_date: body.data.celibacyStartDate ?? todayStr(),
      reason: body.data.celibacyReason ?? "personal",
    });
  }

  res.json({ ok: true });
});

// ── POST verify PIN ───────────────────────────────────────────────────────────
router.post("/patient-app/intimacy/verify-pin", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({ pin: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid" }); return; }

  const { data } = await supabase
    .from("patient_intimacy_settings")
    .select("pin_hash")
    .eq("account_id", account.id)
    .single();

  if (!data) { res.status(404).json({ error: "Not set up" }); return; }

  const ok = hashPin(body.data.pin, account.id) === (data.pin_hash as string);
  if (!ok) { res.status(401).json({ error: "Wrong PIN" }); return; }

  res.json({ ok: true });
});

// ── PUT settings update ───────────────────────────────────────────────────────
router.put("/patient-app/intimacy/settings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({
    mode: z.enum(["celibacy", "active"]).optional(),
    freakyMode: z.boolean().optional(),
    weeklyGoal: z.number().int().min(1).max(21).nullable().optional(),
    contraception: z.string().max(100).nullable().optional(),
    lastStiTest: z.string().nullable().optional(),
    stiTestIntervalMonths: z.number().int().min(1).max(24).optional(),
    celibacyStartDate: z.string().optional(),
    celibacyReason: z.string().max(50).optional(),
    notes: z.string().max(500).nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid" }); return; }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.mode !== undefined) patch.mode = body.data.mode;
  if (body.data.freakyMode !== undefined) patch.freaky_mode_enabled = body.data.freakyMode;
  if (body.data.weeklyGoal !== undefined) patch.weekly_frequency_goal = body.data.weeklyGoal;
  if (body.data.contraception !== undefined) patch.contraception = body.data.contraception;
  if (body.data.lastStiTest !== undefined) patch.last_sti_test = body.data.lastStiTest;
  if (body.data.stiTestIntervalMonths !== undefined) patch.sti_test_interval_months = body.data.stiTestIntervalMonths;
  if (body.data.notes !== undefined) patch.notes = body.data.notes;

  await supabase.from("patient_intimacy_settings").update(patch).eq("account_id", account.id);

  // Switching to celibacy → close old streak, open new one
  if (body.data.mode === "celibacy") {
    await supabase.from("patient_celibacy_streaks")
      .update({ end_date: todayStr() }).eq("account_id", account.id).is("end_date", null);
    await supabase.from("patient_celibacy_streaks").insert({
      account_id: account.id,
      start_date: body.data.celibacyStartDate ?? todayStr(),
      reason: body.data.celibacyReason ?? "personal",
    });
  }

  res.json({ ok: true });
});

// ── GET celibacy data ─────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/celibacy", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: streak } = await supabase
    .from("patient_celibacy_streaks")
    .select("start_date, reason")
    .eq("account_id", account.id)
    .is("end_date", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: history } = await supabase
    .from("patient_celibacy_streaks")
    .select("start_date, end_date, reason")
    .eq("account_id", account.id)
    .not("end_date", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: todayCheckin } = await supabase
    .from("patient_celibacy_checkins")
    .select("maintained")
    .eq("account_id", account.id)
    .eq("check_date", todayStr())
    .maybeSingle();

  const daysFree = streak?.start_date
    ? Math.max(0, Math.floor((Date.now() - new Date(streak.start_date as string).getTime()) / 86400000))
    : 0;

  res.json({
    streak: streak ? { startDate: streak.start_date, daysFree, reason: streak.reason } : null,
    todayCheckin: todayCheckin ? { maintained: todayCheckin.maintained } : null,
    history: (history ?? []).map((h) => ({
      startDate: h.start_date,
      endDate: h.end_date,
      days: h.end_date
        ? Math.floor((new Date(h.end_date as string).getTime() - new Date(h.start_date as string).getTime()) / 86400000)
        : 0,
      reason: h.reason,
    })),
  });
});

// ── POST celibacy check-in ────────────────────────────────────────────────────
router.post("/patient-app/intimacy/celibacy/checkin", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({ maintained: z.boolean(), notes: z.string().max(300).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid" }); return; }

  const today = todayStr();
  await supabase.from("patient_celibacy_checkins").upsert({
    account_id: account.id, check_date: today,
    maintained: body.data.maintained, notes: body.data.notes ?? null,
  }, { onConflict: "account_id,check_date" });

  if (!body.data.maintained) {
    await supabase.from("patient_celibacy_streaks")
      .update({ end_date: today }).eq("account_id", account.id).is("end_date", null);
  }

  res.json({ ok: true });
});

// ── GET sessions ──────────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/sessions", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const since = new Date(); since.setDate(since.getDate() - 6);
  const sinceStr = since.toISOString().split("T")[0];

  const { data: week } = await supabase
    .from("patient_intimacy_sessions")
    .select("id, session_date, type, duration_minutes, satisfaction, emotional_connection, libido_level, postinor_taken")
    .eq("account_id", account.id)
    .gte("session_date", sinceStr)
    .order("session_date", { ascending: false });

  const { count: totalCount } = await supabase
    .from("patient_intimacy_sessions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);

  const monthStart = new Date(); monthStart.setDate(1);
  const { count: monthCount } = await supabase
    .from("patient_intimacy_sessions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id)
    .gte("session_date", monthStart.toISOString().split("T")[0]);

  res.json({
    week: (week ?? []).map((s) => ({
      id: s.id, date: s.session_date, type: s.type,
      durationMinutes: s.duration_minutes, satisfaction: s.satisfaction,
      emotionalConnection: s.emotional_connection, libidoLevel: s.libido_level,
      postinorTaken: s.postinor_taken,
    })),
    stats: { totalSessions: totalCount ?? 0, thisWeek: (week ?? []).length, thisMonth: monthCount ?? 0 },
  });
});

// ── POST log session ──────────────────────────────────────────────────────────
router.post("/patient-app/intimacy/sessions", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({
    type: z.enum(["solo", "partnered"]).default("partnered"),
    date: z.string().optional(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    protectionUsed: z.boolean().optional(),
    postinorTaken: z.boolean().default(false),
    satisfaction: z.number().int().min(1).max(5).optional(),
    emotionalConnection: z.number().int().min(1).max(5).optional(),
    libidoLevel: z.number().int().min(1).max(5).optional(),
    physicalComfort: z.number().int().min(1).max(5).optional(),
    positionIds: z.array(z.string()).max(10).optional(),
    notes: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid" }); return; }

  const sessionDate = body.data.date ?? todayStr();
  const { data: session, error } = await supabase.from("patient_intimacy_sessions").insert({
    account_id: account.id,
    session_date: sessionDate,
    type: body.data.type,
    duration_minutes: body.data.durationMinutes ?? null,
    protection_used: body.data.protectionUsed ?? null,
    postinor_taken: body.data.postinorTaken,
    satisfaction: body.data.satisfaction ?? null,
    emotional_connection: body.data.emotionalConnection ?? null,
    libido_level: body.data.libidoLevel ?? null,
    physical_comfort: body.data.physicalComfort ?? null,
    notes: body.data.notes ?? null,
  }).select("id").single();

  if (error || !session) { res.status(500).json({ error: "Failed to log session" }); return; }

  if (body.data.positionIds?.length) {
    await supabase.from("patient_session_positions").insert(
      body.data.positionIds.map((pid) => ({
        session_id: session.id as number,
        account_id: account.id,
        position_id: pid,
      }))
    );
  }

  if (body.data.postinorTaken) {
    const nextSafe = new Date(sessionDate);
    nextSafe.setDate(nextSafe.getDate() + 28);
    await supabase.from("patient_postinor_logs").insert({
      account_id: account.id, taken_at: sessionDate,
      next_safe_date: nextSafe.toISOString().split("T")[0],
    });
  }

  res.json({ ok: true, sessionId: session.id });
});

// ── GET position stats ────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/positions/stats", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_session_positions")
    .select("position_id, satisfaction")
    .eq("account_id", account.id);

  const counts: Record<string, { count: number; total: number }> = {};
  for (const row of data ?? []) {
    const pid = row.position_id as string;
    if (!counts[pid]) counts[pid] = { count: 0, total: 0 };
    counts[pid].count++;
    if (row.satisfaction) counts[pid].total += row.satisfaction as number;
  }

  const stats = Object.entries(counts).map(([positionId, { count, total }]) => ({
    positionId, count,
    avgSatisfaction: count > 0 ? Math.round((total / count) * 10) / 10 : null,
  })).sort((a, b) => b.count - a.count);

  res.json({ stats });
});

// ── GET postinor data ─────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/postinor", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("patient_postinor_logs")
    .select("taken_at, next_safe_date, notes")
    .eq("account_id", account.id)
    .order("taken_at", { ascending: false })
    .limit(10);

  const logs = (data ?? []).map((l) => ({ takenAt: l.taken_at, nextSafeDate: l.next_safe_date, notes: l.notes }));
  const latest = logs[0] ?? null;
  const today = todayStr();
  const safeNow = !latest || (latest.nextSafeDate as string) <= today;
  const daysToSafe = latest && !safeNow
    ? Math.ceil((new Date(latest.nextSafeDate as string).getTime() - Date.now()) / 86400000)
    : null;

  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentCount = logs.filter((l) => (l.takenAt as string) >= sixMonthsAgo.toISOString().split("T")[0]).length;

  res.json({ logs, latest, safeNow, daysToSafe, recentCount });
});

// ── POST log postinor ─────────────────────────────────────────────────────────
router.post("/patient-app/intimacy/postinor", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({ takenAt: z.string().optional(), notes: z.string().max(300).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid" }); return; }

  const takenDate = body.data.takenAt ?? todayStr();
  const nextSafe = new Date(takenDate); nextSafe.setDate(nextSafe.getDate() + 28);

  await supabase.from("patient_postinor_logs").insert({
    account_id: account.id, taken_at: takenDate,
    next_safe_date: nextSafe.toISOString().split("T")[0],
    notes: body.data.notes ?? null,
  });

  res.json({ ok: true, nextSafeDate: nextSafe.toISOString().split("T")[0] });
});

// ── GET partner ───────────────────────────────────────────────────────────────
router.get("/patient-app/intimacy/partner", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: settings } = await supabase
    .from("patient_intimacy_settings")
    .select("partner_id, partner_invite_code, partner_invite_expires_at")
    .eq("account_id", account.id)
    .maybeSingle();

  if (!settings) { res.json({ hasPartner: false, pendingInvite: null }); return; }

  let partner = null;
  if (settings.partner_id) {
    const { data: p } = await supabase.from("patient_accounts")
      .select("id, display_name, username").eq("id", settings.partner_id).single();
    if (p) partner = { id: p.id, displayName: (p.display_name as string | null) ?? (p.username as string) };
  }

  const now = new Date().toISOString();
  const pendingInvite = settings.partner_invite_code &&
    settings.partner_invite_expires_at &&
    (settings.partner_invite_expires_at as string) > now
    ? { code: settings.partner_invite_code, expiresAt: settings.partner_invite_expires_at }
    : null;

  res.json({ hasPartner: !!partner, partner, pendingInvite });
});

// ── POST generate invite ──────────────────────────────────────────────────────
router.post("/patient-app/intimacy/partner/invite", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("patient_intimacy_settings")
    .update({ partner_invite_code: code, partner_invite_expires_at: expiresAt })
    .eq("account_id", account.id);

  res.json({ code, expiresAt });
});

// ── POST join via invite code ─────────────────────────────────────────────────
router.post("/patient-app/intimacy/partner/join", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = z.object({ code: z.string().min(6).max(6) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid code" }); return; }

  const now = new Date().toISOString();
  const { data: inviter } = await supabase
    .from("patient_intimacy_settings")
    .select("account_id, partner_invite_expires_at")
    .eq("partner_invite_code", body.data.code.toUpperCase())
    .maybeSingle();

  if (!inviter) { res.status(404).json({ error: "Invite code not found" }); return; }
  if ((inviter.partner_invite_expires_at as string) < now) { res.status(410).json({ error: "Invite code has expired" }); return; }
  if ((inviter.account_id as number) === account.id) { res.status(400).json({ error: "You cannot link with yourself" }); return; }

  await supabase.from("patient_intimacy_settings")
    .update({ partner_id: account.id, partner_invite_code: null, partner_invite_expires_at: null })
    .eq("account_id", inviter.account_id);
  await supabase.from("patient_intimacy_settings")
    .update({ partner_id: inviter.account_id })
    .eq("account_id", account.id);

  const { data: inviterAcct } = await supabase.from("patient_accounts")
    .select("display_name, username").eq("id", inviter.account_id).single();

  res.json({
    ok: true,
    partner: {
      id: inviter.account_id,
      displayName: (inviterAcct?.display_name as string | null) ?? (inviterAcct?.username as string),
    },
  });
});

// ── DELETE disconnect partner ─────────────────────────────────────────────────
router.delete("/patient-app/intimacy/partner", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: settings } = await supabase
    .from("patient_intimacy_settings").select("partner_id").eq("account_id", account.id).maybeSingle();

  if (settings?.partner_id) {
    await supabase.from("patient_intimacy_settings").update({ partner_id: null }).eq("account_id", settings.partner_id);
  }
  await supabase.from("patient_intimacy_settings").update({ partner_id: null }).eq("account_id", account.id);

  res.json({ ok: true });
});

export default router;
