import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";

const router: IRouter = Router();

// ── Module metadata ────────────────────────────────────────────────────────────
const DAILY_MODULES: Record<string, { label: string; emoji: string }> = {
  water:      { label: "Water",      emoji: "💧" },
  medications:{ label: "Medications",emoji: "💊" },
  workout:    { label: "Workout",    emoji: "🏃" },
  sleep:      { label: "Sleep",      emoji: "😴" },
  mood_check: { label: "Mood",       emoji: "😊" },
  fruit:      { label: "Fruit",      emoji: "🍎" },
  vitals:     { label: "Vitals",     emoji: "❤️" },
  eyebreak:   { label: "Eye Break",  emoji: "👁️" },
  sunscreen:  { label: "Sunscreen",  emoji: "☀️" },
  outdoors:   { label: "Outdoors",   emoji: "🌿" },
};

export const SHAREABLE_GOAL_MODULES = [
  { type: "water",     label: "Water",    emoji: "💧", unit: "cups",       defaultTarget: 8  },
  { type: "workout",   label: "Workout",  emoji: "🏃", unit: "sessions",   defaultTarget: 1  },
  { type: "fruit",     label: "Fruit",    emoji: "🍎", unit: "portions",   defaultTarget: 5  },
  { type: "sleep",     label: "Sleep",    emoji: "😴", unit: "hrs sleep",  defaultTarget: 7  },
  { type: "outdoors",  label: "Outdoors", emoji: "🌿", unit: "minutes",    defaultTarget: 30 },
  { type: "sunscreen", label: "Sunscreen",emoji: "☀️", unit: "applications",defaultTarget: 2 },
];

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function isLogCompleted(type: string, log: Record<string, unknown>, settings: Record<string, unknown>): boolean {
  if (type === "water") return ((log.cups as number) ?? 0) >= ((settings.target as number) ?? 8);
  if (type === "fruit") return log.done === true;
  if (type === "sunscreen") return ((log.count as number) ?? 0) >= ((settings.target as number) ?? 2);
  if (type === "sleep") return !!(log.bedtime && log.wakeTime);
  if (type === "mood_check") return !!(log.mood && log.energy && log.stress);
  if (type === "workout") return log.completed === true;
  if (type === "eyebreak") {
    const [sh, sm] = ((settings.startTime as string) ?? "09:00").split(":").map(Number);
    const [eh, em] = ((settings.endTime   as string) ?? "18:00").split(":").map(Number);
    const defaultTarget = Math.max(4, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 25));
    return ((log.count as number) ?? 0) >= ((settings.targetBreaks as number) ?? defaultTarget);
  }
  if (type === "outdoors") return ((log.minutes as number) ?? 0) > 0;
  if (type === "vitals") return !!(log.systolic || log.glucose || log.weight);
  if (type === "medications") return Object.values((log.taken as Record<string, boolean>) ?? {}).some((v) => v === true);
  return false;
}

function getModuleValue(type: string, log: Record<string, unknown>): number {
  if (type === "water") return (log.cups as number) ?? 0;
  if (type === "sunscreen") return (log.count as number) ?? 0;
  if (type === "fruit") return log.done ? 1 : 0;
  if (type === "workout") return log.completed ? 1 : 0;
  if (type === "sleep") return (log.hoursSlept as number) ?? 0;
  if (type === "outdoors") return (log.minutes as number) ?? 0;
  if (type === "eyebreak") return (log.count as number) ?? 0;
  if (type === "medications") return Object.values((log.taken as Record<string, boolean>) ?? {}).filter((v) => v).length;
  return 0;
}

// ── Shared streak computation ─────────────────────────────────────────────────
export interface StreakItem { type: string; label: string; emoji: string; streak: number }

