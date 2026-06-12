import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useSaveModule, useWellnessModules } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

interface Vaccine {
  id: string;
  name: string;
  dateReceived: string;
  nextDueDate?: string;
  notes?: string;
}

const COMMON_VACCINES = [
  "COVID-19", "Influenza (Flu)", "Hepatitis B", "Hepatitis A",
  "Yellow Fever", "Typhoid", "Tetanus (Td/Tdap)", "Meningitis",
  "HPV", "Pneumococcal", "Cholera", "Rabies",
];

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function statusFor(v: Vaccine): "overdue" | "soon" | "ok" | "no-next" {
  if (!v.nextDueDate) return "no-next";
  const days = daysUntil(v.nextDueDate);
  if (days < 0) return "overdue";
  if (days <= 30) return "soon";
  return "ok";
}

export default function VaccinesPage() {
  const [, navigate] = useLocation();
  const { data: modules, isLoading } = useWellnessModules() as {
    data: Record<string, { settings: { vaccines?: Vaccine[] }; enabled: boolean }> | undefined;
    isLoading: boolean;
  };
  const saveModule = useSaveModule("vaccines");

  const mod = modules?.vaccines;
  const vaccines: Vaccine[] = mod?.settings?.vaccines ?? [];
  const enabled = mod?.enabled ?? false;
  const [moduleNotes, setModuleNotes] = useState(((mod?.settings ?? {}) as Record<string, unknown>).notes as string ?? "");

  const [addMode, setAddMode] = useState(false);
  const [editVaccine, setEditVaccine] = useState<Vaccine | null>(null);
  const [draft, setDraft] = useState<Vaccine>({ id: crypto.randomUUID(), name: "", dateReceived: new Date().toISOString().split("T")[0] });

  function openAdd() {
    setDraft({ id: crypto.randomUUID(), name: "", dateReceived: new Date().toISOString().split("T")[0] });
    setEditVaccine(null);
    setAddMode(true);
  }

  function openEdit(v: Vaccine) {
    setDraft({ ...v });
    setEditVaccine(v);
    setAddMode(true);
  }

  function saveDraft() {
    if (!draft.name.trim()) return;
    const updated = editVaccine
      ? vaccines.map((v) => v.id === editVaccine.id ? draft : v)
      : [...vaccines, draft];
    saveModule.mutate({ settings: { vaccines: updated, notes: moduleNotes }, enabled: true });
    setAddMode(false);
  }

  function deleteVaccine(id: string) {
    const updated = vaccines.filter((v) => v.id !== id);
    saveModule.mutate({ settings: { vaccines: updated, notes: moduleNotes }, enabled: updated.length > 0 });
  }

  function savePreferences() {
    saveModule.mutate({ settings: { vaccines, notes: moduleNotes }, enabled });
  }

  if (isLoading) return <Spinner />;

  if (addMode) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setAddMode(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Cancel</span>
        </button>
        <h1 className="text-xl font-bold text-foreground mb-6">{editVaccine ? "Edit vaccine" : "Add vaccine record"}</h1>

        <div className="space-y-4">
          <Field label="Vaccine name">
            <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Yellow Fever"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none mb-2" />
            <div className="flex flex-wrap gap-1.5">
              {COMMON_VACCINES.map((v) => (
                <button key={v} onClick={() => setDraft((p) => ({ ...p, name: v }))}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition",
                    draft.name === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Date received">
            <input type="date" value={draft.dateReceived} onChange={(e) => setDraft((p) => ({ ...p, dateReceived: e.target.value }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>
          <Field label="Next due date (optional)">
            <input type="date" value={draft.nextDueDate ?? ""} onChange={(e) => setDraft((p) => ({ ...p, nextDueDate: e.target.value || undefined }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>
          <Field label="Notes (optional)">
            <textarea value={draft.notes ?? ""} rows={2} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value || undefined }))}
              placeholder="Batch number, clinic, etc."
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none" />
          </Field>
        </div>

        <button onClick={saveDraft} disabled={!draft.name.trim() || saveModule.isPending}
          className="w-full mt-6 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : editVaccine ? "Save changes" : "Add vaccine"}
        </button>
      </div>
    );
  }

  const overdue = vaccines.filter((v) => statusFor(v) === "overdue");
  const soon = vaccines.filter((v) => statusFor(v) === "soon");
  const ok = vaccines.filter((v) => statusFor(v) === "ok" || statusFor(v) === "no-next");

  if (!enabled || vaccines.length === 0) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl">💉</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Vaccination Record</h1>
            <p className="text-sm text-muted-foreground">Track vaccines & due dates</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-6">
          <p className="text-4xl mb-3">💉</p>
          <p className="font-semibold text-foreground mb-1">No vaccines recorded</p>
          <p className="text-sm text-muted-foreground">Add your vaccination history and ERA Health will remind you when your next dose is due.</p>
        </div>
        <button onClick={openAdd} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" />Add a vaccine
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💉</span>
          <h1 className="text-xl font-bold text-foreground">Vaccination Record</h1>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />Add
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
        <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I get my flu shot every October", "I react to some vaccines"</p>
        <textarea value={moduleNotes} rows={3} onChange={(e) => setModuleNotes(e.target.value)}
          placeholder="Anything that helps us plan better for you..."
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none mb-3" />
        <button onClick={savePreferences} disabled={saveModule.isPending}
          className="w-full py-2.5 bg-muted text-foreground rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>

      {overdue.length > 0 && (
        <Section label="Overdue" icon={<AlertCircle className="w-4 h-4 text-red-500" />}>
          {overdue.map((v) => <VaccineCard key={v.id} vaccine={v} onEdit={openEdit} onDelete={deleteVaccine} />)}
        </Section>
      )}
      {soon.length > 0 && (
        <Section label="Due soon" icon={<Clock className="w-4 h-4 text-amber-500" />}>
          {soon.map((v) => <VaccineCard key={v.id} vaccine={v} onEdit={openEdit} onDelete={deleteVaccine} />)}
        </Section>
      )}
      {ok.length > 0 && (
        <Section label="Up to date" icon={<CheckCircle className="w-4 h-4 text-green-500" />}>
          {ok.map((v) => <VaccineCard key={v.id} vaccine={v} onEdit={openEdit} onDelete={deleteVaccine} />)}
        </Section>
      )}
    </div>
  );
}

function VaccineCard({ vaccine, onEdit, onDelete }: { vaccine: Vaccine; onEdit: (v: Vaccine) => void; onDelete: (id: string) => void }) {
  const status = statusFor(vaccine);
  const days = vaccine.nextDueDate ? daysUntil(vaccine.nextDueDate) : null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{vaccine.name}</p>
        <p className="text-xs text-muted-foreground">Received: {vaccine.dateReceived}</p>
        {vaccine.nextDueDate && (
          <p className={cn("text-xs font-semibold mt-0.5",
            status === "overdue" ? "text-red-500" : status === "soon" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")}>
            {status === "overdue" ? `Overdue by ${Math.abs(days!)} days` : status === "soon" ? `Due in ${days} days` : `Due ${vaccine.nextDueDate}`}
          </p>
        )}
        {vaccine.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{vaccine.notes}</p>}
      </div>
      <button onClick={() => onEdit(vaccine)} className="text-xs text-muted-foreground underline shrink-0">Edit</button>
      <button onClick={() => onDelete(vaccine.id)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p></div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>{children}</div>;
}

function Spinner() {
  return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
