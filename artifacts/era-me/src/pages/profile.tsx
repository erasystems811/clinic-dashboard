import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Link, useLocation } from "wouter";
import { Crown, LogOut, ChevronRight, Check, ChevronDown } from "lucide-react";

const THEMES = [
  { id: "teal",   label: "Teal",   bg: "linear-gradient(135deg,#0d9488,#14b8a6)", accent: "#14b8a6" },
  { id: "blue",   label: "Blue",   bg: "linear-gradient(135deg,#1d4ed8,#3b82f6)", accent: "#3b82f6" },
  { id: "purple", label: "Purple", bg: "linear-gradient(135deg,#7c3aed,#a78bfa)", accent: "#a78bfa" },
  { id: "green",  label: "Green",  bg: "linear-gradient(135deg,#15803d,#22c55e)", accent: "#22c55e" },
  { id: "orange", label: "Sunset", bg: "linear-gradient(135deg,#c2410c,#f97316)", accent: "#f97316" },
  { id: "rose",   label: "Pink",   bg: "linear-gradient(135deg,#be185d,#ec4899)", accent: "#ec4899" },
  { id: "slate",  label: "Silver", bg: "linear-gradient(135deg,#475569,#94a3b8)", accent: "#94a3b8" },
] as const;

type ThemeId = typeof THEMES[number]["id"];
type Section = "username" | "nickname" | "password" | "feedback" | null;

