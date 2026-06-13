import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { buildRagContext } from "../lib/rag.js";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string { return new Date().toISOString().split("T")[0]!; }

function getMonday(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split("T")[0]!;
}

function calcBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  // Mifflin-St Jeor
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "Female" ? Math.round(base - 161) : Math.round(base + 5);
}

function activityFactor(lifestyle: string): number {
  if (lifestyle === "working_physical") return 1.55;
  if (lifestyle === "student" || lifestyle === "working_office") return 1.375;
  if (lifestyle === "stay_home") return 1.375;
  return 1.375;
}

async function getProfile(accountId: number) {
  const { data } = await supabase
    .from("weightloss_profile")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  return data as WeightlossProfile | null;
}

interface WeightlossProfile {
  id: number;
  account_id: number;
  current_weight_kg: number;
  goal_weight_kg: number;
  height_cm: number;
  timeline_weeks: number;
  lifestyle: string;
  cooking_ability: string;
  budget: string;
  food_preferences: string[];
  wake_time: string;
  sleep_time: string;
  active_period: string;
  fasting_interested: boolean;
  fasting_start: string | null;
  fasting_end: string | null;
  workout_location: string;
  workout_days_per_week: number;
  medical_notes: string | null;
  bmr: number;
  tdee: number;
  daily_calorie_target: number;
  weekly_loss_target_kg: number;
  total_coins_earned: number;
  cheat_days_available: number;
  onboarding_complete: boolean;
}

async function getAccountInfo(accountId: number) {
  const { data } = await supabase
    .from("patient_accounts")
    .select("display_name, username, date_of_birth, gender")
    .eq("id", accountId)
    .single();
  return data as { display_name: string | null; username: string; date_of_birth: string | null; gender: string | null } | null;
}

function calcAge(dob: string | null): number {
  if (!dob) return 30;
  const today = new Date();
  const bd = new Date(dob);
  let age = today.getFullYear() - bd.getFullYear();
  if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--;
  return age;
}

async function awardCoins(accountId: number, amount: number) {
  await supabase.rpc("increment_coins", { p_account_id: accountId, p_amount: amount });
}

// ── GET /api/patient-app/weightloss/profile ───────────────────────────────────
router.get("/api/patient-app/weightloss/profile", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(account.id);
  res.json({ profile, hasProfile: !!profile, onboardingComplete: profile?.onboarding_complete ?? false });
});

// ── POST /api/patient-app/weightloss/onboard ─────────────────────────────────
router.post("/api/patient-app/weightloss/onboard", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    currentWeightKg, goalWeightKg, heightCm, timelineWeeks,
    lifestyle, cookingAbility, budget, foodPreferences,
    wakeTime, sleepTime, activePeriod,
    fastingInterested, fastingStart, fastingEnd,
    workoutLocation, workoutDaysPerWeek, medicalNotes,
  } = req.body as {
    currentWeightKg: number; goalWeightKg: number; heightCm: number; timelineWeeks: number;
    lifestyle: string; cookingAbility: string; budget: string; foodPreferences: string[];
    wakeTime: string; sleepTime: string; activePeriod: string;
    fastingInterested: boolean; fastingStart?: string; fastingEnd?: string;
    workoutLocation: string; workoutDaysPerWeek: number; medicalNotes?: string;
  };

  const accountInfo = await getAccountInfo(account.id);
  const age = calcAge(accountInfo?.date_of_birth ?? null);
  const gender = accountInfo?.gender ?? "Male";

  const bmr = calcBMR(currentWeightKg, heightCm, age, gender);
  const tdee = Math.round(bmr * activityFactor(lifestyle));
  const weightToLose = currentWeightKg - goalWeightKg;
  const weeklyLossTarget = Math.min(1, weightToLose / timelineWeeks);
  const dailyCaloricDeficit = Math.round(weeklyLossTarget * 7700 / 7); // 7700 kcal per kg
  const dailyCalorieTarget = Math.max(1200, tdee - dailyCaloricDeficit);

  const { error } = await supabase.from("weightloss_profile").upsert({
    account_id: account.id,
    current_weight_kg: currentWeightKg,
    goal_weight_kg: goalWeightKg,
    height_cm: heightCm,
    timeline_weeks: timelineWeeks,
    lifestyle,
    cooking_ability: cookingAbility,
    budget,
    food_preferences: foodPreferences ?? [],
    wake_time: wakeTime ?? "07:00",
    sleep_time: sleepTime ?? "23:00",
    active_period: activePeriod,
    fasting_interested: fastingInterested ?? false,
    fasting_start: fastingStart ?? null,
    fasting_end: fastingEnd ?? null,
    workout_location: workoutLocation,
    workout_days_per_week: workoutDaysPerWeek ?? 3,
    medical_notes: medicalNotes ?? null,
    bmr, tdee,
    daily_calorie_target: dailyCalorieTarget,
    weekly_loss_target_kg: weeklyLossTarget,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true, dailyCalorieTarget, tdee, bmr });
});

