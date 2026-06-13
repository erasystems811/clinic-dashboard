import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Settings } from "lucide-react";
import { useWomensHealthHistory, useUpdateWomensHealthSettings } from "@/lib/womens-health-api";
import { cn } from "@/lib/utils";

export default function CycleHistoryPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useWomensHealthHistory();
  const updateSettings = useUpdateWomensHealthSettings();

  const [showSettings, setShowSettings] = useState(false);
  const [cycleLength, setCycleLength] = useState(data?.settings.cycleLength ?? 28);
  const [periodLength, setPeriodLength] = useState(data?.settings.periodLength ?? 5);

  function handleSaveSettings() {
    updateSettings.mutate({ cycleLength, periodLength }, { onSuccess: () => setShowSettings(false) });
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const cycles = data?.cycles ?? [];
  const settings = data?.settings;
  const lengths = cycles.filter((c) => c.cycleLength != null).map((c) => c.cycleLength!);
  const avgLength = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : null;

  if (showSettings) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setShowSettings(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <h2 className="text-xl font-bold text-foreground mb-5">Cycle settings</h2>

        <div className="space-y-5 mb-6">
          <Stepper label="Average cycle length" value={cycleLength} min={20} max={45} onChange={setCycleLength} unit="days" />
          <Stepper label="Period length" value={periodLength} min={2} max={10} onChange={setPeriodLength} unit="days" />
        </div>

        <div className="bg-muted rounded-2xl p-4 mb-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            These are your base values. The app automatically adjusts cycle length as you log period starts over time.
            {avgLength && ` Your actual average from logged cycles is ${avgLength} days.`}
          </p>
        </div>

        <button onClick={handleSaveSettings} disabled={updateSettings.isPending}
          className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {updateSettings.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <button onClick={() => { setCycleLength(settings?.cycleLength ?? 28); setPeriodLength(settings?.periodLength ?? 5); setShowSettings(true); }}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <h1 className="text-xl font-bold text-foreground mb-5">Cycle history</h1>

      {/* Stats summary */}
      {cycles.length >= 2 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard label="Cycles tracked" value={`${cycles.length}`} />
          <StatCard label="Avg length" value={avgLength ? `${avgLength}d` : "—"} />
          <StatCard
            label="Avg period"
            value={`${Math.round(cycles.reduce((a, c) => a + c.periodDays, 0) / cycles.length)}d`}
          />
        </div>
      )}

      {cycles.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-semibold text-foreground mb-1">No cycle history yet</p>
          <p className="text-sm text-muted-foreground">Log period starts each cycle to build your history and improve predictions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle, i) => {
            const startDate = new Date(cycle.startDate + "T12:00:00");
            const dateLabel = startDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
            const isCurrentCycle = i === 0;
            return (
              <div key={cycle.startDate} className={cn("bg-card border rounded-2xl p-4", isCurrentCycle ? "border-rose-200 dark:border-rose-800" : "border-border")}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">{dateLabel}</p>
                    {isCurrentCycle && <span className="text-[10px] text-rose-500 font-semibold uppercase tracking-wider">Current cycle</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-foreground">{cycle.cycleLength ? `${cycle.cycleLength}d` : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">cycle length</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs text-muted-foreground">{cycle.periodDays} period day{cycle.periodDays !== 1 ? "s" : ""}</span>
                  </div>
                  {cycle.cycleLength && (
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2.5 h-2.5 rounded-full",
                        cycle.cycleLength < 21 ? "bg-amber-500" :
                        cycle.cycleLength > 35 ? "bg-amber-500" : "bg-green-500"
                      )} />
                      <span className="text-xs text-muted-foreground">
                        {cycle.cycleLength < 21 ? "Short cycle" : cycle.cycleLength > 35 ? "Long cycle" : "Regular cycle"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-muted rounded-2xl p-4 mt-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          💡 Cycle lengths between 21–35 days are considered normal. Variations of a few days are common. See a doctor if you consistently have cycles shorter than 21 or longer than 35 days.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange, unit }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
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
