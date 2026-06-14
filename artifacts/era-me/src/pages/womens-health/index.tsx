import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, History, Baby, Heart } from "lucide-react";
import {
  useWomensHealthToday, useSetupWomensHealth, useLogCycleDay,
  usePregnancyToday, useSetupPregnancy, useSwitchMode, useLogPregnancy, usePregnancyTimeline,
  useWomensHealthCalendar,
  PHASE_META, FLOW_META,
  type Flow, type Phase, type CalendarDay,
} from "@/lib/womens-health-api";
import { cn } from "@/lib/utils";

// ── Calendar strip constants ────────────────────────────────────────────────────

const CHIP_W    = 52;
const BACK_DAYS = 730;   // 2 years back
const FWD_DAYS  = 1095;  // 3 years forward
const TOTAL     = BACK_DAYS + FWD_DAYS + 1;
const DAY_ABBR  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const RING_COLOR: Record<string, string> = {
  menstruation: "#f43f5e",
  follicular:   "#a855f7",
  fertile:      "#14b8a6",
  luteal:       "#f59e0b",
};

// ── Calendar helpers ────────────────────────────────────────────────────────────

function dateOffset(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function monthFromDate(base: string, offset: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function calcCycleDayFromLMP(date: string, lmpDate: string, cycleLength: number): number {
  const diff = Math.floor(
    (new Date(date + "T12:00:00").getTime() - new Date(lmpDate + "T12:00:00").getTime()) / 86400000
  );
  return ((diff % cycleLength) + cycleLength) % cycleLength + 1;
}

function phaseFromCycleDay(cd: number, periodLen: number, fertStart: number, fertEnd: number): Phase {
  if (cd <= periodLen) return "menstruation";
  if (cd < fertStart)  return "follicular";
  if (cd <= fertEnd)   return "fertile";
  return "luteal";
}

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function svgArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.9;
  if (endDeg <= startDeg) return "";
  const s = polarXY(cx, cy, r, startDeg);
  const e = polarXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Baby sizes ──────────────────────────────────────────────────────────────────

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
  const { data: cycleData, isLoading: cycleLoading } = useWomensHealthToday();
  const { data: pregData, isLoading: pregLoading } = usePregnancyToday();

  if (cycleLoading || pregLoading) return <Spinner />;

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

  const defaultMode = pregData?.isSetUp ? "pregnancy" : "cycle";
  const [mode, setMode] = useState<"cycle" | "pregnancy">(defaultMode);
  const [showLog, setShowLog] = useState(false);
  const [showPregSetup, setShowPregSetup] = useState(false);
  const [showCycleSetup, setShowCycleSetup] = useState(false);

  // Close pregnancy setup screen automatically once the query confirms isSetUp
  useEffect(() => {
    if (pregData?.isSetUp) setShowPregSetup(false);
  }, [pregData?.isSetUp]);

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
          <button onClick={() => navigate("/womens-health/history")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
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
      <button onClick={() => setup.mutate({ cycleLength, periodLength, lastPeriodStart }, { onSuccess: onBack })} disabled={!lastPeriodStart || setup.isPending}
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

// ── Cycle dashboard — Flo-style: day strip + ring + detail inline ─────────────

function CycleDashboard({ data, showLog, onShowLog }: {
  data: ReturnType<typeof useWomensHealthToday>["data"];
  showLog: boolean;
  onShowLog: (v: boolean) => void;
}) {
  const logDay = useLogCycleDay();
  const [, navigate] = useLocation();
  const todayStr = new Date().toISOString().split("T")[0];

  // selectedDate drives which 5 months are loaded — TanStack caches by month key
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Calendar data — always 5 months centred on selected date (hooks must be unconditional)
  const { data: da } = useWomensHealthCalendar(monthFromDate(selectedDate, -2));
  const { data: db } = useWomensHealthCalendar(monthFromDate(selectedDate, -1));
  const { data: dc } = useWomensHealthCalendar(monthFromDate(selectedDate, 0));
  const { data: dd } = useWomensHealthCalendar(monthFromDate(selectedDate, 1));
  const { data: de } = useWomensHealthCalendar(monthFromDate(selectedDate, 2));
  const stripRef = useRef<HTMLDivElement>(null);
  const isClickScrollRef = useRef(false);

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    [da, db, dc, dd, de].forEach((m) => m?.days.forEach((d) => map.set(d.date, d)));
    return map;
  }, [da, db, dc, dd, de]);

  const stripDates = useMemo(
    () => Array.from({ length: TOTAL }, (_, i) => dateOffset(todayStr, i - BACK_DAYS)),
    [todayStr]
  );

  // cycleInfoReady transitions false→true when data finishes loading and the strip is rendered.
  // Using [] would run the effect before the strip exists (data still loading → early return null).
  const cycleInfoReady = !!(data?.cycleInfo);
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = BACK_DAYS * CHIP_W;
    }
  }, [cycleInfoReady]);

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

  function getDayInfo(date: string): { phase: Phase | null; cycleDay: number | null } {
    const api = dayMap.get(date);
    if (api?.phase) return { phase: api.phase, cycleDay: api.cycleDay };
    if (!settings.lastPeriodStart || !settings.cycleLength) return { phase: null, cycleDay: null };
    const cd = calcCycleDayFromLMP(date, settings.lastPeriodStart, settings.cycleLength);
    return {
      phase: phaseFromCycleDay(cd, settings.periodLength ?? 5, cycleInfo.fertileStartCycleDay, cycleInfo.fertileEndCycleDay),
      cycleDay: cd,
    };
  }

  function handleScroll() {
    if (isClickScrollRef.current) return;
    const el = stripRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(TOTAL - 1, Math.round(el.scrollLeft / CHIP_W)));
    const date = stripDates[idx];
    if (date && date !== selectedDate) setSelectedDate(date);
  }

  function selectAndScroll(date: string, idx: number) {
    setSelectedDate(date);
    if (!stripRef.current) return;
    isClickScrollRef.current = true;
    stripRef.current.scrollTo({ left: idx * CHIP_W, behavior: "smooth" });
    setTimeout(() => { isClickScrollRef.current = false; }, 600);
  }

  const selectedInfo   = getDayInfo(selectedDate);
  const selectedApiDay = dayMap.get(selectedDate) ?? null;
  const isFuture = selectedDate > todayStr;
  const isToday  = selectedDate === todayStr;

  return (
    <>
      {/* ── Day strip — negative margins break out of parent px-5 ── */}
      <div style={{ marginLeft: -20, marginRight: -20, marginBottom: 4 }}>
        <div
          ref={stripRef}
          onScroll={handleScroll}
          style={{
            display: "flex",
            overflowX: "scroll",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
            paddingTop: 4,
            paddingBottom: 8,
            paddingLeft: `calc(50% - ${CHIP_W / 2}px)`,
            paddingRight: `calc(50% - ${CHIP_W / 2}px)`,
          } as React.CSSProperties}
        >
          {stripDates.map((date, idx) => {
            const info = getDayInfo(date);
            const isSelected = date === selectedDate;
            const isT = date === todayStr;
            const isFut = date > todayStr;
            const d = new Date(date + "T12:00:00");
            const dayNum = d.getDate();
            const dayAbbr = DAY_ABBR[d.getDay()];
            const col = info.phase ? RING_COLOR[info.phase] : "rgba(128,128,128,0.3)";

            return (
              <button
                key={date}
                onClick={() => selectAndScroll(date, idx)}
                style={{
                  width: CHIP_W,
                  flexShrink: 0,
                  scrollSnapAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingTop: 10,
                  paddingBottom: 10,
                  borderRadius: 16,
                  background: isSelected ? col : "transparent",
                  opacity: isFut ? 0.5 : 1,
                  transition: "background 0.15s, transform 0.1s",
                  transform: isSelected ? "scale(1.08)" : "scale(1)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: isSelected ? "rgba(255,255,255,0.8)" : "var(--text-dim)",
                }}>{dayAbbr}</span>
                <span style={{
                  fontSize: isSelected ? 19 : 15,
                  fontWeight: isSelected ? 900 : 600,
                  lineHeight: 1,
                  color: isSelected ? "#fff" : isT ? col : "var(--text-main)",
                }}>{dayNum}</span>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: isSelected
                    ? "rgba(255,255,255,0.65)"
                    : info.phase ? col : "transparent",
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Back to today pill — appears when strip is scrolled away from today ── */}
      {!isToday && (
        <div className="flex justify-center mb-2">
          <button
            onClick={() => selectAndScroll(todayStr, BACK_DAYS)}
            className="px-4 py-1.5 rounded-full text-xs font-bold transition active:scale-95"
            style={{ background: "rgba(var(--glow-rgb),0.15)", color: "var(--accent)", border: "1px solid rgba(var(--glow-rgb),0.3)" }}
          >
            ← Back to today
          </button>
        </div>
      )}

      {/* ── Cycle ring ── */}
      <div className="flex items-center justify-center mb-4">
        <CycleRingInline
          cycleLength={settings.cycleLength ?? 28}
          periodLength={settings.periodLength ?? 5}
          fertileStart={cycleInfo.fertileStartCycleDay}
          fertileEnd={cycleInfo.fertileEndCycleDay}
          selectedCycleDay={selectedInfo.cycleDay}
          selectedPhase={selectedInfo.phase}
          selectedDate={selectedDate}
          isFuture={isFuture}
        />
      </div>

      {/* ── Log today button (only on today) ── */}
      {isToday && (
        <button
          onClick={() => onShowLog(true)}
          className="w-full mb-4 py-3 rounded-2xl text-sm font-bold transition active:scale-95"
          style={{
            background: todayLog ? "rgba(244,63,94,0.1)" : "#f43f5e",
            color: todayLog ? "#f43f5e" : "#fff",
            border: todayLog ? "1px solid rgba(244,63,94,0.3)" : "none",
          }}
        >
          {todayLog ? "✏️ Edit today's log" : "🌸 Log today's symptoms & flow"}
        </button>
      )}

      {/* ── Log period button — always visible, opens full calendar for past period logging ── */}
      <button
        onClick={() => navigate("/womens-health/calendar")}
        className="w-full mb-4 py-3 rounded-2xl text-sm font-bold transition active:scale-95"
        style={{
          background: "rgba(244,63,94,0.08)",
          color: "#f43f5e",
          border: "1.5px solid rgba(244,63,94,0.25)",
        }}
      >
        📅 Log period
      </button>

      {/* ── Day detail ── */}
      <DayDetailInline
        date={selectedDate}
        apiDay={selectedApiDay}
        phase={selectedInfo.phase}
        cycleDay={selectedInfo.cycleDay}
        isFuture={isFuture}
        isToday={isToday}
        onLogToday={() => onShowLog(true)}
      />

      {/* ── Phase legend ── */}
      <div className="bg-card border border-border rounded-2xl p-4 mt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cycle phases</p>
        <div className="grid grid-cols-2 gap-2">
          {(["menstruation", "follicular", "fertile", "luteal"] as const).map((p) => (
            <div key={p} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: RING_COLOR[p] }} />
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

// ── Cycle ring SVG (inline, Flo-style) ────────────────────────────────────────

function CycleRingInline({
  cycleLength, periodLength, fertileStart, fertileEnd,
  selectedCycleDay, selectedPhase, selectedDate, isFuture,
}: {
  cycleLength: number; periodLength: number;
  fertileStart: number; fertileEnd: number;
  selectedCycleDay: number | null; selectedPhase: Phase | null;
  selectedDate: string; isFuture: boolean;
}) {
  const SIZE = 220;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R  = 88;
  const SW = 16;
  const GAP = 2.5;

  function dayToDeg(day: number) { return (day / cycleLength) * 360; }

  const phases: { phase: Phase; start: number; end: number }[] = [
    { phase: "menstruation", start: 0,               end: periodLength },
    { phase: "follicular",   start: periodLength,     end: fertileStart - 1 },
    { phase: "fertile",      start: fertileStart - 1, end: fertileEnd },
    { phase: "luteal",       start: fertileEnd,        end: cycleLength },
  ];

  const dotCd  = selectedCycleDay ?? 1;
  const dotDeg = dayToDeg(dotCd - 0.5);
  const dot    = polarXY(cx, cy, R, dotDeg);

  const d    = new Date(selectedDate + "T12:00:00");
  const dayN = d.getDate();
  const monN = d.toLocaleDateString("en-NG", { month: "short" });
  const col  = selectedPhase ? RING_COLOR[selectedPhase] : "#6b7280";

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: "visible" }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />

      {phases.map(({ phase, start, end }) => {
        const sd = dayToDeg(start) + GAP / 2;
        const ed = dayToDeg(end)   - GAP / 2;
        const p  = svgArcPath(cx, cy, R, sd, ed);
        if (!p) return null;
        return (
          <path key={phase} d={p} fill="none"
            stroke={RING_COLOR[phase]} strokeWidth={SW} strokeLinecap="round" opacity={0.92} />
        );
      })}

      <circle cx={dot.x} cy={dot.y} r={13} fill={col} opacity={0.25} />
      <circle cx={dot.x} cy={dot.y} r={9} fill="white" style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
      <circle cx={dot.x} cy={dot.y} r={5.5} fill={col} />

      <text x={cx} y={cy - 14} textAnchor="middle" fontSize="38" fontWeight="900"
        fill="white" fontFamily="inherit">{dayN}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="13"
        fill="rgba(255,255,255,0.5)" fontFamily="inherit">{monN}</text>
      {selectedPhase && (
        <text x={cx} y={cy + 27} textAnchor="middle" fontSize="12" fontWeight="700"
          fill={col} fontFamily="inherit">
          {isFuture ? "↗ " : ""}{PHASE_META[selectedPhase].label}
        </text>
      )}
      {selectedCycleDay && (
        <text x={cx} y={cy + 44} textAnchor="middle" fontSize="10"
          fill="rgba(255,255,255,0.35)" fontFamily="inherit">
          Day {selectedCycleDay} of {cycleLength}
        </text>
      )}
    </svg>
  );
}

// ── Day detail panel (inline) ─────────────────────────────────────────────────

function DayDetailInline({
  date, apiDay, phase, cycleDay, isFuture, isToday, onLogToday,
}: {
  date: string;
  apiDay: CalendarDay | null;
  phase: Phase | null;
  cycleDay: number | null;
  isFuture: boolean;
  isToday: boolean;
  onLogToday: () => void;
}) {
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });
  const col = phase ? RING_COLOR[phase] : "#6b7280";
  const log = apiDay?.log ?? null;
  const hasLog = !!(log?.flow || (log?.symptoms?.length ?? 0) > 0 || log?.notes);

  const PHASE_EMOJI: Record<Phase, string> = {
    menstruation: "🩸", follicular: "🌸", fertile: "✨", luteal: "🌙",
  };

  return (
    <div>
      <p className="text-sm font-bold mb-3" style={{ color: "var(--text-main)" }}>{dateLabel}</p>

      {phase && (
        <div className="rounded-2xl p-4 mb-3 flex items-center gap-3"
          style={{ background: `${col}18`, border: `1px solid ${col}35` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: col }}>
            {PHASE_EMOJI[phase]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: col }}>
              {PHASE_META[phase].label}{cycleDay ? ` · Day ${cycleDay}` : ""}
            </p>
            <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-sub)" }}>
              {isFuture ? "Predicted — based on your cycle pattern" : PHASE_META[phase].description}
            </p>
          </div>
        </div>
      )}

      {!isFuture ? (
        hasLog ? (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {log?.flow && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>Flow</span>
                <span className="text-xs font-bold capitalize" style={{ color: "var(--text-main)" }}>{log.flow}</span>
                <div className="flex gap-0.5 ml-1">
                  {Array.from({ length: FLOW_META[log.flow as Flow].dots }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  ))}
                </div>
              </div>
            )}
            {(log?.symptoms?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {log!.symptoms.map((s) => (
                  <span key={s} className="text-[11px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-main)" }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            {log?.notes && (
              <p className="text-xs italic" style={{ color: "var(--text-sub)" }}>"{log.notes}"</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-4 text-center"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-sm" style={{ color: "var(--text-sub)" }}>
              {isToday ? "Nothing logged yet today." : "Nothing logged this day."}
            </p>
            {isToday && (
              <button onClick={onLogToday} className="mt-2 text-xs font-bold active:opacity-70"
                style={{ color: "#f43f5e" }}>
                Log today →
              </button>
            )}
          </div>
        )
      ) : (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>
            Future prediction. Check back when you get here.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

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
  return <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}><div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
}
