import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useWomensHealthCalendar, useLogCycleDay, PHASE_META, FLOW_META, type Flow, type CalendarDay } from "@/lib/womens-health-api";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

const PHASE_CELL_COLORS: Record<string, string> = {
  menstruation: "bg-rose-100 dark:bg-rose-900/40",
  follicular:   "bg-purple-100 dark:bg-purple-900/40",
  fertile:      "bg-teal-100 dark:bg-teal-900/40",
  luteal:       "bg-amber-100 dark:bg-amber-900/40",
};

export default function CycleCalendarPage() {
  const [, navigate] = useLocation();
  const todayStr = new Date().toISOString().split("T")[0];
  const [month, setMonth] = useState(todayStr.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showLogFor, setShowLogFor] = useState<string | null>(null);

  const { data, isLoading } = useWomensHealthCalendar(month);
  const logDay = useLogCycleDay();

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const days = data?.days ?? [];

  // Build grid — pad start with empty cells
  const firstDayOfWeek = days.length > 0 ? new Date(days[0].date + "T12:00:00").getDay() : 0;
  const cells: (CalendarDay | null)[] = [...Array(firstDayOfWeek).fill(null), ...days];

  function handleDayClick(day: CalendarDay) {
    setSelectedDay((prev) => prev?.date === day.date ? null : day);
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/womens-health")} className="flex items-center gap-1.5 text-muted-foreground mb-5 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setMonth(prevMonth(month))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center transition active:scale-90">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground">{monthLabel(month)}</h2>
        <button onClick={() => setMonth(nextMonth(month))} disabled={month >= todayStr.slice(0, 7)}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center transition active:scale-90 disabled:opacity-40">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dayNum = parseInt(day.date.slice(8), 10);
          const isToday = day.date === todayStr;
          const isSelected = selectedDay?.date === day.date;
          const isFuture = day.date > todayStr;
          const phaseBg = day.phase && !isFuture ? PHASE_CELL_COLORS[day.phase] : "";

          return (
            <button key={day.date} onClick={() => !isFuture && handleDayClick(day)} disabled={isFuture}
              className={cn("relative flex flex-col items-center py-1.5 rounded-xl transition",
                phaseBg,
                isSelected && "ring-2 ring-rose-500",
                isToday && "ring-2 ring-rose-500",
                isFuture && "opacity-40 cursor-default")}>
              <span className={cn("text-xs font-semibold", isToday ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                {dayNum}
              </span>
              {/* Flow dot */}
              {day.log?.flow && (
                <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", FLOW_META[day.log.flow as Flow].color)} />
              )}
              {/* Symptom indicator */}
              {!day.log?.flow && day.log && day.log.symptoms.length > 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-0.5" />
              )}
              {/* Ovulation marker */}
              {day.isOvulationDay && !isFuture && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-teal-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-5 mb-4">
        {(["menstruation", "follicular", "fertile", "luteal"] as const).map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-sm", PHASE_CELL_COLORS[p])} />
            <span className="text-xs text-muted-foreground">{PHASE_META[p].label}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="bg-card border border-border rounded-2xl p-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">
              {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}
            </p>
            {selectedDay.cycleDay && (
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                selectedDay.phase ? `${PHASE_META[selectedDay.phase].bg} ${PHASE_META[selectedDay.phase].color}` : "bg-muted text-muted-foreground")}>
                Day {selectedDay.cycleDay}
              </span>
            )}
          </div>

          {selectedDay.log ? (
            <div className="space-y-2">
              {selectedDay.log.flow && (
                <p className="text-sm text-foreground">Flow: <span className="font-semibold capitalize">{selectedDay.log.flow}</span></p>
          )}
              {selectedDay.log.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDay.log.symptoms.map((s) => (
                    <span key={s} className="text-[11px] bg-muted text-foreground px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {selectedDay.log.notes && <p className="text-xs text-muted-foreground italic">"{selectedDay.log.notes}"</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Nothing logged this day.</p>
              {selectedDay.date === todayStr && (
                <button onClick={() => navigate("/womens-health")} className="text-xs font-semibold text-rose-500">Log now →</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
