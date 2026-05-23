import { useState } from "react";
import { useAuth, type Role } from "@/contexts/auth-context";
import { Activity, Building2, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLE_MAP: Record<string, Role> = {
  receptionist: "receptionist",
  nurse: "nurse",
  admin: "admin",
};

export default function Login() {
  const { hospital, loginHospital, loginRole } = useAuth();

  // Step 1 — hospital
  const [hospUsername, setHospUsername] = useState("");
  const [hospPassword, setHospPassword] = useState("");
  const [hospError, setHospError] = useState("");
  const [hospLoading, setHospLoading] = useState(false);

  // Step 2 — role
  const [roleUsername, setRoleUsername] = useState("");
  const [rolePassword, setRolePassword] = useState("");
  const [roleError, setRoleError] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);

  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHospError("");
    setHospLoading(true);
    try {
      await loginHospital(hospUsername, hospPassword);
    } catch (err: any) {
      setHospError(err.message ?? "Invalid credentials");
    } finally {
      setHospLoading(false);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleError("");
    setRoleLoading(true);
    setTimeout(() => {
      const role = ROLE_MAP[roleUsername.trim().toLowerCase()];
      if (!role) {
        setRoleError("Unknown role. Use: receptionist, nurse, or admin.");
        setRoleLoading(false);
        return;
      }
      const ok = loginRole(role, rolePassword);
      if (!ok) setRoleError("Incorrect password.");
      setRoleLoading(false);
    }, 200);
  };

  // ── STEP 1: Hospital Login ──────────────────────────────────────────────────
  if (!hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
              <Activity className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Era Patient</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in with your hospital credentials</p>
          </div>

          <form onSubmit={handleHospitalSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="h-username">Hospital Username</Label>
              <Input
                id="h-username"
                autoComplete="username"
                value={hospUsername}
                onChange={e => setHospUsername(e.target.value)}
                placeholder="e.g. city_general"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-password">Password</Label>
              <Input
                id="h-password"
                type="password"
                autoComplete="current-password"
                value={hospPassword}
                onChange={e => setHospPassword(e.target.value)}
                placeholder="Enter hospital password"
                required
              />
            </div>

            {hospError && <p className="text-sm text-destructive">{hospError}</p>}

            <Button type="submit" className="w-full" disabled={hospLoading}>
              {hospLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── STEP 2: Staff Login ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Hospital identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{hospital.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">Staff sign in</p>
        </div>

        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-username">Username</Label>
            <Input
              id="r-username"
              autoComplete="username"
              value={roleUsername}
              onChange={e => setRoleUsername(e.target.value)}
              placeholder="receptionist / nurse / admin"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-password">Password</Label>
            <Input
              id="r-password"
              type="password"
              autoComplete="current-password"
              value={rolePassword}
              onChange={e => setRolePassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {roleError && <p className="text-sm text-destructive">{roleError}</p>}

          <Button type="submit" className="w-full" disabled={roleLoading}>
            {roleLoading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground mb-1">Staff credentials</p>
          <p>receptionist / recep1234</p>
          <p>nurse / nurse1234</p>
          <p>admin / admin1234</p>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("era_hospital_session");
              localStorage.removeItem("era_hospital_config");
              window.location.reload();
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeft className="w-3 h-3" />
            Not {hospital.name}? Switch hospital
          </button>
        </div>
      </div>
    </div>
  );
}
