import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Calendar, History, Baby, Heart } from "lucide-react";
import {
  useWomensHealthToday, useSetupWomensHealth, useLogCycleDay,
  usePregnancyToday, useSetupPregnancy, useSwitchMode, useLogPregnancy, usePregnancyTimeline,
  PHASE_META, FLOW_META,
  type Flow,
} from "@/lib/womens-health-api";
import { cn } from "@/lib/utils";

const BABY_SIZES: Record<number, { name: string; emoji: string; size: string }> = {
  4:  { name: "Poppy seed",     emoji: "🌱", size: "0.1 cm" },
  5:  { name: "Sesame seed",    emoji: "🫘", size: "0.2 cm" },
  6:  { name: "Lentil",         emoji: "🫛", size: "0.6 cm" },
  7:  { name: "Blueberry",      emoji: "🫐", size: "1.3 cm" },
  8:  { name: "Kidney bean",    emoji: "🫘", size: "1.6 cm" },
  9:  { name: "Grape",          emoji: "🍇", size: "2.3 cm" },
  10: { name: "Kumquat",        emoji: "🍊", size: "3.1 cm" },
  11: { name: "Fig",            emoji: "🍑", size: "4.1 cm" },
  12: { name: "Lime",           emoji: "🍋", size: "5.4 cm" },
  13: { name: "Lemon",          emoji: "🍋", size: "7.4 cm" },
  14: { name: "Peach",          emoji: "🍑", size: "8.7 cm" },
  15: { name: "Apple",          emoji: "🍎", size: "10.1 cm" },
  16: { name: "Avocado",        emoji: "🥑", size: "11.6 cm" },
  17: { name: "Onion",          emoji: "🧅", size: "13 cm" },
  18: { name: "Bell pepper",    emoji: "🫑", size: "14.2 cm" },
  19: { name: "Tomato",         emoji: "🍅", size: "15.3 cm" },
  20: { name: "Banana",         emoji: "🍌", size: "25.6 cm" },
  21: { name: "Carrot",         emoji: "🥕", size: "26.7 cm" },
  22: { name: "Papaya",         emoji: "🥭", size: "27.8 cm" },
  24: { name: "Corn",           emoji: "🌽", size: "30 cm" },
  26: { name: "Lettuce",        emoji: "🥬", size: "35.6 cm" },
  28: { name: "Eggplant",       emoji: "🍆", size: "37.6 cm" },
  30: { name: "Cabbage",        emoji: "🥬", size: "39.9 cm" },
  32: { name: "Squash",         emoji: "🥒", size: "42.4 cm" },
  34: { name: "Melon",          emoji: "🍈", size: "45 cm" },
  36: { name: "Romaine",        emoji: "🥬", size: "47.4 cm" },
  38: { name: "Pumpkin",        emoji: "🎃", size: "49.8 cm" },
  40: { name: "Watermelon",     emoji: "🍉", size: "51.2 cm" },
};

function getBabySize(week: number) {
  const weeks = Object.keys(BABY_SIZES).map(Number).sort((a, b) => b - a);
  const w = weeks.find((k) => k <= week) ?? 4;
  return BABY_SIZES[w];
}

const PREGNANCY_SYMPTOMS = [
  "Nausea", "Vomiting", "Fatigue", "Heartburn", "Back pain",
  "Swelling", "Headache", "Cramps", "Spotting", "Frequent urination",
];
const PREGNANCY_MOODS = ["Great 😄", "Good 🙂", "Tired 😴", "Anxious 😰", "Emotional 🥹", "Uncomfortable 😣"];
const TRIMESTER_INFO = [
  { t: 1, label: "First Trimester",  weeks: "Weeks 1–12",  desc: "Baby's organs are forming. Nausea and fatigue are common." },
  { t: 2, label: "Second Trimester", weeks: "Weeks 13–26", desc: "Energy returns. Baby starts moving around weeks 18–20." },
  { t: 3, label: "Third Trimester",  weeks: "Weeks 27–40", desc: "Final stretch. Baby gains weight and prepares for birth." },
];

