import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

interface StaffCreds {
  nurseUsername: string;
  receptionistUsername: string;
}

export default function Settings() {
  const { hospital } = useAuth();
  const token = hospital?.token ?? "";

  const [creds, setCreds] = useState<StaffCreds | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(true);

  const [nursePass, setNursePass] = useState("");
  const [recepPass, setRecepPass] = useState("");
  const [showNurse, setShowNurse] = useState(false);
  const [showRecep, setShowRecep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/api/hospital/staff-credentials", {
      headers: { "x-hospital-token": token },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCreds(data); })
      .finally(() => setLoadingCreds(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nursePass && !recepPass) return;
    setSaveError("");
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (nursePass) body.nursePassword = nursePass;
      if (recepPass) body.receptionistPassword = recepPass;

      const res = await fetch("/api/hospital/staff-credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setNursePass("");
      setRecepPass("");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("Failed to update passwords. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage staff login credentials for your hospital</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff Login Credentials</CardTitle>
            <CardDescription>
              Update the passwords for nurse and receptionist logins. Usernames are fixed and cannot be changed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCreds ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading credentials…
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                {/* Nurse */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Nurse</Label>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                      {creds?.nurseUsername ?? "—"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nurse-pass" className="text-xs text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        id="nurse-pass"
                        type={showNurse ? "text" : "password"}
                        value={nursePass}
                        onChange={e => setNursePass(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNurse(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNurse ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Receptionist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Receptionist</Label>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                      {creds?.receptionistUsername ?? "—"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recep-pass" className="text-xs text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        id="recep-pass"
                        type={showRecep ? "text" : "password"}
                        value={recepPass}
                        onChange={e => setRecepPass(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRecep(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRecep ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {saveError && <p className="text-sm text-destructive">{saveError}</p>}

                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" disabled={saving || (!nursePass && !recepPass)}>
                    {saving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                      : "Save Changes"}
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1 text-sm text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </span>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Admin login password</span> is managed by Era Systems through the super admin panel and cannot be changed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
