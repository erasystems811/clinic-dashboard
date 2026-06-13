import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest, hashPassword, verifyPassword } from "../lib/patient-auth.js";
import { buildRagContext } from "../lib/rag.js";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Fetch 2-week wellness summary string for companion system prompt
async function getWellnessContext(accountId: number): Promise<string> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
    const fromDate = twoWeeksAgo.toISOString().split("T")[0];

    const DAILY_TYPES = ["water","medications","workout","sleep","mood_check","fruit","vitals","eyebreak","sunscreen","outdoors"];
    const MODULE_LABELS: Record<string, string> = {
      water:"water intake", medications:"medications", workout:"workouts", sleep:"sleep",
      mood_check:"mood check-ins", fruit:"eating fruit", vitals:"vitals", eyebreak:"eye breaks",
      sunscreen:"sunscreen", outdoors:"outdoor time",
    };

    const [{ data: modules }, { data: logs }] = await Promise.all([
      supabase.from("wellness_modules").select("module_type, enabled").eq("account_id", accountId).eq("enabled", true),
      supabase.from("wellness_logs").select("module_type, log_date")
        .eq("account_id", accountId).gte("log_date", fromDate).in("module_type", DAILY_TYPES),
    ]);

    // Use log existence as proxy for "did something" (good enough for companion context)
    const logDates: Record<string, Set<string>> = {};
    for (const l of logs ?? []) {
      const t = l.module_type as string, d = l.log_date as string;
      if (!logDates[t]) logDates[t] = new Set();
      logDates[t].add(d);
    }

    const lines: string[] = [];
    let thisTotal = 0, lastTotal = 0, possible = 0;
    const skippedThis: string[] = [], improvedThis: string[] = [], droppedThis: string[] = [];

    for (const m of modules ?? []) {
      if (!DAILY_TYPES.includes(m.module_type as string)) continue;
      const dates = logDates[m.module_type as string] ?? new Set<string>();
      let thisW = 0, lastW = 0;
      for (let i = 0; i < 7; i++) {
        const d1 = new Date(); d1.setDate(d1.getDate() - i);
        const d1s = d1.toISOString().split("T")[0];
        if (d1s <= today && dates.has(d1s)) thisW++;
        const d2 = new Date(); d2.setDate(d2.getDate() - (i + 7));
        if (dates.has(d2.toISOString().split("T")[0])) lastW++;
      }
      const label = MODULE_LABELS[m.module_type as string] ?? m.module_type as string;
      lines.push(`  ${label}: this week ${thisW}/7, last week ${lastW}/7`);
      thisTotal += thisW; lastTotal += lastW; possible += 7;
      if (thisW <= 1) skippedThis.push(label);
      if (thisW >= lastW + 2) improvedThis.push(label);
      if (lastW >= thisW + 2) droppedThis.push(label);
    }

    if (lines.length === 0) return "";

    const thisRate = possible > 0 ? Math.round((thisTotal / possible) * 100) : 0;
    const lastRate = possible > 0 ? Math.round((lastTotal / possible) * 100) : 0;
    const change = thisRate - lastRate;
    const changeTxt = change > 0 ? `up ${change}% from last week` : change < 0 ? `down ${Math.abs(change)}% from last week` : "same as last week";

    let ctx = `Overall consistency: ${thisRate}% this week (${changeTxt}, ${lastRate}% last week)\n`;
    ctx += `Per habit (days logged):\n${lines.join("\n")}`;
    if (skippedThis.length) ctx += `\nMostly skipping: ${skippedThis.join(", ")}`;
    if (improvedThis.length) ctx += `\nNoticeably improved: ${improvedThis.join(", ")}`;
    if (droppedThis.length) ctx += `\nDropped off vs last week: ${droppedThis.join(", ")}`;
    return ctx;
  } catch {
    return "";
  }
}