// ── Entry — gates between setup and dashboard ────────────────────────────────
export default function WomensHealthPage() {
  const [, navigate] = useLocation();
  const { data: cycleData, isLoading: cycleLoading } = useWomensHealthToday();
  const { data: pregData, isLoading: pregLoading } = usePregnancyToday();

  if (cycleLoading || pregLoading) return <Spinner />;

  // If neither is set up — go to mode picker
  if (!cycleData?.isSetUp && !pregData?.isSetUp) return <ModePickerSetup onBack={() => window.history.back()} />;

  return <MainDashboard onBack={() => window.history.back()} />;
}

// ── Mode picker setup ────────────────────────────────────────────────────────
function ModePickerSetup({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"pick" | "cycle" | "pregnancy">("pick");

  if (mode === "cycle") return <CycleSetupScreen onBack={() => setMode("pick")} />;
  if (mode === "pregnancy") return <PregnancySetupScreen onBack={() => setMode("pick")} />;

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🌸</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Women's Health</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Track your cycle, symptoms, and pregnancy journey
        </p>
      </div>
      <div className="space-y-3">
        <button onClick={() => setMode("cycle")}
          className="w-full rounded-2xl p-5 text-left border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 transition active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-rose-500" />
            <div>
              <p className="font-bold text-foreground">Period & Cycle Tracking</p>
              <p className="text-xs text-muted-foreground mt-0.5">Log your period, symptoms, fertile window, and cycle history</p>
            </div>
          </div>
        </button>
        <button onClick={() => setMode("pregnancy")}
          className="w-full rounded-2xl p-5 text-left border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 transition active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <Baby className="w-6 h-6 text-purple-500" />
            <div>
              <p className="font-bold text-foreground">Pregnancy Tracking</p>
              <p className="text-xs text-muted-foreground mt-0.5">Week-by-week tracking, baby size, symptoms, kick counter, and more</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Main dashboard — mode toggle at top ─────────────────────────────────────
function MainDashboard({ onBack }: { onBack: () => void }) {
  const { data: cycleData } = useWomensHealthToday();
  const { data: pregData } = usePregnancyToday();
  const switchMode = useSwitchMode();

  // Determine active mode: prefer pregnancy if set up
  const defaultMode = pregData?.isSetUp ? "pregnancy" : "cycle";
  const [mode, setMode] = useState<"cycle" | "pregnancy">(defaultMode);
  const [showLog, setShowLog] = useState(false);
  const [showPregSetup, setShowPregSetup] = useState(false);
  const [showCycleSetup, setShowCycleSetup] = useState(false);

  const [, navigate] = useLocation();

  function handleModeSwitch(m: "cycle" | "pregnancy") {
    setMode(m);
    switchMode.mutate(m);
  }

  if (showPregSetup) return <PregnancySetupScreen onBack={() => setShowPregSetup(false)} />;
  if (showCycleSetup) return <CycleSetupScreen onBack={() => setShowCycleSetup(false)} />;

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        {mode === "cycle" && (
          <div className="flex gap-2">
            <button onClick={() => navigate("/womens-health/calendar")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={() => navigate("/womens-health/history")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <History className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted mb-5">
        <button onClick={() => handleModeSwitch("cycle")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition",
            mode === "cycle" ? "bg-card text-rose-500 shadow-sm" : "text-muted-foreground")}>
          <Heart className="w-3.5 h-3.5" /> Cycle
        </button>
        <button onClick={() => handleModeSwitch("pregnancy")}
          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition",
            mode === "pregnancy" ? "bg-card text-purple-500 shadow-sm" : "text-muted-foreground")}>
          <Baby className="w-3.5 h-3.5" /> Pregnancy
        </button>
      </div>

      {mode === "cycle" && (
        cycleData?.isSetUp
          ? <CycleDashboard data={cycleData} showLog={showLog} onShowLog={setShowLog} />
          : <SetupPrompt icon="❤️" title="Set up cycle tracking" sub="Log your period to start predicting phases and fertile windows." onSetup={() => setShowCycleSetup(true)} />
      )}
      {mode === "pregnancy" && (
        pregData?.isSetUp
          ? <PregnancyDashboard data={pregData} />
          : <SetupPrompt icon="🤰" title="Set up pregnancy tracking" sub="Enter your last period date or due date to start tracking week by week." onSetup={() => setShowPregSetup(true)} />
      )}
    </div>
  );
}

// ── Cycle setup ───────────────────────────────────────────────────────────────
function CycleSetupScreen({ onBack }: { onBack: () => void }) {
  const setup = useSetupWomensHealth();
  const [step, setStep] = useState<"intro" | "settings">("intro");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [lastPeriodStart, setLastPeriodStart] = useState("");

  if (step === "intro") return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🌸</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Cycle Tracking</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Track your menstrual cycle, understand your body's patterns, and know what to expect each day.
        </p>
      </div>
      <div className="space-y-3 mb-8">
        {[
          { icon: "📅", label: "Cycle tracking", sub: "Know your period days in advance" },
          { icon: "🌿", label: "Fertile window", sub: "Plan or prevent with confidence" },
          { icon: "💊", label: "Symptom logging", sub: "Spot patterns in how you feel" },
          { icon: "📊", label: "Cycle history", sub: "See how your cycle changes over time" },
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4">
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div><p className="font-semibold text-foreground text-sm">{f.label}</p><p className="text-xs text-muted-foreground">{f.sub}</p></div>
          </div>
        ))}
      </div>
      <button onClick={() => setStep("settings")} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95">
        Get started
      </button>
      <button onClick={onBack} className="w-full mt-3 text-sm text-muted-foreground">Maybe later</button>
    </div>
  );

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => setStep("intro")} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <h2 className="text-xl font-bold text-foreground mb-1">Tell us about your cycle</h2>
      <p className="text-sm text-muted-foreground mb-6">You can always adjust these later as the app learns your patterns.</p>
      <div className="space-y-5 mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">When did your last period start?</p>
          <input type="date" value={lastPeriodStart} onChange={(e) => setLastPeriodStart(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full bg-muted rounded-xl px-4 py-3 text-base font-bold text-foreground outline-none" />
        </div>
        <Stepper label="Average cycle length" value={cycleLength} min={20} max={45} onChange={setCycleLength}
          hint="Most cycles are 21–35 days. Day 1 = first day of your period." unit="days" />
        <Stepper label="Period length" value={periodLength} min={2} max={10} onChange={setPeriodLength}
          hint="How many days your period typically lasts." unit="days" />
      </div>
      <button onClick={() => setup.mutate({ cycleLength, periodLength, lastPeriodStart })} disabled={!lastPeriodStart || setup.isPending}
        className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {setup.isPending ? "Saving…" : "Start tracking"}
      </button>
    </div>
  );
}

