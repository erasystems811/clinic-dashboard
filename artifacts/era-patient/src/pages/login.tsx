import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Loader2, Building2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import esLogo from "@assets/582A6E04-0A71-43CD-8F6D-573C4F2C242F_(1)_1779973822134.png";

type Mode = "nurse" | "receptionist" | "admin";

interface PreloadedHospital {
  name: string;
  username: string;
}

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: "nurse",        label: "Nurse",        description: "Clinical" },
  { id: "receptionist", label: "Reception",    description: "Front desk" },
  { id: "admin",        label: "Admin",         description: "Management" },
];

const GOLD = "#c9a84c";
const NAVY = "#0a0e1b";

function LineInput({
  id, type = "text", value, onChange, placeholder,
  autoComplete, autoFocus, required, rightSlot,
}: {
  id: string;
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

function GoldButton({ loading, children, disabled }: {
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
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

export default function Login() {
  const { loginAdmin, loginStaff } = useAuth();
  const [mode, setMode] = useState<Mode>("nurse");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [preloaded, setPreloaded] = useState<PreloadedHospital | null>(null);
  const [preloadError, setPreloadError] = useState("");
  const [preloadLoading, setPreloadLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get("h");
    if (!h) return;
    setPreloadLoading(true);
    fetch(apiUrl(`/api/hospital/lookup/${encodeURIComponent(h.toLowerCase())}`))
      .then(async res => {
        if (!res.ok) throw new Error("Hospital not found");
        return res.json();
      })
      .then(data => {
        setPreloaded({ name: data.name, username: data.username });
        setMode("admin");
      })
      .catch(() => setPreloadError("This login link is invalid or the hospital is inactive."))
      .finally(() => setPreloadLoading(false));
  }, []);

  const reset = (newMode: Mode) => {
    setMode(newMode);
    setUsername("");
    setPassword("");
    setError("");
    setShowPassword(false);
  };

  const clearPreload = () => {
    setPreloaded(null);
    setPreloadError("");
    const url = new URL(window.location.href);
    url.searchParams.delete("h");
    window.history.replaceState({}, "", url.toString());
    reset("nurse");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (preloaded) {
        await loginAdmin(preloaded.username, password);
      } else if (mode === "admin") {
        await loginAdmin(username, password);
      } else {
        await loginStaff(username, password);
      }
    } catch (err: any) {
      setError(err.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(v => !v)}
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
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NAVY,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
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

          {/* Loading hospital */}
          {preloadLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 0", color: "rgba(255,255,255,0.35)" }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span style={{ fontSize: 13 }}>Loading…</span>
            </div>
          )}

          {/* Preload error */}
          {preloadError && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.07)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#f87171",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {preloadError}
              </div>
              <button
                type="button"
                onClick={clearPreload}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: "rgba(255,255,255,0.35)", fontSize: 13,
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "inherit", padding: 0,
                }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
            </div>
          )}

          {/* Preloaded hospital admin login */}
          {!preloadLoading && !preloadError && preloaded && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                border: "1px solid rgba(201,168,76,0.18)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 28,
                background: "rgba(201,168,76,0.05)",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Building2 className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: "rgba(255,255,255,0.3)", fontSize: 9.5, fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase", margin: 0,
                  }}>
                    Signing into
                  </p>
                  <p style={{
                    color: "white", fontSize: 13, fontWeight: 600, margin: 0, marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {preloaded.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearPreload}
                  style={{
                    color: "rgba(255,255,255,0.25)", fontSize: 12, flexShrink: 0,
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Change
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 24 }}>
                  <FieldLabel>Admin Password</FieldLabel>
                  <LineInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter your password"
                    required
                    rightSlot={eyeToggle}
                  />
                </div>
                {error && (
                  <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{error}</p>
                )}
                <GoldButton loading={loading} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                    : "SIGN IN AS ADMIN"}
                </GoldButton>
              </form>
            </>
          )}

          {/* Standard role login */}
          {!preloadLoading && !preloadError && !preloaded && (
            <>
              {/* Role tabs */}
              <div style={{
                display: "flex",
                gap: 3,
                marginBottom: 28,
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: 4,
                background: "rgba(0,0,0,0.2)",
              }}>
                {MODES.map(m => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => reset(m.id)}
                      style={{
                        flex: 1,
                        padding: "9px 4px",
                        borderRadius: 7,
                        border: active ? "1px solid rgba(201,168,76,0.22)" : "1px solid transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all 0.18s",
                        background: active ? "rgba(201,168,76,0.09)" : "transparent",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {active && (
                          <span style={{
                            width: 4, height: 4, borderRadius: "50%",
                            background: GOLD, display: "inline-block", flexShrink: 0,
                          }} />
                        )}
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: active ? GOLD : "rgba(255,255,255,0.3)",
                          letterSpacing: "0.02em",
                        }}>
                          {m.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 9.5,
                        color: active ? "rgba(201,168,76,0.55)" : "rgba(255,255,255,0.18)",
                        letterSpacing: "0.04em",
                      }}>
                        {m.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 22 }}>
                  <FieldLabel>Username</FieldLabel>
                  <LineInput
                    id="username"
                    autoComplete="username"
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
                    rightSlot={eyeToggle}
                  />
                </div>

                {error && (
                  <p style={{ color: "#f87171", fontSize: 13, marginTop: 12, marginBottom: 4 }}>{error}</p>
                )}

                <GoldButton loading={loading} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                    : `SIGN IN  ·  ${MODES.find(m => m.id === mode)?.label?.toUpperCase()}`}
                </GoldButton>
              </form>
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
