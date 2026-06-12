import {
  Droplets, Pill, Dumbbell, Moon, Smile, Zap, Brain,
  Activity, Cigarette, Eye, Sun, Shield, Sparkles, Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Module {
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  bg: string;
  status: "available" | "soon";
}

const modules: Module[] = [
  { icon: Droplets,  label: "Water Tracker",       desc: "Daily target with gentle reminders",          color: "text-blue-600",   bg: "bg-blue-50",   status: "soon" },
  { icon: Pill,      label: "Medications",          desc: "Never miss a dose — set once, be reminded",   color: "text-purple-600", bg: "bg-purple-50", status: "soon" },
  { icon: Dumbbell,  label: "Workout",             desc: "Your weekly split, arranged for you",          color: "text-green-600",  bg: "bg-green-50",  status: "soon" },
  { icon: Moon,      label: "Sleep",                desc: "Log bedtime and wake time, track quality",     color: "text-indigo-600", bg: "bg-indigo-50", status: "soon" },
  { icon: Smile,     label: "Daily Mood",           desc: "One tap check-in every day",                  color: "text-amber-600",  bg: "bg-amber-50",  status: "soon" },
  { icon: Zap,       label: "Energy Level",         desc: "Notice patterns in your energy across the week", color: "text-orange-600", bg: "bg-orange-50", status: "soon" },
  { icon: Brain,     label: "Stress Level",         desc: "Track what stresses you and when",            color: "text-red-500",    bg: "bg-red-50",    status: "soon" },
  { icon: Activity,  label: "Body Vitals",          desc: "Blood pressure, blood sugar, weight and more", color: "text-rose-600",  bg: "bg-rose-50",   status: "soon" },
  { icon: Cigarette, label: "Quit Smoking",         desc: "Cigarettes per day, days smoke-free, milestones", color: "text-slate-600", bg: "bg-slate-100", status: "soon" },
  { icon: Eye,       label: "Eye Break Reminders",  desc: "20-20-20 rule for screen workers",            color: "text-cyan-600",   bg: "bg-cyan-50",   status: "soon" },
  { icon: Sun,       label: "Healthy Habits",       desc: "Sunscreen, outdoor time, fruit reminders",   color: "text-yellow-600", bg: "bg-yellow-50", status: "soon" },
  { icon: Shield,    label: "Preventive Health",    desc: "Vaccinations, checkups, hygiene replacements", color: "text-teal-600",  bg: "bg-teal-50",   status: "soon" },
  { icon: Heart,     label: "Women's Health",       desc: "Period, pregnancy, breastfeeding, postpartum", color: "text-pink-600",  bg: "bg-pink-50",   status: "soon" },
  { icon: Sparkles,  label: "Personality Profile",  desc: "The app reads you, tells you about yourself", color: "text-violet-600", bg: "bg-violet-50", status: "soon" },
];

export default function WellnessPage() {
  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Wellness</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up your health modules. Tell the app what you want to track — it arranges everything for you.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 mb-6">
        <p className="text-primary font-semibold text-sm">Modules are coming soon</p>
        <p className="text-muted-foreground text-xs mt-1">
          Your wellness hub is being built. Each module below will be available to set up in the next updates.
        </p>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 gap-3">
        {modules.map(({ icon: Icon, label, desc, color, bg, status }) => (
          <div
            key={label}
            className={cn(
              "rounded-2xl p-4 border border-border bg-card relative overflow-hidden",
              status === "soon" ? "opacity-75" : "hover:border-primary/40 hover:shadow-sm cursor-pointer"
            )}
          >
            {status === "soon" && (
              <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                Soon
              </span>
            )}
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", bg)}>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
