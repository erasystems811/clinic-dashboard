import { useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useWLPlan, useWLGeneratePlan, useWLToday, type WLDayPlan } from "@/lib/weightloss-api";
import { useWLTheme } from "@/lib/section-theme";
import { cn } from "@/lib/utils";

const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

export default function WLPlanPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"today" | "week">("today");
  const [weekStart, setWeekStart] = useState(isoWeekStart());
  useWLTheme();

  const { data, isLoading } = useWLPlan(weekStart);
  const { data: todayData } = useWLToday();
  const generatePlan = useWLGeneratePlan();

  const todayStr = new Date().toISOString().split("T")[0];
  const todayPlan = data?.plan?.days.find((d) => d.date === todayStr) ?? null;

  function prevWeek() {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  }

  function nextWeek() {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split("T")[0]);
  }

  return (
    <div className="px-5 pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate("/weightloss")} className="flex items-center gap-1.5 -ml-1" style={{ color: "var(--text-sub)" }}>
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <button
          onClick={() => generatePlan.mutate(weekStart)}
          disabled={generatePlan.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition active:scale-95"
          style={{ background: "rgba(var(--glow-rgb),0.09)", color: "var(--accent)", border: "1px solid rgba(var(--glow-rgb),0.19)" }}>
          <RefreshCw className={cn("w-3.5 h-3.5", generatePlan.isPending && "animate-spin")} />
          {generatePlan.isPending ? "Generating…" : "New plan"}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: "var(--glass-bg)" }}>
        <TabBtn active={tab === "today"} onClick={() => setTab("today")}>Today</TabBtn>
        <TabBtn active={tab === "week"} onClick={() => setTab("week")}>Full Week</TabBtn>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.plan ? (
        <div className="text-center py-16">
          <p style={{ fontSize: 48 }}>📋</p>
          <p className="text-base font-bold mt-3" style={{ color: "var(--text-main)" }}>No plan yet</p>
          <p className="text-sm mt-1 mb-5" style={{ color: "var(--text-sub)" }}>Generate your first weekly plan</p>
          <button
            onClick={() => generatePlan.mutate(weekStart)}
            disabled={generatePlan.isPending}
            className="px-6 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: "var(--accent)" }}>
            {generatePlan.isPending ? "Generating…" : "Generate plan"}
          </button>
        </div>
      ) : tab === "today" ? (
        todayPlan ? (
          <DayDetail day={todayPlan} loggedMeals={(todayData?.log?.meals_logged as unknown as Array<{ planned_meal_id: string | null }> | undefined) ?? []} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No plan entry for today.</p>
          </div>
        )
      ) : (
        <WeekView
          plan={data.plan.days}
          weekStart={weekStart}
          onPrev={prevWeek}
          onNext={nextWeek}
          generatedAt={data.generatedAt}
        />
      )}
    </div>
  );
}

function WeekView({ plan, weekStart, onPrev, onNext, generatedAt }: {
  plan: WLDayPlan[];
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
  generatedAt: string | null;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const selectedDay = plan.find((d) => d.date === selectedDate) ?? plan[0];

  const weekLabel = (() => {
    const d = new Date(weekStart + "T12:00:00");
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`;
  })();

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button onClick={onPrev} className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{weekLabel}</p>
          {generatedAt && (
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              Generated {new Date(generatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
            </p>
          )}
        </div>
        <button onClick={onNext} className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
          ›
        </button>
      </div>

      {/* Day strip */}
      <div className="flex gap-1">
        {plan.map((day) => {
          const d = new Date(day.date + "T12:00:00");
          const isSelected = day.date === selectedDate;
          const isToday = day.date === new Date().toISOString().split("T")[0];
          return (
            <button key={day.date} onClick={() => setSelectedDate(day.date)}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition active:scale-90"
              style={{
                background: isSelected ? "var(--accent)" : "var(--glass-bg)",
                border: `1.5px solid ${isSelected ? "var(--accent)" : isToday ? "rgba(var(--glow-rgb),0.31)" : "var(--glass-border)"}`,
              }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.7)" : "var(--text-dim)" }}>
                {DAY_ABBR[d.getDay()]}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: isSelected ? "#fff" : "var(--text-main)" }}>
                {d.getDate()}
              </span>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: day.workout.isRestDay ? "var(--text-dim)" : "var(--accent)", opacity: isSelected ? 0.7 : 1 }} />
            </button>
          );
        })}
      </div>

      {selectedDay && <DayDetail day={selectedDay} loggedMeals={[]} />}
    </div>
  );
}

function DayDetail({ day, loggedMeals }: {
  day: WLDayPlan;
  loggedMeals: Array<{ planned_meal_id: string | null }>;
}) {
  const loggedIds = new Set(loggedMeals.map((m) => m.planned_meal_id).filter(Boolean));

  return (
    <div className="space-y-4">
      {day.fastingWindow && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
          style={{ background: "rgba(var(--glow-rgb),0.06)", border: "1px solid rgba(var(--glow-rgb),0.15)" }}>
          <span>⏰</span>
          <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            Eating window: {day.fastingWindow.start} — {day.fastingWindow.end}
          </p>
        </div>
      )}

      {/* Meals */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Meals</p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>{day.totalCalories} kcal total</p>
        </div>
        <div className="space-y-2">
          {day.meals.map((meal) => {
            const logged = loggedIds.has(meal.id);
            return (
              <div key={meal.id} className="rounded-2xl p-4"
                style={{
                  background: "var(--glass-bg)",
                  border: `1px solid ${logged ? "rgba(var(--glow-rgb),0.25)" : "var(--glass-border)"}`,
                  opacity: logged ? 0.75 : 1,
                }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mb-1"
                      style={{ background: "rgba(var(--glow-rgb),0.09)", color: "var(--accent)" }}>
                      {meal.slot} · {meal.time}
                    </span>
                    <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{meal.name}</p>
                    {meal.description && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-sub)" }}>{meal.description}</p>
                    )}
                    <p className="text-xs mt-1 font-semibold" style={{ color: "var(--accent)" }}>{meal.calories} kcal</p>
                  </div>
                  {logged && <span className="text-base shrink-0">✅</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workout */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>Workout</p>
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {day.workout.isRestDay ? (
            <p className="text-sm font-bold text-center" style={{ color: "var(--text-sub)" }}>😴 Rest Day</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{day.workout.name}</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(var(--glow-rgb),0.09)", color: "var(--accent)" }}>
                  {day.workout.duration_mins} min
                </span>
              </div>
              {day.workout.exercises.map((ex, i) => (
                <div key={i} className="flex justify-between py-1"
                  style={{ borderTop: i > 0 ? "1px solid var(--glass-border)" : undefined }}>
                  <p className="text-xs font-medium" style={{ color: "var(--text-main)" }}>{ex.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {ex.sets ? `${ex.sets} × ${ex.reps}` : ex.reps}
                  </p>
                </div>
              ))}
              {day.workout.notes && (
                <p className="text-xs mt-2 italic" style={{ color: "var(--text-dim)" }}>{day.workout.notes}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition")}
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-sub)",
      }}>
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--accent) transparent transparent transparent" }} />
    </div>
  );
}