// ── POST /api/patient-app/weightloss/generate-plan ───────────────────────────
router.post("/api/patient-app/weightloss/generate-plan", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await getProfile(account.id);
  if (!profile?.onboarding_complete) { res.status(400).json({ error: "Complete onboarding first" }); return; }

  const accountInfo = await getAccountInfo(account.id);
  const name = accountInfo?.display_name || accountInfo?.username || "friend";
  const weekStart = (req.body as { weekStart?: string }).weekStart ?? getMonday();

  // Build dates for the week
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]!);
  }

  const ragCtx = await buildRagContext(
    `weight loss meal plan Nigeria ${profile.cooking_ability} ${profile.budget} budget`,
    "weightloss",
  );

  const fastingNote = profile.fasting_interested && profile.fasting_start && profile.fasting_end
    ? `Intermittent fasting window: eat only between ${profile.fasting_end} and ${profile.fasting_start}.`
    : "No intermittent fasting.";

  const workoutDays = profile.workout_days_per_week;
  // Spread workout days evenly across the week
  const workoutDayIndices = new Set<number>();
  const step = Math.floor(7 / workoutDays);
  for (let i = 0; i < workoutDays; i++) workoutDayIndices.add(i * step);

  const systemPrompt = `You are a strict but caring Nigerian weight loss coach. You know Nigerian food extremely well — jollof rice, eba, egusi soup, suya, bole, moi moi, akara, puff puff, ofada, fried plantain, pepper soup, ogbono soup, indomie, etc. You know their calorie counts accurately.

You are creating a personalised 7-day weight loss meal and workout plan for ${name}.

Profile:
- Current weight: ${profile.current_weight_kg}kg → Goal: ${profile.goal_weight_kg}kg
- Daily calorie target: ${profile.daily_calorie_target} kcal
- Timeline: ${profile.timeline_weeks} weeks
- Lifestyle: ${profile.lifestyle}
- Cooking ability: ${profile.cooking_ability}
- Budget: ${profile.budget}
- Food preferences/restrictions: ${(profile.food_preferences ?? []).join(", ") || "none"}
- ${fastingNote}
- Workout location: ${profile.workout_location}
- Workout days this week: ${workoutDays} days (days ${[...workoutDayIndices].map(i => i + 1).join(", ")} of the week)
- Active period: ${profile.active_period}
- Medical notes: ${profile.medical_notes || "none"}
${ragCtx}

Rules:
1. Stay within the daily calorie target. Every meal must have an accurate calorie count.
2. Use REAL Nigerian food — meals must be practical for their cooking ability and budget.
3. If cooking_ability is "cant_cook" or "rarely", suggest street food, canteen food, or very simple no-cook options.
4. Workouts must match their location (home/gym/outdoor). Include specific exercises, sets, reps, and estimated duration.
5. If it is a rest day, say so — no workout needed.
6. The plan must fit around their active period and fasting window.`;

  const userPrompt = `Generate the weekly plan for the week starting ${weekStart} (${dates.join(", ")}).

Return ONLY valid JSON in this exact structure:
{
  "weekStart": "${weekStart}",
  "dailyCalorieTarget": ${profile.daily_calorie_target},
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "Monday",
      "fastingWindow": {"start": "HH:MM", "end": "HH:MM"} or null,
      "meals": [
        {
          "id": "breakfast",
          "slot": "Breakfast",
          "time": "HH:MM",
          "name": "Meal name",
          "description": "Brief description of portions",
          "calories": 350,
          "protein_g": 15,
          "carbs_g": 45,
          "fat_g": 8
        }
      ],
      "totalCalories": 1750,
      "workout": {
        "isRestDay": false,
        "name": "Upper body strength",
        "duration_mins": 35,
        "exercises": [
          {"name": "Push-ups", "sets": 3, "reps": "12-15", "rest_secs": 60},
          {"name": "Plank", "sets": 3, "reps": "30 seconds", "rest_secs": 30}
        ],
        "notes": "Focus on controlled movement"
      } or {"isRestDay": true, "name": "Rest Day", "duration_mins": 0, "exercises": [], "notes": "Active recovery — gentle walk is fine"}
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    max_tokens: 4000,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let plan: unknown;
  try { plan = JSON.parse(raw); } catch { res.status(500).json({ error: "Plan generation failed" }); return; }

  await supabase.from("weightloss_plan").upsert({
    account_id: account.id,
    week_start: weekStart,
    plan,
    generated_at: new Date().toISOString(),
  }, { onConflict: "account_id,week_start" });

  res.json({ plan, weekStart });
});

// ── GET /api/patient-app/weightloss/plan ─────────────────────────────────────
router.get("/api/patient-app/weightloss/plan", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const weekStart = (req.query.weekStart as string | undefined) ?? getMonday();
  const { data } = await supabase
    .from("weightloss_plan")
    .select("plan, generated_at")
    .eq("account_id", account.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  res.json({ plan: data?.plan ?? null, generatedAt: data?.generated_at ?? null, weekStart });
});

// ── GET /api/patient-app/weightloss/today ────────────────────────────────────
router.get("/api/patient-app/weightloss/today", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = todayStr();
  const weekStart = getMonday();

  const [profileRes, planRes, logRes, pendingAdjRes] = await Promise.all([
    getProfile(account.id),
    supabase.from("weightloss_plan").select("plan").eq("account_id", account.id).eq("week_start", weekStart).maybeSingle(),
    supabase.from("weightloss_logs").select("*").eq("account_id", account.id).eq("log_date", today).maybeSingle(),
    supabase.from("weightloss_adjustments").select("*")
      .eq("account_id", account.id).eq("applied", false).lte("applies_date", today).order("applies_date"),
  ]);

  const profile = profileRes;
  const plan = planRes.data?.plan as Record<string, unknown> | null;
  const log = logRes.data;
  const pendingAdjustments = pendingAdjRes.data ?? [];

  // Find today's day plan
  const days = (plan as { days?: Array<Record<string, unknown>> } | null)?.days ?? [];
  const todayPlan = days.find((d) => d.date === today) ?? null;

  // Calculate effective calorie target (apply any pending calorie adjustments)
  let effectiveCalorieTarget = profile?.daily_calorie_target ?? 1800;
  for (const adj of pendingAdjustments) {
    effectiveCalorieTarget += (adj as { calorie_adjustment: number }).calorie_adjustment;
  }
  effectiveCalorieTarget = Math.max(1200, effectiveCalorieTarget);

  const caloriesConsumed = (log as { total_calories_consumed?: number } | null)?.total_calories_consumed ?? 0;
  const caloriesRemaining = effectiveCalorieTarget - caloriesConsumed;

  res.json({
    today,
    todayPlan,
    log: log ?? null,
    profile: profile ? {
      dailyCalorieTarget: effectiveCalorieTarget,
      goalWeightKg: profile.goal_weight_kg,
      currentWeightKg: profile.current_weight_kg,
      fastingWindow: profile.fasting_interested ? { start: profile.fasting_start, end: profile.fasting_end } : null,
      coinsAvailable: profile.total_coins_earned,
      cheatDaysAvailable: profile.cheat_days_available,
    } : null,
    caloriesConsumed,
    caloriesRemaining,
    pendingAdjustments,
  });
});

// ── POST /api/patient-app/weightloss/log-meal ────────────────────────────────
router.post("/api/patient-app/weightloss/log-meal", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, calories, time, plannedMealId } = req.body as {
    name: string; calories: number; time?: string; plannedMealId?: string;
  };
  const today = todayStr();

  // Upsert the log row
  const { data: existing } = await supabase
    .from("weightloss_logs").select("*").eq("account_id", account.id).eq("log_date", today).maybeSingle();

  const currentMeals = (existing as { meals_logged?: unknown[] } | null)?.meals_logged ?? [];
  const newMeal = { id: `meal_${Date.now()}`, name, calories, time: time ?? new Date().toTimeString().slice(0, 5), planned_meal_id: plannedMealId ?? null, logged_at: new Date().toISOString() };
  const updatedMeals = [...(currentMeals as unknown[]), newMeal];
  const totalCalories = updatedMeals.reduce((sum: number, m) => sum + ((m as { calories: number }).calories), 0);

  await supabase.from("weightloss_logs").upsert({
    account_id: account.id,
    log_date: today,
    meals_logged: updatedMeals,
    total_calories_consumed: totalCalories,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,log_date" });

  const profile = await getProfile(account.id);
  const target = profile?.daily_calorie_target ?? 1800;

  res.json({ ok: true, meal: newMeal, totalCalories: totalCalories as number, caloriesRemaining: target - (totalCalories as number) });
});

// ── POST /api/patient-app/weightloss/complete-workout ────────────────────────
router.post("/api/patient-app/weightloss/complete-workout", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { exerciseId, workoutId } = req.body as { exerciseId?: string; workoutId?: string };
  const today = todayStr();

  const { data: existing } = await supabase
    .from("weightloss_logs").select("*").eq("account_id", account.id).eq("log_date", today).maybeSingle();

  const current = (existing as { workouts_completed?: unknown[] } | null)?.workouts_completed ?? [];
  const entry = { workout_id: workoutId ?? "today", exercise_id: exerciseId ?? "all", completed: true, completed_at: new Date().toISOString() };

  await supabase.from("weightloss_logs").upsert({
    account_id: account.id,
    log_date: today,
    workouts_completed: [...(current as unknown[]), entry],
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,log_date" });

  res.json({ ok: true });
});

// ── POST /api/patient-app/weightloss/log-weight ──────────────────────────────
router.post("/api/patient-app/weightloss/log-weight", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { weightKg } = req.body as { weightKg: number };
  const today = todayStr();

  await supabase.from("weightloss_logs").upsert({
    account_id: account.id,
    log_date: today,
    weight_kg: weightKg,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,log_date" });

  // Update profile current weight
  await supabase.from("weightloss_profile").update({
    current_weight_kg: weightKg,
    updated_at: new Date().toISOString(),
  }).eq("account_id", account.id);

  res.json({ ok: true });
});

// ── POST /api/patient-app/weightloss/calculate-calories ──────────────────────
// Meal calorie calculator — user types what they want to eat, gets calories back
router.post("/api/patient-app/weightloss/calculate-calories", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { description } = req.body as { description: string };

  const ragCtx = await buildRagContext(`calories in ${description} Nigerian food`, "nutrition");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a Nigerian food nutritionist. You know the exact calorie content of all Nigerian foods — jollof rice, eba, egusi, suya, bole, moi moi, akara, etc. You also know regular international foods.
${ragCtx}

When given a food description, return ONLY valid JSON:
{"items": [{"name": "food item", "portion": "estimated portion", "calories": 350, "protein_g": 12, "carbs_g": 45, "fat_g": 8}], "totalCalories": 350, "advice": "One sentence on whether this fits a weight loss plan"}`,
      },
      { role: "user", content: description },
    ],
    max_tokens: 500,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.json({ items: [], totalCalories: 0, advice: "Could not calculate calories for that description." });
  }
});

