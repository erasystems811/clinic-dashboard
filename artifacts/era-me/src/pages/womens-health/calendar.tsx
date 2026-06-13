import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useWomensHealthCalendar, useLogCycleDay, FLOW_META,
  type Flow, type CalendarDay,
} from "@/lib/womens-health-api";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getMonthMeta(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  return { year: y, month: m, firstDow, daysInMonth };
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function offsetMonth(base: string, delta: number): string {
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

interface LogSheet {
  date: string;
  existing: CalendarDay | null;
}

export default function CycleCalendarPage() {
  const today = todayStr();
  const [monthKey, setMonthKey] = useState(() => today.slice(0, 7));
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null);
  const { data, isLoading } = useWomensHealthCalendar(monthKey);
  const logCycle = useLogCycleDay();

  const { year, month, firstDow, daysInMonth } = getMonthMeta(monthKey);
  const dayMap = new Map<string, CalendarDay>((data?.days ?? []).map((d) => [d.date, d]));

  function cellDate(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handleCellTap(day: number) {
    const date = cellDate(day);
    if (date > today) return;
    const existing = dayMap.get(date) ?? null;
    setLogSheet({ date, existing });
  }

  const canGoPrev = monthKey > "2020-01";
  const canGoNext = monthKey < today.slice(0, 7);

  return (
    <div className="pb-10" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 pt-6 pb-4"
        style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1.5 active:opacity-70 transition"
            style={{ color: "var(--text-sub)" }}>
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <p className="text-sm font-semibold" style={{ color: "var(--text-sub)" }}>
            Log past periods
          </p>
          <div className="w-16" />
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => canGoPrev && setMonthKey(offsetMonth(monthKey, -1))}
            disabled={!canGoPrev}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: "var(--glass-bg)" }}>
            <ChevronLeft className="w-5 h-5" style={{ color: "var(--text-main)" }} />
          </button>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            {monthLabel(monthKey)}
          </h2>
          <button
            onClick={() => canGoNext && setMonthKey(offsetMonth(monthKey, 1))}
            disabled={!canGoNext}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30"
            style={{ background: "var(--glass-bg)" }}>
            <ChevronRight className="w-5 h-5" style={{ color: "var(--text-main)" }} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="px-4 pt-4">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div key={d} className="text-center py-1">
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)" }}>{d}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const date = cellDate(day);
              const isFuture = date > today;
              const isToday = date === today;
              const cal = dayMap.get(date);
              const hasPeriod = cal?.isPeriodDay ?? false;
              const isPeriodStart = cal?.log?.isPeriodStart ?? false;
              const hasLog = !!cal?.log;

              return (
                <button
                  key={day}
                  onClick={() => handleCellTap(day)}
                  disabled={isFuture}
                  className="relative flex flex-col items-center justify-center rounded-xl transition active:scale-90 disabled:opacity-30"
                  style={{
                    height: 52,
                    background: isPeriodStart
                      ? "rgba(244,63,94,0.85)"
                      : hasPeriod
                        ? "rgba(244,63,94,0.35)"
                        : isToday
                          ? "rgba(var(--glow-rgb),0.12)"
                          : "transparent",
                    border: isToday && !hasPeriod
                      ? "1.5px solid rgba(var(--glow-rgb),0.4)"
                      : "1.5px solid transparent",
                  }}
                >
                  <span style={{
                    fontSize: 15,
                    fontWeight: isPeriodStart || isToday ? 800 : 500,
                    color: isPeriodStart
                      ? "#fff"
                      : hasPeriod
                        ? "#f43f5e"
                        : isToday
                          ? "var(--accent)"
                          : "var(--text-main)",
                  }}>{day}</span>
                  {hasLog && !hasPeriod && (
                    <div className="w-1.5 h-1.5 rounded-full mt-0.5"
                      style={{ background: "var(--accent)" }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          {[
            { color: "rgba(244,63,94,0.85)", label: "Period start" },
            { color: "rgba(244,63,94,0.35)", label: "Period day" },
            { color: "rgba(var(--glow-rgb),0.12)", label: "Today" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-md" style={{ background: color }} />
              <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{label}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Tap any past date to log a period. Logging past periods helps the app make more accurate predictions.
        </p>
      </div>

      {/* Log bottom sheet */}
      {logSheet && (
        <LogSheet
          date={logSheet.date}
          existing={logSheet.existing}
          isPending={logCycle.isPending}
          onClose={() => { setLogSheet(null); logCycle.reset(); }}
          onSave={(flow) => {
            logCycle.mutate(
              { date: logSheet.date, flow, isPeriodStart: true },
              { onSuccess: () => setLogSheet(null) },
            );
          }}
        />
      )}
    </div>
  );
}

function LogSheet({ date, existing, isPending, onClose, onSave }: {
  date: string;
  existing: CalendarDay | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (flow: Flow) => void;
}) {
  const [flow, setFlow] = useState<Flow>(
    (existing?.log?.flow as Flow | null) ?? "medium",
  );

  const d = new Date(date + "T12:00:00");
  const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 rounded-t-3xl px-5 pt-5 pb-10"
        style={{ background: "var(--bg-mid)", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: "var(--text-main)" }}>
            Log period start
          </h3>
          <button onClick={onClose} className="active:scale-90 transition">
            <X className="w-5 h-5" style={{ color: "var(--text-sub)" }} />
          </button>
        </div>

        <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>{label}</p>

        <p className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--text-dim)" }}>Flow intensity</p>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {(Object.entries(FLOW_META) as [Flow, typeof FLOW_META[Flow]][]).map(([k, meta]) => (
            <button
              key={k}
              onClick={() => setFlow(k)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl transition active:scale-95"
              style={{
                background: flow === k ? "rgba(244,63,94,0.15)" : "var(--glass-bg)",
                border: flow === k ? "1.5px solid rgba(244,63,94,0.5)" : "1.5px solid var(--glass-border)",
              }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: meta.dots }).map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${meta.color}`} />
                ))}
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: flow === k ? "#f43f5e" : "var(--text-main)",
              }}>{meta.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onSave(flow)}
          disabled={isPending}
          className="w-full py-4 rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "#fff" }}
        >
          {isPending ? "Saving…" : "Log period start"}
        </button>
      </div>
    </>
  );
}
