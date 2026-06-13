import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Crown, LogOut, ChevronRight, Check } from "lucide-react";
import { useCoins } from "@/lib/hospitals-api";
import { isCompanionHidden, decodeGesture, useCompanionSettings, type GestureConfig } from "@/lib/companion-api";

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

export default function ProfilePage() {
  const { account, logout, updateAccount, loading } = useAuth();
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const isPremium = account?.isPremium ?? false;
  const { data: coinsData } = useCoins();
  const coins = coinsData?.coins ?? 0;

  // Secret diary gesture — coins element works here too
  const [gesture, setGesture] = useState<GestureConfig | null>(null);
  const tapRef = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({ count: 0, timer: null });
  const { data: companionSettings } = useCompanionSettings();

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) {
      setGesture(decodeGesture(raw));
    } else if (companionSettings?.isSetUp) {
      const g: GestureConfig = { element: companionSettings.gestureElement, count: companionSettings.gestureCount, hidden: companionSettings.isHidden };
      localStorage.setItem("era_companion_tab", JSON.stringify(g));
      setGesture(g);
    }
  }, [companionSettings]);

  function handleCoinsTap() {
    if (!gesture || gesture.element !== "coins") return;
    if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
    tapRef.current.count += 1;
    if (tapRef.current.count >= gesture.count) {
      tapRef.current = { count: 0, timer: null };
      navigate("/companion");
      return;
    }
    tapRef.current.timer = setTimeout(() => { tapRef.current = { count: 0, timer: null }; }, 1500);
  }

  // Feedback modal state
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbRating, setFbRating] = useState(0);
  const [fbCategory, setFbCategory] = useState<"general" | "bug" | "feature" | "praise">("general");
  const [fbMessage, setFbMessage] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [fbDone, setFbDone] = useState(false);

  async function submitFeedback() {
    if (!fbMessage.trim()) return;
    setFbLoading(true);
    try {
      await apiFetch("/api/patient-app/feedback", {
        method: "POST", auth: true,
        body: JSON.stringify({ rating: fbRating || undefined, category: fbCategory, message: fbMessage.trim() }),
      });
      setFbDone(true);
      setTimeout(() => { setShowFeedback(false); setFbDone(false); setFbRating(0); setFbMessage(""); }, 1800);
    } catch { /* ignore */ }
    finally { setFbLoading(false); }
  }

  const [showPwd, setShowPwd] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdOk, setPwdOk] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const pwdSheetRef = useRef<HTMLDivElement>(null);

  const [showUsername, setShowUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  const [showNickname, setShowNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameOk, setNicknameOk] = useState(false);
  const [nicknameLoading, setNicknameLoading] = useState(false);

  // Push the password sheet above the keyboard on iOS
  useEffect(() => {
    if (!showPwd) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      if (!pwdSheetRef.current) return;
      const kb = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      pwdSheetRef.current.style.marginBottom = kb + "px";
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [showPwd]);


  async function handleChangePassword() {
    setPwdError("");
    if (pwdNew.length < 8) { setPwdError("New password must be at least 8 characters"); return; }
    if (pwdNew !== pwdConfirm) { setPwdError("Passwords don't match"); return; }
    setPwdLoading(true);
    try {
      await apiFetch("/api/patient-app/me", {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNew }),
      });
      setPwdOk(true);
      setTimeout(() => { setShowPwd(false); setPwdOk(false); setPwdCurrent(""); setPwdNew(""); setPwdConfirm(""); }, 1500);
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
      setTimeout(() => { setShowUsername(false); setUsernameOk(false); setNewUsername(""); }, 1500);
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
      setTimeout(() => { setShowNickname(false); setNicknameOk(false); setNewNickname(""); }, 1500);
    } catch (e: unknown) {
      setNicknameError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setNicknameLoading(false); }
  }

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

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!account) return null;

  return (
    <>
    <div className="px-5 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-main)" }}>Profile</h1>

      {/* Account card */}
      <div className="rounded-2xl p-5 mb-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--btn-gradient)", boxShadow: `0 4px 16px rgba(var(--glow-rgb),0.4)` }}>
            <span className="font-bold text-white text-2xl">
              {(account.displayName ?? account.username)[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: "var(--text-main)" }}>
              {account.displayName ?? account.username}
            </p>
            <p className="text-sm truncate" style={{ color: "var(--text-sub)" }}>@{account.username}</p>
            <p className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{account.email}</p>
          </div>
        </div>

        {/* Coins + premium row */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,rgba(146,64,14,0.3),rgba(217,119,6,0.2))", border: "1px solid rgba(217,119,6,0.3)" }}
            onClick={handleCoinsTap}>
            <span style={{ fontSize: 18 }}>🪙</span>
            <div>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>{coins}</p>
              <p style={{ fontSize: 9, color: "var(--text-sub)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Health Coins
              </p>
            </div>
          </div>
          <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
            style={{ background: isPremium ? "linear-gradient(135deg,rgba(146,64,14,0.3),rgba(217,119,6,0.2))" : "var(--glass-bg)", border: `1px solid ${isPremium ? "rgba(217,119,6,0.3)" : "var(--glass-border)"}` }}>
            <Crown style={{ width: 18, height: 18, color: isPremium ? "#fbbf24" : "var(--text-dim)" }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: isPremium ? "#fbbf24" : "var(--text-sub)" }}>
                {isPremium ? "Premium" : "Free"}
              </p>
              <p style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>
          App Colour & Mood
        </p>
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {THEMES.map((t) => {
              const active = (account.themeColor ?? "teal") === t.id;
              return (
                <button key={t.id} onClick={() => handleTheme(t.id)}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90">
                  <div className="relative w-12 h-12 rounded-xl"
                    style={{ background: t.bg,
                      border: active ? `2.5px solid ${t.accent}` : "2px solid var(--glass-border)",
                      boxShadow: active ? `0 0 14px ${t.accent}70` : "none" }}>
                    {active && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold"
                    style={{ color: active ? "var(--accent)" : "var(--text-sub)" }}>
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

      {/* Premium Feature Cards */}
      <ProfileFeatureCards />

      {/* Account settings */}
      <Section title="Account">
        <div className="space-y-1">
          <SettingsRow label="Change Username" sublabel={`@${account.username}`} onClick={() => { setUsernameError(""); setUsernameOk(false); setNewUsername(""); setShowUsername(true); }} />
          <SettingsRow label="Change Nickname" sublabel={account.displayName ?? "Not set"} onClick={() => { setNicknameError(""); setNicknameOk(false); setNewNickname(account.displayName ?? ""); setShowNickname(true); }} />
          <SettingsRow label="Change Password" onClick={() => { setPwdError(""); setPwdOk(false); setShowPwd(true); }} />
          <SettingsRow label="Send Feedback" sublabel="Rate the app or report an issue" onClick={() => { setFbDone(false); setShowFeedback(true); }} />
          <SettingsRow label="Notification Settings" onClick={() => navigate("/notification-settings")} />
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

      <p className="text-center text-xs mt-6" style={{ color: "var(--text-dim)" }}>ERA Health · By ERA Systems</p>
    </div>

    {/* Feedback modal */}
    {showFeedback && (
      <div className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-md rounded-t-3xl flex flex-col"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "90dvh" }}>

          {/* Fixed header — never scrolls */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Send Feedback</p>
            <button onClick={() => setShowFeedback(false)} className="text-xl leading-none" style={{ color: "var(--text-dim)" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            {fbDone ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <p style={{ fontSize: 40 }}>🙏</p>
                <p className="font-semibold text-center" style={{ color: "var(--text-main)" }}>Thank you for your feedback!</p>
              </div>
            ) : (
              <>
                {/* Star rating */}
                <div className="mb-4">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>How are you finding ERA Health?</p>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} onClick={() => setFbRating(s === fbRating ? 0 : s)}
                        className="text-2xl transition active:scale-110"
                        style={{ opacity: fbRating === 0 || s <= fbRating ? 1 : 0.35 }}>
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="mb-4">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Category</p>
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

                {/* Message */}
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--text-sub)" }}>Your message</p>
                  <textarea value={fbMessage} onChange={(e) => setFbMessage(e.target.value)} rows={4}
                    placeholder="Tell us what you think…"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }} />
                </div>

                <button onClick={() => void submitFeedback()}
                  disabled={fbLoading || !fbMessage.trim()}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  {fbLoading ? "Sending…" : "Submit Feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Change username modal */}
    {showUsername && (
      <div className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-md rounded-t-3xl flex flex-col"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "90dvh" }}>
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Change Username</p>
            <button onClick={() => setShowUsername(false)} className="text-xl leading-none" style={{ color: "var(--text-dim)" }}>✕</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>
              Current: <span className="font-semibold" style={{ color: "var(--text-main)" }}>@{account.username}</span>
            </p>
            <input
              type="text" autoFocus maxLength={30}
              value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="new_username"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}
            />
            <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>Letters, numbers and underscores only · 3–30 characters</p>
            {usernameError && <p className="text-xs mt-3 font-medium" style={{ color: "#f87171" }}>{usernameError}</p>}
            {usernameOk && <p className="text-xs mt-3 font-medium" style={{ color: "#4ade80" }}>Username updated!</p>}
            <button onClick={() => { void handleChangeUsername(); }}
              disabled={usernameLoading || !newUsername.trim()}
              className="w-full mt-5 py-3.5 rounded-2xl font-bold text-sm transition active:scale-95"
              style={{ background: "var(--accent)", color: "#fff", opacity: usernameLoading || !newUsername.trim() ? 0.5 : 1 }}>
              {usernameLoading ? "Saving…" : "Update Username"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Change nickname modal */}
    {showNickname && (
      <div className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-md rounded-t-3xl flex flex-col"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "90dvh" }}>
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Change Nickname</p>
            <button onClick={() => setShowNickname(false)} className="text-xl leading-none" style={{ color: "var(--text-dim)" }}>✕</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>This is the name shown across the app.</p>
            <input
              type="text" autoFocus maxLength={60}
              value={newNickname} onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}
            />
            {nicknameError && <p className="text-xs mt-3 font-medium" style={{ color: "#f87171" }}>{nicknameError}</p>}
            {nicknameOk && <p className="text-xs mt-3 font-medium" style={{ color: "#4ade80" }}>Nickname updated!</p>}
            <button onClick={() => { void handleChangeNickname(); }}
              disabled={nicknameLoading || !newNickname.trim()}
              className="w-full mt-5 py-3.5 rounded-2xl font-bold text-sm transition active:scale-95"
              style={{ background: "var(--accent)", color: "#fff", opacity: nicknameLoading || !newNickname.trim() ? 0.5 : 1 }}>
              {nicknameLoading ? "Saving…" : "Update Nickname"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Change password modal */}
    {showPwd && (
      <div className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div ref={pwdSheetRef} className="w-full max-w-md rounded-t-3xl flex flex-col"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "90dvh", transition: "margin-bottom 0.15s ease" }}>

          {/* Fixed header — never scrolls */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Change Password</p>
            <button onClick={() => setShowPwd(false)}
              className="text-xl leading-none"
              style={{ color: "var(--text-dim)" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <div className="space-y-3">
              {(["Current password", "New password", "Confirm new password"] as const).map((lbl, i) => {
                const val = i === 0 ? pwdCurrent : i === 1 ? pwdNew : pwdConfirm;
                const set = i === 0 ? setPwdCurrent : i === 1 ? setPwdNew : setPwdConfirm;
                return (
                  <div key={lbl}>
                    <p className="text-xs mb-1 font-medium" style={{ color: "var(--text-sub)" }}>{lbl}</p>
                    <input
                      type="password"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-main)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {pwdError && (
              <p className="text-xs mt-3 font-medium" style={{ color: "#f87171" }}>{pwdError}</p>
            )}
            {pwdOk && (
              <p className="text-xs mt-3 font-medium" style={{ color: "#4ade80" }}>Password changed successfully!</p>
            )}

            <button
              onClick={() => { void handleChangePassword(); }}
              disabled={pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm}
              className="w-full mt-5 py-3.5 rounded-2xl font-bold text-sm transition active:scale-95"
              style={{
                background: "var(--accent)",
                color: "#fff",
                opacity: pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm ? 0.5 : 1,
              }}>
              {pwdLoading ? "Saving…" : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-dim)" }}>
        {title}
      </p>
      <div className="rounded-2xl p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, sublabel, onClick }: { label: string; sublabel?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-sm font-medium transition"
      style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-main)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--accent)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-main)")}>
      <div className="text-left">
        <p>{label}</p>
        {sublabel && <p className="text-xs font-normal mt-0.5" style={{ color: "var(--text-sub)" }}>{sublabel}</p>}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
    </button>
  );
}

function ProfileFeatureCards() {
  return (
    <div className="mb-4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Features</p>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "var(--text-dim)" }}>EXPLORE ERA</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── 1. WEIGHT LOSS COACH — hero ── */}
        <Link href="/weightloss">
          <div className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.985] transition"
            style={{ background: "linear-gradient(135deg, #030d07 0%, #052e16 35%, #064e3b 70%, #065f46 100%)", border: "1px solid rgba(16,185,129,0.3)", boxShadow: "0 6px 32px rgba(16,185,129,0.18)" }}>
            <div className="absolute top-0 right-0 pointer-events-none"
              style={{ width: 190, height: 190, background: "radial-gradient(circle, rgba(16,185,129,0.28) 0%, transparent 63%)", transform: "translate(38%,-38%)", filter: "blur(7px)" }} />
            <div className="absolute bottom-0 left-0 pointer-events-none"
              style={{ width: 110, height: 110, background: "radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)", transform: "translate(-28%,28%)" }} />
            <div className="relative" style={{ padding: "18px 18px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.32)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 5px #10b981" }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: "#10b981" }}>COACH-GUIDED</span>
                </div>
                <div style={{ flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "#10b981", filter: "blur(10px)", opacity: 0.35, transform: "scale(1.1)" }} />
                  <div style={{ position: "relative", width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏋️</div>
                </div>
              </div>
              <p style={{ fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 5 }}>Weight Loss<br />Coach</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", lineHeight: 1.65, maxWidth: 220 }}>Personalised meal plans · Nigerian food calorie calculator · daily accountability & rewards</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(16,185,129,0.15)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>Open coach</span>
                <ChevronRight style={{ width: 14, height: 14, color: "#10b981" }} />
              </div>
            </div>
          </div>
        </Link>

        {/* ── 2. MY DIARY & COMPANION — full-width hero ── */}
        <Link href="/companion">
          <div className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.985] transition"
            style={{ background: "linear-gradient(135deg, #06020f 0%, #130528 35%, #1e0845 65%, #2a0d5e 100%)", border: "1px solid rgba(139,92,246,0.32)", boxShadow: "0 6px 32px rgba(139,92,246,0.2)" }}>
            <div className="absolute top-0 right-0 pointer-events-none"
              style={{ width: 190, height: 190, background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 63%)", transform: "translate(38%,-38%)", filter: "blur(8px)" }} />
            <div className="absolute bottom-0 left-0 pointer-events-none"
              style={{ width: 110, height: 110, background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", transform: "translate(-28%,28%)" }} />
            {/* Star speckles */}
            <div className="absolute inset-0 pointer-events-none" style={{ overflow: "hidden" }}>
              {([[18,20],[60,12],[85,40],[38,62],[74,70],[26,82],[90,52],[50,30],[10,50]] as [number,number][]).map(([x,y],i) => (
                <span key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: i%3===0?2:1.5, height: i%3===0?2:1.5, borderRadius: "50%", background: "rgba(167,139,250,0.45)", display: "block" }} />
              ))}
            </div>
            <div className="relative" style={{ padding: "18px 18px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.35)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#8b5cf6", display: "inline-block", boxShadow: "0 0 6px #8b5cf6" }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: "#a78bfa" }}>PRIVATE · YOURS ONLY</span>
                </div>
                <div style={{ flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "#7c3aed", filter: "blur(11px)", opacity: 0.4, transform: "scale(1.12)" }} />
                  <div style={{ position: "relative", width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#a78bfa,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📓</div>
                </div>
              </div>
              <p style={{ fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 5 }}>
                My Diary<br /><span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>& Companion</span>
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 220 }}>Your private space — journal entries, personal chats & reflections only you can read</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(139,92,246,0.18)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>Open diary</span>
                <ChevronRight style={{ width: 14, height: 14, color: "#a78bfa" }} />
              </div>
            </div>
          </div>
        </Link>

        {/* ── 3. WOMEN'S HEALTH — full-width ── */}
        <Link href="/womens-health">
          <div className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.985] transition"
            style={{ background: "linear-gradient(135deg, #0f0208 0%, #3b0a24 35%, #7c1040 70%, #9d174d 100%)", border: "1px solid rgba(244,114,182,0.3)", boxShadow: "0 6px 32px rgba(236,72,153,0.2)" }}>
            <div className="absolute top-0 right-0 pointer-events-none"
              style={{ width: 190, height: 190, background: "radial-gradient(circle, rgba(244,114,182,0.32) 0%, transparent 63%)", transform: "translate(38%,-38%)", filter: "blur(8px)" }} />
            <div className="absolute bottom-0 left-0 pointer-events-none"
              style={{ width: 110, height: 110, background: "radial-gradient(circle, rgba(251,113,133,0.08) 0%, transparent 70%)", transform: "translate(-28%,28%)" }} />
            <div className="relative" style={{ padding: "18px 18px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(244,114,182,0.15)", border: "1px solid rgba(244,114,182,0.32)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f472b6", display: "inline-block", boxShadow: "0 0 5px #f472b6" }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: "#f472b6" }}>CYCLE TRACKING</span>
                </div>
                <div style={{ flexShrink: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "#be185d", filter: "blur(10px)", opacity: 0.4, transform: "scale(1.1)" }} />
                  <div style={{ position: "relative", width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#f9a8d4,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🌸</div>
                </div>
              </div>
              <p style={{ fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 5 }}>Women's<br />Health</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 220 }}>Cycle tracking · hormones · fertility insights & personalised care</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(244,114,182,0.15)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f9a8d4" }}>Track cycle</span>
                <ChevronRight style={{ width: 14, height: 14, color: "#f9a8d4" }} />
              </div>
            </div>
          </div>
        </Link>

        {/* ── 4 & 5. SEX LIFE + SOCIAL (2-col) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

          {/* Sex Life */}
          <Link href="/intimacy">
            <div className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.97] transition"
              style={{ background: "linear-gradient(160deg, #130008 0%, #4c0519 45%, #7f1d1d 100%)", border: "1px solid rgba(251,113,133,0.28)", boxShadow: "0 5px 22px rgba(239,68,68,0.18)", minHeight: 148 }}>
              <div className="absolute top-0 right-0 pointer-events-none"
                style={{ width: 80, height: 80, background: "radial-gradient(circle, rgba(251,113,133,0.42) 0%, transparent 70%)", transform: "translate(25%,-25%)" }} />
              <div className="relative" style={{ padding: 15 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(251,113,133,0.18)", border: "1px solid rgba(251,113,133,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 10 }}>🌹</div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>Sex<br />Life</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", marginTop: 4, lineHeight: 1.5 }}>Intimacy · drive<br />& connection</p>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fca5a5" }}>Explore</span>
                  <ChevronRight style={{ width: 11, height: 11, color: "#fca5a5" }} />
                </div>
              </div>
            </div>
          </Link>

          {/* Social Health */}
          <Link href="/social">
            <div className="relative rounded-3xl overflow-hidden cursor-pointer active:scale-[0.97] transition"
              style={{ background: "linear-gradient(160deg, #030712 0%, #1e3a8a 45%, #1d4ed8 100%)", border: "1px solid rgba(59,130,246,0.28)", boxShadow: "0 5px 22px rgba(59,130,246,0.16)", minHeight: 148 }}>
              <div className="absolute top-0 right-0 pointer-events-none"
                style={{ width: 80, height: 80, background: "radial-gradient(circle, rgba(96,165,250,0.4) 0%, transparent 70%)", transform: "translate(25%,-25%)" }} />
              <div className="relative" style={{ padding: 15 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(96,165,250,0.2)", border: "1px solid rgba(96,165,250,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 10 }}>👥</div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>Social<br />Health</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.42)", marginTop: 4, lineHeight: 1.5 }}>Partner · groups<br />& community</p>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>Connect</span>
                  <ChevronRight style={{ width: 11, height: 11, color: "#60a5fa" }} />
                </div>
              </div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
