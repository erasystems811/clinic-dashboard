import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";
import { verifyHospitalToken } from "./super-admin.js";
import { generateWellnessNewsletter, sendWellnessNewsletterEmails, getHospitalContext } from "../lib/automation.js";
import { sendEmail, wrapHtml } from "../lib/email.js";
import { deliverMobileMessage } from "../lib/messaging.js";
import { deductSmsFromWallet, hasSufficientSmsBalance } from "../lib/wallet.js";

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
  // Core wellness
  "Hydration and Water Intake",
  "Sleep Hygiene",
  "Stress Management",
  "Physical Activity and Exercise",
  "Healthy Eating Habits",
  "Balanced Diet and Nutrition",
  "Building Healthy Habits",
  "Work-Life Balance",
  "Emotional Wellbeing",
  // Mental health
  "Mental Health Awareness",
  "Managing Anxiety",
  "Depression Awareness",
  "PTSD and Trauma Recovery",
  "Mindfulness and Meditation",
  "Overcoming Burnout",
  "Social Connections and Loneliness",
  "Healthy Relationships",
  "Self-Care Practices",
  // Heart and circulation
  "Heart Health",
  "Blood Pressure Management",
  "Cholesterol and Heart Disease",
  "Stroke Prevention",
  // Metabolic and endocrine
  "Diabetes Prevention",
  "Blood Sugar Management",
  "Thyroid Health",
  "Hormone Health",
  "Weight Management",
  "Obesity and Health Risks",
  "Intermittent Fasting",
  "Insulin Resistance",
  // Respiratory and ENT
  "Respiratory Health",
  "Asthma Management",
  "Allergy Awareness",
  "Sleep Apnoea and Snoring",
  // Digestive system
  "Digestive Wellness",
  "Gut Microbiome Health",
  "Liver Health",
  "Kidney Health",
  // Bones, joints and muscles
  "Bone and Joint Health",
  "Posture and Back Health",
  "Arthritis Management",
  "Osteoporosis Prevention",
  "Muscle Health and Strength",
  "Stretching and Flexibility",
  // Immune and infection
  "Immune System Support",
  "Vaccine Awareness",
  "Cold and Flu Prevention",
  "Infection Control and Hygiene",
  // Cancer
  "Cancer Awareness and Prevention",
  "Early Detection and Screening",
  // Sensory health
  "Eye Health",
  "Hearing Health",
  "Oral Health",
  "Skin Health",
  "Safe Sun Exposure",
  // Nervous system and brain
  "Brain Health and Memory",
  "Headache and Migraine Management",
  "Managing Chronic Pain",
  "Nerve Health and Neuropathy",
  // Men's and women's health
  "Women's Health",
  "Men's Health",
  "Sexual Health and Intimacy",
  "Fertility and Reproductive Health",
  "Menopause and Hormonal Changes",
  "Prostate Health",
  "Breastfeeding and Infant Nutrition",
  // Life stages
  "Children's Health",
  "Teen Health and Adolescent Wellness",
  "Senior Wellness",
  "Healthy Ageing",
  // Vitamins, diet and nutrition
  "Vitamins and Nutrition",
  "Protein and Muscle Health",
  "Healthy Fats and Omega-3",
  "Iron Deficiency and Anaemia",
  "Meal Prep and Cooking for Health",
  "Sugar and Processed Foods",
  "Food Safety and Hygiene",
  // Movement and recovery
  "Walking and Everyday Movement",
  "Strength Training Benefits",
  "Yoga and Mind-Body Practices",
  "Injury Prevention and Rehabilitation",
  "Recovery and Rest Days",
  // Harmful habits and substance use
  "Alcohol and Its Health Effects",
  "Tobacco and Smoking Cessation",
  "Vaping and E-Cigarette Risks",
  "Cannabis Use and Health Effects",
  "Drug Abuse and Addiction",
  "Shisha and Hookah Health Risks",
  "Overcoming Harmful Habits",
  "Caffeine and Energy Drinks",
  // Environment and lifestyle
  "Screen Time and Digital Wellness",
  "Environmental Health and Pollution",
  "Travel Health and Safety",
  "Workplace Ergonomics",
  "Financial Stress and Health",
  // Medical adherence and prevention
  "Medication Adherence",
  "Pain Management without Opioids",
  "First Aid and Emergency Preparedness",
  "Understanding Lab Results",
  "Managing Multiple Medications",
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
  "Psychiatry":        ["Mental Health Awareness", "Emotional Wellbeing", "Sleep Hygiene", "Stress Management", "Work-Life Balance", "Drug Abuse and Addiction", "Alcohol and Its Health Effects", "Overcoming Harmful Habits"],
  "Psychology":        ["Mental Health Awareness", "Emotional Wellbeing", "Stress Management", "Work-Life Balance", "Building Healthy Habits", "Overcoming Harmful Habits"],
  "Dermatology":       ["Skin Health", "Hydration and Water Intake", "Vitamins and Nutrition", "Immune System Support", "Healthy Eating Habits", "Tobacco and Smoking Cessation", "Vaping and E-Cigarette Risks"],
  "Ophthalmology":     ["Eye Health", "Vitamins and Nutrition", "Sleep Hygiene", "Hydration and Water Intake", "Physical Activity and Exercise", "Cannabis Use and Health Effects"],
  "Pulmonology":       ["Respiratory Health", "Physical Activity and Exercise", "Stress Management", "Immune System Support", "Tobacco and Smoking Cessation", "Vaping and E-Cigarette Risks", "Shisha and Hookah Health Risks", "Cannabis Use and Health Effects"],
  "Respiratory":       ["Respiratory Health", "Physical Activity and Exercise", "Tobacco and Smoking Cessation", "Vaping and E-Cigarette Risks", "Shisha and Hookah Health Risks", "Immune System Support", "Sleep Hygiene"],
  "Gastroenterology":  ["Digestive Wellness", "Healthy Eating Habits", "Hydration and Water Intake", "Stress Management", "Vitamins and Nutrition", "Alcohol and Its Health Effects", "Balanced Diet and Nutrition"],
  "Geriatrics":        ["Senior Wellness", "Bone and Joint Health", "Mental Health Awareness", "Immune System Support", "Managing Chronic Pain", "Alcohol and Its Health Effects"],
  "Surgery":           ["Managing Chronic Pain", "Building Healthy Habits", "Immune System Support", "Healthy Eating Habits", "Stress Management"],
  "Emergency":         ["Stress Management", "Mental Health Awareness", "Sleep Hygiene", "Building Healthy Habits", "Work-Life Balance", "Drug Abuse and Addiction", "Alcohol and Its Health Effects"],
  "Urology":           ["Hydration and Water Intake", "Men's Health", "Sexual Health and Intimacy", "Healthy Eating Habits", "Physical Activity and Exercise", "Weight Management"],
  "Gynaecology":       ["Women's Health", "Sexual Health and Intimacy", "Mental Health Awareness", "Healthy Eating Habits", "Stress Management", "Physical Activity and Exercise"],
  "Dentistry":         ["Oral Health", "Healthy Eating Habits", "Vitamins and Nutrition", "Hydration and Water Intake", "Tobacco and Smoking Cessation", "Shisha and Hookah Health Risks"],
  "ENT":               ["Respiratory Health", "Immune System Support", "Vitamins and Nutrition", "Sleep Hygiene", "Tobacco and Smoking Cessation", "Shisha and Hookah Health Risks", "Vaping and E-Cigarette Risks"],
  "Rheumatology":      ["Bone and Joint Health", "Managing Chronic Pain", "Physical Activity and Exercise", "Stress Management", "Vitamins and Nutrition"],
  "Nephrology":        ["Hydration and Water Intake", "Blood Pressure Management", "Healthy Eating Habits", "Stress Management", "Vitamins and Nutrition", "Alcohol and Its Health Effects"],
  "Haematology":       ["Immune System Support", "Vitamins and Nutrition", "Healthy Eating Habits", "Emotional Wellbeing", "Mental Health Awareness", "Alcohol and Its Health Effects"],
  "Addiction Medicine": ["Drug Abuse and Addiction", "Alcohol and Its Health Effects", "Overcoming Harmful Habits", "Cannabis Use and Health Effects", "Tobacco and Smoking Cessation", "Mental Health Awareness"],
  "Sexual Health":     ["Sexual Health and Intimacy", "Men's Health", "Women's Health", "Mental Health Awareness", "Emotional Wellbeing"],
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

