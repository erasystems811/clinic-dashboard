import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

const GOALS = [
  { id: "stay_hydrated", emoji: "💧", label: "Stay hydrated",     accent: "#38bdf8" },
  { id: "sleep_better",  emoji: "😴", label: "Sleep better",      accent: "#a78bfa" },
  { id: "exercise_more", emoji: "🏃", label: "Exercise regularly", accent: "#fb923c" },
  { id: "eat_healthier", emoji: "🍎", label: "Eat more fruit",     accent: "#4ade80" },
  { id: "manage_meds",   emoji: "💊", label: "Manage medications", accent: "#2dd4bf" },
  { id: "reduce_stress", emoji: "🧘", label: "Reduce stress",      accent: "#c084fc" },
];

const GENDERS = [
  { value: "Male",              label: "Male" },
  { value: "Female",            label: "Female" },
  { value: "Other",             label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const COLOUR_THEMES = [
  { id: "teal",   label: "Teal",   emoji: "🩵", accent: "#14b8a6", bg: "linear-gradient(135deg,#0d9488,#14b8a6)",     dark: "#060d1f" },
  { id: "blue",   label: "Blue",   emoji: "💙", accent: "#3b82f6", bg: "linear-gradient(135deg,#1d4ed8,#3b82f6)",     dark: "#060e21" },
  { id: "purple", label: "Purple", emoji: "💜", accent: "#a78bfa", bg: "linear-gradient(135deg,#7c3aed,#a78bfa)",     dark: "#0d0618" },
  { id: "green",  label: "Green",  emoji: "💚", accent: "#22c55e", bg: "linear-gradient(135deg,#15803d,#22c55e)",     dark: "#031209" },
  { id: "orange", label: "Sunset", emoji: "🧡", accent: "#f97316", bg: "linear-gradient(135deg,#c2410c,#f97316)",     dark: "#160c03" },
  { id: "rose",   label: "Rose",   emoji: "🩷", accent: "#f43f5e", bg: "linear-gradient(135deg,#be123c,#f43f5e)",     dark: "#160308" },
  { id: "slate",  label: "Silver", emoji: "🩶", accent: "#94a3b8", bg: "linear-gradient(135deg,#475569,#94a3b8)",     dark: "#0a0d12" },
];

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const { updateAccount } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [themeColor, setThemeColor] = useState("teal");
  const [darkMode, setDarkMode] = useState(true);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [bedTime, setBedTime] = useState("23:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTheme = COLOUR_THEMES.find((t) => t.id === themeColor) ?? COLOUR_THEMES[0];

  function toggleGoal(id: string) {
    setGoals((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }

  function handleThemeSelect(id: string) {
    setThemeColor(id);
    // Live preview — apply theme immediately
    updateAccount({ themeColor: id, darkMode });
  }

  function handleDarkToggle(dark: boolean) {
    setDarkMode(dark);
    updateAccount({ themeColor, darkMode: dark });
  }

  async function finish() {
    setLoading(true); setError("");
    try {
      const res = await apiFetch<{ displayName: string; gender: string | null }>("/api/patient-app/onboard", {
        method: "POST", auth: true,
        body: JSON.stringify({
          displayName: displayName.trim(),
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          goals,
          themeColor,
          darkMode,
          wakeTime,
          bedTime,
        }),
      });
      updateAccount({ displayName: res.displayName, gender: res.gender ?? undefined, themeColor, darkMode });
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const pct = Math.round((step / 5) * 100);

  return (
    <div className="min-h-screen flex flex-col px-6 pt-10 pb-8 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)` }}>

      {/* Glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle,rgba(var(--glow-rgb),1) 0%,transparent 70%)`, filter: "blur(60px)" }} />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full opacity-12"
          style={{ background: `radial-gradient(circle,rgba(var(--glow-rgb),0.6) 0%,transparent 70%)`, filter: "blur(60px)" }} />
      </div>

      {/* Progress */}
      <div className="relative z-10 mb-8">
        <div className="flex justify-between text-xs font-medium mb-2">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Step {step} of 5</span>
          <span style={{ color: "var(--accent)" }}>{pct}%</span>
        </div>
        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "var(--btn-gradient)", boxShadow: `0 0 8px rgba(var(--glow-rgb),0.6)` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="relative z-10 flex-1 flex flex-col">

        {/* ── Step 1: Name ─────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-10">
              <p className="text-5xl mb-5">👋</p>
              <h1 className="text-3xl font-bold text-white mb-3">Welcome to ERA Health</h1>
              <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Let's personalise the app just for you. First — what should we call you?
              </p>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium block mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                Your name or nickname
              </label>
              <input type="text" autoFocus maxLength={40} value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Chidi"
                onKeyDown={(e) => { if (e.key === "Enter" && displayName.trim()) setStep(2); }}
                className="w-full px-4 py-4 rounded-2xl text-white text-lg font-medium outline-none transition"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", caretColor: "var(--accent)" }}
                onFocus={(e) => (e.target.style.borderColor = `rgba(var(--glow-rgb),0.5)`)}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>
            <NavBtn onClick={() => setStep(2)} disabled={!displayName.trim()}>
              Continue <ArrowRight className="w-5 h-5" />
            </NavBtn>
          </div>
        )}

        {/* ── Step 2: About you ─────────────────────────────── */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white mb-2">About you, {displayName}</h1>
              <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Your age and gender help us give you relevant guidance.
              </p>
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-sm font-semibold mb-1 text-white">
                  Date of birth <span className="text-xs font-normal" style={{ color: "var(--accent)" }}>required</span>
                </p>
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Your age shapes your wellness recommendations.
                </p>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3.5 rounded-2xl text-white outline-none transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", colorScheme: "dark" }}
                  onFocus={(e) => (e.target.style.borderColor = `rgba(var(--glow-rgb),0.5)`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>
              <div>
                <p className="text-sm font-semibold mb-3 text-white">
                  Gender <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>optional</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {GENDERS.map((g) => (
                    <button key={g.value} onClick={() => setGender(gender === g.value ? "" : g.value)}
                      className="py-3 px-4 rounded-2xl text-sm font-semibold transition active:scale-95"
                      style={{
                        background: gender === g.value ? `rgba(var(--glow-rgb),0.2)` : "rgba(255,255,255,0.05)",
                        border: gender === g.value ? `1.5px solid rgba(var(--glow-rgb),0.6)` : "1.5px solid rgba(255,255,255,0.08)",
                        color: gender === g.value ? "var(--accent)" : "rgba(255,255,255,0.55)",
                      }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <NavBtn onClick={() => setStep(3)} disabled={!dateOfBirth}>
              Continue <ArrowRight className="w-5 h-5" />
            </NavBtn>
          </div>
        )}

        {/* ── Step 3: Goals ─────────────────────────────────── */}
        {step === 3 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-5">
              <h1 className="text-3xl font-bold text-white mb-2">Your health goals</h1>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Pick what matters most — we'll activate the right modules to get you started.
              </p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 content-start mb-5">
              {GOALS.map((g) => {
                const on = goals.includes(g.id);
                return (
                  <button key={g.id} onClick={() => toggleGoal(g.id)}
                    className="relative p-4 rounded-2xl text-left transition active:scale-95 overflow-hidden"
                    style={{
                      background: on ? `${g.accent}15` : "rgba(255,255,255,0.04)",
                      border: on ? `1.5px solid ${g.accent}55` : "1.5px solid rgba(255,255,255,0.07)",
                      boxShadow: on ? `0 4px 16px ${g.accent}18` : "none",
                    }}>
                    {on && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: g.accent }}>
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                    <p className="text-2xl mb-2">{g.emoji}</p>
                    <p className="text-sm font-bold leading-tight"
                      style={{ color: on ? "#fff" : "rgba(255,255,255,0.55)" }}>
                      {g.label}
                    </p>
                  </button>
                );
              })}
            </div>
            <NavBtn onClick={() => setStep(4)}>
              {goals.length === 0 ? "Skip for now" : `Continue (${goals.length} selected)`} <ArrowRight className="w-5 h-5" />
            </NavBtn>
          </div>
        )}

        {/* ── Step 4: Choose your colour ────────────────────── */}
        {step === 4 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-5">
              <p className="text-4xl mb-4">🎨</p>
              <h1 className="text-3xl font-bold text-white mb-2">Pick your colour</h1>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                This transforms the entire look of your app — backgrounds, glows, everything. You can change it later in Profile.
              </p>
            </div>

            {/* Colour grid */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {COLOUR_THEMES.map((t) => {
                const selected = themeColor === t.id;
                return (
                  <button key={t.id} onClick={() => handleThemeSelect(t.id)}
                    className="flex flex-col items-center gap-2 active:scale-90 transition">
                    <div className="relative w-14 h-14 rounded-2xl"
                      style={{ background: t.bg, boxShadow: selected ? `0 0 16px ${t.accent}80` : "none",
                        border: selected ? `2.5px solid ${t.accent}` : "2px solid rgba(255,255,255,0.1)" }}>
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      {!selected && <span className="absolute inset-0 flex items-center justify-center text-xl">{t.emoji}</span>}
                    </div>
                    <span className="text-[11px] font-semibold"
                      style={{ color: selected ? "var(--accent)" : "rgba(255,255,255,0.5)" }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dark / Light toggle */}
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-sm font-semibold text-white mb-3">Brightness</p>
              <div className="grid grid-cols-2 gap-2">
                {([true, false] as const).map((dark) => (
                  <button key={String(dark)} onClick={() => handleDarkToggle(dark)}
                    className="py-3 rounded-xl text-sm font-bold transition active:scale-95"
                    style={{
                      background: darkMode === dark ? `rgba(var(--glow-rgb),0.2)` : "rgba(255,255,255,0.05)",
                      border: darkMode === dark ? `1.5px solid rgba(var(--glow-rgb),0.5)` : "1.5px solid rgba(255,255,255,0.08)",
                      color: darkMode === dark ? "var(--accent)" : "rgba(255,255,255,0.5)",
                    }}>
                    {dark ? "🌙 Dark" : "☀️ Light"}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview strip */}
            <div className="rounded-xl p-3 mb-3 flex items-center gap-3"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--accent-tint-border)" }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500, lineHeight: 1.4 }}>
                The whole app is now previewing your chosen colour — swipe between colours to see it live.
              </p>
            </div>

            <NavBtn onClick={() => setStep(5)}>
              Looks great! Continue <ArrowRight className="w-5 h-5" />
            </NavBtn>
          </div>
        )}

        {/* ── Step 5: Schedule + Finish ─────────────────────── */}
        {step === 5 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white mb-2">Your daily schedule</h1>
              <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                We use this for your sleep tracker and reminder timings.
              </p>
            </div>
            <div className="flex-1 space-y-4">
              <TimeCard emoji="🌅" label="I usually wake up at" value={wakeTime} onChange={setWakeTime} />
              <TimeCard emoji="🌙" label="I usually sleep at" value={bedTime} onChange={setBedTime} />

              <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <p className="text-sm font-bold mb-1" style={{ color: "var(--text-main)" }}>You're all set, {displayName}! 🎉</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
                  {goals.length > 0
                    ? `We'll activate ${goals.length} wellness module${goals.length > 1 ? "s" : ""} based on your goals.`
                    : "We'll start with the essentials — mood, energy & hydration."}
                  {" "}Head to Wellness any time to add more.
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                  {error}
                </div>
              )}
            </div>

            <button onClick={finish} disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 mt-6"
              style={{ background: "var(--btn-gradient)", boxShadow: `0 8px 32px rgba(var(--glow-rgb),0.35)` }}>
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Setting up your dashboard…</>
                : "Take me to my dashboard →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-40 mt-6"
      style={{ background: "var(--btn-gradient)", boxShadow: `0 8px 32px rgba(var(--glow-rgb),0.3)` }}>
      {children}
    </button>
  );
}

function TimeCard({ emoji, label, value, onChange }: { emoji: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{emoji} {label}</p>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-white font-bold text-xl outline-none transition"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", colorScheme: "dark" }}
        onFocus={(e) => (e.target.style.borderColor = `rgba(var(--glow-rgb),0.5)`)}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")} />
    </div>
  );
}
