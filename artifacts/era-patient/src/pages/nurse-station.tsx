import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPatients,
  getListPatientsQueryKey,
  getListQueueQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import type { Patient } from "@workspace/api-client-react";
import { apiUrl } from "@/lib/api";
import { getPatientStages } from "@/lib/utils";
import { FollowUpFlagModal } from "@/components/flag-modals";
import {
  Search, Stethoscope, Flag, Loader2, Plus,
  Pencil, ChevronDown, ChevronUp, X, Calendar,
  CheckCircle2, Pill, Activity, Layers,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CarePlan {
  id: number;
  patientId: number;
  hospitalId: string;
  department: string | null;
  summary: string;
  templateData: Record<string, unknown>;
  status: "open" | "active" | "ended";
  createdAt: string;
  updatedAt: string;
  endedAt?: string | null;
  beneficiaryName?: string | null;
  beneficiaryEmail?: string | null;
  beneficiaryRelationship?: string | null;
}

interface MedicationRow {
  id: string;
  name: string;
  dosage: string;
  durationDays: number | "";
  timing: Record<string, string>; // slot → "HH:MM"
}

interface ProcedureRow {
  id: string;
  name: string;
  durationDays: number | "";
  timing: Record<string, string>;
}

interface CategoryEntry {
  type: string;
  data: Record<string, unknown>;
}

interface ScheduleRow { date: string; [key: string]: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMING_SLOTS = [
  { value: "morning",   label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening",   label: "Evening" },
  { value: "night",     label: "Night" },
];

// Specialist categories (not General Outpatient — that's replaced by Medications/Procedures)
const SPECIALIST_CATEGORIES = [
  "Antenatal / Maternity",
  "Paediatrics",
  "Surgery / Post-Op",
  "Dental",
  "Eye",
  "Fertility / IVF",
  "ENT (Ear, Nose and Throat)",
];

function emptyMed(): MedicationRow {
  return { id: crypto.randomUUID(), name: "", dosage: "", durationDays: "", timing: {} };
}
function emptyProc(): ProcedureRow {
  return { id: crypto.randomUUID(), name: "", durationDays: "", timing: {} };
}
function emptyCategoryData(type: string): Record<string, unknown> {
  if (type === "Antenatal / Maternity") return { currentWeek: "", ancSchedule: [{ weekNumber: "", whatHappens: "", date: "", time: "" }] };
  if (type === "Paediatrics") return { childAge: "", vaccinationSchedule: [{ ageAtVaccination: "", vaccinationName: "", date: "", time: "" }] };
  if (type === "Surgery / Post-Op") return { procedureDate: "", procedureTime: "", procedureType: "", inCareSchedule: [{ date: "", time: "", whatHappens: "" }] };
  if (type === "Dental") return { inCareSchedule: [{ date: "", time: "", treatmentType: "" }] };
  if (type === "Eye") return { inCareSchedule: [{ date: "", time: "", action: "" }] };
  if (type === "Fertility / IVF") return { inCareSchedule: [{ date: "", time: "", whatHappens: "" }] };
  if (type === "ENT (Ear, Nose and Throat)") return { inCareSchedule: [{ date: "", time: "", treatmentType: "" }] };
  return {};
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NurseStation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hospital, hospitalConfig } = useAuth();
  const apptEnabled = hospitalConfig?.modules?.appointmentsEnabled ?? true;

  // Patient search
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Care plans
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [carePlansLoading, setCarePlansLoading] = useState(false);
  const [planMode, setPlanMode] = useState<"list" | "fill" | "edit">("list");
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [confirmEndPlanId, setConfirmEndPlanId] = useState<number | null>(null);
  const [endingPlanId, setEndingPlanId] = useState<number | null>(null);

  // Treatment plan form state
  const [planSummary, setPlanSummary] = useState("");
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [procedures, setProcedures] = useState<ProcedureRow[]>([]);
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [planBeneficiaryName, setPlanBeneficiaryName] = useState("");
  const [planBeneficiaryEmail, setPlanBeneficiaryEmail] = useState("");
  const [planBeneficiaryRelationship, setPlanBeneficiaryRelationship] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [closingPlan, setClosingPlan] = useState(false);
  const [openingPlan, setOpeningPlan] = useState(false);
  const [templatePlanId, setTemplatePlanId] = useState<number | null>(null);

  // Flag section
  const [flagSearch, setFlagSearch] = useState("");
  const [selectedFlagPatient, setSelectedFlagPatient] = useState<Patient | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);

  // Return visit section
  const [rvSearch, setRvSearch] = useState("");
  const [selectedRvPatient, setSelectedRvPatient] = useState<Patient | null>(null);
  const [rvVisits, setRvVisits] = useState<{ id: number; visitDate: string; visitTime: string | null; reason: string; notes: string | null; scheduledByName: string | null; status: string }[]>([]);
  const [rvLoading, setRvLoading] = useState(false);
  const [showRvForm, setShowRvForm] = useState(false);
  const [rvDate, setRvDate] = useState("");
  const [rvTime, setRvTime] = useState("");
  const [rvReason, setRvReason] = useState("");
  const [rvNotes, setRvNotes] = useState("");
  const [rvSendSms, setRvSendSms] = useState(false);
  const [savingRv, setSavingRv] = useState(false);
  const [deletingRvId, setDeletingRvId] = useState<number | null>(null);

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
  const { data: rvSearchResults = [], isFetching: rvSearching } = useListPatients(
    { search: rvSearch },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: rvSearch.trim().length >= 2 } as any }
  );

  const authHeader = () => ({ "x-hospital-token": hospital?.token ?? "" });

  const fetchCarePlans = useCallback(async (patientId: number) => {
    setCarePlansLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/care-plans`), { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load care plans");
      setCarePlans(await res.json() as CarePlan[]);
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

  // Populate form from an existing plan's templateData
  const loadPlanIntoForm = (plan: CarePlan) => {
    const td = plan.templateData ?? {};
    setPlanSummary(plan.summary ?? "");
    setMedications((td.medications as MedicationRow[] | undefined) ?? []);
    setProcedures((td.procedures as ProcedureRow[] | undefined) ?? []);
    setCategories((td.categories as CategoryEntry[] | undefined) ?? []);
    setPlanBeneficiaryName(plan.beneficiaryName ?? "");
    setPlanBeneficiaryEmail(plan.beneficiaryEmail ?? "");
    setPlanBeneficiaryRelationship(plan.beneficiaryRelationship ?? "");
  };

  const openFillForm = (plan: CarePlan) => {
    loadPlanIntoForm(plan);
    setEditingPlan(plan);
    setPlanMode("fill");
  };

  const openEditForm = (plan: CarePlan) => {
    loadPlanIntoForm(plan);
    setEditingPlan(plan);
    setPlanMode("edit");
  };

  const cancelPlanForm = () => {
    setPlanMode("list");
    setEditingPlan(null);
  };

  const resetForm = () => {
    setPlanSummary("");
    setMedications([]);
    setProcedures([]);
    setCategories([]);
    setPlanBeneficiaryName("");
    setPlanBeneficiaryEmail("");
    setPlanBeneficiaryRelationship("");
  };

  // Open a new treatment plan (creates a draft immediately)
  const handleOpenNewPlan = async () => {
    if (!selectedPatient) return;
    setOpeningPlan(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${selectedPatient.id}/care-plans`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({}),
      });
      const json = await res.json() as CarePlan & { existingPlan?: CarePlan };
      if (res.status === 409 && json.existingPlan) {
        // An open draft already exists — navigate to it instead of creating a duplicate
        resetForm();
        setEditingPlan(json.existingPlan);
        setPlanMode("fill");
        toast({ title: "Draft already open", description: "Continuing your existing draft treatment plan." });
        return;
      }
      if (!res.ok) throw new Error("Failed");
      resetForm();
      setEditingPlan(json);
      setPlanMode("fill");
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
    } catch {
      toast({ title: "Failed to open treatment plan", variant: "destructive" });
    } finally {
      setOpeningPlan(false);
    }
  };

  const buildTemplateData = () => ({
    medications,
    procedures,
    categories,
  });

  // Save draft (plan stays "open", no automations)
  const handleSaveDraft = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${editingPlan.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          summary: planSummary,
          templateData: buildTemplateData(),
          beneficiaryName: planBeneficiaryName.trim() || undefined,
          beneficiaryEmail: planBeneficiaryEmail.trim() || undefined,
          beneficiaryRelationship: planBeneficiaryRelationship.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Draft saved" });
      await fetchCarePlans(editingPlan.patientId);
      cancelPlanForm();
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  // Save changes to an already-active plan (sends update notification to patient)
  const handleSaveEdit = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${editingPlan.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          summary: planSummary,
          templateData: buildTemplateData(),
          beneficiaryName: planBeneficiaryName.trim() || undefined,
          beneficiaryEmail: planBeneficiaryEmail.trim() || undefined,
          beneficiaryRelationship: planBeneficiaryRelationship.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Treatment plan updated", description: "Patient will be notified of the changes." });
      await fetchCarePlans(editingPlan.patientId);
      cancelPlanForm();
    } catch {
      toast({ title: "Failed to update plan", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  // Close the treatment plan — fires all automations and sends patient communications
  const handleClosePlan = async () => {
    if (!editingPlan || !selectedPatient) return;
    setClosingPlan(true);
    try {
      const res = await fetch(apiUrl(`/api/care-plans/${editingPlan.id}/close`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          summary: planSummary,
          templateData: buildTemplateData(),
          beneficiaryName: planBeneficiaryName.trim() || undefined,
          beneficiaryEmail: planBeneficiaryEmail.trim() || undefined,
          beneficiaryRelationship: planBeneficiaryRelationship.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: "Treatment plan activated",
        description: `${selectedPatient.firstName} ${selectedPatient.lastName} has been notified with their care plan.`,
      });
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
      await fetchCarePlans(selectedPatient.id);
      cancelPlanForm();
    } catch {
      toast({ title: "Failed to close treatment plan", variant: "destructive" });
    } finally {
      setClosingPlan(false);
    }
  };

  const handleEndPlanEarly = async (planId: number, cancelOnly = false) => {
    if (!selectedPatient) return;
    setEndingPlanId(planId);
    try {
      const url = cancelOnly
        ? apiUrl(`/api/care-plans/${planId}?cancelOnly=true`)
        : apiUrl(`/api/care-plans/${planId}`);
      const res = await fetch(url, { method: "DELETE", headers: authHeader() });
      if (!res.ok) throw new Error("End failed");
      toast({
        title: cancelOnly ? "Treatment plan cancelled" : "Care plan ended",
        description: cancelOnly
          ? "The plan has been cancelled. The patient has not been moved to post treatment."
          : "The treatment plan has been closed.",
      });
      await fetchCarePlans(selectedPatient.id);
      setConfirmEndPlanId(null);
      queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
    } catch {
      toast({ title: cancelOnly ? "Failed to cancel care plan" : "Failed to end care plan", variant: "destructive" });
    } finally {
      setEndingPlanId(null);
    }
  };

  const fetchRvVisits = async (patientId: number) => {
    setRvLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${patientId}/return-visits`), { headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      setRvVisits(await res.json() as typeof rvVisits);
    } catch {
      setRvVisits([]);
    } finally {
      setRvLoading(false);
    }
  };

  const handleScheduleRv = async () => {
    if (!selectedRvPatient || !rvDate || !rvReason.trim()) return;
    setSavingRv(true);
    try {
      const res = await fetch(apiUrl(`/api/patients/${selectedRvPatient.id}/return-visits`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          visitDate: rvDate,
          visitTime: rvTime || undefined,
          reason: rvReason.trim(),
          notes: rvNotes.trim() || undefined,
          scheduledBy: "nurse",
          sendSms: rvSendSms,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json() as { smsSent?: boolean; smsError?: string | null };
      let desc = "Patient will be reminded 24h and 3h before.";
      if (rvSendSms) {
        desc += result.smsSent ? " SMS confirmation sent." : ` SMS failed: ${result.smsError ?? "unknown error"}.`;
      }
      toast({ title: "Return visit scheduled", description: desc });
      setRvDate(""); setRvTime(""); setRvReason(""); setRvNotes(""); setRvSendSms(false); setShowRvForm(false);
      await fetchRvVisits(selectedRvPatient.id);
    } catch {
      toast({ title: "Failed to schedule return visit", variant: "destructive" });
    } finally {
      setSavingRv(false);
    }
  };

  const handleDeleteRv = async (visitId: number) => {
    setDeletingRvId(visitId);
    try {
      const res = await fetch(apiUrl(`/api/return-visits/${visitId}`), { method: "DELETE", headers: authHeader() });
      if (!res.ok) throw new Error("Failed");
      setRvVisits(prev => prev.filter(v => v.id !== visitId));
      toast({ title: "Return visit cancelled" });
    } catch {
      toast({ title: "Failed to cancel return visit", variant: "destructive" });
    } finally {
      setDeletingRvId(null);
    }
  };

  const flagResults = flagSearchResults.filter(p => !getPatientStages(p as never, { apptEnabled }).every(s => s === "Dormant"));
  const draftPlans = carePlans.filter(p => p.status === "open");
  const activePlans = carePlans.filter(p => p.status === "active");
  const endedPlans = carePlans.filter(p => p.status === "ended");

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medication View</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage treatment plans and schedule patient return visits.</p>
        </div>

        {/* ── CARE PLANS ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Stethoscope className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Treatment Plans</span>
          </div>
          <div className="p-5">
            {!selectedPatient ? (
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
                            {patient.phone} · {getPatientStages(patient as never, { apptEnabled }).map((s, i) => (
                              <span key={s} className={s === "Queued" ? "text-primary font-medium" : ""}>{i > 0 ? " · " : ""}{s}</span>
                            ))}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : planMode === "list" ? (
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
                      Stage: {getPatientStages(selectedPatient as never, { apptEnabled }).join(" · ")}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>

                {carePlansLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Draft (open) plans */}
                    {draftPlans.map(plan => (
                      <div key={plan.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Draft</span>
                              <span className="text-xs text-muted-foreground">
                                · {new Date(plan.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/70 mt-0.5 line-clamp-1">
                              {plan.summary || "No summary yet — click Fill In to complete"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              className="text-xs h-7 bg-amber-600 hover:bg-amber-600/90 text-white border-0"
                              onClick={() => openFillForm(plan)}
                            >
                              Fill In
                            </Button>
                            <button
                              type="button"
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                              title="Discard draft"
                              onClick={() => setConfirmEndPlanId(plan.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {confirmEndPlanId === plan.id && (
                          <div className="px-4 py-3 bg-amber-500/5 border-t border-amber-500/20 space-y-2">
                            <p className="text-xs text-amber-300">Discard this draft treatment plan? This cannot be undone.</p>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmEndPlanId(null)}>Keep</Button>
                              <Button
                                type="button" size="sm"
                                className="flex-1 text-xs bg-destructive hover:bg-destructive/90 text-white border-0"
                                onClick={() => handleEndPlanEarly(plan.id)}
                                disabled={endingPlanId === plan.id}
                              >
                                {endingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Discard"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Active plans */}
                    {activePlans.map(plan => (
                      <div key={plan.id} className="rounded-lg border border-border overflow-hidden">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition"
                          onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary uppercase tracking-wide">{plan.department ?? "Treatment"}</span>
                              <span className="text-xs text-muted-foreground">
                                · {new Date(plan.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mt-0.5 line-clamp-1">{plan.summary}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                              onClick={e => { e.stopPropagation(); openEditForm(plan); }}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {expandedPlanId === plan.id
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {confirmEndPlanId === plan.id && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End treatment plan — choose an action</p>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                                <p className="text-xs font-semibold text-amber-300">Move to Post Treatment</p>
                                <p className="text-xs text-muted-foreground">End the plan and move the patient to the Post Treatment stage. Automated check-in emails will be sent.</p>
                                <Button
                                  type="button" size="sm"
                                  className="w-full text-xs bg-amber-600 hover:bg-amber-600/90 text-white border-0"
                                  onClick={() => handleEndPlanEarly(plan.id, false)}
                                  disabled={endingPlanId === plan.id}
                                >
                                  {endingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "End & Move to Post Treatment"}
                                </Button>
                              </div>
                              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                                <p className="text-xs font-semibold text-destructive">Cancel Treatment Plan</p>
                                <p className="text-xs text-muted-foreground">Cancel the plan without moving the patient to Post Treatment. Use this if the patient was added by mistake.</p>
                                <Button
                                  type="button" size="sm"
                                  className="w-full text-xs bg-destructive hover:bg-destructive/90 text-white border-0"
                                  onClick={() => handleEndPlanEarly(plan.id, true)}
                                  disabled={endingPlanId === plan.id}
                                >
                                  {endingPlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel Plan (No Post Treatment)"}
                                </Button>
                              </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => setConfirmEndPlanId(null)}>Go Back</Button>
                          </div>
                        )}

                        {expandedPlanId === plan.id && confirmEndPlanId !== plan.id && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
                            <p className="text-sm text-foreground">{plan.summary}</p>
                            <PlanDetails plan={plan} />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                              onClick={e => { e.stopPropagation(); setConfirmEndPlanId(plan.id); }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              End Treatment Plan
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {draftPlans.length === 0 && activePlans.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No active treatment plans for this patient.</p>
                    )}
                  </div>
                )}

                {/* Past / ended care plans */}
                {endedPlans.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1 select-none list-none">
                      <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                      Past Plans ({endedPlans.length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {endedPlans.map(plan => (
                        <div key={plan.id} className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden opacity-80">
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{plan.department ?? "Treatment"}</span>
                                {plan.endedAt && (
                                  <span className="text-xs text-muted-foreground/70">
                                    · ended {new Date(plan.endedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.summary}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs shrink-0 h-7 px-2.5"
                              title="Start a new care plan using this as a template"
                              onClick={async () => {
                                setTemplatePlanId(plan.id);
                                try {
                                  const res = await fetch(apiUrl(`/api/patients/${selectedPatient.id}/care-plans`), {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", ...authHeader() },
                                    body: JSON.stringify({ summary: plan.summary }),
                                  });
                                  const json = await res.json() as CarePlan & { existingPlan?: CarePlan };
                                  const newPlan = (res.status === 409 && json.existingPlan) ? json.existingPlan : json;
                                  if (res.status === 409) {
                                    toast({ title: "Draft already open", description: "An existing draft has been loaded. You can overwrite its content." });
                                  } else if (!res.ok) {
                                    throw new Error("Failed");
                                  }
                                  // Pre-populate form with the old plan's content
                                  const td = plan.templateData ?? {};
                                  setMedications((td.medications as MedicationRow[] | undefined) ?? []);
                                  setProcedures((td.procedures as ProcedureRow[] | undefined) ?? []);
                                  setCategories((td.categories as CategoryEntry[] | undefined) ?? []);
                                  setPlanSummary(plan.summary ?? "");
                                  setPlanBeneficiaryName(plan.beneficiaryName ?? "");
                                  setPlanBeneficiaryEmail(plan.beneficiaryEmail ?? "");
                                  setPlanBeneficiaryRelationship(plan.beneficiaryRelationship ?? "");
                                  setEditingPlan(newPlan);
                                  setPlanMode("fill");
                                  queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
                                  queryClient.invalidateQueries({ queryKey: getListQueueQueryKey() });
                                } catch {
                                  toast({ title: "Failed to open treatment plan", variant: "destructive" });
                                } finally {
                                  setTemplatePlanId(null);
                                }
                              }}
                            >
                              {templatePlanId === plan.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use as Template"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedPatient(null)}>
                    Done
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2"
                    onClick={handleOpenNewPlan}
                    disabled={openingPlan}
                  >
                    {openingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Open Treatment Plan
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Treatment plan form (fill draft or edit active) ── */
              <div className="space-y-5">
                {/* Patient bar */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {planMode === "fill" ? "Filling draft treatment plan" : "Editing active treatment plan"}
                    </p>
                  </div>
                  <button type="button" className="p-1 rounded hover:bg-muted transition" onClick={cancelPlanForm}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* ── Medications section ── */}
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Medications</p>
                    <span className="text-xs text-muted-foreground ml-1">(pharmacist)</span>
                  </div>
                  {medications.map((med, i) => (
                    <MedicationCard
                      key={med.id}
                      med={med}
                      onChange={updated => setMedications(prev => prev.map((m, j) => j === i ? updated : m))}
                      onRemove={() => setMedications(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setMedications(prev => [...prev, emptyMed()])}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Medication
                  </button>
                </div>

                {/* ── Procedures section ── */}
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Procedures / Treatments</p>
                    <span className="text-xs text-muted-foreground ml-1">(nurse)</span>
                  </div>
                  {procedures.map((proc, i) => (
                    <ProcedureCard
                      key={proc.id}
                      proc={proc}
                      onChange={updated => setProcedures(prev => prev.map((p, j) => j === i ? updated : p))}
                      onRemove={() => setProcedures(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setProcedures(prev => [...prev, emptyProc()])}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Procedure
                  </button>
                </div>

                {/* ── Specialist categories section ── */}
                <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold">Specialist Categories</p>
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                  </div>
                  {categories.map((cat, i) => (
                    <div key={`${cat.type}-${i}`} className="space-y-2 p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{cat.type}</p>
                        <button
                          type="button"
                          onClick={() => setCategories(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <CategoryTemplate
                        type={cat.type}
                        data={cat.data}
                        onChange={data => setCategories(prev => prev.map((c, j) => j === i ? { ...c, data } : c))}
                      />
                    </div>
                  ))}
                  {/* Picker for adding a new category */}
                  <select
                    className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value=""
                    onChange={e => {
                      const type = e.target.value;
                      if (!type) return;
                      if (categories.some(c => c.type === type)) return;
                      setCategories(prev => [...prev, { type, data: emptyCategoryData(type) }]);
                    }}
                  >
                    <option value="">+ Add specialist category…</option>
                    {SPECIALIST_CATEGORIES.filter(c => !categories.some(cat => cat.type === c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* ── Summary / Plan Notes ── */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Plan Summary / Notes</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe the overall treatment plan, diagnosis, and any important instructions…"
                    value={planSummary}
                    onChange={e => setPlanSummary(e.target.value)}
                  />
                </div>

                {/* ── Accountability contact ── */}
                <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Accountability Contact <span className="text-muted-foreground font-normal">(optional)</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">Someone who will receive reminders to check on the patient.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. John Doe"
                        value={planBeneficiaryName}
                        onChange={e => setPlanBeneficiaryName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Email</label>
                      <input
                        type="email"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. john@email.com"
                        value={planBeneficiaryEmail}
                        onChange={e => setPlanBeneficiaryEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Relationship to patient</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={planBeneficiaryRelationship}
                      onChange={e => setPlanBeneficiaryRelationship(e.target.value)}
                    >
                      <option value="">Select relationship…</option>
                      {["Wife","Husband","Partner","Mother","Father","Sister","Brother","Daughter","Son","Grandmother","Grandfather","Aunt","Uncle","Friend","Carer","Guardian"].map(r => (
                        <option key={r} value={r.toLowerCase()}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Action buttons ── */}
                {planMode === "fill" ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={handleClosePlan}
                      disabled={closingPlan || savingPlan}
                      className="w-full gap-2"
                    >
                      {closingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {closingPlan ? "Activating…" : "Close & Activate Treatment Plan"}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={cancelPlanForm}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleSaveDraft}
                        disabled={savingPlan || closingPlan}
                      >
                        {savingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                        Save Draft
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-end pt-1">
                    <Button type="button" variant="outline" onClick={cancelPlanForm}>Cancel</Button>
                    <Button type="button" onClick={handleSaveEdit} disabled={savingPlan}>
                      {savingPlan ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />Saving…</> : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RETURN VISITS ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Schedule Return Visit</span>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Book a patient to come back on a specific date. They will receive a reminder 24 hours and 3 hours before the visit.</p>
            {!selectedRvPatient ? (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    placeholder="Search patient by name or ID…"
                    value={rvSearch}
                    onChange={e => setRvSearch(e.target.value)}
                    className="pr-9"
                  />
                  {rvSearching
                    ? <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    : <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />}
                </div>
                {rvSearch.trim().length >= 2 && (
                  <div className="space-y-1.5">
                    {(rvSearchResults as Patient[]).filter(p => !getPatientStages(p as never, { apptEnabled }).every(s => s === "Dormant")).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No patients found</p>
                    ) : (rvSearchResults as Patient[]).filter(p => !getPatientStages(p as never, { apptEnabled }).every(s => s === "Dormant")).map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 text-left transition-colors"
                        onClick={() => { setSelectedRvPatient(patient); setRvSearch(""); fetchRvVisits(patient.id); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs text-muted-foreground">{patient.patientId && <span className="font-mono mr-2">ID: {patient.patientId}</span>}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedRvPatient.firstName[0]}{selectedRvPatient.lastName[0]}
                  </div>
                  <p className="flex-1 font-semibold text-sm">{selectedRvPatient.firstName} {selectedRvPatient.lastName}</p>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedRvPatient(null); setRvVisits([]); setShowRvForm(false); }}>Change</Button>
                </div>

                {rvLoading ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : rvVisits.filter(v => v.status === "scheduled").length > 0 && (
                  <div className="space-y-1.5">
                    {rvVisits.filter(v => v.status === "scheduled").map(rv => (
                      <div key={rv.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0 text-xs">
                          <span className="font-bold text-primary uppercase leading-none">{new Date(rv.visitDate + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}</span>
                          <span className="font-bold text-sm leading-none mt-0.5">{new Date(rv.visitDate + "T12:00:00").getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{rv.reason}</p>
                          <p className="text-xs text-muted-foreground">{new Date(rv.visitDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}{rv.visitTime ? ` · ${rv.visitTime}` : ""}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteRv(rv.id)} disabled={deletingRvId === rv.id}>
                          {deletingRvId === rv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!showRvForm ? (
                  <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowRvForm(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    Schedule New Visit
                  </Button>
                ) : (
                  <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date *</Label>
                        <Input type="date" value={rvDate} onChange={e => setRvDate(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Time (optional)</Label>
                        <Input type="time" value={rvTime} onChange={e => setRvTime(e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reason *</Label>
                      <Input
                        placeholder="e.g. Follow-up scan, Blood test, Review results…"
                        value={rvReason}
                        onChange={e => setRvReason(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes (optional)</Label>
                      <Input
                        placeholder="Additional instructions…"
                        value={rvNotes}
                        onChange={e => setRvNotes(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={rvSendSms} onChange={e => setRvSendSms(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary" />
                      <span className="text-xs text-muted-foreground">Send SMS confirmation to patient</span>
                    </label>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setShowRvForm(false); setRvDate(""); setRvTime(""); setRvReason(""); setRvNotes(""); setRvSendSms(false); }}>Cancel</Button>
                      <Button type="button" size="sm" className="text-xs gap-1.5" onClick={handleScheduleRv} disabled={savingRv || !rvDate || !rvReason.trim()}>
                        {savingRv ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {savingRv ? "Saving…" : "Schedule"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── FLAG PATIENT FOR OUTREACH ── */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/10">
            <Flag className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Flag Patient for Outreach</span>
          </div>
          <div className="p-5">
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
                      onClick={() => { setSelectedFlagPatient(patient); setShowFlagModal(true); setFlagSearch(""); }}
                    >
                      <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive font-bold text-xs flex items-center justify-center shrink-0">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{patient.firstName} {patient.lastName}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                          {patient.patientId && <span className="font-mono">ID: {patient.patientId}</span>}
                          {getPatientStages(patient as never, { apptEnabled }).map((s, i) => (
                            <span key={s} className="text-blue-400">{i > 0 ? " · " : ""}{s}</span>
                          ))}
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
          </div>
        </div>

        {showFlagModal && selectedFlagPatient && (
          <FollowUpFlagModal
            patientId={selectedFlagPatient.id}
            patientName={`${selectedFlagPatient.firstName} ${selectedFlagPatient.lastName}`}
            onClose={() => { setShowFlagModal(false); setSelectedFlagPatient(null); queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() }); }}
          />
        )}
      </div>
    </Layout>
  );
}

// ── Medication Card ──────────────────────────────────────────────────────────

function MedicationCard({ med, onChange, onRemove }: {
  med: MedicationRow;
  onChange: (m: MedicationRow) => void;
  onRemove: () => void;
}) {
  const inputCls = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const set = (key: keyof MedicationRow, val: unknown) => onChange({ ...med, [key]: val });
  const setTiming = (slot: string, time: string) => {
    const t = { ...med.timing };
    if (time) t[slot] = time; else delete t[slot];
    onChange({ ...med, timing: t });
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-background space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Drug name *"
            value={med.name}
            onChange={e => set("name", e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="Dosage (e.g. 500mg)"
            value={med.dosage}
            onChange={e => set("dosage", e.target.value)}
            className={inputCls}
          />
        </div>
        <button type="button" onClick={onRemove} className="p-1.5 mt-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Duration:</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Days"
          value={med.durationDays}
          onChange={e => { const v = e.target.value.replace(/\D/g, ""); set("durationDays", v ? parseInt(v) : ""); }}
          className={inputCls + " w-20"}
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Dose times (reminder fires at this exact time):</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {TIMING_SLOTS.map(slot => (
            <div key={slot.value} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">{slot.label}</span>
              <input
                type="time"
                value={med.timing[slot.value] ?? ""}
                onChange={e => setTiming(slot.value, e.target.value)}
                className={inputCls + " flex-1"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Procedure Card ────────────────────────────────────────────────────────────

function ProcedureCard({ proc, onChange, onRemove }: {
  proc: ProcedureRow;
  onChange: (p: ProcedureRow) => void;
  onRemove: () => void;
}) {
  const inputCls = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const set = (key: keyof ProcedureRow, val: unknown) => onChange({ ...proc, [key]: val });
  const setTiming = (slot: string, time: string) => {
    const t = { ...proc.timing };
    if (time) t[slot] = time; else delete t[slot];
    onChange({ ...proc, timing: t });
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-background space-y-2">
      <div className="flex items-start gap-2">
        <input
          type="text"
          placeholder="Procedure name *"
          value={proc.name}
          onChange={e => set("name", e.target.value)}
          className={inputCls + " flex-1"}
        />
        <button type="button" onClick={onRemove} className="p-1.5 mt-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Duration:</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Days"
          value={proc.durationDays}
          onChange={e => { const v = e.target.value.replace(/\D/g, ""); set("durationDays", v ? parseInt(v) : ""); }}
          className={inputCls + " w-20"}
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Visit times (reminder fires 3h before):</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {TIMING_SLOTS.map(slot => (
            <div key={slot.value} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">{slot.label}</span>
              <input
                type="time"
                value={proc.timing[slot.value] ?? ""}
                onChange={e => setTiming(slot.value, e.target.value)}
                className={inputCls + " flex-1"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Category Template (specialist departments) ─────────────────────────────

function CategoryTemplate({
  type, data, onChange,
}: {
  type: string;
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const addRow = (key: string, emptyRow: Record<string, string>) => {
    onChange({ ...data, [key]: [...((data[key] as ScheduleRow[]) ?? []), emptyRow] });
  };
  const removeRow = (key: string, idx: number) => {
    onChange({ ...data, [key]: ((data[key] as ScheduleRow[]) ?? []).filter((_, i) => i !== idx) });
  };
  const updateRow = (key: string, idx: number, field: string, val: string) => {
    const arr = [...((data[key] as ScheduleRow[]) ?? [])];
    arr[idx] = { ...arr[idx], [field]: val };
    onChange({ ...data, [key]: arr });
  };

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  if (type === "Antenatal / Maternity") {
    const rows = (data.ancSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Current Week of Pregnancy</label>
          <input type="text" value={(data.currentWeek as string) ?? ""} onChange={e => set("currentWeek", e.target.value)} className={inputCls} placeholder="e.g. 24" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">ANC Schedule</p>
            <button type="button" onClick={() => addRow("ancSchedule", { weekNumber: "", whatHappens: "", date: "", time: "" })} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3 h-3" />Add
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="relative rounded-md border border-border/40 p-2 space-y-1.5 sm:p-0 sm:border-0 sm:space-y-0 sm:grid sm:grid-cols-[2fr_1fr_auto_auto_auto] sm:gap-1.5 sm:items-start">
              <input type="text" value={row.whatHappens} onChange={e => updateRow("ancSchedule", i, "whatHappens", e.target.value)} className={inputCls} placeholder="What happens" />
              <input type="text" value={row.weekNumber} onChange={e => updateRow("ancSchedule", i, "weekNumber", e.target.value)} className={inputCls} placeholder="Week #" />
              <input type="date" value={row.date} onChange={e => updateRow("ancSchedule", i, "date", e.target.value)} className={inputCls} />
              <input type="time" value={row.time ?? ""} onChange={e => updateRow("ancSchedule", i, "time", e.target.value)} className={inputCls + " sm:w-24"} />
              {rows.length > 1 && <button type="button" onClick={() => removeRow("ancSchedule", i)} className="absolute top-1.5 right-1.5 sm:relative sm:top-auto sm:right-auto sm:mt-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "Paediatrics") {
    const rows = (data.vaccinationSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Child's Age</label>
          <input type="text" value={(data.childAge as string) ?? ""} onChange={e => set("childAge", e.target.value)} className={inputCls} placeholder="e.g. 3 months" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Vaccination Schedule</p>
            <button type="button" onClick={() => addRow("vaccinationSchedule", { ageAtVaccination: "", vaccinationName: "", date: "", time: "" })} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3 h-3" />Add
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="relative rounded-md border border-border/40 p-2 space-y-1.5 sm:p-0 sm:border-0 sm:space-y-0 sm:grid sm:grid-cols-[1fr_2fr_auto_auto_auto] sm:gap-1.5 sm:items-start">
              <input type="text" value={row.ageAtVaccination} onChange={e => updateRow("vaccinationSchedule", i, "ageAtVaccination", e.target.value)} className={inputCls} placeholder="Age" />
              <input type="text" value={row.vaccinationName} onChange={e => updateRow("vaccinationSchedule", i, "vaccinationName", e.target.value)} className={inputCls} placeholder="Vaccine name" />
              <input type="date" value={row.date} onChange={e => updateRow("vaccinationSchedule", i, "date", e.target.value)} className={inputCls} />
              <input type="time" value={row.time ?? ""} onChange={e => updateRow("vaccinationSchedule", i, "time", e.target.value)} className={inputCls + " sm:w-24"} />
              {rows.length > 1 && <button type="button" onClick={() => removeRow("vaccinationSchedule", i)} className="absolute top-1.5 right-1.5 sm:relative sm:top-auto sm:right-auto sm:mt-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "Surgery / Post-Op") {
    const rows = (data.inCareSchedule as ScheduleRow[]) ?? [];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Procedure Date</label>
            <input type="date" value={(data.procedureDate as string) ?? ""} onChange={e => set("procedureDate", e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Procedure Time</label>
            <input type="time" value={(data.procedureTime as string) ?? ""} onChange={e => set("procedureTime", e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Procedure Type</label>
          <select value={(data.procedureType as string) ?? ""} onChange={e => set("procedureType", e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </select>
        </div>
        <InCareRows rows={rows} rowKey="inCareSchedule" col2Key="whatHappens" col2Label="What happens" addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />
      </div>
    );
  }

  const simpleScheduleMap: Record<string, { col2Key: string; col2Label: string }> = {
    "Dental": { col2Key: "treatmentType", col2Label: "Treatment" },
    "Eye": { col2Key: "action", col2Label: "Action / Notes" },
    "Fertility / IVF": { col2Key: "whatHappens", col2Label: "What happens" },
    "ENT (Ear, Nose and Throat)": { col2Key: "treatmentType", col2Label: "Treatment / Action" },
  };

  if (simpleScheduleMap[type]) {
    const rows = (data.inCareSchedule as ScheduleRow[]) ?? [];
    const { col2Key, col2Label } = simpleScheduleMap[type];
    return <InCareRows rows={rows} rowKey="inCareSchedule" col2Key={col2Key} col2Label={col2Label} addRow={addRow} removeRow={removeRow} updateRow={updateRow} inputCls={inputCls} />;
  }

  return null;
}

// ── In-Care Schedule Rows (reusable) ─────────────────────────────────────────

function InCareRows({
  rows, rowKey, col2Key, col2Label, addRow, removeRow, updateRow, inputCls,
}: {
  rows: ScheduleRow[];
  rowKey: string;
  col2Key: string;
  col2Label: string;
  addRow: (key: string, row: Record<string, string>) => void;
  removeRow: (key: string, idx: number) => void;
  updateRow: (key: string, idx: number, field: string, val: string) => void;
  inputCls: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">In-Care Schedule</p>
        <button type="button" onClick={() => addRow(rowKey, { date: "", time: "", [col2Key]: "" })} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus className="w-3 h-3" />Add visit
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-md border border-border/40 p-2 space-y-1.5 sm:p-0 sm:border-0 sm:space-y-0 sm:grid sm:grid-cols-[auto_auto_1fr_auto] sm:gap-1.5 sm:items-start">
          <input type="date" value={row.date} onChange={e => updateRow(rowKey, i, "date", e.target.value)} className={inputCls} />
          <input type="time" value={row.time ?? ""} onChange={e => updateRow(rowKey, i, "time", e.target.value)} className={inputCls + " sm:w-24"} />
          <input type="text" value={row[col2Key]} onChange={e => updateRow(rowKey, i, col2Key, e.target.value)} className={inputCls} placeholder={col2Label} />
          {rows.length > 1 && <button type="button" onClick={() => removeRow(rowKey, i)} className="absolute top-1.5 right-1.5 sm:relative sm:top-auto sm:right-auto sm:mt-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>}
        </div>
      ))}
    </div>
  );
}

// ── Plan Details Read-Only Display ───────────────────────────────────────────

function PlanDetails({ plan }: { plan: CarePlan }) {
  const td = plan.templateData ?? {};
  const meds = (td.medications as MedicationRow[] | undefined) ?? [];
  const procs = (td.procedures as ProcedureRow[] | undefined) ?? [];
  const cats = (td.categories as CategoryEntry[] | undefined) ?? [];

  const hasNewFormat = meds.length > 0 || procs.length > 0 || cats.length > 0;
  if (!hasNewFormat) return null;

  return (
    <div className="text-xs text-muted-foreground space-y-2 mt-1">
      {meds.length > 0 && (
        <div>
          <p className="font-medium text-foreground/80 mb-1">Medications</p>
          {meds.map((m, i) => (
            <p key={i}>
              <span className="text-foreground">{m.name}</span>
              {m.dosage ? ` ${m.dosage}` : ""}
              {m.durationDays ? ` · ${m.durationDays} days` : ""}
              {Object.keys(m.timing ?? {}).length > 0 ? ` · ${Object.entries(m.timing).map(([slot, time]) => `${slot} @ ${time}`).join(", ")}` : ""}
            </p>
          ))}
        </div>
      )}
      {procs.length > 0 && (
        <div>
          <p className="font-medium text-foreground/80 mb-1">Procedures</p>
          {procs.map((p, i) => (
            <p key={i}>
              <span className="text-foreground">{p.name}</span>
              {p.durationDays ? ` · ${p.durationDays} days` : ""}
              {Object.keys(p.timing ?? {}).length > 0 ? ` · visit @ ${Object.values(p.timing).join(", ")}` : ""}
            </p>
          ))}
        </div>
      )}
      {cats.length > 0 && (
        <p>Categories: <span className="text-foreground">{cats.map(c => c.type).join(", ")}</span></p>
      )}
    </div>
  );
}
