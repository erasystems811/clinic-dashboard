import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest, hashPassword, verifyPassword } from "../lib/patient-auth.js";

const router: IRouter = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }

async function getOrCreateSettings(accountId: number) {
  const { data } = await supabase
    .from("companion_settings")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  return data;
}

function isBirthdayToday(dob: string | null): boolean {
  if (!dob) return false;
  const today = new Date();
  const bd = new Date(dob);
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const bd = new Date(dob);
  let age = today.getFullYear() - bd.getFullYear();
  if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--;
  return age;
}

async function getAccountInfo(accountId: number) {
  const { data } = await supabase
    .from("patient_accounts")
    .select("display_name, username, date_of_birth")
    .eq("id", accountId)
    .single();
  return data;
}

function buildSystemPrompt(
  name: string, age: number | null, isBirthday: boolean,
  personality: Record<string, unknown>, recentMoods: number[]
): string {
  const moodLabels = ["", "very sad", "down", "neutral", "good", "great"];
  const moodSummary = recentMoods.length
    ? `Recent moods (last ${recentMoods.length} days): ${recentMoods.map((m) => moodLabels[m] ?? m).join(", ")}`
    : "No mood data yet.";

  const traits = (personality.traits as string[] | undefined)?.join(", ") ?? "";
  const values = (personality.values as string[] | undefined)?.join(", ") ?? "";
  const stressors = (personality.stressors as string[] | undefined)?.join(", ") ?? "";
  const strengths = (personality.strengths as string[] | undefined)?.join(", ") ?? "";
  const notes = (personality.notes as string | undefined) ?? "";

  const personalitySection = traits
    ? `What you know about ${name}:\n- Traits: ${traits}\n- Values: ${values}\n- Stressors: ${stressors}\n- Strengths: ${strengths}\n${notes ? `- Notes: ${notes}` : ""}`
    : `You're still getting to know ${name}.`;

  const birthdaySection = isBirthday && age
    ? `🎂 TODAY IS ${name.toUpperCase()}'S BIRTHDAY — they are turning ${age}! Acknowledge it warmly at the right moment.`
    : isBirthday
    ? `🎂 Today is ${name}'s birthday! Acknowledge it warmly.`
    : "";

  return `You are ERA Me's private companion — a warm, emotionally intelligent, psychologically-aware presence in ${name}'s life.

${age ? `${name} is ${age} years old.` : ""}
${birthdaySection}

${personalitySection}

${moodSummary}

How you show up:
- Warm but never clingy or performative
- You listen deeply and reflect back what you notice, when the moment calls for it
- You ask thoughtful follow-up questions — but only one at a time, never interrogating
- You celebrate wins genuinely and sit with losses without rushing to fix them
- You notice emotional patterns and gently name them over time
- Brief when they're brief, expansive when they want to talk
- You never give medical diagnoses — you are a companion, not a doctor
- If they seem distressed, gently check in and, where appropriate, encourage them to speak to someone they trust
- You remember what they share — each conversation builds on the last`.trim();
}