export async function computeStreaksForAccount(accountId: number): Promise<StreakItem[]> {
  const today = todayDateStr();
  const from = new Date(); from.setDate(from.getDate() - 89);
  const fromDate = from.toISOString().split("T")[0];

  const [modulesRes, logsRes] = await Promise.all([
    supabase.from("wellness_modules").select("module_type, settings, enabled").eq("account_id", accountId),
    supabase.from("wellness_logs").select("module_type, log_date, data")
      .eq("account_id", accountId).gte("log_date", fromDate),
  ]);

  const modules = (modulesRes.data ?? []).filter((m: Record<string, unknown>) => m.enabled && DAILY_MODULES[m.module_type as string]);
  const logs = logsRes.data ?? [];
  const logIndex: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const l of logs) {
    const mt = l.module_type as string;
    if (!logIndex[mt]) logIndex[mt] = {};
    logIndex[mt][l.log_date as string] = l.data as Record<string, unknown>;
  }

  const results: StreakItem[] = [];
  for (const mod of modules) {
    const type = mod.module_type as string;
    const meta = DAILY_MODULES[type];
    const settings = (mod.settings as Record<string, unknown>) ?? {};
    const byDate = logIndex[type] ?? {};
    let streak = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const log = byDate[dateStr];
      if (!log) { if (dateStr === today) continue; break; }
      if (isLogCompleted(type, log, settings)) streak++;
      else if (dateStr !== today) break;
    }
    results.push({ type, label: meta.label, emoji: meta.emoji, streak });
  }
  return results.sort((a, b) => b.streak - a.streak);
}

// ── Helper: verify partnership membership ─────────────────────────────────────
async function getPartnership(partnershipId: number, accountId: number) {
  const { data } = await supabase
    .from("accountability_partners")
    .select("id, requester_id, recipient_id, status, shared_modules, shared_goal")
    .eq("id", partnershipId).eq("status", "accepted").maybeSingle();
  if (!data) return null;
  const rid = data.requester_id as number, recid = data.recipient_id as number;
  if (rid !== accountId && recid !== accountId) return null;
  return { ...data, partnerId: rid === accountId ? recid : rid };
}

// ── GET /api/patient-app/social/my-streaks ────────────────────────────────────
router.get("/patient-app/social/my-streaks", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const streaks = await computeStreaksForAccount(account.id);
    res.json({ streaks });
  } catch (e) { res.status(500).json({ error: "Failed to compute streaks" }); }
});

// ── GET /api/patient-app/social/search?q= ────────────────────────────────────
router.get("/patient-app/social/search", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const { data: users } = await supabase
    .from("patient_accounts").select("id, username, display_name")
    .ilike("username", `%${q}%`).neq("id", account.id).limit(10);

  if (!users?.length) { res.json([]); return; }

  const userIds = users.map((u: Record<string, unknown>) => u.id as number);
  const { data: existingRows } = await supabase
    .from("accountability_partners").select("id, requester_id, recipient_id, status")
    .or(`and(requester_id.eq.${account.id},recipient_id.in.(${userIds.join(",")})),and(recipient_id.eq.${account.id},requester_id.in.(${userIds.join(",")}))`)
    .in("status", ["pending", "accepted"]);

  const partnerMap: Record<number, "pending_sent" | "pending_received" | "accepted"> = {};
  for (const row of existingRows ?? []) {
    const rid = row.requester_id as number, recid = row.recipient_id as number;
    const other = rid === account.id ? recid : rid;
    if (!userIds.includes(other)) continue;
    if (row.status === "accepted") partnerMap[other] = "accepted";
    else if (row.status === "pending") partnerMap[other] = rid === account.id ? "pending_sent" : "pending_received";
  }

  res.json(users.map((u: Record<string, unknown>) => ({
    id: u.id, username: u.username, displayName: u.display_name,
    status: partnerMap[u.id as number] ?? "none",
  })));
});

// ── GET /api/patient-app/social/partners ─────────────────────────────────────
router.get("/patient-app/social/partners", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: rows } = await supabase
    .from("accountability_partners")
    .select("id, requester_id, recipient_id, status, created_at, shared_modules, shared_goal")
    .or(`requester_id.eq.${account.id},recipient_id.eq.${account.id}`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });

  if (!rows?.length) { res.json({ partners: [], incoming: [], outgoing: [] }); return; }

  const otherIds = new Set<number>();
  for (const r of rows) {
    const rid = r.requester_id as number, recid = r.recipient_id as number;
    otherIds.add(rid === account.id ? recid : rid);
  }

  const { data: profiles } = await supabase
    .from("patient_accounts").select("id, username, display_name").in("id", Array.from(otherIds));

  const profileMap: Record<number, { id: number; username: string; displayName: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id as number] = { id: p.id as number, username: p.username as string, displayName: p.display_name as string | null };
  }

  const partners: unknown[] = [], incoming: unknown[] = [], outgoing: unknown[] = [];
  for (const r of rows) {
    const rid = r.requester_id as number, recid = r.recipient_id as number;
    const otherId = rid === account.id ? recid : rid;
    const other = profileMap[otherId];
    if (!other) continue;
    if (r.status === "accepted") {
      partners.push({ id: r.id, other, since: r.created_at, sharedModules: r.shared_modules ?? [], sharedGoal: r.shared_goal ?? null });
    } else if (r.status === "pending") {
      if (rid === account.id) outgoing.push({ id: r.id, to: other, createdAt: r.created_at });
      else incoming.push({ id: r.id, from: other, createdAt: r.created_at });
    }
  }
  res.json({ partners, incoming, outgoing });
});

