import { Link } from "wouter";
import { Heart, Building2, Users, Sparkles, ChevronRight, Crown, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { greeting, formatDate, cn } from "@/lib/utils";
import { useWellnessToday, useWeekSummary } from "@/lib/wellness-api";
import type { WeekSummary } from "@/lib/wellness-api";

interface ChecklistItem {
  id: string;
  emoji: string;
  label: string;
  sub?: string;
  done: boolean;
}

interface TodayData {
  date: string;
  dayKey: string;
  checklist: ChecklistItem[];
  modules: Record<string, unknown>;
}

function moduleHref(id: string): string {
  if (id === "mood_check") return "/wellness/mood";
  return `/wellness/${id}`;
}

export default function HomePage() {
  const { account } = useAuth();
  const displayName = account?.displayName ?? account?.username ?? "there";
  const isPremium = account?.isPremium ?? false;
  const { data: todayData } = useWellnessToday() as { data: TodayData | undefined };
  const { data: summary } = useWeekSummary();

  const checklist: ChecklistItem[] = todayData?.checklist ?? [];
  const hasModules = checklist.length > 0;

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <p className="text-muted-foreground text-sm font-medium">{formatDate()}</p>
        <h1 className="text-2xl font-bold text-foreground mt-1">
          {greeting()}, {displayName} 👋
        </h1>
      </div>

      {/* Premium upsell banner */}
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

        {hasModules ? (
          <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {checklist.map((item) => (
              <Link key={item.id} href={moduleHref(item.id)}>
                <div className="flex items-center gap-3 px-4 py-3.5 transition active:bg-muted cursor-pointer">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition",
                    item.done ? "bg-primary border-primary" : "border-muted-foreground/40"
                  )}>
                    {item.done && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </div>
                  <span className="text-base shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold", item.done && "line-through text-muted-foreground")}>
                      {item.label}
                    </p>
                    {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
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
        )}
      </div>

      {/* Weekly summary card */}
      {summary && summary.moduleStats.length > 0 && (
        <WeeklySummaryCard summary={summary} />
      )}

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
        <QuickCard
          href="/social"
          icon={<Users className="w-6 h-6" />}
          label="Social"
          description="Partners & streaks"
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        />
      </div>
    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: WeekSummary }) {
  const { moduleStats, moodAvg, overallRate, weekStart, weekEnd } = summary;

  const startLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  const endLabel   = new Date(weekEnd   + "T12:00:00").toLocaleDateString("en-NG", { month: "short", day: "numeric" });

  const rateColor =
    overallRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    overallRate >= 50 ? "text-amber-600  dark:text-amber-400"  :
                        "text-rose-600   dark:text-rose-400";

  return (
    <div className="mb-6">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">This week</p>
            <p className="text-xs text-muted-foreground">{startLabel} – {endLabel}</p>
          </div>
          <div className="text-right">
            <p className={cn("text-2xl font-bold", rateColor)}>{overallRate}%</p>
            <p className="text-[10px] text-muted-foreground">completed</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", overallRate >= 80 ? "bg-emerald-500" : overallRate >= 50 ? "bg-amber-500" : "bg-rose-500")}
              style={{ width: `${overallRate}%` }}
            />
          </div>
        </div>

        {/* Per-module rows */}
        <div className="divide-y divide-border">
          {moduleStats.map((stat) => (
            <div key={stat.type} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-base w-6 text-center shrink-0">{stat.emoji}</span>
              <div className="flex gap-1 flex-1">
                {stat.days.map((done, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-2 rounded-full",
                      done ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-8 text-right shrink-0">
                {stat.completedDays}/7
              </span>
            </div>
          ))}
        </div>

        {/* Mood row */}
        {moodAvg && (
          <div className="px-4 py-3 border-t border-border flex items-center gap-4">
            <p className="text-xs text-muted-foreground shrink-0">Avg mood</p>
            <div className="flex gap-3 flex-1">
              <MoodPip label="😊" value={moodAvg.mood} />
              <MoodPip label="⚡" value={moodAvg.energy} />
              <MoodPip label="😰" value={moodAvg.stress} invert />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MoodPip({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const filled = Math.round(value);
  const good = invert ? 6 - filled : filled;
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn("w-2 h-2 rounded-full", i < good ? "bg-primary" : "bg-muted")} />
        ))}
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
