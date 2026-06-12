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
  sunscreen:  { label: "Sunscreen",  emoji: "🧴" },
  outdoors:   { label: "Outdoors",   emoji: "🌿" },
};

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

// Simplified completion per module — used for streak calculation in social view
function isLogCompleted(type: string, log: Record<string, unknown>, settings: Record<string, unknown>): boolean {
  if (type === "water") {
    const target = (settings.target as number) ?? 8;
    return ((log.cups as number) ?? 0) >= target;
  }
  if (type === "fruit" || type === "sunscreen") return log.done === true;
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
  if (type === "medications") {
    const taken = (log.taken as Record<string, boolean>) ?? {};
    return Object.values(taken).some((v) => v === true);
  }
  return false;
}

// ── Shared streak computation ─────────────────────────────────────────────────
export interface StreakItem {
  type: string;
  label: string;
  emoji: string;
  streak: number;
}

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

  // Build nested index: { [module_type]: { [date]: data } }
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

// ── GET /api/patient-app/social/my-streaks ────────────────────────────────────
router.get("/patient-app/social/my-streaks", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const streaks = await computeStreaksForAccount(account.id);
    res.json({ streaks });
  } catch (e) {
    console.error("my-streaks error:", e);
    res.status(500).json({ error: "Failed to compute streaks" });
  }
});

// ── GET /api/patient-app/social/search?q= ────────────────────────────────────
router.get("/patient-app/social/search", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  // Search by username (case-insensitive, not full email for privacy)
  const { data: users } = await supabase
    .from("patient_accounts")
    .select("id, username, display_name")
    .ilike("username", `%${q}%`)
    .neq("id", account.id)
    .limit(10);

  if (!users || users.length === 0) { res.json([]); return; }

  const userIds = users.map((u: Record<string, unknown>) => u.id as number);

  // Check existing partnership status — only rows that involve account.id and one of the found users
  const { data: existingRows } = await supabase
    .from("accountability_partners")
    .select("id, requester_id, recipient_id, status")
    .or(`and(requester_id.eq.${account.id},recipient_id.in.(${userIds.join(",")})),and(recipient_id.eq.${account.id},requester_id.in.(${userIds.join(",")}))`)
    .in("status", ["pending", "accepted"]);

  const partnerMap: Record<number, "pending_sent" | "pending_received" | "accepted"> = {};
  for (const row of existingRows ?? []) {
    const rid = row.requester_id as number;
    const recid = row.recipient_id as number;
    const other = rid === account.id ? recid : rid;
    if (!userIds.includes(other)) continue;
    if (row.status === "accepted") partnerMap[other] = "accepted";
    else if (row.status === "pending") {
      partnerMap[other] = rid === account.id ? "pending_sent" : "pending_received";
    }
  }

  res.json(users.map((u: Record<string, unknown>) => ({
    id: u.id as number,
    username: u.username as string,
    displayName: u.display_name as string | null,
    status: partnerMap[u.id as number] ?? "none",
  })));
});

