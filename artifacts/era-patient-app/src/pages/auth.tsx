import { useState } from "react";
import { Heart, ArrowLeft, Eye, EyeOff, Loader2, Check, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth, type PatientAccount } from "@/contexts/auth-context";

type Step =
  | "welcome"
  | "register-type"
  | "register-details"
  | "register-otp"
  | "register-success"
  | "login-phone"
  | "login-select"
  | "login-password"
  | "forgot-email"
  | "forgot-sent";

interface AccountSummary {
  id: number;
  username: string;
  displayName: string;
  accountType: string;
}

function StepHeader({ onBack, title, subtitle }: { onBack?: () => void; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      )}
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function Input({
  label, type = "text", value, onChange, placeholder, autoFocus, autoComplete, error, hint, suffix,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoFocus?: boolean; autoComplete?: string;
  error?: string; hint?: string; suffix?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-foreground">{label}</label>
      <div className="relative">
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus} autoComplete={autoComplete}
          className={cn(
            "w-full px-4 py-3.5 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground",
            "text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all",
            error ? "border-destructive" : "border-border",
            suffix ? "pr-12" : ""
          )}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
      {error && <p className="text-destructive text-xs font-medium">{error}</p>}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Btn({
  children, onClick, loading, disabled, variant = "primary", className,
}: {
  children: React.ReactNode; onClick?: () => void; loading?: boolean;
  disabled?: boolean; variant?: "primary" | "secondary" | "ghost"; className?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled || loading}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-base",
        "transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-primary text-primary-foreground shadow-sm hover:brightness-105",
        variant === "secondary" && "bg-secondary text-secondary-foreground border border-border hover:bg-muted",
        variant === "ghost" && "text-primary hover:bg-primary/8",
        className
      )}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
}

