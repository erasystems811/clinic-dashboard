import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSaveJournal, useUpdateJournal, useDiaryEntry, isCompanionUnlocked } from "@/lib/companion-api";
import { cn } from "@/lib/utils";

const MOODS = [
  { v: 1, emoji: "😢", label: "Sad" },
  { v: 2, emoji: "😔", label: "Low" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "😊", label: "Good" },
  { v: 5, emoji: "😄", label: "Great" },
];

const pageStyle = { background: "var(--bg-base)", minHeight: "100vh" } as const;

export function NewJournalPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const saveJournal = useSaveJournal();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(0);

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  function handleSave() {
    if (!content.trim()) return;
    saveJournal.mutate(
      { title: title.trim() || undefined, content, mood: mood || undefined },
      { onSuccess: (entry) => navigate(`/companion/journal/${entry.id}`) }
    );
  }

  return (
    <div style={pageStyle} className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate("/companion")} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <button onClick={handleSave} disabled={!content.trim() || saveJournal.isPending}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition active:scale-95">
          <Save className="w-4 h-4" />{saveJournal.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {/* How are you feeling */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How are you feeling?</p>
      <div className="flex gap-2 mb-4">
        {MOODS.map((m) => (
          <button key={m.v} onClick={() => setMood(mood === m.v ? 0 : m.v)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition",
              mood === m.v ? "bg-primary/20 ring-2 ring-primary" : "bg-muted")}>
            <span className="text-xl">{m.emoji}</span>
            <span className="text-[9px] text-muted-foreground">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Writing card */}
      <div className="bg-card border border-border rounded-2xl px-4 pt-4 pb-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Give it a title… (optional)"
          className="w-full bg-transparent text-base font-semibold text-foreground outline-none mb-3 placeholder:text-muted-foreground border-b border-border pb-3" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
          placeholder="Write freely. This space is only yours."
          className="w-full bg-transparent text-foreground text-sm leading-relaxed outline-none resize-none placeholder:text-muted-foreground" />
      </div>
    </div>
  );
}

export function JournalViewPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const entryId = parseInt(id, 10);
  const { data: entry, isLoading } = useDiaryEntry(isNaN(entryId) ? undefined : entryId);
  const update = useUpdateJournal(entryId);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState(0);

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    if (entry) {
      setContent(entry.content ?? "");
      setTitle(entry.title ?? "");
      setMood(entry.mood ?? 0);
    }
  }, [entry]);

  function handleUpdate() {
    update.mutate({ title: title.trim() || undefined, content, mood: mood || undefined }, {
      onSuccess: () => setEditing(false),
    });
  }

  if (isLoading) return (
    <div style={pageStyle} className="flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!entry) return (
    <div style={pageStyle} className="px-5 pt-6">
      <p className="text-muted-foreground">Entry not found.</p>
    </div>
  );

  const dateStr = new Date(entry.createdAt).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const moodEmoji = entry.mood ? MOODS[entry.mood - 1]?.emoji : null;

  if (editing) {
    return (
      <div style={pageStyle} className="px-5 pt-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
          </button>
          <button onClick={handleUpdate} disabled={!content.trim() || update.isPending}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition active:scale-95">
            <Save className="w-4 h-4" />{update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="flex gap-2 mb-5">
          {MOODS.map((m) => (
            <button key={m.v} onClick={() => setMood(mood === m.v ? 0 : m.v)}
              className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition",
                mood === m.v ? "bg-primary/20 ring-2 ring-primary" : "bg-muted")}>
              <span className="text-xl">{m.emoji}</span>
            </button>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl px-4 pt-4 pb-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-transparent text-base font-semibold text-foreground outline-none mb-3 placeholder:text-muted-foreground border-b border-border pb-3" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
            className="w-full bg-transparent text-foreground text-sm leading-relaxed outline-none resize-none" />
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle} className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/companion")} className="flex items-center gap-1.5 text-muted-foreground -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <button onClick={() => setEditing(true)} className="text-sm font-semibold text-primary">Edit</button>
      </div>

      <p className="text-xs text-muted-foreground mb-1">{dateStr}</p>
      {moodEmoji && <span className="text-2xl mb-3 block">{moodEmoji}</span>}
      {entry.title && <h1 className="text-xl font-bold text-foreground mb-4">{entry.title}</h1>}

      <div className="bg-card border border-border rounded-2xl px-4 py-5">
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      </div>
    </div>
  );
}
