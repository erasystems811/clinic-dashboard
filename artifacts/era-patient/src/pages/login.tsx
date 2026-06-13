import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Activity, Loader2, Building2, ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "staff" | "admin";

interface PreloadedHospital {
  name: string;
  username: string;
}

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: "staff", label: "Staff Login",  description: "Nurse · Receptionist · Doctor" },
  { id: "admin", label: "Admin Login",  description: "Hospital admin" },
];

const MODE_STYLES: Record<Mode, {
  active: string;
  btn: string;
  ring: string;
  dot: string;
}> = {
  staff: {
    active: "bg-emerald-900/40 text-emerald-200 ring-1 ring-emerald-600/40",
    btn: "bg-emerald-700 hover:bg-emerald-600 text-white",
    ring: "focus:ring-emerald-500/40 focus:border-emerald-500/50",
    dot: "bg-emerald-400",
  },
  admin: {
    active: "bg-primary/15 text-primary ring-1 ring-primary/30",
    btn: "bg-primary hover:bg-primary/90 text-primary-foreground",
    ring: "focus:ring-primary/40 focus:border-primary/50",
    dot: "bg-primary",
  },
};

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
    } catch (err: unknown) {
      setError((err as Error).message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const styles = MODE_STYLES[mode];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/era-logo.png" alt="ERA Health" width={96} height={96}
            className="w-24 h-24 rounded-3xl object-contain mb-4 shadow-lg"
            style={{ opacity: 0, transition: "opacity 0.25s ease" }}
            onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }}
          />
          <h1 className="text-2xl font-bold tracking-tight">ERA Health</h1>
        </div>

        {preloadLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {preloadError && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {preloadError}
            </div>
            <button type="button" onClick={clearPreload}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </button>
          </div>
        )}

        {/* Preloaded hospital */}
        {!preloadLoading && !preloadError && preloaded && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Signing into</p>
                <p className="text-sm font-semibold text-foreground truncate">{preloaded.name}</p>
              </div>
              <button type="button" onClick={clearPreload}
                className="text-xs text-muted-foreground hover:text-foreground transition shrink-0">
                Change
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Admin Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" autoFocus value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                    required className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={loading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${styles.btn}`}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : "Sign In as Admin"}
              </button>
            </form>
          </>
        )}

        {/* 2-tab login */}
        {!preloadLoading && !preloadError && !preloaded && (
          <>
            <div className="flex rounded-xl border border-border bg-muted/15 p-1 mb-6 gap-1">
              {MODES.map(m => {
                const active = mode === m.id;
                const s = MODE_STYLES[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => reset(m.id)}
                    className={`flex-1 flex flex-col items-center py-2.5 px-1 rounded-lg transition-all duration-200 ${
                      active ? s.active : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {active && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />}
                      <span className="text-sm font-semibold leading-tight">{m.label}</span>
                    </div>
                    <span className={`text-[10px] leading-tight ${active ? "opacity-70" : "opacity-40"}`}>
                      {m.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">{mode === "admin" ? "Hospital Username" : "Username"}</Label>
                <Input id="username" autoComplete="username" value={username}
                  onChange={e => setUsername(e.target.value)} placeholder="Enter your username" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                    required className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button type="submit" disabled={loading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${styles.btn}`}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                  : `Sign in`}
              </button>
            </form>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-8 text-muted-foreground/40">
          <Lock className="w-3 h-3" />
          <span className="text-[11px] font-medium tracking-wide">Secure clinical access · Era Systems</span>
        </div>
      </div>
    </div>
  );
}
