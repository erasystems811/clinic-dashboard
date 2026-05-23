import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital, HospitalSettings, HospitalModules } from "@/lib/api";
import {
  Building2, Save, Loader2, AlertCircle, ChevronLeft,
  Settings, Puzzle, Shield, ToggleLeft, ToggleRight, RefreshCw,
  Eye, EyeOff, KeyRound, Plus, X
} from "lucide-react";

interface Props { id: number; }

type Tab = "general" | "settings" | "modules";

const PREDEFINED_DEPARTMENTS = [
  "General Practice",
  "Fertility and Reproductive Health",
  "Surgery",
  "Maternity and Antenatal",
  "Pediatrics",
  "Oncology",
  "Physiotherapy and Rehabilitation",
  "Mental Health and Psychiatry",
  "Cardiology",
  "Dental",
  "Orthopaedics",
  "Urology",
  "Gastroenterology",
  "Ophthalmology and Eye",
  "Dermatology",
  "Endocrinology",
  "Radiology",
  "Chronic Disease Management",
  "Emergency and Trauma",
  "ENT",
  "Neurology",
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="transition"
    >
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

export default function HospitalDetail({ id }: Props) {
  const [, setLocation] = useLocation();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [modules, setModules] = useState<HospitalModules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  // General form
  const [name, setName] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [active, setActive] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Settings form
  const [departments, setDepartments] = useState<string[]>([]);
  const [customDeptInput, setCustomDeptInput] = useState("");
  const [postTreatmentDays, setPostTreatmentDays] = useState("");
  const [dormantDays, setDormantDays] = useState("");
  const [language, setLanguage] = useState("");
  const [tone, setTone] = useState("");
  const [clinicDescription, setClinicDescription] = useState("");

  // Modules form
  const [apptEnabled, setApptEnabled] = useState(true);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);

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
      setTone(s.tone ?? "");
      setClinicDescription(s.clinicDescription ?? "");
      setApptEnabled(m.appointmentsEnabled);
      setFeedbackEnabled(m.feedbackEnabled);
    } catch (e: any) {
      setError(e.message ?? "Failed to load hospital");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const saveGeneral = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: any = { name, subscriptionStatus: subStatus, active };
      if (newPassword.trim()) {
        if (newPassword.length < 8) { setError("Password must be at least 8 characters"); setSaving(false); return; }
        payload.password = newPassword;
      }
      await api.updateHospital(id, payload);
      setNewPassword("");
      flash("Hospital updated");
      load();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
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
        tone: tone || null,
        clinicDescription: clinicDescription || null,
      });
      flash("Settings saved");
      load();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveModules = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateModules(id, { appointmentsEnabled: apptEnabled, feedbackEnabled });
      flash("Modules saved");
      load();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleDepartment = (dept: string) => {
    setDepartments(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const addCustomDept = () => {
    const trimmed = customDeptInput.trim();
    if (!trimmed || departments.includes(trimmed)) return;
    setDepartments(prev => [...prev, trimmed]);
    setCustomDeptInput("");
  };

  const removeCustomDept = (dept: string) => {
    setDepartments(prev => prev.filter(d => d !== dept));
  };

  // Custom departments are those not in the predefined list
  const customDepts = departments.filter(d => !PREDEFINED_DEPARTMENTS.includes(d));

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: "general", label: "General", icon: Shield },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "modules", label: "Modules", icon: Puzzle },
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
          <button onClick={() => setLocation("/")} className="text-xs text-primary hover:underline">
            Back to dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      breadcrumb={[
        { label: "Hospitals", href: "/" },
        { label: hospital.name },
      ]}
    >
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
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
        <button
          onClick={load}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
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
              tab === t.key
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
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
          error
            ? "text-destructive bg-destructive/10 border-destructive/20"
            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        }`}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Save className="w-4 h-4 shrink-0" />}
          {error || success}
        </div>
      )}

      {/* ── GENERAL TAB ── */}
      {tab === "general" && (
        <div className="rounded-xl bg-card border border-border p-6 space-y-5 max-w-lg">
          <h2 className="font-semibold text-foreground">Account Details</h2>

          <Field label="Hospital Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls()}
            />
          </Field>

          <Field label="Subscription Status">
            <select
              value={subStatus}
              onChange={e => setSubStatus(e.target.value)}
              className={inputCls()}
            >
              {["active", "trial", "inactive"].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>

          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Account Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inactive accounts cannot log in
              </p>
            </div>
            <Toggle checked={active} onChange={setActive} />
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Reset Password</h3>
            </div>
            <Field label="New Password" hint="Leave blank to keep current password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={inputCls() + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={saveGeneral}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
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
              <p className="text-xs text-muted-foreground">
                Select which departments are active for this hospital. These appear in the Nurse Station when logging a treatment plan.
              </p>
            </div>

            {/* Predefined checkboxes */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {PREDEFINED_DEPARTMENTS.map(dept => (
                  <label key={dept} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={departments.includes(dept)}
                      onChange={() => toggleDepartment(dept)}
                      className="w-4 h-4 rounded accent-primary shrink-0"
                    />
                    <span className={`text-sm transition-colors ${
                      departments.includes(dept)
                        ? "text-foreground font-medium"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {dept}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom departments */}
            {customDepts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Custom departments</p>
                <div className="flex flex-wrap gap-2">
                  {customDepts.map(dept => (
                    <div
                      key={dept}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary"
                    >
                      <span>{dept}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomDept(dept)}
                        className="text-primary/60 hover:text-primary transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add custom */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customDeptInput}
                onChange={e => setCustomDeptInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomDept(); } }}
                placeholder="Add a custom department…"
                className={inputCls() + " flex-1"}
              />
              <button
                type="button"
                onClick={addCustomDept}
                disabled={!customDeptInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-40 transition"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {departments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {departments.length} department{departments.length !== 1 ? "s" : ""} active
              </p>
            )}
          </div>

          {/* Pipeline */}
          <div className="pt-2 border-t border-border grid grid-cols-2 gap-4">
            <Field label="Post-Treatment Days" hint="Days in post-treatment stage">
              <input
                type="number"
                value={postTreatmentDays}
                onChange={e => setPostTreatmentDays(e.target.value)}
                className={inputCls()}
                placeholder="30"
                min="1"
              />
            </Field>
            <Field label="Dormant Days" hint="Days before patient is dormant">
              <input
                type="number"
                value={dormantDays}
                onChange={e => setDormantDays(e.target.value)}
                className={inputCls()}
                placeholder="90"
                min="1"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Language">
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className={inputCls()}
              >
                <option value="">Default</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="fr">French</option>
              </select>
            </Field>
            <Field label="Communication Tone">
              <select
                value={tone}
                onChange={e => setTone(e.target.value)}
                className={inputCls()}
              >
                <option value="">Default</option>
                <option value="formal">Formal</option>
                <option value="friendly">Friendly</option>
                <option value="clinical">Clinical</option>
              </select>
            </Field>
          </div>

          <Field label="Clinic Description" hint="Used for AI-generated messages">
            <textarea
              value={clinicDescription}
              onChange={e => setClinicDescription(e.target.value)}
              rows={3}
              className={inputCls() + " resize-none"}
              placeholder="A brief description of the clinic's specialty and patient care approach…"
            />
          </Field>

          <div className="flex justify-end pt-2">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
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
          <p className="text-sm text-muted-foreground">
            Control which features are available to this hospital's staff.
          </p>

          {[
            {
              key: "appointments",
              label: "Appointments",
              desc: "Calendar scheduling and appointment management",
              value: apptEnabled,
              set: setApptEnabled,
            },
            {
              key: "feedback",
              label: "Patient Feedback",
              desc: "Post-visit feedback collection and analytics",
              value: feedbackEnabled,
              set: setFeedbackEnabled,
            },
          ].map(mod => (
            <div
              key={mod.key}
              className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted border border-border"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
              </div>
              <Toggle checked={mod.value} onChange={mod.set} />
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              onClick={saveModules}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Modules"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
