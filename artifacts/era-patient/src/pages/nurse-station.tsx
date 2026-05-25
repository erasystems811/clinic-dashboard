import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useLogTreatmentPlan,
  useFlagMissedTreatment,
  getListPatientsQueryKey,
  getListQueueQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import type { Patient } from "@workspace/api-client-react";
import { Search, Stethoscope, Flag, Loader2, CheckCircle, Info, Bot, MessageSquare, PhoneCall, Building2 } from "lucide-react";

const FOLLOWUP_TYPES = [
  { value: "automated_message", label: "Automated Message", sub: "AI generates a check-in message", icon: Bot, color: "text-violet-400", active: "border-violet-500 bg-violet-500/10 text-violet-400" },
  { value: "manual_text", label: "Manual Text", sub: "Staff composes a personal text", icon: MessageSquare, color: "text-blue-400", active: "border-blue-500 bg-blue-500/10 text-blue-400" },
  { value: "manual_call", label: "Manual Call", sub: "Staff makes a direct phone call", icon: PhoneCall, color: "text-primary", active: "border-primary bg-primary/10 text-primary" },
] as const;

type FollowupType = typeof FOLLOWUP_TYPES[number]["value"];

const TREATMENT_TYPES = [
  { value: "medication_only", label: "Medication Only", sub: "Patient self-administers at home" },
  { value: "come_to_hospital", label: "Come to Hospital", sub: "Clinic or ward visits required" },
  { value: "combination", label: "Combination", sub: "Medication + clinic visits" },
];

const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

interface TreatmentForm {
  treatmentPlan: string;
  treatmentType: string;
  medicationTiming: string[];
  hospitalTiming: string[];
  treatmentDurationDays: string;
  department: string;
}

const EMPTY_FORM: TreatmentForm = {
  treatmentPlan: "",
  treatmentType: "",
  medicationTiming: [],
  hospitalTiming: [],
  treatmentDurationDays: "",
  department: "",
};

