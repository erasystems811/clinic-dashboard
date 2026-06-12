import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, Users, User } from "lucide-react";
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

  // Register fields
  const [accountType, setAccountType] = useState<"individual" | "family">("individual");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [foundAccounts, setFoundAccounts] = useState<FoundAccount[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot / reset
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
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">

          {/* ── Welcome ──────────────────────────────────────────── */}
          {step === "welcome" && (
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl overflow-hidden mb-6 shadow-lg">
                <img src="/era-logo.png" alt="ERA Systems" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">ERA Me</h1>
              <p className="text-muted-foreground text-base mb-10 leading-relaxed">
                Your personal health companion.<br />Track wellness, connect with hospitals,<br />and understand yourself better.
              </p>
              <button
                onClick={() => setStep("register-type")}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base mb-3 transition active:scale-95 shadow-md shadow-primary/20"
              >
                Create Account
              </button>
              <button
                onClick={() => setStep("login-phone")}
                className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-semibold text-base transition active:scale-95"
              >
                Sign In
              </button>
            </div>
          )}

          {/* ── Register: Account type ────────────────────────────── */}
          {step === "register-type" && (
            <div>
              <BackButton onClick={() => setStep("welcome")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">How will you use ERA Me?</h2>
              <p className="text-muted-foreground mb-8">Choose the account type that fits you best.</p>
              <div className="space-y-3 mb-8">
                {([
                  { type: "individual", label: "Just for me", description: "Personal health tracking and wellness", Icon: User },
                  { type: "family", label: "For my family", description: "Manage your family's health together", Icon: Users },
                ] as const).map(({ type, label, description, Icon }) => (
                  <button
                    key={type}
                    onClick={() => setAccountType(type)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition text-left",
                      accountType === type
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                      accountType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    {accountType === type && (
                      <CheckCircle2 className="w-5 h-5 text-primary ml-auto shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("register-details")}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Register: Details ─────────────────────────────────── */}
          {step === "register-details" && (
            <div>
              <BackButton onClick={() => setStep("register-type")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Create your account</h2>
              <p className="text-muted-foreground mb-8">We'll send a verification code to your email.</p>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <Field label="Username" hint="Letters, numbers and underscores only">
                  <input
                    type="text" required autoComplete="username"
                    value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. john_doe"
                    className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                </Field>
                <Field label="Email address">
                  <input
                    type="email" required autoComplete="email"
                    value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                </Field>
                <Field label="Phone number">
                  <input
                    type="tel" required autoComplete="tel"
                    value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                </Field>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending code…</> : "Send Verification Code"}
                </button>
              </form>
            </div>
          )}

          {/* ── Register: OTP ─────────────────────────────────────── */}
          {step === "register-otp" && (
            <div>
              <BackButton onClick={() => setStep("register-details")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
              <p className="text-muted-foreground mb-2">
                We sent a 6-digit code to <strong className="text-foreground">{regEmail}</strong>
              </p>
              <p className="text-sm text-muted-foreground mb-8">It expires in 10 minutes.</p>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text" inputMode="numeric" maxLength={6} required
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-4 py-4 rounded-xl border border-input bg-background text-foreground text-center text-3xl font-bold tracking-[0.5em] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading || otp.length !== 6}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : "Verify & Create Account"}
                </button>
                <button type="button" onClick={() => { setOtp(""); handleSendOtp(new Event("") as unknown as React.FormEvent); }}
                  className="w-full text-sm text-primary font-medium py-2">
                  Resend code
                </button>
              </form>
            </div>
          )}

          {/* ── Register: Success ─────────────────────────────────── */}
          {step === "register-success" && (
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">You're in!</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your ERA Me account is ready. Check your email for your password — please change it in your Profile after you log in.
              </p>
              <div className="mt-6 w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* ── Login: Phone ──────────────────────────────────────── */}
          {step === "login-phone" && (
            <div>
              <BackButton onClick={() => setStep("welcome")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome back</h2>
              <p className="text-muted-foreground mb-8">Enter your phone number to find your account.</p>
              <form onSubmit={handleLookupPhone} className="space-y-4">
                <input
                  type="tel" required autoComplete="tel"
                  value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                />
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</> : "Continue"}
                </button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{" "}
                <button onClick={() => setStep("register-type")} className="text-primary font-medium">Create one</button>
              </p>
            </div>
          )}

          {/* ── Login: Select account ─────────────────────────────── */}
          {step === "login-select" && (
            <div>
              <BackButton onClick={() => setStep("login-phone")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Which one is you?</h2>
              <p className="text-muted-foreground mb-8">Multiple accounts are linked to this number.</p>
              <div className="space-y-3">
                {foundAccounts.map((a) => (
                  <button key={a.username} onClick={() => { setSelectedUsername(a.username); setStep("login-password"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 transition text-left">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-lg">{a.displayName[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.displayName}</p>
                      <p className="text-sm text-muted-foreground">@{a.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Login: Password ───────────────────────────────────── */}
          {step === "login-password" && (
            <div>
              <BackButton onClick={() => { setPassword(""); setStep(foundAccounts.length > 1 ? "login-select" : "login-phone"); }} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Enter your password</h2>
              <p className="text-muted-foreground mb-8">
                Signing in as <strong className="text-foreground">@{selectedUsername}</strong>
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
                </button>
                <button type="button" onClick={() => { setForgotEmail(""); setStep("forgot-request"); }}
                  className="w-full text-sm text-primary font-medium py-2">
                  Forgot password?
                </button>
              </form>
            </div>
          )}

          {/* ── Forgot: Request ───────────────────────────────────── */}
          {step === "forgot-request" && (
            <div>
              <BackButton onClick={() => setStep("login-password")} />
              <h2 className="text-2xl font-bold text-foreground mb-2">Reset your password</h2>
              <p className="text-muted-foreground mb-8">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleForgot} className="space-y-4">
                <input
                  type="email" required autoComplete="email"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                />
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send Reset Link"}
                </button>
              </form>
            </div>
          )}

          {/* ── Forgot: Sent ──────────────────────────────────────── */}
          {step === "forgot-sent" && (
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Check your email</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                If an account exists with that email, a reset link is on its way. It expires in 1 hour.
              </p>
              <button onClick={() => setStep("login-phone")}
                className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-semibold text-base transition active:scale-95">
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Reset password ────────────────────────────────────── */}
          {step === "reset-password" && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Set a new password</h2>
              <p className="text-muted-foreground mb-8">Choose something you'll remember.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"} required
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />
                  <button type="button" onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Set New Password"}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1 hover:text-foreground transition">
      <ArrowLeft className="w-5 h-5" />
      <span className="text-sm font-medium">Back</span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  );
}
