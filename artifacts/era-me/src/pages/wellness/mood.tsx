import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const MOOD_OPTIONS = [
  { value: 1, emoji: "😢", label: "Very sad" },
  { value: 2, emoji: "😔", label: "Down" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const ENERGY_OPTIONS = [
  { value: 1, emoji: "🪫", label: "Drained" },
  { value: 2, emoji: "😴", label: "Tired" },
  { value: 3, emoji: "😐", label: "OK" },
  { value: 4, emoji: "⚡", label: "Energised" },
  { value: 5, emoji: "🚀", label: "Fired up" },
];

const STRESS_OPTIONS = [
  { value: 1, emoji: "😌", label: "Calm" },
  { value: 2, emoji: "🙂", label: "Low" },
  { value: 3, emoji: "😐", label: "Moderate" },
  { value: 4, emoji: "😬", label: "High" },
  { value: 5, emoji: "😰", label: "Very high" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MoodPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: {
      modules: {
        mood_check: {
          enabled: boolean;
          log: { mood?: number; energy?: number; stress?: number } | null;
        };
      };
    } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("mood_check");
  const { data: streakData } = useWellnessStreak("mood_check");
  const saveModule = useSaveModule("mood_check");
  const logToday = useLogToday("mood_check");

  const module = today?.modules.mood_check;
  const enabled = module?.enabled ?? false;
  const log = module?.log;
  const streak = streakData?.streak ?? 0;

  const [mood, setMood] = useState(log?.mood ?? 0);
  const [energy, setEnergy] = useState(log?.energy ?? 0);
  const [stress, setStress] = useState(log?.stress ?? 0);
  const [saved, setSaved] = useState(!!(log?.mood && log?.energy && log?.stress));

  useEffect(() => {
    if (log) {
      setMood(log.mood ?? 0);
      setEnergy(log.energy ?? 0);
      setStress(log.stress ?? 0);
      setSaved(!!(log.mood && log.energy && log.stress));
    }
  }, [log]);

  function enable() {
    saveModule.mutate({ settings: {}, enabled: true });
  }

  function saveLog() {
    if (!mood || !energy || !stress) return;
    logToday.mutate({ mood, energy, stress }, {
      onSuccess: () => setSaved(true),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-2xl">😊</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Daily Check-in</h1>
            <p className="text-sm text-muted-foreground">Mood, energy & stress</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-6">
          <p className="text-4xl mb-3">😊⚡🧘</p>
          <p className="font-semibold text-foreground mb-1">Track how you feel daily</p>
          <p className="text-sm text-muted-foreground">
            A quick daily check-in on your mood, energy, and stress level. Takes 10 seconds.
          </p>
        </div>

        <button onClick={enable} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Enabling…" : "Enable daily check-in"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">😊</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Daily Check-in</h1>
            <p className="text-xs text-muted-foreground">Mood · Energy · Stress</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Today check-in */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {saved ? "Today (logged)" : "How are you today?"}
        </p>

        <ScaleRow label="Mood 😊" options={MOOD_OPTIONS} value={mood} onChange={setMood} />
        <div className="my-4 h-px bg-border" />
        <ScaleRow label="Energy ⚡" options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
        <div className="my-4 h-px bg-border" />
        <ScaleRow label="Stress 🧘" options={STRESS_OPTIONS} value={stress} onChange={setStress} />

        <button onClick={saveLog}
          disabled={!mood || !energy || !stress || logToday.isPending}
          className={cn(
            "w-full mt-5 py-3 rounded-xl font-semibold text-sm transition active:scale-95 disabled:opacity-60",
            saved ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-primary text-primary-foreground"
          )}>
          {logToday.isPending ? "Saving…" : saved ? "Update check-in ✓" : "Save check-in"}
        </button>
      </div>

      {/* This week */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const logEntry = weekLogs?.find((l) => l.log_date === dateStr);
            const m = logEntry?.data.mood as number | undefined;
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  isToday ? "ring-2 ring-primary" : "",
                  m ? "bg-primary/20" : "bg-muted"
                )}>
                  <span className="text-base">{m ? MOOD_OPTIONS[m - 1].emoji : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScaleRow({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: number; emoji: string; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition",
              value === o.value ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
            )}>
            <span className="text-xl">{o.emoji}</span>
            <span className="text-[9px] text-muted-foreground leading-tight text-center">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
