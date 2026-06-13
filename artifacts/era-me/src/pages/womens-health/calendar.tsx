import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  useWomensHealthToday, useWomensHealthCalendar, PHASE_META, FLOW_META,
  type Phase, type Flow, type CalendarDay,
} from "@/lib/womens-health-api";

// ── Constants ──────────────────────────────────────────────────────────────────

const CHIP_W = 56;    // px width of each day chip
const BACK_DAYS = 60; // days before today in the strip
const FWD_DAYS  = 60; // days after today in the strip
const TOTAL     = BACK_DAYS + FWD_DAYS + 1;

const RING_COLOR: Record<Phase, string> = {
  menstruation: "#f43f5e",
  follicular:   "#a855f7",
  fertile:      "#14b8a6",
  luteal:       "#f59e0b",
};

const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function dateOffset(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getMonthKey(offset: number): string {
  const d = new Date();
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

// ── SVG helpers ────────────────────────────────────────────────────────────────

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.9;
  if (endDeg <= startDeg) return "";
  const s = polarXY(cx, cy, r, startDeg);
  const e = polarXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CycleCalendarPage() {
  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch today for cycleInfo (fertileStart/End cycle days)
  const { data: todayData } = useWomensHealthToday();

  // Fetch 5 months of calendar data (stable hook order)
  const { data: da } = useWomensHealthCalendar(getMonthKey(-2));
  const { data: db } = useWomensHealthCalendar(getMonthKey(-1));
  const { data: dc } = useWomensHealthCalendar(getMonthKey(0));
  const { data: dd } = useWomensHealthCalendar(getMonthKey(1));
  const { data: de } = useWomensHealthCalendar(getMonthKey(2));

  // Merge all days into a lookup map
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    [da, db, dc, dd, de].forEach((m) => m?.days.forEach((d) => map.set(d.date, d)));
    return map;
  }, [da, db, dc, dd, de]);

  const settings  = dc?.settings;            // cycle settings from current month
  const cycleInfo = todayData?.cycleInfo;    // for fertileStart/End cycle days

  // Generate the date strip
  const stripDates = useMemo(
    () => Array.from({ length: TOTAL }, (_, i) => dateOffset(todayStr, i - BACK_DAYS)),
    [todayStr]
  );
  const todayIndex = BACK_DAYS;

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const stripRef = useRef<HTMLDivElement>(null);
  const isClickScrollRef = useRef(false);

  // Scroll to today on mount
  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = todayIndex * CHIP_W;
  }, [todayIndex]);

  // Compute phase/cycleDay for any date
  function getDayInfo(date: string): { phase: Phase | null; cycleDay: number | null } {
    const api = dayMap.get(date);
    if (api?.phase) return { phase: api.phase, cycleDay: api.cycleDay };
    if (!settings?.lastPeriodStart || !settings.cycleLength || !cycleInfo) return { phase: null, cycleDay: null };
    const cd = calcCycleDayFromLMP(date, settings.lastPeriodStart, settings.cycleLength);
    return {
      phase: phaseFromCycleDay(cd, settings.periodLength ?? 5, cycleInfo.fertileStartCycleDay, cycleInfo.fertileEndCycleDay),
      cycleDay: cd,
    };
  }

  // Scroll event → update selected date
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
    <div className="flex flex-col overflow-hidden" style={{ height: "100svh", background: "var(--bg-base)" }}>

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-2 flex items-center gap-3 shrink-0">
        <button onClick={() => window.history.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--text-sub)" }} />
        </button>
        <div>
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--text-main)" }}>Cycle Calendar</h1>
          {selectedInfo.phase && (
            <p className="text-xs" style={{ color: RING_COLOR[selectedInfo.phase] }}>
              {PHASE_META[selectedInfo.phase].label}
              {selectedInfo.cycleDay ? ` · Day ${selectedInfo.cycleDay}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── Day strip (TOP) ── */}
      <div
        ref={stripRef}
        onScroll={handleScroll}
        className="shrink-0"
        style={{
          display: "flex",
          overflowX: "scroll",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          paddingTop: 6,
          paddingBottom: 6,
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
          const col = info.phase ? RING_COLOR[info.phase] : "rgba(255,255,255,0.2)";

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
                transform: isSelected ? "scale(1.1)" : "scale(1)",
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
                fontSize: isSelected ? 20 : 16,
                fontWeight: isSelected ? 900 : 600,
                lineHeight: 1,
                color: isSelected ? "#fff" : isT ? col : "var(--text-main)",
              }}>{dayNum}</span>

              {/* Phase indicator dot */}
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

      {/* ── Cycle ring (MIDDLE) ── */}
      <div className="flex items-center justify-center shrink-0" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {settings && cycleInfo ? (
          <CycleRing
            cycleLength={settings.cycleLength ?? 28}
            periodLength={settings.periodLength ?? 5}
            fertileStart={cycleInfo.fertileStartCycleDay}
            fertileEnd={cycleInfo.fertileEndCycleDay}
            selectedCycleDay={selectedInfo.cycleDay}
            selectedPhase={selectedInfo.phase}
            selectedDate={selectedDate}
            isFuture={isFuture}
          />
        ) : (
          <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── Day detail (BOTTOM, scrollable) ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <DayDetail
          date={selectedDate}
          apiDay={selectedApiDay}
          phase={selectedInfo.phase}
          cycleDay={selectedInfo.cycleDay}
          isFuture={isFuture}
          isToday={isToday}
        />
      </div>
    </div>
  );
}

// ── Cycle Ring SVG ─────────────────────────────────────────────────────────────

function CycleRing({
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
  const GAP = 2.5; // degrees gap between phase arcs

  function dayToDeg(day: number) { return (day / cycleLength) * 360; }

  const phases: { phase: Phase; start: number; end: number }[] = [
    { phase: "menstruation", start: 0,                end: periodLength },
    { phase: "follicular",   start: periodLength,      end: fertileStart - 1 },
    { phase: "fertile",      start: fertileStart - 1,  end: fertileEnd },
    { phase: "luteal",       start: fertileEnd,         end: cycleLength },
  ];

  const dotCd  = selectedCycleDay ?? 1;
  const dotDeg = dayToDeg(dotCd - 0.5);
  const dot    = polarXY(cx, cy, R, dotDeg);

  const d     = new Date(selectedDate + "T12:00:00");
  const dayN  = d.getDate();
  const monN  = d.toLocaleDateString("en-NG", { month: "short" });
  const col   = selectedPhase ? RING_COLOR[selectedPhase] : "#6b7280";

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: "visible" }}>
      {/* Background track */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />

      {/* Phase arcs */}
      {phases.map(({ phase, start, end }) => {
        const sd = dayToDeg(start) + GAP / 2;
        const ed = dayToDeg(end)   - GAP / 2;
        const d  = arcPath(cx, cy, R, sd, ed);
        if (!d) return null;
        return (
          <path key={phase} d={d} fill="none"
            stroke={RING_COLOR[phase]} strokeWidth={SW} strokeLinecap="round" opacity={0.92} />
        );
      })}

      {/* Dot glow */}
      <circle cx={dot.x} cy={dot.y} r={13} fill={col} opacity={0.25} />
      {/* Dot white ring */}
      <circle cx={dot.x} cy={dot.y} r={9} fill="white"
        style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
      {/* Dot inner */}
      <circle cx={dot.x} cy={dot.y} r={5.5} fill={col} />

      {/* Center — day number */}
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize="38" fontWeight="900"
        fill="white" fontFamily="inherit">{dayN}</text>
      {/* Month */}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="13"
        fill="rgba(255,255,255,0.5)" fontFamily="inherit">{monN}</text>
      {/* Phase label */}
      {selectedPhase && (
        <text x={cx} y={cy + 27} textAnchor="middle" fontSize="12" fontWeight="700"
          fill={col} fontFamily="inherit">
          {isFuture ? "↗ " : ""}{PHASE_META[selectedPhase].label}
        </text>
      )}
      {/* Cycle day */}
      {selectedCycleDay && (
        <text x={cx} y={cy + 44} textAnchor="middle" fontSize="10"
          fill="rgba(255,255,255,0.35)" fontFamily="inherit">
          Day {selectedCycleDay} of {cycleLength}
        </text>
      )}
    </svg>
  );
}

// ── Day detail panel ───────────────────────────────────────────────────────────

function DayDetail({
  date, apiDay, phase, cycleDay, isFuture, isToday,
}: {
  date: string;
  apiDay: CalendarDay | null;
  phase: Phase | null;
  cycleDay: number | null;
  isFuture: boolean;
  isToday: boolean;
}) {
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });
  const col    = phase ? RING_COLOR[phase] : "#6b7280";
  const log    = apiDay?.log ?? null;
  const hasLog = !!(log?.flow || (log?.symptoms?.length ?? 0) > 0 || log?.notes);

  const PHASE_EMOJI: Record<Phase, string> = {
    menstruation: "🩸", follicular: "🌸", fertile: "✨", luteal: "🌙",
  };

  return (
    <div>
      <p className="text-sm font-bold mb-3" style={{ color: "var(--text-main)" }}>{dateLabel}</p>

      {/* Phase card */}
      {phase && (
        <div className="rounded-2xl p-4 mb-3 flex items-center gap-3"
          style={{ background: `${col}18`, border: `1px solid ${col}35` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: col }}>
            {PHASE_EMOJI[phase]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: col }}>
              {PHASE_META[phase].label}
              {cycleDay ? ` · Day ${cycleDay}` : ""}
            </p>
            <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--text-sub)" }}>
              {isFuture ? "Predicted — based on your cycle pattern" : PHASE_META[phase].description}
            </p>
          </div>
        </div>
      )}

      {/* Log / empty states */}
      {!isFuture ? (
        hasLog ? (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {log?.flow && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-sub)" }}>Flow</span>
                <span className="text-xs font-bold capitalize" style={{ color: "var(--text-main)" }}>
                  {log.flow}
                </span>
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
              <button onClick={() => window.history.back()}
                className="mt-2 text-xs font-bold active:opacity-70"
                style={{ color: "#f43f5e" }}>
                Log on dashboard →
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
