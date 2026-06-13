import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, UserPlus, X, Check } from "lucide-react";
import { useGroupDetail, useInviteToGroup, useLeaveGroup, GOAL_MODULES } from "@/lib/social-api";
import { cn } from "@/lib/utils";

export default function GroupPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id, 10);

  const { data, isLoading } = useGroupDetail(isNaN(groupId) ? null : groupId);
  const inviteToGroup = useInviteToGroup();
  const leaveGroup = useLeaveGroup();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [showLeave, setShowLeave] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  if (isLoading) return <Spinner />;
  if (!data) return (
    <div className="px-5 pt-6">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <p className="text-sm text-muted-foreground">Group not found.</p>
    </div>
  );

  const { group, members } = data;
  const mod = GOAL_MODULES.find((m) => m.type === group.goalModule) ?? GOAL_MODULES[0];
  const target = group.goalTarget ?? mod.defaultTarget;
  const allDone = members.every((m) => m.done);
  const doneMemberCount = members.filter((m) => m.done).length;

  function handleInvite() {
    if (!inviteUsername.trim()) return;
    setInviteError("");
    setInviteSuccess("");
    inviteToGroup.mutate({ groupId, username: inviteUsername.trim() }, {
      onSuccess: () => { setInviteSuccess("Invite sent!"); setInviteUsername(""); },
      onError: (e) => setInviteError(e.message),
    });
  }

  function bar(value: number) {
    return Math.min(100, target > 0 ? (value / target) * 100 : 0);
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      {/* Group header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl shrink-0">
          {mod.emoji}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{group.name}</h1>
          <p className="text-xs text-muted-foreground">{group.memberCount} members · {group.goalLabel ?? `${target} ${mod.unit} daily`}</p>
        </div>
      </div>

      {/* Today progress summary */}
      <div className={cn("rounded-2xl p-4 mb-5 text-center border", allDone ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card border-border")}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Today's group progress</p>
        <p className="text-3xl font-black text-foreground">{doneMemberCount}<span className="text-lg font-normal text-muted-foreground">/{members.length}</span></p>
        <p className="text-sm text-muted-foreground">{allDone ? "Everyone hit their goal today! 🎉" : `members done`}</p>
      </div>

      {/* Member list */}
      <div className="space-y-2 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</p>
        {members.map((member, rank) => (
          <div key={member.accountId}
            className={cn("rounded-2xl p-4 border flex items-center gap-3",
              member.isMe ? "bg-primary/5 border-primary/20" : member.done ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card border-border")}>
            {/* Rank */}
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
              rank === 0 ? "bg-amber-400 text-white" : rank === 1 ? "bg-slate-300 text-white" : rank === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground")}>
              {rank + 1}
            </div>
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
              {(member.displayName ?? member.username)[0].toUpperCase()}
            </div>
            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-foreground truncate">{member.displayName ?? member.username}</p>
                {member.isMe && <span className="text-[10px] text-primary font-bold uppercase">You</span>}
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${bar(member.value)}%`, background: member.done ? "#22c55e" : "var(--accent)" }} />
              </div>
            </div>
            {/* Value */}
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">{member.value}/{target}</p>
              <p className="text-[10px] text-muted-foreground">{mod.unit}</p>
            </div>
            {member.done && <Check className="w-4 h-4 text-green-500 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Invite */}
      <button onClick={() => setShowInvite((p) => !p)}
        className="w-full flex items-center justify-center gap-2 py-3 mb-3 border border-border rounded-2xl text-sm font-semibold text-foreground transition active:scale-95">
        <UserPlus className="w-4 h-4" />{showInvite ? "Cancel invite" : "Invite someone"}
      </button>

      {showInvite && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-3 space-y-3">
          <div className="flex gap-2">
            <input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Username…" className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground outline-none" />
            <button onClick={handleInvite} disabled={!inviteUsername.trim() || inviteToGroup.isPending}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold transition active:scale-90 disabled:opacity-50">
              Invite
            </button>
          </div>
          {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          {inviteSuccess && <p className="text-xs text-green-600 dark:text-green-400">{inviteSuccess}</p>}
        </div>
      )}

      {/* Leave */}
      {!showLeave ? (
        <button onClick={() => setShowLeave(true)} className="w-full py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
          Leave group
        </button>
      ) : (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Leave "{group.name}"?</p>
          <p className="text-xs text-muted-foreground mb-4">You can be re-invited anytime.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLeave(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground">Cancel</button>
            <button onClick={() => leaveGroup.mutate(groupId, { onSuccess: () => navigate("/social") })} disabled={leaveGroup.isPending}
              className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {leaveGroup.isPending ? "Leaving…" : "Leave"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
