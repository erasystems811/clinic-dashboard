import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Activity, Loader2, Building2, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";

type Mode = "staff" | "admin";

interface PreloadedHospital {
  name: string;
  username: string;
}

/* ── Per-mode colour palettes ─────────────────────────────────────────────── */
const PALETTES = {
  staff: {
    /* Navy / royal blue */
    primary:     "hsl(221 78% 57%)",
    primaryDark: "hsl(221 78% 48%)",
    glow:        "hsl(221 78% 57% / 0.20)",
    ring:        "hsl(221 78% 57% / 0.30)",
    iconBg:      "hsl(221 78% 57% / 0.12)",
    iconRing:    "hsl(221 78% 57% / 0.28)",
    tabBg:       "hsl(221 78% 57% / 0.10)",
    tabRing:     "hsl(221 78% 57% / 0.22)",
    label:       "Staff Access",
  },
  admin: {
    /* Champagne gold — matches ERA Super Admin */
    primary:     "hsl(43 60% 52%)",
    primaryDark: "hsl(43 60% 44%)",
    glow:        "hsl(43 60% 52% / 0.20)",
    ring:        "hsl(43 60% 52% / 0.30)",
    iconBg:      "hsl(43 60% 52% / 0.12)",
    iconRing:    "hsl(43 60% 52% / 0.28)",
    tabBg:       "hsl(43 60% 52% / 0.10)",
    tabRing:     "hsl(43 60% 52% / 0.22)",
    label:       "Admin Access",
  },
} as const;

export default function Login() {
  const { loginAdmin, loginStaff } = useAuth();
  const [mode, setMode] = useState<Mode>("staff");

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
      .catch(() => {
        setPreloadError("This login link is invalid or the hospital is inactive.");
      })
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
    reset("staff");
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

  const effectiveMode: Mode = (preloaded && !preloadLoading && !preloadError) ? "admin" : mode;
  const pal = PALETTES[effectiveMode];

  const inputCls =
    "w-full px-3 py-2.5 rounded-md bg-muted border border-border text-foreground text-sm " +
    "placeholder:text-muted-foreground/35 transition font-normal tracking-wide " +
    "focus:outline-none";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4 transition-all duration-500"
      style={{
        backgroundImage: `radial-gradient(ellipse 70% 50% at 50% -5%, ${pal.glow}, transparent)`,
      }}
    >
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-500"
            style={{
              background: pal.iconBg,
              boxShadow: `0 0 32px ${pal.glow}, 0 0 0 1px ${pal.iconRing}`,
            }}
          >
            <Activity className="w-5 h-5 transition-colors duration-500" style={{ color: pal.primary }} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Era Patient</h1>
          <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-[0.18em] font-medium">
            {pal.label}
          </p>
        </div>

        {/* Preload loading */}
        {preloadLoading && (
          <div className="flex items-center justify-center gap-2.5 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: pal.primary }} />
            <span className="text-sm font-normal">Loading hospital…</span>
          </div>
        )}

        {/* Preload error */}
        {preloadError && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive font-normal">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {preloadError}
            </div>
            <button
              type="button"
              onClick={clearPreload}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </button>
          </div>
        )}

        {/* Preloaded hospital mode */}
        {!preloadLoading && !preloadError && preloaded && (
          <>
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 mb-5">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-all duration-500"
                style={{ background: pal.iconBg, boxShadow: `0 0 0 1px ${pal.iconRing}` }}
              >
                <Building2 className="w-3.5 h-3.5 transition-colors duration-500" style={{ color: pal.primary }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.14em]">Signing into</p>
                <p className="text-sm font-semibold text-foreground truncate">{preloaded.name}</p>
              </div>
              <button
                type="button"
                onClick={clearPreload}
                className="text-[10px] text-muted-foreground hover:text-foreground transition font-medium uppercase tracking-wide shrink-0"
              >
                Change
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
                  Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className={inputCls + " pr-10"}
                    style={{ outline: "none" }}
                    onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${pal.ring}`; e.currentTarget.style.borderColor = pal.primary; }}
                    onBlur={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = ""; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-normal">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-md text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                style={{
                  background: pal.primary,
                  color: effectiveMode === "admin" ? "hsl(0 0% 8%)" : "#fff",
                  boxShadow: `0 2px 20px ${pal.glow}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = pal.primaryDark; }}
                onMouseLeave={e => { e.currentTarget.style.background = pal.primary; }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Signing in…</span>
                  : "Sign In"}
              </button>
            </form>
          </>
        )}

        {/* Normal login mode */}
        {!preloadLoading && !preloadError && !preloaded && (
          <>
            {/* Mode selector */}
            <div className="flex rounded-md border border-border bg-muted/40 p-0.5 mb-5">
              {(["staff", "admin"] as Mode[]).map(m => {
                const p = PALETTES[m];
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => reset(m)}
                    className="flex-1 py-2 text-xs font-medium rounded transition-all duration-300 uppercase tracking-[0.14em]"
                    style={isActive ? {
                      background: p.tabBg,
                      color: p.primary,
                      boxShadow: `0 0 0 1px ${p.tabRing}`,
                    } : {
                      color: "hsl(215 12% 46%)",
                    }}
                  >
                    {m === "staff" ? "Staff" : "Admin"}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {(["username", "password"] as const).map(field => (
                <div key={field} className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  {field === "password" ? (
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className={inputCls + " pr-10"}
                        onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${pal.ring}`; e.currentTarget.style.borderColor = pal.primary; }}
                        onBlur={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <input
                      autoComplete="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter username"
                      required
                      className={inputCls}
                      onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${pal.ring}`; e.currentTarget.style.borderColor = pal.primary; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = ""; }}
                    />
                  )}
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-normal">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-md text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                style={{
                  background: pal.primary,
                  color: effectiveMode === "admin" ? "hsl(0 0% 8%)" : "#fff",
                  boxShadow: `0 2px 20px ${pal.glow}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = pal.primaryDark; }}
                onMouseLeave={e => { e.currentTarget.style.background = pal.primary; }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Signing in…</span>
                  : "Sign In"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-normal mt-8">
          Secure Clinical Access · Era Systems
        </p>
      </div>
    </div>
  );
}
