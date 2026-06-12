import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, Users, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Account } from "@/contexts/auth-context";

type Step =
  | "welcome"
  | "register-type"
  | "register-details"
  | "register-otp"
  | "register-success"
  | "login-phone"
  | "login-select"
  | "login-password"
  | "forgot-request"
  | "forgot-sent"
  | "reset-password";

interface FoundAccount { username: string; displayName: string; }

export default function AuthPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ? "reset-password" : "welcome";
  });

  const [accountType, setAccountType] = useState<"individual" | "family">("individual");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [foundAccounts, setFoundAccounts] = useState<FoundAccount[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function clearError() { setError(""); }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      await apiFetch("/api/patient-app/register/send-otp", {
        method: "POST",
        body: JSON.stringify({ username: regUsername.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone.trim(), accountType }),
      });
      setStep("register-otp");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      const res = await apiFetch<{ token: string; account: Account }>("/api/patient-app/register/verify", {
        method: "POST",
        body: JSON.stringify({ username: regUsername.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone.trim(), accountType, otp: otp.trim() }),
      });
      login(res.token, res.account);
      setStep("register-success");
      setTimeout(() => navigate("/"), 2200);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function handleLookupPhone(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      const res = await apiFetch<{ accounts: FoundAccount[] }>("/api/patient-app/login/lookup", {
        method: "POST",
        body: JSON.stringify({ phone: loginPhone.trim() }),
      });
      setFoundAccounts(res.accounts);
      if (res.accounts.length === 1) {
        setSelectedUsername(res.accounts[0].username);
        setStep("login-password");
      } else {
        setStep("login-select");
      }
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      const res = await apiFetch<{ token: string; account: Account }>("/api/patient-app/login", {
        method: "POST",
        body: JSON.stringify({ username: selectedUsername, password }),
      });
      login(res.token, res.account);
      navigate("/");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      await apiFetch("/api/patient-app/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      setStep("forgot-sent");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); clearError(); setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") ?? "";
      await apiFetch("/api/patient-app/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setStep("login-phone");
      setError("");
      window.history.replaceState({}, "", "/auth");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060d1f 0%, #0a1628 50%, #060d1f 100%)" }}>

      {/* Glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #14b8a6 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #14b8a6 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-sm rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}>

        {/* ── Welcome ──────────────────────────────────────────── */}
        {step === "welcome" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-48 mb-4">
              <img src="/era-logo.png" alt="ERA Systems" className="w-full h-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ background: "linear-gradient(135deg, #ffffff, #94d4cf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ERA Me
            </h1>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your personal health companion.<br />Track wellness, connect with hospitals.
            </p>

            <button onClick={() => setStep("register-type")}
              className="w-full py-4 rounded-2xl font-semibold text-base mb-3 transition active:scale-95 text-white"
              style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)", boxShadow: "0 8px 32px rgba(20,184,166,0.35)" }}>
              Create Account
            </button>
            <button onClick={() => setStep("login-phone")}
              className="w-full py-4 rounded-2xl font-semibold text-base transition active:scale-95"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
              Sign In
            </button>

            <div className="flex items-center gap-1.5 mt-8" style={{ color: "rgba(255,255,255,0.25)" }}>
              <Shield className="w-3 h-3" />
              <span className="text-[11px] font-medium tracking-wide">ERA Systems · Secure &amp; Private</span>
            </div>
          </div>
        )}

        {/* ── Register: Account type ────────────────────────────── */}
        {step === "register-type" && (
          <div>
            <GlassBack onClick={() => setStep("welcome")} />
            <h2 className="text-2xl font-bold text-white mb-1">How will you use ERA Me?</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>Choose the account type that fits you.</p>
            <div className="space-y-3 mb-7">
              {([
                { type: "individual", label: "Just for me", description: "Personal health tracking and wellness", Icon: User },
                { type: "family", label: "For my family", description: "Manage your family's health together", Icon: Users },
              ] as const).map(({ type, label, description, Icon }) => (
                <button key={type} onClick={() => setAccountType(type)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl transition text-left"
                  style={{
                    background: accountType === type ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.04)",
                    border: accountType === type ? "1.5px solid rgba(20,184,166,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
                  }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: accountType === type ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.08)" }}>
                    <Icon className="w-5 h-5" style={{ color: accountType === type ? "#14b8a6" : "rgba(255,255,255,0.5)" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{description}</p>
                  </div>
                  {accountType === type && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#14b8a6" }} />}
                </button>
              ))}
            </div>
            <GlassButton onClick={() => setStep("register-details")}>Continue</GlassButton>
          </div>
        )}

        {/* ── Register: Details ─────────────────────────────────── */}
        {step === "register-details" && (
          <div>
            <GlassBack onClick={() => setStep("register-type")} />
            <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>We'll send a code to verify your email.</p>
            <form onSubmit={handleSendOtp} className="space-y-4">
              <GlassField label="Username" hint="Letters, numbers and underscores only">
                <GlassInput type="text" required autoComplete="username" value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)} placeholder="e.g. john_doe" />
              </GlassField>
              <GlassField label="Email address">
                <GlassInput type="email" required autoComplete="email" value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" />
              </GlassField>
              <GlassField label="Phone number">
                <GlassInput type="tel" required autoComplete="tel" value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)} placeholder="+234 800 000 0000" />
              </GlassField>
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading}>
                {loading ? "Sending code…" : "Send Verification Code"}
              </GlassButton>
            </form>
          </div>
        )}

        {/* ── Register: OTP ─────────────────────────────────────── */}
        {step === "register-otp" && (
          <div>
            <GlassBack onClick={() => setStep("register-details")} />
            <h2 className="text-2xl font-bold text-white mb-1">Check your email</h2>
            <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              We sent a 6-digit code to <span className="text-white font-medium">{regEmail}</span>
            </p>
            <p className="text-xs mb-7" style={{ color: "rgba(255,255,255,0.35)" }}>Expires in 10 minutes.</p>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input type="text" inputMode="numeric" maxLength={6} required
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-5 rounded-2xl text-center text-4xl font-bold tracking-[0.6em] outline-none transition"
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#14b8a6", caretColor: "#14b8a6",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(20,184,166,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading} disabled={otp.length !== 6}>
                {loading ? "Verifying…" : "Verify & Create Account"}
              </GlassButton>
              <button type="button"
                onClick={() => { setOtp(""); handleSendOtp(new Event("") as unknown as React.FormEvent); }}
                className="w-full text-sm font-medium py-2 transition"
                style={{ color: "rgba(20,184,166,0.8)" }}>
                Resend code
              </button>
            </form>
          </div>
        )}

        {/* ── Register: Success ─────────────────────────────────── */}
        {step === "register-success" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: "rgba(20,184,166,0.15)", border: "1.5px solid rgba(20,184,166,0.4)" }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: "#14b8a6" }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're in!</h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your ERA Me account is ready. Check your email for your password — change it in Profile after you log in.
            </p>
            <div className="mt-8 w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#14b8a6", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* ── Login: Phone ──────────────────────────────────────── */}
        {step === "login-phone" && (
          <div>
            <GlassBack onClick={() => setStep("welcome")} />
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>Enter your phone number to find your account.</p>
            <form onSubmit={handleLookupPhone} className="space-y-4">
              <GlassInput type="tel" required autoComplete="tel" value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)} placeholder="+234 800 000 0000" />
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading}>
                {loading ? "Looking up…" : "Continue"}
              </GlassButton>
            </form>
            <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.4)" }}>
              No account?{" "}
              <button onClick={() => setStep("register-type")} className="font-semibold" style={{ color: "#14b8a6" }}>
                Create one
              </button>
            </p>
          </div>
        )}

        {/* ── Login: Select account ─────────────────────────────── */}
        {step === "login-select" && (
          <div>
            <GlassBack onClick={() => setStep("login-phone")} />
            <h2 className="text-2xl font-bold text-white mb-1">Which one is you?</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>Multiple accounts on this number.</p>
            <div className="space-y-3">
              {foundAccounts.map((a) => (
                <button key={a.username}
                  onClick={() => { setSelectedUsername(a.username); setStep("login-password"); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition active:scale-95"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-lg"
                    style={{ background: "rgba(20,184,166,0.2)", color: "#14b8a6" }}>
                    {a.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{a.displayName}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>@{a.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Login: Password ───────────────────────────────────── */}
        {step === "login-password" && (
          <div>
            <GlassBack onClick={() => { setPassword(""); setStep(foundAccounts.length > 1 ? "login-select" : "login-phone"); }} />
            <h2 className="text-2xl font-bold text-white mb-1">Enter your password</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>
              Signing in as <span className="text-white font-medium">@{selectedUsername}</span>
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <GlassInput type={showPassword ? "text" : "password"} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                  className="pr-12" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </GlassButton>
              <button type="button" onClick={() => { setForgotEmail(""); setStep("forgot-request"); }}
                className="w-full text-sm font-medium py-2" style={{ color: "rgba(20,184,166,0.8)" }}>
                Forgot password?
              </button>
            </form>
          </div>
        )}

        {/* ── Forgot: Request ───────────────────────────────────── */}
        {step === "forgot-request" && (
          <div>
            <GlassBack onClick={() => setStep("login-password")} />
            <h2 className="text-2xl font-bold text-white mb-1">Reset password</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleForgot} className="space-y-4">
              <GlassInput type="email" required autoComplete="email" value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)} placeholder="your@email.com" />
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </GlassButton>
            </form>
          </div>
        )}

        {/* ── Forgot: Sent ──────────────────────────────────────── */}
        {step === "forgot-sent" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: "rgba(20,184,166,0.15)", border: "1.5px solid rgba(20,184,166,0.4)" }}>
              <CheckCircle2 className="w-10 h-10" style={{ color: "#14b8a6" }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              If an account exists with that email, a reset link is on its way. It expires in 1 hour.
            </p>
            <GlassButton onClick={() => setStep("login-phone")}>Back to Sign In</GlassButton>
          </div>
        )}

        {/* ── Reset password ────────────────────────────────────── */}
        {step === "reset-password" && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Set a new password</h2>
            <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.5)" }}>Choose something you'll remember.</p>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="relative">
                <GlassInput type={showNewPassword ? "text" : "password"} required
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters" minLength={8} className="pr-12" />
                <button type="button" onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && <GlassError>{error}</GlassError>}
              <GlassButton type="submit" loading={loading}>
                {loading ? "Saving…" : "Set New Password"}
              </GlassButton>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Shared glass components ───────────────────────────────────────────────────

function GlassBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 mb-6 -ml-1 text-sm font-medium transition"
      style={{ color: "rgba(255,255,255,0.45)" }}>
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}

function GlassInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn("w-full px-4 py-3.5 rounded-xl outline-none text-base transition text-white placeholder-white/30", className)}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        ...(props.style ?? {}),
      }}
      onFocus={(e) => { e.target.style.borderColor = "rgba(20,184,166,0.5)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.12)"; props.onBlur?.(e); }}
    />
  );
}

function GlassField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{hint}</p>}
    </div>
  );
}

function GlassButton({
  children, onClick, type = "button", loading, disabled, className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={loading || disabled}
      className={cn("w-full py-4 rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-white", className)}
      style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)", boxShadow: "0 8px 32px rgba(20,184,166,0.3)" }}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function GlassError({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm"
      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
      {children}
    </div>
  );
}
