import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital, HospitalSettings, HospitalModules, AutomationLog } from "@/lib/api";
import {
  Building2, Save, Loader2, AlertCircle, ChevronLeft,
  Settings, Puzzle, Shield, ToggleLeft, ToggleRight, RefreshCw,
  Eye, EyeOff, KeyRound, Plus, X, Zap, CheckCircle2, XCircle,
  Clock, RotateCcw, Mail, MessageSquare, Filter, Copy, Check, Link, Users,
} from "lucide-react";

const ERA_PATIENT_URL = (import.meta.env.VITE_ERA_PATIENT_URL ?? "https://app.erasystem.com.ng").replace(/\/$/, "");

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono text-foreground truncate">{value}</p>
      </div>
      <CopyBtn text={value} />
    </div>
  );
}

interface Props { id: number; }

type Tab = "general" | "settings" | "modules" | "automations";

const PREDEFINED_DEPARTMENTS = [
  "General Practice", "Fertility and Reproductive Health", "Surgery",
  "Maternity and Antenatal", "Pediatrics", "Oncology",
  "Physiotherapy and Rehabilitation", "Mental Health and Psychiatry",
  "Cardiology", "Dental", "Orthopaedics", "Urology",
  "Gastroenterology", "Ophthalmology and Eye", "Dermatology",
  "Endocrinology", "Radiology", "Chronic Disease Management",
  "Emergency and Trauma", "ENT", "Neurology",
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="transition">
      {checked
        ? <ToggleRight className="w-8 h-8 text-primary" />
        : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function inputCls() {
  return "w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: string) {
  if (status === "sent") return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status === "failed") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "sent") return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Clock className="w-3.5 h-3.5 text-amber-400" />;
}