// ── POST /api/patient-app/weightloss/coach-chat ──────────────────────────────
router.post("/api/patient-app/weightloss/coach-chat", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const profile = await getProfile(account.id);
  const accountInfo = await getAccountInfo(account.id);
  const name = accountInfo?.display_name || accountInfo?.username || "friend";

  // Get pending adjustments so coach knows what punishments/rewards are queued
  const { data: adjustments } = await supabase
    .from("weightloss_adjustments").select("*")
    .eq("account_id", account.id).eq("applied", false)
    .order("applies_date").limit(5);

  const pendingAdj = (adjustments ?? []) as Array<{ type: string; description: string; applies_date: string }>;
  const adjContext = pendingAdj.length > 0
    ? `\nPending adjustments for ${name}:\n${pendingAdj.map(a => `- [${a.type.toUpperCase()}] ${a.description} (applies ${a.applies_date})`).join("\n")}`
    : "";

  const ragCtx = await buildRagContext(message, "weightloss");

  const systemPrompt = `You are ${name}'s strict but caring Nigerian weight loss coach. You are results-focused, no-nonsense, but genuinely invested in their success.

${name}'s stats:
- Current: ${profile?.current_weight_kg ?? "?"}kg → Goal: ${profile?.goal_weight_kg ?? "?"}kg
- Daily calorie target: ${profile?.daily_calorie_target ?? "?"}kcal
- Timeline: ${profile?.timeline_weeks ?? "?"} weeks
- Lifestyle: ${profile?.lifestyle ?? "unknown"}
- Coins earned: ${profile?.total_coins_earned ?? 0}
- Cheat days available: ${profile?.cheat_days_available ?? 0}
${adjContext}
${ragCtx}

Your personality:
- Strict but warm — like a trainer who believes in you
- Call out excuses, but always redirect to action
- Celebrate wins loudly and specifically
- When giving punishments/rewards, state them CLEARLY: "Because you [reason], on [date] I will [consequence]"
- You know Nigerian food, culture, and lifestyle deeply
- Never lecture more than needed — keep responses focused and actionable
- Use their name occasionally`;

  const msgs = [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? []).slice(-10),
    { role: "user" as const, content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: msgs,
    max_tokens: 600,
    temperature: 0.85,
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";

  // Parse if coach issued a punishment or reward and store it
  void storeParsedAdjustments(account.id, reply, name);

  res.json({ reply });
});