export default function ProfilePage() {
  const { account, logout, updateAccount, loading } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const isPremium = account?.isPremium ?? false;

  // Inline section — only one open at a time
  const [activeSection, setActiveSection] = useState<Section>(null);
  function toggleSection(s: Section) {
    setActiveSection((prev) => (prev === s ? null : s));
  }

  // Username
  const [newUsername, setNewUsername]   = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameOk, setUsernameOk]     = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Nickname
  const [newNickname, setNewNickname]     = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameOk, setNicknameOk]       = useState(false);
  const [nicknameLoading, setNicknameLoading] = useState(false);

  // Password
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew]         = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError]     = useState("");
  const [pwdOk, setPwdOk]           = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Feedback
  const [fbRating, setFbRating]       = useState(0);
  const [fbCategory, setFbCategory]   = useState<"general" | "bug" | "feature" | "praise">("general");
  const [fbMessage, setFbMessage]     = useState("");
  const [fbLoading, setFbLoading]     = useState(false);
  const [fbDone, setFbDone]           = useState(false);

  async function handleChangePassword() {
    setPwdError("");
    if (pwdNew.length < 8) { setPwdError("New password must be at least 8 characters"); return; }
    if (pwdNew !== pwdConfirm) { setPwdError("Passwords don't match"); return; }
    setPwdLoading(true);
    try {
      await apiFetch("/api/patient-app/me", { method: "PATCH", auth: true, body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }) });
      setPwdOk(true);
      setTimeout(() => { setActiveSection(null); setPwdOk(false); setPwdCurrent(""); setPwdNew(""); setPwdConfirm(""); }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setPwdError(msg.includes("{") ? "Current password is incorrect" : msg);
    } finally { setPwdLoading(false); }
  }

  async function handleChangeUsername() {
    setUsernameError("");
    const val = newUsername.trim().toLowerCase();
    if (!val) { setUsernameError("Please enter a username"); return; }
    if (val.length < 3) { setUsernameError("Username must be at least 3 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameError("Only letters, numbers and underscores allowed"); return; }
    if (val === account?.username) { setUsernameError("That's already your username"); return; }
    setUsernameLoading(true);
    try {
      await apiFetch("/api/patient-app/me", { method: "PATCH", auth: true, body: JSON.stringify({ username: val }) });
      updateAccount({ username: val });
      setUsernameOk(true);
      setTimeout(() => { setActiveSection(null); setUsernameOk(false); setNewUsername(""); }, 1500);
    } catch (e: unknown) {
      setUsernameError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setUsernameLoading(false); }
  }

  async function handleChangeNickname() {
    setNicknameError("");
    const val = newNickname.trim();
    if (!val) { setNicknameError("Please enter a nickname"); return; }
    if (val.length > 60) { setNicknameError("Nickname is too long"); return; }
    setNicknameLoading(true);
    try {
      await apiFetch("/api/patient-app/me", { method: "PATCH", auth: true, body: JSON.stringify({ displayName: val }) });
      updateAccount({ displayName: val });
      setNicknameOk(true);
      setTimeout(() => { setActiveSection(null); setNicknameOk(false); setNewNickname(""); }, 1500);
    } catch (e: unknown) {
      setNicknameError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setNicknameLoading(false); }
  }

  async function submitFeedback() {
    if (!fbMessage.trim()) return;
    setFbLoading(true);
    try {
      await apiFetch("/api/patient-app/feedback", {
        method: "POST", auth: true,
        body: JSON.stringify({ rating: fbRating || undefined, category: fbCategory, message: fbMessage.trim() }),
      });
      setFbDone(true);
      setTimeout(() => { setActiveSection(null); setFbDone(false); setFbRating(0); setFbMessage(""); }, 2000);
    } catch { /* ignore */ }
    finally { setFbLoading(false); }
  }

  async function handleTheme(color: ThemeId) {
    updateAccount({ themeColor: color });
    setSaving(true);
    try {
      await apiFetch("/api/patient-app/me", { method: "PATCH", auth: true, body: JSON.stringify({ themeColor: color }) });
    } finally { setSaving(false); }
  }

  async function handleDarkMode(dark: boolean) {
    updateAccount({ darkMode: dark });
    setSaving(true);
    try {
      await apiFetch("/api/patient-app/me", { method: "PATCH", auth: true, body: JSON.stringify({ darkMode: dark }) });
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!account) return null;

  return (
    <div className="px-5 pt-6 pb-12">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-main)" }}>Profile</h1>

      {/* Account card */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.4)` }}>
            <span className="font-bold text-white text-2xl">
              {(account.displayName ?? account.username)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: "var(--text-main)" }}>{account.displayName ?? account.username}</p>
            <p className="text-sm truncate" style={{ color: "var(--text-sub)" }}>@{account.username}</p>
            <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{account.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Crown style={{ width: 14, height: 14, color: isPremium ? "#fbbf24" : "var(--text-dim)" }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: isPremium ? "#fbbf24" : "var(--text-dim)" }}>
            {isPremium ? "Premium Member" : "Free Plan"}
          </p>
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
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>App Colour & Mood</p>
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {THEMES.map((t) => {
              const active = (account.themeColor ?? "teal") === t.id;
              return (
                <button key={t.id} onClick={() => handleTheme(t.id)} className="flex flex-col items-center gap-1.5 transition active:scale-90">
                  <div className="relative w-12 h-12 rounded-xl"
                    style={{ background: t.bg, border: active ? `2.5px solid ${t.accent}` : "2px solid var(--glass-border)", boxShadow: active ? `0 0 14px ${t.accent}70` : "none" }}>
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-sub)" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([{ dark: true, label: "🌙 Dark" }, { dark: false, label: "☀️ Light" }] as const).map(({ dark, label }) => {
              const active = (account.darkMode ?? true) === dark;
              return (
                <button key={label} onClick={() => handleDarkMode(dark)}
                  className="py-3 rounded-xl text-sm font-bold transition active:scale-95"
                  style={{
                    background: active ? "var(--accent-tint-bg)" : "var(--glass-bg)",
                    border: active ? "1.5px solid var(--accent-tint-border)" : "1.5px solid var(--glass-border)",
                    color: active ? "var(--accent)" : "var(--text-sub)",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
          {saving && <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>Saving…</p>}
        </div>
      </div>

      {/* Account settings — inline expandable forms */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Account</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>

          {/* Change Username */}
          <ExpandRow
            label="Change Username"
            sublabel={`@${account.username}`}
            open={activeSection === "username"}
            onToggle={() => { setUsernameError(""); setUsernameOk(false); setNewUsername(""); toggleSection("username"); }}>
            <p className="text-xs mb-2" style={{ color: "var(--text-sub)" }}>
              Current: <span className="font-semibold" style={{ color: "var(--text-main)" }}>@{account.username}</span>
            </p>
            <input
              type="text" maxLength={30} autoComplete="username"
              value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="new_username"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-1"
              style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>Letters, numbers and underscores only · 3–30 characters</p>
            {usernameError && <p className="text-xs mb-2 font-medium" style={{ color: "#f87171" }}>{usernameError}</p>}
            {usernameOk && <p className="text-xs mb-2 font-medium" style={{ color: "#4ade80" }}>Username updated!</p>}
            <button onClick={() => void handleChangeUsername()} disabled={usernameLoading || !newUsername.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {usernameLoading ? "Saving…" : "Update Username"}
            </button>
          </ExpandRow>

          {/* Change Nickname */}
          <ExpandRow
            label="Change Nickname"
            sublabel={account.displayName ?? "Not set"}
            open={activeSection === "nickname"}
            onToggle={() => { setNicknameError(""); setNicknameOk(false); setNewNickname(account.displayName ?? ""); toggleSection("nickname"); }}>
            <p className="text-xs mb-2" style={{ color: "var(--text-sub)" }}>This is the name shown across the app.</p>
            <input
              type="text" maxLength={60} autoComplete="name"
              value={newNickname} onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-3"
              style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
            {nicknameError && <p className="text-xs mb-2 font-medium" style={{ color: "#f87171" }}>{nicknameError}</p>}
            {nicknameOk && <p className="text-xs mb-2 font-medium" style={{ color: "#4ade80" }}>Nickname updated!</p>}
            <button onClick={() => void handleChangeNickname()} disabled={nicknameLoading || !newNickname.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {nicknameLoading ? "Saving…" : "Update Nickname"}
            </button>
          </ExpandRow>

          {/* Change Password */}
          <ExpandRow
            label="Change Password"
            open={activeSection === "password"}
            onToggle={() => { setPwdError(""); setPwdOk(false); setPwdCurrent(""); setPwdNew(""); setPwdConfirm(""); toggleSection("password"); }}>
            <div className="space-y-3 mb-3">
              {([
                { lbl: "Current password", val: pwdCurrent, set: setPwdCurrent },
                { lbl: "New password (min 8 characters)", val: pwdNew, set: setPwdNew },
                { lbl: "Confirm new password", val: pwdConfirm, set: setPwdConfirm },
              ] as const).map(({ lbl, val, set }) => (
                <div key={lbl}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-sub)" }}>{lbl}</p>
                  <input type="password" value={val} onChange={(e) => set(e.target.value)} placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
                </div>
              ))}
            </div>
            {pwdError && <p className="text-xs mb-2 font-medium" style={{ color: "#f87171" }}>{pwdError}</p>}
            {pwdOk && <p className="text-xs mb-2 font-medium" style={{ color: "#4ade80" }}>Password changed!</p>}
            <button onClick={() => void handleChangePassword()} disabled={pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {pwdLoading ? "Saving…" : "Update Password"}
            </button>
          </ExpandRow>

          {/* Send Feedback */}
          <ExpandRow
            label="Send Feedback"
            sublabel="Rate the app or report an issue"
            open={activeSection === "feedback"}
            onToggle={() => { setFbDone(false); setFbRating(0); setFbMessage(""); toggleSection("feedback"); }}
            last>
            {fbDone ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <p style={{ fontSize: 36 }}>🙏</p>
                <p className="font-semibold text-sm text-center" style={{ color: "var(--text-main)" }}>Thank you for your feedback!</p>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <p className="text-xs mb-2" style={{ color: "var(--text-sub)" }}>How are you finding ERA Health?</p>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} onClick={() => setFbRating(s === fbRating ? 0 : s)}
                        className="text-2xl transition active:scale-110"
                        style={{ opacity: fbRating === 0 || s <= fbRating ? 1 : 0.35 }}>⭐</button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-xs mb-2" style={{ color: "var(--text-sub)" }}>Category</p>
                  <div className="flex flex-wrap gap-2">
                    {(["general", "praise", "feature", "bug"] as const).map((c) => (
                      <button key={c} onClick={() => setFbCategory(c)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95"
                        style={{
                          background: fbCategory === c ? "var(--accent-tint-bg)" : "var(--glass-bg)",
                          border: fbCategory === c ? "1.5px solid var(--accent)" : "1.5px solid var(--glass-border)",
                          color: fbCategory === c ? "var(--accent)" : "var(--text-sub)",
                        }}>
                        {c === "general" ? "General" : c === "praise" ? "Love it" : c === "feature" ? "Feature idea" : "Bug report"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-xs mb-2" style={{ color: "var(--text-sub)" }}>Your message</p>
                  <textarea value={fbMessage} onChange={(e) => setFbMessage(e.target.value)} rows={4}
                    placeholder="Tell us what you think…"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
                </div>
                <button onClick={() => void submitFeedback()} disabled={fbLoading || !fbMessage.trim()}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  {fbLoading ? "Sending…" : "Submit Feedback"}
                </button>
              </>
            )}
          </ExpandRow>

          {/* Notification settings — navigates away, no inline form needed */}
          <button onClick={() => navigate("/notification-settings")}
            className="w-full flex items-center justify-between px-5 py-4 transition active:opacity-70"
            style={{ borderTop: "1px solid var(--glass-border)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>Notification Settings</p>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-4 mt-2 rounded-2xl font-semibold text-sm transition active:scale-95"
        style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", background: "rgba(239,68,68,0.06)" }}>
        <LogOut className="w-4 h-4" />Sign Out
      </button>

      <p className="text-center text-xs mt-6" style={{ color: "var(--text-dim)" }}>ERA Health · By ERA Systems</p>
    </div>
  );
}

function ExpandRow({ label, sublabel, open, onToggle, children, last = false }: {
  label: string; sublabel?: string; open: boolean; onToggle: () => void;
  children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{ borderTop: last || open ? "1px solid var(--glass-border)" : undefined }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 transition active:opacity-70"
        style={{ borderBottom: open ? "1px solid var(--glass-border)" : "1px solid var(--glass-border)" }}>
        <div className="text-left">
          <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>{label}</p>
          {sublabel && <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>{sublabel}</p>}
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{ color: "var(--text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="px-5 py-4" style={{ background: "var(--bg-base)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

