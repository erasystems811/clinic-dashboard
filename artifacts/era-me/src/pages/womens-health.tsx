import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Baby, Heart } from "lucide-react";
import {
  useWomensHealthToday, useWomensCalendar, useWomensHistory,
  usePregnancyToday, usePregnancyTimeline,
  useSetupCycle, useSetupPregnancy, useSwitchMode,
  useLogCycle, useLogPregnancy,
  type Phase, type CalendarDay,
} from "@/lib/womens-health-api";

// ── Baby size data by week ────────────────────────────────────────────────────
const BABY_SIZES: Record<number, { name: string; emoji: string; size: string }> = {
  4:  { name: "Poppy seed",    emoji: "🌱", size: "0.1 cm" },
  5:  { name: "Sesame seed",   emoji: "🫘", size: "0.2 cm" },
  6:  { name: "Lentil",        emoji: "🫛", size: "0.6 cm" },
  7:  { name: "Blueberry",     emoji: "🫐", size: "1.3 cm" },
  8:  { name: "Kidney bean",   emoji: "🫘", size: "1.6 cm" },
  9:  { name: "Grape",         emoji: "🍇", size: "2.3 cm" },
  10: { name: "Kumquat",       emoji: "🍊", size: "3.1 cm" },
  11: { name: "Fig",           emoji: "🍑", size: "4.1 cm" },
  12: { name: "Lime",          emoji: "🍋", size: "5.4 cm" },
  13: { name: "Lemon",         emoji: "🍋", size: "7.4 cm" },
  14: { name: "Peach",         emoji: "🍑", size: "8.7 cm" },
  15: { name: "Apple",         emoji: "🍎", size: "10.1 cm" },
  16: { name: "Avocado",       emoji: "🥑", size: "11.6 cm" },
  17: { name: "Onion",         emoji: "🧅", size: "13 cm" },
  18: { name: "Bell pepper",   emoji: "🫑", size: "14.2 cm" },
  19: { name: "Tomato",        emoji: "🍅", size: "15.3 cm" },
  20: { name: "Banana",        emoji: "🍌", size: "25.6 cm" },
  21: { name: "Carrot",        emoji: "🥕", size: "26.7 cm" },
  22: { name: "Papaya",        emoji: "🥭", size: "27.8 cm" },
  23: { name: "Grapefruit",    emoji: "🍊", size: "28.9 cm" },
  24: { name: "Corn",          emoji: "🌽", size: "30 cm" },
  25: { name: "Cauliflower",   emoji: "🥦", size: "34.6 cm" },
  26: { name: "Lettuce",       emoji: "🥬", size: "35.6 cm" },
  27: { name: "Cabbage",       emoji: "🥬", size: "36.6 cm" },
  28: { name: "Eggplant",      emoji: "🍆", size: "37.6 cm" },
  29: { name: "Butternut",     emoji: "🎃", size: "38.6 cm" },
  30: { name: "Cabbage",       emoji: "🥬", size: "39.9 cm" },
  31: { name: "Coconut",       emoji: "🥥", size: "41.1 cm" },
  32: { name: "Squash",        emoji: "🥒", size: "42.4 cm" },
  33: { name: "Pineapple",     emoji: "🍍", size: "43.7 cm" },
  34: { name: "Melon",         emoji: "🍈", size: "45 cm" },
  35: { name: "Honeydew",      emoji: "🍈", size: "46.2 cm" },
  36: { name: "Romaine",       emoji: "🥬", size: "47.4 cm" },
  37: { name: "Winter melon",  emoji: "🍈", size: "48.6 cm" },
  38: { name: "Pumpkin",       emoji: "🎃", size: "49.8 cm" },
  39: { name: "Mini watermelon",emoji: "🍉", size: "50.7 cm" },
  40: { name: "Watermelon",    emoji: "🍉", size: "51.2 cm" },
};

