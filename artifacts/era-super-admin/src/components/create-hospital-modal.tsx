import { useState, useEffect, FormEvent } from "react";
import { api, Hospital } from "@/lib/api";
import { X, Building2, AlertCircle, Loader2, Copy, Check, Link, KeyRound, Users, RefreshCw } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const SUB_STATUSES = ["active", "trial", "inactive"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
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
      <CopyButton text={value} />
    </div>
  );
}

export default function CreateHospitalModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [subStatus, setSubStatus] = useState("trial");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Hospital | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [eraPatientUrl, setEraPatientUrl] = useState(
    (import.meta.env.VITE_ERA_PATIENT_URL ?? "https://app.erasystem.com.ng").replace(/\/$/, "")
  );

  useEffect(() => {
    api.getConfig().then(cfg => setEraPatientUrl(cfg.eraPatientUrl)).catch(() => {});
  }, []);

  const slugify = (s: string) =>
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleNameChange = (v: string) => {
    setName(v);
    if (!username || username === slugify(name)) {
      setUsername(slugify(v));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const hospital = await api.createHospital({ name, username, subscriptionStatus: subStatus });
      setCreated(hospital);
    } catch (err: any) {
      setError(err.message ?? "Failed to create hospital");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!created) return;
    const loginUrl = `${eraPatientUrl}/?h=${created.username}`;
    const staffCreds = created.staffCredentials;
    const msg = [
      `🏥 Era Patient — Login Details for ${created.name}`,
      ``,
      `🔗 Your Login Link:`,
      `${loginUrl}`,
      ``,
      `🔐 Admin Password: ${created.currentPassword ?? "(check dashboard)"}`,
      ``,
      `👩‍⚕️ Nurse`,
      `Username: ${staffCreds?.nurseUsername ?? ""}`,
      `Password: ${staffCreds?.nursePlainPassword ?? "nurse1234"}`,
      ``,
      `🗂️ Receptionist`,
      `Username: ${staffCreds?.receptionistUsername ?? ""}`,
      `Password: ${staffCreds?.receptionistPlainPassword ?? "recep1234"}`,
      ``,
      `ℹ️ Staff log in at: ${eraPatientUrl} (use the Staff Login tab)`,
      `ℹ️ Please change passwords after first login.`,
    ].join("\n");
    navigator.clipboard.writeText(msg).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    });
  };

  const handleDone = () => {
    onCreated();
  };

  if (created) {
    const loginUrl = `${eraPatientUrl}/?h=${created.username}`;
    const staffCreds = created.staffCredentials;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{created.name}</h2>
                <p className="text-xs text-muted-foreground">Account created — share these credentials</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Login URL */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Link className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Admin Login Link</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-foreground break-all">{loginUrl}</p>
                <CopyButton text={loginUrl} />
              </div>
            </div>

            {/* Admin password */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Admin Credentials</span>
              </div>
              <CredRow label="Username" value={created.username} />
              <CredRow label="Password" value={created.currentPassword ?? "(see dashboard)"} />
            </div>

            {/* Staff credentials */}
            {staffCreds && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Staff Credentials</span>
                </div>
                <CredRow label="Nurse Username" value={staffCreds.nurseUsername} />
                <CredRow label="Nurse Password" value={staffCreds.nursePlainPassword} />
                <CredRow label="Receptionist Username" value={staffCreds.receptionistUsername} />
                <CredRow label="Receptionist Password" value={staffCreds.receptionistPlainPassword} />
                <p className="text-xs text-muted-foreground mt-2">Staff log in at {eraPatientUrl} using the Staff Login tab</p>
              </div>
            )}

            <button
              type="button"
              onClick={copyAll}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border bg-muted/50 text-sm font-medium text-foreground hover:bg-muted transition"
            >
              {allCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {allCopied ? "Copied!" : "Copy All as Message"}
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground">New Hospital Account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hospital Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              placeholder="City General Hospital"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Login Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(slugify(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono transition"
              placeholder="city-general"
            />
            <p className="text-xs text-muted-foreground">
              Used in the hospital's unique login link
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subscription Status
            </label>
            <select
              value={subStatus}
              onChange={e => setSubStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            >
              {SUB_STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">A strong password will be auto-generated and shown after creation.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating…" : "Create Hospital"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