// ── Pregnancy setup ───────────────────────────────────────────────────────────
function PregnancySetupScreen({ onBack }: { onBack: () => void }) {
  const setup = useSetupPregnancy();
  const [useWeeks, setUseWeeks] = useState(true);
  const [weeks, setWeeks] = useState(8);
  const [dueDate, setDueDate] = useState("");

  function handleSubmit() {
    if (useWeeks) {
      const lmpDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setup.mutate({ lmpDate });
    } else {
      setup.mutate({ dueDate });
    }
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🤰</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Pregnancy Tracking</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">Week-by-week tracking, baby size, symptom logs, and your pregnancy journal.</p>
      </div>

      {useWeeks ? (
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">How many weeks pregnant are you?</p>
          <div className="flex items-center justify-between">
            <button onClick={() => setWeeks((w) => Math.max(1, w - 1))}
              className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground text-2xl font-bold active:scale-90 transition">−</button>
            <div className="text-center">
              <p className="text-6xl font-black text-foreground">{weeks}</p>
              <p className="text-sm text-muted-foreground mt-1">week{weeks !== 1 ? "s" : ""} pregnant</p>
            </div>
            <button onClick={() => setWeeks((w) => Math.min(42, w + 1))}
              className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground text-2xl font-bold active:scale-90 transition">+</button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your due date</p>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full bg-muted rounded-xl px-4 py-3 text-base font-bold text-foreground outline-none" />
        </div>
      )}

      <button onClick={() => { setUseWeeks((p) => !p); setDueDate(""); }}
        className="w-full text-center text-sm text-purple-500 font-semibold mb-6 py-2 active:opacity-70 transition">
        {useWeeks ? "I know my due date instead →" : "← I know how many weeks instead"}
      </button>

      <button onClick={handleSubmit} disabled={(!useWeeks && !dueDate) || setup.isPending}
        className="w-full py-4 bg-purple-500 text-white rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {setup.isPending ? "Setting up…" : "Start tracking"}
      </button>
    </div>
  );
}

