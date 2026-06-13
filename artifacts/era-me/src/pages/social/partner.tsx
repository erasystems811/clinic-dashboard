import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Settings, Share2, Check, X } from "lucide-react";
import {
  usePartnerStreaks, useRemovePartner, useUpdatePartnerSettings,
  usePartnerWomensHealth, usePartnerGoalProgress,
  GOAL_MODULES, type SharedGoal,
} from "@/lib/social-api";
import type { StreakItem } from "@/lib/social-api";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  menstruation: { label: "Period",         emoji: "🩸", color: "text-rose-500" },
  follicular:   { label: "Follicular",     emoji: "🌸", color: "text-purple-500" },
  fertile:      { label: "Fertile Window", emoji: "✨", color: "text-teal-500" },
  luteal:       { label: "Luteal Phase",   emoji: "🌙", color: "text-amber-500" },
};

export default function PartnerPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const partnershipId = parseInt(id, 10);

  const { data, isLoading } = usePartnerStreaks(isNaN(partnershipId) ? null : partnershipId);
  const removePartner = useRemovePartner();
  const updateSettings = useUpdatePartnerSettings();

  const [tab, setTab] = useState<"streaks" | "womens" | "goal">("streaks");
  const [showSettings, setShowSettings] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  // Settings state
  const [sharingWH, setSharingWH] = useState(false);
  const [sharingGoal, setSharingGoal] = useState(false);
  const [selectedModule, setSelectedModule] = useState(GOAL_MODULES[0]);
  const [goalTarget, setGoalTarget] = useState(GOAL_MODULES[0].defaultTarget);

  if (isLoading) return <Spinner />;
  if (!data) return (
    <div className="px-5 pt-6">
      <button onClick={() => navigate("/social")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <p className="text-muted-foreground text-sm">Partner not found.</p>
    </div>
  );

  const { partner, streaks, sharedModules, sharedGoal } = data;
  const displayName = partner.displayName ?? partner.username;
  const letter = displayName[0].toUpperCase();
  const activeStreaks = streaks.filter((s) => s.streak > 0);
  const whEnabled = sharedModules.includes("womens_health");

  function openSettings() {
    setSharingWH(whEnabled);
    setSharingGoal(!!sharedGoal);
    if (sharedGoal) {
      const mod = GOAL_MODULES.find((m) => m.type === sharedGoal.module) ?? GOAL_MODULES[0];
      setSelectedModule(mod);
      setGoalTarget(sharedGoal.target);
    }
    setShowSettings(true);
  }

  function saveSettings() {
    const newModules = sharingWH ? [...new Set([...sharedModules, "womens_health"])] : sharedModules.filter((m) => m !== "womens_health");
    const newGoal: SharedGoal | null = sharingGoal
      ? { module: selectedModule.type, target: goalTarget, label: `${goalTarget} ${selectedModule.unit} ${selectedModule.label.toLowerCase()} daily` }
      : null;
    updateSettings.mutate({ id: partnershipId, sharedModules: newModules, sharedGoal: newGoal }, { onSuccess: () => setShowSettings(false) });
  }

  function shareStreaks() {
    if (!activeStreaks.length) return;
    const lines = activeStreaks.map((s) => `${s.emoji} ${s.label}: ${s.streak} day${s.streak !== 1 ? "s" : ""}`);
    const text = `${displayName}'s ERA Health wellness streaks 🔥\n\n${lines.join("\n")}`;
    if (navigator.share) void navigator.share({ title: `${displayName}'s Streaks`, text });
    else void navigator.clipboard.writeText(text);
  }

  if (showSettings) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setShowSettings(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <h2 className="text-xl font-bold text-foreground mb-1">Partnership settings</h2>
        <p className="text-sm text-muted-foreground mb-6">with {displayName}</p>

        {/* Women's health sharing */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Share Women's Health</p>
              <p className="text-xs text-muted-foreground mt-0.5">Let {displayName.split(" ")[0]} see your cycle phase or pregnancy week</p>
            </div>
            <button onClick={() => setSharingWH((p) => !p)}
              className={cn("w-12 h-6 rounded-full transition relative shrink-0", sharingWH ? "bg-rose-500" : "bg-muted")}>
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", sharingWH ? "left-6" : "left-0.5")} />
            </button>
          </div>
        </div>

        {/* Shared goal */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Set a shared goal</p>
              <p className="text-xs text-muted-foreground mt-0.5">Track the same wellness target together</p>
            </div>
            <button onClick={() => setSharingGoal((p) => !p)}
              className={cn("w-12 h-6 rounded-full transition relative shrink-0", sharingGoal ? "bg-primary" : "bg-muted")}>
              <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", sharingGoal ? "left-6" : "left-0.5")} />
            </button>
          </div>

          {sharingGoal && (
            <div className="space-y-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a module</p>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_MODULES.map((m) => (
                  <button key={m.type} onClick={() => { setSelectedModule(m); setGoalTarget(m.defaultTarget); }}
                    className={cn("flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition",
                      selectedModule.type === m.type ? "border-primary bg-primary/5" : "border-border bg-muted")}>
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-[10px] font-semibold text-foreground">{m.label}</span>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target: {goalTarget} {selectedModule.unit}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setGoalTarget((p) => Math.max(1, p - 1))}
                    className="w-10 h-10 rounded-xl bg-muted font-bold text-xl text-foreground transition active:scale-90">−</button>
                  <p className="flex-1 text-center text-2xl font-black text-foreground">{goalTarget}</p>
                  <button onClick={() => setGoalTarget((p) => p + 1)}
                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xl transition active:scale-90">+</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={saveSettings} disabled={updateSettings.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {updateSettings.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/social")} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <button onClick={openSettings} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col items-center mb-5">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mb-3">
          {letter}
        </div>
        <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
        <p className="text-sm text-muted-foreground">@{partner.username}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted mb-5">
        <TabBtn active={tab === "streaks"} onClick={() => setTab("streaks")}>Streaks</TabBtn>
        <TabBtn active={tab === "womens"} onClick={() => setTab("womens")} disabled={!whEnabled}>
          {whEnabled ? "Women's" : "🔒 Women's"}
        </TabBtn>
        <TabBtn active={tab === "goal"} onClick={() => setTab("goal")} disabled={!sharedGoal}>
          {sharedGoal ? "Shared Goal" : "🔒 Goal"}
        </TabBtn>
      </div>

      {tab === "streaks" && (
        <>
          {activeStreaks.length > 0 && (
            <button onClick={shareStreaks}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 bg-muted rounded-2xl text-sm font-semibold text-foreground transition active:scale-95">
              <Share2 className="w-4 h-4" />Share {displayName.split(" ")[0]}'s streaks
            </button>
          )}
          {activeStreaks.length > 0 ? (
            <div className="mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current streaks</p>
              <div className="grid grid-cols-2 gap-3">
                {activeStreaks.map((s) => <StreakCard key={s.type} streak={s} />)}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 text-center mb-5">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm font-semibold text-foreground mb-1">No active streaks</p>
              <p className="text-sm text-muted-foreground">{displayName} hasn't logged wellness data yet.</p>
            </div>
          )}
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
        </>
      )}

      {tab === "womens" && whEnabled && <WomensHealthTab partnershipId={partnershipId} partnerName={displayName.split(" ")[0]} />}

      {tab === "goal" && sharedGoal && <SharedGoalTab partnershipId={partnershipId} goal={sharedGoal} partnerName={displayName.split(" ")[0]} />}

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
            <p className="text-xs text-muted-foreground mb-4">They won't be able to see your streaks anymore.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRemove(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground transition active:scale-95">Cancel</button>
              <button onClick={() => removePartner.mutate(partnershipId, { onSuccess: () => navigate("/social") })} disabled={removePartner.isPending}
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

// ── Women's Health tab ────────────────────────────────────────────────────────
function WomensHealthTab({ partnershipId, partnerName }: { partnershipId: number; partnerName: string }) {
  const { data, isLoading } = usePartnerWomensHealth(partnershipId, true);

  if (isLoading) return <Spinner />;
  if (!data?.hasData || !data.isSetUp) return (
    <div className="bg-card border border-border rounded-2xl p-5 text-center">
      <p className="text-3xl mb-2">🌸</p>
      <p className="text-sm text-muted-foreground">{partnerName} hasn't set up Women's Health tracking yet.</p>
    </div>
  );

  if (data.mode === "pregnancy") {
    const trimLabels = ["", "First Trimester", "Second Trimester", "Third Trimester"];
    return (
      <div className="space-y-3">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Pregnancy</p>
          {data.isPostpartum ? (
            <p className="text-lg font-bold text-foreground">Postpartum period 👶</p>
          ) : (
            <>
              <p className="text-2xl font-black text-foreground mb-1">Week {data.weeks}</p>
              <p className="text-sm text-muted-foreground">{trimLabels[data.trimester ?? 1]}</p>
              {data.dueDate && (
                <p className="text-xs text-muted-foreground mt-2">Due: {new Date(data.dueDate + "T12:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground">Only week and trimester are shared — no detailed logs.</p>
      </div>
    );
  }

  // Cycle
  const phaseMeta = data.phase ? PHASE_LABELS[data.phase] : null;
  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current phase</p>
        {phaseMeta ? (
          <div className="flex items-center gap-3">
            <span className="text-3xl">{phaseMeta.emoji}</span>
            <div>
              <p className={cn("text-lg font-bold", phaseMeta.color)}>{phaseMeta.label}</p>
              <p className="text-sm text-muted-foreground">Day {data.cycleDay} of {data.cycleLength}</p>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Phase not available</p>}
      </div>
      {data.daysUntilNextPeriod !== undefined && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-xs text-muted-foreground">Next period in</p>
            <p className="text-base font-bold text-foreground">{data.daysUntilNextPeriod} days</p>
          </div>
        </div>
      )}
      <p className="text-xs text-center text-muted-foreground">Only phase is shared — no logs or detailed data.</p>
    </div>
  );
}

// ── Shared Goal tab ───────────────────────────────────────────────────────────
function SharedGoalTab({ partnershipId, goal, partnerName }: { partnershipId: number; goal: SharedGoal; partnerName: string }) {
  const { data, isLoading } = usePartnerGoalProgress(partnershipId);
  const mod = GOAL_MODULES.find((m) => m.type === goal.module) ?? GOAL_MODULES[0];

  if (isLoading) return <Spinner />;

  const my = data?.myProgress;
  const theirs = data?.partnerProgress;

  function bar(value: number, target: number) {
    return Math.min(100, target > 0 ? (value / target) * 100 : 0);
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 text-center">
        <span className="text-3xl">{mod.emoji}</span>
        <p className="text-base font-bold text-foreground mt-1">{goal.label}</p>
        <p className="text-xs text-muted-foreground">Shared daily goal</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* My side */}
        <div className={cn("rounded-2xl p-4 border", my?.done ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card border-border")}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">You</p>
          <p className="text-3xl font-black text-foreground">{my?.value ?? 0}</p>
          <p className="text-xs text-muted-foreground mb-2">of {goal.target} {mod.unit}</p>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${bar(my?.value ?? 0, goal.target)}%` }} />
          </div>
          {my?.done && <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">Done ✓</p>}
        </div>

        {/* Partner side */}
        <div className={cn("rounded-2xl p-4 border", theirs?.done ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card border-border")}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">{partnerName}</p>
          <p className="text-3xl font-black text-foreground">{theirs?.value ?? 0}</p>
          <p className="text-xs text-muted-foreground mb-2">of {goal.target} {mod.unit}</p>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${bar(theirs?.value ?? 0, goal.target)}%` }} />
          </div>
          {theirs?.done && <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1.5">Done ✓</p>}
        </div>
      </div>

      {my?.done && theirs?.done && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-bold text-foreground">Both done today!</p>
        </div>
      )}
    </div>
  );
}

// ── Shared small components ───────────────────────────────────────────────────
function TabBtn({ children, active, onClick, disabled }: { children: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn("flex-1 py-1.5 rounded-xl text-xs font-semibold transition",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
        disabled && "opacity-50 cursor-default")}>
      {children}
    </button>
  );
}

function StreakCard({ streak }: { streak: StreakItem }) {
  const isHot = streak.streak >= 7;
  return (
    <div className={cn("border rounded-2xl p-4 flex items-center gap-3",
      isHot ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-card border-border")}>
      <span className="text-3xl shrink-0">{streak.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{streak.label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">
          {streak.streak} <span className="text-sm font-normal text-muted-foreground">{streak.streak === 1 ? "day" : "days"}</span>
        </p>
        {isHot && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">🔥 On fire!</p>}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
