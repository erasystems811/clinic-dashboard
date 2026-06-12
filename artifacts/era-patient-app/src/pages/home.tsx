import { Heart, Droplets, Pill, Moon, Smile, Building2, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const quickModules = [
  { icon: Droplets,  label: "Water",       color: "bg-blue-100 text-blue-600",    to: "/wellness" },
  { icon: Pill,      label: "Medication",  color: "bg-purple-100 text-purple-600", to: "/wellness" },
  { icon: Moon,      label: "Sleep",       color: "bg-indigo-100 text-indigo-600", to: "/wellness" },
  { icon: Smile,     label: "Mood",        color: "bg-amber-100 text-amber-600",  to: "/wellness" },
] as const;

export default function HomePage() {
  const { account } = useAuth();
  const name = account?.displayName ?? account?.username ?? "there";

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">

      {/* Greeting */}
      <div className="mb-6">
        <p className="text-muted-foreground text-sm">{formatDate()}</p>
        <h1 className="text-2xl font-bold text-foreground mt-0.5">
          {greeting()}, {name.split(" ")[0]} 👋
        </h1>
      </div>

      {/* Daily summary card */}
      <div className="bg-primary rounded-2xl p-5 mb-6 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5" fill="currentColor" />
          <span className="font-semibold text-sm">Today's Plan</span>
        </div>
        <p className="text-primary-foreground/80 text-sm leading-relaxed">
          Set up your wellness modules to see your daily health plan here. Once you do, everything you need to do today will be listed in one place.
        </p>
        <Link to="/wellness">
          <button className="mt-4 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold px-4 py-2 rounded-xl">
            Get started <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
      </div>

      {/* Quick access */}
      <div className="mb-6">
        <h2 className="font-semibold text-foreground mb-3">Quick access</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickModules.map(({ icon: Icon, label, color, to }) => (
            <Link key={label} to={to}>
              <button className="flex flex-col items-center gap-2 w-full">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", color)}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Hospitals section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">My Hospitals</h2>
          <Link to="/hospitals">
            <button className="text-sm text-primary font-medium">Manage</button>
          </Link>
        </div>
        <Link to="/hospitals">
          <div className="border-2 border-dashed border-border rounded-2xl p-5 flex items-center gap-3 hover:border-primary/40 hover:bg-primary/3 transition-all">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Add a hospital</p>
              <p className="text-xs text-muted-foreground">Connect to an ERA hospital to see your care plan</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
        </Link>
      </div>

    </div>
  );
}
