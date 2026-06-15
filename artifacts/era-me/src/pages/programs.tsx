import { type MouseEvent } from "react";
import { Link } from "wouter";
import { X, ChevronRight } from "lucide-react";
import { useWellnessModules, useDisableModule } from "@/lib/wellness-api";

interface Module {
  id: string; emoji: string; label: string; description: string;
  gradient: string; accent: string;
}

interface WellnessProgram {
  href: string; emoji: string; label: string; description: string;
  bg: string; borderColor: string; accent: string;
}

const WELLNESS_PROGRAMS: WellnessProgram[] = [
  {
    href: "/weightloss", emoji: "🏋️", label: "Weight Loss Coach",
    description: "Personalised meal plans, Nigerian food calculator & daily accountability",
    bg: "linear-gradient(135deg, #030d07 0%, #052e16 35%, #064e3b 70%)",
    borderColor: "rgba(16,185,129,0.3)", accent: "#10b981",
  },
  {
    href: "/womens-health", emoji: "🌸", label: "Women's Health",
    description: "Cycle tracking, hormones & fertility",
    bg: "linear-gradient(160deg, #3b0a1e 0%, #7c1040 45%, #9d174d 100%)",
    borderColor: "rgba(236,72,153,0.28)", accent: "#f472b6",
  },
  {
    href: "/companion", emoji: "📓", label: "My Diary",
    description: "Private journal & personal companion",
    bg: "linear-gradient(160deg, #06020f 0%, #1e0845 50%, #2a0d5e 100%)",
    borderColor: "rgba(139,92,246,0.3)", accent: "#a78bfa",
  },
];

const DAILY_MODULES: Module[] = [
  { id: "water",       emoji: "💧", label: "Water Intake",     description: "Daily hydration goal",          gradient: "linear-gradient(135deg,#0c4a6e,#0369a1)", accent: "#38bdf8" },
  { id: "medications", emoji: "💊", label: "Medications",       description: "Schedule & reminders",          gradient: "linear-gradient(135deg,#042f2e,#0f766e)", accent: "#2dd4bf" },
  { id: "workout",     emoji: "🏃", label: "Workout",           description: "Weekly plan & check-ins",       gradient: "linear-gradient(135deg,#431407,#c2410c)", accent: "#fb923c" },
  { id: "fruit",       emoji: "🍎", label: "Fruit Reminder",    description: "Daily fruit intake habit",      gradient: "linear-gradient(135deg,#052e16,#166534)", accent: "#4ade80" },
];

const HEALTH_MODULES: Module[] = [
  { id: "vitals",   emoji: "❤️", label: "Body Vitals",     description: "BP, sugar & weight trends",  gradient: "linear-gradient(135deg,#450a0a,#b91c1c)", accent: "#f87171" },
  { id: "smoking",  emoji: "🚭", label: "Quit Smoking",    description: "Cigarettes, shisha & more",  gradient: "linear-gradient(135deg,#1c1917,#44403c)", accent: "#a8a29e" },
  { id: "alcohol",  emoji: "🍷", label: "Alcohol Tracker", description: "Quit or reduce your intake", gradient: "linear-gradient(135deg,#431407,#92400e)", accent: "#fbbf24" },
  { id: "vaccines", emoji: "💉", label: "Vaccinations",    description: "Track vaccines & next due",  gradient: "linear-gradient(135deg,#042f2e,#0e7490)", accent: "#22d3ee" },
  { id: "checkups", emoji: "🏥", label: "Annual Checkups", description: "Dental, eye & general",      gradient: "linear-gradient(135deg,#0c1a4a,#1d4ed8)", accent: "#60a5fa" },
];

const LIFESTYLE_MODULES: Module[] = [
  { id: "hygiene",   emoji: "🪥", label: "Hygiene",      description: "Toothbrush & sponge reminders", gradient: "linear-gradient(135deg,#0e1a2e,#1e40af)", accent: "#93c5fd" },
  { id: "outdoors",  emoji: "🌿", label: "Outdoor Time", description: "Sunlight & fresh air",          gradient: "linear-gradient(135deg,#052e16,#15803d)", accent: "#86efac" },
  { id: "eyebreak",  emoji: "👁️", label: "Eye Break",    description: "20-20-20 rule for screens",     gradient: "linear-gradient(135deg,#1e1b4b,#3730a3)", accent: "#818cf8" },
  { id: "sunscreen", emoji: "☀️", label: "Sunscreen",    description: "Daily skin protection",         gradient: "linear-gradient(135deg,#422006,#a16207)", accent: "#fde047" },
];

