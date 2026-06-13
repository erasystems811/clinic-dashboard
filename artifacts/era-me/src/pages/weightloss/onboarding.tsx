import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useWLOnboard, useWLGeneratePlan } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { cn } from "@/lib/utils";

const ACTIVITY_LEVELS = [
  { id: "sedentary",    label: "Sedentary",        sub: "Little or no exercise" },
  { id: "light",        label: "Light",             sub: "1–3 days/week" },
  { id: "moderate",     label: "Moderate",          sub: "3–5 days/week" },
  { id: "active",       label: "Active",            sub: "6–7 days/week" },
  { id: "very_active",  label: "Very Active",       sub: "Hard exercise, physical job" },
];

const WORKOUT_STYLES = [
  { id: "gym",        label: "Gym weights",   emoji: "🏋️" },
  { id: "cardio",     label: "Cardio runs",   emoji: "🏃" },
  { id: "home",       label: "Home workouts", emoji: "🏠" },
  { id: "yoga",       label: "Yoga / stretch",emoji: "🧘" },
  { id: "walking",    label: "Walking",       emoji: "🚶" },
  { id: "mixed",      label: "Mixed",         emoji: "⚡" },
];

const MEAL_PREFS = [
  { id: "nigerian",   label: "Nigerian foods",  emoji: "🍲" },
  { id: "balanced",   label: "Balanced diet",   emoji: "🥗" },
  { id: "lowcarb",    label: "Low carb",        emoji: "🥩" },
  { id: "vegetarian", label: "Vegetarian",      emoji: "🥦" },
  { id: "highprotein",label: "High protein",    emoji: "💪" },
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
  mealPref: string;
  pace: string;
  fastingEnabled: boolean;
  fastingStart: string;
  fastingEnd: string;
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
    mealPref: "nigerian",
    pace: "moderate",
    fastingEnabled: false,
    fastingStart: "08:00",
    fastingEnd: "20:00",
  });

  const onboard = useWLOnboard();
  const generatePlan = useWLGeneratePlan();
  useWLTheme();

  function set(k: keyof FormData, v: string | boolean) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleFinish() {
    const payload = {
      currentWeightKg: parseFloat(form.currentWeightKg),
      goalWeightKg: parseFloat(form.goalWeightKg),
      heightCm: parseFloat(form.heightCm),
      age: parseInt(form.age, 10),
      gender: form.gender,
      activityLevel: form.activityLevel,
      workoutStyle: form.workoutStyle,
      mealPreferences: form.mealPref,
      weightLossPace: form.pace,
      fastingEnabled: form.fastingEnabled,
      fastingStart: form.fastingEnabled ? form.fastingStart : null,
      fastingEnd: form.fastingEnabled ? form.fastingEnd : null,
    };
    await onboard.mutateAsync(payload);
    await generatePlan.mutateAsync(undefined);
    onDone();
  }

  const steps = [
    <StepBody key={0}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Your body stats</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>We'll calculate your exact calorie targets based on your body.</p>

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

    <StepBody key={1}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Activity & workout</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>Be honest — this directly affects your calorie target.</p>

      <Field label="Activity level">
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
    </StepBody>,

    <StepBody key={2}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Meal preferences</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>Your weekly meal plan will use foods you enjoy.</p>

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
              <span className="text-xs font-bold"
                style={{ color: form.mealPref === m.id ? "var(--accent)" : "var(--text-main)" }}>
                {m.label}
              </span>
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

    <StepBody key={3}>
      <h2 className="text-2xl font-black mb-1" style={{ color: "var(--text-main)" }}>Your pace</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>How aggressively do you want to lose weight?</p>

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

      {parseFloat(form.currentWeightKg) > 0 && parseFloat(form.goalWeightKg) > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(var(--glow-rgb),0.07)", border: "1px solid rgba(var(--glow-rgb),0.19)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>Your estimate</p>
          {(() => {
            const diff = parseFloat(form.currentWeightKg) - parseFloat(form.goalWeightKg);
            const pace = PACES.find((p) => p.id === form.pace) ?? PACES[1];
            const weeks = Math.ceil((diff * 7700) / (pace.deficit * 7));
            return diff > 0 ? (
              <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                Lose {diff.toFixed(1)} kg in ~{weeks} weeks at {pace.sub.split("—")[0].trim()}
              </p>
            ) : null;
          })()}
        </div>
      )}
    </StepBody>,
  ];

  const step0Valid = form.currentWeightKg && form.goalWeightKg && form.heightCm && form.age && form.gender;
  const isValid = [step0Valid, true, true, true][step];

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
            ? "Setting up your plan…"
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
