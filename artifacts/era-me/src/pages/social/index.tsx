import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Share2, Users, UserPlus, ChevronRight, Check, X, Plus } from "lucide-react";
import {
  useMyStreaks, usePartners, useSearchUsers, useSendRequest,
  useAcceptRequest, useDeclineRequest, useRemovePartner,
  useMyGroups, useCreateGroup, useAcceptGroupInvite, useDeclineGroupInvite,
  GOAL_MODULES,
} from "@/lib/social-api";
import type { StreakItem, SearchResult, Group } from "@/lib/social-api";
import { cn } from "@/lib/utils";

export default function SocialPage() {
  const [, navigate] = useLocation();
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { data: myStreaksData } = useMyStreaks();
  const { data: partnerData, isLoading: partnersLoading } = usePartners();
  const { data: groupData } = useMyGroups();
  const { data: searchResults, isLoading: searching } = useSearchUsers(searchQ);
  const sendRequest = useSendRequest();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const removePartner = useRemovePartner();
  const acceptGroupInvite = useAcceptGroupInvite();
  const declineGroupInvite = useDeclineGroupInvite();

  const myStreaks = myStreaksData?.streaks ?? [];
  const topStreaks = myStreaks.filter((s) => s.streak > 0).slice(0, 6);

  if (showCreateGroup) return <CreateGroupFlow onBack={() => setShowCreateGroup(false)} onDone={(id) => { setShowCreateGroup(false); navigate(`/social/group/${id}`); }} />;

  function shareStreaks() {
    if (!topStreaks.length) return;
    const lines = topStreaks.map((s) => `${s.emoji} ${s.label}: ${s.streak} day${s.streak !== 1 ? "s" : ""}`);
    const text = `My ERA Health wellness streaks 💪\n\n${lines.join("\n")}\n\nTrack yours at erasystems.io`;
    if (navigator.share) void navigator.share({ title: "My ERA Health Streaks", text });
    else void navigator.clipboard.writeText(text);
  }

  function avatarLetter(p: { username: string; displayName: string | null }) {
    return (p.displayName ?? p.username)[0].toUpperCase();
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">👥</span>
        <h1 className="text-xl font-bold text-foreground">Social</h1>
      </div>

      {/* My Streaks */}
      {topStreaks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your streaks</p>
            <button onClick={shareStreaks} className="flex items-center gap-1.5 text-xs font-semibold text-primary transition active:scale-95">
              <Share2 className="w-3.5 h-3.5" />Share
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {topStreaks.map((s) => <StreakCard key={s.type} streak={s} />)}
          </div>
        </div>
      )}

      {/* Group invites */}
      {(groupData?.invites.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Group invites ({groupData!.invites.length})</p>
          <div className="space-y-2">
            {groupData!.invites.map((g) => (
              <div key={g.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  {GOAL_MODULES.find((m) => m.type === g.goalModule)?.emoji ?? "💪"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.memberCount} members · {g.goalLabel}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => declineGroupInvite.mutate(g.id)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => acceptGroupInvite.mutate(g.id, { onSuccess: () => navigate(`/social/group/${g.id}`) })} className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"><Check className="w-4 h-4 text-primary-foreground" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partner requests */}
      {(partnerData?.incoming.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Partner requests ({partnerData!.incoming.length})</p>
          <div className="space-y-2">
            {partnerData!.incoming.map((req) => (
              <div key={req.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <Avatar letter={avatarLetter(req.from)} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{req.from.displayName ?? req.from.username}</p>
                  <p className="text-xs text-muted-foreground">@{req.from.username} wants to partner with you</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => declineRequest.mutate(req.id)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => acceptRequest.mutate(req.id)} className="w-9 h-9 rounded-full bg-primary flex items-center justify-center"><Check className="w-4 h-4 text-primary-foreground" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partners */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Partners {partnerData?.partners.length ? `(${partnerData.partners.length})` : ""}
          </p>
          <button onClick={() => setShowSearch((p) => !p)} className="flex items-center gap-1.5 text-xs font-semibold text-primary transition active:scale-95">
            <UserPlus className="w-3.5 h-3.5" />{showSearch ? "Cancel" : "Add partner"}
          </button>
        </div>

        {showSearch && (
          <div className="mb-3">
            <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-3 mb-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by username…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" autoFocus />
              {searchQ && <button onClick={() => setSearchQ("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
            </div>
            {searchQ.trim().length >= 2 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {searching ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : searchResults?.length ? (
                  searchResults.map((user) => (
                    <SearchResultRow key={user.id} user={user} onSend={() => sendRequest.mutate(user.username)} isSending={sendRequest.isPending} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-5">No users found for "{searchQ}"</p>
                )}
              </div>
            )}
          </div>
        )}

        {(partnerData?.outgoing.length ?? 0) > 0 && (
          <div className="space-y-2 mb-3">
            {partnerData!.outgoing.map((req) => (
              <div key={req.id} className="bg-muted rounded-2xl p-4 flex items-center gap-3">
                <Avatar letter={avatarLetter(req.to)} muted />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{req.to.displayName ?? req.to.username}</p>
                  <p className="text-xs text-muted-foreground">Request pending…</p>
                </div>
                <button onClick={() => removePartner.mutate(req.id)} className="text-xs text-muted-foreground font-medium">Cancel</button>
              </div>
            ))}
          </div>
        )}

        {partnersLoading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : partnerData?.partners.length ? (
          <div className="space-y-2">
            {partnerData.partners.map((p) => (
              <PartnerRow key={p.id}
                partnershipId={p.id} partner={p.other} since={p.since}
                hasSharedGoal={!!p.sharedGoal} hasWomensHealth={p.sharedModules.includes("womens_health")}
                onView={() => navigate(`/social/partner/${p.id}`)}
                onRemove={() => removePartner.mutate(p.id)} removing={removePartner.isPending}
                letter={avatarLetter(p.other)}
              />
            ))}
          </div>
        ) : !showSearch && (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"><Users className="w-6 h-6 text-muted-foreground" /></div>
            <p className="text-sm font-semibold text-foreground mb-1">No partners yet</p>
            <p className="text-sm text-muted-foreground">Add a partner to share streaks and set goals together.</p>
            <button onClick={() => setShowSearch(true)} className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">Find a partner</button>
          </div>
        )}
      </div>

      {/* Groups */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Groups {groupData?.groups.length ? `(${groupData.groups.length})` : ""}
          </p>
          <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-1.5 text-xs font-semibold text-primary transition active:scale-95">
            <Plus className="w-3.5 h-3.5" />Create group
          </button>
        </div>

        {groupData?.groups.length ? (
          <div className="space-y-2">
            {groupData.groups.map((g) => <GroupRow key={g.id} group={g} onView={() => navigate(`/social/group/${g.id}`)} />)}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-sm font-semibold text-foreground mb-1">No groups yet</p>
            <p className="text-sm text-muted-foreground">Create a group to track a shared goal with multiple people.</p>
            <button onClick={() => setShowCreateGroup(true)} className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">Create a group</button>
          </div>
        )}
      </div>

      <div className="bg-muted rounded-2xl p-4">
        <p className="text-xs font-semibold text-foreground mb-1.5">📌 How accountability works</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Partners see your wellness streaks — just the counts, nothing private. You can also share your cycle phase or set a shared goal to track together. Groups let 3+ people work toward the same target.
        </p>
      </div>
    </div>
  );
}

// ── Create group flow ─────────────────────────────────────────────────────────
function CreateGroupFlow({ onBack, onDone }: { onBack: () => void; onDone: (id: number) => void }) {
  const [step, setStep] = useState<"name" | "goal" | "confirm">("name");
  const [groupName, setGroupName] = useState("");
  const [selectedMod, setSelectedMod] = useState(GOAL_MODULES[0]);
  const [target, setTarget] = useState(GOAL_MODULES[0].defaultTarget);
  const createGroup = useCreateGroup();

  function handleModChange(mod: typeof GOAL_MODULES[0]) {
    setSelectedMod(mod);
    setTarget(mod.defaultTarget);
  }

  function handleCreate() {
    const label = `${target} ${selectedMod.unit} ${selectedMod.label.toLowerCase()} daily`;
    createGroup.mutate({ name: groupName, goalModule: selectedMod.type, goalTarget: target, goalLabel: label }, {
      onSuccess: (data) => onDone(data.groupId),
    });
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={step === "name" ? onBack : () => setStep(step === "confirm" ? "goal" : "name")}
        className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">{step === "name" ? "Cancel" : "Back"}</span>
      </button>

      {step === "name" && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-1">Create a group</h2>
          <p className="text-sm text-muted-foreground mb-6">Give your group a name</p>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Water Warriors, Morning Crew…" maxLength={50}
            className="w-full bg-muted rounded-2xl px-4 py-4 text-lg font-bold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal mb-6" />
          <button onClick={() => setStep("goal")} disabled={!groupName.trim()}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
            Next: Pick a goal
          </button>
        </>
      )}

      {step === "goal" && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-1">Choose a shared goal</h2>
          <p className="text-sm text-muted-foreground mb-5">Everyone in the group will work toward this daily</p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {GOAL_MODULES.map((m) => (
              <button key={m.type} onClick={() => handleModChange(m)}
                className={cn("flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition",
                  selectedMod.type === m.type ? "border-primary bg-primary/5" : "border-border bg-card")}>
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-xs font-semibold text-foreground">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Target: {target} {selectedMod.unit}</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setTarget((p) => Math.max(1, p - 1))} className="w-12 h-12 rounded-xl bg-muted font-bold text-xl text-foreground transition active:scale-90">−</button>
              <p className="flex-1 text-center text-3xl font-black text-foreground">{target}</p>
              <button onClick={() => setTarget((p) => p + 1)} className="w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl transition active:scale-90">+</button>
            </div>
          </div>

          <button onClick={() => setStep("confirm")}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95">
            Next: Review
          </button>
        </>
      )}

      {step === "confirm" && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-6">Review your group</h2>
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">{selectedMod.emoji}</div>
              <div>
                <p className="font-bold text-foreground text-lg">{groupName}</p>
                <p className="text-sm text-muted-foreground">{target} {selectedMod.unit} {selectedMod.label.toLowerCase()} daily</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You'll be added automatically. Invite others after creating the group.</p>
          </div>
          <button onClick={handleCreate} disabled={createGroup.isPending}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
            {createGroup.isPending ? "Creating…" : "Create group"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function StreakCard({ streak }: { streak: StreakItem }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-1">
      <span className="text-2xl">{streak.emoji}</span>
      <span className="text-2xl font-bold text-foreground leading-none">{streak.streak}</span>
      <span className="text-[10px] text-muted-foreground">{streak.streak === 1 ? "day" : "days"}</span>
      <span className="text-[10px] text-foreground font-medium">{streak.label}</span>
    </div>
  );
}

function Avatar({ letter, muted = false }: { letter: string; muted?: boolean }) {
  return (
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base font-bold", muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
      {letter}
    </div>
  );
}

function SearchResultRow({ user, onSend, isSending }: { user: SearchResult; onSend: () => void; isSending: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <Avatar letter={(user.displayName ?? user.username)[0].toUpperCase()} muted />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{user.displayName ?? user.username}</p>
        <p className="text-xs text-muted-foreground">@{user.username}</p>
      </div>
      {user.status === "accepted" ? <span className="text-xs font-semibold text-green-600 dark:text-green-400">Partners ✓</span>
        : user.status === "pending_sent" ? <span className="text-xs text-muted-foreground">Pending…</span>
        : user.status === "pending_received" ? <span className="text-xs text-muted-foreground">Sent you a request</span>
        : <button onClick={onSend} disabled={isSending} className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50"><UserPlus className="w-3.5 h-3.5" />Add</button>}
    </div>
  );
}

function PartnerRow({ partnershipId, partner, since, hasSharedGoal, hasWomensHealth, onView, onRemove, removing, letter }: {
  partnershipId: number; partner: { username: string; displayName: string | null };
  since: string; hasSharedGoal: boolean; hasWomensHealth: boolean;
  onView: () => void; onRemove: () => void; removing: boolean; letter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const daysTogether = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={onView} className="w-full flex items-center gap-3 p-4 text-left transition active:bg-muted">
        <Avatar letter={letter} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{partner.displayName ?? partner.username}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">@{partner.username} · {daysTogether === 0 ? "Today" : `${daysTogether}d`}</p>
            {hasSharedGoal && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">Shared goal</span>}
            {hasWomensHealth && <span className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-semibold">🌸 Health</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-primary">View</span>
          <button onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition", expanded && "rotate-90")} />
          </button>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-border">
          <button onClick={onRemove} disabled={removing} className="text-xs font-semibold text-destructive mt-2.5 disabled:opacity-50">
            {removing ? "Removing…" : "Remove partner"}
          </button>
        </div>
      )}
    </div>
  );
}

function GroupRow({ group, onView }: { group: Group; onView: () => void }) {
  const mod = GOAL_MODULES.find((m) => m.type === group.goalModule) ?? GOAL_MODULES[0];
  return (
    <button onClick={onView} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left transition active:bg-muted">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">{mod.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
        <p className="text-xs text-muted-foreground">{group.memberCount} members · {group.goalLabel ?? `${group.goalTarget} ${mod.unit}`}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
