import { Link } from "wouter";
import { Crown, Lock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface Module {
  id: string;
  emoji: string;
  label: string;
  description: string;
  premium: boolean;
  comingSoon?: boolean;
  gradient: string;
  accent: string;
}

const CORE_MODULES: Module[] = [
  { id: "water",       emoji: "💧", label: "Water Intake",     description: "Daily hydration goal",          premium: false, gradient: "linear-gradient(135deg,#0c4a6e,#0369a1)", accent: "#38bdf8" },
  { id: "medications", emoji: "💊", label: "Medications",       description: "Schedule & reminders",          premium: false, gradient: "linear-gradient(135deg,#042f2e,#0f766e)", accent: "#2dd4bf" },
  { id: "workout",     emoji: "🏃", label: "Workout",           description: "Weekly plan & check-ins",       premium: false, gradient: "linear-gradient(135deg,#431407,#c2410c)", accent: "#fb923c" },
  { id: "sleep",       emoji: "😴", label: "Sleep Tracker",     description: "Bedtime & quality log",         premium: false, gradient: "linear-gradient(135deg,#2e1065,#6d28d9)", accent: "#a78bfa" },
  { id: "mood_check",  emoji: "😊", label: "Daily Mood",        description: "Quick daily check-in",          premium: false, gradient: "linear-gradient(135deg,#451a03,#b45309)", accent: "#fbbf24" },
  { id: "energy",      emoji: "⚡", label: "Energy Level",      description: "Track your daily energy",       premium: false, gradient: "linear-gradient(135deg,#1a2e05,#3f6212)", accent: "#a3e635" },
  { id: "stress",      emoji: "🧘", label: "Stress Level",      description: "Monitor and manage stress",     premium: false, gradient: "linear-gradient(135deg,#2d1b69,#7c3aed)", accent: "#c084fc" },
  { id: "fruit",       emoji: "🍎", label: "Fruit Reminder",    description: "Daily fruit intake habit",      premium: false, gradient: "linear-gradient(135deg,#052e16,#166534)", accent: "#4ade80" },
];

const PREMIUM_MODULES: Module[] = [
  { id: "vitals",      emoji: "❤️", label: "Body Vitals",          description: "BP, sugar & weight trends",     premium: true,  gradient: "linear-gradient(135deg,#450a0a,#b91c1c)", accent: "#f87171" },
  { id: "smoking",     emoji: "🚭", label: "Smoking Cessation",    description: "Track days smoke-free",         premium: true,  gradient: "linear-gradient(135deg,#1c1917,#44403c)", accent: "#a8a29e" },
  { id: "eyebreak",    emoji: "👁️", label: "Eye Break",            description: "20-20-20 rule for screens",     premium: true,  gradient: "linear-gradient(135deg,#1e1b4b,#3730a3)", accent: "#818cf8" },
  { id: "sunscreen",   emoji: "☀️", label: "Sunscreen",            description: "Daily skin protection",         premium: true,  gradient: "linear-gradient(135deg,#422006,#a16207)", accent: "#fde047" },
  { id: "outdoors",    emoji: "🌿", label: "Outdoor Time",         description: "Sunlight & fresh air",          premium: true,  gradient: "linear-gradient(135deg,#052e16,#15803d)", accent: "#86efac" },
  { id: "vaccines",    emoji: "💉", label: "Vaccinations",         description: "Track vaccines & next due",     premium: true,  gradient: "linear-gradient(135deg,#042f2e,#0e7490)", accent: "#22d3ee" },
  { id: "checkups",    emoji: "🏥", label: "Annual Checkups",      description: "Dental, eye & general",         premium: true,  gradient: "linear-gradient(135deg,#0c1a4a,#1d4ed8)", accent: "#60a5fa" },
  { id: "hygiene",     emoji: "🪥", label: "Hygiene",              description: "Toothbrush & sponge reminders", premium: true,  gradient: "linear-gradient(135deg,#0e1a2e,#1e40af)", accent: "#93c5fd" },
  { id: "women",       emoji: "🌸", label: "Women's Health",       description: "Cycle, pregnancy & more",       premium: true,  gradient: "linear-gradient(135deg,#4a044e,#a21caf)", accent: "#f0abfc", comingSoon: true },
  { id: "diary",       emoji: "📔", label: "My Diary",             description: "Private journal & AI",          premium: true,  gradient: "linear-gradient(135deg,#1c1917,#292524)", accent: "#d6d3d1" },
  { id: "personality", emoji: "🧠", label: "Personality Profile",  description: "Discover your health patterns",  premium: true,  gradient: "linear-gradient(135deg,#0f172a,#1e3a5f)", accent: "#7dd3fc" },
];

export default function WellnessPage() {
  const { account } = useAuth();
  const isPremium = account?.isPremium ?? false;

  return (
    <div className="px-4 pt-6 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ background: "linear-gradient(135deg,#fff,#94d4cf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Wellness
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Choose what to track today</p>
        </div>
        {!isPremium && (
          <Link href="/pricing">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#92400e,#d97706)", color: "#fff", boxShadow: "0 4px 12px rgba(217,119,6,0.4)" }}>
              <Crown className="w-3 h-3" />
              Premium
            </div>
          </Link>
        )}
      </div>

      {/* Free modules */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Free</p>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {CORE_MODULES.map((m) => <ModuleCard key={m.id} module={m} unlocked />)}
        </div>
      </div>

      {/* Premium modules */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Premium</p>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Crown className="w-3 h-3" style={{ color: "#f59e0b" }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {PREMIUM_MODULES.map((m) => <ModuleCard key={m.id} module={m} unlocked={isPremium} />)}
        </div>
      </div>

    </div>
  );
}

function ModuleCard({ module, unlocked }: { module: Module; unlocked: boolean }) {
  const locked = !unlocked && module.premium;
  const href = locked ? "/pricing" : module.id === "women" ? "/womens-health" : `/wellness/${module.id}`;

  return (
    <Link href={module.comingSoon ? "#" : href}>
      <div className="relative rounded-2xl p-4 cursor-pointer active:scale-95 transition overflow-hidden"
        style={{
          background: locked ? "rgba(255,255,255,0.04)" : module.gradient,
          border: `1px solid ${locked ? "rgba(255,255,255,0.07)" : module.accent + "30"}`,
          boxShadow: locked ? "none" : `0 4px 20px ${module.accent}15`,
          opacity: module.comingSoon ? 0.7 : 1,
        }}>

        {/* Subtle shine overlay */}
        {!locked && (
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.3) 0%,transparent 60%)" }} />
        )}

        <div className="text-2xl mb-2">{module.emoji}</div>
        <p className="text-xs font-bold leading-tight" style={{ color: locked ? "rgba(255,255,255,0.4)" : "#fff" }}>
          {module.label}
        </p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: locked ? "rgba(255,255,255,0.25)" : `${module.accent}cc` }}>
          {module.description}
        </p>

        {/* Lock or coming soon badge */}
        {locked && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Lock className="w-3 h-3" style={{ color: "#f59e0b" }} />
          </div>
        )}
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
