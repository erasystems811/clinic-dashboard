import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/auth";
import { Lock, User, AlertCircle, KeyRound, ArrowLeft, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { post } from "@/lib/api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

  const inputCls = "w-full px-3 py-2.5 rounded bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition font-medium";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await login(username, password); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Login failed"); }
    finally { setLoading(false); }
  };

  const recover = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await post("/super-admin/auth/recover", { recoveryKey, newPassword });
      setRecoveryDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally { setLoading(false); }
  };

  const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition">
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-7">

        {/* ERA Logo — black bg blends perfectly */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24">
            <img
              src={`${BASE}/era-logo.png`}
              alt="ERA Systems"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-white tracking-wide">ERA SYSTEMS</h1>
            <p className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">
              <span>Evaluate</span>
              <span className="text-primary mx-1.5">·</span>
              <span>Rebuild</span>
              <span className="text-primary mx-1.5">·</span>
              <span>Automate</span>
            </p>
          </div>
        </div>

        {/* Login card */}
        {screen === "login" && (
          <form onSubmit={submit} className="space-y-2.5">
            <div className="bg-card border border-border rounded p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    autoComplete="username" className={inputCls + " pl-9"} placeholder="" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    autoComplete="current-password" className={inputCls + " pl-9 pr-9"} placeholder="••••••••" />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded px-3 py-2.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-50 transition uppercase tracking-widest">
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <button type="button" onClick={() => { setScreen("recover"); setError(""); }}
              className="w-full text-center text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition py-1 tracking-wide">
              Forgot password? Use recovery key
            </button>
          </form>
        )}

        {/* Recovery */}
        {screen === "recover" && (
          <div className="space-y-2.5">
            {recoveryDone ? (
              <div className="bg-card border border-border rounded p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-10 h-10 rounded border border-emerald-500/20 bg-emerald-500/8 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Password reset</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Your new password is active.</p>
                </div>
                <button onClick={() => { setScreen("login"); setRecoveryDone(false); setRecoveryKey(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
                  className="px-5 py-2 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition uppercase tracking-widest">
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={recover} className="space-y-2.5">
                <div className="bg-card border border-border rounded p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-1">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-bold text-foreground">Account Recovery</p>
                  </div>
                  {[
                    { label: "Recovery Key", value: recoveryKey, set: setRecoveryKey, show: showRecoveryKey, toggle: () => setShowRecoveryKey(v => !v), placeholder: "Secret recovery key", icon: KeyRound },
                    { label: "New Password", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(v => !v), placeholder: "Min. 8 characters", icon: Lock },
                    { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v), placeholder: "Repeat new password", icon: Lock },
                  ].map(({ label, value, set, show, toggle, placeholder, icon: Icon }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                        <input type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)} required
                          className={inputCls + " pl-9 pr-9"} placeholder={placeholder} />
                        <EyeToggle show={show} onToggle={toggle} />
                      </div>
                    </div>
                  ))}
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded px-3 py-2.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                    </div>
                  )}
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-50 transition uppercase tracking-widest">
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
                <button type="button" onClick={() => { setScreen("login"); setError(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition py-1">
                  <ArrowLeft className="w-3 h-3" /> Back to Sign In
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-[9px] text-muted-foreground/25 uppercase tracking-[0.2em] font-mono">
          ERA SYSTEMS · INTERNAL ACCESS ONLY
        </p>
      </div>
    </div>
  );
}
