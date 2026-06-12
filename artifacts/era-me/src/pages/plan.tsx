import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, ChevronRight, ImageDown, Printer } from "lucide-react";
import { useWeekSummary, useWellnessToday } from "@/lib/wellness-api";
import { useAuth } from "@/contexts/auth-context";
import type { WeekSummary } from "@/lib/wellness-api";

interface ChecklistItem { id: string; emoji: string; label: string; sub?: string; done: boolean; }

const MODULE_ACCENT: Record<string, string> = {
  water: "#38bdf8", medications: "#14b8a6", workout: "#f97316",
  sleep: "#8b5cf6", mood_check: "#fbbf24", energy: "#84cc16",
  stress: "#a855f7", fruit: "#22c55e", vitals: "#ef4444",
  smoking: "#64748b", eyebreak: "#6366f1", sunscreen: "#eab308",
  outdoors: "#16a34a", hygiene: "#93c5fd",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_CHARS  = ["M",   "T",   "W",   "T",   "F",   "S",   "S"];

function moduleHref(id: string): string {
  return id === "mood_check" ? "/wellness/mood" : `/wellness/${id}`;
}

function todayIndex(weekStart: string): number {
  const start = new Date(weekStart + "T12:00:00");
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.min(6, Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000)));
}

// ── Canvas card generator ─────────────────────────────────────────────────────

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const R = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + R);
  ctx.lineTo(x + w, y + h - R);
  ctx.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
  ctx.lineTo(x + R, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - R);
  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);
  ctx.closePath();
}

