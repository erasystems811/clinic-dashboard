import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Activity, Loader2, Building2, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";

type Mode = "staff" | "admin";

interface PreloadedHospital {
  name: string;
  username: string;
}

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

  const inputCls = "w-full px-3 py-2.5 rounded-md bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/60 transition font-medium";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4"
      style={{ backgroundImage: "radial-gradient(ellipse 70% 50% at 50% -5%, hsl(183 52% 40% / 0.07), transparent)" }}
    >
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl bg-primary/12 ring-1 ring-primary/30 flex items-center justify-center mb-4"
            style={{ boxShadow: "0 0 32px hsl(183 52% 40% / 0.2)" }}
          >
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Era Patient</h1>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-semibold">
            Clinical Management Platform
          </p>
        </div>

        {/* Preload loading */}
        {preloadLoading && (
          <div className="flex items-center justify-center gap-2.5 py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading hospital…</span>
          </div>
        )}

        {/* Preload error */}
        {preloadError && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {preloadError}
            </div>
            <button
              type="button"
              onClick={clearPreload}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </button>
          </div>
        )}

        {/* Preloaded hospital mode */}
        {!preloadLoading && !preloadError && preloaded && (
          <>
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 mb-5">
              <div className="w-8 h-8 rounded-md bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Signing into</p>
                <p className="text-sm font-bold text-foreground truncate">{preloaded.name}</p>
              </div>
              <button
                type="button"
                onClick={clearPreload}
                className="text-[10px] text-muted-foreground hover:text-foreground transition font-bold uppercase tracking-wide shrink-0"
              >
                Change
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
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
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ boxShadow: "0 2px 16px hsl(183 52% 40% / 0.25)" }}
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
              {(["staff", "admin"] as Mode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => reset(m)}
                  className={`flex-1 py-2 text-xs font-bold rounded transition-all uppercase tracking-widest ${
                    mode === m
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "staff" ? "Staff" : "Admin"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Username
                </label>
                <input
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className={inputCls + " pr-10"}
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
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ boxShadow: "0 2px 16px hsl(183 52% 40% / 0.25)" }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Signing in…</span>
                  : "Sign In"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-[10px] text-muted-foreground/35 uppercase tracking-widest font-medium mt-8">
          Secure Clinical Access · Era Systems
        </p>
      </div>
    </div>
  );
}
