import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { MessageCircle, BookOpen, Clock, User, Settings, ChevronRight, Trash2, ArrowLeft, Brain, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import type { Account } from "@/contexts/auth-context";
import {
  useCompanionSettings, useDiaryEntries, useStartConversation, useDeleteEntry,
  usePersonality, isCompanionUnlocked, setCompanionUnlocked, useVerifyPin, useSetupCompanion,
  GESTURE_ELEMENTS, gestureLabel, decodeGesture,
} from "@/lib/companion-api";
import { cn } from "@/lib/utils";
import type { DiaryEntry, GestureConfig } from "@/lib/companion-api";
import CompanionIntro from "./intro";

const MOOD_EMOJIS: Record<number, string> = { 1: "😢", 2: "😔", 3: "😐", 4: "😊", 5: "😄" };
type Tab = "me" | "chat" | "journal" | "memories";

// ── Entry point — gates between setup / pin / home ────────────────────────────
export default function CompanionGate() {
  const { account } = useAuth();
  const { data: settings, isLoading } = useCompanionSettings();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (account && isCompanionUnlocked(account.id)) setUnlocked(true);
  }, [account]);

  let content: ReactNode;
  if (isLoading || !account) {
    content = <div className="flex items-center justify-center" style={{ minHeight: "100vh" }}><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  } else if (!settings?.isSetUp) {
    content = <SetupScreen accountId={account.id} />;
  } else if (!unlocked) {
    content = <PinScreen accountId={account.id} onUnlock={() => setUnlocked(true)} />;
  } else if (!settings.introComplete) {
    content = <CompanionIntro
      themeColor={settings.companionThemeColor}
      onComplete={() => { void (async () => { /* refetch settings after intro */ window.location.reload(); })(); }}
    />;
  } else {
    content = <CompanionHome account={account} isBirthday={settings.isBirthday} birthdayAge={settings.birthdayAge}
      companionName={settings.companionName ?? "My Companion"} />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-md mx-auto h-full flex flex-col shadow-2xl">
        {content}
      </div>
    </div>
  );
}

