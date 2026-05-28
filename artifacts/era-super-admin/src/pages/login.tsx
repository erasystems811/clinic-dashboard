import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/auth";
import { Lock, User, AlertCircle, KeyRound, ArrowLeft, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { post } from "@/lib/api";

type Screen = "login" | "recover";

export default function LoginPage() {
  const { login } = useAuth();
  const [screen, setScreen] = useState<Screen>("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const inputCls = "w-full pl-10 pr-10 py-2.5 bg-[hsl(220_6%_20%)] border border-[hsl(220_6%_26%)] text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all duration-150 font-medium tracking-wide";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await login(username, password); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Authentication failed"); }
    finally { setLoading(false); }
  };

  const recover = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Minimum 8 characters required"); return; }
    setLoading(true);
    try {
      await post("/super-admin/auth/recover", { recoveryKey, newPassword });
      setRecoveryDone(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Recovery failed"); }
    finally { setLoading(false); }
  };

  const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition">
      {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "hsl(222 28% 3%)" }}>

      {/* Primary spotlight — visible blue burst from top */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 55% at 50% -5%, hsl(214 85% 62% / 0.18) 0%, hsl(220 70% 40% / 0.08) 45%, transparent 70%)" }} />

      {/* Secondary warm accent — bottom center */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 35% at 50% 110%, hsl(43 70% 62% / 0.07) 0%, transparent 65%)" }} />

      {/* Top horizontal border beam */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 0%, hsl(214 85% 62% / 0.5) 30%, hsl(43 70% 62% / 0.4) 50%, hsl(214 85% 62% / 0.5) 70%, transparent 100%)" }} />

      {/* Bottom horizontal border beam */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 10%, hsl(214 85% 62% / 0.2) 50%, transparent 90%)" }} />

      {/* Left edge glow */}
      <div className="pointer-events-none absolute top-0 left-0 bottom-0 w-px"
        style={{ background: "linear-gradient(180deg, transparent, hsl(214 85% 62% / 0.25) 40%, hsl(43 70% 62% / 0.15) 60%, transparent)" }} />
      {/* Right edge glow */}
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-px"
        style={{ background: "linear-gradient(180deg, transparent, hsl(214 85% 62% / 0.25) 40%, hsl(43 70% 62% / 0.15) 60%, transparent)" }} />

      {/* Large background crosshair */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.025]">
        <div className="absolute w-[600px] h-px" style={{ background: "hsl(214 85% 80%)" }} />
        <div className="absolute w-px h-[600px]" style={{ background: "hsl(214 85% 80%)" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full border" style={{ borderColor: "hsl(214 85% 80%)" }} />
        <div className="absolute w-[200px] h-[200px] rounded-full border" style={{ borderColor: "hsl(43 70% 62%)" }} />
      </div>

      {/* Scan line texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, hsl(214 85% 80%), hsl(214 85% 80%) 1px, transparent 1px, transparent 4px)" }} />

      <div className="w-full max-w-xs relative z-10">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-2">
            <img src={`${import.meta.env.BASE_URL}era-logo.png`} alt="Era Systems" className="w-24 h-24 object-contain" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs font-bold text-foreground tracking-[0.25em] uppercase">Era Systems</p>
            <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-muted-foreground/60">Operational Intelligence Layer</p>
          </div>
        </div>

        {/* ── LOGIN ── */}
        {screen === "login" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="border border-[hsl(220_6%_24%)] bg-card space-y-3 p-4"
              style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px hsl(220 18% 28% / 0.6)" }}>

              <div className="border-b border-[hsl(220_6%_24%)] pb-3 mb-1">
                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.25em]">System Authentication</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Identifier</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    required autoComplete="username" className={inputCls} placeholder="" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Passkey</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                    className={inputCls} placeholder="••••••••" />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[11px] text-destructive bg-destructive/8 border border-destructive/15 px-3 py-2">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              style={{ boxShadow: "0 4px 20px hsl(214 72% 56% / 0.2)" }}>
              {loading ? "Authenticating…" : "Authenticate"}
            </button>

            <button type="button" onClick={() => { setScreen("recover"); setError(""); }}
              className="w-full text-center text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition py-1 tracking-wider">
              Use recovery key
            </button>
          </form>
        )}

        {/* ── RECOVERY ── */}
        {screen === "recover" && (
          <div className="space-y-4">
            {recoveryDone ? (
              <div className="border border-[hsl(220_6%_24%)] bg-card p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-10 h-10 border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground tracking-tight">Passkey Reset</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">New passkey is active. Authenticate with it now.</p>
                </div>
                <button onClick={() => { setScreen("login"); setRecoveryDone(false); setRecoveryKey(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
                  className="px-4 py-2 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 transition">
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={recover} className="space-y-4">
                <div className="border border-[hsl(220_6%_24%)] bg-card space-y-3 p-4"
                  style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>

                  <div className="border-b border-[hsl(220_6%_24%)] pb-3">
                    <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.25em]">Account Recovery</p>
                  </div>

                  {[
                    { label: "Recovery Token", value: recoveryKey, set: setRecoveryKey, show: showRecoveryKey, toggle: () => setShowRecoveryKey(v => !v), ph: "Your recovery key", Icon: KeyRound },
                    { label: "New Passkey", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(v => !v), ph: "Min. 8 characters", Icon: Lock },
                    { label: "Confirm Passkey", value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v), ph: "Repeat passkey", Icon: Lock },
                  ].map(({ label, value, set, show, toggle, ph, Icon }) => (
                    <div key={label} className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                        <input type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)}
                          required className={inputCls} placeholder={ph} />
                        <EyeToggle show={show} onToggle={toggle} />
                      </div>
                    </div>
                  ))}

                  {error && (
                    <div className="flex items-center gap-2 text-[11px] text-destructive bg-destructive/8 border border-destructive/15 px-3 py-2">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 disabled:opacity-50 transition">
                  {loading ? "Processing…" : "Reset Passkey"}
                </button>
                <button type="button" onClick={() => { setScreen("login"); setError(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition py-1 tracking-wider">
                  <ArrowLeft className="w-3 h-3" />
                  Return to Login
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer tagline */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.3em]">
            Evaluate · Rebuild · Automate
          </p>
          <p className="text-[9px] text-muted-foreground/20 uppercase tracking-[0.2em]">Era Systems · Restricted Access</p>
        </div>
      </div>
    </div>
  );
}
