import { useState, useRef, useEffect, useLayoutEffect } from "react";
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
  const fbOverlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!showFeedback) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      const el = fbOverlayRef.current;
      if (!el) return;
      el.style.height = `${vv!.height}px`;
      el.style.top    = `${vv!.offsetTop}px`;
    }
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [showFeedback]);

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

  // Change password modal — visualViewport tracks keyboard so the sheet doesn't hide behind it
  const pwdOverlayRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!showPwd) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      const el = pwdOverlayRef.current;
      if (!el) return;
      el.style.height = `${vv!.height}px`;
      el.style.top    = `${vv!.offsetTop}px`;
    }
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
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

      {/* My Companion / Diary */}
      {!isCompanionHidden() && (
        <Section title="Private">
          <div className="space-y-1">
            <SettingsRow label="My Diary" sublabel="Journal, chats & secret settings" onClick={() => navigate("/companion")} />
          </div>
        </Section>
      )}

      {/* Women's Health */}
      <Section title="Women's Health">
        <div className="space-y-1">
          <SettingsRow label="Cycle & Period Tracker" sublabel="Track your cycle, fertile window & symptoms" onClick={() => navigate("/womens-health")} />
        </div>
      </Section>

      {/* Weight Loss */}
      <Section title="Weight Loss">
        <div className="space-y-1">
          <SettingsRow label="Weight Loss Coach" sublabel="Personalised meal plans, calorie tracking & accountability" onClick={() => navigate("/weightloss")} />
        </div>
      </Section>

      {/* Social */}
      <Section title="Social">
        <div className="space-y-1">
          <SettingsRow label="Accountability Partners" sublabel="Share streaks, stay motivated" onClick={() => navigate("/social")} />
        </div>
      </Section>

      {/* Account settings */}
      <Section title="Account">
        <div className="space-y-1">
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
      <div ref={fbOverlayRef} className="fixed left-0 right-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-md rounded-t-3xl p-6 overflow-y-auto"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "100%" }}>
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Send Feedback</p>
            <button onClick={() => setShowFeedback(false)} className="text-xl leading-none" style={{ color: "var(--text-dim)" }}>✕</button>
          </div>

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
    )}

    {/* Change password modal — overlay is pinned to the visual viewport via ref+useLayoutEffect
        so the sheet stays just above the keyboard on iOS (same pattern as companion chat) */}
    {showPwd && (
      <div ref={pwdOverlayRef} className="fixed left-0 right-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-md rounded-t-3xl p-6 overflow-y-auto"
          style={{ background: "var(--bg-base)", border: "1px solid var(--glass-border)", maxHeight: "100%" }}>
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-base" style={{ color: "var(--text-main)" }}>Change Password</p>
            <button onClick={() => setShowPwd(false)}
              className="text-xl leading-none"
              style={{ color: "var(--text-dim)" }}>✕</button>
          </div>

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
