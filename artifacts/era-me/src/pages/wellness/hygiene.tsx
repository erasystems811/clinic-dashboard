import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react";
import { useSaveModule, useWellnessModules } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

interface HygieneItem {
  id: string;
  name: string;
  emoji: string;
  lastReplaced: string;
  intervalDays: number;
}

const DEFAULTS: Omit<HygieneItem, "id" | "lastReplaced">[] = [
  { name: "Toothbrush", emoji: "🪥", intervalDays: 90 },
  { name: "Shower sponge", emoji: "🧽", intervalDays: 30 },
  { name: "Razor / blade", emoji: "🪒", intervalDays: 14 },
  { name: "Face towel", emoji: "🧣", intervalDays: 7 },
  { name: "Pillow case", emoji: "🛏️", intervalDays: 7 },
];

const ITEM_EMOJIS = ["🪥", "🧽", "🪒", "🧣", "🛏️", "🧴", "💆", "🧼", "👟", "🧤", "📦"];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function statusFor(item: HygieneItem): "overdue" | "soon" | "ok" {
  const age = daysAgo(item.lastReplaced);
  const remaining = item.intervalDays - age;
  if (remaining < 0) return "overdue";
  if (remaining <= Math.ceil(item.intervalDays * 0.2)) return "soon";
  return "ok";
}

const STATUS_STYLES = {
  overdue: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  ok: "text-green-600 dark:text-green-400",
};

export default function HygienePage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { items?: HygieneItem[] }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const saveModule = useSaveModule("hygiene");

  const mod = modules?.hygiene;
  const items: HygieneItem[] = mod?.settings?.items ?? [];
  const enabled = mod?.enabled ?? false;
  const [moduleNotes, setModuleNotes] = useState(((mod?.settings ?? {}) as Record<string, unknown>).notes as string ?? "");

  const [addMode, setAddMode] = useState(false);
  const [editItem, setEditItem] = useState<HygieneItem | null>(null);
  const [draft, setDraft] = useState<HygieneItem>({
    id: crypto.randomUUID(), name: "", emoji: "🧴",
    lastReplaced: new Date().toISOString().split("T")[0], intervalDays: 30,
  });

  function openAdd() {
    setDraft({ id: crypto.randomUUID(), name: "", emoji: "🧴", lastReplaced: new Date().toISOString().split("T")[0], intervalDays: 30 });
    setEditItem(null);
    setAddMode(true);
  }

  function openEdit(item: HygieneItem) {
    setDraft({ ...item });
    setEditItem(item);
    setAddMode(true);
  }

  function saveDraft() {
    if (!draft.name.trim()) return;
    const updated = editItem
      ? items.map((i) => i.id === editItem.id ? draft : i)
      : [...items, draft];
    saveModule.mutate({ settings: { items: updated, notes: moduleNotes }, enabled: true });
    setAddMode(false);
  }

  function deleteItem(id: string) {
    const updated = items.filter((i) => i.id !== id);
    saveModule.mutate({ settings: { items: updated, notes: moduleNotes }, enabled: updated.length > 0 });
  }

  function replaceNow(id: string) {
    const updated = items.map((i) => i.id === id ? { ...i, lastReplaced: new Date().toISOString().split("T")[0] } : i);
    saveModule.mutate({ settings: { items: updated, notes: moduleNotes }, enabled: true });
  }

  function enableDefaults() {
    const today = new Date().toISOString().split("T")[0];
    const defaultItems: HygieneItem[] = DEFAULTS.map((d) => ({ ...d, id: crypto.randomUUID(), lastReplaced: today }));
    saveModule.mutate({ settings: { items: defaultItems, notes: moduleNotes }, enabled: true });
  }

  function savePreferences() {
    saveModule.mutate({ settings: { items, notes: moduleNotes }, enabled });
  }

  if (isLoading) return <Spinner />;

  if (addMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setAddMode(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
        </button>
        <h1 className="text-xl font-bold text-foreground mb-6">{editItem ? "Edit item" : "Add hygiene item"}</h1>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Name</p>
            <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Toothbrush"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Icon</p>
            <div className="flex flex-wrap gap-2">
              {ITEM_EMOJIS.map((e) => (
                <button key={e} onClick={() => setDraft((p) => ({ ...p, emoji: e }))}
                  className={cn("w-10 h-10 rounded-xl text-xl flex items-center justify-center transition",
                    draft.emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted")}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Last replaced</p>
            <input type="date" value={draft.lastReplaced} onChange={(e) => setDraft((p) => ({ ...p, lastReplaced: e.target.value }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Replace every (days)</p>
            <input type="number" min={1} value={draft.intervalDays}
              onChange={(e) => setDraft((p) => ({ ...p, intervalDays: parseInt(e.target.value) || 30 }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>
        </div>

        <button onClick={saveDraft} disabled={!draft.name.trim() || saveModule.isPending}
          className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : editItem ? "Save changes" : "Add item"}
        </button>
      </div>
    );
  }

  if (!enabled || items.length === 0) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-2xl">🪥</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Hygiene Replacements</h1>
            <p className="text-sm text-muted-foreground">Toothbrush, sponge & more</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-5">
          <p className="text-4xl mb-3">🪥🧽🪒</p>
          <p className="font-semibold text-foreground mb-1">Nothing added yet</p>
          <p className="text-sm text-muted-foreground">ERA Health will remind you when each item is due for replacement.</p>
        </div>
        <button onClick={enableDefaults} disabled={saveModule.isPending}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60 mb-3">
          {saveModule.isPending ? "Setting up…" : "Use default items"}
        </button>
        <button onClick={openAdd} className="w-full py-3 border border-border rounded-2xl text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add custom item
        </button>
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => {
    const order = { overdue: 0, soon: 1, ok: 2 };
    return order[statusFor(a)] - order[statusFor(b)];
  });

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🪥</span>
          <h1 className="text-xl font-bold text-foreground">Hygiene Items</h1>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />Add
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
        <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I do my hygiene routine at 7am", "I shower at night"</p>
        <textarea value={moduleNotes} rows={3} onChange={(e) => setModuleNotes(e.target.value)}
          placeholder="Anything that helps us plan better for you..."
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none mb-3" />
        <button onClick={savePreferences} disabled={saveModule.isPending}
          className="w-full py-2.5 bg-muted text-foreground rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>

      <div className="space-y-3">
        {sorted.map((item) => {
          const status = statusFor(item);
          const age = daysAgo(item.lastReplaced);
          const remaining = item.intervalDays - age;
          return (
            <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Last replaced: {item.lastReplaced} · every {item.intervalDays}d</p>
                </div>
                <button onClick={() => openEdit(item)} className="text-xs text-muted-foreground underline shrink-0">Edit</button>
                <button onClick={() => deleteItem(item.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      status === "overdue" ? "bg-red-500" : status === "soon" ? "bg-amber-500" : "bg-green-500")}
                      style={{ width: `${Math.max(0, Math.min(100, (age / item.intervalDays) * 100))}%` }} />
                  </div>
                  <p className={cn("text-xs font-semibold mt-1", STATUS_STYLES[status])}>
                    {status === "overdue" ? `${Math.abs(remaining)}d overdue` : status === "soon" ? `${remaining}d left` : `${remaining}d remaining`}
                  </p>
                </div>
                <button onClick={() => replaceNow(item.id)} disabled={saveModule.isPending}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-2 rounded-xl transition active:scale-95">
                  <RefreshCw className="w-3.5 h-3.5" />Replace now
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
