import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useWLOnboard, useWLGeneratePlan } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { cn } from "@/lib/utils";

const ACTIVITY_LEVELS = [
  { id: "sedentary",   label: "Sedentary",   sub: "Mostly resting, no exercise" },
  { id: "light",       label: "Light",       sub: "1–2 days light exercise/week" },
  { id: "moderate",    label: "Moderate",    sub: "3–5 days moderate exercise/week" },
  { id: "active",      label: "Active",      sub: "6–7 days exercise/week" },
  { id: "very_active", label: "Very Active", sub: "Physical job or twice-daily training" },
];

const WORKOUT_STYLES = [
  { id: "gym",     label: "Gym weights",    emoji: "🏋️" },
  { id: "cardio",  label: "Cardio runs",    emoji: "🏃" },
  { id: "home",    label: "Home workouts",  emoji: "🏠" },
  { id: "yoga",    label: "Yoga / stretch", emoji: "🧘" },
  { id: "walking", label: "Walking",        emoji: "🚶" },
  { id: "mixed",   label: "Mixed",          emoji: "⚡" },
];

const WORKOUT_DAYS = [2, 3, 4, 5, 6];

const ACTIVE_PERIODS = [
  { id: "morning",   label: "Morning",   sub: "Before 10am" },
  { id: "afternoon", label: "Afternoon", sub: "12pm – 4pm" },
  { id: "evening",   label: "Evening",   sub: "5pm – 9pm" },
];

const MEAL_PREFS = [
  { id: "nigerian",    label: "Nigerian foods",  emoji: "🍲" },
  { id: "balanced",    label: "Balanced diet",   emoji: "🥗" },
  { id: "lowcarb",     label: "Low carb",        emoji: "🥩" },
  { id: "vegetarian",  label: "Vegetarian",      emoji: "🥦" },
  { id: "highprotein", label: "High protein",    emoji: "💪" },
  { id: "snacker",     label: "Snack-based",     emoji: "🍎" },
];

const COOKING_ABILITIES = [
  { id: "can_cook",  label: "I cook most meals",   sub: "Home cooking is my main option" },
  { id: "rarely",    label: "Mix of home & bought", sub: "I cook sometimes, buy sometimes" },
  { id: "cant_cook", label: "I mostly buy food",    sub: "Street food, canteen or takeaway" },
];

const BUDGETS = [
  { id: "tight",    label: "Tight",       sub: "₦500–₦1,000/day on food" },
  { id: "moderate", label: "Moderate",    sub: "₦1,000–₦3,000/day on food" },
  { id: "generous", label: "Comfortable", sub: "₦3,000+/day on food" },
];

const MEDICAL_CONDITIONS = [
  { id: "none",           label: "None — I'm healthy" },
  { id: "diabetes",       label: "Diabetes" },
  { id: "pcos",           label: "PCOS" },
  { id: "hypothyroidism", label: "Thyroid issue" },
  { id: "hypertension",   label: "High blood pressure" },
  { id: "pregnant",       label: "Pregnant / breastfeeding" },
  { id: "heart",          label: "Heart condition" },
];

const PACES = [
  { id: "gentle",   label: "Gentle",   sub: "0.25 kg/week — sustainable", deficit: 250 },
  { id: "moderate", label: "Moderate", sub: "0.5 kg/week — recommended",  deficit: 500 },
  { id: "fast",     label: "Fast",     sub: "0.75 kg/week — challenging", deficit: 750 },
  { id: "intense",  label: "Intense",  sub: "1 kg/week — very strict",    deficit: 1000 },
];

interface FormData {
  currentWeightKg: string;
  goalWeightKg: string;
  heightCm: string;
  age: string;
  gender: "male" | "female" | "";
  activityLevel: string;
  workoutStyle: string;
  workoutDaysPerWeek: number;
  activePeriod: string;
  mealPref: string;
  cookingAbility: string;
  budget: string;
  fastingEnabled: boolean;
  fastingStart: string;
  fastingEnd: string;
  medicalConditions: string[];
  foodDislikes: string;
  wakeTime: string;
  sleepTime: string;
  pace: string;
}

