import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  useFlagMissedTreatment,
  getListPatientsQueryKey,
  getListQueueQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import type { Patient } from "@workspace/api-client-react";
import { apiUrl } from "@/lib/api";
import {
  Search, Stethoscope, Flag, Loader2, Plus, Trash2,
  Pencil, MessageSquare, PhoneCall, ChevronDown,
  ChevronUp, X, Calendar, AlertTriangle, CheckCircle2,
} from "lucide-react";

const STANDARD_DEPARTMENTS = [
  "General Outpatient",
  "Antenatal / Maternity",
  "Paediatrics",
  "Surgery / Post-Op",
  "Dental",
  "Eye",
  "Fertility / IVF",
];

// ── Types ───────────────────────────────────────────────────────────────────────

interface CarePlan {
  id: number;
  patientId: number;
  hospitalId: string;
  department: string;
  summary: string;
  templateData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleRow { date: string; [key: string]: string; }

// ── Constants ───────────────────────────────────────────────────────────────────

const FOLLOWUP_TYPES = [
  { value: "manual_call", label: "Call", sub: "Call patient and log the outcome", icon: PhoneCall, color: "text-primary", active: "border-primary bg-primary/10 text-primary" },
  { value: "manual_text", label: "Text", sub: "Compose or AI-generate a message", icon: MessageSquare, color: "text-blue-400", active: "border-blue-500 bg-blue-500/10 text-blue-400" },
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

const DEPT_LABELS: Record<string, string> = {
  "General Outpatient": "General Outpatient",
  "Antenatal / Maternity": "Antenatal / Maternity",
  "Paediatrics": "Paediatrics",
  "Surgery / Post-Op": "Surgery / Post-Op",
  "Dental": "Dental",
  "Eye": "Eye",
  "Fertility / IVF": "Fertility / IVF",
};

function emptyTemplateData(dept: string): Record<string, unknown> {
  if (dept === "General Outpatient") return { treatmentType: "", medicationTiming: [], medicationTimingTimes: {}, hospitalTiming: [], hospitalTimingTimes: {}, durationDays: 1 };
  if (dept === "Antenatal / Maternity") return { currentWeek: "", ancSchedule: [{ weekNumber: "", whatHappens: "", date: "", time: "" }] };
  if (dept === "Paediatrics") return { childAge: "", vaccinationSchedule: [{ ageAtVaccination: "", vaccinationName: "", date: "", time: "" }] };
  if (dept === "Surgery / Post-Op") return { procedureDate: "", procedureTime: "", procedureType: "", inCareSchedule: [{ date: "", time: "", whatHappens: "" }] };
  if (dept === "Dental") return { inCareSchedule: [{ date: "", time: "", treatmentType: "" }] };
  if (dept === "Eye") return { inCareSchedule: [{ date: "", time: "", action: "" }] };
  if (dept === "Fertility / IVF") return { inCareSchedule: [{ date: "", time: "", whatHappens: "" }] };
  return {};
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function NurseStation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hospital, hospitalConfig } = useAuth();
  // Show all departments configured for this hospital in the super admin.
  // Fall back to all 7 standard departments only when the hospital has nothing configured yet.
  const configDepts = hospitalConfig?.departments ?? [];
  const departments = configDepts.length > 0 ? configDepts : STANDARD_DEPARTMENTS;

  // Patient search
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Care plans
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [carePlansLoading, setCarePlansLoading] = useState(false);
  const [planMode, setPlanMode] = useState<"list" | "new" | "edit">("list");
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [confirmEndPlanId, setConfirmEndPlanId] = useState<number | null>(null);
  const [endingPlanId, setEndingPlanId] = useState<number | null>(null);

  // Care plan form
  const [planDepartment, setPlanDepartment] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [planTemplateData, setPlanTemplateData] = useState<Record<string, unknown>>({});

  // Flag section
  const [flagSearch, setFlagSearch] = useState("");
  const [flaggedPatient, setFlaggedPatient] = useState<Patient | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagActionType, setFlagActionType] = useState<FollowupType>("manual_call");

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

  const authHeader = () => ({ "x-hospital-token": hospital?.token ?? "" });

