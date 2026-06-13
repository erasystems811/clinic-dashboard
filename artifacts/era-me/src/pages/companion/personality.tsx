import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePersonality, isCompanionUnlocked } from "@/lib/companion-api";

export default function PersonalityPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const { data, isLoading } = usePersonality();

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const p = data?.personality ?? {};
  const traits = p.traits as string[] | undefined;
  const values = p.values as string[] | undefined;
  const stressors = p.stressors as string[] | undefined;
  const strengths = p.strengths as string[] | undefined;
  const notes = p.notes as string | undefined;

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🧠</span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Personality profile</h1>
          <p className="text-xs text-muted-foreground">Built from your conversations</p>
        </div>
      </div>

      {!data?.hasInsights ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold text-foreground mb-1">Nothing yet</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your companion starts building your personality profile after a few conversations. Start talking — the more you share, the deeper the insights.
          </p>
          <button onClick={() => navigate("/companion")}
            className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {traits && traits.length > 0 && (
            <InsightCard emoji="✨" title="Personality traits" items={traits} color="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" />
          )}
          {strengths && strengths.length > 0 && (
            <InsightCard emoji="💪" title="Your strengths" items={strengths} color="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" />
          )}
          {values && values.length > 0 && (
            <InsightCard emoji="🌱" title="What matters to you" items={values} color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" />
          )}
          {stressors && stressors.length > 0 && (
            <InsightCard emoji="🌊" title="What challenges you" items={stressors} color="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" />
          )}
          {notes && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">🔮 Companion's note</p>
              <p className="text-sm text-foreground leading-relaxed italic">"{notes}"</p>
            </div>
          )}

          <div className="bg-muted rounded-2xl p-4 mt-2">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              This profile deepens with every conversation. It's private, only visible to you, and never shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ emoji, title, items, color }: { emoji: string; title: string; items: string[]; color: string }) {
  return (
    <div className={`border rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{emoji} {title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="bg-background/60 text-foreground text-xs font-medium px-2.5 py-1 rounded-full border border-border/50">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
