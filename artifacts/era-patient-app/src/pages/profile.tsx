import { useState } from "react";
import { LogOut, Moon, Sun, ChevronRight, User, Users, KeyRound, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "blue",   label: "Blue",   class: "bg-blue-500"    },
  { key: "purple", label: "Purple", class: "bg-purple-500"  },
  { key: "green",  label: "Green",  class: "bg-emerald-500" },
  { key: "orange", label: "Orange", class: "bg-orange-500"  },
  { key: "teal",   label: "Teal",   class: "bg-teal-500"    },
  { key: "rose",   label: "Rose",   class: "bg-rose-500"    },
  { key: "slate",  label: "Slate",  class: "bg-slate-500"   },
] as const;

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden", className)}>
      {children}
    </div>
  );
}

function RowItem({ icon: Icon, label, value, onClick, danger }: {
  icon: React.ElementType; label: string; value?: string; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left",
        danger && "hover:bg-destructive/5"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
      <span className={cn("flex-1 text-sm font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {onClick && !danger && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border mx-4", className)} />;
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/patient-app/me/password", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-6 pb-10">
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6" />
        {done ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Password changed</h2>
            <p className="text-muted-foreground text-sm">Your new password is now active.</p>
            <button onClick={onClose} className="mt-6 w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl">Done</button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground mb-6">Change Password</h2>
            <div className="space-y-4">
              {[
                { label: "Current password", val: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                { label: "New password", val: next, set: setNext, show: showNext, toggle: () => setShowNext(v => !v) },
              ].map(({ label, val, set, show, toggle }) => (
                <div key={label}>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? "text" : "password"} value={val}
                      onChange={(e) => set(e.target.value)}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl border border-border bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="text-destructive text-sm mt-3 font-medium">{error}</p>}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleSubmit}
                disabled={!current || !next || loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
              <button onClick={onClose} className="w-full text-muted-foreground text-sm py-2">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { account, logout, updateAccount } = useAuth();
  const [showPasswordSheet, setShowPasswordSheet] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  async function handleTheme(color: string) {
    setSavingTheme(true);
    try {
      await apiFetch("/api/patient-app/me", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ themeColor: color }),
      });
      updateAccount({ themeColor: color });
    } catch { /* silent */ } finally {
      setSavingTheme(false);
    }
  }

  async function handleDarkMode(dark: boolean) {
    try {
      await apiFetch("/api/patient-app/me", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ darkMode: dark }),
      });
      updateAccount({ darkMode: dark });
    } catch { /* silent */ }
  }

  const initials = (account?.displayName ?? account?.username ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="px-5 pt-6 pb-4 max-w-lg mx-auto">

      {/* Avatar and name */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3 shadow-lg shadow-primary/20">
          {initials}
        </div>
        <h1 className="text-xl font-bold text-foreground">{account?.displayName ?? account?.username}</h1>
        <p className="text-sm text-muted-foreground">@{account?.username}</p>
        <span className={cn(
          "mt-2 text-xs font-semibold px-3 py-1 rounded-full",
          account?.accountType === "family" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
        )}>
          {account?.accountType === "family" ? "Family Account" : "Individual Account"}
        </span>
      </div>

      {/* Account info */}
      <div className="mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Account</p>
        <SectionCard>
          <RowItem icon={User} label="Email" value={account?.email} />
          <Divider />
          <RowItem icon={Users} label="Account type" value={account?.accountType === "family" ? "Family" : "Individual"} />
          <Divider />
          <RowItem icon={KeyRound} label="Change Password" onClick={() => setShowPasswordSheet(true)} />
        </SectionCard>
      </div>

      {/* Colour theme */}
      <div className="mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Appearance</p>
        <SectionCard className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Colour theme</p>
          <div className="flex items-center gap-2.5 flex-wrap">
            {THEMES.map(({ key, label, class: cls }) => (
              <button
                key={key}
                onClick={() => handleTheme(key)}
                disabled={savingTheme}
                title={label}
                className={cn(
                  "w-9 h-9 rounded-xl transition-all active:scale-90",
                  cls,
                  account?.themeColor === key && "ring-2 ring-offset-2 ring-foreground scale-110"
                )}
              />
            ))}
          </div>
          <Divider className="my-4 mx-0" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {account?.darkMode ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
              <span className="text-sm font-medium text-foreground">{account?.darkMode ? "Dark mode" : "Light mode"}</span>
            </div>
            <button
              onClick={() => handleDarkMode(!account?.darkMode)}
              className={cn(
                "w-12 h-6 rounded-full transition-all",
                account?.darkMode ? "bg-primary" : "bg-border"
              )}
            >
              <div className={cn("w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5", account?.darkMode ? "translate-x-6" : "translate-x-0")} />
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Logout */}
      <div className="mb-4">
        <SectionCard>
          <RowItem icon={LogOut} label="Sign Out" onClick={logout} danger />
        </SectionCard>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">ERA Patient · v1.0</p>

      {showPasswordSheet && <ChangePasswordSheet onClose={() => setShowPasswordSheet(false)} />}
    </div>
  );
}
