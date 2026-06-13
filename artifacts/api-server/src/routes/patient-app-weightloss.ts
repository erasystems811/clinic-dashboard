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
  return gender.toLowerCase() === "female" ? Math.round(base - 161) : Math.round(base + 5);
}

function activityFactor(level: string): number {
  if (level === "very_active" || level === "working_physical") return 1.725;
  if (level === "active")   return 1.55;
  if (level === "moderate" || level === "student" || level === "working_office") return 1.375;
  return 1.2; // sedentary / stay_home / light
}

// Map frontend simplified fields to DB column equivalents
function mapWorkoutStyle(style: string): string {
  const styles = style.split(",").map((s) => s.trim());
  if (styles.includes("gym")) return "gym";
  if (styles.includes("home")) return "home";
  if (styles.some((s) => s === "walking" || s === "cardio" || s === "yoga")) return "outdoor";
  return "any";
}

function buildFoodPrefs(pref: string, conditions: string[]): string[] {
  const selected = pref.split(",").map((s) => s.trim()).filter(Boolean);
  const prefs: string[] = [...selected];
  if (conditions.includes("diabetes"))     prefs.push("low_sugar", "low_gi");
  if (conditions.includes("hypertension")) prefs.push("low_sodium");
  if (selected.includes("mostly_veg"))     prefs.push("no_meat");
  if (selected.includes("mostly_protein")) prefs.push("highprotein", "lowcarb");
  if (selected.includes("snacker"))        prefs.push("snack_based", "frequent_small_meals");
  return [...new Set(prefs)];
}

function buildMedicalNotes(conditions: string[], foodDislikes: string): string | null {
  const parts: string[] = [];
  const conditionLabels: Record<string, string> = {
    diabetes: "Diabetes", pcos: "PCOS", hypothyroidism: "Thyroid issue",
    hypertension: "High blood pressure", pregnant: "Pregnant or breastfeeding",
    heart: "Heart condition",
  };
  const active = conditions.filter((c) => c !== "none");
  if (active.length > 0) parts.push("Health conditions: " + active.map((c) => conditionLabels[c] ?? c).join(", "));
  if (foodDislikes.trim()) parts.push("Dislikes/allergies: " + foodDislikes.trim());
  return parts.length > 0 ? parts.join(". ") : null;
}

const PACE_DEFICIT: Record<string, number> = {
  gentle: 250, moderate: 500, fast: 750, intense: 1000,
};

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
  const { data: p } = await supabase
    .from("weightloss_profile").select("total_coins_earned").eq("account_id", accountId).single();
  await supabase.from("weightloss_profile")
    .update({ total_coins_earned: ((p as { total_coins_earned: number } | null)?.total_coins_earned ?? 0) + amount })
    .eq("account_id", accountId);
}

async function awardCheatDay(accountId: number) {
  const { data: p } = await supabase
    .from("weightloss_profile").select("cheat_days_available").eq("account_id", accountId).single();
  await supabase.from("weightloss_profile")
    .update({ cheat_days_available: ((p as { cheat_days_available: number } | null)?.cheat_days_available ?? 0) + 1 })
    .eq("account_id", accountId);
}

// ── GET /api/patient-app/weightloss/profile ───────────────────────────────────
router.get("/patient-app/weightloss/profile", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await getProfile(account.id);
  res.json({ profile, hasProfile: !!profile, onboardingComplete: profile?.onboarding_complete ?? false });
});