function buildSystemPrompt(
  name: string, age: number | null, isBirthday: boolean,
  personality: Record<string, unknown>, recentMoods: number[],
  wellnessContext?: string,
  ragContext?: string
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

  const wellnessSection = wellnessContext ? `\n\n${name}'s wellness data (last 2 weeks):\n${wellnessContext}\n\nUse this naturally — don't read it out like a report. Weave in ONE specific observation when the moment is right. Say things like "I noticed you've been struggling with workouts lately" or "You've been so consistent with your water this week!" Make them feel seen, not tracked.` : "";

  const ragSection = ragContext
    ? `\n\nRelevant psychological knowledge (use naturally, never quote directly):\n${ragContext}`
    : "";

  return `You are ERA Health's private companion — a warm, emotionally intelligent, psychologically-aware presence in ${name}'s life.

${age ? `${name} is ${age} years old.` : ""}
${birthdaySection}

${personalitySection}

${moodSummary}
${wellnessSection}

How you show up:
- Warm but never clingy or performative
- You listen deeply and reflect back what you notice, when the moment calls for it
- You ask thoughtful follow-up questions — but only one at a time, never interrogating
- You celebrate wins genuinely and sit with losses without rushing to fix them
- You notice patterns — wellness and emotional — and gently name them when it feels right
- Brief when they're brief, expansive when they want to talk
- You never give medical diagnoses — you are a companion, not a doctor
- If they seem distressed, gently check in and, where appropriate, encourage them to speak to someone they trust
- You remember what they share — each conversation builds on the last${ragSection}`.trim();
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      temperature: 0.7,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
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

  const [accountInfo, settings, recentMoodLogs, wellnessCtx, ragCtx] = await Promise.all([
    getAccountInfo(account.id),
    getOrCreateSettings(account.id),
    supabase.from("wellness_logs").select("data").eq("account_id", account.id)
      .eq("module_type", "mood_check").gte("log_date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })())
      .order("log_date", { ascending: false }).limit(7),
    getWellnessContext(account.id),
    buildRagContext("emotional wellbeing mental health support", "psychology"),
  ]);

  const name = (accountInfo?.display_name as string | null) || (accountInfo?.username as string) || "friend";
  const dob = accountInfo?.date_of_birth as string | null;
  const age = calcAge(dob);
  const birthday = isBirthdayToday(dob);
  const personality = (settings?.personality as Record<string, unknown>) ?? {};
  const recentMoods = (recentMoodLogs.data ?? []).map((l) => (l.data as Record<string, number>).mood).filter(Boolean);
  const systemPrompt = buildSystemPrompt(name, age, birthday, personality, recentMoods, wellnessCtx, ragCtx);

  // Create entry row
  const { data: entry, error: entryErr } = await supabase.from("diary_entries").insert({
    account_id: account.id,
    type: "conversation",
    title: `Conversation — ${new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long" })}`,
  }).select().single();

  if (entryErr || !entry) { res.status(500).json({ error: "Failed to create conversation" }); return; }

  // Return immediately so the client navigates to chat without waiting for the AI
  res.json({ entryId: entry.id });

  // Generate opening message in the background (fire and forget)
  const openingUserMsg = birthday ? "It's my birthday today." : "Hi. I'm here.";
  void (async () => {
    try {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 400,
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: openingUserMsg },
        ],
      });
      const aiText = aiResponse.choices[0]?.message?.content?.trim() ?? "Hey! What's on your mind today?";
      await supabase.from("diary_messages").insert([
        { entry_id: entry.id, role: "user", content: openingUserMsg },
        { entry_id: entry.id, role: "assistant", content: aiText },
      ]);
    } catch {
      // Fallback: insert a simple greeting so the chat isn't empty
      await supabase.from("diary_messages").insert([
        { entry_id: entry.id, role: "assistant", content: "Hey! What's on your mind today?" },
      ]);
    }
  })();
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

  const [accountInfo, settings, recentMoodLogs, wellnessCtx, ragCtx] = await Promise.all([
    getAccountInfo(account.id),
    getOrCreateSettings(account.id),
    supabase.from("wellness_logs").select("data").eq("account_id", account.id)
      .eq("module_type", "mood_check").gte("log_date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })())
      .limit(7),
    getWellnessContext(account.id),
    buildRagContext(String(message), "psychology"),
  ]);

  const name = (accountInfo?.display_name as string | null) || (accountInfo?.username as string) || "friend";
  const dob = accountInfo?.date_of_birth as string | null;
  const age = calcAge(dob);
  const birthday = isBirthdayToday(dob);
  const personality = (settings?.personality as Record<string, unknown>) ?? {};
  const recentMoods = (recentMoodLogs.data ?? []).map((l) => (l.data as Record<string, number>).mood).filter(Boolean);
  const systemPrompt = buildSystemPrompt(name, age, birthday, personality, recentMoods, wellnessCtx, ragCtx);

  // Build messages array for API
  const msgs: { role: "user" | "assistant"; content: string }[] = [
    ...((history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }))),
    { role: "user", content: String(message) },
  ];

  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    temperature: 0.9,
    messages: [
      { role: "system", content: systemPrompt },
      ...msgs,
    ],
  });

  const aiText = aiResponse.choices[0]?.message?.content?.trim() ?? "";

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

  const { count: entryCount } = await supabase
    .from("diary_entries").select("id", { count: "exact", head: true }).eq("account_id", account.id);

  res.json({
    personality,
    conversationCount: entryCount ?? 0,
    hasInsights: !!(personality.traits),
  });
});

export default router;
