import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Crown, Moon, Sun, LogOut, ChevronRight, Check } from "lucide-react";

const THEMES = [
  { id: "blue",   label: "Blue",   color: "bg-blue-500" },
  { id: "purple", label: "Purple", color: "bg-purple-500" },
  { id: "green",  label: "Green",  color: "bg-emerald-500" },
  { id: "orange", label: "Orange", color: "bg-orange-500" },
  { id: "teal",   label: "Teal",   color: "bg-teal-500" },
  { id: "rose",   label: "Rose",   color: "bg-rose-500" },
  { id: "slate",  label: "Slate",  color: "bg-slate-500" },
] as const;

type ThemeId = typeof THEMES[number]["id"];

export default function ProfilePage() {
  const { account, logout, updateAccount } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const isPremium = account?.isPremium ?? false;

  async function handleTheme(color: ThemeId) {
    updateAccount({ themeColor: color });
    setSaving(true);
    try {
      await apiFetch("/api/patient-app/me", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ themeColor: color }),
      });
    } finally { setSaving(false); }
  }

  async function handleDarkMode(dark: boolean) {
    updateAccount({ darkMode: dark });
    setSaving(true);
    try {
      await apiFetch("/api/patient-app/me", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ darkMode: dark }),
      });
    } finally { setSaving(false); }
  }

  if (!account) return null;

  return (
    <div className="px-5 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Profile</h1>

      {/* Account card */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-2xl">
            {(account.displayName ?? account.username)[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-base truncate">
            {account.displayName ?? account.username}
          </p>
          <p className="text-sm text-muted-foreground truncate">@{account.username}</p>
          <p className="text-xs text-muted-foreground truncate">{account.email}</p>
        </div>
        {isPremium && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full">
            <Crown className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Premium</span>
          </div>
        )}
      </div>

      {/* Premium upsell */}
      {!isPremium && (
        <Link href="/pricing">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3 mb-4 cursor-pointer active:scale-[0.98] transition">
            <Crown className="w-6 h-6 text-white shrink-0" />
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Upgrade to ERA Premium</p>
              <p className="text-white/80 text-xs">From ₦3,500/month</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
          </div>
        </Link>
      )}

      {/* Theme picker */}
      <Section title="App Theme">
        <div className="flex flex-wrap gap-3 pt-1">
          {THEMES.map((t) => {
            const active = (account.themeColor ?? "blue") === t.id;
            return (
              <button key={t.id} onClick={() => handleTheme(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition active:scale-95",
                )}>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition",
                  t.color,
                  active ? "border-foreground scale-110" : "border-transparent"
                )}>
                  {active && <Check className="w-4 h-4 text-white" />}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
        {saving && <p className="text-xs text-muted-foreground mt-2">Saving…</p>}
      </Section>

      {/* Dark mode */}
      <Section title="Appearance">
        <div className="flex gap-3">
          {[
            { dark: false, label: "Light", Icon: Sun },
            { dark: true,  label: "Dark",  Icon: Moon },
          ].map(({ dark, label, Icon }) => {
            const active = (account.darkMode ?? false) === dark;
            return (
              <button key={label} onClick={() => handleDarkMode(dark)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition text-sm font-semibold",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Women's Health */}
      <Section title="Women's Health">
        <div className="space-y-1">
          <SettingsRow label="Cycle & Period Tracker" sublabel="Track your cycle, fertile window & symptoms" onClick={() => navigate("/womens-health")} />
        </div>
      </Section>

      {/* Social */}
      <Section title="Social">
        <div className="space-y-1">
          <SettingsRow label="Accountability Partners" sublabel="Share streaks, stay motivated" onClick={() => navigate("/social")} />
        </div>
      </Section>

      {/* Private companion */}
      <Section title="Private">
        <div className="space-y-1">
          <SettingsRow label="My Companion" sublabel="Journal, AI chat & personality profile" onClick={() => navigate("/companion")} />
        </div>
      </Section>

      {/* Account settings */}
      <Section title="Account">
        <div className="space-y-1">
          <SettingsRow label="Change Password" onClick={() => {}} />
          <SettingsRow label="Notification Settings" onClick={() => {}} />
          {account.accountType === "family" && (
            <SettingsRow label="Manage Family Members" onClick={() => {}} />
          )}
        </div>
      </Section>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-4 mt-2 rounded-2xl border border-destructive/30 text-destructive font-semibold text-sm transition active:scale-95 hover:bg-destructive/5"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <p className="text-center text-xs text-muted-foreground mt-6">ERA Me · By Era Systems</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, sublabel, onClick }: { label: string; sublabel?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-foreground text-sm font-medium hover:text-primary transition border-b border-border last:border-0">
      <div className="text-left">
        <p>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground font-normal mt-0.5">{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