export default function NurseStation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [flagSearch, setFlagSearch] = useState("");
  const [flaggedPatient, setFlaggedPatient] = useState<Patient | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagActionType, setFlagActionType] = useState<FollowupType>("manual_call");
  const [form, setForm] = useState<TreatmentForm>(EMPTY_FORM);

  const { hospitalConfig } = useAuth();
  const departments = hospitalConfig?.departments ?? [];

  const { data: searchResults = [], isFetching: searching } = useListPatients(
    { search },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: search.trim().length >= 2 } as any }
  );
  const { data: flagSearchResults = [], isFetching: flagSearching } = useListPatients(
    { search: flagSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: flagSearch.trim().length >= 2 } as any }
  );

  const logPlan = useLogTreatmentPlan({
    mutation: {
      onSuccess: (patient) => {
        toast({ title: "Treatment plan saved", description: `${patient.firstName} ${patient.lastName} moved to In Care.` });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        setSelectedPatient(null);
        setSearch("");
        setForm(EMPTY_FORM);
      },
      onError: () => toast({ title: "Failed to save treatment plan", variant: "destructive" }),
    },
  });

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Patient flagged", description: "A follow-up task has been created for the receptionist." });
        setFlaggedPatient(null);
        setFlagSearch("");
        setFlagReason("");
        setFlagActionType("manual_call");
      },
      onError: () => toast({ title: "Failed to flag patient", variant: "destructive" }),
    },
  });

  const toggleMedTiming = (val: string) =>
    setForm(f => ({
      ...f,
      medicationTiming: f.medicationTiming.includes(val)
        ? f.medicationTiming.filter(t => t !== val)
        : [...f.medicationTiming, val],
    }));

  const toggleHospitalTiming = (val: string) =>
    setForm(f => ({
      ...f,
      hospitalTiming: f.hospitalTiming.includes(val)
        ? f.hospitalTiming.filter(t => t !== val)
        : [...f.hospitalTiming, val],
    }));

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    const allTiming = [
      ...form.medicationTiming.map(t => `med:${t}`),
      ...form.hospitalTiming.map(t => `hosp:${t}`),
    ];
    logPlan.mutate({
      id: selectedPatient.id,
      data: {
        treatmentPlan: form.treatmentPlan,
        treatmentType: form.treatmentType,
        medicationTiming: allTiming.join(",") || undefined,
        treatmentDurationDays: parseInt(form.treatmentDurationDays),
        department: form.department || undefined,
      },
    });
  };

  const handleFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggedPatient) return;
    flagMissed.mutate({ id: flaggedPatient.id, data: { reason: flagReason, actionType: flagActionType } });
  };

  const inCareResults = flagSearchResults.filter(p => p.stage === "In Care");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nurse Station</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Log treatment plans for queued patients and flag missed treatments.</p>
        </div>

        {/* ── TREATMENT PLAN LOG ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Log Treatment Plan</span>
          </div>
          <div className="p-5">
            {!selectedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search patient by name, ID, or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-9"
                  />
                  {searching
                    ? <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    : <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />}
                </div>
                {search.trim().length >= 2 && (
                  <div className="space-y-1.5">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No patients found</p>
                    ) : searchResults.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 text-left transition-colors"
                        onClick={() => { setSelectedPatient(patient); setSearch(""); }}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.hospitalId && <span className="mr-2 font-mono">ID: {patient.hospitalId}</span>}
                            {patient.phone} · <span className={patient.stage === "Queued" ? "text-primary font-medium" : ""}>{patient.stage}</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitPlan} className="space-y-5">
                {/* Selected patient bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.hospitalId && <span className="font-mono mr-2">ID: {selectedPatient.hospitalId}</span>}
                      Stage: {selectedPatient.stage}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>

                {selectedPatient.treatmentPlan && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-400">Existing plan on file — logging a new plan will replace it</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{selectedPatient.treatmentPlan}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Treatment Plan Notes *</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe the treatment plan in detail..."
                    value={form.treatmentPlan}
                    onChange={e => setForm(f => ({ ...f, treatmentPlan: e.target.value }))}
                    required
                  />
                </div>

                {/* Treatment type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Treatment Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TREATMENT_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, treatmentType: t.value }))}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center text-xs transition-colors ${
                          form.treatmentType === t.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-border/60 text-muted-foreground"
                        }`}
                      >
                        <span className="font-semibold text-sm">{t.label}</span>
                        <span className="leading-snug opacity-80">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medication timing — home doses */}
                {(form.treatmentType === "medication_only" || form.treatmentType === "combination") && (
                  <div className="space-y-2 p-3.5 rounded-lg border border-border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Medication Timing</p>
                      <p className="text-xs text-muted-foreground mt-0.5">When the patient takes medication at home</p>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {TIMING_OPTIONS.map(t => (
                        <label key={t.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary"
                            checked={form.medicationTiming.includes(t.value)}
                            onChange={() => toggleMedTiming(t.value)}
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hospital visit timing — injections / clinic procedures */}
                {(form.treatmentType === "come_to_hospital" || form.treatmentType === "combination") && (
                  <div className="space-y-2 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
                    <div>
                      <p className="text-sm font-medium">Hospital Visit Timing</p>
                      <p className="text-xs text-muted-foreground mt-0.5">When the patient must come in for injections or procedures</p>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {TIMING_OPTIONS.map(t => (
                        <label key={t.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary"
                            checked={form.hospitalTiming.includes(t.value)}
                            onChange={() => toggleHospitalTiming(t.value)}
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (days) *</label>
                  <Input
                    type="number" min={1}
                    value={form.treatmentDurationDays}
                    onChange={e => setForm(f => ({ ...f, treatmentDurationDays: e.target.value }))}
                    placeholder="e.g. 14"
                    required
                  />
                </div>

                {/* Department — used by automated messages */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium">Care Department *</label>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      <Info className="w-3 h-3" />
                      Used by automated follow-up messages
                    </div>
                  </div>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    required
                  >
                    <option value="">Select department...</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {form.department && (
                    <p className="text-xs text-muted-foreground">
                      Automated messages will use the <span className="text-foreground font-medium">{form.department}</span> check-in template.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => { setSelectedPatient(null); setForm(EMPTY_FORM); }}>Cancel</Button>
                  <Button type="submit" disabled={logPlan.isPending || !form.treatmentType || !form.department}>
                    {logPlan.isPending ? "Saving..." : "Save Treatment Plan"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── FLAG MISSED TREATMENT ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Flag className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Flag Missed Treatment</span>
            <span className="text-xs text-muted-foreground ml-1">— In Care patients only</span>
          </div>
          <div className="p-5">
            {!flaggedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search In Care patient..."
                    value={flagSearch}
                    onChange={e => setFlagSearch(e.target.value)}
                    className="pr-9"
                  />
                  {flagSearching
                    ? <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    : <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />}
                </div>
                {flagSearch.trim().length >= 2 && (
                  <div className="space-y-1.5">
                    {inCareResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No In Care patients found matching "{flagSearch}"</p>
                    ) : inCareResults.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 text-left transition-colors"
                        onClick={() => { setFlaggedPatient(patient); setFlagSearch(""); }}
                      >
                        <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive font-bold text-xs flex items-center justify-center shrink-0">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.department && <span className="mr-2">{patient.department}</span>}
                            {patient.phone}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleFlag} className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="w-9 h-9 rounded-full bg-destructive/20 text-destructive font-bold text-sm flex items-center justify-center shrink-0">
                    {flaggedPatient.firstName[0]}{flaggedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{flaggedPatient.firstName} {flaggedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {flaggedPatient.department && <span className="mr-2">{flaggedPatient.department}</span>}
                      {flaggedPatient.phone}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFlaggedPatient(null)}>Change</Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reason for flag *</label>
                  <Input
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                    placeholder="e.g. Missed 2 consecutive treatment sessions"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Follow-up Method *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FOLLOWUP_TYPES.map(ft => {
                      const Icon = ft.icon;
                      const isSelected = flagActionType === ft.value;
                      return (
                        <button
                          key={ft.value}
                          type="button"
                          onClick={() => setFlagActionType(ft.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center text-xs transition-colors ${
                            isSelected ? ft.active : "border-border hover:border-border/60 text-muted-foreground"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? "" : ft.color}`} />
                          <span className="font-semibold">{ft.label}</span>
                          <span className="leading-snug opacity-80">{ft.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setFlaggedPatient(null); setFlagActionType("manual_call"); }}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={flagMissed.isPending}>
                    {flagMissed.isPending ? "Flagging..." : "Flag & Create Follow-up Task"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
