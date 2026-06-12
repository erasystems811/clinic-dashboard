import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useSaveModule, useWellnessModules } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

interface Checkup {
  id: string;
  type: string;
  lastDate: string;
  intervalMonths: number;
}

const CHECKUP_TYPES = [
  { label: "Dental", emoji: "🦷", intervalMonths: 6 },
  { label: "Eye / Vision", emoji: "👁️", intervalMonths: 12 },
  { label: "GP / General", emoji: "🩺", intervalMonths: 12 },
  { label: "Blood Test", emoji: "🩸", intervalMonths: 12 },
  { label: "Blood Pressure", emoji: "💗", intervalMonths: 6 },
  { label: "Cancer Screening", emoji: "🔬", intervalMonths: 12 },
  { label: "Skin Check", emoji: "🧴", intervalMonths: 12 },
  { label: "Custom", emoji: "📋", intervalMonths: 12 },
];

function nextDueDate(lastDate: string, intervalMonths: number): string {
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + intervalMonths);
  return d.toISOString().split("T")[0];
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function statusFor(c: Checkup): "overdue" | "soon" | "ok" {
  const days = daysUntil(nextDueDate(c.lastDate, c.intervalMonths));
  if (days < 0) return "overdue";
  if (days <= 60) return "soon";
  return "ok";
}

const STATUS_STYLES = {
  overdue: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  soon: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  ok: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
};

export default function CheckupsPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { checkups?: Checkup[] }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const saveModule = useSaveModule("checkups");

  const mod = modules?.checkups;
  const checkups: Checkup[] = mod?.settings?.checkups ?? [];
  const enabled = mod?.enabled ?? false;

  const [addMode, setAddMode] = useState(false);
  const [editCheckup, setEditCheckup] = useState<Checkup | null>(null);
  const [draft, setDraft] = useState<Checkup>({
    id: crypto.randomUUID(), type: "", lastDate: new Date().toISOString().split("T")[0], intervalMonths: 12,
  });

  function openAdd() {
    setDraft({ id: crypto.randomUUID(), type: "", lastDate: new Date().toISOString().split("T")[0], intervalMonths: 12 });
    setEditCheckup(null);
    setAddMode(true);
  }

  function openEdit(c: Checkup) {
    setDraft({ ...c });
    setEditCheckup(c);
    setAddMode(true);
  }

  function saveDraft() {
    if (!draft.type.trim()) return;
    const updated = editCheckup
      ? checkups.map((c) => c.id === editCheckup.id ? draft : c)
      : [...checkups, draft];
    saveModule.mutate({ settings: { checkups: updated }, enabled: true });
    setAddMode(false);
  }

  function deleteCheckup(id: string) {
    const updated = checkups.filter((c) => c.id !== id);
    saveModule.mutate({ settings: { checkups: updated }, enabled: updated.length > 0 });
  }

  if (isLoading) return <Spinner />;

  if (addMode) {
    const preset = CHECKUP_TYPES.find((t) => t.label === draft.type);
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setAddMode(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
        </button>
        <h1 className="text-xl font-bold text-foreground mb-6">{editCheckup ? "Edit checkup" : "Add checkup"}</h1>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {CHECKUP_TYPES.map((t) => (
                <button key={t.label}
                  onClick={() => setDraft((p) => ({ ...p, type: t.label, intervalMonths: t.intervalMonths }))}
                  className={cn("flex items-center gap-2 p-3 rounded-xl text-sm font-semibold text-left transition",
                    draft.type === t.label ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
            {draft.type === "Custom" && (
              <input value={draft.type === "Custom" ? "" : draft.type}
                onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
                placeholder="Enter checkup name"
                className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Last done</p>
            <input type="date" value={draft.lastDate} onChange={(e) => setDraft((p) => ({ ...p, lastDate: e.target.value }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Repeat every (months) — suggested: {preset?.intervalMonths ?? 12}
            </p>
            <input type="number" min={1} value={draft.intervalMonths}
              onChange={(e) => setDraft((p) => ({ ...p, intervalMonths: parseInt(e.target.value) || 12 }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </div>

          {draft.lastDate && draft.intervalMonths && (
            <div className="bg-muted rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">Next due: <strong className="text-foreground">{nextDueDate(draft.lastDate, draft.intervalMonths)}</strong></p>
            </div>
          )}
        </div>

        <button onClick={saveDraft} disabled={!draft.type.trim() || saveModule.isPending}
          className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : editCheckup ? "Save changes" : "Add checkup"}
        </button>
      </div>
    );
  }

  if (!enabled || checkups.length === 0) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-2xl">🏥</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Annual Checkups</h1>
            <p className="text-sm text-muted-foreground">Dental, eye, GP & more</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-6">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-semibold text-foreground mb-1">No checkups added</p>
          <p className="text-sm text-muted-foreground">Add your routine checkups and ERA Health will tell you when each one is due again.</p>
        </div>
        <button onClick={openAdd} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" />Add a checkup
        </button>
      </div>
    );
  }

  const sorted = [...checkups].sort((a, b) => {
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
          <span className="text-3xl">🏥</span>
          <h1 className="text-xl font-bold text-foreground">Annual Checkups</h1>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />Add
        </button>
      </div>

      <div className="space-y-3">
        {sorted.map((c) => {
          const status = statusFor(c);
          const next = nextDueDate(c.lastDate, c.intervalMonths);
          const days = daysUntil(next);
          const preset = CHECKUP_TYPES.find((t) => t.label === c.type);
          return (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl shrink-0">{preset?.emoji ?? "📋"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{c.type}</p>
                <p className="text-xs text-muted-foreground">Last: {c.lastDate} · every {c.intervalMonths}mo</p>
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block", STATUS_STYLES[status])}>
                  {status === "overdue" ? `Overdue ${Math.abs(days)}d ago` : status === "soon" ? `Due in ${days} days` : `Next: ${next}`}
                </span>
              </div>
              <button onClick={() => openEdit(c)} className="text-xs text-muted-foreground underline shrink-0">Edit</button>
              <button onClick={() => deleteCheckup(c.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
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
