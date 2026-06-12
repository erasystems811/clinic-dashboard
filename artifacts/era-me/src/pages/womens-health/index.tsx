import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, Calendar, History } from "lucide-react";
import { useWomensHealthToday, useSetupWomensHealth, useLogCycleDay, PHASE_META, FLOW_META, type Flow } from "@/lib/womens-health-api";
import { cn } from "@/lib/utils";

// ── Entry — gate between setup and dashboard ──────────────────────────────────
export default function WomensHealthPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useWomensHealthToday();

  if (isLoading) return <Spinner />;

  if (!data?.isSetUp) return <SetupScreen onBack={() => navigate("/profile")} />;
  return <Dashboard onBack={() => navigate("/profile")} />;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function SetupScreen({ onBack }: { onBack: () => void }) {
  const setup = useSetupWomensHealth();
  const [step, setStep] = useState<"intro" | "settings">("intro");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [lastPeriodStart, setLastPeriodStart] = useState("");

  function handleSave() {
    if (!lastPeriodStart) return;
    setup.mutate({ cycleLength, periodLength, lastPeriodStart });
  }

  if (step === "intro") {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🌸</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Women's Health</h1>
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
        <button onClick={() => setStep("settings")}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95">
          Get started
        </button>
        <button onClick={onBack} className="w-full mt-3 text-sm text-muted-foreground">Maybe later</button>
      </div>
    );
  }

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

      <button onClick={handleSave} disabled={!lastPeriodStart || setup.isPending}
        className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {setup.isPending ? "Saving…" : "Start tracking"}
      </button>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ onBack }: { onBack: () => void }) {
  const [, navigate] = useLocation();
  const { data } = useWomensHealthToday();
  const logDay = useLogCycleDay();
  const [showLog, setShowLog] = useState(false);

  if (!data?.isSetUp || !data.settings) return null;

  const { cycleInfo, todayLog, settings } = data;
  const today = data.today!;

  if (showLog) {
    return (
      <LogForm
        date={today}
        existing={todayLog ?? null}
        cycleInfo={cycleInfo ?? null}
        onSave={(payload) => { logDay.mutate(payload, { onSuccess: () => setShowLog(false) }); }}
        onBack={() => setShowLog(false)}
        isPending={logDay.isPending}
      />
    );
  }

  if (!cycleInfo) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="font-semibold text-foreground mb-1">No period start date recorded</p>
          <p className="text-sm text-muted-foreground">Log when your last period started to unlock predictions.</p>
          <button onClick={() => setShowLog(true)} className="mt-4 px-5 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold transition active:scale-95">
            Log today as period start
          </button>
        </div>
      </div>
    );
  }

  const meta = PHASE_META[cycleInfo.phase];
  const progress = cycleInfo.cycleDay / settings.cycleLength;
  const radius = 90;
  const circ = 2 * Math.PI * radius;

  // Phase arc segments
  const phases = [
    { phase: "menstruation" as const, start: 0, end: settings.periodLength },
    { phase: "follicular" as const, start: settings.periodLength, end: cycleInfo.fertileStartCycleDay - 1 },
    { phase: "fertile" as const, start: cycleInfo.fertileStartCycleDay - 1, end: cycleInfo.fertileEndCycleDay },
    { phase: "luteal" as const, start: cycleInfo.fertileEndCycleDay, end: settings.cycleLength },
  ].filter((s) => s.end > s.start);

  const STROKE_COLORS: Record<string, string> = {
    menstruation: "#f43f5e",
    follicular: "#a855f7",
    fertile: "#14b8a6",
    luteal: "#f59e0b",
  };

  function arcPath(startDay: number, endDay: number, r: number, cx: number, cy: number) {
    const startAngle = (startDay / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
    const endAngle   = (endDay   / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = (endDay - startDay) / settings.cycleLength > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const dotAngle = (cycleInfo.cycleDay / settings.cycleLength) * 2 * Math.PI - Math.PI / 2;
  const dotX = 110 + radius * Math.cos(dotAngle);
  const dotY = 110 + radius * Math.sin(dotAngle);

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate("/womens-health/calendar")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/womens-health/history")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <History className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Cycle ring */}
      <div className="flex flex-col items-center mb-6">
        <svg width="220" height="220" viewBox="0 0 220 220">
          {/* Background track */}
          <circle cx="110" cy="110" r={radius} fill="none" strokeWidth="16" className="stroke-muted" />
          {/* Phase arcs */}
          {phases.map((seg) => (
            <path key={seg.phase} d={arcPath(seg.start, seg.end, radius, 110, 110)}
              fill="none" strokeWidth="16" strokeLinecap="round"
              stroke={STROKE_COLORS[seg.phase]} opacity="0.3" />
          ))}
          {/* Progress arc */}
          {phases.map((seg) => {
            const visEnd = Math.min(seg.end, cycleInfo.cycleDay);
            if (visEnd <= seg.start) return null;
            return (
              <path key={`p-${seg.phase}`} d={arcPath(seg.start, visEnd, radius, 110, 110)}
                fill="none" strokeWidth="16" strokeLinecap="round"
                stroke={STROKE_COLORS[seg.phase]} />
            );
          })}
          {/* Today dot */}
          <circle cx={dotX} cy={dotY} r="8" className="fill-background" />
          <circle cx={dotX} cy={dotY} r="5" fill={STROKE_COLORS[cycleInfo.phase]} />
          {/* Center text */}
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
          value={cycleInfo.isPeriodDay ? `Day ${cycleInfo.cycleDay}` : cycleInfo.daysUntilNextPeriod === 0 ? "Today" : `In ${cycleInfo.daysUntilNextPeriod} day${cycleInfo.daysUntilNextPeriod !== 1 ? "s" : ""}`}
        />
        <StatusCard
          emoji={cycleInfo.isFertileDay ? "✨" : "🌱"}
          label={cycleInfo.isFertileDay ? "Fertile window" : "Fertile window"}
          value={cycleInfo.isFertileDay ? "Active now" : `Day ${cycleInfo.fertileStartCycleDay}–${cycleInfo.fertileEndCycleDay}`}
          highlight={cycleInfo.isFertileDay}
        />
      </div>

      {/* Today's log */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's log</p>
          <button onClick={() => setShowLog(true)} className="text-xs font-semibold text-rose-500 transition active:scale-95">
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
          <button onClick={() => setShowLog(true)}
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
    </div>
  );
}

// ── Log form (inline) ─────────────────────────────────────────────────────────
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

  function toggleSymptom(s: string) {
    setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
      </button>
      <h2 className="text-xl font-bold text-foreground mb-1">Log today</h2>
      <p className="text-sm text-muted-foreground mb-5">{new Date(date + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}</p>

      {/* Period start toggle */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Period started today</p>
          <p className="text-xs text-muted-foreground mt-0.5">Updates your cycle predictions</p>
        </div>
        <button onClick={() => setIsPeriodStart((p) => !p)}
          className={cn("w-12 h-6 rounded-full transition relative", isPeriodStart ? "bg-rose-500" : "bg-muted")}>
          <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", isPeriodStart ? "left-6" : "left-0.5")} />
        </button>
      </div>

      {/* Flow */}
      <div className="mb-4">
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

      {/* Symptoms */}
      <div className="mb-4">
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

      {/* Notes */}
      <div className="mb-6">
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

// ── Shared small components ───────────────────────────────────────────────────
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
