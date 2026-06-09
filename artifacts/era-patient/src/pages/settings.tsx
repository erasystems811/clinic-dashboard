import { useState, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, UserPlus, Pencil, Users, Wallet, AlertCircle, Stethoscope, Trash2, Clock, Plus, Link2, Check, Shield } from "lucide-react";

interface StaffCreds {
  nurseUsername: string;
  receptionistUsername: string;
}

interface StaffMember {
  id: number;
  fullName: string;
  username: string;
  role: "nurse" | "receptionist";
  active: boolean;
  createdAt: string;
}

interface TimeBlock {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

interface AdminMember {
  id: number;
  fullName: string;
  email: string;
  username: string;
  active: boolean;
  createdAt: string;
}

interface DoctorMember {
  id: number;
  fullName: string;
  email: string;
  specialty: string | null;
  username: string;
  active: boolean;
  unavailable: boolean;
}

const ROLE_LABEL: Record<string, string> = { nurse: "Nurse", receptionist: "Receptionist" };

export default function Settings() {
  const { hospital } = useAuth();
  const token = hospital?.token ?? "";

  // ── Admin accounts ────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addAdminError, setAddAdminError] = useState("");
  const [addAdminSaving, setAddAdminSaving] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<number | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminSaving, setEditAdminSaving] = useState(false);
  const [editAdminError, setEditAdminError] = useState("");