async function drawPlanCard(summary: WeekSummary, displayName: string): Promise<HTMLCanvasElement> {
  const root = document.documentElement;
  const accent  = root.style.getPropertyValue("--accent").trim()   || "#14b8a6";
  const bgBase  = root.style.getPropertyValue("--bg-base").trim()  || "#060d1f";
  const bgMid   = root.style.getPropertyValue("--bg-mid").trim()   || "#0a1628";
  const glowRGB = root.style.getPropertyValue("--glow-rgb").trim() || "20,184,166";

  const DPR  = 2;
  const W    = 600;
  const PAD  = 28;
  const HEADER_H    = 160;
  const DAY_ROW_H   = 28;
  const MODULE_ROW_H = 50;
  const FOOTER_H    = 72;
  const H = HEADER_H + DAY_ROW_H + summary.moduleStats.length * MODULE_ROW_H + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, bgBase);
  bg.addColorStop(1, bgMid);
  rrect(ctx, 0, 0, W, H, 24); ctx.fillStyle = bg; ctx.fill();

  // Top-right glow
  const glow = ctx.createRadialGradient(W * 0.88, 0, 0, W * 0.88, 0, W * 0.65);
  glow.addColorStop(0, `rgba(${glowRGB},0.28)`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // ── HEADER ──
  // ERA Health label
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillStyle = accent;
  ctx.fillText("ERA HEALTH", PAD, PAD + 14);
  ctx.letterSpacing = "0px";

  // Title
  ctx.font = "bold 26px -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Weekly Wellness Plan", PAD, PAD + 52);

  // Week range
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-GB", opts);
  const dateStr = `${fmt(summary.weekStart, { month: "short", day: "numeric" })} – ${fmt(summary.weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;
  ctx.font = "500 13px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(dateStr, PAD, PAD + 78);

  // Name
  ctx.font = "600 14px -apple-system, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(displayName, PAD, PAD + 106);

  // Overall % — right side
  const rateColor = summary.overallRate >= 80 ? "#4ade80" : summary.overallRate >= 50 ? "#fbbf24" : "#f87171";
  ctx.textAlign = "right";
  ctx.font = "900 58px -apple-system, sans-serif";
  ctx.fillStyle = rateColor;
  ctx.shadowColor = rateColor; ctx.shadowBlur = 18;
  ctx.fillText(`${summary.overallRate}%`, W - PAD, PAD + 72);
  ctx.shadowBlur = 0;
  ctx.font = "bold 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("THIS WEEK", W - PAD, PAD + 92);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";

  // Divider
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(PAD, HEADER_H - 14, W - PAD * 2, 1);

  // ── GRID ──
  const EMOJI_W    = 36;
  const GRID_X     = PAD + EMOJI_W;
  const GRID_W     = W - PAD - GRID_X;
  const DAY_COL_W  = GRID_W / 7;
  const tidx = todayIndex(summary.weekStart);
  let y = HEADER_H;

  // Day header row
  for (let i = 0; i < 7; i++) {
    const cx = GRID_X + i * DAY_COL_W + DAY_COL_W / 2;
    if (i === tidx) {
      ctx.fillStyle = `rgba(${glowRGB},0.22)`;
      rrect(ctx, GRID_X + i * DAY_COL_W + 2, y + 2, DAY_COL_W - 4, DAY_ROW_H - 4, 6);
      ctx.fill();
      ctx.fillStyle = accent;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
    }
    ctx.textAlign = "center";
    ctx.font = "bold 11px -apple-system, sans-serif";
    ctx.fillText(DAY_CHARS[i], cx, y + DAY_ROW_H / 2 + 5);
  }
  ctx.textAlign = "left";
  y += DAY_ROW_H + 4;

  // Module rows
  for (const stat of summary.moduleStats) {
    const modAccent = MODULE_ACCENT[stat.type] || accent;

    // Emoji
    ctx.font = "20px -apple-system, sans-serif";
    ctx.fillText(stat.emoji, PAD, y + MODULE_ROW_H / 2 + 8);

    // Day squares
    for (let i = 0; i < 7; i++) {
      const isDone   = stat.days[i];
      const isFuture = i > tidx;
      const isToday  = i === tidx;
      const sqX = GRID_X + i * DAY_COL_W + 3;
      const sqY = y + 7;
      const sqW = DAY_COL_W - 6;
      const sqH = MODULE_ROW_H - 14;

      rrect(ctx, sqX, sqY, sqW, sqH, 7);
      if (isDone) {
        ctx.fillStyle = modAccent;
        ctx.shadowColor = modAccent; ctx.shadowBlur = 10;
        ctx.fill(); ctx.shadowBlur = 0;
      } else if (isToday) {
        ctx.fillStyle = `rgba(${glowRGB},0.1)`; ctx.fill();
        ctx.strokeStyle = `${modAccent}88`; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.globalAlpha = isFuture ? 0.28 : 1;
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Done count — right of row
    const countColor = stat.completedDays >= 5 ? "#4ade80" : modAccent;
    ctx.textAlign = "right";
    ctx.font = "bold 10px -apple-system, sans-serif";
    ctx.fillStyle = countColor;
    // No room to the right of grid — put it as a tiny sub-text on the emoji column
    ctx.textAlign = "left";

    // Row separator
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(PAD, y + MODULE_ROW_H - 1, W - PAD * 2, 1);
    y += MODULE_ROW_H;
  }

  // ── FOOTER ──
  y += 18;
  // Glow rule
  const rule = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  rule.addColorStop(0, "rgba(0,0,0,0)");
  rule.addColorStop(0.5, `rgba(${glowRGB},0.3)`);
  rule.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rule; ctx.fillRect(PAD, y, W - PAD * 2, 1);

  ctx.textAlign = "center";
  ctx.font = "bold 12px -apple-system, sans-serif";
  ctx.fillStyle = `rgba(${glowRGB === "20,184,166" ? "20,184,166" : glowRGB},0.7)`;
  ctx.fillText("Generated by ERA Health", W / 2, y + 24);
  ctx.font = "500 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillText(
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    W / 2, y + 42
  );
  ctx.textAlign = "left";

  return canvas;
}

async function shareOrDownload(canvas: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const file = new File([blob], name, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "My ERA Health Weekly Plan", files: [file] });
    return;
  }
  // Desktop fallback — download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const { data: summary, isLoading } = useWeekSummary();
  const { data: todayRaw } = useWellnessToday() as { data: { checklist: ChecklistItem[] } | undefined };
  const [saving, setSaving] = useState(false);

  const checklist = todayRaw?.checklist ?? [];
  const pending = checklist.filter((c) => !c.done);
  const done = checklist.filter((c) => c.done);
  const displayName = account?.displayName ?? account?.username ?? "You";

  async function handleSave() {
    if (!summary) return;
    setSaving(true);
    try {
      const canvas = await drawPlanCard(summary, displayName);
      await shareOrDownload(canvas, "era-weekly-plan.png");
    } catch (e) {
      console.error("Save card failed", e);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!summary || summary.moduleStats.length === 0) {
    return (
      <div className="px-4 pt-6 pb-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-6"
          style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 44, marginBottom: 14 }}>📅</p>
          <p style={{ fontWeight: 700, color: "#fff", fontSize: 16, marginBottom: 8 }}>No plan yet</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.55, marginBottom: 22 }}>
            Set up wellness modules to generate your weekly plan and daily habit grid.
          </p>
          <Link href="/wellness">
            <button className="px-7 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition"
              style={{ background: "var(--btn-gradient)", boxShadow: `0 6px 20px rgba(var(--glow-rgb),0.35)` }}>
              Set up wellness →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const tidx = todayIndex(summary.weekStart);
  const startLabel = new Date(summary.weekStart + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const endLabel   = new Date(summary.weekEnd   + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const rateColor  = summary.overallRate >= 80 ? "#4ade80" : summary.overallRate >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="px-4 pt-6 pb-10">

      {/* Back */}
      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 mb-5"
        style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500 }}>
        <ArrowLeft className="w-4 h-4" /> Home
      </button>

      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Your plan</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
            Week of {startLabel} – {endLabel}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 38, fontWeight: 900, color: rateColor, lineHeight: 1, filter: `drop-shadow(0 0 8px ${rateColor}70)` }}>
            {summary.overallRate}%
          </p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>this week</p>
        </div>
      </div>

      {/* Overall bar */}
      <div className="mb-6 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${summary.overallRate}%`, background: rateColor, boxShadow: `0 0 10px ${rateColor}60` }} />
      </div>

      {/* ── Weekly Grid Card ────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>
          Weekly Grid
        </h2>
        {/* Save / Print buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}>
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
            style={{ background: `rgba(var(--glow-rgb),0.12)`, border: `1px solid rgba(var(--glow-rgb),0.3)`, color: "var(--accent)" }}>
            <ImageDown className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Image"}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-2xl overflow-hidden mb-6"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Day header row */}
        <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 4, alignItems: "center" }}>
            <div />
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 10, fontWeight: 700,
                color: i === tidx ? "var(--accent)" : "rgba(255,255,255,0.3)",
                padding: "3px 2px", borderRadius: 4,
                background: i === tidx ? `rgba(var(--glow-rgb),0.12)` : "transparent",
              }}>{d}</div>
            ))}
          </div>
        </div>

        {/* Module rows */}
        {summary.moduleStats.map((stat) => {
          const accent = MODULE_ACCENT[stat.type] ?? "var(--accent)";
          return (
            <Link key={stat.type} href={moduleHref(stat.type)}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                className="active:bg-white/[0.02] transition">
                <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 4, padding: "10px 16px 6px", alignItems: "center" }}>
                  <span style={{ fontSize: 15, textAlign: "center" }}>{stat.emoji}</span>
                  {stat.days.map((isDone, i) => {
                    const isFuture = i > tidx;
                    const isToday  = i === tidx;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                        <div style={{
                          width: "100%", maxWidth: 30, height: 24, borderRadius: 6,
                          background: isDone ? accent : isToday ? `rgba(var(--glow-rgb),0.1)` : isFuture ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                          border: isToday ? `1.5px solid ${isDone ? accent : accent + "70"}` : "1px solid transparent",
                          boxShadow: isDone ? `0 0 8px ${accent}55` : "none",
                          opacity: isFuture ? 0.4 : 1,
                          transition: "background 0.3s",
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{stat.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: stat.completedDays >= 5 ? "#4ade80" : accent }}>
                      {stat.completedDays}/7
                    </span>
                    <ChevronRight style={{ width: 12, height: 12, color: accent, opacity: 0.6 }} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Today's Checklist ────────────────────────────────────── */}
      {checklist.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            Today — {done.length}/{checklist.length} done
          </h2>
          <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full transition-all duration-600"
              style={{ width: `${Math.round((done.length / checklist.length) * 100)}%`, background: done.length === checklist.length ? "#4ade80" : "var(--btn-gradient)", boxShadow: `0 0 8px rgba(var(--glow-rgb),0.5)` }} />
          </div>
          <div className="space-y-2 mb-4">
            {pending.map((item) => <TaskRow key={item.id} item={item} />)}
          </div>
          {done.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Completed
              </p>
              <div className="space-y-2">
                {done.map((item) => <TaskRow key={item.id} item={item} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Mood averages */}
      {summary.moodAvg && (
        <div className="mt-6 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Week averages
          </p>
          <div className="flex gap-6">
            <MoodStat label="Mood"   emoji="😊" value={summary.moodAvg.mood} />
            <MoodStat label="Energy" emoji="⚡" value={summary.moodAvg.energy} />
            <MoodStat label="Stress" emoji="🧘" value={summary.moodAvg.stress} invert />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TaskRow({ item }: { item: ChecklistItem }) {
  const accent = MODULE_ACCENT[item.id] ?? "var(--accent)";
  return (
    <Link href={moduleHref(item.id)}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.98] transition"
        style={{
          background: item.done ? `rgba(var(--glow-rgb),0.06)` : `${accent}0e`,
          border: `1px solid ${item.done ? `rgba(var(--glow-rgb),0.18)` : `${accent}30`}`,
        }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.done ? "✅" : "⭕"}</span>
        <span style={{ fontSize: 17, flexShrink: 0 }}>{item.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: item.done ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: item.done ? "line-through" : "none" }}>
            {item.label}
          </p>
          {item.sub && (
            <p style={{ fontSize: 11, marginTop: 2, color: item.done ? "rgba(255,255,255,0.22)" : accent }}>{item.sub}</p>
          )}
        </div>
        <ChevronRight style={{ width: 15, height: 15, flexShrink: 0, color: item.done ? "rgba(255,255,255,0.15)" : accent }} />
      </div>
    </Link>
  );
}

function MoodStat({ label, emoji, value, invert = false }: { label: string; emoji: string; value: number; invert?: boolean }) {
  const filled = Math.round(value);
  const good = invert ? 6 - filled : filled;
  return (
    <div>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: 5, letterSpacing: 0.5 }}>{emoji} {label}</p>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < good ? "var(--accent)" : "rgba(255,255,255,0.09)",
            boxShadow: i < good ? `0 0 5px rgba(var(--glow-rgb),0.6)` : "none",
          }} />
        ))}
      </div>
    </div>
  );
}