async function updatePersonalityAsync(
  accountId: number,
  name: string,
  messages: { role: string; content: string }[]
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("companion_settings")
      .select("personality")
      .eq("account_id", accountId)
      .single();

    const current = (existing?.personality as Record<string, unknown>) ?? {};

    const analysisPrompt = `You just had a conversation with ${name}. Based on these messages, update the personality profile.

Current profile:
${JSON.stringify(current, null, 2)}

Conversation:
${messages.map((m) => `${m.role === "user" ? name : "Companion"}: ${m.content}`).join("\n")}

Return ONLY a valid JSON object with these keys (merge with existing, don't erase previous insights):
{
  "traits": ["3-5 personality traits you've observed"],
  "values": ["things that matter most to them"],
  "stressors": ["things that seem to cause stress or difficulty"],
  "strengths": ["emotional or personal strengths you've noticed"],
  "notes": "a short free-form note about their communication style and inner world"
}

Keep all insights compassionate and growth-oriented. Never pathologize.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const updated = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    await supabase.from("companion_settings").upsert({
      account_id: accountId,
      personality: updated,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id" });
  } catch {
    // Personality update is best-effort — never fail the main request
  }
}

// ── GET /api/patient-app/companion/settings ───────────────────────────────────
router.get("/patient-app/companion/settings", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [settings, accountInfo] = await Promise.all([
    getOrCreateSettings(account.id),
    getAccountInfo(account.id),
  ]);

  const dob = accountInfo?.date_of_birth as string | null;
  const birthday = isBirthdayToday(dob);
  const age = calcAge(dob);

  res.json({
    hasPin: !!(settings?.pin_hash),
    isSetUp: !!settings,
    entryTab: settings?.entry_tab ?? "profile",
    personality: settings?.personality ?? {},
    isBirthday: birthday,
    birthdayAge: birthday ? age : null,
  });
});

// ── POST /api/patient-app/companion/setup ─────────────────────────────────────
router.post("/patient-app/companion/setup", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { pin, entryTab } = req.body ?? {};
  if (!pin || String(pin).length < 4) { res.status(400).json({ error: "PIN must be at least 4 digits" }); return; }

  const pinHash = await hashPassword(String(pin));
  const now = new Date().toISOString();

  await supabase.from("companion_settings").upsert({
    account_id: account.id,
    pin_hash: pinHash,
    entry_tab: entryTab ?? "profile",
    updated_at: now,
  }, { onConflict: "account_id" });

  res.json({ ok: true });
});

// ── POST /api/patient-app/companion/verify-pin ────────────────────────────────
router.post("/patient-app/companion/verify-pin", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { pin } = req.body ?? {};
  if (!pin) { res.status(400).json({ error: "PIN required" }); return; }

  const settings = await getOrCreateSettings(account.id);
  if (!settings?.pin_hash) { res.status(400).json({ error: "Companion not set up" }); return; }

  const valid = await verifyPassword(String(pin), settings.pin_hash);
  if (!valid) { res.status(401).json({ error: "Incorrect PIN" }); return; }

  res.json({ ok: true });
});

// ── PATCH /api/patient-app/companion/pin ──────────────────────────────────────
router.patch("/patient-app/companion/pin", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { currentPin, newPin } = req.body ?? {};
  if (!currentPin || !newPin) { res.status(400).json({ error: "currentPin and newPin required" }); return; }

  const settings = await getOrCreateSettings(account.id);
  if (!settings?.pin_hash) { res.status(400).json({ error: "Companion not set up" }); return; }

  const valid = await verifyPassword(String(currentPin), settings.pin_hash);
  if (!valid) { res.status(401).json({ error: "Current PIN is incorrect" }); return; }

  const newHash = await hashPassword(String(newPin));
  await supabase.from("companion_settings").update({ pin_hash: newHash, updated_at: new Date().toISOString() }).eq("account_id", account.id);

  res.json({ ok: true });
});

// ── PATCH /api/patient-app/companion/entry-tab ────────────────────────────────
router.patch("/patient-app/companion/entry-tab", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { entryTab } = req.body ?? {};
  await supabase.from("companion_settings").update({ entry_tab: entryTab, updated_at: new Date().toISOString() }).eq("account_id", account.id);
  res.json({ ok: true });
});

// ── GET /api/patient-app/companion/entries ────────────────────────────────────
router.get("/patient-app/companion/entries", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const page = parseInt(req.query.page as string ?? "1", 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data } = await supabase
    .from("diary_entries")
    .select("id, type, title, content, mood, created_at, updated_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const entries = (data ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    preview: e.type === "journal"
      ? String(e.content ?? "").slice(0, 120)
      : null,
    mood: e.mood,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));

  res.json(entries);
});

// ── POST /api/patient-app/companion/entries ───────────────────────────────────
router.post("/patient-app/companion/entries", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, content, mood } = req.body ?? {};
  const { data, error } = await supabase.from("diary_entries").insert({
    account_id: account.id,
    type: "journal",
    title: title ?? null,
    content: content ?? "",
    mood: mood ?? null,
  }).select().single();

  if (error || !data) { res.status(500).json({ error: "Failed to save entry" }); return; }
  res.json(data);
});

// ── GET /api/patient-app/companion/entries/:id ────────────────────────────────
router.get("/patient-app/companion/entries/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: entry } = await supabase
    .from("diary_entries").select("*").eq("id", req.params.id).eq("account_id", account.id).single();

  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  const { data: messages } = await supabase
    .from("diary_messages").select("id, role, content, created_at")
    .eq("entry_id", entry.id).order("created_at", { ascending: true });

  res.json({ ...entry, messages: messages ?? [] });
});

// ── PATCH /api/patient-app/companion/entries/:id ──────────────────────────────
router.patch("/patient-app/companion/entries/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, content, mood } = req.body ?? {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (mood !== undefined) updates.mood = mood;

  await supabase.from("diary_entries").update(updates).eq("id", req.params.id).eq("account_id", account.id);
  res.json({ ok: true });
});

// ── DELETE /api/patient-app/companion/entries/:id ─────────────────────────────
router.delete("/patient-app/companion/entries/:id", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  await supabase.from("diary_entries").delete().eq("id", req.params.id).eq("account_id", account.id);
  res.json({ ok: true });
});

// ── POST /api/patient-app/companion/conversation ──────────────────────────────
// Creates a new conversation entry and returns the AI opening message
router.post("/patient-app/companion/conversation", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [accountInfo, settings, recentMoodLogs] = await Promise.all([
    getAccountInfo(account.id),
    getOrCreateSettings(account.id),
    supabase.from("wellness_logs").select("data").eq("account_id", account.id)
      .eq("module_type", "mood_check").gte("log_date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })())
      .order("log_date", { ascending: false }).limit(7),
  ]);

  const name = (accountInfo?.display_name as string | null) || (accountInfo?.username as string) || "friend";
  const dob = accountInfo?.date_of_birth as string | null;
  const age = calcAge(dob);
  const birthday = isBirthdayToday(dob);
  const personality = (settings?.personality as Record<string, unknown>) ?? {};
  const recentMoods = (recentMoodLogs.data ?? []).map((l) => (l.data as Record<string, number>).mood).filter(Boolean);
  const systemPrompt = buildSystemPrompt(name, age, birthday, personality, recentMoods);

  // Create entry row
  const { data: entry, error: entryErr } = await supabase.from("diary_entries").insert({
    account_id: account.id,
    type: "conversation",
    title: `Conversation — ${new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long" })}`,
  }).select().single();

  if (entryErr || !entry) { res.status(500).json({ error: "Failed to create conversation" }); return; }

  // Get AI opening message
  const aiResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: birthday ? "It's my birthday today." : `Hi. I'm here.` }],
  });

  const aiText = (aiResponse.content[0] as { type: string; text: string }).text ?? "";

  // Store the synthetic opening exchange
  await supabase.from("diary_messages").insert([
    { entry_id: entry.id, role: "user", content: birthday ? "It's my birthday today." : "Hi. I'm here." },
    { entry_id: entry.id, role: "assistant", content: aiText },
  ]);

  res.json({ entryId: entry.id, openingMessage: aiText });
});

