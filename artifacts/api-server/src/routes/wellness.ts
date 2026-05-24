import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";
import { verifyHospitalToken } from "./super-admin.js";
import { generateWellnessNewsletter, sendWellnessNewsletterEmails } from "../lib/automation.js";

const router: IRouter = Router();

const UpsertNewsletterBody = z.object({
  content: z.string().min(1),
  weekOf: z.string().min(1),
  topic: z.string().optional(),
  youtubeLink: z.string().url().optional().or(z.literal("")),
  tiktokLink: z.string().url().optional().or(z.literal("")),
});

const GenerateNewsletterBody = z.object({
  topic: z.string().min(1),
});

function weekOfDate(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

// ── Default wellness topics for rotation ───────────────────────────────────────
const DEFAULT_TOPICS = [
  "Hydration and Water Intake",
  "Sleep Hygiene",
  "Stress Management",
  "Physical Activity and Exercise",
  "Healthy Eating Habits",
  "Mental Health Awareness",
  "Heart Health",
  "Immune System Support",
  "Diabetes Prevention",
  "Posture and Back Health",
  "Respiratory Health",
  "Digestive Wellness",
  "Eye Health",
  "Skin Health",
  "Bone and Joint Health",
  "Weight Management",
  "Blood Pressure Management",
  "Cancer Awareness and Prevention",
  "Oral Health",
  "Women's Health",
  "Men's Health",
  "Children's Health",
  "Senior Wellness",
  "Vitamins and Nutrition",
  "Managing Chronic Pain",
  "Emotional Wellbeing",
  "Work-Life Balance",
  "Building Healthy Habits",
];

async function pickNextTopic(hospitalId: number, departments: string[]): Promise<string> {
  const { data: used } = await supabase
    .from("wellness_topics")
    .select("topic, use_count")
    .eq("hospital_id", hospitalId)
    .order("use_count", { ascending: false });

  const usedTopics = new Set((used ?? []).map((t: Record<string, unknown>) => t.topic as string));

  // Try to find an unused topic
  const unused = DEFAULT_TOPICS.filter(t => !usedTopics.has(t));
  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)];
  }

  // All used — find the one used least recently
  const leastUsed = (used ?? []).reduce((min: Record<string, unknown>, t: Record<string, unknown>) =>
    (t.use_count as number) < (min.use_count as number) ? t : min, (used ?? [])[0]);

  return (leastUsed?.topic as string) ?? DEFAULT_TOPICS[0];
}

async function markTopicUsed(hospitalId: number, topic: string): Promise<void> {
  const { data: existing } = await supabase
    .from("wellness_topics")
    .select("id, use_count")
    .eq("hospital_id", hospitalId)
    .eq("topic", topic)
    .maybeSingle();

  if (existing) {
    await supabase.from("wellness_topics")
      .update({ use_count: (existing.use_count as number) + 1, last_used_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("wellness_topics")
      .insert({ hospital_id: hospitalId, topic, use_count: 1, last_used_at: new Date().toISOString() });
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────────

router.get("/wellness", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;

  let q = supabase.from("wellness_newsletter").select("*").order("updated_at", { ascending: false });
  if (hospitalId) {
    q = q.eq("hospital_id", hospitalId);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map((e) => camelize(e)));
});

router.get("/wellness/current", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  const weekOf = weekOfDate(new Date());

  let q = supabase.from("wellness_newsletter").select("*").eq("week_of", weekOf);
  if (hospitalId) q = q.eq("hospital_id", hospitalId);

  const { data } = await q.maybeSingle();
  if (!data) { res.json(null); return; }
  res.json(camelize(data));
});

router.put("/wellness", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;

  const parsed = UpsertNewsletterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: existing } = await supabase
    .from("wellness_newsletter")
    .select("id")
    .eq("week_of", parsed.data.weekOf)
    .eq("hospital_id", hospitalId ?? 0)
    .maybeSingle();

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    content: parsed.data.content,
    updated_at: now,
    topic: parsed.data.topic ?? null,
    youtube_link: parsed.data.youtubeLink || null,
    tiktok_link: parsed.data.tiktokLink || null,
  };
  if (hospitalId) payload.hospital_id = hospitalId;

  let entry;
  if (existing) {
    const { data } = await supabase.from("wellness_newsletter").update(payload).eq("week_of", parsed.data.weekOf).select().single();
    entry = data;
  } else {
    const { data } = await supabase.from("wellness_newsletter").insert({ ...payload, week_of: parsed.data.weekOf }).select().single();
    entry = data;
  }

  if (!entry) { res.status(500).json({ error: "Operation failed" }); return; }
  res.json(camelize(entry));
});

router.post("/wellness/generate", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = GenerateNewsletterBody.safeParse(req.body);
  const { data: settings } = await supabase.from("hospital_settings").select("departments").eq("hospital_id", hospitalId).single();
  const departments: string[] = settings?.departments ? JSON.parse(settings.departments) : [];

  let topic: string;
  if (parsed.success && parsed.data.topic) {
    topic = parsed.data.topic;
  } else {
    topic = await pickNextTopic(hospitalId, departments);
  }

  try {
    const { subtopic, content } = await generateWellnessNewsletter(hospitalId, topic, departments);
    await markTopicUsed(hospitalId, topic);
    res.json({ topic, subtopic, content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.post("/wellness/:id/send", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;

  const { data, error } = await supabase
    .from("wellness_newsletter")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) { res.status(404).json({ error: "Newsletter not found" }); return; }

  // One send per week — block if already sent
  if (data.status === "sent") {
    res.status(409).json({ error: "This newsletter has already been sent this week. Only one send per week is allowed." });
    return;
  }

  const resolvedHospitalId = hospitalId ?? (data.hospital_id as number | null);
  let sent = 0;
  let failed = 0;

  if (resolvedHospitalId) {
    try {
      const result = await sendWellnessNewsletterEmails(
        resolvedHospitalId,
        data.content as string,
        (data.topic as string) ?? "Wellness",
        data.youtube_link as string | null,
        data.tiktok_link as string | null,
      );
      sent = result.sent;
      failed = result.failed;
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Send failed" }) as unknown as void;
    }
  }

  const updated = await supabase
    .from("wellness_newsletter")
    .update({ last_sent_at: new Date().toISOString(), status: "sent", recipient_count: sent })
    .eq("id", id)
    .select()
    .single();

  res.json({ ...camelize(updated.data ?? data), sent, failed });
});

router.get("/wellness/topics", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: used } = await supabase
    .from("wellness_topics")
    .select("topic")
    .eq("hospital_id", hospitalId);

  const usedSet = new Set((used ?? []).map((t: Record<string, unknown>) => t.topic as string));
  const suggested = DEFAULT_TOPICS.filter(t => !usedSet.has(t)).slice(0, 8);
  const all = DEFAULT_TOPICS;

  res.json({ suggested, all, used: [...usedSet] });
});

export default router;
