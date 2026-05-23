import { useState } from "react";
import { useAuth, type Role } from "@/contexts/auth-context";
import { Activity, Building2, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES: { role: Role; label: string; sub: string; initial: string }[] = [
  { role: "receptionist", label: "Receptionist", sub: "Manages patient queue, appointments & call tasks", initial: "R" },
  { role: "nurse", label: "Nurse", sub: "Logs treatment plans and monitors patient care", initial: "N" },
  { role: "admin", label: "Admin", sub: "Full access to all features and reports", initial: "A" },
];

export default function Login() {
  const { hospital, loginHospital, loginRole } = useAuth();

  // Step 1 state
  const [hospUsername, setHospUsername] = useState("");
  const [hospPassword, setHospPassword] = useState("");
  const [hospError, setHospError] = useState("");
  const [hospLoading, setHospLoading] = useState(false);

  // Step 2 state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
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
    if (!selectedRole) return;
    setRoleError("");
    setRoleLoading(true);
    setTimeout(() => {
      const ok = loginRole(selectedRole, rolePassword);
      if (!ok) setRoleError("Incorrect password for this role.");
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
              {hospLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
              ) : (
                <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── STEP 2: Role Selection ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Hospital identity banner */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{hospital.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Select your role to continue</p>
        </div>

        <form onSubmit={handleRoleSubmit} className="space-y-4">
          {/* Role cards */}
          <div className="space-y-2">
            {ROLES.map(r => (
              <button
                key={r.role}
                type="button"
                onClick={() => { setSelectedRole(r.role); setRolePassword(""); setRoleError(""); }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                  selectedRole === r.role
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  selectedRole === r.role ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {r.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${selectedRole === r.role ? "text-foreground" : "text-muted-foreground"}`}>
                    {r.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.sub}</p>
                </div>
                {selectedRole === r.role && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Password field — shown once a role is selected */}
          {selectedRole && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="role-password">
                {ROLES.find(r => r.role === selectedRole)?.label} Password
              </Label>
              <Input
                id="role-password"
                type="password"
                autoComplete="current-password"
                value={rolePassword}
                onChange={e => setRolePassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
                required
              />
            </div>
          )}

          {roleError && <p className="text-sm text-destructive">{roleError}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={!selectedRole || !rolePassword || roleLoading}
          >
            {roleLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
            ) : "Sign In"}
          </Button>
        </form>

        {/* Not the right hospital? */}
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