// ── POST /api/patient-app/companion/entries/:id/chat ─────────────────────────
// Send a user message, get AI reply
router.post("/patient-app/companion/entries/:id/chat", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { message } = req.body ?? {};
  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  // Load entry + history
  const { data: entry } = await supabase
    .from("diary_entries").select("*").eq("id", req.params.id).eq("account_id", account.id).single();
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  const { data: history } = await supabase
    .from("diary_messages").select("role, content").eq("entry_id", entry.id).order("created_at", { ascending: true });

  const [accountInfo, settings, recentMoodLogs] = await Promise.all([
    getAccountInfo(account.id),
    getOrCreateSettings(account.id),
    supabase.from("wellness_logs").select("data").eq("account_id", account.id)
      .eq("module_type", "mood_check").gte("log_date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })())
      .limit(7),
  ]);

  const name = (accountInfo?.display_name as string | null) || (accountInfo?.username as string) || "friend";
  const dob = accountInfo?.date_of_birth as string | null;
  const age = calcAge(dob);
  const birthday = isBirthdayToday(dob);
  const personality = (settings?.personality as Record<string, unknown>) ?? {};
  const recentMoods = (recentMoodLogs.data ?? []).map((l) => (l.data as Record<string, number>).mood).filter(Boolean);
  const systemPrompt = buildSystemPrompt(name, age, birthday, personality, recentMoods);

  // Build messages array for API
  const msgs: { role: "user" | "assistant"; content: string }[] = [
    ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }))),
    { role: "user", content: String(message) },
  ];

  const aiResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages: msgs,
  });

  const aiText = (aiResponse.content[0] as { type: string; text: string }).text ?? "";

  // Save both messages
  await supabase.from("diary_messages").insert([
    { entry_id: entry.id, role: "user", content: String(message) },
    { entry_id: entry.id, role: "assistant", content: aiText },
  ]);

  // Background personality update (after 5+ exchanges)
  const totalMessages = (history?.length ?? 0) + 2;
  if (totalMessages >= 6 && totalMessages % 4 === 0) {
    const allMsgs = [...msgs, { role: "assistant" as const, content: aiText }];
    void updatePersonalityAsync(account.id, name, allMsgs);
  }

  res.json({ reply: aiText });
});

// ── GET /api/patient-app/companion/personality ────────────────────────────────
router.get("/patient-app/companion/personality", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const settings = await getOrCreateSettings(account.id);
  const personality = (settings?.personality as Record<string, unknown>) ?? {};

  const { data: entryCount } = await supabase
    .from("diary_entries").select("id", { count: "exact", head: true }).eq("account_id", account.id);

  res.json({
    personality,
    conversationCount: (entryCount as unknown as { count: number } | null)?.count ?? 0,
    hasInsights: !!(personality.traits),
  });
});

export default router;