  const fetchCarePlans = useCallback(async (patientId: number) => {
    setCarePlansLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/care-plans`), {
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Failed to load care plans");
      const data = await res.json() as CarePlan[];
      setCarePlans(data);
    } catch {
      setCarePlans([]);
    } finally {
      setCarePlansLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospital?.token]);

  useEffect(() => {
    if (selectedPatient) {
      fetchCarePlans(selectedPatient.id);
      setPlanMode("list");
    } else {
      setCarePlans([]);
      setPlanMode("list");
    }
  }, [selectedPatient, fetchCarePlans]);

  const openNewPlan = () => {
    const defaultDept = departments[0] ?? "";
    setPlanDepartment(defaultDept);
    setPlanSummary("");
    setPlanTemplateData(emptyTemplateData(defaultDept));
    setEditingPlan(null);
    setPlanMode("new");
  };

  const openEditPlan = (plan: CarePlan) => {
    setPlanDepartment(plan.department);
    setPlanSummary(plan.summary);
    setPlanTemplateData({ ...plan.templateData });
    setEditingPlan(plan);
    setPlanMode("edit");
  };

  const cancelPlanForm = () => {
    setPlanMode("list");
    setEditingPlan(null);
  };


  const handleDeptChange = (dept: string) => {
    setPlanDepartment(dept);
    setPlanTemplateData(emptyTemplateData(dept));
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSavingPlan(true);
    try {
      const body = { department: planDepartment, summary: planSummary, templateData: planTemplateData };
      const url = planMode === "edit" && editingPlan
        ? apiUrl(`/api/care-plans/${editingPlan.id}`)
        : apiUrl(`/api/patients/${selectedPatient.id}/care-plans`);
      const method = planMode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({
        title: planMode === "edit" ? "Care plan updated" : "Care plan saved",
        description: planMode === "new" ? `${selectedPatient.firstName} ${selectedPatient.lastName} moved to In Care.` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
      setPlanMode("list");
      setEditingPlan(null);
      setSelectedPatient(null);
    } catch {
      toast({ title: "Failed to save care plan", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!selectedPatient) return;
    setDeletingPlanId(planId);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${planId}`), {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Care plan removed" });
      await fetchCarePlans(selectedPatient.id);
      setConfirmDeleteId(null);
    } catch {
      toast({ title: "Failed to delete care plan", variant: "destructive" });
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleEndPlanEarly = async (planId: number) => {
    if (!selectedPatient) return;
    setEndingPlanId(planId);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${planId}`), {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error("End failed");
      toast({ title: "Care plan ended", description: "The treatment plan has been closed early." });
      await fetchCarePlans(selectedPatient.id);
      setConfirmEndPlanId(null);
    } catch {
      toast({ title: "Failed to end care plan", variant: "destructive" });
    } finally {
      setEndingPlanId(null);
    }
  };

  const handleFlag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggedPatient) return;
    flagMissed.mutate({ id: flaggedPatient.id, data: { reason: flagReason, actionType: flagActionType } });
  };

  const flagResults = flagSearchResults.filter(p => p.stage !== "Dormant");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nurse Station</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Log care plans for patients and flag anyone needing follow-up.</p>
        </div>

        {/* ── CARE PLANS ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Care Plans</span>
          </div>
          <div className="p-5">
            {!selectedPatient ? (
              /* ── Patient search ── */
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search by name or ID..."
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
                            {patient.patientId && <span className="mr-2 font-mono">ID: {patient.patientId}</span>}
                            {patient.phone} · <span className={patient.stage === "Queued" ? "text-primary font-medium" : ""}>{patient.stage}</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : planMode === "list" ? (
              /* ── Care plan list ── */
              <div className="space-y-4">
                {/* Patient bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPatient.patientId && <span className="font-mono mr-2">ID: {selectedPatient.patientId}</span>}
                      Stage: {selectedPatient.stage}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>

                {/* Existing plans */}
                {carePlansLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : carePlans.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-muted-foreground">No care plans on file for this patient.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {carePlans.map(plan => (
                      <div key={plan.id} className="rounded-lg border border-border overflow-hidden">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition"
                          onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary uppercase tracking-wide">{plan.department}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(plan.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mt-0.5 line-clamp-1">{plan.summary}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                              onClick={e => { e.stopPropagation(); openEditPlan(plan); }}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                              onClick={e => { e.stopPropagation(); setConfirmDeleteId(plan.id); }}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {expandedPlanId === plan.id
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Confirm delete */}
                        {confirmDeleteId === plan.id && (
                          <div className="px-4 py-3 bg-destructive/5 border-t border-destructive/20 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-300">Delete this {plan.department} care plan? This cannot be undone.</p>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                              <Button
                                type="button" size="sm"
                                className="flex-1 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
                                onClick={() => handleDeletePlan(plan.id)}
                                disabled={deletingPlanId === plan.id}
                              >
                                {deletingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Confirm end treatment early */}
                        {confirmEndPlanId === plan.id && (
                          <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/20 space-y-2">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-300">End this {plan.department} care plan early? This will close the plan. This cannot be undone.</p>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmEndPlanId(null)}>Cancel</Button>
                              <Button
                                type="button" size="sm"
                                className="flex-1 text-xs bg-amber-600 hover:bg-amber-600/90 text-white border-0"
                                onClick={() => handleEndPlanEarly(plan.id)}
                                disabled={endingPlanId === plan.id}
                              >
                                {endingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "End Treatment Early"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Expanded details */}
                        {expandedPlanId === plan.id && confirmDeleteId !== plan.id && confirmEndPlanId !== plan.id && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                            <p className="text-sm text-foreground">{plan.summary}</p>
                            <PlanTemplateDetails dept={plan.department} data={plan.templateData} />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                              onClick={e => { e.stopPropagation(); setConfirmEndPlanId(plan.id); setConfirmDeleteId(null); }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              End Treatment Early
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Button type="button" className="w-full gap-2" onClick={openNewPlan}>
                  <Plus className="w-4 h-4" />
                  Add Care Plan
                </Button>
              </div>
            ) : (
              /* ── Care plan form (new / edit) ── */
              <form onSubmit={handleSavePlan} className="space-y-5">
                {/* Patient bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">Stage: {selectedPatient.stage}</p>
                  </div>
                  <button type="button" className="p-1 rounded hover:bg-muted transition" onClick={cancelPlanForm}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Department picker */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Department *</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={planDepartment}
                    onChange={e => handleDeptChange(e.target.value)}
                    required
                  >
                    <option value="">Select department...</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{DEPT_LABELS[d] ?? d}</option>
                    ))}
                  </select>
                </div>

                {/* Department-specific template — shapeshifts when department changes */}
                {planDepartment && (
                  <div key={planDepartment} style={{ animation: "deptShift 0.22s ease-out both" }}>
                    <style>{`@keyframes deptShift{from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
                    <DepartmentTemplate
                      department={planDepartment}
                      templateData={planTemplateData}
                      onChange={setPlanTemplateData}
                    />
                  </div>
                )}

                {/* Summary notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Plan Notes / Summary *</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe the care plan in detail…"
                    value={planSummary}
                    onChange={e => setPlanSummary(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="outline" onClick={cancelPlanForm}>Cancel</Button>
                  <Button type="submit" disabled={savingPlan || !planDepartment}>
                    {savingPlan ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Saving…</> : (planMode === "edit" ? "Save Changes" : "Save")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── FLAG PATIENT FOR FOLLOW-UP ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Flag className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Flag Patient for Follow-up</span>
          </div>
          <div className="p-5">
            {!flaggedPatient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Search by name or ID..."
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
                    {flagResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No patients found matching "{flagSearch}"</p>
                    ) : flagResults.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 text-left transition-colors"
                        onClick={() => { setFlaggedPatient(patient); setFlagSearch(""); }}
                      >
                        <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive font-bold text-xs flex items-center justify-center shrink-0">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                            {patient.patientId && <span className="font-mono">ID: {patient.patientId}</span>}
                            <span className="text-blue-400">{patient.stage}</span>
                            {patient.treatmentPlan && (
                              <span className="truncate max-w-[220px] text-amber-400">Plan: {patient.treatmentPlan}</span>
                            )}
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
                    placeholder="e.g. Lab result is out, needs to come in for another test"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Follow-up Method *</label>
                  <div className="grid grid-cols-2 gap-2">
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

// ── Department Template UI ───────────────────────────────────────────────────────

function DepartmentTemplate({
  department,
  templateData,
  onChange,
}: {
  department: string;
  templateData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...templateData, [key]: value });

  const addRow = (key: string, emptyRow: Record<string, string>) => {
    const arr = (templateData[key] as ScheduleRow[]) ?? [];
    onChange({ ...templateData, [key]: [...arr, emptyRow] });
  };
  const removeRow = (key: string, idx: number) => {
    const arr = (templateData[key] as ScheduleRow[]) ?? [];
    onChange({ ...templateData, [key]: arr.filter((_, i) => i !== idx) });
  };
  const updateRow = (key: string, idx: number, field: string, val: string) => {
    const arr = [...((templateData[key] as ScheduleRow[]) ?? [])];
    arr[idx] = { ...arr[idx], [field]: val };
    onChange({ ...templateData, [key]: arr });
  };

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  if (department === "General Outpatient") {
    const td = templateData as {
      treatmentType?: string;
      medicationTiming?: string[];
      medicationTimingTimes?: Record<string, string>;
      hospitalTiming?: string[];
      hospitalTimingTimes?: Record<string, string>;
      durationDays?: number;
    };
    const toggleArr = (key: "medicationTiming" | "hospitalTiming", val: string) => {
      const arr = td[key] ?? [];
      set(key, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
    };
    const setTimingTime = (timesKey: "medicationTimingTimes" | "hospitalTimingTimes", slot: string, time: string) => {
      const times = { ...(td[timesKey] ?? {}) };
      times[slot] = time;
      set(timesKey, times);
    };
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">General Outpatient Details</p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Treatment Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {TREATMENT_TYPES.map(t => (
              <button
                key={t.value} type="button"
                onClick={() => set("treatmentType", t.value)}
                className={`flex flex-col gap-1 p-3 rounded-lg border text-center text-xs transition-colors ${
                  td.treatmentType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border/60 text-muted-foreground"
                }`}
              >
                <span className="font-semibold text-sm">{t.label}</span>
                <span className="leading-snug opacity-80">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>
        {(td.treatmentType === "medication_only" || td.treatmentType === "combination") && (
          <div className="space-y-2 p-3 rounded-lg border border-border bg-background">
            <p className="text-sm font-medium">Medication Timing</p>
            <p className="text-xs text-muted-foreground">Select times — reminder sent 2 hours before each.</p>
            <div className="space-y-2">
              {TIMING_OPTIONS.map(t => {
                const checked = (td.medicationTiming ?? []).includes(t.value);
                return (
                  <div key={t.value} className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm w-28 shrink-0">
                      <input type="checkbox" className="w-4 h-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleArr("medicationTiming", t.value)} />
                      {t.label}
                    </label>
                    {checked && (
                      <input type="time"
                        value={(td.medicationTimingTimes ?? {})[t.value] ?? ""}
                        onChange={e => setTimingTime("medicationTimingTimes", t.value, e.target.value)}
                        className={inputCls + " w-32"} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(td.treatmentType === "come_to_hospital" || td.treatmentType === "combination") && (
          <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <p className="text-sm font-medium">Hospital Visit Timing</p>
            <p className="text-xs text-muted-foreground">Select times — reminder sent 3 hours before each visit.</p>
            <div className="space-y-2">
              {TIMING_OPTIONS.map(t => {
                const checked = (td.hospitalTiming ?? []).includes(t.value);
                return (
                  <div key={t.value} className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm w-28 shrink-0">
                      <input type="checkbox" className="w-4 h-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleArr("hospitalTiming", t.value)} />
                      {t.label}
                    </label>
                    {checked && (
                      <input type="time"
                        value={(td.hospitalTimingTimes ?? {})[t.value] ?? ""}
                        onChange={e => setTimingTime("hospitalTimingTimes", t.value, e.target.value)}
                        className={inputCls + " w-32"} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Duration (days) *</label>
          <input type="number" min={1} value={td.durationDays ?? ""} onChange={e => set("durationDays", parseInt(e.target.value) || 1)} className={inputCls} placeholder="e.g. 14" required />
        </div>
      </div>
    );
  }

  if (department === "Antenatal / Maternity") {
    const rows = (templateData.ancSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Antenatal / Maternity Details</p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Current Week of Pregnancy</label>
          <input type="text" value={(templateData.currentWeek as string) ?? ""} onChange={e => set("currentWeek", e.target.value)} className={inputCls} placeholder="e.g. 24" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">ANC Schedule</p>
            <button type="button" onClick={() => addRow("ancSchedule", { weekNumber: "", whatHappens: "", date: "", time: "" })} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3 h-3" />Add visit
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_auto_auto_auto] gap-2 items-start">
              <input type="text" value={row.whatHappens} onChange={e => updateRow("ancSchedule", i, "whatHappens", e.target.value)} className={inputCls} placeholder="What happens" />
              <input type="text" value={row.weekNumber} onChange={e => updateRow("ancSchedule", i, "weekNumber", e.target.value)} className={inputCls} placeholder="Week #" />
              <input type="date" value={row.date} onChange={e => updateRow("ancSchedule", i, "date", e.target.value)} className={inputCls} />
              <input type="time" value={row.time ?? ""} onChange={e => updateRow("ancSchedule", i, "time", e.target.value)} className={inputCls + " w-28"} />
              {rows.length > 1 && <button type="button" onClick={() => removeRow("ancSchedule", i)} className="mt-1.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"><X className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (department === "Paediatrics") {
    const rows = (templateData.vaccinationSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paediatrics Details</p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Child's Age</label>
          <input type="text" value={(templateData.childAge as string) ?? ""} onChange={e => set("childAge", e.target.value)} className={inputCls} placeholder="e.g. 3 months" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Vaccination Schedule</p>
            <button type="button" onClick={() => addRow("vaccinationSchedule", { ageAtVaccination: "", vaccinationName: "", date: "", time: "" })} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3 h-3" />Add vaccine
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-2 items-start">
              <input type="text" value={row.ageAtVaccination} onChange={e => updateRow("vaccinationSchedule", i, "ageAtVaccination", e.target.value)} className={inputCls} placeholder="Age" />
              <input type="text" value={row.vaccinationName} onChange={e => updateRow("vaccinationSchedule", i, "vaccinationName", e.target.value)} className={inputCls} placeholder="Vaccine name" />
              <input type="date" value={row.date} onChange={e => updateRow("vaccinationSchedule", i, "date", e.target.value)} className={inputCls} />
              <input type="time" value={row.time ?? ""} onChange={e => updateRow("vaccinationSchedule", i, "time", e.target.value)} className={inputCls + " w-28"} />
              {rows.length > 1 && <button type="button" onClick={() => removeRow("vaccinationSchedule", i)} className="mt-1.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"><X className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (department === "Surgery / Post-Op") {
    const rows = (templateData.inCareSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Surgery / Post-Op Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Procedure Date</label>
            <input type="date" value={(templateData.procedureDate as string) ?? ""} onChange={e => set("procedureDate", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Procedure Time</label>
            <input type="time" value={(templateData.procedureTime as string) ?? ""} onChange={e => set("procedureTime", e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Procedure Type</label>
          <select value={(templateData.procedureType as string) ?? ""} onChange={e => set("procedureType", e.target.value)} className={inputCls}>
            <option value="">Select type…</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </select>
        </div>
        <InCareScheduleRows dept={department} rows={rows} rowKey="inCareSchedule" col2Key="whatHappens" col2Label="What happens" addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />
      </div>
    );
  }

  if (department === "Dental") {
    const rows = (templateData.inCareSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dental Details</p>
        <InCareScheduleRows dept={department} rows={rows} rowKey="inCareSchedule" col2Key="treatmentType" col2Label="Treatment" addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />
      </div>
    );
  }

  if (department === "Eye") {
    const rows = (templateData.inCareSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eye Clinic Details</p>
        <InCareScheduleRows dept={department} rows={rows} rowKey="inCareSchedule" col2Key="action" col2Label="Action / Notes" addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />
      </div>
    );
  }

  if (department === "Fertility / IVF") {
    const rows = (templateData.inCareSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fertility / IVF Details</p>
        <InCareScheduleRows dept={department} rows={rows} rowKey="inCareSchedule" col2Key="whatHappens" col2Label="What happens" addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />
      </div>
    );
  }

  return null;
}

// ── Reusable In-Care Schedule Rows ───────────────────────────────────────────────

function InCareScheduleRows({
  dept, rows, rowKey, col2Key, col2Label, addRow, removeRow, updateRow, inputCls,
}: {
  dept: string;
  rows: ScheduleRow[];
  rowKey: string;
  col2Key: string;
  col2Label: string;
  addRow: (key: string, row: Record<string, string>) => void;
  removeRow: (key: string, idx: number) => void;
  updateRow: (key: string, idx: number, field: string, val: string) => void;
  inputCls: string;
}) {
  const emptyRow = { date: "", time: "", [col2Key]: "" };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">In-Care Schedule</p>
        <button type="button" onClick={() => addRow(rowKey, emptyRow)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="w-3 h-3" />Add visit
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[auto_auto_1fr_auto] gap-2 items-start">
          <input type="date" value={row.date} onChange={e => updateRow(rowKey, i, "date", e.target.value)} className={inputCls} />
          <input type="time" value={row.time ?? ""} onChange={e => updateRow(rowKey, i, "time", e.target.value)} className={inputCls + " w-28"} />
          <input type="text" value={row[col2Key]} onChange={e => updateRow(rowKey, i, col2Key, e.target.value)} className={inputCls} placeholder={col2Label} />
          {rows.length > 1 && <button type="button" onClick={() => removeRow(rowKey, i)} className="mt-1.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"><X className="w-3.5 h-3.5" /></button>}
        </div>
      ))}
    </div>
  );
}

// ── Plan Details Read-Only Display ───────────────────────────────────────────────

function PlanTemplateDetails({ dept, data }: { dept: string; data: Record<string, unknown> }) {
  if (dept === "General Outpatient") {
    const d = data as { treatmentType?: string; medicationTiming?: string[]; hospitalTiming?: string[]; durationDays?: number };
    return (
      <div className="text-xs text-muted-foreground space-y-1 mt-1">
        {d.treatmentType && <p>Type: <span className="text-foreground capitalize">{d.treatmentType.replace(/_/g, " ")}</span></p>}
        {d.durationDays && <p>Duration: <span className="text-foreground">{d.durationDays} day{d.durationDays !== 1 ? "s" : ""}</span></p>}
        {(d.medicationTiming ?? []).length > 0 && <p>Medication timing: <span className="text-foreground">{(d.medicationTiming ?? []).join(", ")}</span></p>}
        {(d.hospitalTiming ?? []).length > 0 && <p>Hospital visits: <span className="text-foreground">{(d.hospitalTiming ?? []).join(", ")}</span></p>}
      </div>
    );
  }
  if (dept === "Antenatal / Maternity") {
    const d = data as { currentWeek?: string; ancSchedule?: Array<{ weekNumber: string; whatHappens: string; date: string }> };
    return (
      <div className="text-xs text-muted-foreground space-y-1 mt-1">
        {d.currentWeek && <p>Current week: <span className="text-foreground">{d.currentWeek}</span></p>}
        {(d.ancSchedule ?? []).filter(r => r.weekNumber || r.whatHappens).map((r, i) => (
          <p key={i}>Week {r.weekNumber}: <span className="text-foreground">{r.whatHappens}</span>{r.date ? ` — ${r.date}` : ""}</p>
        ))}
      </div>
    );
  }
  if (dept === "Paediatrics") {
    const d = data as { childAge?: string; vaccinationSchedule?: Array<{ ageAtVaccination: string; vaccinationName: string; date: string }> };
    return (
      <div className="text-xs text-muted-foreground space-y-1 mt-1">
        {d.childAge && <p>Child age: <span className="text-foreground">{d.childAge}</span></p>}
        {(d.vaccinationSchedule ?? []).filter(r => r.vaccinationName).map((r, i) => (
          <p key={i}><span className="text-foreground">{r.vaccinationName}</span> at {r.ageAtVaccination}{r.date ? ` — ${r.date}` : ""}</p>
        ))}
      </div>
    );
  }
  if (dept === "Surgery / Post-Op") {
    const d = data as { procedureDate?: string; procedureType?: string; inCareSchedule?: Array<{ date: string; whatHappens: string }> };
    return (
      <div className="text-xs text-muted-foreground space-y-1 mt-1">
        {d.procedureType && <p>Procedure: <span className="text-foreground">{d.procedureType}</span>{d.procedureDate ? ` on ${d.procedureDate}` : ""}</p>}
        {(d.inCareSchedule ?? []).filter(r => r.whatHappens).map((r, i) => (
          <p key={i}>{r.date}: <span className="text-foreground">{r.whatHappens}</span></p>
        ))}
      </div>
    );
  }
  // Dental / Eye / Fertility / IVF
  const schedule = data.inCareSchedule as Array<{ date: string; [k: string]: string }> | undefined;
  if (schedule) {
    return (
      <div className="text-xs text-muted-foreground space-y-1 mt-1">
        {schedule.filter(r => Object.values(r).some(v => v)).map((r, i) => {
          const detail = Object.entries(r).filter(([k]) => k !== "date").map(([, v]) => v).filter(Boolean).join(" ");
          return <p key={i}>{r.date}: <span className="text-foreground">{detail}</span></p>;
        })}
      </div>
    );
  }
  return null;
}
