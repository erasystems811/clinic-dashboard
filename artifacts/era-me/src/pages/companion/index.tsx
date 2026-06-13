import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { BookOpen, MessageCircle, Brain, Settings, Trash2, ChevronRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanionSettings, useDiaryEntries, useStartConversation, useDeleteEntry,
  isCompanionUnlocked, setCompanionUnlocked, useVerifyPin, useSetupCompanion,
  GESTURE_ELEMENTS, gestureLabel, decodeGesture,
} from "@/lib/companion-api";
import { cn } from "@/lib/utils";
import type { DiaryEntry, GestureConfig } from "@/lib/companion-api";

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
  } else {
    content = <CompanionHome isBirthday={settings.isBirthday} birthdayAge={settings.birthdayAge} />;
  }

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <div className="max-w-md mx-auto shadow-2xl" style={{ minHeight: "100vh" }}>
        {content}
      </div>
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
      <div className="px-5 pt-16 pb-8 flex flex-col items-center text-center">
        <div className="text-6xl mb-6">📔</div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Your private diary</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-sm">
          A private space for journaling and conversations. Protected by your PIN. You can optionally hide it with a secret gesture only you know.
        </p>
        <div className="space-y-3 w-full text-left mb-8">
          {[
            { icon: "📝", label: "Daily journaling", sub: "Write freely, privately" },
            { icon: "💬", label: "Live conversations", sub: "Your companion listens and remembers" },
            { icon: "🧠", label: "Personality profile", sub: "Learns who you are over time" },
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
      <div className="px-5 pt-6 pb-8">
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

  // step === "gesture"
  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => setStep("pin")} className="flex items-center gap-1.5 text-muted-foreground mb-8 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <h2 className="text-xl font-bold text-foreground mb-1">Secret gesture (optional)</h2>
      <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
        Pick a hidden tap pattern on the home screen to open your diary secretly. Only you will know what it does.
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
        onSuccess: () => {
          setCompanionUnlocked(accountId);
          onUnlock();
        },
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
    <div className="px-5 pt-6 pb-8 flex flex-col items-center">
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
            i < pin.length ? "bg-primary border-primary scale-110" : "border-muted-foreground")}>
          </div>
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

// ── Companion home ─────────────────────────────────────────────────────────────
function CompanionHome({ isBirthday, birthdayAge }: { isBirthday: boolean; birthdayAge: number | null }) {
  const [, navigate] = useLocation();
  const { data: entries, isLoading } = useDiaryEntries();
  const startConversation = useStartConversation();
  const deleteEntry = useDeleteEntry();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function handleNewConversation() {
    startConversation.mutate(undefined, {
      onSuccess: ({ entryId }) => navigate(`/companion/chat/${entryId}`),
    });
  }

  function handleDelete(id: number) {
    setDeletingId(id);
    deleteEntry.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📔</span>
          <h1 className="text-xl font-bold text-foreground">My Diary</h1>
        </div>
        <button onClick={() => navigate("/companion/settings")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Birthday banner */}
      {isBirthday && (
        <div className="mb-5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 text-white">
          <p className="text-lg font-bold">🎂 Happy birthday!</p>
          {birthdayAge && <p className="text-sm opacity-90 mt-0.5">You're {birthdayAge} today. Start a conversation — your companion has something to say.</p>}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => navigate("/companion/journal/new")}
          className="flex flex-col items-center gap-2 bg-card border border-border rounded-2xl p-4 transition active:scale-95">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">New journal</p>
        </button>
        <button onClick={handleNewConversation} disabled={startConversation.isPending}
          className="flex flex-col items-center gap-2 bg-card border border-border rounded-2xl p-4 transition active:scale-95 disabled:opacity-60">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {startConversation.isPending
              ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <MessageCircle className="w-5 h-5 text-primary" />}
          </div>
          <p className="text-sm font-semibold text-foreground">Start conversation</p>
        </button>
      </div>

      {/* Personality link */}
      <button onClick={() => navigate("/companion/personality")}
        className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 mb-6 transition active:scale-95">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">Personality profile</p>
          <p className="text-xs text-muted-foreground">What your companion knows about you</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Entries list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : entries && entries.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent entries</p>
          <div className="space-y-2">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onOpen={() => navigate(e.type === "conversation" ? `/companion/chat/${e.id}` : `/companion/journal/${e.id}`)}
                onDelete={() => handleDelete(e.id)} deleting={deletingId === e.id} formatDate={formatDate} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nothing yet. Write your first journal entry or start a conversation.</p>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, onOpen, onDelete, deleting, formatDate }: {
  entry: DiaryEntry; onOpen: () => void; onDelete: () => void; deleting: boolean;
  formatDate: (s: string) => string;
}) {
  const [showDelete, setShowDelete] = useState(false);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={onOpen} className="w-full flex items-center gap-3 p-4 text-left transition active:bg-muted">
        <span className="text-xl shrink-0">{entry.type === "conversation" ? "💬" : "📝"}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{entry.title ?? formatDate(entry.createdAt)}</p>
          {entry.preview && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.preview}</p>}
          <p className="text-[10px] text-muted-foreground mt-1">{formatDate(entry.createdAt)}</p>
        </div>
        <button onClick={(ev) => { ev.stopPropagation(); ev.preventDefault(); setShowDelete((p) => !p); }}
          className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition", showDelete && "rotate-90")} />
        </button>
      </button>
      {showDelete && (
        <div className="px-4 pb-3 pt-0 border-t border-border">
          <button onClick={onDelete} disabled={deleting}
            className="flex items-center gap-2 text-xs font-semibold text-destructive disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />{deleting ? "Deleting…" : "Delete this entry"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared PIN pad component ───────────────────────────────────────────────────
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
