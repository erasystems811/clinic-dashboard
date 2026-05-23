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
  useListDepartments,
  getListPatientsQueryKey,
  getListQueueQueryKey,
} from "@workspace/api-client-react";
import type { Patient } from "@workspace/api-client-react";
import { Search, Stethoscope, Flag, Loader2, CheckCircle } from "lucide-react";

const TREATMENT_TYPES = [
  { value: "medication_only", label: "Medication Only (self-administered)" },
  { value: "come_to_hospital", label: "Come to Hospital (clinic visit)" },
  { value: "combination", label: "Combination (medication + clinic)" },
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
  treatmentDurationDays: string;
  diagnosis: string;
  department: string;
}

export default function NurseStation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [flagSearch, setFlagSearch] = useState("");
  const [flaggedPatient, setFlaggedPatient] = useState<Patient | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const [form, setForm] = useState<TreatmentForm>({
    treatmentPlan: "",
    treatmentType: "",
    medicationTiming: [],
    treatmentDurationDays: "",
    diagnosis: "",
    department: "",
  });

  const { data: searchResults = [], isFetching: searching } = useListPatients(
    { search },
    { enabled: search.trim().length >= 2 }
  );

  const { data: flagSearchResults = [], isFetching: flagSearching } = useListPatients(
    { search: flagSearch },
    { enabled: flagSearch.trim().length >= 2 }
  );

  const { data: departments = [] } = useListDepartments({});

  const logPlan = useLogTreatmentPlan({
    mutation: {
      onSuccess: (patient) => {
        toast({
          title: "Treatment plan saved",
          description: `${patient.firstName} ${patient.lastName} moved to In Care.`,
        });
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
        setSelectedPatient(null);
        setSearch("");
        setForm({ treatmentPlan: "", treatmentType: "", medicationTiming: [], treatmentDurationDays: "", diagnosis: "", department: "" });
      },
      onError: () => toast({ title: "Failed to save treatment plan", variant: "destructive" }),
    },
  });

  const flagMissed = useFlagMissedTreatment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Patient flagged", description: "A call task has been created for the receptionist." });
        setFlaggedPatient(null);
        setFlagSearch("");
        setFlagReason("");
      },
      onError: () => toast({ title: "Failed to flag patient", variant: "destructive" }),
    },
  });

  const toggleTiming = (val: string) => {
    setForm((f) => ({
      ...f,
      medicationTiming: f.medicationTiming.includes(val)
        ? f.medicationTiming.filter((t) => t !== val)
        : [...f.medicationTiming, val],
    }));
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    logPlan.mutate({
      id: selectedPatient.id,
      data: {
        treatmentPlan: form.treatmentPlan,
        treatmentType: form.treatmentType,
        medicationTiming: form.medicationTiming.join(",") || undefined,
        treatmentDurationDays: parseInt(form.treatmentDurationDays),
        diagnosis: form.diagnosis || undefined,
        department: form.department || undefined,
      },
    });
  };

  const handleFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggedPatient) return;
    flagMissed.mutate({ id: flaggedPatient.id, data: { reason: flagReason } });
  };

  const inCareResults = flagSearchResults.filter((p) => p.stage === "In Care");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nurse Station</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Log treatment plans and flag missed treatments</p>
        </div>

        {/* Treatment Plan Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Log Treatment Plan</span>
          </div>
          <div className="p-4 space-y-4">
            {!selectedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search patient by name, ID, phone, or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {searching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                {search.trim().length >= 2 && (
                  <div className="space-y-2">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No patients found</p>
                    ) : (
                      searchResults.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
                          onClick={() => { setSelectedPatient(patient); setSearch(""); }}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                            <p className="text-xs text-muted-foreground">
                              {patient.hospitalId && <span className="mr-2">ID: {patient.hospitalId}</span>}
                              {patient.phone} · Stage: {patient.stage}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitPlan} className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.hospitalId && <span className="mr-2">ID: {selectedPatient.hospitalId}</span>}
                      Stage: {selectedPatient.stage}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>

                {selectedPatient.treatmentPlan && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm">
                    <CheckCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Existing treatment plan on file</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{selectedPatient.treatmentPlan}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Treatment Plan Notes *</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe the treatment plan..."
                    value={form.treatmentPlan}
                    onChange={(e) => setForm((f) => ({ ...f, treatmentPlan: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Treatment Type *</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.treatmentType}
                    onChange={(e) => setForm((f) => ({ ...f, treatmentType: e.target.value }))}
                    required
                  >
                    <option value="">Select treatment type</option>
                    {TREATMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {(form.treatmentType === "medication_only" || form.treatmentType === "combination") && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Medication Timing</label>
                    <div className="flex flex-wrap gap-2">
                      {TIMING_OPTIONS.map((t) => (
                        <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary"
                            checked={form.medicationTiming.includes(t.value)}
                            onChange={() => toggleTiming(t.value)}
                          />
                          <span className="text-sm">{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (days) *</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.treatmentDurationDays}
                    onChange={(e) => setForm((f) => ({ ...f, treatmentDurationDays: e.target.value }))}
                    placeholder="e.g. 14"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Diagnosis</label>
                    <Input
                      value={form.diagnosis}
                      onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Department</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setSelectedPatient(null)}>Cancel</Button>
                  <Button type="submit" disabled={logPlan.isPending}>
                    {logPlan.isPending ? "Saving..." : "Save Treatment Plan"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Flag Missed Treatment Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Flag className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Flag Missed Treatment</span>
            <span className="text-xs text-muted-foreground ml-1">— In Care patients only</span>
          </div>
          <div className="p-4 space-y-4">
            {!flaggedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search In Care patient..."
                    value={flagSearch}
                    onChange={(e) => setFlagSearch(e.target.value)}
                  />
                  {flagSearching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                {flagSearch.trim().length >= 2 && (
                  <div className="space-y-2">
                    {inCareResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        No In Care patients found matching "{flagSearch}"
                      </p>
                    ) : (
                      inCareResults.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
                          onClick={() => { setFlaggedPatient(patient); setFlagSearch(""); }}
                        >
                          <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive font-bold text-xs flex items-center justify-center shrink-0">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                            <p className="text-xs text-muted-foreground">{patient.phone}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleFlag} className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-md border border-destructive/30 bg-destructive/5">
                  <div className="w-9 h-9 rounded-full bg-destructive/20 text-destructive font-bold text-sm flex items-center justify-center shrink-0">
                    {flaggedPatient.firstName[0]}{flaggedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{flaggedPatient.firstName} {flaggedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">{flaggedPatient.phone}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFlaggedPatient(null)}>Change</Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reason for flag *</label>
                  <Input
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="e.g. Missed 2 consecutive treatment sessions"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setFlaggedPatient(null)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={flagMissed.isPending}>
                    {flagMissed.isPending ? "Flagging..." : "Flag Patient"}
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
