import { Link } from "wouter";
import { Heart, Building2, Sparkles, ChevronRight, Crown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate, cn } from "@/lib/utils";

export default function HomePage() {
  const { account } = useAuth();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const isPremium = account?.isPremium ?? false;

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <p className="text-muted-foreground text-sm font-medium">{formatDate()}</p>
        <h1 className="text-2xl font-bold text-foreground mt-1">
          {greeting()}, {displayName} 👋
        </h1>
      </div>

      {/* Premium upsell banner (shown when not premium) */}
      {!isPremium && (
        <Link href="/pricing">
          <div className="mb-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition">
            <Crown className="w-6 h-6 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Unlock ERA Premium</p>
              <p className="text-white/80 text-xs">AI companion, hospital connections & more</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
          </div>
        </Link>
      )}

      {/* Today's plan */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">Today's plan</h2>
        <div className="bg-card rounded-2xl border border-border p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium mb-1">Nothing yet</p>
          <p className="text-muted-foreground text-sm">
            Set up your wellness modules and your daily plan will appear here automatically.
          </p>
          <Link href="/wellness">
            <button className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">
              Set up wellness
            </button>
          </Link>
        </div>
      </div>

      {/* Quick access */}
      <h2 className="text-base font-semibold text-foreground mb-3">Quick access</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickCard
          href="/wellness"
          icon={<Heart className="w-6 h-6" />}
          label="My Wellness"
          description="Habits & tracking"
          color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
        />
        <QuickCard
          href="/hospitals"
          icon={<Building2 className="w-6 h-6" />}
          label="Hospitals"
          description="Your connected hospitals"
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          locked={!isPremium}
        />
      </div>
    </div>
  );
}

function QuickCard({
  href, icon, label, description, color, locked = false,
}: {
  href: string; icon: React.ReactNode; label: string; description: string; color: string; locked?: boolean;
}) {
  return (
    <Link href={locked ? "/pricing" : href}>
      <div className={cn(
        "bg-card border border-border rounded-2xl p-4 transition active:scale-95 cursor-pointer relative overflow-hidden",
        locked && "opacity-80"
      )}>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-3", color)}>
          {icon}
        </div>
        <p className="font-semibold text-foreground text-sm">{label}</p>
        <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
        {locked && (
          <div className="absolute top-3 right-3">
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
        )}
      </div>
    </Link>
  );
}
