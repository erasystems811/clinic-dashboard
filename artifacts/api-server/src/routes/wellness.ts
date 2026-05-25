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
  topic:    z.string().min(1),
  subtopic: z.string().optional(),
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

// Topics relevant to each department type — used to surface contextual suggestions
const DEPARTMENT_TOPICS: Record<string, string[]> = {
  "Cardiology":        ["Heart Health", "Blood Pressure Management", "Stress Management", "Physical Activity and Exercise", "Weight Management"],
  "Pediatrics":        ["Children's Health", "Healthy Eating Habits", "Sleep Hygiene", "Immune System Support", "Physical Activity and Exercise"],
  "Orthopedics":       ["Bone and Joint Health", "Posture and Back Health", "Physical Activity and Exercise", "Managing Chronic Pain", "Building Healthy Habits"],
  "General Practice":  ["Hydration and Water Intake", "Sleep Hygiene", "Stress Management", "Healthy Eating Habits", "Building Healthy Habits"],
  "Oncology":          ["Immune System Support", "Mental Health Awareness", "Emotional Wellbeing", "Cancer Awareness and Prevention", "Vitamins and Nutrition"],
  "Neurology":         ["Mental Health Awareness", "Sleep Hygiene", "Stress Management", "Emotional Wellbeing", "Managing Chronic Pain"],
  "Endocrinology":     ["Diabetes Prevention", "Weight Management", "Healthy Eating Habits", "Physical Activity and Exercise", "Blood Pressure Management"],
  "Obstetrics":        ["Women's Health", "Healthy Eating Habits", "Stress Management", "Sleep Hygiene", "Physical Activity and Exercise"],
  "Maternity":         ["Women's Health", "Healthy Eating Habits", "Stress Management", "Sleep Hygiene", "Emotional Wellbeing"],
  "Physiotherapy":     ["Physical Activity and Exercise", "Posture and Back Health", "Bone and Joint Health", "Managing Chronic Pain", "Building Healthy Habits"],
  "Nutrition":         ["Healthy Eating Habits", "Weight Management", "Digestive Wellness", "Vitamins and Nutrition", "Hydration and Water Intake"],
  "Dietetics":         ["Healthy Eating Habits", "Weight Management", "Digestive Wellness", "Vitamins and Nutrition", "Diabetes Prevention"],
  "Psychiatry":        ["Mental Health Awareness", "Emotional Wellbeing", "Sleep Hygiene", "Stress Management", "Work-Life Balance"],
  "Psychology":        ["Mental Health Awareness", "Emotional Wellbeing", "Stress Management", "Work-Life Balance", "Building Healthy Habits"],
  "Dermatology":       ["Skin Health", "Hydration and Water Intake", "Vitamins and Nutrition", "Immune System Support", "Healthy Eating Habits"],
  "Ophthalmology":     ["Eye Health", "Vitamins and Nutrition", "Sleep Hygiene", "Hydration and Water Intake", "Physical Activity and Exercise"],
  "Pulmonology":       ["Respiratory Health", "Physical Activity and Exercise", "Stress Management", "Immune System Support", "Building Healthy Habits"],
  "Respiratory":       ["Respiratory Health", "Physical Activity and Exercise", "Stress Management", "Immune System Support", "Sleep Hygiene"],
  "Gastroenterology":  ["Digestive Wellness", "Healthy Eating Habits", "Hydration and Water Intake", "Stress Management", "Vitamins and Nutrition"],
  "Geriatrics":        ["Senior Wellness", "Bone and Joint Health", "Mental Health Awareness", "Immune System Support", "Managing Chronic Pain"],
  "Surgery":           ["Managing Chronic Pain", "Building Healthy Habits", "Immune System Support", "Healthy Eating Habits", "Stress Management"],
  "Emergency":         ["Stress Management", "Mental Health Awareness", "Sleep Hygiene", "Building Healthy Habits", "Work-Life Balance"],
  "Urology":           ["Hydration and Water Intake", "Men's Health", "Healthy Eating Habits", "Physical Activity and Exercise", "Weight Management"],
  "Gynaecology":       ["Women's Health", "Mental Health Awareness", "Healthy Eating Habits", "Stress Management", "Physical Activity and Exercise"],
  "Dentistry":         ["Oral Health", "Healthy Eating Habits", "Vitamins and Nutrition", "Hydration and Water Intake", "Stress Management"],
  "ENT":               ["Respiratory Health", "Immune System Support", "Vitamins and Nutrition", "Sleep Hygiene", "Hydration and Water Intake"],
  "Rheumatology":      ["Bone and Joint Health", "Managing Chronic Pain", "Physical Activity and Exercise", "Stress Management", "Vitamins and Nutrition"],
  "Nephrology":        ["Hydration and Water Intake", "Blood Pressure Management", "Healthy Eating Habits", "Stress Management", "Vitamins and Nutrition"],
  "Haematology":       ["Immune System Support", "Vitamins and Nutrition", "Healthy Eating Habits", "Emotional Wellbeing", "Mental Health Awareness"],
};

