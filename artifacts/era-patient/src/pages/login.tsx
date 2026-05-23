import { useState } from "react";
import { useAuth, type HospitalConfig } from "@/contexts/auth-context";
import { Activity, Building2, Loader2, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "staff" | "admin";
type StaffStep = "lookup" | "credentials";

interface HospitalInfo {
  id: number;
  name: string;
  username: string;
  departments: string[];
  modules: HospitalConfig["modules"];
}

export default function Login() {
  const { lookupHospital, loginAdmin, loginStaff } = useAuth();
  const [mode, setMode] = useState<Mode>("staff");

  // ── Staff state ─────────────────────────────────────────────────────────────
  const [staffStep, setStaffStep] = useState<StaffStep>("lookup");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [foundHospital, setFoundHospital] = useState<HospitalInfo | null>(null);

  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  // ── Admin state ─────────────────────────────────────────────────────────────
  const [hospUsername, setHospUsername] = useState("");
  const [hospPassword, setHospPassword] = useState("");
  const [hospError, setHospError] = useState("");
  const [hospLoading, setHospLoading] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError("");
    setLookupLoading(true);
    try {
      const data = await lookupHospital(lookupInput);
      setFoundHospital(data);
      setStaffStep("credentials");
    } catch {
      setLookupError("Hospital not found. Check the name and try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError("");
    const role = staffUsername.trim().toLowerCase();
    if (role !== "nurse" && role !== "receptionist") {
      setStaffError("Username must be nurse or receptionist.");
      return;
    }
    setStaffLoading(true);
    setTimeout(() => {
      const ok = loginStaff(role as "nurse" | "receptionist", staffPassword, foundHospital!);
      if (!ok) setStaffError("Incorrect password.");
      setStaffLoading(false);
    }, 200);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setHospError("");
    setHospLoading(true);
    try {
      await loginAdmin(hospUsername, hospPassword);
    } catch (err: any) {
      setHospError(err.message ?? "Invalid credentials");
    } finally {
      setHospLoading(false);
    }
  };

  // ── ADMIN LOGIN ──────────────────────────────────────────────────────────────
  if (mode === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
              <Activity className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Era Patient</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin login</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="h-username">Hospital Username</Label>
              <Input
                id="h-username"
                autoComplete="username"
                value={hospUsername}
                onChange={e => setHospUsername(e.target.value)}
                placeholder="e.g. gisd-hospital"
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
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setMode("staff"); setHospError(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <ArrowLeft className="w-3 h-3" />
              Staff Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAFF: Step 1 — Hospital Lookup ─────────────────────────────────────────
  if (staffStep === "lookup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
              <Activity className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your hospital ID to continue</p>
          </div>

          <form onSubmit={handleLookup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lookup">Hospital ID</Label>
              <Input
                id="lookup"
                value={lookupInput}
                onChange={e => setLookupInput(e.target.value)}
                placeholder="e.g. gisd-hospital"
                autoComplete="off"
                required
              />
            </div>

            {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}

            <Button type="submit" className="w-full" disabled={lookupLoading}>
              {lookupLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up…</>
                : <><Search className="w-4 h-4 mr-2" />Continue</>}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => { setMode("admin"); setLookupError(""); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <Building2 className="w-3 h-3" />
              Hospital Admin Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAFF: Step 2 — Role + Password (hospital name shown prominently) ────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{foundHospital?.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your staff credentials</p>
        </div>

        <form onSubmit={handleStaffLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-username">Username</Label>
            <Input
              id="s-username"
              autoComplete="username"
              value={staffUsername}
              onChange={e => setStaffUsername(e.target.value)}
              placeholder="nurse or receptionist"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-password">Password</Label>
            <Input
              id="s-password"
              type="password"
              autoComplete="current-password"
              value={staffPassword}
              onChange={e => setStaffPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {staffError && <p className="text-sm text-destructive">{staffError}</p>}

          <Button type="submit" className="w-full" disabled={staffLoading}>
            {staffLoading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
              : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setStaffStep("lookup"); setFoundHospital(null); setStaffError(""); setStaffUsername(""); setStaffPassword(""); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeft className="w-3 h-3" />
            Not {foundHospital?.name}? Go back
          </button>
        </div>
      </div>
    </div>
  );
}
