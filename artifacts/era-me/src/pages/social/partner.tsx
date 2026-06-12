import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Share2 } from "lucide-react";
import { usePartnerStreaks, useRemovePartner } from "@/lib/social-api";
import type { StreakItem } from "@/lib/social-api";
import { cn } from "@/lib/utils";

export default function PartnerPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const partnershipId = parseInt(id, 10);

  const { data, isLoading } = usePartnerStreaks(isNaN(partnershipId) ? null : partnershipId);
  const removePartner = useRemovePartner();
  const [showRemove, setShowRemove] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!data) {
    return (
      <div className="px-5 pt-6">
        <button onClick={() => navigate("/social")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <p className="text-muted-foreground text-sm">Partner not found.</p>
      </div>
    );
  }

  const { partner, streaks } = data;
  const displayName = partner.displayName ?? partner.username;
  const letter = displayName[0].toUpperCase();
  const activeStreaks = streaks.filter((s) => s.streak > 0);

  function sharePartnerStreaks() {
    if (activeStreaks.length === 0) return;
    const lines = activeStreaks.map((s) => `${s.emoji} ${s.label}: ${s.streak} day${s.streak !== 1 ? "s" : ""}`);
    const text = `${displayName}'s ERA Health wellness streaks 🔥\n\n${lines.join("\n")}\n\nCheck out erasystems.io`;
    if (navigator.share) {
      void navigator.share({ title: `${displayName}'s Streaks`, text });
    } else {
      void navigator.clipboard.writeText(text);
    }
  }

  function handleRemove() {
    removePartner.mutate(partnershipId, {
      onSuccess: () => navigate("/social"),
    });
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/social")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      {/* Partner header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mb-3">
          {letter}
        </div>
        <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
        <p className="text-sm text-muted-foreground">@{partner.username}</p>
      </div>

      {/* Share button */}
      {activeStreaks.length > 0 && (
        <button onClick={sharePartnerStreaks}
          className="w-full flex items-center justify-center gap-2 py-3 mb-5 bg-muted rounded-2xl text-sm font-semibold text-foreground transition active:scale-95">
          <Share2 className="w-4 h-4" />Share {displayName.split(" ")[0]}'s streaks
        </button>
      )}

      {/* Streaks */}
      {activeStreaks.length > 0 ? (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current streaks</p>
          <div className="grid grid-cols-2 gap-3">
            {activeStreaks.map((s) => (
              <StreakCard key={s.type} streak={s} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 text-center mb-5">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-semibold text-foreground mb-1">No active streaks</p>
          <p className="text-sm text-muted-foreground">{displayName} hasn't logged any wellness data yet, or all streaks are at 0.</p>
        </div>
      )}

      {/* Zero-streak modules (greyed out) */}
      {streaks.filter((s) => s.streak === 0).length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Also tracking</p>
          <div className="flex flex-wrap gap-2">
            {streaks.filter((s) => s.streak === 0).map((s) => (
              <div key={s.type} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                <span className="text-sm">{s.emoji}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove */}
      <div className="mt-4">
        {!showRemove ? (
          <button onClick={() => setShowRemove(true)}
            className="w-full py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
            Remove partner
          </button>
        ) : (
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-1">Remove {displayName.split(" ")[0]} as a partner?</p>
            <p className="text-xs text-muted-foreground mb-4">They won't be able to see your streaks anymore. You can always reconnect later.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRemove(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground transition active:scale-95">
                Cancel
              </button>
              <button onClick={handleRemove} disabled={removePartner.isPending}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-60">
                {removePartner.isPending ? "Removing…" : "Yes, remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StreakCard({ streak }: { streak: StreakItem }) {
  const label = streak.streak === 1 ? "day" : "days";
  const isHot = streak.streak >= 7;
  return (
    <div className={cn("border rounded-2xl p-4 flex items-center gap-3",
      isHot ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
             : "bg-card border-border")}>
      <span className="text-3xl shrink-0">{streak.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{streak.label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">
          {streak.streak} <span className="text-sm font-normal text-muted-foreground">{label}</span>
        </p>
        {isHot && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">🔥 On fire!</p>}
      </div>
    </div>
  );
}