const TRIMESTER_INFO = [
  { t: 1, label: "First Trimester",  weeks: "Weeks 1–12",  emoji: "🌱", desc: "Baby's organs are forming. You may feel nausea and fatigue." },
  { t: 2, label: "Second Trimester", weeks: "Weeks 13–26", emoji: "✨", desc: "Energy returns. Baby starts moving around week 18–20." },
  { t: 3, label: "Third Trimester",  weeks: "Weeks 27–40", emoji: "🌟", desc: "Final stretch. Baby gains weight and prepares for birth." },
];

const CYCLE_SYMPTOMS = [
  "Cramps", "Bloating", "Headache", "Back pain", "Breast tenderness",
  "Acne", "Fatigue", "Nausea", "Spotting", "Discharge",
];
const CYCLE_MOODS = ["Happy 😊", "Sad 😢", "Anxious 😰", "Irritable 😤", "Energetic ⚡", "Calm 😌"];
const FLOW_OPTIONS = [
  { value: "spotting", label: "Spotting", color: "#fca5a5" },
  { value: "light",    label: "Light",    color: "#f87171" },
  { value: "medium",   label: "Medium",   color: "#ef4444" },
  { value: "heavy",    label: "Heavy",    color: "#b91c1c" },
];

const PREGNANCY_SYMPTOMS = [
  "Nausea", "Vomiting", "Fatigue", "Heartburn", "Back pain",
  "Swelling", "Headache", "Cramps", "Spotting", "Frequent urination",
];
const PREGNANCY_MOODS = ["Great 😄", "Good 🙂", "Tired 😴", "Anxious 😰", "Emotional 🥹", "Uncomfortable 😣"];