  const loadAdmins = () => {
    if (!token) return;
    setLoadingAdmins(true);
    fetch(apiUrl("/api/hospital/admins"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : [])
      .then((data: AdminMember[]) => setAdmins(data))
      .finally(() => setLoadingAdmins(false));
  };

  useEffect(() => { loadAdmins(); }, [token]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminEmail.trim()) return;
    setAddAdminError(""); setAddAdminSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/admins"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ fullName: newAdminName.trim(), email: newAdminEmail.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewAdminName(""); setNewAdminEmail("");
      setShowAddAdminForm(false);
      loadAdmins();
    } catch (err: unknown) {
      setAddAdminError(err instanceof Error ? err.message : "Failed to add admin.");
    } finally { setAddAdminSaving(false); }
  };

  const handleDeleteAdmin = async (id: number) => {
    setDeletingAdminId(id);
    await fetch(apiUrl(`/api/hospital/admins/${id}`), { method: "DELETE", headers: { "x-hospital-token": token } });
    setDeletingAdminId(null);
    loadAdmins();
  };

  const startEditAdmin = (a: AdminMember) => {
    setEditingAdminId(a.id); setEditAdminName(a.fullName); setEditAdminEmail(a.email); setEditAdminPassword(""); setEditAdminError("");
  };

  const handleEditAdmin = async (id: number) => {
    setEditAdminError(""); setEditAdminSaving(true);
    try {
      const body: Record<string, unknown> = { fullName: editAdminName, email: editAdminEmail };
      if (editAdminPassword) body.password = editAdminPassword;
      const res = await fetch(apiUrl(`/api/hospital/admins/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditingAdminId(null);
      loadAdmins();
    } catch (err: unknown) {
      setEditAdminError(err instanceof Error ? err.message : "Failed to update.");
    } finally { setEditAdminSaving(false); }
  };

  // ── Legacy shared credentials ─────────────────────────────────────────────
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
    fetch(apiUrl("/api/hospital/staff-credentials"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCreds(data); })
      .finally(() => setLoadingCreds(false));
  }, [token]);

  const handleSaveLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nursePass && !recepPass) return;
    setSaveError(""); setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (nursePass) body.nursePassword = nursePass;
      if (recepPass) body.receptionistPassword = recepPass;
      const res = await fetch(apiUrl("/api/hospital/staff-credentials"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      setSaved(true); setNursePass(""); setRecepPass("");
      setTimeout(() => setSaved(false), 3000);
    } catch { setSaveError("Failed to update passwords."); }
    finally { setSaving(false); }
  };

  // ── Individual named staff accounts ──────────────────────────────────────
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"nurse" | "receptionist">("receptionist");
  const [showNewPass, setShowNewPass] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"nurse" | "receptionist">("receptionist");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingStaffId, setDeletingStaffId] = useState<number | null>(null);

  const loadStaff = () => {
    if (!token) return;
    setLoadingStaff(true);
    fetch(apiUrl("/api/hospital/staff"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setStaff((data as Record<string, unknown>[]).map(s => ({
        id: s.id as number,
        fullName: s.full_name as string,
        username: s.username as string,
        role: s.role as "nurse" | "receptionist",
        active: s.active as boolean,
        createdAt: s.created_at as string,
      }))))
      .finally(() => setLoadingStaff(false));
  };

  useEffect(() => { loadStaff(); }, [token]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) return;
    setAddError(""); setAddSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/staff"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ fullName: newName.trim(), username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewName(""); setNewUsername(""); setNewPassword(""); setNewRole("receptionist");
      setShowAddForm(false);
      loadStaff();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add staff member.");
    } finally { setAddSaving(false); }
  };

  const startEdit = (s: StaffMember) => {
    setEditingId(s.id); setEditName(s.fullName); setEditRole(s.role); setEditPassword(""); setEditError("");
  };

  const handleEditStaff = async (id: number) => {
    setEditError(""); setEditSaving(true);
    try {
      const body: Record<string, unknown> = { fullName: editName, role: editRole };
      if (editPassword) body.password = editPassword;
      const res = await fetch(apiUrl(`/api/hospital/staff/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditingId(null);
      loadStaff();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update.");
    } finally { setEditSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    await fetch(apiUrl(`/api/hospital/staff/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-hospital-token": token },
      body: JSON.stringify({ active: false }),
    });
    loadStaff();
  };

  const handleReactivate = async (id: number) => {
    await fetch(apiUrl(`/api/hospital/staff/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-hospital-token": token },
      body: JSON.stringify({ active: true }),
    });
    loadStaff();
  };

  const handleDeleteStaff = async (id: number) => {
    if (!window.confirm("Remove this staff member? This cannot be undone.")) return;
    setDeletingStaffId(id);
    await fetch(apiUrl(`/api/hospital/staff/${id}`), {
      method: "DELETE",
      headers: { "x-hospital-token": token },
    });
    setDeletingStaffId(null);
    loadStaff();
  };

  // ── Doctors ───────────────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState<DoctorMember[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [showAddDoctorForm, setShowAddDoctorForm] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorEmail, setNewDoctorEmail] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [addDoctorError, setAddDoctorError] = useState("");
  const [addDoctorSaving, setAddDoctorSaving] = useState(false);
  const [deletingDoctorId, setDeletingDoctorId] = useState<number | null>(null);
  const [deleteDoctorError, setDeleteDoctorError] = useState<Record<number, string>>({});
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editDoctorEmail, setEditDoctorEmail] = useState("");
  const [editDoctorSpecialty, setEditDoctorSpecialty] = useState("");
  const [editDoctorSaving, setEditDoctorSaving] = useState(false);
  const [editDoctorError, setEditDoctorError] = useState("");

  const loadDoctors = () => {
    if (!token) return;
    setLoadingDoctors(true);
    fetch(apiUrl("/api/hospital/doctors"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : [])
      .then((data: DoctorMember[]) => setDoctors(data))
      .finally(() => setLoadingDoctors(false));
  };

  useEffect(() => { loadDoctors(); }, [token]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctorName.trim() || !newDoctorEmail.trim()) return;
    setAddDoctorError(""); setAddDoctorSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/doctors"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ fullName: newDoctorName.trim(), email: newDoctorEmail.trim(), specialty: newDoctorSpecialty.trim() || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewDoctorName(""); setNewDoctorEmail(""); setNewDoctorSpecialty("");
      setShowAddDoctorForm(false);
      loadDoctors();
    } catch (err: unknown) {
      setAddDoctorError(err instanceof Error ? err.message : "Failed to add doctor.");
    } finally { setAddDoctorSaving(false); }
  };

  const handleDeleteDoctor = async (id: number) => {
    setDeletingDoctorId(id);
    setDeleteDoctorError(prev => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(apiUrl(`/api/hospital/doctors/${id}`), {
        method: "DELETE",
        headers: { "x-hospital-token": token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to delete");
      }
      loadDoctors();
    } catch (err: unknown) {
      setDeleteDoctorError(prev => ({ ...prev, [id]: err instanceof Error ? err.message : "Delete failed" }));
    } finally { setDeletingDoctorId(null); }
  };

  const startEditDoctor = (d: DoctorMember) => {
    setEditingDoctorId(d.id);
    setEditDoctorName(d.fullName);
    setEditDoctorEmail(d.email);
    setEditDoctorSpecialty(d.specialty ?? "");
    setEditDoctorError("");
  };

  const handleEditDoctor = async (id: number) => {
    setEditDoctorError(""); setEditDoctorSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/hospital/doctors/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ fullName: editDoctorName.trim(), email: editDoctorEmail.trim(), specialty: editDoctorSpecialty.trim() || null }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditingDoctorId(null);
      loadDoctors();
    } catch (err: unknown) {
      setEditDoctorError(err instanceof Error ? err.message : "Failed to update.");
    } finally { setEditDoctorSaving(false); }
  };

  // ── Online Booking Time Blocks ────────────────────────────────────────────────
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [showAddBlockForm, setShowAddBlockForm] = useState(false);
  const [newBlockDay, setNewBlockDay] = useState("1");
  const [newBlockStart, setNewBlockStart] = useState("09:00");
  const [newBlockEnd, setNewBlockEnd] = useState("17:00");
  const [addBlockError, setAddBlockError] = useState("");
  const [addBlockSaving, setAddBlockSaving] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const loadTimeBlocks = () => {
    if (!token) return;
    setLoadingBlocks(true);
    fetch(apiUrl("/api/hospital/time-blocks"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : [])
      .then((data: TimeBlock[]) => setTimeBlocks(data))
      .finally(() => setLoadingBlocks(false));
  };

  useEffect(() => { loadTimeBlocks(); }, [token]);

  const handleAddTimeBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddBlockError(""); setAddBlockSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hospital/time-blocks"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ dayOfWeek: parseInt(newBlockDay), startTime: newBlockStart, endTime: newBlockEnd, slotMinutes: 30 }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setShowAddBlockForm(false);
      loadTimeBlocks();
    } catch (err: unknown) {
      setAddBlockError(err instanceof Error ? err.message : "Failed to add time block.");
    } finally { setAddBlockSaving(false); }
  };

  const handleDeleteTimeBlock = async (id: number) => {
    setDeletingBlockId(id);
    await fetch(apiUrl(`/api/hospital/time-blocks/${id}`), {
      method: "DELETE",
      headers: { "x-hospital-token": token },
    });
    setDeletingBlockId(null);
    loadTimeBlocks();
  };

  // ── Wallet ───────────────────────────────────────────────────────────────────
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [fundAmount, setFundAmount] = useState("1000");
  const [fundingUrl, setFundingUrl] = useState<string | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState("");
  const balancePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const balancePollStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWalletBalance = () => {
    if (!token) return;
    fetch(apiUrl("/api/wallet/balance"), { headers: { "x-hospital-token": token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWalletBalance(data.balanceNaira as number); });
  };

  useEffect(() => {
    loadWalletBalance();
    if (typeof window !== "undefined" && window.location.search.includes("wallet_funded=1")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("wallet_funded");
      window.history.replaceState({}, "", url.toString());
    }
    return () => {
      if (balancePollRef.current) clearInterval(balancePollRef.current);
      if (balancePollStopRef.current) clearTimeout(balancePollStopRef.current);
    };
  }, [token]);

  const handleFundWallet = async () => {
    setFundingError(""); setFundingLoading(true);
    try {
      const amount = parseInt(fundAmount, 10);
      if (!amount || amount < 500) { setFundingError("Minimum amount is ₦500"); setFundingLoading(false); return; }
      const res = await fetch(apiUrl("/api/wallet/fund/initiate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hospital-token": token },
        body: JSON.stringify({ amountNaira: amount }),
      });
      const data = await res.json() as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) throw new Error(data.error ?? "Failed to create payment link");
      window.open(data.paymentUrl, "_blank");
      setFundingUrl(data.paymentUrl);
      // Poll balance every 5s for 2 minutes to catch the webhook credit automatically
      if (balancePollRef.current) clearInterval(balancePollRef.current);
      if (balancePollStopRef.current) clearTimeout(balancePollStopRef.current);
      balancePollRef.current = setInterval(loadWalletBalance, 5000);
      balancePollStopRef.current = setTimeout(() => {
        if (balancePollRef.current) { clearInterval(balancePollRef.current); balancePollRef.current = null; }
      }, 120000);
    } catch (err: unknown) {
      setFundingError(err instanceof Error ? err.message : "Failed");
    } finally { setFundingLoading(false); }
  };

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage staff accounts and login credentials</p>
        </div>

        {/* ── Admin Accounts ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Admin Accounts
                </CardTitle>
                <CardDescription className="mt-1">
                  Add additional admin logins for your hospital. Each admin gets their own username and password — their name appears in activity logs so you can see who did what.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setShowAddAdminForm(true); setAddAdminError(""); }}>
                <UserPlus className="w-3.5 h-3.5" />
                Add Admin
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddAdminForm && (
              <form onSubmit={handleAddAdmin} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">New Admin Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Full Name *</Label>
                    <Input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="e.g. Grace Okonkwo" required />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Email Address *</Label>
                    <Input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@example.com" required />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">A username and password will be auto-generated and emailed to them.</p>
                {addAdminError && <p className="text-xs text-destructive">{addAdminError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddAdminForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={addAdminSaving}>
                    {addAdminSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding…</> : "Add Admin"}
                  </Button>
                </div>
              </form>
            )}

            {loadingAdmins ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No additional admin accounts yet. The master admin login from your ERA Systems setup still works.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {admins.map(a => (
                  <div key={a.id} className={`px-4 py-3 ${!a.active ? "opacity-50" : ""}`}>
                    {editingAdminId === a.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">Full Name</Label>
                            <Input value={editAdminName} onChange={e => setEditAdminName(e.target.value)} />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">Email</Label>
                            <Input type="email" value={editAdminEmail} onChange={e => setEditAdminEmail(e.target.value)} />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></Label>
                            <Input type="password" value={editAdminPassword} onChange={e => setEditAdminPassword(e.target.value)} placeholder="Leave blank to keep" />
                          </div>
                        </div>
                        {editAdminError && <p className="text-xs text-destructive">{editAdminError}</p>}
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingAdminId(null)}>Cancel</Button>
                          <Button size="sm" disabled={editAdminSaving} onClick={() => handleEditAdmin(a.id)}>
                            {editAdminSaving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-500/10 text-violet-400 font-bold text-sm flex items-center justify-center shrink-0">
                          {a.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{a.username}</span>
                            <span className="text-xs px-1.5 py-px rounded bg-violet-500/10 text-violet-400">Admin</span>
                            {!a.active && <span className="text-xs text-destructive">Inactive</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.email}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEditAdmin(a)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(a.id)}
                            disabled={deletingAdminId === a.id}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-40"
                            title="Remove admin"
                          >
                            {deletingAdminId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Individual Staff Accounts ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Staff Accounts
                </CardTitle>
                <CardDescription className="mt-1">
                  Create individual named accounts for each staff member. They log in with their own username and password — every action they take is recorded under their name.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setShowAddForm(true); setAddError(""); }}>
                <UserPlus className="w-3.5 h-3.5" />
                Add Staff
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add form */}
            {showAddForm && (
              <form onSubmit={handleAddStaff} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">New Staff Member</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Full Name *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mary Adeyemi" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Username *</Label>
                    <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. MARY.NURSE" required />
                    <p className="text-[10px] text-muted-foreground">They'll type this to log in</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Role *</Label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={newRole} onChange={e => setNewRole(e.target.value as "nurse" | "receptionist")}>
                      <option value="receptionist">Receptionist</option>
                      <option value="nurse">Nurse</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Password *</Label>
                    <div className="relative">
                      <Input type={showNewPass ? "text" : "password"} value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} placeholder="Set a password" className="pr-10" required />
                      <button type="button" onClick={() => setShowNewPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {addError && <p className="text-xs text-destructive">{addError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={addSaving}>
                    {addSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding…</> : "Add Staff Member"}
                  </Button>
                </div>
              </form>
            )}

            {/* Staff list */}
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : staff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No individual accounts yet. Add staff members above.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {staff.map(s => (
                  <div key={s.id} className={`px-4 py-3 ${!s.active ? "opacity-50" : ""}`}>
                    {editingId === s.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Full Name</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Role</Label>
                            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                              value={editRole} onChange={e => setEditRole(e.target.value as "nurse" | "receptionist")}>
                              <option value="receptionist">Receptionist</option>
                              <option value="nurse">Nurse</option>
                            </select>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></Label>
                            <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep" />
                          </div>
                        </div>
                        {editError && <p className="text-xs text-destructive">{editError}</p>}
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button size="sm" disabled={editSaving} onClick={() => handleEditStaff(s.id)}>
                            {editSaving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                          {s.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{s.username}</span>
                            <span className="text-xs px-1.5 py-px rounded bg-muted text-muted-foreground">{ROLE_LABEL[s.role]}</span>
                            {!s.active && <span className="text-xs text-destructive">Inactive</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(s.id)}
                            disabled={deletingStaffId === s.id}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-40"
                            title="Remove staff member"
                          >
                            {deletingStaffId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Doctors ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> Doctors
                </CardTitle>
                <CardDescription className="mt-1">
                  Add doctors to the system. They receive a login invitation by email and get their own view showing their queue and appointments.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setShowAddDoctorForm(true); setAddDoctorError(""); }}>
                <UserPlus className="w-3.5 h-3.5" />
                Add Doctor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddDoctorForm && (
              <form onSubmit={handleAddDoctor} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">New Doctor</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Full Name *</Label>
                    <Input value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} placeholder="e.g. James Okafor" required />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-xs">Email Address *</Label>
                    <Input type="email" value={newDoctorEmail} onChange={e => setNewDoctorEmail(e.target.value)} placeholder="doctor@example.com" required />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-xs">Specialty <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input value={newDoctorSpecialty} onChange={e => setNewDoctorSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">A username and password will be auto-generated and sent to the doctor's email.</p>
                {addDoctorError && <p className="text-xs text-destructive">{addDoctorError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddDoctorForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={addDoctorSaving}>
                    {addDoctorSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Adding…</> : "Add Doctor"}
                  </Button>
                </div>
              </form>
            )}

            {loadingDoctors ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : doctors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No doctors added yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {doctors.map(d => (
                  <div key={d.id} className="px-4 py-3">
                    {editingDoctorId === d.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs">Full Name</Label>
                            <Input value={editDoctorName} onChange={e => setEditDoctorName(e.target.value)} placeholder="e.g. James Okafor" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email</Label>
                            <Input type="email" value={editDoctorEmail} onChange={e => setEditDoctorEmail(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Specialty</Label>
                            <Input value={editDoctorSpecialty} onChange={e => setEditDoctorSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
                          </div>
                        </div>
                        {editDoctorError && <p className="text-xs text-destructive">{editDoctorError}</p>}
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingDoctorId(null)}>Cancel</Button>
                          <Button size="sm" disabled={editDoctorSaving} onClick={() => handleEditDoctor(d.id)}>
                            {editDoctorSaving ? "Saving…" : "Save Changes"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                          {d.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Dr. {d.fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-muted-foreground">{d.username}</span>
                            {d.specialty && <span className="text-xs px-1.5 py-px rounded bg-muted text-muted-foreground">{d.specialty}</span>}
                            {d.unavailable && <span className="text-xs text-amber-500">Unavailable</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.email}</p>
                          {deleteDoctorError[d.id] && (
                            <p className="text-xs text-destructive mt-1">{deleteDoctorError[d.id]}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEditDoctor(d)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoctor(d.id)}
                            disabled={deletingDoctorId === d.id}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                            title="Remove doctor"
                          >
                            {deletingDoctorId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Online Booking Time Blocks ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Online Booking Schedule
                </CardTitle>
                <CardDescription className="mt-1">
                  Set the days and hours patients can book appointments online via your clinic's booking link. Each block defines a recurring weekly window.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setShowAddBlockForm(true); setAddBlockError(""); }}>
                <Plus className="w-3.5 h-3.5" />
                Add Window
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hospital?.slug && (
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex items-center gap-3">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Patient booking link</p>
                  <p className="text-xs font-mono truncate">{`${window.location.origin}/book/${hospital.slug}`}</p>
                </div>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/book/${hospital.slug}`);
                    setBookingLinkCopied(true);
                    setTimeout(() => setBookingLinkCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  {bookingLinkCopied ? <><Check className="w-3 h-3" />Copied</> : "Copy"}
                </button>
              </div>
            )}
            {showAddBlockForm && (
              <form onSubmit={handleAddTimeBlock} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold">New Availability Window</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Day of Week *</Label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={newBlockDay} onChange={e => setNewBlockDay(e.target.value)}>
                      {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Time *</Label>
                    <Input type="time" value={newBlockStart} onChange={e => setNewBlockStart(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Time *</Label>
                    <Input type="time" value={newBlockEnd} onChange={e => setNewBlockEnd(e.target.value)} required />
                  </div>
                </div>
                {addBlockError && <p className="text-xs text-destructive">{addBlockError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBlockForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={addBlockSaving}>
                    {addBlockSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Window"}
                  </Button>
                </div>
              </form>
            )}

            {loadingBlocks ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : timeBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No booking windows configured. Add one above to enable online booking.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {timeBlocks.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{DAY_NAMES[b.dayOfWeek]}</p>
                      <p className="text-xs text-muted-foreground">{b.startTime} – {b.endTime}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTimeBlock(b.id)}
                      disabled={deletingBlockId === b.id}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                    >
                      {deletingBlockId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Legacy shared credentials ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shared Login Credentials</CardTitle>
            <CardDescription>
              Legacy shared logins for hospitals not yet using individual accounts. If you've added individual staff accounts above, those are preferred.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCreds ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <form onSubmit={handleSaveLegacy} className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Nurse</Label>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{creds?.nurseUsername ?? "—"}</span>
                  </div>
                  <div className="relative">
                    <Input id="nurse-pass" type={showNurse ? "text" : "password"} value={nursePass}
                      onChange={e => setNursePass(e.target.value)} placeholder="Leave blank to keep current" className="pr-10" />
                    <button type="button" onClick={() => setShowNurse(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNurse ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="border-t border-border" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Receptionist</Label>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{creds?.receptionistUsername ?? "—"}</span>
                  </div>
                  <div className="relative">
                    <Input id="recep-pass" type={showRecep ? "text" : "password"} value={recepPass}
                      onChange={e => setRecepPass(e.target.value)} placeholder="Leave blank to keep current" className="pr-10" />
                    <button type="button" onClick={() => setShowRecep(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showRecep ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving || (!nursePass && !recepPass)}>
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
                  </Button>
                  {saved && <span className="flex items-center gap-1 text-sm text-emerald-500"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* ── SMS Wallet ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4" /> SMS Wallet
            </CardTitle>
            <CardDescription>
              Fund your wallet to enable SMS delivery for your automations. ₦7 is deducted per SMS sent. If your balance runs out, messages automatically fall back to email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Balance display */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Current balance</span>
              <span className={`text-lg font-bold tabular-nums ${walletBalance === null ? "text-muted-foreground" : walletBalance === 0 ? "text-red-400" : walletBalance < 100 ? "text-amber-400" : "text-emerald-400"}`}>
                {walletBalance === null ? "Loading…" : `₦${walletBalance.toLocaleString()}`}
              </span>
            </div>

            {/* Fund wallet */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="fund-amount" className="text-sm mb-1.5 block">Amount to add (₦)</Label>
                <Input
                  id="fund-amount"
                  type="number"
                  min={500}
                  step={500}
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <Button onClick={handleFundWallet} disabled={fundingLoading} className="shrink-0">
                {fundingLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening…</> : "Fund Wallet"}
              </Button>
              <Button variant="outline" size="sm" className="shrink-0" onClick={loadWalletBalance}>
                Refresh
              </Button>
            </div>

            {fundingError && (
              <div className="flex items-start gap-2 text-sm text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {fundingError}
              </div>
            )}
            {fundingUrl && (
              <p className="text-xs text-muted-foreground">
                Payment window opened. If it didn&apos;t open, <a href={fundingUrl} target="_blank" rel="noreferrer" className="text-primary underline">click here</a>. Refresh balance after payment.
              </p>
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