// ── POST /api/patient-app/weightloss/onboard ─────────────────────────────────
router.post("/patient-app/weightloss/onboard", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    currentWeightKg, goalWeightKg, heightCm,
    age: ageInput, gender: genderInput,
    activityLevel, workoutStyle, mealPreferences, weightLossPace,
    fastingEnabled, fastingStart, fastingEnd,
    // New fields
    cookingAbility, budget, workoutDaysPerWeek, activePeriod,
    medicalConditions, foodDislikes, wakeTime, sleepTime,
  } = req.body as {
    currentWeightKg: number; goalWeightKg: number; heightCm: number;
    age?: number; gender?: string;
    activityLevel?: string; workoutStyle?: string; mealPreferences?: string; weightLossPace?: string;
    fastingEnabled?: boolean; fastingStart?: string; fastingEnd?: string;
    cookingAbility?: string; budget?: string; workoutDaysPerWeek?: number; activePeriod?: string;
    medicalConditions?: string[]; foodDislikes?: string; wakeTime?: string; sleepTime?: string;
  };

  const accountInfo = await getAccountInfo(account.id);
  const age = ageInput ?? calcAge(accountInfo?.date_of_birth ?? null);
  const gender = genderInput ?? accountInfo?.gender ?? "male";

  const level = activityLevel ?? "moderate";
  const bmr = calcBMR(currentWeightKg, heightCm, age, gender);
  const tdee = Math.round(bmr * activityFactor(level));

  const conditions = medicalConditions ?? [];
  const isPregnant = conditions.includes("pregnant");

  const weightToLose = Math.max(0, currentWeightKg - goalWeightKg);
  // Pregnant/breastfeeding: no calorie deficit — maintenance only
  const rawDeficit = isPregnant ? 0 : (PACE_DEFICIT[weightLossPace ?? "moderate"] ?? 500);
  const timelineWeeks = (weightToLose > 0 && rawDeficit > 0)
    ? Math.ceil((weightToLose * 7700) / (rawDeficit * 7))
    : isPregnant ? 0 : 12;
  const weeklyLossTarget = rawDeficit * 7 / 7700;
  // Pregnant: never below TDEE; otherwise never below 1200 kcal
  const dailyCalorieTarget = isPregnant ? tdee : Math.max(1200, tdee - rawDeficit);

  const medicalNotes = buildMedicalNotes(conditions, foodDislikes ?? "");

  const { error } = await supabase.from("weightloss_profile").upsert({
    account_id: account.id,
    current_weight_kg: currentWeightKg,
    goal_weight_kg: goalWeightKg,
    height_cm: heightCm,
    timeline_weeks: timelineWeeks,
    lifestyle: level,
    cooking_ability: cookingAbility ?? "can_cook",
    budget: budget ?? "moderate",
    food_preferences: buildFoodPrefs(mealPreferences ?? "nigerian", conditions),
    wake_time: wakeTime ?? "07:00",
    sleep_time: sleepTime ?? "23:00",
    active_period: activePeriod ?? "morning",
    fasting_interested: fastingEnabled ?? false,
    fasting_start: (fastingEnabled && fastingStart) ? fastingStart : null,
    fasting_end: (fastingEnabled && fastingEnd) ? fastingEnd : null,
    workout_location: mapWorkoutStyle(workoutStyle ?? "mixed"),
    workout_days_per_week: workoutDaysPerWeek ?? 3,
    medical_notes: medicalNotes,
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
router.post("/patient-app/weightloss/generate-plan", async (req, res): Promise<void> => {
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

  const cookingDesc = profile.cooking_ability === "cant_cook"
    ? "cannot cook — must use street food, canteen, or bought meals only"
    : profile.cooking_ability === "rarely"
      ? "sometimes cooks, sometimes buys food — mix of home meals and street food"
      : "cooks most meals at home";

  const budgetDesc = profile.budget === "tight"
    ? "very tight (₦500–₦1,500/day on food)"
    : profile.budget === "generous"
      ? "comfortable (₦5,000–₦10,000/day on food)"
      : profile.budget === "premium"
        ? "high (₦10,000–₦15,000+/day — premium options are fine)"
        : "moderate (₦1,500–₦5,000/day on food)";

  const activePeriodDesc = profile.active_period === "afternoon" ? "afternoon (12pm–4pm)"
    : profile.active_period === "evening" ? "evening (5pm–9pm)"
    : "morning (before 10am)";

  const systemPrompt = `You are a strict but caring Nigerian weight loss coach. You know Nigerian food extremely well — jollof rice, eba, egusi soup, suya, bole, moi moi, akara, puff puff, ofada, fried plantain, pepper soup, ogbono soup, indomie, etc. You know their exact calorie counts.

You are creating a personalised 7-day weight loss meal and workout plan for ${name}.

PROFILE:
- Body: ${profile.current_weight_kg}kg → Goal: ${profile.goal_weight_kg}kg
- Daily calorie target: ${profile.daily_calorie_target} kcal (NEVER exceed this)
- Timeline: ${profile.timeline_weeks > 0 ? `${profile.timeline_weeks} weeks` : "maintenance (no deficit)"}
- Activity level: ${profile.lifestyle}
- Eating patterns committed to: ${(profile.food_preferences ?? []).join(", ") || "balanced"}
- ${fastingNote}
- Wake time: ${profile.wake_time} | Sleep time: ${profile.sleep_time}
- Workout: ${profile.workout_location} · ${workoutDays} days/week · preferred time: ${activePeriodDesc}
- Workout days this week: days ${[...workoutDayIndices].map(i => i + 1).join(", ")} of the week

COOKING & BUDGET:
- Cooking: ${cookingDesc}
- Budget: ${budgetDesc}

HEALTH & RESTRICTIONS:
- Medical notes: ${profile.medical_notes || "none"}

${ragCtx}

RULES:
1. NEVER exceed the daily calorie target. Every meal must have an accurate calorie count.
2. If medical_notes mentions DIABETES: avoid high-sugar foods, use low-GI carbs (oats, sweet potato, brown rice). No sugary drinks.
3. If medical_notes mentions PCOS: favour anti-inflammatory, low-GI foods. Minimise refined carbs and processed food.
4. If medical_notes mentions HYPERTENSION: keep sodium low. Avoid very salty street food. Suggest low-salt alternatives.
5. If medical_notes mentions THYROID issue: avoid raw cruciferous veg in large amounts; focus on iodine-rich foods.
6. If medical_notes mentions PREGNANT or BREASTFEEDING: NO calorie deficit. Focus on nutritious, balanced maintenance meals. No heavy workouts — suggest gentle walks or prenatal yoga only.
7. If medical_notes mentions HEART condition: avoid high saturated fat. Lean proteins, vegetables, fibre-rich meals.
8. If medical_notes lists dislikes/allergies, NEVER include those foods in any meal.
9. Cooking ability matters: if they "cannot cook" or "rarely cook", suggest street food, canteen, or bought meals — never recipes that require 30+ minutes of cooking.
10. Budget matters: tight budget → affordable staples (eba, beans, egg, market fish, indomie in moderation). Moderate → normal Nigerian meals with variety. Comfortable → grilled chicken, salmon, whole grains. Premium → any premium option is fine.
11. Eating patterns: honour what they said they can commit to. "mostly_carbs" → keep carbs but control portion size; "mostly_protein" → build meals around meat/fish/eggs, reduce carbs significantly; "mostly_veg" → vegetable-heavy plates, soups with minimal starchy base; "fruit_light" → include fruit as snacks, light meals; "snacker" → 5–6 small meals instead of 3 big ones; "balanced" → equal mix. If multiple patterns selected, blend them together.
12. Workouts must match their location (home/gym/outdoor). Include specific exercises, sets, reps, and estimated duration.
13. Schedule workouts in their preferred active period (${activePeriodDesc}).
14. The plan must fit around their wake/sleep and fasting window.
15. If it is a rest day, say so — gentle walk is always fine.
16. If eating patterns include "snacker" or "frequent_small_meals": replace the standard 3-meal structure with 5–6 small snack-sized meals spread across the day (100–300 kcal each). Examples: groundnuts, boiled egg, garden egg, small fruit, yoghurt, cucumber, ofio. Total must still stay within the daily calorie target.`;

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
router.get("/patient-app/weightloss/plan", async (req, res): Promise<void> => {
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
router.get("/patient-app/weightloss/today", async (req, res): Promise<void> => {
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
router.post("/patient-app/weightloss/log-meal", async (req, res): Promise<void> => {
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
router.post("/patient-app/weightloss/complete-workout", async (req, res): Promise<void> => {
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
router.post("/patient-app/weightloss/log-weight", async (req, res): Promise<void> => {
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
router.post("/patient-app/weightloss/calculate-calories", async (req, res): Promise<void> => {
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
router.post("/patient-app/weightloss/coach-chat", async (req, res): Promise<void> => {
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
- Budget: ${profile?.budget ?? "moderate"} | Cooking: ${profile?.cooking_ability ?? "can_cook"}
- Medical notes: ${profile?.medical_notes ?? "none"}
- Food preferences: ${(profile?.food_preferences ?? []).join(", ") || "none"}
- Coins earned: ${profile?.total_coins_earned ?? 0} | Cheat days available: ${profile?.cheat_days_available ?? 0}
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
        await awardCoins(accountId, adj.coins_earned as number);
      }
      if (adj.cheat_day_granted) {
        await awardCheatDay(accountId);
      }
    }
  } catch {
    // Best-effort only
  }
}

// ── GET /api/patient-app/weightloss/progress ─────────────────────────────────
router.get("/patient-app/weightloss/progress", async (req, res): Promise<void> => {
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
router.get("/patient-app/weightloss/adjustments", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("weightloss_adjustments").select("*")
    .eq("account_id", account.id).eq("applied", false)
    .order("applies_date").limit(10);

  res.json({ adjustments: data ?? [] });
});

export default router;
