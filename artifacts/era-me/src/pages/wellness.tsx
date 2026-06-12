import { Link } from "wouter";
import { Crown, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface Module {
  id: string;
  emoji: string;
  label: string;
  description: string;
  premium: boolean;
  comingSoon?: boolean;
}

const CORE_MODULES: Module[] = [
  { id: "water",       emoji: "💧", label: "Water Intake",        description: "Daily hydration goal & reminders",        premium: false },
  { id: "medications", emoji: "💊", label: "Medications",          description: "Medication schedule & reminders",          premium: false },
  { id: "workout",     emoji: "🏃", label: "Workout Tracker",      description: "Weekly workout plan & check-ins",          premium: false },
  { id: "sleep",       emoji: "😴", label: "Sleep Tracker",        description: "Bedtime, wake time & quality log",         premium: false },
  { id: "mood",        emoji: "😊", label: "Daily Mood",           description: "Quick daily check-in",                    premium: false },
  { id: "energy",      emoji: "⚡", label: "Energy Level",         description: "Track your daily energy",                 premium: false },
  { id: "stress",      emoji: "🧘", label: "Stress Level",         description: "Monitor and manage stress",               premium: false },
  { id: "fruit",       emoji: "🍎", label: "Fruit Reminder",       description: "Daily reminder to eat fruit",             premium: false },
];

const PREMIUM_MODULES: Module[] = [
  { id: "vitals",      emoji: "❤️", label: "Body Vitals",          description: "Blood pressure, sugar & weight trends",   premium: true },
  { id: "smoking",     emoji: "🚭", label: "Smoking Cessation",    description: "Track days smoke-free & milestones",      premium: true },
  { id: "eyebreak",    emoji: "👁️", label: "Eye Break Reminder",   description: "20-20-20 rule for screen users",          premium: true },
  { id: "sunscreen",   emoji: "☀️", label: "Sunscreen Reminder",   description: "Daily skin protection habit",             premium: true },
  { id: "outdoors",    emoji: "🌿", label: "Outdoor Time",         description: "Track daily sunlight & fresh air",        premium: true },
  { id: "vaccines",    emoji: "💉", label: "Vaccination Record",   description: "Track vaccines & when next is due",       premium: true },
  { id: "checkups",    emoji: "🏥", label: "Annual Checkups",      description: "Dental, eye, general reminders",          premium: true },
  { id: "hygiene",     emoji: "🪥", label: "Hygiene Replacements", description: "Toothbrush, sponge & more reminders",     premium: true },
  { id: "women",       emoji: "🌸", label: "Women's Health",       description: "Cycle tracking, pregnancy & more",        premium: true, comingSoon: true },
  { id: "diary",       emoji: "📔", label: "My Diary",             description: "Private journal & AI companion",          premium: true },
  { id: "personality", emoji: "🧠", label: "Personality Profile",  description: "AI reads your patterns & helps you grow", premium: true },
];

export default function WellnessPage() {
  const { account } = useAuth();
  const isPremium = account?.isPremium ?? false;

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Wellness</h1>
        {!isPremium && (
          <Link href="/pricing">
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 rounded-full">
              <Crown className="w-3.5 h-3.5" />
              Get Premium
            </span>
          </Link>
        )}
      </div>

      {/* Core — always free */}
      <SectionHeader label="Core" badge="Free" badgeColor="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
      <div className="space-y-2 mb-6">
        {CORE_MODULES.map((m) => (
          <ModuleRow key={m.id} module={m} isPremium={isPremium} />
        ))}
      </div>

      {/* Premium */}
      <SectionHeader label="Premium" badge="ERA Premium" badgeColor="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
      <div className="space-y-2">
        {PREMIUM_MODULES.map((m) => (
          <ModuleRow key={m.id} module={m} isPremium={isPremium} />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ label, badge, badgeColor }: { label: string; badge: string; badgeColor: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{label}</h2>
      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", badgeColor)}>{badge}</span>
    </div>
  );
}

function ModuleRow({ module, isPremium }: { module: Module; isPremium: boolean }) {
  const locked = module.premium && !isPremium;
  const href = locked ? "/pricing" : `/wellness/${module.id}`;

  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-4 bg-card border border-border rounded-2xl p-4 transition active:scale-[0.98] cursor-pointer",
        locked && "opacity-70"
      )}>
        <span className="text-2xl shrink-0">{module.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground text-sm">{module.label}</p>
            {module.comingSoon && (
              <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wide">Soon</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
        </div>
        {locked ? (
          <Crown className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>
    </Link>
  );
}
