import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/auth";
import { post } from "@/lib/api";
import { Loader2, Eye, EyeOff, AlertCircle, KeyRound, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import esLogo from "@assets/582A6E04-0A71-43CD-8F6D-573C4F2C242F_(1)_1779973822134.png";

type Screen = "login" | "recover";

const GOLD = "#c9a84c";
const NAVY = "#0a0e1b";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block",
      color: "rgba(255,255,255,0.35)",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      marginBottom: 6,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {children}
    </label>
  );
}

function LineInput({
  id, type = "text", value, onChange, placeholder,
  autoComplete, autoFocus, required, rightSlot,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1.5px solid ${focused ? GOLD : "rgba(255,255,255,0.13)"}`,
          outline: "none",
          color: "rgba(255,255,255,0.92)",
          padding: "10px 0",
          paddingRight: rightSlot ? 36 : 0,
          fontSize: 14,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          transition: "border-color 0.2s",
          letterSpacing: "0.01em",
          boxSizing: "border-box",
        }}
        className="placeholder:text-white/20"
      />
      {rightSlot && (
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

function EyeBtn({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{
        color: "rgba(255,255,255,0.25)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

function GoldButton({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: "100%",
        padding: "13px 0",
        background: disabled ? "rgba(201,168,76,0.45)" : GOLD,
        color: NAVY,
        borderRadius: 8,
        border: "none",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: "0.12em",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "opacity 0.2s, background 0.2s",
        marginTop: 8,
      }}
    >
      {children}
    </button>
  );
}

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
    if (newPassword.length < 8) { setError("Minimum 8 characters required"); return; }
    setLoading(true);
    try {
      await post("/super-admin/auth/recover", { recoveryKey, newPassword });
      setRecoveryDone(true);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Recovery failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: NAVY,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Logo + Wordmark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <img
            src={esLogo}
            alt="Era Systems"
            style={{ width: 72, height: 72, borderRadius: 18, display: "block" }}
          />
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <p style={{
              color: "rgba(255,255,255,0.92)",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              margin: 0,
            }}>
              ERA SYSTEMS
            </p>
            <p style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginTop: 6,
            }}>
              HOSPITAL MANAGEMENT PLATFORM
            </p>
          </div>
        </div>

        {/* Card */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "32px 28px",
          background: "rgba(255,255,255,0.02)",
        }}>

          {/* ── LOGIN ── */}
          {screen === "login" && (
            <form onSubmit={submit}>
              <div style={{ marginBottom: 22 }}>
                <FieldLabel>Username</FieldLabel>
                <LineInput
                  id="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={setUsername}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <FieldLabel>Password</FieldLabel>
                <LineInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  required
                  rightSlot={<EyeBtn show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
                />
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.07)",
                  borderRadius: 7,
                  padding: "10px 14px",
                  color: "#f87171",
                  fontSize: 12,
                  marginTop: 16,
                }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <GoldButton disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "SIGN IN"}
              </GoldButton>

              <button
                type="button"
                onClick={() => { setScreen("recover"); setError(""); }}
                style={{
                  width: "100%",
                  marginTop: 16,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: 11,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.06em",
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* ── RECOVERY ── */}
          {screen === "recover" && (
            <>
              {recoveryDone ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center", padding: "8px 0" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    border: "1px solid rgba(52,211,153,0.25)",
                    background: "rgba(52,211,153,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ShieldCheck className="w-5 h-5" style={{ color: "#34d399" }} />
                  </div>
                  <div>
                    <p style={{ color: "white", fontSize: 14, fontWeight: 700, margin: 0 }}>Password Reset</p>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                      Your new password is active. Sign in now.
                    </p>
                  </div>
                  <button
                    onClick={() => { setScreen("login"); setRecoveryDone(false); setRecoveryKey(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
                    style={{
                      padding: "10px 24px",
                      background: GOLD, color: NAVY,
                      borderRadius: 8, border: "none",
                      fontSize: 12, fontWeight: 800,
                      fontFamily: "inherit", letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    BACK TO LOGIN
                  </button>
                </div>
              ) : (
                <form onSubmit={recover}>
                  <div style={{ marginBottom: 6 }}>
                    <p style={{
                      color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 20px",
                    }}>
                      Password Recovery
                    </p>
                  </div>

                  {[
                    { label: "Recovery Key", value: recoveryKey, set: setRecoveryKey, show: showRecoveryKey, toggle: () => setShowRecoveryKey(v => !v), Icon: KeyRound },
                    { label: "New Password", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(v => !v), Icon: Lock },
                    { label: "Confirm Password", value: confirmPassword, set: setConfirmPassword, show: showConfirmPassword, toggle: () => setShowConfirmPassword(v => !v), Icon: Lock },
                  ].map(({ label, value, set, show, toggle }) => (
                    <div key={label} style={{ marginBottom: 20 }}>
                      <FieldLabel>{label}</FieldLabel>
                      <LineInput
                        type={show ? "text" : "password"}
                        value={value}
                        onChange={set}
                        required
                        rightSlot={<EyeBtn show={show} onToggle={toggle} />}
                      />
                    </div>
                  ))}

                  {error && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      border: "1px solid rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.07)",
                      borderRadius: 7,
                      padding: "10px 14px",
                      color: "#f87171",
                      fontSize: 12,
                      marginBottom: 8,
                    }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <GoldButton disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</> : "RESET PASSWORD"}
                  </GoldButton>

                  <button
                    type="button"
                    onClick={() => { setScreen("login"); setError(""); }}
                    style={{
                      width: "100%",
                      marginTop: 16,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      color: "rgba(255,255,255,0.25)",
                      fontSize: 11, background: "none", border: "none",
                      cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
                    }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          marginTop: 28,
          color: "rgba(255,255,255,0.13)",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          EVALUATE&nbsp;&nbsp;·&nbsp;&nbsp;REBUILD&nbsp;&nbsp;·&nbsp;&nbsp;AUTOMATE
        </p>

      </div>
    </div>
  );
}