// Returns current usage counts so the UI can show limits proactively
router.get("/wellness/limits", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const weekOf = weekOfDate(new Date());
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: weekRecord }, { count: bulkCount }] = await Promise.all([
    supabase.from("wellness_newsletter").select("generate_count").eq("hospital_id", hospitalId).eq("week_of", weekOf).maybeSingle(),
    supabase.from("automation_log").select("id", { count: "exact", head: true }).eq("hospital_id", hospitalId).eq("automation_type", "bulk_email_blast").eq("status", "sent").gte("created_at", monthStart.toISOString()),
  ]);

  res.json({
    generateCount: (weekRecord?.generate_count as number) ?? 0,
    weeklyLimit: 5,
    bulkSentThisMonth: bulkCount ?? 0,
    monthlyLimit: 2,
  });
});

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
  const { data: dayRecord } = await supabase
    .from("wellness_newsletter")
    .select("id, generate_count")
    .eq("hospital_id", hospitalId)
    .eq("week_of", weekOf)
    .maybeSingle();

  const currentCount = (dayRecord?.generate_count as number) ?? 0;
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
    if (dayRecord) {
      await supabase.from("wellness_newsletter")
        .update({ generate_count: newCount })
        .eq("id", dayRecord.id);
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
    const { data: mods } = await supabase.from("hospital_modules").select("wellness_newsletter_enabled").eq("hospital_id", resolvedHospitalId).single();
    if (!mods?.wellness_newsletter_enabled) {
      res.status(403).json({ error: "Wellness newsletter module is disabled for this hospital." });
      return;
    }
  }

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
  const suggested = orderedByDept.filter(t => !usedSet.has(t));
  const all = orderedByDept;

  res.json({ suggested, all, used: [...usedSet], departments });
});