function getTopicsForDepartments(departments: string[]): string[] {
  if (departments.length === 0) return DEFAULT_TOPICS;

  // Score each topic by how many of the hospital's departments recommend it
  const scores = new Map<string, number>();
  for (const dept of departments) {
    // Try exact match first, then case-insensitive partial match
    const key = Object.keys(DEPARTMENT_TOPICS).find(
      k => k.toLowerCase() === dept.toLowerCase() || dept.toLowerCase().includes(k.toLowerCase()),
    );
    const relevant = key ? DEPARTMENT_TOPICS[key] : [];
    for (const topic of relevant) {
      scores.set(topic, (scores.get(topic) ?? 0) + 1);
    }
  }

  // Return topics sorted by relevance score (descending), then pad with unused DEFAULT_TOPICS
  const scored = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const scoredSet = new Set(scored);
  const remainder = DEFAULT_TOPICS.filter(t => !scoredSet.has(t));
  return [...scored, ...remainder];
}

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

  const WEEKLY_LIMIT = 5;
  const weekOf = weekOfDate(new Date());

  // Check weekly regeneration limit
  const { data: weekRecord } = await supabase
    .from("wellness_newsletter")
    .select("id, generate_count")
    .eq("hospital_id", hospitalId)
    .eq("week_of", weekOf)
    .maybeSingle();

  const currentCount = (weekRecord?.generate_count as number) ?? 0;
  if (currentCount >= WEEKLY_LIMIT) {
    res.status(429).json({
      error: `You have reached the maximum of ${WEEKLY_LIMIT} generations for this week. The limit resets next Monday.`,
      generateCount: currentCount,
      weeklyLimit: WEEKLY_LIMIT,
    });
    return;
  }

  const parsed = GenerateNewsletterBody.safeParse(req.body);
  const { data: settings } = await supabase.from("hospital_settings").select("departments").eq("hospital_id", hospitalId).single();
  const departments: string[] = settings?.departments ? JSON.parse(settings.departments) : [];

  let topic: string;
  if (parsed.success && parsed.data.topic) {
    topic = parsed.data.topic;
  } else {
    topic = await pickNextTopic(hospitalId, departments);
  }

  const fixedSubtopic = parsed.success ? parsed.data.subtopic : undefined;

  try {
    // Increment count before generating (fail-safe against concurrent calls)
    const newCount = currentCount + 1;
    if (weekRecord) {
      await supabase.from("wellness_newsletter")
        .update({ generate_count: newCount })
        .eq("id", weekRecord.id);
    } else {
      await supabase.from("wellness_newsletter").upsert({
        hospital_id: hospitalId,
        week_of: weekOf,
        generate_count: newCount,
        content: "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "hospital_id,week_of" });
    }

    const { subtopic, angle, content } = await generateWellnessNewsletter(hospitalId, topic, departments, fixedSubtopic);
    await markTopicUsed(hospitalId, topic);
    res.json({ topic, subtopic, angle, content, generateCount: newCount, weeklyLimit: WEEKLY_LIMIT });
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

  const [{ data: used }, { data: settings }] = await Promise.all([
    supabase.from("wellness_topics").select("topic").eq("hospital_id", hospitalId),
    supabase.from("hospital_settings").select("departments").eq("hospital_id", hospitalId).single(),
  ]);

  const departments: string[] = settings?.departments ? JSON.parse(settings.departments as string) : [];
  const usedSet = new Set((used ?? []).map((t: Record<string, unknown>) => t.topic as string));

  // Get all topics ordered by department relevance, then filter out already-used ones for suggestions
  const orderedByDept = getTopicsForDepartments(departments);
  const suggested = orderedByDept.filter(t => !usedSet.has(t)).slice(0, 8);
  const all = orderedByDept;

  res.json({ suggested, all, used: [...usedSet], departments });
});

export default router;