// ── Cycle dashboard ───────────────────────────────────────────────────────────
function CycleDashboard({ data, showLog, onShowLog }: {
  data: ReturnType<typeof useWomensHealthToday>["data"];
  showLog: boolean;
  onShowLog: (v: boolean) => void;
}) {
  const logDay = useLogCycleDay();

  if (!data?.isSetUp || !data.settings) return null;
  const { cycleInfo, todayLog, settings } = data;
  const today = data.today!;

  if (showLog) {
    return (
      <LogForm
        date={today}
        existing={todayLog ?? null}
        cycleInfo={cycleInfo ?? null}
        onSave={(payload) => { logDay.mutate(payload, { onSuccess: () => onShowLog(false) }); }}
        onBack={() => onShowLog(false)}
        isPending={logDay.isPending}
      />
    );
  }

  if (!cycleInfo) return (
    <div className="bg-card border border-border rounded-2xl p-5 text-center">
      <p className="text-3xl mb-2">📅</p>
      <p className="font-semibold text-foreground mb-1">No period start date recorded</p>
      <p className="text-sm text-muted-foreground">Log when your last period started to unlock predictions.</p>
      <button onClick={() => onShowLog(true)} className="mt-4 px-5 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold transition active:scale-95">
        Log today as period start
      </button>
    </div>
  );

  const meta = PHASE_META[cycleInfo.phase];
  const radius = 90;
  const STROKE_COLORS: Record<string, string> = {
    menstruation: "#f43f5e",
    follicular:   "#a855f7",
    fertile:      "#14b8a6",
    luteal:       "#f59e0b",
  };

  const phases = [
    { phase: "menstruation", start: 0,                           end: settings.periodLength },
    { phase: "follicular",   start: settings.periodLength,       end: cycleInfo.fertileStartCycleDay - 1 },
    { phase: "fertile",      start: cycleInfo.fertileStartCycleDay - 1, end: cycleInfo.fertileEndCycleDay },
    { phase: "luteal",       start: cycleInfo.fertileEndCycleDay, end: settings.cycleLength },
  ].filter((s) => s.end > s.start);

  function arcPath(startDay: number, endDay: number, r: number, cx: number, cy: number) {
    const sa = (startDay / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
    const ea = (endDay   / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(sa); const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea); const y2 = cy + r * Math.sin(ea);
    const large = (endDay - startDay) / settings.cycleLength > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const dotAngle = (cycleInfo.cycleDay / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
  const dotX = 110 + radius * Math.cos(dotAngle);
  const dotY = 110 + radius * Math.sin(dotAngle);

  return (
    <>
      {/* Cycle ring */}
      <div className="flex flex-col items-center mb-6">
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={radius} fill="none" strokeWidth="16" className="stroke-muted" />
          {phases.map((seg) => (
            <path key={seg.phase} d={arcPath(seg.start, seg.end, radius, 110, 110)}
              fill="none" strokeWidth="16" strokeLinecap="round"
              stroke={STROKE_COLORS[seg.phase]} opacity="0.3" />
          ))}
          {phases.map((seg) => {
            const visEnd = Math.min(seg.end, cycleInfo.cycleDay);
            if (visEnd <= seg.start) return null;
            return (
              <path key={`p-${seg.phase}`} d={arcPath(seg.start, visEnd, radius, 110, 110)}
                fill="none" strokeWidth="16" strokeLinecap="round"
                stroke={STROKE_COLORS[seg.phase]} />
            );
          })}
          <circle cx={dotX} cy={dotY} r="8" className="fill-background" />
          <circle cx={dotX} cy={dotY} r="5" fill={STROKE_COLORS[cycleInfo.phase]} />
          <text x="110" y="100" textAnchor="middle" className="fill-foreground" fontSize="36" fontWeight="bold">
            {cycleInfo.cycleDay}
          </text>
          <text x="110" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="12">
            of {settings.cycleLength}
          </text>
          <text x="110" y="138" textAnchor="middle" className="fill-muted-foreground" fontSize="11">
            days
          </text>
        </svg>
        <div className={cn("px-4 py-2 rounded-full text-sm font-bold", meta.bg, meta.color)}>
          {meta.label}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">{meta.description}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatusCard
          emoji={cycleInfo.isPeriodDay ? "🩸" : "📅"}
          label={cycleInfo.isPeriodDay ? "Period day" : "Next period"}
          value={cycleInfo.isPeriodDay ? `Day ${cycleInfo.cycleDay}` : cycleInfo.daysUntilNextPeriod === 0 ? "Today" : `In ${cycleInfo.daysUntilNextPeriod}d`}
        />
        <StatusCard
          emoji={cycleInfo.isFertileDay ? "✨" : "🌱"}
          label="Fertile window"
          value={cycleInfo.isFertileDay ? "Active now" : `Day ${cycleInfo.fertileStartCycleDay}–${cycleInfo.fertileEndCycleDay}`}
          highlight={cycleInfo.isFertileDay}
        />
      </div>

      {/* Today's log */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's log</p>
          <button onClick={() => onShowLog(true)} className="text-xs font-semibold text-rose-500 transition active:scale-95">
            {todayLog ? "Edit" : "Log now"}
          </button>
        </div>
        {todayLog ? (
          <div className="space-y-2">
            {todayLog.flow && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: FLOW_META[todayLog.flow].dots }, (_, i) => (
                    <div key={i} className={cn("w-2.5 h-2.5 rounded-full", FLOW_META[todayLog.flow!].color)} />
                  ))}
                  {Array.from({ length: 4 - FLOW_META[todayLog.flow].dots }, (_, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-muted" />
                  ))}
                </div>
                <span className="text-sm text-foreground">{FLOW_META[todayLog.flow].label} flow</span>
              </div>
            )}
            {todayLog.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {todayLog.symptoms.map((s) => (
                  <span key={s} className="text-[11px] bg-muted text-foreground px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
            {todayLog.notes && <p className="text-xs text-muted-foreground italic">"{todayLog.notes}"</p>}
            {!todayLog.flow && todayLog.symptoms.length === 0 && !todayLog.notes && (
              <p className="text-xs text-muted-foreground">Logged (no symptoms today)</p>
            )}
          </div>
        ) : (
          <button onClick={() => onShowLog(true)}
            className="w-full py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 transition active:scale-95">
            🌸 Log today's symptoms & flow
          </button>
        )}
      </div>

      {/* Phase legend */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cycle phases</p>
        <div className="grid grid-cols-2 gap-2">
          {(["menstruation", "follicular", "fertile", "luteal"] as const).map((p) => (
            <div key={p} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STROKE_COLORS[p] }} />
              <span className="text-xs text-foreground">{PHASE_META[p].label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Pregnancy dashboard ───────────────────────────────────────────────────────
function PregnancyDashboard({ data }: { data: ReturnType<typeof usePregnancyToday>["data"] }) {
  const [pregTab, setPregTab] = useState<"home" | "log" | "timeline">("home");
  const { data: timeline } = usePregnancyTimeline();
  const logPregnancy = useLogPregnancy();

  const [selSymptoms, setSelSymptoms] = useState<string[]>(data?.todayLog?.symptoms ?? []);
  const [selMood, setSelMood] = useState(data?.todayLog?.mood ?? "");
  const [weight, setWeight] = useState(data?.todayLog?.weightKg ? String(data.todayLog.weightKg) : "");
  const [kicks, setKicks] = useState(data?.todayLog?.kicksCount ?? 0);
  const [bp, setBp] = useState(data?.todayLog?.bloodPressure ?? "");
  const [saving, setSaving] = useState(false);

  if (!data?.isSetUp) return null;

  const week = data.weeksPregnant ?? 0;
  const trimester = data.trimester ?? 1;
  const trimInfo = TRIMESTER_INFO.find((t) => t.t === trimester)!;
  const babySize = getBabySize(Math.max(4, week));

  function toggleSym(s: string) { setSelSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); }

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
    <>
      {/* Preg sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted mb-4">
        {(["home", "log", "timeline"] as const).map((t) => (
          <button key={t} onClick={() => setPregTab(t)}
            className={cn("flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition",
              pregTab === t ? "bg-card text-purple-500 shadow-sm" : "text-muted-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {pregTab === "home" && (
        <div className="space-y-4">
          {data.isPostpartum ? (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 text-center">
              <p className="text-3xl mb-2">👶</p>
              <p className="text-lg font-bold text-foreground">Congratulations!</p>
              <p className="text-sm mt-1 text-muted-foreground">You are in your postpartum period. Take care of yourself.</p>
            </div>
          ) : (
            <>
              {/* Week + trimester card */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-0.5">
                      Week {week} + {data.daysIntoWeek ?? 0} days
                    </p>
                    <p className="text-xl font-bold text-foreground">{trimInfo.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{trimInfo.weeks}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl">🤰</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.daysUntilDue}d to due</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{trimInfo.desc}</p>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min(100, (week / 40) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground">Week 1</p>
                  <p className="text-[10px] text-muted-foreground">Week 40</p>
                </div>
              </div>

              {/* Baby size */}
              {babySize && (
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                  <p style={{ fontSize: 38 }}>{babySize.emoji}</p>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Baby is the size of a</p>
                    <p className="text-lg font-bold text-foreground">{babySize.name}</p>
                    <p className="text-sm text-muted-foreground">About {babySize.size} long</p>
                  </div>
                </div>
              )}

              {/* Due date + log CTA */}
              <div className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p className="text-sm font-bold text-foreground">
                    {new Date((data.dueDate ?? "") + "T12:00:00").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "long" })}
                  </p>
                </div>
                <button onClick={() => setPregTab("log")}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-500 text-white transition active:scale-90">
                  Log today
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {pregTab === "log" && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's log</p>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">How are you feeling?</p>
            <div className="flex flex-wrap gap-1.5">
              {PREGNANCY_MOODS.map((m) => (
                <button key={m} onClick={() => setSelMood(selMood === m ? "" : m)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition",
                    selMood === m ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600" : "border-border bg-card text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Symptoms</p>
            <div className="flex flex-wrap gap-1.5">
              {PREGNANCY_SYMPTOMS.map((s) => (
                <button key={s} onClick={() => toggleSym(s)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition",
                    selSymptoms.includes(s) ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600" : "border-border bg-card text-foreground")}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Weight (kg)</p>
            <input type="number" step="0.1" placeholder="e.g. 68.5" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>

          {week >= 20 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Kick counter</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setKicks(Math.max(0, kicks - 1))} className="w-10 h-10 rounded-xl bg-muted font-bold text-xl text-foreground transition active:scale-90">−</button>
                <p className="text-2xl font-black flex-1 text-center text-purple-500">{kicks}</p>
                <button onClick={() => setKicks(kicks + 1)} className="w-10 h-10 rounded-xl bg-purple-500 text-white font-bold text-xl transition active:scale-90">+</button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Blood pressure (e.g. 120/80)</p>
            <input type="text" placeholder="120/80" value={bp} onChange={(e) => setBp(e.target.value)}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>

          <button onClick={() => { void saveLog(); }} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold bg-purple-500 text-white transition active:scale-95 disabled:opacity-60">
            {saving ? "Saving…" : "Save today's log"}
          </button>
        </div>
      )}

      {pregTab === "timeline" && (
        <div className="space-y-2">
          {!timeline?.entries.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-3xl mb-2">📔</p>
              <p className="text-sm">No logs yet. Start logging daily to build your pregnancy journal.</p>
            </div>
          ) : timeline.entries.map((entry) => (
            <div key={entry.date} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-bold text-foreground">
                  {new Date(entry.date + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  Week {entry.week}
                </span>
              </div>
              {entry.mood && <p className="text-xs text-muted-foreground mb-0.5">Mood: {entry.mood}</p>}
              {entry.symptoms.length > 0 && <p className="text-xs text-muted-foreground mb-0.5">{entry.symptoms.join(" · ")}</p>}
              {entry.weightKg != null && <p className="text-xs text-muted-foreground mb-0.5">Weight: {entry.weightKg} kg</p>}
              {(entry.kicksCount ?? 0) > 0 && <p className="text-xs text-muted-foreground mb-0.5">Kicks: {entry.kicksCount}</p>}
              {entry.bloodPressure && <p className="text-xs text-muted-foreground">BP: {entry.bloodPressure}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Log form ──────────────────────────────────────────────────────────────────
function LogForm({ date, existing, cycleInfo, onSave, onBack, isPending }: {
  date: string;
  existing: { flow: Flow | null; symptoms: string[]; notes: string | null; isPeriodStart: boolean } | null;
  cycleInfo: { isPeriodDay: boolean } | null;
  onSave: (p: { date: string; flow: Flow | null; symptoms: string[]; notes: string | null; isPeriodStart: boolean }) => void;
  onBack: () => void;
  isPending: boolean;
}) {
  const [flow, setFlow] = useState<Flow | null>(existing?.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isPeriodStart, setIsPeriodStart] = useState(existing?.isPeriodStart ?? false);

  const FLOWS: Flow[] = ["spotting", "light", "medium", "heavy"];
  const SYMPTOMS = [
    "Cramps", "Bloating", "Headache", "Back pain", "Breast tenderness",
    "Mood swings", "Fatigue", "Nausea", "Food cravings", "Acne",
    "Insomnia", "Irritability", "Anxiety",
  ];

  function toggleSymptom(s: string) { setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]); }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
      </button>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-0.5">Log today</h2>
        <p className="text-sm text-muted-foreground">{new Date(date + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Period started today</p>
          <p className="text-xs text-muted-foreground mt-0.5">Updates your cycle predictions</p>
        </div>
        <button onClick={() => setIsPeriodStart((p) => !p)}
          className={cn("w-12 h-6 rounded-full transition relative", isPeriodStart ? "bg-rose-500" : "bg-muted")}>
          <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", isPeriodStart ? "left-6" : "left-0.5")} />
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flow intensity</p>
        <div className="grid grid-cols-4 gap-2">
          {FLOWS.map((f) => (
            <button key={f} onClick={() => setFlow(flow === f ? null : f)}
              className={cn("flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition",
                flow === f ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" : "border-border bg-card")}>
              <div className="flex gap-0.5">
                {Array.from({ length: FLOW_META[f].dots }, (_, i) => (
                  <div key={i} className={cn("w-2 h-2 rounded-full", FLOW_META[f].color)} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground capitalize">{f}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Symptoms</p>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button key={s} onClick={() => toggleSymptom(s)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition",
                symptoms.includes(s)
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                  : "border-border bg-card text-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="How are you feeling today?"
          className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground" />
      </div>

      <button onClick={() => onSave({ date, flow, symptoms, notes: notes || null, isPeriodStart })} disabled={isPending}
        className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {isPending ? "Saving…" : "Save log"}
      </button>
    </div>
  );
}

// ── Tiny setup prompt ─────────────────────────────────────────────────────────
function SetupPrompt({ icon, title, sub, onSetup }: { icon: string; title: string; sub: string; onSetup: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-center">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-bold text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground mb-5">{sub}</p>
      <button onClick={onSetup} className="px-6 py-3 rounded-xl font-bold text-sm bg-rose-500 text-white transition active:scale-95">
        Get started
      </button>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function StatusCard({ emoji, label, value, highlight = false }: { emoji: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4 border", highlight ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800" : "bg-card border-border")}>
      <span className="text-xl">{emoji}</span>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      <p className="text-base font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange, hint, unit }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; hint: string; unit: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))}
          className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl font-bold text-foreground transition active:scale-90">−</button>
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-foreground">{value}</span>
          <span className="text-sm text-muted-foreground ml-1">{unit}</span>
        </div>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-xl font-bold text-foreground transition active:scale-90">+</button>
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
}

const STROKE_COLORS: Record<string, string> = {
  menstruation: "#f43f5e",
  follicular:   "#a855f7",
  fertile:      "#14b8a6",
  luteal:       "#f59e0b",
};