// ── Bulk Email — custom message to all active patients ────────────────────────
const BulkEmailBody = z.object({
  subject:        z.string().min(1),
  message:        z.string().min(1),
  includeDormant: z.boolean().optional().default(false),
});

router.post("/wellness/bulk-email", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = BulkEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "subject and message are required" }); return; }

  // Check wellness + bulk email module is enabled
  const { data: bulkMods } = await supabase.from("hospital_modules").select("wellness_newsletter_enabled").eq("hospital_id", hospitalId).maybeSingle();
  if (!bulkMods?.wellness_newsletter_enabled) {
    res.status(403).json({ error: "Wellness Newsletter + Bulk Email module is disabled for this hospital." });
    return;
  }

  // Limit bulk email sends to 2 per calendar month per hospital
  const MONTHLY_BULK_LIMIT = 2;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: bulkSentThisMonth } = await supabase
    .from("automation_log")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("automation_type", "bulk_email_blast")
    .eq("status", "sent")
    .gte("created_at", monthStart.toISOString());

  if ((bulkSentThisMonth ?? 0) >= MONTHLY_BULK_LIMIT) {
    res.status(429).json({
      error: `You have reached the maximum of ${MONTHLY_BULK_LIMIT} bulk email sends for this month. The limit resets on the 1st of next month.`,
      bulkSentThisMonth: bulkSentThisMonth ?? 0,
      monthlyLimit: MONTHLY_BULK_LIMIT,
    });
    return;
  }

  try {
    const hCtx = await getHospitalContext(hospitalId);

    const stages = ["Active", "Post Treatment", "In Care"];
    if (parsed.data.includeDormant) stages.push("Dormant");

    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email")
      .eq("hospital_id", hCtx.hospitalCode)
      .in("stage", stages)
      .not("email", "is", null);

    let sent = 0;
    let failed = 0;

    for (const patient of patients ?? []) {
      if (!patient.email) continue;
      try {
        const html = wrapHtml(
          `<p>${parsed.data.message.replace(/\n/g, "</p><p>")}</p>
           <p style="font-size:12px;color:#8b949e;margin-top:24px;border-top:1px solid #30363d;padding-top:16px;">Please do not reply to this email directly.</p>`,
          hCtx.hospitalName,
        );
        await sendEmail({
          to: patient.email as string,
          from: hCtx.fromAddress,
          subject: parsed.data.subject,
          html,
          text: `${parsed.data.message}\n\nPlease do not reply to this email directly.\n\n${hCtx.hospitalName}`,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    // Log this bulk send event so the monthly limit check can count it
    await supabase.from("automation_log").insert({
      hospital_id: hospitalId,
      automation_type: "bulk_email_blast",
      channel: "email",
      status: "sent",
      message_preview: `Bulk email: "${parsed.data.subject}" — ${sent} sent, ${failed} failed`,
      created_at: new Date().toISOString(),
    });

    res.json({ sent, failed, total: (patients ?? []).length, bulkSentThisMonth: (bulkSentThisMonth ?? 0) + 1, monthlyLimit: MONTHLY_BULK_LIMIT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Bulk SMS — custom SMS to all patients with a phone number ─────────────────
const BulkSmsBody = z.object({
  message:        z.string().min(1).max(160),
  includeDormant: z.boolean().optional().default(false),
});

router.post("/wellness/bulk-sms", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = BulkSmsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "message is required (max 160 chars)" }); return; }

  try {
    const hCtx = await getHospitalContext(hospitalId);
    const stages = ["Active", "Post Treatment", "In Care"];
    if (parsed.data.includeDormant) stages.push("Dormant");

    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, phone")
      .eq("hospital_id", hCtx.hospitalCode)
      .in("stage", stages)
      .not("phone", "is", null);

    let sent = 0;
    let failed = 0;
    let dndBlocked = 0;
    let skippedNoFunds = 0;

    for (const patient of patients ?? []) {
      if (!patient.phone) continue;
      const canAfford = await hasSufficientSmsBalance(hospitalId);
      if (!canAfford) { skippedNoFunds++; break; }
      try {
        await deliverMobileMessage("sms", patient.phone as string, parsed.data.message, { senderId: hCtx.termiiSenderId });
        await deductSmsFromWallet(hospitalId, `Bulk SMS — ${patient.first_name} ${patient.last_name}`);
        await supabase.from("patients").update({ dnd_blocked: false }).eq("id", patient.id);
        sent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.startsWith("DND_BLOCKED:")) {
          await supabase.from("patients").update({ dnd_blocked: true }).eq("id", patient.id);
          dndBlocked++;
        } else { failed++; }
      }
    }

    res.json({ sent, failed, dndBlocked, skippedNoFunds, total: (patients ?? []).length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