const PHASE_META: Record<Phase, { label: string; color: string; bg: string; desc: string }> = {
  menstruation: { label: "Period",        color: "#f87171", bg: "rgba(248,113,113,0.12)", desc: "Your period is here" },
  follicular:   { label: "Follicular",    color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  desc: "Preparing to ovulate" },
  fertile:      { label: "Fertile Window",color: "#4ade80", bg: "rgba(74,222,128,0.12)", desc: "High chance of pregnancy" },
  luteal:       { label: "Luteal",        color: "#c084fc", bg: "rgba(192,132,252,0.12)", desc: "Post-ovulation phase" },
};

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WomensHealthPage() {
  const [, navigate] = useLocation();
  const { data: cycleToday, isLoading: cycleLoading } = useWomensHealthToday();
  const { data: pregToday, isLoading: pregLoading } = usePregnancyToday();

  const switchMode = useSwitchMode();

  // Determine current mode from what's set up
  const isSetUp = cycleToday?.isSetUp || pregToday?.isSetUp;
  const currentMode: "cycle" | "pregnancy" = pregToday?.isSetUp ? "pregnancy" : "cycle";
  const [tab, setTab] = useState<"home" | "calendar" | "history">("home");

  if (cycleLoading || pregLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isSetUp) return <SetupFlow />;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl transition active:scale-90"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <ArrowLeft style={{ width: 18, height: 18, color: "var(--text-main)" }} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Women's Health</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <button onClick={() => switchMode.mutate("cycle")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: currentMode === "cycle" ? "var(--accent)" : "transparent", color: currentMode === "cycle" ? "#fff" : "var(--text-sub)" }}>
            <Heart style={{ width: 14, height: 14 }} /> Cycle
          </button>
          <button onClick={() => switchMode.mutate("pregnancy")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: currentMode === "pregnancy" ? "#ec4899" : "transparent", color: currentMode === "pregnancy" ? "#fff" : "var(--text-sub)" }}>
            <Baby style={{ width: 14, height: 14 }} /> Pregnancy
          </button>
        </div>
      </div>

      {currentMode === "cycle" ? (
        <>
          {/* Cycle tab bar */}
          <div className="px-4 mb-4">
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              {(["home", "calendar", "history"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition"
                  style={{ background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "#fff" : "var(--text-sub)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {tab === "home" && <CycleHome data={cycleToday!} />}
          {tab === "calendar" && <CycleCalendar />}
          {tab === "history" && <CycleHistory />}
        </>
      ) : (
        <PregnancyView data={pregToday!} />
      )}
    </div>
  );
}

// ── Setup Flow ────────────────────────────────────────────────────────────────

function SetupFlow() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"pick" | "cycle" | "pregnancy">("pick");
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen, setPeriodLen] = useState(5);
  const [lastPeriod, setLastPeriod] = useState("");
  const [dateMode, setDateMode] = useState<"lmp" | "due">("lmp");
  const [dateValue, setDateValue] = useState("");
  const setupCycle = useSetupCycle();
  const setupPregnancy = useSetupPregnancy();

  if (step === "pick") return (
    <div className="px-4 pt-8 flex flex-col">
      <button onClick={() => navigate("/")} className="self-start p-2 rounded-xl mb-6"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <ArrowLeft style={{ width: 18, height: 18, color: "var(--text-main)" }} />
      </button>
      <div className="text-center mb-8">
        <p className="text-4xl mb-3">🌸</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Women's Health</h1>
        <p className="text-sm" style={{ color: "var(--text-sub)" }}>Track your cycle, health, and pregnancy journey</p>
      </div>
      <div className="space-y-3">
        <button onClick={() => setStep("cycle")}
          className="w-full rounded-2xl p-5 text-left transition active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#4c0519,#be123c)", border: "1px solid rgba(251,164,175,0.3)" }}>
          <p className="text-lg mb-1">❤️ Period & Cycle Tracking</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Log your period, symptoms, fertile window, and cycle history</p>
        </button>
        <button onClick={() => setStep("pregnancy")}
          className="w-full rounded-2xl p-5 text-left transition active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#4a044e,#a21caf)", border: "1px solid rgba(240,171,252,0.3)" }}>
          <p className="text-lg mb-1">🤰 Pregnancy Tracking</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Week-by-week tracking, baby size, symptoms, kick counter, and more</p>
        </button>
      </div>
    </div>
  );

  if (step === "cycle") return (
    <div className="px-4 pt-6">
      <button onClick={() => setStep("pick")} className="flex items-center gap-2 mb-6 text-sm font-medium" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Back
      </button>
      <p className="text-2xl mb-1">❤️</p>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Set up your cycle</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>ERA will predict your periods and fertile window</p>

      <div className="space-y-4">
        <NumberRow label="Average cycle length" sublabel="Days from period start to next period start" value={cycleLen} min={20} max={45} onChange={setCycleLen} />
        <NumberRow label="Average period length" sublabel="How many days your period lasts" value={periodLen} min={2} max={10} onChange={setPeriodLen} />
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-sub)" }}>When did your last period start?</p>
          <input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} max={new Date().toISOString().split("T")[0]}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
        </div>
      </div>

      <button onClick={() => setupCycle.mutate({ cycleLength: cycleLen, periodLength: periodLen, lastPeriodStart: lastPeriod })}
        disabled={!lastPeriod || setupCycle.isPending}
        className="w-full mt-8 py-4 rounded-2xl font-bold text-sm transition active:scale-95"
        style={{ background: "var(--accent)", color: "#fff", opacity: !lastPeriod ? 0.5 : 1 }}>
        {setupCycle.isPending ? "Setting up…" : "Start tracking"}
      </button>
    </div>
  );

  return (
    <div className="px-4 pt-6">
      <button onClick={() => setStep("pick")} className="flex items-center gap-2 mb-6 text-sm font-medium" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Back
      </button>
      <p className="text-2xl mb-1">🤰</p>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Set up pregnancy tracking</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>ERA will calculate your week and due date</p>

      <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {(["lmp", "due"] as const).map((m) => (
          <button key={m} onClick={() => setDateMode(m)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
            style={{ background: dateMode === m ? "var(--accent)" : "transparent", color: dateMode === m ? "#fff" : "var(--text-sub)" }}>
            {m === "lmp" ? "Last period date" : "Due date"}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-sub)" }}>
        {dateMode === "lmp" ? "First day of your last menstrual period" : "Your estimated due date"}
      </p>
      <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />

      <button onClick={() => setupPregnancy.mutate(dateMode === "lmp" ? { lmpDate: dateValue } : { dueDate: dateValue })}
        disabled={!dateValue || setupPregnancy.isPending}
        className="w-full mt-8 py-4 rounded-2xl font-bold text-sm transition active:scale-95"
        style={{ background: "#a21caf", color: "#fff", opacity: !dateValue ? 0.5 : 1 }}>
        {setupPregnancy.isPending ? "Setting up…" : "Start tracking"}
      </button>
    </div>
  );
}

// ── Cycle: Home Tab ───────────────────────────────────────────────────────────

function CycleHome({ data }: { data: ReturnType<typeof useWomensHealthToday>["data"] }) {
  const ci = data?.cycleInfo;
  const todayLog = data?.todayLog;
  const logCycle = useLogCycle();

  const [selectedFlow, setSelectedFlow] = useState<string | null>(todayLog?.flow ?? null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(todayLog?.symptoms ?? []);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [isPeriodStart, setIsPeriodStart] = useState(todayLog?.isPeriodStart ?? false);
  const [saving, setSaving] = useState(false);

  const phase = ci?.phase;
  const meta = phase ? PHASE_META[phase] : null;

  function toggleItem(list: string[], item: string, set: (v: string[]) => void) {
    set(list.includes(item) ? list.filter(s => s !== item) : [...list, item]);
  }

  async function save() {
    setSaving(true);
    await logCycle.mutateAsync({
      flow: selectedFlow,
      symptoms: [...selectedSymptoms, ...selectedMoods],
      isPeriodStart,
    });
    setSaving(false);
  }

  return (
    <div className="px-4 space-y-4">
      {/* Phase card */}
      {ci && meta && (
        <div className="rounded-2xl p-5" style={{ background: meta.bg, border: `1px solid ${meta.color}44` }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: meta.color }}>{meta.label}</p>
              <p className="text-sm" style={{ color: "var(--text-sub)" }}>{meta.desc}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: meta.color }}>Day {ci.cycleDay}</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>of {data?.settings?.cycleLength ?? 28}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InfoChip label="Next period" value={`${ci.daysUntilNextPeriod}d`} />
            <InfoChip label="Ovulation" value={new Date(ci.ovulationDate + "T12:00:00").toLocaleDateString("en", { day: "numeric", month: "short" })} />
            <InfoChip label="Fertile" value={`${new Date(ci.fertileStartDate + "T12:00:00").getDate()}–${new Date(ci.fertileEndDate + "T12:00:00").getDate()} ${new Date(ci.fertileEndDate + "T12:00:00").toLocaleDateString("en", { month: "short" })}`} />
          </div>
        </div>
      )}

      {/* Today's log */}
      <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Log today</p>

        {/* Period start toggle */}
        <button onClick={() => setIsPeriodStart(!isPeriodStart)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl mb-3 transition"
          style={{ background: isPeriodStart ? "rgba(248,113,113,0.15)" : "transparent", border: `1px solid ${isPeriodStart ? "#f87171" : "var(--glass-border)"}` }}>
          <span className="text-sm font-semibold" style={{ color: isPeriodStart ? "#f87171" : "var(--text-sub)" }}>
            🔴 My period started today
          </span>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: isPeriodStart ? "#f87171" : "var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isPeriodStart && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
          </div>
        </button>

        {/* Flow */}
        {isPeriodStart && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Flow intensity</p>
            <div className="flex gap-2">
              {FLOW_OPTIONS.map(f => (
                <button key={f.value} onClick={() => setSelectedFlow(selectedFlow === f.value ? null : f.value)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-90"
                  style={{ background: selectedFlow === f.value ? f.color : "transparent", color: selectedFlow === f.value ? "#fff" : "var(--text-sub)", border: `1px solid ${selectedFlow === f.value ? f.color : "var(--glass-border)"}` }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Symptoms */}
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>How do you feel?</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CYCLE_SYMPTOMS.map(s => (
            <ChipBtn key={s} label={s} active={selectedSymptoms.includes(s)} onClick={() => toggleItem(selectedSymptoms, s, setSelectedSymptoms)} />
          ))}
        </div>

        {/* Mood */}
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Mood</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CYCLE_MOODS.map(m => (
            <ChipBtn key={m} label={m} active={selectedMoods.includes(m)} onClick={() => toggleItem(selectedMoods, m, setSelectedMoods)} />
          ))}
        </div>

        <button onClick={() => { void save(); }} disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-bold transition active:scale-95"
          style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save today's log"}
        </button>
      </div>
    </div>
  );
}

// ── Cycle: Calendar Tab ───────────────────────────────────────────────────────

function CycleCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data } = useWomensCalendar(currentMonth);

  const [year, mon] = currentMonth.split("-").map(Number);
  const firstDow = new Date(year, mon - 1, 1).getDay();
  const blanks = firstDow === 0 ? 6 : firstDow - 1;

  function prevMonth() {
    const d = new Date(year, mon - 2, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  }
  function nextMonth() {
    const d = new Date(year, mon, 1);
    const next = d.toISOString().slice(0, 7);
    if (next <= new Date().toISOString().slice(0, 7)) setCurrentMonth(next);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="px-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <ChevronLeft style={{ width: 16, height: 16, color: "var(--text-main)" }} />
        </button>
        <p className="font-bold text-sm" style={{ color: "var(--text-main)" }}>
          {new Date(year, mon - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" })}
        </p>
        <button onClick={nextMonth} className="p-2 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <ChevronRight style={{ width: 16, height: 16, color: "var(--text-main)" }} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap mb-3">
        {[["#f87171","Period"],["#4ade80","Fertile"],["#a78bfa","Ovulation"],["#60a5fa","Follicular"],["#c084fc","Luteal"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 9, background: color }} />
            <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <p key={i} className="text-center text-[10px] font-bold" style={{ color: "var(--text-dim)" }}>{d}</p>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
        {(data?.days ?? []).map((day: CalendarDay) => {
          const isToday = day.date === today;
          const dotColor = day.isOvulationDay ? "#a78bfa"
            : day.isPeriodDay ? "#f87171"
            : day.isFertileDay ? "#4ade80"
            : day.phase === "follicular" ? "#60a5fa"
            : day.phase === "luteal" ? "#c084fc"
            : null;

          return (
            <div key={day.date} className="aspect-square flex flex-col items-center justify-center rounded-lg relative"
              style={{ background: isToday ? "var(--accent-tint-bg)" : "transparent", border: isToday ? "1px solid var(--accent-tint-border)" : "1px solid transparent" }}>
              <p className="text-xs font-semibold leading-none" style={{ color: isToday ? "var(--accent)" : "var(--text-main)" }}>
                {new Date(day.date + "T12:00:00").getDate()}
              </p>
              {dotColor && <div style={{ width: 5, height: 5, borderRadius: 9, background: dotColor, marginTop: 2 }} />}
              {day.log?.flow && !dotColor && <div style={{ width: 5, height: 5, borderRadius: 9, background: "#f87171", marginTop: 2 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cycle: History Tab ────────────────────────────────────────────────────────

function CycleHistory() {
  const { data } = useWomensHistory();

  if (!data?.cycles.length) {
    return (
      <div className="px-4 text-center py-16" style={{ color: "var(--text-dim)" }}>
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm">No cycle history yet. Log your period to start building history.</p>
      </div>
    );
  }

  const avgLength = data.cycles.filter(c => c.cycleLength).reduce((s, c) => s + (c.cycleLength ?? 0), 0) / data.cycles.filter(c => c.cycleLength).length;

  return (
    <div className="px-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Avg cycle length</p>
          <p className="text-2xl font-black" style={{ color: "var(--accent)" }}>{avgLength ? Math.round(avgLength) : data.settings?.cycleLength ?? 28}<span className="text-sm font-normal">d</span></p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Avg period length</p>
          <p className="text-2xl font-black" style={{ color: "#f87171" }}>{data.settings?.periodLength ?? 5}<span className="text-sm font-normal">d</span></p>
        </div>
      </div>

      {/* Cycle list */}
      <div className="space-y-2">
        {data.cycles.map((c, i) => (
          <div key={c.startDate} className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <div style={{ width: 8, height: 8, borderRadius: 9, background: i === 0 ? "var(--accent)" : "#f87171", flexShrink: 0 }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                {new Date(c.startDate + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="text-xs" style={{ color: "var(--text-sub)" }}>Period: {c.periodDays} days</p>
            </div>
            {c.cycleLength && (
              <p className="text-sm font-bold" style={{ color: "var(--text-dim)" }}>{c.cycleLength}d cycle</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pregnancy View ────────────────────────────────────────────────────────────

function PregnancyView({ data }: { data: ReturnType<typeof usePregnancyToday>["data"] }) {
  const [tab, setTab] = useState<"home" | "log" | "timeline">("home");
  const { data: timeline } = usePregnancyTimeline();
  const logPregnancy = useLogPregnancy();

  const [selSymptoms, setSelSymptoms] = useState<string[]>(data?.todayLog?.symptoms ?? []);
  const [selMood, setSelMood] = useState<string>(data?.todayLog?.mood ?? "");
  const [weight, setWeight] = useState<string>(data?.todayLog?.weightKg ? String(data.todayLog.weightKg) : "");
  const [kicks, setKicks] = useState<number>(data?.todayLog?.kicksCount ?? 0);
  const [bp, setBp] = useState<string>(data?.todayLog?.bloodPressure ?? "");
  const [saving, setSaving] = useState(false);

  if (!data?.isSetUp) return <SetupFlow />;

  const week = data.weeksPregnant ?? 0;
  const trimester = data.trimester ?? 1;
  const daysUntilDue = data.daysUntilDue ?? 0;
  const babySize = BABY_SIZES[Math.min(40, Math.max(4, week))];
  const trimInfo = TRIMESTER_INFO.find(t => t.t === trimester)!;

  function toggleSymptom(s: string) { setSelSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }

  async function saveLog() {
    setSaving(true);
    await logPregnancy.mutateAsync({
      symptoms: selSymptoms,
      mood: selMood || null,
      weightKg: weight ? parseFloat(weight) : null,
      kicksCount: kicks || null,
      bloodPressure: bp || null,
    });
    setSaving(false);
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {(["home", "log", "timeline"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition"
              style={{ background: tab === t ? "#a21caf" : "transparent", color: tab === t ? "#fff" : "var(--text-sub)" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "home" && (
        <div className="px-4 space-y-4">
          {data.isPostpartum ? (
            <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg,rgba(74,4,78,0.4),rgba(162,28,175,0.2))", border: "1px solid rgba(240,171,252,0.3)" }}>
              <p className="text-3xl mb-2">👶</p>
              <p className="text-lg font-bold text-white">Congratulations!</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>You are now in your postpartum period. Take care of yourself.</p>
            </div>
          ) : (
            <>
              {/* Week card */}
              <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(74,4,78,0.5),rgba(162,28,175,0.3))", border: "1px solid rgba(240,171,252,0.3)" }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "#f0abfc" }}>Week {week} + {data.daysIntoWeek ?? 0} days</p>
                    <p className="text-2xl font-black text-white">{trimInfo.label}</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>{trimInfo.weeks}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl">{trimInfo.emoji}</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>{daysUntilDue}d to go</p>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{trimInfo.desc}</p>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (week / 40) * 100)}%`, background: "#f0abfc" }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Week 1</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Week 40</p>
                  </div>
                </div>
              </div>

              {/* Baby size */}
              {babySize && (
                <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <p style={{ fontSize: 40 }}>{babySize.emoji}</p>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)" }}>Baby is the size of a</p>
                    <p className="text-lg font-black" style={{ color: "var(--text-main)" }}>{babySize.name}</p>
                    <p className="text-sm" style={{ color: "var(--text-sub)" }}>About {babySize.size} long</p>
                  </div>
                </div>
              )}

              {/* Due date */}
              <div className="rounded-2xl px-4 py-3 flex justify-between items-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>Due date</p>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    {new Date((data.dueDate ?? "") + "T12:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <button onClick={() => setTab("log")}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition active:scale-90"
                  style={{ background: "#a21caf", color: "#fff" }}>
                  Log today
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "log" && (
        <div className="px-4 space-y-4">
          <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Today's log</p>

            {/* Mood */}
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>How are you feeling?</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PREGNANCY_MOODS.map(m => (
                <ChipBtn key={m} label={m} active={selMood === m} onClick={() => setSelMood(selMood === m ? "" : m)} color="#a21caf" />
              ))}
            </div>

            {/* Symptoms */}
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Symptoms</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PREGNANCY_SYMPTOMS.map(s => (
                <ChipBtn key={s} label={s} active={selSymptoms.includes(s)} onClick={() => toggleSymptom(s)} color="#a21caf" />
              ))}
            </div>

            {/* Weight */}
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Weight (kg)</p>
            <input type="number" placeholder="e.g. 68.5" value={weight} onChange={e => setWeight(e.target.value)} step="0.1"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />

            {/* Kicks (weeks 20+) */}
            {(week >= 20) && (
              <div className="mb-4">
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Kick counter</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setKicks(Math.max(0, kicks - 1))} className="w-10 h-10 rounded-xl font-bold text-xl transition active:scale-90" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}>−</button>
                  <p className="text-2xl font-black flex-1 text-center" style={{ color: "#a21caf" }}>{kicks}</p>
                  <button onClick={() => setKicks(kicks + 1)} className="w-10 h-10 rounded-xl font-bold text-xl transition active:scale-90" style={{ background: "#a21caf", color: "#fff" }}>+</button>
                </div>
              </div>
            )}

            {/* Blood pressure */}
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-sub)" }}>Blood pressure (e.g. 120/80)</p>
            <input type="text" placeholder="120/80" value={bp} onChange={e => setBp(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />

            <button onClick={() => { void saveLog(); }} disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold transition active:scale-95"
              style={{ background: "#a21caf", color: "#fff", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save today's log"}
            </button>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="px-4 space-y-2">
          {!timeline?.entries.length ? (
            <div className="text-center py-16" style={{ color: "var(--text-dim)" }}>
              <p className="text-3xl mb-2">📔</p>
              <p className="text-sm">No logs yet. Start logging daily to build your pregnancy journal.</p>
            </div>
          ) : timeline.entries.map(entry => (
            <div key={entry.date} className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div className="flex justify-between mb-2">
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {new Date(entry.date + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </p>
                <p className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(162,28,175,0.15)", color: "#a21caf" }}>Week {entry.week}</p>
              </div>
              {entry.mood && <p className="text-xs mb-1" style={{ color: "var(--text-sub)" }}>Mood: {entry.mood}</p>}
              {entry.symptoms.length > 0 && <p className="text-xs mb-1" style={{ color: "var(--text-sub)" }}>{entry.symptoms.join(" · ")}</p>}
              {entry.weightKg && <p className="text-xs" style={{ color: "var(--text-sub)" }}>Weight: {entry.weightKg} kg</p>}
              {entry.kicksCount != null && entry.kicksCount > 0 && <p className="text-xs" style={{ color: "var(--text-sub)" }}>Kicks: {entry.kicksCount}</p>}
              {entry.bloodPressure && <p className="text-xs" style={{ color: "var(--text-sub)" }}>BP: {entry.bloodPressure}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function ChipBtn({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  const c = color ?? "var(--accent)";
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition active:scale-90"
      style={{ background: active ? c : "transparent", color: active ? "#fff" : "var(--text-sub)", border: `1px solid ${active ? c : "var(--glass-border)"}` }}>
      {label}
    </button>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-2 text-center" style={{ background: "rgba(0,0,0,0.15)" }}>
      <p className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <p className="text-xs font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}

function NumberRow({ label, sublabel, value, min, max, onChange }: { label: string; sublabel: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-main)" }}>{label}</p>
      <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>{sublabel}</p>
      <div className="flex items-center gap-4">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 rounded-xl font-bold text-xl transition active:scale-90" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}>−</button>
        <p className="text-2xl font-black flex-1 text-center" style={{ color: "var(--accent)" }}>{value}<span className="text-sm font-normal"> days</span></p>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 rounded-xl font-bold text-xl transition active:scale-90" style={{ background: "var(--accent)", color: "#fff" }}>+</button>
      </div>
    </div>
  );
}
