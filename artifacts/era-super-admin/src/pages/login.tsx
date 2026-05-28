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

  const inputCls =
    "w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#1a1a1a] border border-white/8 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition";

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
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition">
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div className="w-full max-w-sm space-y-6">

        {/* ── Logo + Title ─────────────────────────────── */}
        <div className="flex flex-col items-center gap-4 pb-2">
          {/* Gold icon with glow */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle, hsl(43 90% 56% / 0.30) 0%, transparent 65%)",
                transform: "scale(2.2)",
                pointerEvents: "none",
              }}
            />
            {/* Replace the div below with an <img> tag when your logo is ready */}
            <div
              className="relative z-10 w-[72px] h-[72px] rounded-[18px] bg-primary flex items-center justify-center"
              style={{ boxShadow: "0 8px 32px hsl(43 90% 56% / 0.45), 0 2px 8px hsl(43 90% 56% / 0.25)" }}
            >
              <span className="text-3xl font-extrabold text-[#1a1000] tracking-tight select-none">E</span>
            </div>
          </div>

          {/* App name */}
          <div className="text-center space-y-1.5">
            <h1 className="text-[26px] font-bold text-white leading-tight tracking-tight">
              Era Systems
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.20em] font-medium">
              Super Admin Control Center
            </p>
          </div>
        </div>

        {/* ── Login screen ─────────────────────────────── */}
        {screen === "login" && (
          <form onSubmit={submit} className="space-y-4">
            {/* Card */}
            <div
              className="rounded-2xl border border-white/8 p-5 space-y-4"
              style={{ backgroundColor: "#181818" }}
            >
              {/* Username */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
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

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={inputCls + " pr-10"}
                    placeholder="••••••••"
                  />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Sign In button — outside card */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 transition"
              style={{ boxShadow: loading ? "none" : "0 4px 24px hsl(43 90% 56% / 0.40)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>

            {/* Forgot password */}
            <button
              type="button"
              onClick={() => { setScreen("recover"); setError(""); }}
              className="w-full text-center text-sm text-muted-foreground/50 hover:text-muted-foreground/80 transition py-1"
            >
              Forgot password? Use recovery key
            </button>
          </form>
        )}

        {/* ── Recovery screen ───────────────────────────── */}
        {screen === "recover" && (
          <div className="space-y-4">
            {recoveryDone ? (
              <div
                className="rounded-2xl border border-white/8 p-8 flex flex-col items-center gap-4 text-center"
                style={{ backgroundColor: "#181818" }}
              >
                <div className="w-10 h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Password reset</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Your new password is active.</p>
                </div>
                <button
                  onClick={() => { setScreen("login"); setRecoveryDone(false); setRecoveryKey(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition"
                  style={{ boxShadow: "0 4px 20px hsl(43 90% 56% / 0.30)" }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={recover} className="space-y-4">
                <div
                  className="rounded-2xl border border-white/8 p-5 space-y-4"
                  style={{ backgroundColor: "#181818" }}
                >
                  <div className="flex items-center gap-2 pb-1">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <p className="text-sm font-bold text-foreground">Account Recovery</p>
                  </div>
                  {[
                    { label: "Recovery Key", value: recoveryKey, set: setRecoveryKey, show: showRecoveryKey, toggle: () => setShowRecoveryKey(v => !v), placeholder: "Secret recovery key", icon: KeyRound },
                    { label: "New Password", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(v => !v), placeholder: "Min. 8 characters", icon: Lock },
                    { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v), placeholder: "Repeat new password", icon: Lock },
                  ].map(({ label, value, set, show, toggle, placeholder, icon: Icon }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{label}</label>
                      <div className="relative">
                        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                          type={show ? "text" : "password"}
                          value={value}
                          onChange={e => set(e.target.value)}
                          required
                          className={inputCls + " pr-10"}
                          placeholder={placeholder}
                        />
                        <EyeToggle show={show} onToggle={toggle} />
                      </div>
                    </div>
                  ))}
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 transition"
                  style={{ boxShadow: loading ? "none" : "0 4px 24px hsl(43 90% 56% / 0.40)" }}
                >
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
                <button
                  type="button"
                  onClick={() => { setScreen("login"); setError(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground/80 transition py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/25 uppercase tracking-[0.22em]">
          ERA Systems · Internal Access Only
        </p>
      </div>
    </div>
  );
}