// ── POST /api/patient-app/social/partners/request ────────────────────────────
router.post("/patient-app/social/partners/request", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.body as { username?: string };
  if (!username?.trim()) { res.status(400).json({ error: "Username required" }); return; }

  const { data: target } = await supabase
    .from("patient_accounts").select("id").ilike("username", username.trim()).maybeSingle();
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if ((target.id as number) === account.id) { res.status(400).json({ error: "Cannot partner with yourself" }); return; }

  const { data: existing } = await supabase
    .from("accountability_partners").select("id, status")
    .or(`and(requester_id.eq.${account.id},recipient_id.eq.${target.id}),and(requester_id.eq.${target.id},recipient_id.eq.${account.id})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") { res.status(400).json({ error: "Already partners" }); return; }
    if (existing.status === "pending") { res.status(400).json({ error: "Request already pending" }); return; }
    await supabase.from("accountability_partners").update({ status: "pending", requester_id: account.id, recipient_id: target.id, updated_at: new Date().toISOString() }).eq("id", existing.id as number);
    res.json({ ok: true }); return;
  }

  await supabase.from("accountability_partners").insert({ requester_id: account.id, recipient_id: target.id, status: "pending" });
  res.json({ ok: true });
});

// ── PATCH /api/patient-app/social/partners/:id/accept ────────────────────────
router.patch("/patient-app/social/partners/:id/accept", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { data } = await supabase.from("accountability_partners").select("id, recipient_id, status").eq("id", parseInt(req.params.id, 10)).maybeSingle();
  if (!data || (data.recipient_id as number) !== account.id) { res.status(404).json({ error: "Not found" }); return; }
  if (data.status !== "pending") { res.status(400).json({ error: "Not pending" }); return; }
  await supabase.from("accountability_partners").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── PATCH /api/patient-app/social/partners/:id/decline ───────────────────────
router.patch("/patient-app/social/partners/:id/decline", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { data } = await supabase.from("accountability_partners").select("id, recipient_id").eq("id", parseInt(req.params.id, 10)).maybeSingle();
  if (!data || (data.recipient_id as number) !== account.id) { res.status(404).json({ error: "Not found" }); return; }
  await supabase.from("accountability_partners").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── DELETE /api/patient-app/social/partners/:id ───────────────────────────────
router.delete("/patient-app/social/partners/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { data } = await supabase.from("accountability_partners").select("id, requester_id, recipient_id").eq("id", parseInt(req.params.id, 10)).maybeSingle();
  if (!data || ((data.requester_id as number) !== account.id && (data.recipient_id as number) !== account.id)) { res.status(404).json({ error: "Not found" }); return; }
  await supabase.from("accountability_partners").update({ status: "removed", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── GET /api/patient-app/social/partners/:id/streaks ─────────────────────────
router.get("/patient-app/social/partners/:id/streaks", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const p = await getPartnership(parseInt(req.params.id, 10), account.id);
  if (!p) { res.status(404).json({ error: "Partnership not found" }); return; }

  const { data: profile } = await supabase.from("patient_accounts").select("id, username, display_name").eq("id", p.partnerId).maybeSingle();
  const streaks = await computeStreaksForAccount(p.partnerId);

  res.json({
    partner: { id: p.partnerId, username: profile?.username ?? "", displayName: (profile?.display_name as string | null) ?? null },
    streaks,
    sharedModules: (p.shared_modules as string[]) ?? [],
    sharedGoal: p.shared_goal ?? null,
  });
});

// ── PATCH /api/patient-app/social/partners/:id/settings ──────────────────────
router.patch("/patient-app/social/partners/:id/settings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const p = await getPartnership(parseInt(req.params.id, 10), account.id);
  if (!p) { res.status(404).json({ error: "Partnership not found" }); return; }

  const { sharedModules, sharedGoal } = req.body as {
    sharedModules?: string[];
    sharedGoal?: { module: string; target: number; label: string } | null;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (sharedModules !== undefined) update.shared_modules = sharedModules;
  if (sharedGoal !== undefined) update.shared_goal = sharedGoal;

  await supabase.from("accountability_partners").update(update).eq("id", p.id as number);
  res.json({ ok: true });
});

// ── GET /api/patient-app/social/partners/:id/womens-health ───────────────────
router.get("/patient-app/social/partners/:id/womens-health", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const p = await getPartnership(parseInt(req.params.id, 10), account.id);
  if (!p) { res.status(404).json({ error: "Partnership not found" }); return; }

  const sharedModules = (p.shared_modules as string[]) ?? [];
  if (!sharedModules.includes("womens_health")) { res.status(403).json({ error: "Not shared" }); return; }

  const { data: wh } = await supabase.from("womens_health_settings").select("*").eq("account_id", p.partnerId).maybeSingle();
  if (!wh) { res.json({ hasData: false }); return; }

  const mode = (wh.mode as string) ?? "cycle";

  if (mode === "pregnancy") {
    const lmpDate = wh.lmp_date as string | null;
    const dueDate = wh.due_date as string | null;
    if (!lmpDate) { res.json({ hasData: true, mode: "pregnancy", isSetUp: false }); return; }
    const today = new Date();
    const lmp = new Date(lmpDate + "T12:00:00");
    const days = Math.floor((today.getTime() - lmp.getTime()) / 86400000);
    const weeks = Math.floor(days / 7);
    const trimester = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
    const isPostpartum = weeks > 40;
    res.json({ hasData: true, mode: "pregnancy", isSetUp: true, weeks, trimester, dueDate, isPostpartum });
    return;
  }

  // Cycle mode — return phase only (no detailed log data)
  const lastPeriodStart = wh.last_period_start as string | null;
  const cycleLength = (wh.cycle_length as number) ?? 28;
  const periodLength = (wh.period_length as number) ?? 5;

  if (!lastPeriodStart) { res.json({ hasData: true, mode: "cycle", isSetUp: false }); return; }

  const today = new Date();
  const lastStart = new Date(lastPeriodStart + "T12:00:00");
  const daysDiff = Math.floor((today.getTime() - lastStart.getTime()) / 86400000);
  const completedCycles = Math.floor(daysDiff / cycleLength);
  const cycleDay = daysDiff - completedCycles * cycleLength + 1;

  const ovCycleDay = cycleLength - 14;
  const fertileStart = Math.max(1, ovCycleDay - 4);
  const fertileEnd = ovCycleDay + 2;
  const phase = cycleDay <= periodLength ? "menstruation"
    : cycleDay < fertileStart ? "follicular"
    : cycleDay <= fertileEnd ? "fertile"
    : "luteal";

  const daysUntilNextPeriod = cycleLength - cycleDay + 1;

  res.json({ hasData: true, mode: "cycle", isSetUp: true, phase, cycleDay, cycleLength, daysUntilNextPeriod });
});

// ── GET /api/patient-app/social/partners/:id/goal-progress ───────────────────
router.get("/patient-app/social/partners/:id/goal-progress", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const p = await getPartnership(parseInt(req.params.id, 10), account.id);
  if (!p) { res.status(404).json({ error: "Partnership not found" }); return; }

  const goal = p.shared_goal as { module: string; target: number; label: string } | null;
  if (!goal) { res.json({ goal: null }); return; }

  const today = todayDateStr();

  const [myLog, partnerLog, myMod, partnerMod] = await Promise.all([
    supabase.from("wellness_logs").select("data").eq("account_id", account.id).eq("module_type", goal.module).eq("log_date", today).maybeSingle(),
    supabase.from("wellness_logs").select("data").eq("account_id", p.partnerId).eq("module_type", goal.module).eq("log_date", today).maybeSingle(),
    supabase.from("wellness_modules").select("settings").eq("account_id", account.id).eq("module_type", goal.module).maybeSingle(),
    supabase.from("wellness_modules").select("settings").eq("account_id", p.partnerId).eq("module_type", goal.module).maybeSingle(),
  ]);

  const mySettings = (myMod.data?.settings as Record<string, unknown>) ?? {};
  const partnerSettings = (partnerMod.data?.settings as Record<string, unknown>) ?? {};
  const myData = (myLog.data?.data as Record<string, unknown>) ?? {};
  const partnerData = (partnerLog.data?.data as Record<string, unknown>) ?? {};

  const myValue = getModuleValue(goal.module, myData);
  const partnerValue = getModuleValue(goal.module, partnerData);

  res.json({
    goal,
    myProgress: { value: myValue, done: isLogCompleted(goal.module, myData, mySettings) },
    partnerProgress: { value: partnerValue, done: isLogCompleted(goal.module, partnerData, partnerSettings) },
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Groups
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/patient-app/social/groups ───────────────────────────────────────
router.post("/patient-app/social/groups", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, goalModule, goalTarget, goalLabel } = req.body as {
    name?: string; goalModule?: string; goalTarget?: number; goalLabel?: string;
  };

  if (!name?.trim()) { res.status(400).json({ error: "Group name required" }); return; }
  if (!goalModule) { res.status(400).json({ error: "Goal module required" }); return; }

  const { data: group } = await supabase.from("accountability_groups")
    .insert({ name: name.trim(), created_by: account.id, goal_module: goalModule, goal_target: goalTarget, goal_label: goalLabel })
    .select("id").single();

  if (!group) { res.status(500).json({ error: "Failed to create group" }); return; }

  // Add creator as active member
  await supabase.from("accountability_group_members").insert({
    group_id: (group as { id: number }).id,
    account_id: account.id,
    status: "active",
    joined_at: new Date().toISOString(),
  });

  res.json({ ok: true, groupId: (group as { id: number }).id });
});

// ── GET /api/patient-app/social/groups ────────────────────────────────────────
router.get("/patient-app/social/groups", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: memberships } = await supabase
    .from("accountability_group_members")
    .select("group_id, status")
    .eq("account_id", account.id)
    .in("status", ["active", "pending"]);

  if (!memberships?.length) { res.json({ groups: [], invites: [] }); return; }

  const groupIds = memberships.map((m: Record<string, unknown>) => m.group_id as number);
  const { data: groups } = await supabase
    .from("accountability_groups")
    .select("id, name, goal_module, goal_target, goal_label, created_by, created_at")
    .in("id", groupIds);

  // Count members per group
  const { data: memberCounts } = await supabase
    .from("accountability_group_members")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "active");

  const countMap: Record<number, number> = {};
  for (const m of memberCounts ?? []) countMap[m.group_id as number] = (countMap[m.group_id as number] ?? 0) + 1;

  const statusMap: Record<number, string> = {};
  for (const m of memberships) statusMap[m.group_id as number] = m.status as string;

  const myGroups: unknown[] = [], myInvites: unknown[] = [];
  for (const g of groups ?? []) {
    const entry = {
      id: g.id, name: g.name, goalModule: g.goal_module, goalTarget: g.goal_target,
      goalLabel: g.goal_label, createdBy: g.created_by, memberCount: countMap[g.id as number] ?? 0,
    };
    if (statusMap[g.id as number] === "active") myGroups.push(entry);
    else myInvites.push(entry);
  }

  res.json({ groups: myGroups, invites: myInvites });
});

// ── GET /api/patient-app/social/groups/:id ────────────────────────────────────
router.get("/patient-app/social/groups/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const groupId = parseInt(req.params.id, 10);

  // Verify membership
  const { data: myMembership } = await supabase
    .from("accountability_group_members")
    .select("status").eq("group_id", groupId).eq("account_id", account.id).maybeSingle();
  if (!myMembership) { res.status(403).json({ error: "Not a member" }); return; }

  const [groupRes, membersRes] = await Promise.all([
    supabase.from("accountability_groups").select("*").eq("id", groupId).maybeSingle(),
    supabase.from("accountability_group_members").select("account_id, status, joined_at").eq("group_id", groupId).eq("status", "active"),
  ]);

  const group = groupRes.data;
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  const memberAccountIds = (membersRes.data ?? []).map((m: Record<string, unknown>) => m.account_id as number);
  const { data: profiles } = await supabase.from("patient_accounts").select("id, username, display_name").in("id", memberAccountIds);

  const profileMap: Record<number, { username: string; displayName: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id as number] = { username: p.username as string, displayName: p.display_name as string | null };
  }

  const today = todayDateStr();
  const goalModule = group.goal_module as string;
  const goalTarget = (group.goal_target as number) ?? 1;

  // Get today's logs for all members
  const { data: todayLogs } = await supabase
    .from("wellness_logs")
    .select("account_id, data")
    .in("account_id", memberAccountIds)
    .eq("module_type", goalModule)
    .eq("log_date", today);

  // Get settings for isLogCompleted
  const { data: memberSettings } = await supabase
    .from("wellness_modules")
    .select("account_id, settings")
    .in("account_id", memberAccountIds)
    .eq("module_type", goalModule);

  const settingsMap: Record<number, Record<string, unknown>> = {};
  for (const s of memberSettings ?? []) settingsMap[s.account_id as number] = (s.settings as Record<string, unknown>) ?? {};

  const logMap: Record<number, Record<string, unknown>> = {};
  for (const l of todayLogs ?? []) logMap[l.account_id as number] = (l.data as Record<string, unknown>) ?? {};

  const members = memberAccountIds.map((aid) => {
    const log = logMap[aid] ?? {};
    const settings = settingsMap[aid] ?? {};
    const value = getModuleValue(goalModule, log);
    return {
      accountId: aid,
      displayName: profileMap[aid]?.displayName ?? profileMap[aid]?.username ?? "Unknown",
      username: profileMap[aid]?.username ?? "",
      value,
      done: isLogCompleted(goalModule, log, settings),
      isMe: aid === account.id,
    };
  }).sort((a, b) => b.value - a.value);

  res.json({
    group: {
      id: group.id, name: group.name, goalModule, goalTarget,
      goalLabel: group.goal_label, createdBy: group.created_by, memberCount: members.length,
    },
    members,
    myStatus: myMembership.status,
  });
});

// ── POST /api/patient-app/social/groups/:id/invite ───────────────────────────
router.post("/patient-app/social/groups/:id/invite", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const groupId = parseInt(req.params.id, 10);
  const { username } = req.body as { username?: string };
  if (!username?.trim()) { res.status(400).json({ error: "Username required" }); return; }

  const { data: membership } = await supabase
    .from("accountability_group_members")
    .select("status").eq("group_id", groupId).eq("account_id", account.id).maybeSingle();
  if (!membership || membership.status !== "active") { res.status(403).json({ error: "Not a member" }); return; }

  const { data: target } = await supabase
    .from("patient_accounts").select("id").ilike("username", username.trim()).maybeSingle();
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const { data: existing } = await supabase
    .from("accountability_group_members").select("status").eq("group_id", groupId).eq("account_id", target.id as number).maybeSingle();
  if (existing) { res.status(400).json({ error: "Already invited or member" }); return; }

  await supabase.from("accountability_group_members").insert({
    group_id: groupId, account_id: target.id as number,
    status: "pending", invited_by: account.id,
  });

  res.json({ ok: true });
});

// ── PATCH /api/patient-app/social/groups/:id/accept ─────────────────────────
router.patch("/patient-app/social/groups/:id/accept", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const groupId = parseInt(req.params.id, 10);
  const { data: membership } = await supabase
    .from("accountability_group_members").select("id, status").eq("group_id", groupId).eq("account_id", account.id).maybeSingle();
  if (!membership || membership.status !== "pending") { res.status(404).json({ error: "No pending invite" }); return; }

  await supabase.from("accountability_group_members")
    .update({ status: "active", joined_at: new Date().toISOString() })
    .eq("id", membership.id as number);

  res.json({ ok: true });
});

// ── PATCH /api/patient-app/social/groups/:id/decline ─────────────────────────
router.patch("/patient-app/social/groups/:id/decline", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const groupId = parseInt(req.params.id, 10);
  await supabase.from("accountability_group_members")
    .update({ status: "declined" })
    .eq("group_id", groupId).eq("account_id", account.id);
  res.json({ ok: true });
});

// ── DELETE /api/patient-app/social/groups/:id/leave ──────────────────────────
router.delete("/patient-app/social/groups/:id/leave", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const groupId = parseInt(req.params.id, 10);
  await supabase.from("accountability_group_members")
    .update({ status: "left" })
    .eq("group_id", groupId).eq("account_id", account.id);
  res.json({ ok: true });
});

export default router;
