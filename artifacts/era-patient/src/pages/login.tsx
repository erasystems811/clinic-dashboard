import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiUrl } from "@/lib/api";
import { Activity, Loader2, Building2, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Era Patient</h1>
          <p className="text-sm text-muted-foreground mt-1">Hospital Management Platform</p>
        </div>

        {/* Main card */}
        <div className="bg-card border border-card-border rounded-xl shadow-md p-6">

          {/* Preload loading */}
          {preloadLoading && (
            <div className="flex items-center justify-center gap-2.5 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm">Loading hospital…</span>
            </div>
          )}

          {/* Preload error */}
          {preloadError && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {preloadError}
              </div>
              <button
                type="button"
                onClick={clearPreload}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
            </div>
          )}

          {/* Preloaded hospital mode */}
          {!preloadLoading && !preloadError && preloaded && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3.5 py-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Signing into</p>
                  <p className="text-sm font-semibold text-foreground truncate">{preloaded.name}</p>
                </div>
                <button
                  type="button"
                  onClick={clearPreload}
                  className="text-xs text-muted-foreground hover:text-foreground transition shrink-0 font-medium"
                >
                  Change
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Admin Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full shadow-sm" disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                    : "Sign In"}
                </Button>
              </form>
            </>
          )}

          {/* Normal login mode */}
          {!preloadLoading && !preloadError && !preloaded && (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-lg border border-border bg-muted/50 p-1 mb-5">
                <button
                  type="button"
                  onClick={() => reset("staff")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === "staff"
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Staff Login
                </button>
                <button
                  type="button"
                  onClick={() => reset("admin")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === "admin"
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Admin Login
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full shadow-sm" disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                    : "Sign In"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure clinical access · Era Systems
        </p>
      </div>
    </div>
  );
}