function moduleHref(m: Module): string {
  return `/wellness/${m.id}`;
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", letterSpacing: 1.5, flexShrink: 0 }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
    </div>
  );
}

export default function ProgramsPage() {
  const { data: modules } = useWellnessModules() as { data: Record<string, { enabled: boolean }> | undefined };
  const disable = useDisableModule();

  function isEnabled(id: string): boolean {
    return modules?.[id]?.enabled ?? false;
  }

  function handleDisable(id: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    disable.mutate(id);
  }

  return (
    <div className="px-4 pt-6 pb-8">

      <div className="mb-6">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)" }}>Programs</h1>
        <p style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>
          Health modules, coaches & specialised programs
        </p>
      </div>

      {/* ── Wellness Programs ────────────────────────────────────────── */}
      <div className="mb-7">
        <SectionLabel title="WELLNESS PROGRAMS" />
        <div className="space-y-2.5">
          {WELLNESS_PROGRAMS.map((p) => (
            <Link key={p.href} href={p.href}>
              <div className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition"
                style={{ background: p.bg, border: `1px solid ${p.borderColor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: `${p.accent}20`, border: `1px solid ${p.accent}35`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  }}>
                    {p.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{p.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", marginTop: 2, lineHeight: 1.4 }}>{p.description}</p>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: p.accent, flexShrink: 0 }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Daily Habits ─────────────────────────────────────────────── */}
      <div className="mb-7">
        <SectionLabel title="DAILY HABITS" />
        <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>
          Tap a module to set it up · tap Stop to remove from your plan
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {DAILY_MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} enabled={isEnabled(m.id)} onDisable={(e) => handleDisable(m.id, e)} />
          ))}
        </div>
      </div>

      {/* ── Health Tracking ──────────────────────────────────────────── */}
      <div className="mb-7">
        <SectionLabel title="HEALTH TRACKING" />
        <div className="grid grid-cols-2 gap-2.5">
          {HEALTH_MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} enabled={isEnabled(m.id)} onDisable={(e) => handleDisable(m.id, e)} />
          ))}
        </div>
      </div>

      {/* ── Lifestyle ────────────────────────────────────────────────── */}
      <div>
        <SectionLabel title="LIFESTYLE" />
        <div className="grid grid-cols-2 gap-2.5">
          {LIFESTYLE_MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} enabled={isEnabled(m.id)} onDisable={(e) => handleDisable(m.id, e)} />
          ))}
        </div>
      </div>

    </div>
  );
}

function ModuleCard({ module, enabled, onDisable }: {
  module: Module; enabled: boolean; onDisable: (e: MouseEvent) => void;
}) {
  return (
    <Link href={moduleHref(module)}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{
          background: module.gradient,
          border: enabled ? `1px solid ${module.accent}55` : `1px solid ${module.accent}22`,
          boxShadow: enabled ? `0 4px 20px ${module.accent}25` : "none",
          opacity: enabled ? 1 : 0.55,
          minHeight: 90,
        }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.3) 0%,transparent 60%)" }} />
        {enabled && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 7, height: 7, borderRadius: "50%",
            background: "#4ade80", boxShadow: "0 0 6px rgba(74,222,128,0.9)",
          }} />
        )}
        <div style={{ fontSize: 22, marginBottom: 8 }}>{module.emoji}</div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{module.label}</p>
        <p style={{ fontSize: 10, marginTop: 2, color: `${module.accent}cc`, lineHeight: 1.4 }}>{module.description}</p>
        {enabled && (
          <button onClick={onDisable}
            className="absolute bottom-2 right-2 flex items-center gap-0.5 active:scale-90 transition"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "2px 6px 2px 4px" }}>
            <X style={{ width: 9, height: 9, color: "rgba(255,255,255,0.75)" }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Stop</span>
          </button>
        )}
      </div>
    </Link>
  );
}
