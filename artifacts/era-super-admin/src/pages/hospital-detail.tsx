import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { api, Hospital, HospitalSettings, HospitalModules, AutomationLog } from "@/lib/api";
import {
  Building2, Save, Loader2, AlertCircle, ChevronLeft,
  Settings, Puzzle, Shield, ToggleLeft, ToggleRight, RefreshCw,
  Eye, EyeOff, KeyRound, Plus, X, Zap, CheckCircle2, XCircle,
  Clock, RotateCcw, Mail, MessageSquare, Filter, Copy, Check, Link, Users, Phone, Wallet,
} from "lucide-react";


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

type Tab = "general" | "settings" | "modules" | "automations" | "wallet";

const PREDEFINED_DEPARTMENTS = [
  "General Outpatient",
  "Antenatal / Maternity",
  "Paediatrics",
  "Surgery / Post-Op",
  "Dental",
  "Eye",
  "Fertility / IVF",
  "ENT (Ear, Nose and Throat)",
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
  const [autoFilter, setAutoFilter] = useState<"all" | "failed" | "sent">("all");
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  // General form
  const [name, setName] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [active, setActive] = useState(true);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [eraPatientUrl, setEraPatientUrl] = useState(
    (import.meta.env.VITE_ERA_PATIENT_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "")
  );

  // Settings form
  const [departments, setDepartments] = useState<string[]>([]);
  const [customDeptInput, setCustomDeptInput] = useState("");
  const [postTreatmentDays, setPostTreatmentDays] = useState("");
  const [dormantDays, setDormantDays] = useState("");
  const [language, setLanguage] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [clinicDescription, setClinicDescription] = useState("");
  const [senderName, setSenderName] = useState("");
  const [hospitalPhoneNumber, setHospitalPhoneNumber] = useState("");
  const [notificationChannel, setNotificationChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [termiiSenderId, setTermiiSenderId] = useState("");
  const [senderIdApproved, setSenderIdApproved] = useState(false);
  const [callTaskAiDailyLimit, setCallTaskAiDailyLimit] = useState("");
  const [callTaskAiUsedToday, setCallTaskAiUsedToday] = useState(0);

  // Test SMS
  const [testSmsTo, setTestSmsTo] = useState("");
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // CRM — super admin's own records for this account
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Modules form
  const [apptEnabled, setApptEnabled] = useState(true);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [wellnessEnabled, setWellnessEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, s, m, cfg] = await Promise.all([
        api.getHospital(id),
        api.getSettings(id),
        api.getModules(id),
        api.getConfig().catch(() => null),
      ]);
      if (cfg) setEraPatientUrl(cfg.eraPatientUrl);
      setHospital(h);
      setSettings(s);
      setModules(m);
      setName(h.name);
      setSubStatus(h.subscriptionStatus);
      setActive(h.active);
      setSubscriptionExpiresAt(h.subscriptionExpiresAt ? h.subscriptionExpiresAt.substring(0, 10) : "");
      const loadedDepts = s.departments ?? [];
      // If no departments have ever been saved, default to all predefined (first-time setup).
      // Otherwise use exactly what was saved — respecting unchecked predefined departments.
      const merged = loadedDepts.length > 0 ? loadedDepts : [...PREDEFINED_DEPARTMENTS];
      setDepartments(merged);
      setPostTreatmentDays(s.pipelinePostTreatmentDays?.toString() ?? "");
      setDormantDays(s.pipelineDormantDays?.toString() ?? "");
      setLanguage(s.language ?? "");
      setTones(Array.isArray(s.tone) ? s.tone : []);
      setClinicDescription(s.clinicDescription ?? "");
      setSenderName(s.senderName ?? "");
      setHospitalPhoneNumber(s.phoneNumber ?? "");
      setNotificationChannel((s.notificationChannel as "whatsapp" | "sms") ?? "whatsapp");
      setTermiiSenderId(s.termiiSenderId ?? "");
      setSenderIdApproved(s.senderIdApproved ?? false);
      setCallTaskAiDailyLimit(s.callTaskAiDailyLimit?.toString() ?? "");
      setCallTaskAiUsedToday(s.callTaskAiUsedToday ?? 0);
      setContactEmail(h.contactEmail ?? "");
      setContactPhone(h.contactPhone ?? "");
      setApptEnabled(m.appointmentsEnabled);
      setFeedbackEnabled(m.feedbackEnabled);
      setWellnessEnabled(m.wellnessNewsletterEnabled ?? true);
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

  const friendlyError = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : "";
    if (!msg) return "Something went wrong. Please try again.";
    if (msg.includes("column") && msg.includes("schema")) return "A settings field is not yet ready on the server. Please try again in a moment.";
    if (msg.includes("not found") || msg.includes("Not found")) return "This record could not be found. It may have been removed.";
    if (msg.includes("duplicate") || msg.includes("unique")) return "This value is already in use. Please choose a different one.";
    if (msg.includes("foreign key") || msg.includes("violates")) return "This change could not be saved because it conflicts with existing data.";
    if (msg.includes("JWT") || msg.includes("token") || msg.includes("auth")) return "Your session has expired. Please log in again.";
    if (msg.includes("network") || msg.includes("fetch")) return "Could not reach the server. Check your connection and try again.";
    if (msg.includes("timeout")) return "The request took too long. Please try again.";
    return "Could not save changes. Please try again.";
  };

  const saveGeneral = async () => {
    setSaving(true);
    setError("");
    try {
      await api.updateHospital(id, {
        name,
        subscriptionStatus: subStatus,
        active,
        subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toISOString() : null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      });
      flash("Hospital updated");
      load();
    } catch (e: unknown) {
      setError(friendlyError(e));
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
        callTaskAiDailyLimit: callTaskAiDailyLimit ? parseInt(callTaskAiDailyLimit) : null,
        language: language || null,
        tone: tones.length > 0 ? tones : null,
        clinicDescription: clinicDescription || null,
        senderName: senderName || null,
        phoneNumber: hospitalPhoneNumber || null,
        notificationChannel,
        termiiSenderId: termiiSenderId || null,
        senderIdApproved,
      } as Partial<HospitalSettings>);
      flash("Settings saved");
      load();
    } catch (e: unknown) {
      setError(friendlyError(e));
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
      });
      flash("Modules saved");
      load();
    } catch (e: unknown) {
      setError(friendlyError(e));
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
    const loginUrl = `${eraPatientUrl}/?h=${hospital.username}`;
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
      `ℹ️ Staff log in at: ${eraPatientUrl} (Staff Login tab)`,
    ].join("\n");
    navigator.clipboard.writeText(msg).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    });
  };

  const retryAutomation = async (logId: number) => {
    setRetryingId(logId);
    setRetryError(null);
    try {
      await api.retryAutomation(logId);
      await loadAutomations();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
        ?? (err as { message?: string })?.message
        ?? "Retry failed — please try again.";
      setRetryError(msg);
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
    { key: "wallet", label: "Wallet", icon: Wallet },
  ];

  // ── Wallet state ──────────────────────────────────────────────────────────
  const [walletInfo, setWalletInfo] = useState<{ balanceKobo: number; balanceNaira: number; transactions: { id: number; type: string; amount_kobo: number; description: string; flutterwave_ref: string | null; created_at: string }[] } | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [creditError, setCreditError] = useState("");
  const [creditSuccess, setCreditSuccess] = useState("");

  const loadWallet = async () => {
    setWalletLoading(true);
    try { setWalletInfo(await api.getHospitalWallet(id)); } catch { /* ignore */ } finally { setWalletLoading(false); }
  };

  useEffect(() => { if (tab === "wallet") loadWallet(); }, [tab]);

  const handleCredit = async () => {
    setCreditError(""); setCreditSuccess("");
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) { setCreditError("Enter a valid amount"); return; }
    setCrediting(true);
    try {
      const res = await api.creditHospitalWallet(id, amount, creditDesc || "Manual credit by admin");
      setCreditSuccess(`Credited ₦${amount.toLocaleString()} — new balance: ₦${res.balanceNaira.toLocaleString()}`);
      setCreditAmount(""); setCreditDesc("");
      await loadWallet();
    } catch (e: unknown) { setCreditError(e instanceof Error ? e.message : "Failed"); }
    finally { setCrediting(false); }
  };

  if (loading) {
    return (
      <Layout breadcrumb={[{ label: "Hospitals", href: "/hospitals" }, { label: "…" }]}>
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </Layout>
    );
  }

  if (!hospital) {
    return (
      <Layout breadcrumb={[{ label: "Hospitals", href: "/hospitals" }]}>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <AlertCircle className="w-6 h-6" />
          <span className="text-sm">{error || "Hospital not found"}</span>
          <button onClick={() => setLocation("/hospitals")} className="text-xs text-primary hover:underline">Back to hospitals</button>
        </div>
      </Layout>
    );
  }

  const automationTypeName = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Layout breadcrumb={[{ label: "Hospitals", href: "/hospitals" }, { label: hospital.name }]}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/hospitals")} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition">
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

          {/* ── Links ── */}
          <div className="rounded-xl bg-card border border-border divide-y divide-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2"><Link className="w-4 h-4 text-muted-foreground" /> Links</h2>
              <button type="button" onClick={copyAllCredentials}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition">
                {allCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {allCopied ? "Copied!" : "Copy All"}
              </button>
            </div>
            {/* Admin login link */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Admin Login</p>
                <p className="text-xs font-mono text-foreground truncate">{eraPatientUrl}/?h={hospital.username}</p>
              </div>
              <CopyBtn text={`${eraPatientUrl}/?h=${hospital.username}`} />
            </div>
            {/* Patient self-booking link */}
            {hospital.slug && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Patient Self-Booking</p>
                  <p className="text-xs font-mono text-foreground truncate">{eraPatientUrl}/book/{hospital.slug}</p>
                </div>
                <CopyBtn text={`${eraPatientUrl}/book/${hospital.slug}`} />
              </div>
            )}
            {/* Feedback link */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Patient Feedback</p>
                {hospital.feedbackSlug
                  ? <p className="text-xs font-mono text-foreground truncate">{eraPatientUrl}/feedback/h/{hospital.feedbackSlug}</p>
                  : <p className="text-xs text-muted-foreground italic">Generated on first login</p>}
              </div>
              {hospital.feedbackSlug && <CopyBtn text={`${eraPatientUrl}/feedback/h/${hospital.feedbackSlug}`} />}
            </div>
          </div>

          {/* ── Admin credentials ── */}
          <div className="rounded-xl bg-card border border-border divide-y divide-border overflow-hidden">
            <div className="px-4 py-3">
              <h2 className="font-semibold text-sm text-foreground flex items-center gap-2"><KeyRound className="w-4 h-4 text-muted-foreground" /> Admin Credentials</h2>
            </div>
            <CredRow label="Username" value={hospital.username} />
            <div className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="text-sm font-mono text-foreground">
                  {hospital.currentPassword
                    ? (showAdminPass ? hospital.currentPassword : "•".repeat(Math.min(hospital.currentPassword.length, 12)))
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
            <div className="px-4 py-3">
              <button type="button" onClick={handleRegenerate} disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition">
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {regenerating ? "Regenerating…" : "Regenerate Password"}
              </button>
            </div>
          </div>

          {/* ── Staff credentials ── */}
          {hospital.staffCredentials && (
            <div className="rounded-xl bg-card border border-border divide-y divide-border overflow-hidden">
              <div className="px-4 py-3">
                <h2 className="font-semibold text-sm text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" /> Staff Login (shared)</h2>
              </div>
              <CredRow label="Nurse Username" value={hospital.staffCredentials.nurseUsername} />
              <CredRow label="Nurse Password" value={hospital.staffCredentials.nursePlainPassword} />
              <CredRow label="Receptionist Username" value={hospital.staffCredentials.receptionistUsername} />
              <CredRow label="Receptionist Password" value={hospital.staffCredentials.receptionistPlainPassword} />
            </div>
          )}

          {/* ── Account details ── */}
          <div className="rounded-xl bg-card border border-border p-5 space-y-4">
            <h2 className="font-semibold text-sm text-foreground">Account Details</h2>

            <Field label="Hospital Name">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls()} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Subscription">
                <select value={subStatus} onChange={e => { const v = e.target.value; setSubStatus(v); setActive(v !== "inactive"); }} className={inputCls()}>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="inactive">Suspended</option>
                </select>
              </Field>
              <Field label="Expiry Date">
                <input type="date" value={subscriptionExpiresAt} onChange={e => setSubscriptionExpiresAt(e.target.value)} className={inputCls()} />
              </Field>
            </div>
            {subscriptionExpiresAt && (() => {
              const days = Math.ceil((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (days < 0) return <p className="text-xs text-red-400">⚠️ Expired {Math.abs(days)} day{Math.abs(days) !== 1 ? "s" : ""} ago</p>;
              if (days <= 30) return <p className="text-xs text-amber-400">⚠️ Expires in {days} day{days !== 1 ? "s" : ""}</p>;
              return <p className="text-xs text-emerald-400">Active for {days} more day{days !== 1 ? "s" : ""}</p>;
            })()}

            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted border border-border">
              <div>
                <p className="text-sm font-medium">Account Active</p>
                <p className="text-xs text-muted-foreground">Suspended accounts cannot log in</p>
              </div>
              <Toggle checked={active} onChange={val => { setActive(val); if (!val) setSubStatus("inactive"); else if (subStatus === "inactive") setSubStatus("active"); }} />
            </div>

            <div className="pt-2 border-t border-border grid grid-cols-2 gap-3">
              <Field label="Your Contact Email" hint="Private — not visible to hospital">
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="admin@client.com" className={inputCls()} />
              </Field>
              <Field label="Your Contact Phone" hint="Private — not visible to hospital">
                <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+23480…" className={inputCls()} />
              </Field>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={saveGeneral} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save"}
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
              <p className="text-xs text-muted-foreground">Select which departments are active for this hospital. These appear in the nurse station when logging care plans.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {[...new Set([...PREDEFINED_DEPARTMENTS, ...departments.filter(d => !PREDEFINED_DEPARTMENTS.includes(d))])].map(dept => (
                  <label key={dept} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" checked={departments.includes(dept)} onChange={() => toggleDepartment(dept)} className="w-4 h-4 rounded accent-primary shrink-0" />
                    <span className={`text-sm transition-colors ${departments.includes(dept) ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}`}>{dept}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={customDeptInput} onChange={e => setCustomDeptInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomDept(); } }}
                placeholder="Add department…" className={inputCls() + " flex-1"}
              />
              <button type="button" onClick={addCustomDept} disabled={!customDeptInput.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-40 transition">
                <Plus className="w-4 h-4" />Add Department
              </button>
            </div>
          </div>

          {/* Pipeline */}
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Post-Treatment Days" hint="Days before moving to Post Care">
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={postTreatmentDays} onChange={e => setPostTreatmentDays(e.target.value.replace(/\D/g, ""))} className={inputCls()} placeholder="14" />
            </Field>
            <Field label="Dormant Days" hint="Days before patient becomes dormant">
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={dormantDays} onChange={e => setDormantDays(e.target.value.replace(/\D/g, ""))} className={inputCls()} placeholder="90" />
            </Field>
          </div>

          {/* Call Task AI Limit */}
          <div className="pt-2 border-t border-border">
            <Field label="Call Task AI Generation Limit (per day)" hint="Max AI drafts a receptionist can generate per day. Default is 20 if left blank.">
              <div className="flex items-center gap-3">
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={callTaskAiDailyLimit} onChange={e => setCallTaskAiDailyLimit(e.target.value.replace(/\D/g, ""))} className={inputCls()} placeholder="20" />
                <span className={`text-xs font-medium shrink-0 px-2.5 py-1.5 rounded-lg border ${callTaskAiUsedToday >= (callTaskAiDailyLimit ? parseInt(callTaskAiDailyLimit) : 20) ? "border-destructive/40 text-destructive bg-destructive/5" : "border-border text-muted-foreground bg-muted"}`}>
                  {callTaskAiUsedToday} / {callTaskAiDailyLimit || 20} today
                </span>
              </div>
            </Field>
          </div>

          {/* Email */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Email Sending</p>
              <p className="text-xs text-muted-foreground">
                All emails send from Era's verified noreply address. The hospital sets the display name that patients see (e.g. "GISDHEALTH" or "City Clinic").
              </p>
            </div>
            <Field label="Sender Display Name" hint='Patients see this as the "From" name — e.g. "GISDHEALTH", "City Clinic". Leave blank to use the hospital name.'>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
                  placeholder="e.g. GISDHEALTH or City Clinic"
                  className={inputCls() + " pl-9"}
                />
              </div>
            </Field>
            <Field label="Hospital Contact Phone Number" hint="Appears in all automated patient emails — e.g. 'please contact us directly on +2348012345678'. Leave blank to omit the number from messages.">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text" value={hospitalPhoneNumber} onChange={e => setHospitalPhoneNumber(e.target.value)}
                  placeholder="+2348012345678"
                  className={inputCls() + " pl-9"}
                />
              </div>
            </Field>
          </div>

          {/* Notification Channel */}
          <div className="pt-2 border-t border-border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Notification Channel</p>
              <p className="text-xs text-muted-foreground">Channel used to deliver automated patient notifications (queue updates, care plan alerts, etc.).</p>
            </div>
            <Field label="Channel">
              <select value={notificationChannel} onChange={e => setNotificationChannel(e.target.value as "whatsapp" | "sms")} className={inputCls()}>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </Field>
            <Field
              label="Sender ID / Number"
              hint={notificationChannel === "whatsapp"
                ? "WhatsApp always uses a phone number as the sender — you cannot use a name. Each hospital must have their own dedicated WhatsApp number registered with Termii. If two hospitals share one number, a patient who visits both will receive messages from both in the same WhatsApp chat. Enter in international format, e.g. +2348012345678."
                : "What patients see as the sender on their phone. In Nigeria, all sender IDs — numbers and names — must be registered with Termii before carriers will deliver them. Options: (1) Leave blank to use Termii's shared pool number (pre-registered, works immediately, but it's a generic number not specific to this hospital). (2) A dedicated phone number — registered to this hospital only. (3) A short name like CityClinic (max 11 chars) — patients see the hospital name. Options 2 and 3 take a few days to approve."}
            >
              <input
                type="text"
                value={termiiSenderId}
                onChange={e => { setTermiiSenderId(e.target.value); setSenderIdApproved(false); }}
                placeholder={notificationChannel === "whatsapp" ? "+2348012345678 (hospital WhatsApp number)" : "+2348012345678 or HospitalName"}
                className={inputCls()}
              />
            </Field>

            {termiiSenderId.trim() && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium text-foreground">Sender ID Approved by Termii</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {senderIdApproved
                      ? "Active — SMS will be delivered using this sender ID."
                      : "Pending — SMS will fall back to email until Termii approves this ID."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={senderIdApproved}
                  onClick={() => setSenderIdApproved(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${senderIdApproved ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${senderIdApproved ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            )}

          {/* Test SMS */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test SMS Delivery</p>
            <p className="text-xs text-muted-foreground">Send a test message to any phone number to verify Termii is configured correctly.</p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testSmsTo}
                onChange={e => { setTestSmsTo(e.target.value); setTestSmsResult(null); }}
                placeholder="e.g. 2348012345678"
                className={inputCls() + " flex-1"}
              />
              <button
                type="button"
                disabled={testSmsSending || !testSmsTo.trim()}
                onClick={async () => {
                  setTestSmsSending(true);
                  setTestSmsResult(null);
                  try {
                    const r = await api.testSms(testSmsTo.trim(), termiiSenderId.trim() || undefined);
                    setTestSmsResult(r);
                  } catch (e) {
                    setTestSmsResult({ ok: false, detail: e instanceof Error ? e.message : "Unknown error" });
                  } finally {
                    setTestSmsSending(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 whitespace-nowrap hover:bg-primary/90 transition"
              >
                {testSmsSending ? "Sending…" : "Send Test"}
              </button>
            </div>
            {testSmsResult && (
              <p className={`text-xs rounded px-2 py-1.5 font-mono break-all ${testSmsResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {testSmsResult.detail}
              </p>
            )}
          </div>

          {/* Test Email */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test Email Delivery</p>
            <p className="text-xs text-muted-foreground">Send a test email to any address to verify Resend is configured correctly.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailTo}
                onChange={e => { setTestEmailTo(e.target.value); setTestEmailResult(null); }}
                placeholder="e.g. you@example.com"
                className={inputCls() + " flex-1"}
              />
              <button
                type="button"
                disabled={testEmailSending || !testEmailTo.trim()}
                onClick={async () => {
                  setTestEmailSending(true);
                  setTestEmailResult(null);
                  try {
                    const r = await api.testEmail(testEmailTo.trim());
                    setTestEmailResult(r.ok
                      ? { ok: true,  msg: `Sent ✓ — from: ${r.from}` }
                      : { ok: false, msg: r.error ?? "Unknown error" }
                    );
                  } catch (e) {
                    setTestEmailResult({ ok: false, msg: e instanceof Error ? e.message : "Unknown error" });
                  } finally {
                    setTestEmailSending(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 whitespace-nowrap hover:bg-primary/90 transition"
              >
                {testEmailSending ? "Sending…" : "Send Test"}
              </button>
            </div>
            {testEmailResult && (
              <p className={`text-xs rounded px-2 py-1.5 font-mono break-all ${testEmailResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {testEmailResult.msg}
              </p>
            )}
          </div>
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
      {tab === "modules" && !modules && !loading && (
        <div className="rounded-xl bg-card border border-border p-6 text-center text-muted-foreground">
          <p className="text-sm">Module settings could not be loaded. Try refreshing the page.</p>
        </div>
      )}
      {tab === "modules" && modules && (
        <div className="rounded-xl bg-card border border-border p-6 space-y-4 max-w-lg">
          <h2 className="font-semibold text-foreground">Feature Modules</h2>
          <p className="text-sm text-muted-foreground">Control which features are available to this hospital's staff.</p>

          {(
            [
              { key: "appointments", label: "Appointments", desc: "Calendar scheduling and appointment management", value: apptEnabled, set: setApptEnabled },
              { key: "feedback", label: "Queue + Feedback", desc: "Queue management automations and post-visit feedback collection", value: feedbackEnabled, set: setFeedbackEnabled },
              { key: "wellness", label: "Wellness Newsletter + Bulk Email", desc: "Weekly AI wellness newsletters and bulk email campaigns to patients", value: wellnessEnabled, set: setWellnessEnabled },
            ] as { key: string; label: string; desc: string; value: boolean; set: (v: boolean) => void }[]
          ).map(mod => (
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
          {retryError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{retryError}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Automation Log</h2>
              <p className="text-sm text-muted-foreground mt-0.5">All AI messages, emails and WhatsApp automations for this hospital.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {(["all", "failed", "sent"] as const).map(f => (
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
                          {log.status === "queued" ? "in progress" : log.status}
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
          </div>
        </div>
      )}

      {/* ── WALLET TAB ── */}
      {tab === "wallet" && (
        <div className="space-y-4 max-w-lg">
          {/* Balance */}
          <div className="rounded-xl bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4" /> SMS Wallet</h2>
              <button onClick={loadWallet} disabled={walletLoading} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition">
                <RefreshCw className={`w-4 h-4 ${walletLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">Current balance</span>
              <span className={`text-xl font-bold tabular-nums ${!walletInfo ? "text-muted-foreground" : walletInfo.balanceNaira === 0 ? "text-red-400" : walletInfo.balanceNaira < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                {walletLoading ? "…" : walletInfo ? `₦${walletInfo.balanceNaira.toLocaleString()}` : "—"}
              </span>
            </div>

            {/* Manual credit form */}
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual Credit</p>
              <div className="flex gap-2">
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Amount (₦)" value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="text" placeholder="Note (optional)" value={creditDesc}
                  onChange={e => setCreditDesc(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {creditError && <p className="text-xs text-red-400">{creditError}</p>}
              {creditSuccess && <p className="text-xs text-emerald-400">{creditSuccess}</p>}
              <button
                onClick={handleCredit} disabled={crediting || !creditAmount}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {crediting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Credit Wallet
              </button>
            </div>
          </div>

          {/* Transaction history */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Transaction History</h3>
            </div>
            {walletLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !walletInfo || walletInfo.transactions.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No transactions yet</div>
            ) : (
              <div className="divide-y divide-border">
                {walletInfo.transactions.map(tx => (
                  <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.created_at)}{tx.flutterwave_ref ? ` · ref: ${tx.flutterwave_ref}` : ""}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "credit" ? "+" : "−"}₦{(tx.amount_kobo / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