export default function AuthPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Register fields
  const [accountType, setAccountType] = useState<"individual" | "family">("individual");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [loginAccounts, setLoginAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");

  function go(s: Step) { setError(""); setStep(s); }

  // ── Register: send OTP ──────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/patient-app/register/send-otp", {
        method: "POST",
        body: JSON.stringify({ username: regUsername, email: regEmail, phone: regPhone, accountType }),
      });
      go("register-otp");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("EMAIL_EXISTS") || msg.includes("email")) setError(msg);
      else if (msg.includes("USERNAME_EXISTS") || msg.includes("username")) setError(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Register: verify OTP ────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    setError(""); setLoading(true);
    try {
      const res = await apiFetch<{ token: string; account: PatientAccount }>(
        "/api/patient-app/register/verify",
        { method: "POST", body: JSON.stringify({ username: regUsername, email: regEmail, phone: regPhone, accountType, otp }) }
      );
      login(res.token, res.account);
      go("register-success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Login: lookup phone ─────────────────────────────────────────────────────
  async function handleLookupPhone() {
    setError(""); setLoading(true);
    try {
      const res = await apiFetch<{ accounts: AccountSummary[] }>(
        "/api/patient-app/login/lookup",
        { method: "POST", body: JSON.stringify({ phone: loginPhone }) }
      );
      if (res.accounts.length === 0) {
        setError("No account found with this phone number. Please register first.");
        return;
      }
      setLoginAccounts(res.accounts);
      if (res.accounts.length === 1) {
        setSelectedAccount(res.accounts[0]);
        setLoginUsername(res.accounts[0].username);
        go("login-password");
      } else {
        go("login-select");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAccount(acc: AccountSummary) {
    setSelectedAccount(acc);
    setLoginUsername(acc.username);
    go("login-password");
  }

  // ── Login: authenticate ─────────────────────────────────────────────────────
  async function handleLogin() {
    setError(""); setLoading(true);
    try {
      const res = await apiFetch<{ token: string; account: PatientAccount }>(
        "/api/patient-app/login",
        { method: "POST", body: JSON.stringify({ username: loginUsername, password: loginPassword }) }
      );
      login(res.token, res.account);
      // AuthProvider handles redirect
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ─────────────────────────────────────────────────────────
  async function handleForgotPassword() {
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/patient-app/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      go("forgot-sent");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6 py-8">

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="flex flex-col flex-1">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30">
                <Heart className="w-10 h-10 text-primary-foreground" fill="currentColor" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-3">ERA Patient</h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-xs">
                Your personal health companion. Track your wellness, connect with your hospitals, and stay on top of your health — all in one place.
              </p>
            </div>
            <div className="space-y-3 mt-8">
              <Btn onClick={() => go("register-type")}>Create Account</Btn>
              <Btn variant="secondary" onClick={() => go("login-phone")}>Sign In</Btn>
            </div>
          </div>
        )}

        {/* ── Register: Account Type ── */}
        {step === "register-type" && (
          <div>
            <StepHeader onBack={() => go("welcome")} title="How will you use ERA Patient?" subtitle="Choose the account type that fits your situation." />
            <div className="space-y-3">
              {[
                {
                  type: "individual" as const,
                  icon: User,
                  title: "Just for me",
                  desc: "Track your personal health and connect to your hospitals.",
                },
                {
                  type: "family" as const,
                  icon: Users,
                  title: "For my family",
                  desc: "Manage health profiles for your children too, all in one account.",
                },
              ].map(({ type, icon: Icon, title, desc }) => (
                <button
                  key={type}
                  onClick={() => setAccountType(type)}
                  className={cn(
                    "w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                    accountType === type
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", accountType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  {accountType === type && <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
            <div className="mt-8">
              <Btn onClick={() => go("register-details")}>Continue</Btn>
            </div>
          </div>
        )}

        {/* ── Register: Details ── */}
        {step === "register-details" && (
          <div>
            <StepHeader
              onBack={() => go("register-type")}
              title="Create your account"
              subtitle="Your email will be used to verify your identity and send your login details."
            />
            <div className="space-y-4">
              <Input
                label="Choose a username"
                value={regUsername}
                onChange={setRegUsername}
                placeholder="e.g. john_doe"
                hint="3–30 characters. Letters, numbers, and underscores only."
                autoFocus
                autoComplete="username"
              />
              <Input
                label="Your phone number"
                type="tel"
                value={regPhone}
                onChange={setRegPhone}
                placeholder="+234 800 000 0000"
                hint="Used to find your account when you sign in."
                autoComplete="tel"
              />
              <Input
                label="Your email address"
                type="email"
                value={regEmail}
                onChange={setRegEmail}
                placeholder="you@example.com"
                hint="Your verification code and password will be sent here."
                autoComplete="email"
              />
            </div>
            {error && <p className="text-destructive text-sm mt-4 font-medium">{error}</p>}
            <div className="mt-8">
              <Btn
                onClick={handleSendOtp}
                loading={loading}
                disabled={!regUsername || !regEmail || !regPhone}
              >
                Send Verification Code
              </Btn>
            </div>
          </div>
        )}

        {/* ── Register: OTP ── */}
        {step === "register-otp" && (
          <div>
            <StepHeader
              onBack={() => go("register-details")}
              title="Check your email"
              subtitle={`We sent a 6-digit code to ${regEmail}. Enter it below to verify your email.`}
            />
            <Input
              label="Verification code"
              type="number"
              value={otp}
              onChange={setOtp}
              placeholder="000000"
              autoFocus
              autoComplete="one-time-code"
            />
            {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
            <div className="mt-8 space-y-3">
              <Btn onClick={handleVerifyOtp} loading={loading} disabled={otp.length < 6}>
                Verify & Create Account
              </Btn>
              <Btn variant="ghost" onClick={handleSendOtp} disabled={loading}>
                Resend code
              </Btn>
            </div>
          </div>
        )}

        {/* ── Register: Success ── */}
        {step === "register-success" && (
          <div className="flex flex-col flex-1">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-3">You're in!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Your account has been created. We've sent your auto-generated password to <strong>{regEmail}</strong>.
              </p>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                <p className="text-amber-800 text-sm font-semibold">One important thing</p>
                <p className="text-amber-700 text-sm mt-1">Check your email for your password, then go to Profile → Change Password to set one only you know.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Login: Phone ── */}
        {step === "login-phone" && (
          <div>
            <StepHeader onBack={() => go("welcome")} title="Welcome back" subtitle="Enter your phone number to find your account." />
            <Input
              label="Phone number"
              type="tel"
              value={loginPhone}
              onChange={setLoginPhone}
              placeholder="+234 800 000 0000"
              autoFocus
              autoComplete="tel"
            />
            {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
            <div className="mt-8">
              <Btn onClick={handleLookupPhone} loading={loading} disabled={!loginPhone}>
                Continue
              </Btn>
            </div>
          </div>
        )}

        {/* ── Login: Select account ── */}
        {step === "login-select" && (
          <div>
            <StepHeader onBack={() => go("login-phone")} title="Which one is you?" subtitle="More than one account is registered with this phone number. Select yours." />
            <div className="space-y-3">
              {loginAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 text-left transition-all"
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                    {acc.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{acc.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{acc.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Login: Password ── */}
        {step === "login-password" && (
          <div>
            <StepHeader
              onBack={() => loginAccounts.length > 1 ? go("login-select") : go("login-phone")}
              title={`Hello, ${selectedAccount?.displayName ?? loginUsername}`}
              subtitle="Enter your password to sign in."
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={loginPassword}
              onChange={setLoginPassword}
              placeholder="Your password"
              autoFocus
              autoComplete="current-password"
              suffix={
                <button type="button" onClick={() => setShowPassword(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
            <div className="mt-8 space-y-3">
              <Btn onClick={handleLogin} loading={loading} disabled={!loginPassword}>
                Sign In
              </Btn>
              <Btn variant="ghost" onClick={() => go("forgot-email")}>
                Forgot password?
              </Btn>
            </div>
          </div>
        )}

        {/* ── Forgot: Email ── */}
        {step === "forgot-email" && (
          <div>
            <StepHeader onBack={() => go("login-password")} title="Reset your password" subtitle="Enter your email address and we'll send you a reset link." />
            <Input
              label="Email address"
              type="email"
              value={forgotEmail}
              onChange={setForgotEmail}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
            />
            {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
            <div className="mt-8">
              <Btn onClick={handleForgotPassword} loading={loading} disabled={!forgotEmail}>
                Send Reset Link
              </Btn>
            </div>
          </div>
        )}

        {/* ── Forgot: Sent ── */}
        {step === "forgot-sent" && (
          <div className="flex flex-col flex-1">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Heart className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-3">Check your email</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                If an account exists for <strong>{forgotEmail}</strong>, we've sent a password reset link. Check your inbox.
              </p>
            </div>
            <Btn onClick={() => go("login-phone")} className="mt-8">Back to Sign In</Btn>
          </div>
        )}

      </div>
    </div>
  );
}
