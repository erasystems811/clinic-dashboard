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

  const inputCls = "w-full pl-10 pr-10 py-3 rounded-md bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition font-medium";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
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
    } finally {
      setLoading(false);
    }
  };

  const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={show ? "Hide" : "Show"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(43 96% 54% / 0.06), transparent)" }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-2xl"
            style={{ boxShadow: "0 0 40px hsl(43 96% 54% / 0.4), 0 8px 32px rgba(0,0,0,0.4)" }}>
            <span className="text-primary-foreground font-black text-2xl tracking-tighter">E</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Era Systems</h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium uppercase tracking-widest">Super Admin Control Center</p>
          </div>
        </div>

        {/* ── LOGIN SCREEN ── */}
        {screen === "login" && (
          <form onSubmit={submit} className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4"
              style={{ boxShadow: "0 0 0 1px hsl(220 14% 11%), 0 24px 48px rgba(0,0,0,0.4)" }}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className={inputCls}
                    placeholder=""
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={inputCls}
                    placeholder="••••••••"
                  />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition tracking-wide"
              style={{ boxShadow: "0 4px 20px hsl(43 96% 54% / 0.3)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => { setScreen("recover"); setError(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition py-1.5 font-medium"
            >
              Forgot password? Use recovery key
            </button>
          </form>
        )}

        {/* ── RECOVERY SCREEN ── */}
        {screen === "recover" && (
          <div className="space-y-3">
            {recoveryDone ? (
              <div className="rounded-xl bg-card border border-border p-8 flex flex-col items-center gap-4 text-center"
                style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Password reset</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Your new password is active. Sign in with it.</p>
                </div>
                <button
                  onClick={() => { setScreen("login"); setRecoveryDone(false); setRecoveryKey(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
                  className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={recover} className="space-y-3">
                <div className="rounded-xl bg-card border border-border p-6 space-y-4"
                  style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      <p className="text-sm font-bold text-foreground">Account Recovery</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Enter your recovery key and choose a new password.</p>
                  </div>

                  {[
                    { label: "Recovery Key", value: recoveryKey, set: setRecoveryKey, show: showRecoveryKey, toggle: () => setShowRecoveryKey(v => !v), placeholder: "Your secret recovery key", icon: KeyRound },
                    { label: "New Password", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(v => !v), placeholder: "Min. 8 characters", icon: Lock },
                    { label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v), placeholder: "Repeat new password", icon: Lock },
                  ].map(({ label, value, set, show, toggle, placeholder, icon: Icon }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <input
                          type={show ? "text" : "password"}
                          value={value}
                          onChange={e => set(e.target.value)}
                          required
                          className={inputCls}
                          placeholder={placeholder}
                        />
                        <EyeToggle show={show} onToggle={toggle} />
                      </div>
                    </div>
                  ))}

                  {error && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => { setScreen("login"); setError(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition py-1.5 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium">Era Systems · Internal Access Only</p>
      </div>
    </div>
  );
}