export default function HospitalDetail({ id }: Props) {
  const [, setLocation] = useLocation();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [modules, setModules] = useState<HospitalModules | null>(null);
  const [automations, setAutomations] = useState<AutomationLog[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoFilter, setAutoFilter] = useState<"all" | "failed" | "queued" | "sent">("all");
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  // General form
  const [name, setName] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [active, setActive] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [allCopied, setAllCopied] = useState(false);

  // Settings form
  const [departments, setDepartments] = useState<string[]>([]);
  const [customDeptInput, setCustomDeptInput] = useState("");
  const [postTreatmentDays, setPostTreatmentDays] = useState("");
  const [dormantDays, setDormantDays] = useState("");
  const [language, setLanguage] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [clinicDescription, setClinicDescription] = useState("");
  const [sendingEmail, setSendingEmail] = useState("");
  const [postTreatmentCheckinDays, setPostTreatmentCheckinDays] = useState("");
  const [postCareCheckinDays, setPostCareCheckinDays] = useState("");
  const [whatsappFromNumber, setWhatsappFromNumber] = useState("");

  // Modules form
  const [apptEnabled, setApptEnabled] = useState(true);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [wellnessEnabled, setWellnessEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, s, m] = await Promise.all([
        api.getHospital(id),
        api.getSettings(id),
        api.getModules(id),
      ]);
      setHospital(h);
      setSettings(s);
      setModules(m);
      setName(h.name);
      setSubStatus(h.subscriptionStatus);
      setActive(h.active);
      setDepartments(s.departments ?? []);
      setPostTreatmentDays(s.pipelinePostTreatmentDays?.toString() ?? "");
      setDormantDays(s.pipelineDormantDays?.toString() ?? "");
      setLanguage(s.language ?? "");
      setTones(Array.isArray(s.tone) ? s.tone : []);
      setClinicDescription(s.clinicDescription ?? "");
      setSendingEmail(s.sendingEmail ?? "");
      setPostTreatmentCheckinDays(s.postTreatmentCheckinDays?.toString() ?? "");
      setPostCareCheckinDays(s.postCareCheckinDays?.toString() ?? "");
      setWhatsappFromNumber(s.whatsappFromNumber ?? "");
      setApptEnabled(m.appointmentsEnabled);
      setFeedbackEnabled(m.feedbackEnabled);
      setWellnessEnabled(m.wellnessNewsletterEnabled ?? true);
      setMessagesEnabled(m.messagesEnabled ?? false);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) ?? "Failed to load hospital");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAutomations = useCallback(async () => {
    setAutoLoading(true);
    try {
      const data = await api.getAutomationLog({
        hospitalId: id,
        status: autoFilter === "all" ? undefined : autoFilter,
      });
      setAutomations(data);
    } catch {
      /* silently ignore */
    } finally {
      setAutoLoading(false);
    }
  }, [id, autoFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === "automations") loadAutomations();
  }, [tab, loadAutomations]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const saveGeneral = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateHospital(id, { name, subscriptionStatus: subStatus, active });
      flash("Hospital updated");
      load();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateSettings(id, {
        departments,
        pipelinePostTreatmentDays: postTreatmentDays ? parseInt(postTreatmentDays) : null,
        pipelineDormantDays: dormantDays ? parseInt(dormantDays) : null,
        language: language || null,
        tone: tones.length > 0 ? tones : null,
        clinicDescription: clinicDescription || null,
        sendingEmail: sendingEmail || null,
        postTreatmentCheckinDays: postTreatmentCheckinDays ? parseInt(postTreatmentCheckinDays) : null,
        postCareCheckinDays: postCareCheckinDays ? parseInt(postCareCheckinDays) : null,
        whatsappFromNumber: whatsappFromNumber || null,
      } as Partial<HospitalSettings>);
      flash("Settings saved");
      load();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveModules = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateModules(id, {
        appointmentsEnabled: apptEnabled,
        feedbackEnabled,
        wellnessNewsletterEnabled: wellnessEnabled,
        whatsappEnabled: true,
        messagesEnabled,
      });
      flash("Modules saved");
      load();
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      const result = await api.regeneratePassword(id);
      setHospital(prev => prev ? { ...prev, ...result.hospital, staffCredentials: prev.staffCredentials } : result.hospital);
      flash("Password regenerated — share new credentials with the hospital");
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) ?? "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const copyAllCredentials = () => {
    if (!hospital) return;
    const loginUrl = `${ERA_PATIENT_URL}/?h=${hospital.username}`;
    const staffCreds = hospital.staffCredentials;
    const msg = [
      `🏥 Era Patient — Login Details for ${hospital.name}`,
      ``,
      `🔗 Admin Login Link:`,
      `${loginUrl}`,
      ``,
      `🔐 Admin Password: ${hospital.currentPassword ?? "(not available)"}`,
      ``,
      `👩‍⚕️ Nurse`,
      `Username: ${staffCreds?.nurseUsername ?? ""}`,
      `Password: ${staffCreds?.nursePlainPassword ?? "nurse1234"}`,
      ``,
      `🗂️ Receptionist`,
      `Username: ${staffCreds?.receptionistUsername ?? ""}`,
      `Password: ${staffCreds?.receptionistPlainPassword ?? "recep1234"}`,
      ``,
      `ℹ️ Staff log in at: ${ERA_PATIENT_URL} (Staff Login tab)`,
    ].join("\n");
    navigator.clipboard.writeText(msg).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    });
  };

  const retryAutomation = async (logId: number) => {
    setRetryingId(logId);
    try {
      await api.retryAutomation(logId);
      await loadAutomations();
    } catch {
      /* silently ignore */
    } finally {
      setRetryingId(null);
    }
  };

  const toggleDepartment = (dept: string) => {
    setDepartments(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };

  const addCustomDept = () => {
    const trimmed = customDeptInput.trim();
    if (!trimmed || departments.includes(trimmed)) return;
    setDepartments(prev => [...prev, trimmed]);
    setCustomDeptInput("");
  };

  const customDepts = departments.filter(d => !PREDEFINED_DEPARTMENTS.includes(d));

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: "general", label: "General", icon: Shield },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "modules", label: "Modules", icon: Puzzle },
    { key: "automations", label: "Automations", icon: Zap },
  ];

  if (loading) {
    return (
      <Layout breadcrumb={[{ label: "Hospitals", href: "/" }, { label: "…" }]}>
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </Layout>
    );
  }

  if (!hospital) {
    return (
      <Layout breadcrumb={[{ label: "Hospitals", href: "/" }]}>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <AlertCircle className="w-6 h-6" />
          <span className="text-sm">{error || "Hospital not found"}</span>
          <button onClick={() => setLocation("/")} className="text-xs text-primary hover:underline">Back to dashboard</button>
        </div>
      </Layout>
    );
  }

  const automationTypeName = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Layout breadcrumb={[{ label: "Hospitals", href: "/" }, { label: hospital.name }]}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/")} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{hospital.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{hospital.username}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className={`text-xs font-medium ${hospital.active ? "text-emerald-400" : "text-red-400"}`}>
                  {hospital.active ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {(error || success) && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border mb-4 ${
          error ? "text-destructive bg-destructive/10 border-destructive/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        }`}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {error || success}
        </div>
      )}

      {/* ── GENERAL TAB ── */}
      {tab === "general" && (
        <div className="space-y-4 max-w-lg">
        {/* Credentials Card */}
        {hospital && (
          <div className="rounded-xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Login Credentials</h2>
              <button
                type="button"
                onClick={copyAllCredentials}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                {allCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {allCopied ? "Copied!" : "Copy All"}
              </button>
            </div>

            {/* Login URL */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Link className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Admin Login Link</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-foreground break-all">{ERA_PATIENT_URL}/?h={hospital.username}</p>
                <CopyBtn text={`${ERA_PATIENT_URL}/?h=${hospital.username}`} />
              </div>
            </div>

            {/* Admin creds */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Admin Credentials</span>
              </div>
              <CredRow label="Username" value={hospital.username} />
              <div className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="text-sm font-mono text-foreground">
                    {hospital.currentPassword
                      ? (showAdminPass ? hospital.currentPassword : "•".repeat(hospital.currentPassword.length))
                      : <span className="text-muted-foreground italic text-xs">Not stored — use Regenerate</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {hospital.currentPassword && (
                    <>
                      <button type="button" onClick={() => setShowAdminPass(v => !v)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition">
                        {showAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyBtn text={hospital.currentPassword} />
                    </>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition"
                >
                  {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {regenerating ? "Regenerating…" : "Regenerate Password"}
                </button>
              </div>
            </div>

            {/* Staff creds */}
            {hospital.staffCredentials && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Staff Credentials</span>
                </div>
                <CredRow label="Nurse Username" value={hospital.staffCredentials.nurseUsername} />
                <CredRow label="Nurse Password" value={hospital.staffCredentials.nursePlainPassword} />
                <CredRow label="Receptionist Username" value={hospital.staffCredentials.receptionistUsername} />
                <CredRow label="Receptionist Password" value={hospital.staffCredentials.receptionistPlainPassword} />
                <p className="text-xs text-muted-foreground mt-2">Staff log in at {ERA_PATIENT_URL} using the Staff Login tab</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-card border border-border p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Account Details</h2>

          <Field label="Hospital Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls()} />
          </Field>

          <Field label="Subscription Status">
            <select value={subStatus} onChange={e => setSubStatus(e.target.value)} className={inputCls()}>
              {["active", "trial", "inactive"].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>

          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Account Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inactive accounts cannot log in</p>
            </div>
            <Toggle checked={active} onChange={setActive} />
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={saveGeneral} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && settings && (
        <div className="rounded-xl bg-card border border-border p-6 space-y-6 max-w-2xl">
          <h2 className="font-semibold text-foreground">Hospital Settings</h2>

          {/* Departments */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Departments</p>
              <p className="text-xs text-muted-foreground">Select which departments are active. These appear when logging treatment plans.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {PREDEFINED_DEPARTMENTS.map(dept => (
                  <label key={dept} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={departments.includes(dept)} onChange={() => toggleDepartment(dept)} className="w-4 h-4 rounded accent-primary shrink-0" />
                    <span className={`text-sm transition-colors ${departments.includes(dept) ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}`}>{dept}</span>
                  </label>
                ))}
              </div>
            </div>
            {customDepts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Custom departments</p>
                <div className="flex flex-wrap gap-2">
                  {customDepts.map(dept => (
                    <div key={dept} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
                      <span>{dept}</span>
                      <button type="button" onClick={() => setDepartments(prev => prev.filter(d => d !== dept))} className="text-primary/60 hover:text-primary transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text" value={customDeptInput} onChange={e => setCustomDeptInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomDept(); } }}
                placeholder="Add a custom department…" className={inputCls() + " flex-1"}
              />
              <button type="button" onClick={addCustomDept} disabled={!customDeptInput.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-40 transition">
                <Plus className="w-4 h-4" />Add
              </button>
            </div>
            {departments.length > 0 && <p className="text-xs text-muted-foreground">{departments.length} department{departments.length !== 1 ? "s" : ""} active</p>}
          </div>

          {/* Pipeline */}
          <div className="pt-2 border-t border-border grid grid-cols-2 gap-4">
            <Field label="Post-Treatment Days" hint="Days before moving to Post Care">
              <input type="number" value={postTreatmentDays} onChange={e => setPostTreatmentDays(e.target.value)} className={inputCls()} placeholder="14" min="1" />
            </Field>
            <Field label="Dormant Days" hint="Days before patient becomes dormant">
              <input type="number" value={dormantDays} onChange={e => setDormantDays(e.target.value)} className={inputCls()} placeholder="90" min="1" />
            </Field>
          </div>

          {/* Automation frequency */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Automation Check-in Frequency</p>
              <p className="text-xs text-muted-foreground">How often automated WhatsApp check-ins are sent to patients.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Post-Treatment Check-in (days)" hint="e.g. every 3 days">
                <input type="number" value={postTreatmentCheckinDays} onChange={e => setPostTreatmentCheckinDays(e.target.value)} className={inputCls()} placeholder="3" min="1" />
              </Field>
              <Field label="Post-Care Wellness (days)" hint="e.g. every 7 days">
                <input type="number" value={postCareCheckinDays} onChange={e => setPostCareCheckinDays(e.target.value)} className={inputCls()} placeholder="7" min="1" />
              </Field>
            </div>
          </div>

          {/* Email */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Email Sending</p>
              <p className="text-xs text-muted-foreground">The "From" address used for all outgoing emails (feedback, newsletters). Must be a verified Resend domain.</p>
            </div>
            <Field label="Sending Email">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email" value={sendingEmail} onChange={e => setSendingEmail(e.target.value)}
                  placeholder="noreply@yourhospital.com"
                  className={inputCls() + " pl-9"}
                />
              </div>
            </Field>
          </div>

          {/* WhatsApp */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">WhatsApp</p>
              <p className="text-xs text-muted-foreground">WhatsApp Business number (once Meta verification is complete).</p>
            </div>
            <Field label="WhatsApp From Number" hint="International format, e.g. +971501234567">
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text" value={whatsappFromNumber} onChange={e => setWhatsappFromNumber(e.target.value)}
                  placeholder="+971501234567"
                  className={inputCls() + " pl-9"}
                />
              </div>
            </Field>
          </div>

          <Field label="Language">
            <select value={language} onChange={e => setLanguage(e.target.value)} className={inputCls()}>
              <option value="">Default</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
            </select>
          </Field>

          {/* Communication Tone */}
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Communication Tone</p>
              <p className="text-xs text-muted-foreground">
                Select up to 4 tones. Used for all AI-generated messages.
                {tones.length > 0 && <span className="ml-1 text-primary font-medium">{tones.length}/4 selected</span>}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "Formal", label: "Formal", sub: "Strict and corporate" },
                { value: "Warm", label: "Warm", sub: "Caring and personal" },
                { value: "Friendly", label: "Friendly", sub: "Casual and modern" },
                { value: "Empathetic", label: "Empathetic", sub: "Deeply understanding" },
                { value: "Encouraging", label: "Encouraging", sub: "Motivating and uplifting" },
                { value: "Reassuring", label: "Reassuring", sub: "Calming, reduces anxiety" },
                { value: "Jovial", label: "Jovial", sub: "Light-hearted and cheerful" },
              ].map(t => {
                const selected = tones.includes(t.value);
                const atMax = tones.length >= 4 && !selected;
                return (
                  <button
                    key={t.value}
                    type="button"
                    disabled={atMax}
                    onClick={() => {
                      if (selected) setTones(prev => prev.filter(x => x !== t.value));
                      else if (tones.length < 4) setTones(prev => [...prev, t.value]);
                    }}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      selected ? "border-primary bg-primary/10 text-foreground" : atMax ? "border-border bg-muted/20 text-muted-foreground/40 cursor-not-allowed" : "border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-semibold">{t.label}</span>
                    </div>
                    <p className="text-xs leading-snug pl-5.5 opacity-70">{t.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Clinic Description" hint="Used for AI-generated messages">
            <textarea value={clinicDescription} onChange={e => setClinicDescription(e.target.value)} rows={3} className={inputCls() + " resize-none"} placeholder="A brief description of the clinic's specialty and patient care approach…" />
          </Field>

          <div className="flex justify-end pt-2">
            <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* ── MODULES TAB ── */}
      {tab === "modules" && modules && (
        <div className="rounded-xl bg-card border border-border p-6 space-y-4 max-w-lg">
          <h2 className="font-semibold text-foreground">Feature Modules</h2>
          <p className="text-sm text-muted-foreground">Control which features are available to this hospital's staff.</p>

          {[
            { key: "appointments", label: "Appointments", desc: "Calendar scheduling and appointment management", value: apptEnabled, set: setApptEnabled },
            { key: "feedback", label: "Patient Feedback", desc: "Post-visit feedback collection and analytics", value: feedbackEnabled, set: setFeedbackEnabled },
            { key: "wellness", label: "Wellness Newsletter", desc: "Weekly AI-generated wellness emails to patients", value: wellnessEnabled, set: setWellnessEnabled },
            { key: "messages", label: "Messages Inbox", desc: "WhatsApp inbox for two-way patient communication (requires WhatsApp setup)", value: messagesEnabled, set: setMessagesEnabled },
          ].map(mod => (
            <div key={mod.key} className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
              </div>
              <Toggle checked={mod.value} onChange={mod.set} />
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button onClick={saveModules} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Modules"}
            </button>
          </div>
        </div>
      )}

      {/* ── AUTOMATIONS TAB ── */}
      {tab === "automations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Automation Log</h2>
              <p className="text-sm text-muted-foreground mt-0.5">All AI messages, emails and WhatsApp automations for this hospital.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {(["all", "failed", "queued", "sent"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setAutoFilter(f); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${autoFilter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={loadAutomations} disabled={autoLoading} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition">
                <RefreshCw className={`w-4 h-4 ${autoLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {autoLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <div className="rounded-xl bg-card border border-border py-16 text-center text-muted-foreground">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No automation logs found</p>
              <p className="text-xs mt-1 opacity-60">Automations will appear here as patients move through the pipeline</p>
            </div>
          ) : (
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {automations.map(log => (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      <StatusIcon status={log.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{automationTypeName(log.automationType)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${statusBadge(log.status)}`}>
                          {log.status}
                        </span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                          {log.channel === "email" ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          {log.channel}
                        </span>
                        {log.retryCount > 0 && (
                          <span className="text-xs text-muted-foreground">·  {log.retryCount} retr{log.retryCount === 1 ? "y" : "ies"}</span>
                        )}
                      </div>
                      {log.patientName && (
                        <p className="text-xs text-muted-foreground mt-0.5">Patient: {log.patientName}</p>
                      )}
                      {log.messagePreview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{log.messagePreview}"</p>
                      )}
                      {log.errorMessage && (
                        <p className="text-xs text-red-400 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right space-y-1.5">
                      <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                      {log.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => retryAutomation(log.id)}
                          disabled={retryingId === log.id}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition disabled:opacity-50"
                        >
                          {retryingId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Filter className="w-3 h-3" />Showing {automations.length} records</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />Sent</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" />Failed</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" />Queued (WhatsApp ready)</span>
          </div>
        </div>
      )}
    </Layout>
  );
}