export default function WLOnboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    currentWeightKg: "",
    goalWeightKg: "",
    heightCm: "",
    age: "",
    gender: "",
    activityLevel: "moderate",
    workoutStyle: "mixed",
    workoutDaysPerWeek: 3,
    activePeriod: "morning",
    mealPref: "nigerian",
    cookingAbility: "can_cook",
    budget: "moderate",
    fastingEnabled: false,
    fastingStart: "08:00",
    fastingEnd: "20:00",
    medicalConditions: [],
    foodDislikes: "",
    wakeTime: "06:30",
    sleepTime: "22:30",
    pace: "moderate",
  });

  const onboard = useWLOnboard();
  const generatePlan = useWLGeneratePlan();
  useWLTheme();

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function toggleMedical(id: string) {
    if (id === "none") {
      set("medicalConditions", form.medicalConditions.includes("none") ? [] : ["none"]);
      return;
    }
    const without = form.medicalConditions.filter((c) => c !== "none");
    set("medicalConditions", without.includes(id) ? without.filter((c) => c !== id) : [...without, id]);
  }

  async function handleFinish() {
    const payload = {
      currentWeightKg:    parseFloat(form.currentWeightKg),
      goalWeightKg:       parseFloat(form.goalWeightKg),
      heightCm:           parseFloat(form.heightCm),
      age:                parseInt(form.age, 10),
      gender:             form.gender,
      activityLevel:      form.activityLevel,
      workoutStyle:       form.workoutStyle,
      workoutDaysPerWeek: form.workoutDaysPerWeek,
      activePeriod:       form.activePeriod,
      mealPreferences:    form.mealPref,
      cookingAbility:     form.cookingAbility,
      budget:             form.budget,
      fastingEnabled:     form.fastingEnabled,
      fastingStart:       form.fastingEnabled ? form.fastingStart : null,
      fastingEnd:         form.fastingEnabled ? form.fastingEnd : null,
      medicalConditions:  form.medicalConditions,
      foodDislikes:       form.foodDislikes.trim(),
      wakeTime:           form.wakeTime,
      sleepTime:          form.sleepTime,
      weightLossPace:     form.pace,
    };
    await onboard.mutateAsync(payload);
    await generatePlan.mutateAsync(undefined);
    onDone();
  }

  const isPregnant = form.medicalConditions.includes("pregnant");

  const steps = [
    /* ── Step 0: Body stats ────────────────────────────────────────── */
    <StepBody key={0}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Your body stats</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>We use this to calculate your exact daily calorie target.</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Current weight (kg)">
          <input type="number" step="0.1" placeholder="e.g. 85" value={form.currentWeightKg}
            onChange={(e) => set("currentWeightKg", e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
        </Field>
        <Field label="Goal weight (kg)">
          <input type="number" step="0.1" placeholder="e.g. 70" value={form.goalWeightKg}
            onChange={(e) => set("goalWeightKg", e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
        </Field>
        <Field label="Height (cm)">
          <input type="number" placeholder="e.g. 170" value={form.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
        </Field>
        <Field label="Age">
          <input type="number" placeholder="e.g. 28" value={form.age}
            onChange={(e) => set("age", e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
        </Field>
      </div>

      <Field label="Gender">
        <div className="grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((g) => (
            <button key={g} onClick={() => set("gender", g)}
              className="py-3 rounded-xl font-bold text-sm transition active:scale-95 capitalize"
              style={{
                background: form.gender === g ? "var(--accent)" : "var(--glass-bg)",
                border: `1.5px solid ${form.gender === g ? "var(--accent)" : "var(--glass-border)"}`,
                color: form.gender === g ? "#fff" : "var(--text-sub)",
              }}>
              {g === "male" ? "👨 Male" : "👩 Female"}
            </button>
          ))}
        </div>
      </Field>
    </StepBody>,

    /* ── Step 1: Activity & workout ────────────────────────────────── */
    <StepBody key={1}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Activity & workout</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>Be honest — this directly sets your calorie target.</p>

      <Field label="Overall activity level">
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map((a) => (
            <button key={a.id} onClick={() => set("activityLevel", a.id)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition active:scale-[0.98]"
              style={{
                background: form.activityLevel === a.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                border: `1.5px solid ${form.activityLevel === a.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: form.activityLevel === a.id ? "var(--accent)" : "var(--text-main)" }}>{a.label}</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>{a.sub}</p>
              </div>
              {form.activityLevel === a.id && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Preferred workout style">
        <div className="grid grid-cols-3 gap-2">
          {WORKOUT_STYLES.map((w) => (
            <button key={w.id} onClick={() => set("workoutStyle", w.id)}
              className="flex flex-col items-center gap-1 py-3 rounded-xl transition active:scale-90"
              style={{
                background: form.workoutStyle === w.id ? "rgba(var(--glow-rgb),0.12)" : "var(--glass-bg)",
                border: `1.5px solid ${form.workoutStyle === w.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <span style={{ fontSize: 22 }}>{w.emoji}</span>
              <span className="text-[10px] font-semibold text-center leading-tight"
                style={{ color: form.workoutStyle === w.id ? "var(--accent)" : "var(--text-sub)" }}>
                {w.label}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Workout days per week">
        <div className="flex gap-2">
          {WORKOUT_DAYS.map((n) => (
            <button key={n} onClick={() => set("workoutDaysPerWeek", n)}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition active:scale-95"
              style={{
                background: form.workoutDaysPerWeek === n ? "var(--accent)" : "var(--glass-bg)",
                border: `1.5px solid ${form.workoutDaysPerWeek === n ? "var(--accent)" : "var(--glass-border)"}`,
                color: form.workoutDaysPerWeek === n ? "#fff" : "var(--text-sub)",
              }}>
              {n}×
            </button>
          ))}
        </div>
      </Field>

      <Field label="Best time to exercise">
        <div className="space-y-2">
          {ACTIVE_PERIODS.map((p) => (
            <button key={p.id} onClick={() => set("activePeriod", p.id)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition active:scale-[0.98]"
              style={{
                background: form.activePeriod === p.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                border: `1.5px solid ${form.activePeriod === p.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: form.activePeriod === p.id ? "var(--accent)" : "var(--text-main)" }}>{p.label}</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>{p.sub}</p>
              </div>
              {form.activePeriod === p.id && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      </Field>
    </StepBody>,

    /* ── Step 2: Food & cooking ─────────────────────────────────────── */
    <StepBody key={2}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Food & cooking</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>Your meal plan will match your real life — not just theory.</p>

      <Field label="Food style">
        <div className="grid grid-cols-2 gap-2">
          {MEAL_PREFS.map((m) => (
            <button key={m.id} onClick={() => set("mealPref", m.id)}
              className="flex items-center gap-2 rounded-xl px-3 py-3 transition active:scale-95"
              style={{
                background: form.mealPref === m.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                border: `1.5px solid ${form.mealPref === m.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <span style={{ fontSize: 20 }}>{m.emoji}</span>
              <span className="text-xs font-bold" style={{ color: form.mealPref === m.id ? "var(--accent)" : "var(--text-main)" }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Cooking ability">
        <div className="space-y-2">
          {COOKING_ABILITIES.map((c) => (
            <button key={c.id} onClick={() => set("cookingAbility", c.id)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition active:scale-[0.98]"
              style={{
                background: form.cookingAbility === c.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                border: `1.5px solid ${form.cookingAbility === c.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: form.cookingAbility === c.id ? "var(--accent)" : "var(--text-main)" }}>{c.label}</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>{c.sub}</p>
              </div>
              {form.cookingAbility === c.id && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Daily food budget">
        <div className="grid grid-cols-3 gap-2">
          {BUDGETS.map((b) => (
            <button key={b.id} onClick={() => set("budget", b.id)}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition active:scale-95"
              style={{
                background: form.budget === b.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                border: `1.5px solid ${form.budget === b.id ? "var(--accent)" : "var(--glass-border)"}`,
              }}>
              <span className="text-sm font-bold" style={{ color: form.budget === b.id ? "var(--accent)" : "var(--text-main)" }}>{b.label}</span>
              <span className="text-[10px] text-center leading-tight" style={{ color: "var(--text-dim)" }}>{b.sub}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Intermittent fasting?">
        <div className="rounded-xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Enable fasting window</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Coach will plan meals within your eating window</p>
            </div>
            <button onClick={() => set("fastingEnabled", !form.fastingEnabled)}
              className="w-12 h-6 rounded-full transition relative shrink-0"
              style={{ background: form.fastingEnabled ? "var(--accent)" : "var(--glass-border)" }}>
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                form.fastingEnabled ? "left-6" : "left-0.5")} />
            </button>
          </div>
          {form.fastingEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>EAT FROM</p>
                <input type="time" value={form.fastingStart} onChange={(e) => set("fastingStart", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-bold outline-none"
                  style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>STOP AT</p>
                <input type="time" value={form.fastingEnd} onChange={(e) => set("fastingEnd", e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-bold outline-none"
                  style={{ background: "var(--bg-base)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
              </div>
            </div>
          )}
        </div>
      </Field>
    </StepBody>,

    /* ── Step 3: Lifestyle & health ─────────────────────────────────── */
    <StepBody key={3}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Lifestyle & health</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>This helps us create a plan that is safe and realistic for your life.</p>

      <Field label="Wake up & sleep times">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>I WAKE UP AT</p>
            <input type="time" value={form.wakeTime} onChange={(e) => set("wakeTime", e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "var(--glass-bg)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-dim)" }}>I SLEEP AT</p>
            <input type="time" value={form.sleepTime} onChange={(e) => set("sleepTime", e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none"
              style={{ background: "var(--glass-bg)", color: "var(--text-main)", border: "1px solid var(--glass-border)" }} />
          </div>
        </div>
      </Field>

      <Field label="Foods you dislike or can't eat">
        <input
          type="text"
          value={form.foodDislikes}
          onChange={(e) => set("foodDislikes", e.target.value)}
          placeholder="e.g. fish, bitter leaf, liver, milk…"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}
        />
        <p className="text-xs mt-1.5" style={{ color: "var(--text-dim)" }}>Leave blank if none. These foods will never appear in your plan.</p>
      </Field>

      <Field label="Any health conditions? (select all that apply)">
        <div className="grid grid-cols-2 gap-2">
          {MEDICAL_CONDITIONS.map((c) => {
            const selected = form.medicalConditions.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggleMedical(c.id)}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-left transition active:scale-95"
                style={{
                  background: selected ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
                  border: `1.5px solid ${selected ? "var(--accent)" : "var(--glass-border)"}`,
                }}>
                <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                  selected ? "border-transparent" : "border-muted-foreground")}
                  style={{ background: selected ? "var(--accent)" : "transparent" }}>
                  {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs font-semibold"
                  style={{ color: selected ? "var(--accent)" : "var(--text-main)" }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
        {isPregnant && (
          <div className="mt-3 rounded-xl p-3 flex gap-2"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <p className="text-xs font-medium" style={{ color: "#fbbf24" }}>
              Your plan will be adjusted to be safe during pregnancy — no calorie deficit, focus on nourishment.
            </p>
          </div>
        )}
      </Field>
    </StepBody>,

    /* ── Step 4: Your pace ──────────────────────────────────────────── */
    <StepBody key={4}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Your pace</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>How aggressively do you want to lose weight?</p>

      {isPregnant && (
        <div className="rounded-xl p-4 mb-4 flex gap-2"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p className="text-xs font-medium" style={{ color: "#fbbf24" }}>
            Because you selected pregnant/breastfeeding, your plan will use a gentle, maintenance-focused approach regardless of the pace chosen below.
          </p>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {PACES.map((p) => (
          <button key={p.id} onClick={() => set("pace", p.id)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-4 transition active:scale-[0.98]"
            style={{
              background: form.pace === p.id ? "rgba(var(--glow-rgb),0.09)" : "var(--glass-bg)",
              border: `2px solid ${form.pace === p.id ? "var(--accent)" : "var(--glass-border)"}`,
            }}>
            <div className="text-left">
              <p className="font-bold text-sm" style={{ color: form.pace === p.id ? "var(--accent)" : "var(--text-main)" }}>{p.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{p.sub}</p>
            </div>
            {form.pace === p.id && <Check className="w-5 h-5 shrink-0" style={{ color: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {parseFloat(form.currentWeightKg) > 0 && parseFloat(form.goalWeightKg) > 0 && !isPregnant && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(var(--glow-rgb),0.07)", border: "1px solid rgba(var(--glow-rgb),0.19)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>Your estimate</p>
          {(() => {
            const diff = parseFloat(form.currentWeightKg) - parseFloat(form.goalWeightKg);
            const pace = PACES.find((p) => p.id === form.pace) ?? PACES[1];
            const weeks = Math.ceil((diff * 7700) / (pace!.deficit * 7));
            return diff > 0 ? (
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                Lose {diff.toFixed(1)} kg in ~{weeks} weeks at {pace!.sub.split("—")[0]!.trim()}
              </p>
            ) : null;
          })()}
        </div>
      )}
    </StepBody>,
  ];

  const step0Valid = form.currentWeightKg && form.goalWeightKg && form.heightCm && form.age && form.gender;
  const isValid = [step0Valid, true, true, true, true][step];

  return (
    <div className="min-h-screen px-5 pt-6 pb-8" style={{ background: "var(--bg-base)" }}>
      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= step ? "var(--accent)" : "var(--glass-border)" }} />
        ))}
      </div>

      {steps[step]}

      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 px-5 py-4 rounded-2xl font-semibold text-sm transition active:scale-95"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <button
          onClick={step === steps.length - 1 ? () => void handleFinish() : () => setStep((s) => s + 1)}
          disabled={!isValid || onboard.isPending || generatePlan.isPending}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {onboard.isPending || generatePlan.isPending
            ? "Building your plan…"
            : step === steps.length - 1
              ? "Build my plan"
              : <><span>Next</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

function StepBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>{label}</p>
      {children}
    </div>
  );
}