// ── Companion home with tabs ──────────────────────────────────────────────────
function CompanionHome({ account, isBirthday, birthdayAge, companionName }: {
  account: Account; isBirthday: boolean; birthdayAge: number | null; companionName: string;
}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("me");
  const { data: entries, isLoading: entriesLoading } = useDiaryEntries();
  const { data: personalityData } = usePersonality();
  const startConversation = useStartConversation();
  const deleteEntry = useDeleteEntry();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isCreatingConvo, setIsCreatingConvo] = useState(false);
  const { applyCompanionTheme, restoreAppTheme } = useAuth();

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) {
      const g = decodeGesture(raw);
      if (g.themeColor) applyCompanionTheme(g.themeColor, g.darkMode ?? true);
    }
    return restoreAppTheme;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversations = entries?.filter((e) => e.type === "conversation") ?? [];
  const journals = entries?.filter((e) => e.type === "journal") ?? [];

  const age = account.dateOfBirth
    ? Math.floor((Date.now() - new Date(account.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  function handleNewConversation() {
    if (isCreatingConvo || startConversation.isPending) return;
    setIsCreatingConvo(true);
    startConversation.mutate(undefined, {
      onSuccess: ({ entryId }) => navigate(`/companion/chat/${entryId}`),
      onSettled: () => setIsCreatingConvo(false),
    });
  }

  function handleDelete(id: number) {
    setDeletingId(id);
    deleteEntry.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  const TABS: { id: Tab; icon: typeof User; label: string }[] = [
    { id: "me", icon: User, label: "Me" },
    { id: "chat", icon: MessageCircle, label: "Chat" },
    { id: "journal", icon: BookOpen, label: "Journal" },
    { id: "memories", icon: Clock, label: "Memories" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xl">📔</span>
            <h1 className="text-lg font-bold text-foreground">{companionName}</h1>
          </div>
          <button onClick={() => navigate("/companion/settings")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isBirthday && (
          <div className="mb-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 text-white">
            <p className="text-lg font-bold">🎂 Happy birthday!</p>
            {birthdayAge && <p className="text-sm opacity-90 mt-0.5">You're {birthdayAge} today. {companionName} has something special to say.</p>}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted rounded-2xl p-1 mb-0">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[11px] font-semibold transition-all",
                tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-8">
        {tab === "me" && (
          <MeTab account={account} age={age} entries={entries ?? []} personalityData={personalityData}
            onSwitchToChat={() => setTab("chat")} />
        )}
        {tab === "chat" && (
          <ChatTab conversations={conversations} isLoading={entriesLoading}
            onNewConversation={handleNewConversation} isPending={isCreatingConvo || startConversation.isPending}
            onOpen={(id) => navigate(`/companion/chat/${id}`)}
            onDelete={handleDelete} deletingId={deletingId} />
        )}
        {tab === "journal" && (
          <JournalTab journals={journals} isLoading={entriesLoading}
            onNew={() => navigate("/companion/journal/new")}
            onOpen={(id) => navigate(`/companion/journal/${id}`)}
            onDelete={handleDelete} deletingId={deletingId} />
        )}
        {tab === "memories" && (
          <MemoriesTab entries={entries ?? []} isLoading={entriesLoading} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

// ── Me tab ────────────────────────────────────────────────────────────────────
function MeTab({ account, age, entries, personalityData, onSwitchToChat }: {
  account: Account; age: number | null; entries: DiaryEntry[];
  personalityData: { personality: Record<string, unknown>; conversationCount: number; hasInsights: boolean } | undefined;
  onSwitchToChat: () => void;
}) {
  const p = personalityData?.personality ?? {};
  const traits = p.traits as string[] | undefined;
  const values = p.values as string[] | undefined;
  const strengths = p.strengths as string[] | undefined;
  const stressors = p.stressors as string[] | undefined;
  const notes = p.notes as string | undefined;
  const convos = entries.filter((e) => e.type === "conversation").length;
  const journals = entries.filter((e) => e.type === "journal").length;

  const genderDisplay = account.gender === "prefer_not_to_say" ? null : account.gender;
  const avatarEmoji = account.gender === "Female" ? "👩" : account.gender === "Male" ? "👨" : "🧑";

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-3xl">{avatarEmoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-lg truncate">
              {account.displayName ?? account.username}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {age !== null && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {age} yrs
                </span>
              )}
              {genderDisplay && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {genderDisplay}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "All entries", value: entries.length, emoji: "📋" },
          { label: "Conversations", value: convos, emoji: "💬" },
          { label: "Journal entries", value: journals, emoji: "📝" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-xl mb-1">{s.emoji}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Personality profile */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <p className="font-semibold text-foreground text-sm">Personality profile</p>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {personalityData?.conversationCount ?? 0} chats
          </span>
        </div>

        {!personalityData?.hasInsights ? (
          <div className="px-4 py-5 text-center">
            <p className="text-3xl mb-2">💬</p>
            <p className="font-semibold text-foreground text-sm mb-1">Building your profile</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
              Your companion learns who you are through conversation. The more you share, the richer your profile becomes.
            </p>
            <button onClick={onSwitchToChat}
              className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold transition active:scale-95">
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {traits && traits.length > 0 && (
              <TagGroup label="✨ Personality traits" tags={traits} colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" />
            )}
            {strengths && strengths.length > 0 && (
              <TagGroup label="💪 Your strengths" tags={strengths} colorClass="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" />
            )}
            {values && values.length > 0 && (
              <TagGroup label="🌱 What matters to you" tags={values} colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" />
            )}
            {stressors && stressors.length > 0 && (
              <TagGroup label="🌊 What challenges you" tags={stressors} colorClass="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" />
            )}
            {notes && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">🔮 Companion's note</p>
                <p className="text-xs text-foreground leading-relaxed italic">"{notes}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TagGroup({ label, tags, colorClass }: { label: string; tags: string[]; colorClass: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", colorClass)}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Chat tab ──────────────────────────────────────────────────────────────────
function ChatTab({ conversations, isLoading, onNewConversation, isPending, onOpen, onDelete, deletingId }: {
  conversations: DiaryEntry[]; isLoading: boolean;
  onNewConversation: () => void; isPending: boolean;
  onOpen: (id: number) => void; onDelete: (id: number) => void; deletingId: number | null;
}) {
  return (
    <div className="space-y-3">
      <button onClick={onNewConversation} disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm transition active:scale-95 disabled:opacity-60">
        {isPending
          ? <><div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" /> Starting conversation…</>
          : <><Plus className="w-4 h-4" /> New conversation</>}
      </button>

      {isLoading ? (
        <LoadingSpinner />
      ) : conversations.length === 0 ? (
        <EmptyState emoji="💬" text="No conversations yet. Start one above — your companion is ready to listen." />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recent conversations</p>
          {conversations.map((e) => (
            <EntryCard key={e.id} entry={e} onOpen={() => onOpen(e.id)} onDelete={() => onDelete(e.id)} deleting={deletingId === e.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Journal tab ───────────────────────────────────────────────────────────────
function JournalTab({ journals, isLoading, onNew, onOpen, onDelete, deletingId }: {
  journals: DiaryEntry[]; isLoading: boolean;
  onNew: () => void; onOpen: (id: number) => void; onDelete: (id: number) => void; deletingId: number | null;
}) {
  return (
    <div className="space-y-3">
      <button onClick={onNew}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white rounded-2xl font-semibold text-sm transition active:scale-95">
        <Plus className="w-4 h-4" /> New journal entry
      </button>

      {isLoading ? (
        <LoadingSpinner />
      ) : journals.length === 0 ? (
        <EmptyState emoji="📝" text="No journal entries yet. Write what's on your mind — this space is only yours." />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your entries</p>
          {journals.map((e) => (
            <EntryCard key={e.id} entry={e} onOpen={() => onOpen(e.id)} onDelete={() => onDelete(e.id)} deleting={deletingId === e.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Memories tab ──────────────────────────────────────────────────────────────
function MemoriesTab({ entries, isLoading, navigate }: {
  entries: DiaryEntry[]; isLoading: boolean;
  navigate: (path: string) => void;
}) {
  if (isLoading) return <LoadingSpinner />;

  if (entries.length === 0) {
    return <EmptyState emoji="🌟" text="Your memory lane is empty. Every journal entry and conversation will be saved here — like a personal playbook of your journey." />;
  }

  const groups = groupByDate([...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

  return (
    <div className="space-y-5">
      {groups.map(({ label, entries: groupEntries }) => (
        <div key={label}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5">{label}</p>
          <div className="space-y-3">
            {groupEntries.map((e) => (
              <MemoryCard key={e.id} entry={e} onClick={() => navigate(e.type === "conversation" ? `/companion/chat/${e.id}` : `/companion/journal/${e.id}`)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemoryCard({ entry, onClick }: { entry: DiaryEntry; onClick: () => void }) {
  const isConvo = entry.type === "conversation";
  const time = new Date(entry.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <button onClick={onClick} className="w-full text-left transition active:scale-[0.98]">
      <div className={cn(
        "rounded-2xl p-4 border",
        isConvo
          ? "bg-primary/5 border-primary/20"
          : "bg-card border-border"
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-base",
            isConvo ? "bg-primary/10" : "bg-amber-100 dark:bg-amber-900/30"
          )}>
            {isConvo ? "💬" : (entry.mood ? MOOD_EMOJIS[entry.mood] : "📝")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground text-sm truncate">
                {entry.title ?? (isConvo ? "Conversation" : "Journal entry")}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
            </div>
            {entry.preview && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{entry.preview}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function groupByDate(entries: DiaryEntry[]): { label: string; entries: DiaryEntry[] }[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, DiaryEntry[]> = {};

  for (const e of entries) {
    const d = new Date(e.createdAt);
    const ds = d.toDateString();
    let label: string;
    if (ds === todayStr) label = "Today";
    else if (ds === yesterdayStr) label = "Yesterday";
    else if (d >= weekAgo) label = "This week";
    else label = d.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }

  const order = ["Today", "Yesterday", "This week"];
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return 0;
    })
    .map(([label, entries]) => ({ label, entries }));
}

// ── Shared entry card (for Chat and Journal tabs) ─────────────────────────────
function EntryCard({ entry, onOpen, onDelete, deleting }: {
  entry: DiaryEntry; onOpen: () => void; onDelete: () => void; deleting: boolean;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const isConvo = entry.type === "conversation";
  const dateStr = new Date(entry.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={onOpen} className="w-full flex items-center gap-3 p-4 text-left transition active:bg-muted/50">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base",
          isConvo ? "bg-primary/10" : "bg-amber-100 dark:bg-amber-900/30"
        )}>
          {isConvo ? "💬" : (entry.mood ? MOOD_EMOJIS[entry.mood] : "📝")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">
            {entry.title ?? (isConvo ? "Conversation" : "Journal entry")}
          </p>
          {entry.preview && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.preview}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{dateStr}</p>
        </div>
        <button onClick={(ev) => { ev.stopPropagation(); setShowDelete((p) => !p); }}
          className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showDelete && "rotate-90")} />
        </button>
      </button>
      {showDelete && (
        <div className="px-4 pb-3 border-t border-border">
          <button onClick={onDelete} disabled={deleting}
            className="flex items-center gap-2 text-xs font-semibold text-destructive disabled:opacity-50 pt-2.5">
            <Trash2 className="w-3.5 h-3.5" />{deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-3xl mb-3">{emoji}</p>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">{text}</p>
    </div>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────
const COUNTS = [2, 3, 4, 5];

function SetupScreen({ accountId }: { accountId: number }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"intro" | "pin" | "gesture">("intro");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gestureElement, setGestureElement] = useState<GestureConfig["element"]>("coins");
  const [gestureCount, setGestureCount] = useState(3);
  const [error, setError] = useState("");
  const setup = useSetupCompanion();

  function handlePinNext() {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs don't match"); return; }
    setError("");
    setStep("gesture");
  }

  function handleSave(hidden: boolean) {
    setup.mutate({ pin, gestureElement, gestureCount, hidden }, {
      onSuccess: () => {
        const encoded = JSON.stringify({ element: gestureElement, count: gestureCount, hidden });
        localStorage.setItem("era_companion_tab", encoded);
        setCompanionUnlocked(accountId);
        navigate("/companion");
      },
    });
  }

  if (step === "intro") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-16 pb-8 flex flex-col items-center text-center">
        <div className="text-6xl mb-6">📔</div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Your private diary</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm">
          A private space for journaling and conversations. Protected by your PIN.
        </p>
        <div className="space-y-3 w-full text-left mb-8">
          {[
            { icon: "📝", label: "Daily journaling", sub: "Write freely, privately" },
            { icon: "💬", label: "Live conversations", sub: "Your companion listens and remembers" },
            { icon: "🧠", label: "Personality profile", sub: "Learns who you are over time" },
            { icon: "🌟", label: "Memory lane", sub: "Your journey, beautifully saved" },
            { icon: "🔒", label: "PIN protected", sub: "Only you can open it" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4">
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div><p className="font-semibold text-foreground text-sm">{f.label}</p><p className="text-xs text-muted-foreground">{f.sub}</p></div>
            </div>
          ))}
        </div>
        <button onClick={() => setStep("pin")} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95">
          Set it up
        </button>
        <button onClick={() => navigate("/")} className="mt-3 text-sm text-muted-foreground">Maybe later</button>
      </div>
    );
  }

  if (step === "pin") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8">
        <button onClick={() => setStep("intro")} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <h2 className="text-xl font-bold text-foreground mb-1">Set your PIN</h2>
        <p className="text-sm text-muted-foreground mb-6">This PIN protects your diary. You'll enter it every time.</p>
        <PinPad label="Enter a PIN (4+ digits)" value={pin} onChange={setPin} />
        <div className="mt-4" />
        <PinPad label="Confirm PIN" value={confirm} onChange={setConfirm} />
        {error && <p className="text-sm text-destructive text-center mt-3">{error}</p>}
        <button onClick={handlePinNext} disabled={pin.length < 4 || confirm.length < 4}
          className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8">
      <button onClick={() => setStep("pin")} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <h2 className="text-xl font-bold text-foreground mb-1">Secret gesture (optional)</h2>
      <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
        Pick a hidden tap pattern on the home screen to open your diary secretly.
      </p>
      <p className="text-xs text-muted-foreground mb-6">You can skip this — your diary will be visible in quick access instead.</p>

      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">What to tap</p>
      <div className="space-y-2 mb-6">
        {GESTURE_ELEMENTS.map((el) => (
          <button key={el.value} onClick={() => setGestureElement(el.value)}
            className={cn("w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition",
              gestureElement === el.value ? "border-primary bg-primary/5" : "border-border bg-card")}>
            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
              gestureElement === el.value ? "border-primary bg-primary" : "border-muted-foreground")}>
              {gestureElement === el.value && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span className="text-xl shrink-0">{el.emoji}</span>
            <div>
              <p className="font-semibold text-foreground text-sm">{el.label}</p>
              <p className="text-xs text-muted-foreground">Tap {el.hint}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">How many times</p>
      <div className="flex gap-3 mb-8">
        {COUNTS.map((n) => (
          <button key={n} onClick={() => setGestureCount(n)}
            className={cn("flex-1 py-3 rounded-2xl font-bold text-base border-2 transition",
              gestureCount === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")}>
            {n}×
          </button>
        ))}
      </div>

      <div className="bg-muted rounded-2xl p-4 mb-6 text-center">
        <p className="text-xs text-muted-foreground mb-1">Your secret entrance will be</p>
        <p className="font-bold text-foreground text-sm">{gestureLabel({ element: gestureElement, count: gestureCount })}</p>
      </div>

      {setup.error && <p className="text-sm text-destructive text-center mb-3">{setup.error.message}</p>}

      <button onClick={() => handleSave(true)} disabled={setup.isPending}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {setup.isPending ? "Setting up…" : "Save secret & hide diary"}
      </button>
      <button onClick={() => handleSave(false)} disabled={setup.isPending}
        className="w-full mt-3 py-3 rounded-2xl font-semibold text-sm transition active:scale-95 disabled:opacity-60"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
        Skip — keep diary visible in quick access
      </button>
    </div>
  );
}

// ── PIN entry screen ───────────────────────────────────────────────────────────
function PinScreen({ accountId, onUnlock }: { accountId: number; onUnlock: () => void }) {
  const [, navigate] = useLocation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const verify = useVerifyPin();

  const gestureHint = (() => {
    try {
      const raw = localStorage.getItem("era_companion_tab");
      if (!raw) return null;
      return gestureLabel(decodeGesture(raw));
    } catch { return null; }
  })();

  function handleDigit(d: string) {
    if (pin.length >= 8) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      verify.mutate(next, {
        onSuccess: () => { setCompanionUnlocked(accountId); onUnlock(); },
        onError: () => {
          setError("Wrong PIN");
          setShake(true);
          setTimeout(() => { setShake(false); setPin(""); setError(""); }, 700);
        },
      });
    }
  }

  function handleDelete() { setPin((p) => p.slice(0, -1)); }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8 flex flex-col items-center">
      <button onClick={() => window.history.back()} className="self-start flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-bold text-foreground mb-2">Enter your PIN</h2>
      {gestureHint && (
        <p className="text-xs text-muted-foreground mb-6 text-center">
          🔑 Secret: <span className="font-semibold">{gestureHint}</span>
        </p>
      )}
      {!gestureHint && <div className="mb-6" />}

      <div className={cn("flex gap-3 mb-8 transition-all", shake && "animate-bounce")}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <div key={i} className={cn("w-4 h-4 rounded-full border-2 transition-all",
            i < pin.length ? "bg-primary border-primary scale-110" : "border-muted-foreground")} />
        ))}
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d) => (
          d === "" ? <div key="empty" /> :
          d === "⌫" ? (
            <button key="del" onClick={handleDelete}
              className="h-16 rounded-2xl bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground active:scale-95 transition">
              {d}
            </button>
          ) : (
            <button key={d} onClick={() => handleDigit(d)} disabled={verify.isPending}
              className="h-16 rounded-2xl bg-card border border-border flex items-center justify-center text-xl font-bold text-foreground active:scale-95 transition shadow-sm">
              {d}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

// ── Shared PIN pad ────────────────────────────────────────────────────────────
function PinPad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <input type="password" inputMode="numeric" value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="••••"
        className="w-full bg-muted rounded-xl px-4 py-3 text-xl font-bold text-foreground text-center tracking-[0.5em] outline-none" />
    </div>
  );
}
