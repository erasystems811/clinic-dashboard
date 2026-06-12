import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Share2, Users, UserPlus, ChevronRight, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useMyStreaks, usePartners, useSearchUsers, useSendRequest,
  useAcceptRequest, useDeclineRequest, useRemovePartner,
} from "@/lib/social-api";
import type { StreakItem, SearchResult } from "@/lib/social-api";
import { cn } from "@/lib/utils";

export default function SocialPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const { data: myStreaksData } = useMyStreaks();
  const { data: partnerData, isLoading: partnersLoading } = usePartners();
  const { data: searchResults, isLoading: searching } = useSearchUsers(searchQ);
  const sendRequest = useSendRequest();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const removePartner = useRemovePartner();

  const myStreaks = myStreaksData?.streaks ?? [];
  const topStreaks = myStreaks.filter((s) => s.streak > 0).slice(0, 6);

  function shareStreaks() {
    if (topStreaks.length === 0) return;
    const lines = topStreaks.map((s) => `${s.emoji} ${s.label}: ${s.streak} day${s.streak !== 1 ? "s" : ""}`);
    const text = `My ERA Health wellness streaks 💪\n\n${lines.join("\n")}\n\nTrack yours at erasystems.io`;
    if (navigator.share) {
      void navigator.share({ title: "My ERA Health Streaks", text });
    } else {
      void navigator.clipboard.writeText(text);
    }
  }

  function handleSendRequest(username: string) {
    sendRequest.mutate(username);
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
            <button onClick={shareStreaks}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary transition active:scale-95">
              <Share2 className="w-3.5 h-3.5" />Share
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {topStreaks.map((s) => (
              <StreakCard key={s.type} streak={s} />
            ))}
          </div>
        </div>
      )}

      {/* Pending incoming requests */}
      {(partnerData?.incoming.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Partner requests ({partnerData!.incoming.length})
          </p>
          <div className="space-y-2">
            {partnerData!.incoming.map((req) => (
              <div key={req.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <Avatar letter={avatarLetter(req.from)} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{req.from.displayName ?? req.from.username}</p>
                  <p className="text-xs text-muted-foreground">@{req.from.username} wants to partner with you</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => declineRequest.mutate(req.id)} disabled={declineRequest.isPending}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center transition active:scale-90">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => acceptRequest.mutate(req.id)} disabled={acceptRequest.isPending}
                    className="w-9 h-9 rounded-full bg-primary flex items-center justify-center transition active:scale-90">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partners list */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Accountability partners {partnerData?.partners.length ? `(${partnerData.partners.length})` : ""}
          </p>
          <button onClick={() => setShowSearch((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary transition active:scale-95">
            <UserPlus className="w-3.5 h-3.5" />{showSearch ? "Cancel" : "Add partner"}
          </button>
        </div>

        {/* Search box */}
        {showSearch && (
          <div className="mb-3">
            <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-3 mb-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search by username…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className="shrink-0">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {searchQ.trim().length >= 2 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {searching ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <SearchResultRow key={user.id} user={user}
                      onSend={() => handleSendRequest(user.username)}
                      isSending={sendRequest.isPending}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-5">No users found for "{searchQ}"</p>
                )}
              </div>
            )}
            {searchQ.trim().length > 0 && searchQ.trim().length < 2 && (
              <p className="text-xs text-muted-foreground text-center py-2">Keep typing…</p>
            )}
          </div>
        )}

        {/* Outgoing pending */}
        {(partnerData?.outgoing.length ?? 0) > 0 && (
          <div className="space-y-2 mb-3">
            {partnerData!.outgoing.map((req) => (
              <div key={req.id} className="bg-muted rounded-2xl p-4 flex items-center gap-3">
                <Avatar letter={avatarLetter(req.to)} muted />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{req.to.displayName ?? req.to.username}</p>
                  <p className="text-xs text-muted-foreground">Request pending…</p>
                </div>
                <button onClick={() => removePartner.mutate(req.id)} disabled={removePartner.isPending}
                  className="text-xs text-muted-foreground font-medium transition active:scale-95">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Accepted partners */}
        {partnersLoading ? (
          <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : partnerData?.partners.length ? (
          <div className="space-y-2">
            {partnerData.partners.map((p) => (
              <PartnerRow key={p.id}
                partnershipId={p.id}
                partner={p.other}
                since={p.since}
                onView={() => navigate(`/social/partner/${p.id}`)}
                onRemove={() => removePartner.mutate(p.id)}
                removing={removePartner.isPending}
                letter={avatarLetter(p.other)}
              />
            ))}
          </div>
        ) : !showSearch && (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No partners yet</p>
            <p className="text-sm text-muted-foreground">Add an accountability partner to share streaks and stay motivated.</p>
            <button onClick={() => setShowSearch(true)}
              className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">
              Find a partner
            </button>
          </div>
        )}
      </div>

      {/* What is this? */}
      <div className="bg-muted rounded-2xl p-4">
        <p className="text-xs font-semibold text-foreground mb-1.5">📌 How accountability partners work</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your partner can see your wellness streaks — just the counts, nothing else. No logs, no detailed data.
          Knowing someone can see your progress is one of the most effective ways to stay consistent.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base font-bold",
      muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
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
      {user.status === "accepted" ? (
        <span className="text-xs font-semibold text-green-600 dark:text-green-400">Partners ✓</span>
      ) : user.status === "pending_sent" ? (
        <span className="text-xs text-muted-foreground">Pending…</span>
      ) : user.status === "pending_received" ? (
        <span className="text-xs text-muted-foreground">Sent you a request</span>
      ) : (
        <button onClick={onSend} disabled={isSending}
          className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50 transition active:scale-95">
          <UserPlus className="w-3.5 h-3.5" />Add
        </button>
      )}
    </div>
  );
}

function PartnerRow({ partnershipId, partner, since, onView, onRemove, removing, letter }: {
  partnershipId: number; partner: { username: string; displayName: string | null };
  since: string; onView: () => void; onRemove: () => void; removing: boolean; letter: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sinceDate = new Date(since);
  const daysTogether = Math.floor((Date.now() - sinceDate.getTime()) / 86400000);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={onView} className="w-full flex items-center gap-3 p-4 text-left transition active:bg-muted">
        <Avatar letter={letter} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{partner.displayName ?? partner.username}</p>
          <p className="text-xs text-muted-foreground">
            @{partner.username} · {daysTogether === 0 ? "Connected today" : `${daysTogether} day${daysTogether !== 1 ? "s" : ""} together`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-primary">View streaks</span>
          <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded((p) => !p); }}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition", expanded && "rotate-90")} />
          </button>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-border">
          <button onClick={onRemove} disabled={removing}
            className="text-xs font-semibold text-destructive mt-2.5 disabled:opacity-50">
            {removing ? "Removing…" : "Remove partner"}
          </button>
        </div>
      )}
    </div>
  );
}