// ── Background: detect and store punishments/rewards from coach reply ─────────
async function storeParsedAdjustments(accountId: number, coachReply: string, name: string): Promise<void> {
  try {
    const today = todayStr();
    const detection = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You extract punishment and reward announcements from a weight loss coach message.
Return JSON: {"adjustments": [{"type": "punishment"|"reward", "reason": "...", "description": "...", "applies_date": "YYYY-MM-DD", "calorie_adjustment": 0, "workout_mins_extra": 0, "coins_earned": 0, "cheat_day_granted": false}]}
Today is ${today}. If no adjustment mentioned, return {"adjustments": []}.`,
        },
        { role: "user", content: coachReply },
      ],
      max_tokens: 400,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const raw = detection.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { adjustments: Array<Record<string, unknown>> };
    if (!parsed.adjustments?.length) return;

    for (const adj of parsed.adjustments) {
      await supabase.from("weightloss_adjustments").insert({
        account_id: accountId,
        type: adj.type,
        reason: adj.reason,
        description: adj.description,
        announced_date: today,
        applies_date: adj.applies_date ?? today,
        calorie_adjustment: adj.calorie_adjustment ?? 0,
        workout_mins_extra: adj.workout_mins_extra ?? 0,
        coins_earned: adj.coins_earned ?? 0,
        cheat_day_granted: adj.cheat_day_granted ?? false,
      });

      // If reward includes coins, update profile
      if ((adj.coins_earned as number) > 0) {
        await supabase.from("weightloss_profile").update({
          total_coins_earned: supabase.rpc("increment_coins", { p_account_id: accountId, p_amount: adj.coins_earned }),
        }).eq("account_id", accountId);
        await awardCoins(accountId, adj.coins_earned as number);
      }
      if (adj.cheat_day_granted) {
        await supabase.rpc("increment", {
          table: "weightloss_profile",
          column: "cheat_days_available",
          value: 1,
          condition_column: "account_id",
          condition_value: accountId,
        }).then(() => null).catch(() => null);
      }
    }
  } catch {
    // Best-effort only
  }
}

// ── GET /api/patient-app/weightloss/progress ─────────────────────────────────
router.get("/api/patient-app/weightloss/progress", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await getProfile(account.id);
  if (!profile) { res.json({ noProfile: true }); return; }

  // Last 30 days of logs
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const { data: logs } = await supabase
    .from("weightloss_logs").select("*")
    .eq("account_id", account.id)
    .gte("log_date", thirtyDaysAgo.toISOString().split("T")[0]!)
    .order("log_date");

  const { data: adjustments } = await supabase
    .from("weightloss_adjustments").select("*")
    .eq("account_id", account.id).order("created_at", { ascending: false }).limit(20);

  const typedLogs = (logs ?? []) as Array<{
    log_date: string; weight_kg: number | null;
    meal_adherence_pct: number | null; workout_adherence_pct: number | null;
    total_calories_consumed: number;
  }>;

  // Compute overall adherence
  const logsWithAdherence = typedLogs.filter(l => l.meal_adherence_pct !== null);
  const avgMealAdherence = logsWithAdherence.length
    ? Math.round(logsWithAdherence.reduce((s, l) => s + (l.meal_adherence_pct ?? 0), 0) / logsWithAdherence.length)
    : null;

  const logsWithWorkout = typedLogs.filter(l => l.workout_adherence_pct !== null);
  const avgWorkoutAdherence = logsWithWorkout.length
    ? Math.round(logsWithWorkout.reduce((s, l) => s + (l.workout_adherence_pct ?? 0), 0) / logsWithWorkout.length)
    : null;

  // Weight trend
  const weightEntries = typedLogs.filter(l => l.weight_kg !== null).map(l => ({ date: l.log_date, weight: l.weight_kg! }));

  const kgLost = weightEntries.length >= 2
    ? Math.round((weightEntries[0]!.weight - weightEntries[weightEntries.length - 1]!.weight) * 10) / 10
    : null;

  res.json({
    profile: {
      currentWeightKg: profile.current_weight_kg,
      goalWeightKg: profile.goal_weight_kg,
      dailyCalorieTarget: profile.daily_calorie_target,
      timelineWeeks: profile.timeline_weeks,
      totalCoinsEarned: profile.total_coins_earned,
      cheatDaysAvailable: profile.cheat_days_available,
    },
    avgMealAdherence,
    avgWorkoutAdherence,
    weightEntries,
    kgLost,
    recentAdjustments: adjustments ?? [],
    logsCount: typedLogs.length,
  });
});

// ── GET /api/patient-app/weightloss/adjustments ──────────────────────────────
router.get("/api/patient-app/weightloss/adjustments", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("weightloss_adjustments").select("*")
    .eq("account_id", account.id).eq("applied", false)
    .order("applies_date").limit(10);

  res.json({ adjustments: data ?? [] });
});

export default router;