// ── GET /api/patient-app/social/partners ─────────────────────────────────────
router.get("/patient-app/social/partners", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: rows } = await supabase
    .from("accountability_partners")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${account.id},recipient_id.eq.${account.id}`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) { res.json({ partners: [], incoming: [], outgoing: [] }); return; }

  // Collect all other account IDs
  const otherIds = new Set<number>();
  for (const r of rows) {
    const rid = r.requester_id as number, recid = r.recipient_id as number;
    otherIds.add(rid === account.id ? recid : rid);
  }

  const { data: profiles } = await supabase
    .from("patient_accounts")
    .select("id, username, display_name")
    .in("id", Array.from(otherIds));

  const profileMap: Record<number, { id: number; username: string; displayName: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id as number] = { id: p.id as number, username: p.username as string, displayName: p.display_name as string | null };
  }

  const partners: unknown[] = [];
  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];

  for (const r of rows) {
    const rid = r.requester_id as number, recid = r.recipient_id as number;
    const otherId = rid === account.id ? recid : rid;
    const other = profileMap[otherId];
    if (!other) continue;

    if (r.status === "accepted") {
      partners.push({ id: r.id, other, since: r.created_at });
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

  // Find target user
  const { data: target } = await supabase
    .from("patient_accounts").select("id, username, display_name")
    .ilike("username", username.trim()).maybeSingle();

  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if ((target.id as number) === account.id) { res.status(400).json({ error: "Cannot partner with yourself" }); return; }

  // Check existing
  const { data: existing } = await supabase
    .from("accountability_partners")
    .select("id, status")
    .or(`and(requester_id.eq.${account.id},recipient_id.eq.${target.id}),and(requester_id.eq.${target.id},recipient_id.eq.${account.id})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") { res.status(400).json({ error: "Already partners" }); return; }
    if (existing.status === "pending") { res.status(400).json({ error: "Request already pending" }); return; }
    // Re-request after decline/remove
    await supabase.from("accountability_partners").update({ status: "pending", requester_id: account.id, recipient_id: target.id, updated_at: new Date().toISOString() }).eq("id", existing.id as number);
    res.json({ ok: true, requestId: existing.id });
    return;
  }

  const { data: inserted } = await supabase
    .from("accountability_partners")
    .insert({ requester_id: account.id, recipient_id: target.id, status: "pending" })
    .select("id").single();

  res.json({ ok: true, requestId: (inserted as { id: number }).id });
});

// ── PATCH /api/patient-app/social/partners/:id/accept ────────────────────────
router.patch("/patient-app/social/partners/:id/accept", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("accountability_partners").select("id, recipient_id, status").eq("id", parseInt(req.params.id, 10)).maybeSingle();

  if (!data || (data.recipient_id as number) !== account.id) { res.status(404).json({ error: "Request not found" }); return; }
  if (data.status !== "pending") { res.status(400).json({ error: "Request is not pending" }); return; }

  await supabase.from("accountability_partners").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── PATCH /api/patient-app/social/partners/:id/decline ───────────────────────
router.patch("/patient-app/social/partners/:id/decline", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("accountability_partners").select("id, recipient_id, status").eq("id", parseInt(req.params.id, 10)).maybeSingle();

  if (!data || (data.recipient_id as number) !== account.id) { res.status(404).json({ error: "Request not found" }); return; }

  await supabase.from("accountability_partners").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── DELETE /api/patient-app/social/partners/:id ───────────────────────────────
router.delete("/patient-app/social/partners/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("accountability_partners").select("id, requester_id, recipient_id")
    .eq("id", parseInt(req.params.id, 10)).maybeSingle();

  if (!data || ((data.requester_id as number) !== account.id && (data.recipient_id as number) !== account.id)) {
    res.status(404).json({ error: "Partnership not found" }); return;
  }

  await supabase.from("accountability_partners").update({ status: "removed", updated_at: new Date().toISOString() }).eq("id", data.id as number);
  res.json({ ok: true });
});

// ── GET /api/patient-app/social/partners/:id/streaks ─────────────────────────
router.get("/patient-app/social/partners/:id/streaks", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const partnershipId = parseInt(req.params.id, 10);
  const { data: partnership } = await supabase
    .from("accountability_partners")
    .select("id, requester_id, recipient_id, status")
    .eq("id", partnershipId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!partnership) { res.status(404).json({ error: "Partnership not found" }); return; }
  const rid = partnership.requester_id as number, recid = partnership.recipient_id as number;
  if (rid !== account.id && recid !== account.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const partnerId = rid === account.id ? recid : rid;

  const { data: profile } = await supabase
    .from("patient_accounts").select("id, username, display_name").eq("id", partnerId).maybeSingle();

  const streaks = await computeStreaksForAccount(partnerId);

  res.json({
    partner: {
      id: partnerId,
      username: profile?.username ?? "",
      displayName: (profile?.display_name as string | null) ?? null,
    },
    streaks,
  });
});

export default router;
