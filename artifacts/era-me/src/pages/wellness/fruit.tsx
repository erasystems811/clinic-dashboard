import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessWeek, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FruitPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: {
      modules: {
        fruit: {
          enabled: boolean;
          settings: { reminderTime?: string; notes?: string };
          log: { done?: boolean } | null;
        };
      };
    } | undefined;
    isLoading: boolean;
  };
  const { data: weekLogs } = useWellnessWeek("fruit");
  const { data: streakData } = useWellnessStreak("fruit");
  const saveModule = useSaveModule("fruit");
  const logToday = useLogToday("fruit");

  const module = today?.modules.fruit;
  const enabled = module?.enabled ?? false;
  const settings = module?.settings ?? {};
  const done = module?.log?.done === true;
  const streak = streakData?.streak ?? 0;

  const [setupMode, setSetupMode] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime ?? "14:00");
  const [notes, setNotes] = useState(settings.notes ?? "");

  function saveSetup() {
    saveModule.mutate({ settings: { reminderTime, notes }, enabled: true });
    setSetupMode(false);
  }

  function markDone() {
    logToday.mutate({ done: !done });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled || setupMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => (setupMode ? setSetupMode(false) : window.history.back())}
          className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{setupMode ? "Cancel" : "Back"}</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl">🍎</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Fruit Reminder</h1>
            <p className="text-sm text-muted-foreground">Daily reminder to eat fruit</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-5 overflow-hidden">
          <p className="text-sm font-semibold text-foreground mb-1">Daily reminder time</p>
          <p className="text-xs text-muted-foreground mb-4">We'll remind you to eat your fruit at this time each day.</p>
          <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
            className="w-full min-w-0 bg-muted rounded-xl px-4 py-3 text-2xl font-bold text-foreground text-center outline-none" />
        </div>

        <div className="bg-muted rounded-xl px-4 py-4 mb-5 text-center">
          <p className="text-2xl mb-2">🍎🍊🍇🍌🍓</p>
          <p className="text-sm text-muted-foreground">
            Aim for at least one portion of fresh fruit per day. You choose what counts — a banana, an orange, or a full fruit salad.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-3">Helps us tailor your weekly plan — e.g. "I like bananas and oranges", "I prefer fruit with breakfast"</p>
          <textarea value={notes} rows={3} onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that helps us plan better for you..."
            className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
        </div>

        <button onClick={saveSetup} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Enable fruit reminder"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍎</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Fruit Reminder</h1>
            <p className="text-xs text-muted-foreground">Daily at {settings.reminderTime ?? "14:00"}</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Today CTA */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col items-center">
        <div className="text-7xl mb-4">
          {done ? "✅" : "🍎"}
        </div>
        <p className="text-lg font-bold text-foreground mb-1">
          {done ? "Done! Great job 🎉" : "Have you had your fruit today?"}
        </p>
        <p className="text-sm text-muted-foreground mb-5 text-center">
          {done
            ? "You've had your fruit for today. Keep it up!"
            : "Tap below once you've eaten your fruit for the day."}
        </p>
        <button onClick={markDone} disabled={logToday.isPending}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-base transition active:scale-95 flex items-center justify-center gap-2",
            done
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          )}>
          {done && <Check className="w-5 h-5" />}
          {logToday.isPending ? "Saving…" : done ? "Mark as not done" : "I've had my fruit!"}
        </button>
      </div>

      {/* This week */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</p>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split("T")[0];
            const logEntry = weekLogs?.find((l) => l.log_date === dateStr);
            const wasDone = logEntry?.data.done === true;
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{DAY_LABELS[d.getDay()]}</span>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm",
                  isToday ? "ring-2 ring-primary" : "",
                  wasDone ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {wasDone ? "🍎" : "·"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setSetupMode(true)}
        className="w-full py-3 border border-border bg-card rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        Edit reminder time
      </button>
    </div>
  );
}
