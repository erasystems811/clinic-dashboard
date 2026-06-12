import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Check, Flame } from "lucide-react";
import { useSaveModule, useLogToday, useWellnessToday, useWellnessStreak } from "@/lib/wellness-api";
import { cn } from "@/lib/utils";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  startDate: string;
  durationDays: number | null;
}

function newMed(): Medication {
  return { id: crypto.randomUUID(), name: "", dosage: "", times: ["08:00"], startDate: new Date().toISOString().split("T")[0], durationDays: null };
}

export default function MedicationsPage() {
  const [, navigate] = useLocation();
  const { data: today, isLoading } = useWellnessToday() as {
    data: {
      modules: {
        medications: {
          enabled: boolean;
          settings: { medications?: Medication[]; notes?: string };
          log: { taken?: Record<string, boolean> } | null;
        };
      };
    } | undefined;
    isLoading: boolean;
  };
  const { data: streakData } = useWellnessStreak("medications");
  const saveModule = useSaveModule("medications");
  const logToday = useLogToday("medications");

  const module = today?.modules.medications;
  const settings = module?.settings ?? {};
  const meds: Medication[] = settings.medications ?? [];
  const takenMap: Record<string, boolean> = module?.log?.taken ?? {};
  const enabled = module?.enabled ?? false;
  const streak = streakData?.streak ?? 0;

  const [moduleNotes, setModuleNotes] = useState(settings.notes ?? "");
  const [addingMed, setAddingMed] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [draft, setDraft] = useState<Medication>(newMed());

  const todayStr = new Date().toISOString().split("T")[0];

  function activeMeds() {
    return meds.filter((m) => {
      if (todayStr < m.startDate) return false;
      if (m.durationDays) {
        const end = new Date(m.startDate);
        end.setDate(end.getDate() + m.durationDays - 1);
        if (todayStr > end.toISOString().split("T")[0]) return false;
      }
      return true;
    });
  }

  function toggleTaken(med: Medication, time: string) {
    const key = `${med.id}_${time}`;
    logToday.mutate({ taken: { [key]: !takenMap[key] } });
  }

  function allTakenForMed(med: Medication) {
    return med.times.every((t) => takenMap[`${med.id}_${t}`]);
  }

  function openAdd() {
    setDraft(newMed());
    setEditingMed(null);
    setAddingMed(true);
  }

  function openEdit(med: Medication) {
    setDraft({ ...med });
    setEditingMed(med);
    setAddingMed(true);
  }

  function saveDraft() {
    if (!draft.name.trim()) return;
    let updated: Medication[];
    if (editingMed) {
      updated = meds.map((m) => (m.id === editingMed.id ? draft : m));
    } else {
      updated = [...meds, draft];
    }
    saveModule.mutate({ settings: { medications: updated, notes: moduleNotes }, enabled: true });
    setAddingMed(false);
  }

  function deleteMed(id: string) {
    saveModule.mutate({ settings: { medications: meds.filter((m) => m.id !== id), notes: moduleNotes }, enabled: meds.length > 1 });
  }

  function savePreferences() {
    saveModule.mutate({ settings: { medications: meds, notes: moduleNotes }, enabled });
  }

  function addTime() {
    setDraft((p) => ({ ...p, times: [...p.times, "12:00"].sort() }));
  }

  function updateTime(i: number, val: string) {
    setDraft((p) => {
      const times = [...p.times];
      times[i] = val;
      return { ...p, times: times.sort() };
    });
  }

  function removeTime(i: number) {
    setDraft((p) => ({ ...p, times: p.times.filter((_, j) => j !== i) }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (addingMed) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => setAddingMed(false)} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Cancel</span>
        </button>

        <h1 className="text-xl font-bold text-foreground mb-6">{editingMed ? "Edit medication" : "Add medication"}</h1>

        <div className="space-y-4">
          <Field label="Medication name">
            <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Paracetamol"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>

          <Field label="Dosage">
            <input value={draft.dosage} onChange={(e) => setDraft((p) => ({ ...p, dosage: e.target.value }))}
              placeholder="e.g. 500mg, 2 tablets"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>

          <Field label="Start date">
            <input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))}
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>

          <Field label="Duration (leave blank for ongoing)">
            <input type="number" min={1} value={draft.durationDays ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, durationDays: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="Number of days"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground outline-none" />
          </Field>

          <Field label="Dose times">
            {draft.times.map((t, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)}
                  className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none" />
                {draft.times.length > 1 && (
                  <button onClick={() => removeTime(i)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    ×
                  </button>
                )}
              </div>
            ))}
            <button onClick={addTime} className="flex items-center gap-1.5 text-primary text-sm font-semibold">
              <Plus className="w-4 h-4" />
              Add another time
            </button>
          </Field>
        </div>

        <button onClick={saveDraft} disabled={!draft.name.trim() || saveModule.isPending}
          className="w-full mt-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : editingMed ? "Save changes" : "Add medication"}
        </button>
      </div>
    );
  }

  if (!enabled || meds.length === 0) {
    return (
      <div className="px-5 pt-6 pb-8">
        <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">💊</div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Medications</h1>
            <p className="text-sm text-muted-foreground">Track your daily medications</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 text-center mb-6">
          <p className="text-4xl mb-3">💊</p>
          <p className="font-semibold text-foreground mb-1">No medications added</p>
          <p className="text-sm text-muted-foreground">Add your medications and the app will remind you at each dose time.</p>
        </div>

        <button onClick={openAdd} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" />
          Add a medication
        </button>
      </div>
    );
  }

  const active = activeMeds();

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/wellness")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💊</span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Medications</h1>
            <p className="text-xs text-muted-foreground">{active.length} active today</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Today's doses */}
      {active.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's doses</p>
          <div className="space-y-3">
            {active.map((med) => (
              <div key={med.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{med.name}</p>
                    {med.dosage && <p className="text-xs text-muted-foreground">{med.dosage}</p>}
                  </div>
                  <div className={cn("text-xs font-semibold px-2 py-1 rounded-full",
                    allTakenForMed(med) ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                  )}>
                    {allTakenForMed(med) ? "All taken" : `${med.times.filter((t) => takenMap[`${med.id}_${t}`]).length}/${med.times.length}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {med.times.map((t) => {
                    const key = `${med.id}_${t}`;
                    const taken = takenMap[key];
                    return (
                      <button key={t} onClick={() => toggleTaken(med, t)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95",
                          taken ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
                            : "bg-muted text-muted-foreground border border-transparent"
                        )}>
                        {taken && <Check className="w-3 h-3" />}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All medications list */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All medications</p>
        <div className="space-y-2">
          {meds.map((med) => {
            const isActive = active.some((a) => a.id === med.id);
            return (
              <div key={med.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage} · {med.times.join(", ")}</p>
                  {!isActive && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      {todayStr < med.startDate ? `Starts ${med.startDate}` : "Completed"}
                    </p>
                  )}
                </div>
                <button onClick={() => openEdit(med)} className="text-xs text-muted-foreground underline">Edit</button>
                <button onClick={() => deleteMed(med.id)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={openAdd}
        className="w-full py-3 border border-dashed border-primary/50 rounded-2xl text-sm font-semibold text-primary transition active:scale-95 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" />
        Add medication
      </button>

      <div className="bg-card border border-border rounded-2xl p-5 mt-3">
        <p className="text-sm font-semibold text-foreground mb-1">Your preferences <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
        <p className="text-xs text-muted-foreground mb-3">Helps us tailor your plan — e.g. "I take my medications after meals", "I often forget evening doses"</p>
        <textarea value={moduleNotes} rows={3} onChange={(e) => setModuleNotes(e.target.value)}
          placeholder="Anything that helps us plan better for you..."
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none mb-3" />
        <button onClick={savePreferences} disabled={saveModule.isPending}
          className="w-full py-2.5 bg-muted text-foreground rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-60">
          {saveModule.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}
