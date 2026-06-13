import { Link } from "wouter";
import { isCompanionHidden } from "@/lib/companion-api";

interface Module {
  id: string;
  emoji: string;
  label: string;
  description: string;
  gradient: string;
  accent: string;
  comingSoon?: boolean;
  href?: string;
}

const DAILY_MODULES: Module[] = [
  { id: "water",       emoji: "💧", label: "Water Intake",     description: "Daily hydration goal",          gradient: "linear-gradient(135deg,#0c4a6e,#0369a1)", accent: "#38bdf8" },
  { id: "mood_check",  emoji: "😊", label: "Daily Mood",        description: "Mood, energy & stress check-in", gradient: "linear-gradient(135deg,#451a03,#b45309)", accent: "#fbbf24" },
  { id: "energy",      emoji: "⚡", label: "Energy Level",      description: "Track your daily energy",       gradient: "linear-gradient(135deg,#1a2e05,#3f6212)", accent: "#a3e635" },
  { id: "stress",      emoji: "🧘", label: "Stress Level",      description: "Monitor and manage stress",     gradient: "linear-gradient(135deg,#2d1b69,#7c3aed)", accent: "#c084fc" },
  { id: "sleep",       emoji: "😴", label: "Sleep Tracker",     description: "Bedtime & quality log",         gradient: "linear-gradient(135deg,#2e1065,#6d28d9)", accent: "#a78bfa" },
  { id: "workout",     emoji: "🏃", label: "Workout",           description: "Weekly plan & check-ins",       gradient: "linear-gradient(135deg,#431407,#c2410c)", accent: "#fb923c" },
  { id: "medications", emoji: "💊", label: "Medications",       description: "Schedule & reminders",          gradient: "linear-gradient(135deg,#042f2e,#0f766e)", accent: "#2dd4bf" },
  { id: "fruit",       emoji: "🍎", label: "Fruit Reminder",    description: "Daily fruit intake habit",      gradient: "linear-gradient(135deg,#052e16,#166534)", accent: "#4ade80" },
];

const HEALTH_MODULES: Module[] = [
  { id: "vitals",    emoji: "❤️", label: "Body Vitals",       description: "BP, sugar & weight trends",         gradient: "linear-gradient(135deg,#450a0a,#b91c1c)", accent: "#f87171" },
  { id: "smoking",   emoji: "🚭", label: "Quit Smoking",      description: "Cigarettes, shisha & more",         gradient: "linear-gradient(135deg,#1c1917,#44403c)", accent: "#a8a29e" },
  { id: "alcohol",   emoji: "🍷", label: "Alcohol Tracker",   description: "Quit or reduce your intake",        gradient: "linear-gradient(135deg,#431407,#92400e)", accent: "#fbbf24" },
  { id: "eyebreak",  emoji: "👁️", label: "Eye Break",         description: "20-20-20 rule for screens",         gradient: "linear-gradient(135deg,#1e1b4b,#3730a3)", accent: "#818cf8" },
  { id: "sunscreen", emoji: "☀️", label: "Sunscreen",         description: "Daily skin protection",             gradient: "linear-gradient(135deg,#422006,#a16207)", accent: "#fde047" },
  { id: "outdoors",  emoji: "🌿", label: "Outdoor Time",      description: "Sunlight & fresh air",              gradient: "linear-gradient(135deg,#052e16,#15803d)", accent: "#86efac" },
  { id: "vaccines",  emoji: "💉", label: "Vaccinations",      description: "Track vaccines & next due",         gradient: "linear-gradient(135deg,#042f2e,#0e7490)", accent: "#22d3ee" },
  { id: "checkups",  emoji: "🏥", label: "Annual Checkups",   description: "Dental, eye & general",             gradient: "linear-gradient(135deg,#0c1a4a,#1d4ed8)", accent: "#60a5fa" },
  { id: "hygiene",   emoji: "🪥", label: "Hygiene",           description: "Toothbrush & sponge reminders",     gradient: "linear-gradient(135deg,#0e1a2e,#1e40af)", accent: "#93c5fd" },
];

const COMPANION_MODULES: Module[] = [
  { id: "women",     emoji: "🌸", label: "Women's Health",      description: "Cycle, pregnancy & more",       gradient: "linear-gradient(135deg,#4a044e,#a21caf)", accent: "#f0abfc", comingSoon: true, href: "/womens-health" },
  { id: "intimacy",  emoji: "💗", label: "Sex Life & Intimacy", description: "Celibacy or active tracking",   gradient: "linear-gradient(135deg,#4c0519,#be123c)", accent: "#fda4af" },
];

function moduleHref(m: Module): string {
  if (m.href) return m.href;
  if (m.id === "mood_check") return "/wellness/mood";
  return `/wellness/${m.id}`;
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>{title}</p>
      <div className="flex-1 h-px" style={{ background: "var(--glass-border)" }} />
    </div>
  );
}

const DIARY_MODULES: Module[] = [
  { id: "my-diary", emoji: "📔", label: "My Diary", description: "Private journal, chats & personality", gradient: "linear-gradient(135deg,#1e1b4b,#4c1d95)", accent: "#c084fc", href: "/companion" },
];

export default function WellnessPage() {
  const diaryHidden = isCompanionHidden();

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
          Personal Settings
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>Choose what to track — tap any module to set it up</p>
      </div>

      <div className="mb-5">
        <SectionDivider title="Daily Habits" />
        <div className="grid grid-cols-2 gap-2.5">
          {DAILY_MODULES.map((m) => <ModuleCard key={m.id} module={m} />)}
        </div>
      </div>

      <div className="mb-5">
        <SectionDivider title="Health Tracking" />
        <div className="grid grid-cols-2 gap-2.5">
          {HEALTH_MODULES.map((m) => <ModuleCard key={m.id} module={m} />)}
        </div>
      </div>

      <div>
        <SectionDivider title="Personal" />
        <div className="grid grid-cols-2 gap-2.5">
          {COMPANION_MODULES.map((m) => <ModuleCard key={m.id} module={m} />)}
          {!diaryHidden && DIARY_MODULES.map((m) => <ModuleCard key={m.id} module={m} />)}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module }: { module: Module }) {
  const href = moduleHref(module);

  return (
    <Link href={module.comingSoon ? "#" : href}>
      <div className="on-gradient relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{
          background: module.gradient,
          border: `1px solid ${module.accent}30`,
          boxShadow: `0 4px 20px ${module.accent}15`,
          opacity: module.comingSoon ? 0.7 : 1,
          minHeight: 90,
        }}>

        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.3) 0%,transparent 60%)" }} />

        <div className="text-2xl mb-2">{module.emoji}</div>
        <p className="text-xs font-bold leading-tight text-white">{module.label}</p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: `${module.accent}cc` }}>{module.description}</p>

        {module.comingSoon && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
            Soon
          </div>
        )}
      </div>
    </Link>
  );
}
