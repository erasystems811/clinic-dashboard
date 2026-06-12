import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Crown, Moon, Sun, LogOut, ChevronRight, Check } from "lucide-react";
import { useCoins } from "@/lib/hospitals-api";

const THEMES = [
  { id: "teal",   label: "Teal",   bg: "linear-gradient(135deg,#0d9488,#14b8a6)", accent: "#14b8a6" },
  { id: "blue",   label: "Blue",   bg: "linear-gradient(135deg,#1d4ed8,#3b82f6)", accent: "#3b82f6" },
  { id: "purple", label: "Purple", bg: "linear-gradient(135deg,#7c3aed,#a78bfa)", accent: "#a78bfa" },
  { id: "green",  label: "Green",  bg: "linear-gradient(135deg,#15803d,#22c55e)", accent: "#22c55e" },
  { id: "orange", label: "Sunset", bg: "linear-gradient(135deg,#c2410c,#f97316)", accent: "#f97316" },
  { id: "rose",   label: "Rose",   bg: "linear-gradient(135deg,#be123c,#f43f5e)", accent: "#f43f5e" },
  { id: "slate",  label: "Silver", bg: "linear-gradient(135deg,#475569,#94a3b8)", accent: "#94a3b8" },
] as const;

type ThemeId = typeof THEMES[number]["id"];

export default function ProfilePage() {
  const { account, logout, updateAccount } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const isPremium = account?.isPremium ?? false;
  const { data: coinsData } = useCoins();
  const coins = coinsData?.coins ?? 0;

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
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-main)" }}>Profile</h1>

      {/* Account card */}
      <div className="rounded-2xl p-5 mb-4"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.4)` }}>
            <span className="font-bold text-white text-2xl">
              {(account.displayName ?? account.username)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base truncate">
              {account.displayName ?? account.username}
            </p>
            <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.45)" }}>@{account.username}</p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{account.email}</p>
          </div>
        </div>

        {/* Coins + premium row */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,rgba(146,64,14,0.3),rgba(217,119,6,0.2))", border: "1px solid rgba(217,119,6,0.3)" }}>
            <span style={{ fontSize: 18 }}>🪙</span>
            <div>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>{coins}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Health Coins
              </p>
            </div>
          </div>
          <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
            style={{ background: isPremium ? "linear-gradient(135deg,rgba(146,64,14,0.3),rgba(217,119,6,0.2))" : "rgba(255,255,255,0.04)", border: `1px solid ${isPremium ? "rgba(217,119,6,0.3)" : "rgba(255,255,255,0.08)"}` }}>
            <Crown style={{ width: 18, height: 18, color: isPremium ? "#fbbf24" : "rgba(255,255,255,0.25)" }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: isPremium ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
                {isPremium ? "Premium" : "Free"}
              </p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {isPremium ? "Member" : "Plan"}
              </p>
            </div>
          </div>
        </div>
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

      {/* Theme + appearance */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          App Colour & Mood
        </p>
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {THEMES.map((t) => {
              const active = (account.themeColor ?? "teal") === t.id;
              return (
                <button key={t.id} onClick={() => handleTheme(t.id)}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90">
                  <div className="relative w-12 h-12 rounded-xl"
                    style={{ background: t.bg,
                      border: active ? `2.5px solid ${t.accent}` : "2px solid rgba(255,255,255,0.1)",
                      boxShadow: active ? `0 0 14px ${t.accent}70` : "none" }}>
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold"
                    style={{ color: active ? "var(--accent)" : "rgba(255,255,255,0.4)" }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dark / Light */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { dark: true,  label: "🌙 Dark" },
              { dark: false, label: "☀️ Light" },
            ] as const).map(({ dark, label }) => {
              const active = (account.darkMode ?? true) === dark;
              return (
                <button key={label} onClick={() => handleDarkMode(dark)}
                  className="py-3 rounded-xl text-sm font-bold transition active:scale-95"
                  style={{
                    background: active ? `rgba(var(--glow-rgb),0.18)` : "rgba(255,255,255,0.05)",
                    border: active ? `1.5px solid rgba(var(--glow-rgb),0.5)` : "1.5px solid rgba(255,255,255,0.08)",
                    color: active ? "var(--accent)" : "rgba(255,255,255,0.4)",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {saving && <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>Saving…</p>}
        </div>
      </div>

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
          <SettingsRow label="My Companion" sublabel="Journal & personality profile" onClick={() => navigate("/companion")} />
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
      <button onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-4 mt-2 rounded-2xl font-semibold text-sm transition active:scale-95"
        style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", background: "rgba(239,68,68,0.06)" }}>
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.25)" }}>ERA Health · By ERA Systems</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        {title}
      </p>
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, sublabel, onClick }: { label: string; sublabel?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-sm font-medium transition"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--accent)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)")}>
      <div className="text-left">
        <p>{label}</p>
        {sublabel && <p className="text-xs font-normal mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
    </button>
  );
}
