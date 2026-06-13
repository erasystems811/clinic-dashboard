import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanionSettings, useChangePin, useChangeGesture, useChangeCompanionTheme,
  isCompanionUnlocked, clearCompanionUnlock,
  GESTURE_ELEMENTS, gestureLabel, decodeGesture,
} from "@/lib/companion-api";
import { cn } from "@/lib/utils";
import type { GestureConfig } from "@/lib/companion-api";

const DIARY_COLORS = [
  { id: "teal",   label: "Teal",   swatch: "#14b8a6" },
  { id: "blue",   label: "Blue",   swatch: "#3b82f6" },
  { id: "purple", label: "Purple", swatch: "#a78bfa" },
  { id: "rose",   label: "Rose",   swatch: "#ec4899" },
  { id: "green",  label: "Green",  swatch: "#22c55e" },
  { id: "orange", label: "Orange", swatch: "#f97316" },
  { id: "slate",  label: "Slate",  swatch: "#94a3b8" },
];

const COUNTS = [2, 3, 4, 5];

export default function CompanionSettingsPage() {
  const [, navigate] = useLocation();
  const { account, applyCompanionTheme, restoreAppTheme } = useAuth();
  const { data: settings } = useCompanionSettings();
  const changePin = useChangePin();
  const changeGesture = useChangeGesture();
  const changeTheme = useChangeCompanionTheme();

  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [gestureElement, setGestureElement] = useState<GestureConfig["element"]>("coins");
  const [gestureCount, setGestureCount] = useState(3);
  const [isHidden, setIsHidden] = useState(false);
  const [diaryColor, setDiaryColor] = useState<string>("teal");
  const [diaryDark, setDiaryDark] = useState(true);

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    const raw = localStorage.getItem("era_companion_tab");
    if (raw) {
      const g = decodeGesture(raw);
      if (g.themeColor) applyCompanionTheme(g.themeColor, g.darkMode ?? true);
    }
    return restoreAppTheme;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) {
      setGestureElement(settings.gestureElement);
      setGestureCount(settings.gestureCount);
      setIsHidden(!!settings.isHidden);
      if (settings.companionThemeColor) setDiaryColor(settings.companionThemeColor);
      if (settings.companionDarkMode !== undefined) setDiaryDark(settings.companionDarkMode);
    }
  }, [settings]);

  function handlePinChange() {
    if (newPin.length < 4) { setPinError("New PIN must be at least 4 digits"); return; }
    if (newPin !== confirmPin) { setPinError("PINs don't match"); return; }
    setPinError("");
    changePin.mutate({ currentPin, newPin }, {
      onSuccess: () => { setPinSuccess(true); setCurrentPin(""); setNewPin(""); setConfirmPin(""); setShowPinChange(false); },
      onError: (e) => setPinError(e.message),
    });
  }

  function handleGestureChange(el: GestureConfig["element"], cnt: number, hidden?: boolean) {
    const hid = hidden ?? isHidden;
    changeGesture.mutate({ element: el, count: cnt, hidden: hid });
  }

  function handleHideToggle() {
    const newHidden = !isHidden;
    setIsHidden(newHidden);
    changeGesture.mutate({ element: gestureElement, count: gestureCount, hidden: newHidden });
  }

  function handleThemeChange(color: string, dark: boolean) {
    setDiaryColor(color);
    setDiaryDark(dark);
    applyCompanionTheme(color, dark);
    changeTheme.mutate({ themeColor: color, darkMode: dark });
  }

  function handleLock() {
    clearCompanionUnlock();
    navigate("/companion");
  }

  const currentLabel = gestureLabel({ element: gestureElement, count: gestureCount });

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: "var(--bg-base)" }}>
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/companion")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">Diary settings</h1>

      {/* Secret entry gesture */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold text-foreground mb-1">Secret gesture</p>
        <p className="text-xs text-muted-foreground mb-1">Your current secret:</p>
        <p className="text-sm font-bold text-primary mb-4">🔑 {currentLabel}</p>

        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">What to tap</p>
        <div className="space-y-2 mb-4">
          {GESTURE_ELEMENTS.map((el) => (
            <button key={el.value}
              onClick={() => { setGestureElement(el.value); handleGestureChange(el.value, gestureCount); }}
              className={cn("w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition",
                gestureElement === el.value ? "border-primary bg-primary/5" : "border-border")}>
              <div className={cn("w-4 h-4 rounded-full border-2 shrink-0",
                gestureElement === el.value ? "border-primary bg-primary" : "border-muted-foreground")} />
              <span className="text-lg">{el.emoji}</span>
              <p className="text-sm font-semibold text-foreground">{el.label}</p>
              {changeGesture.isPending && <div className="ml-auto w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />}
            </button>
          ))}
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">How many times</p>
        <div className="flex gap-2">
          {COUNTS.map((n) => (
            <button key={n}
              onClick={() => { setGestureCount(n); handleGestureChange(gestureElement, n); }}
              className={cn("flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition",
                gestureCount === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-foreground")}>
              {n}×
            </button>
          ))}
        </div>
      </div>

      {/* Visibility toggle */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Show diary in navigation</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isHidden ? "Diary is hidden — only accessible via your secret gesture" : "Diary icon is visible in the app"}
            </p>
          </div>
          <button
            onClick={handleHideToggle}
            disabled={changeGesture.isPending}
            style={{
              position: "relative", flexShrink: 0,
              width: 50, height: 28, borderRadius: 14, border: "none", padding: 0, cursor: "pointer",
              background: !isHidden ? "var(--primary, #14b8a6)" : "var(--muted, #334155)",
              transition: "background 0.2s",
              opacity: changeGesture.isPending ? 0.5 : 1,
            }}>
            <span style={{
              position: "absolute", top: 4,
              left: !isHidden ? 26 : 4,
              width: 20, height: 20, borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              transition: "left 0.2s",
            }} />
          </button>
        </div>
      </div>

      {/* PIN change */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">PIN</p>
          <button onClick={() => { setShowPinChange((p) => !p); setPinError(""); setPinSuccess(false); }}
            className="text-xs font-semibold text-primary">
            {showPinChange ? "Cancel" : "Change PIN"}
          </button>
        </div>
        {pinSuccess && <p className="text-xs text-green-600 dark:text-green-400 mb-2">PIN updated successfully</p>}
        {showPinChange && (
          <div className="space-y-3 mt-3">
            <PinField label="Current PIN" value={currentPin} onChange={setCurrentPin} />
            <PinField label="New PIN (4+ digits)" value={newPin} onChange={setNewPin} />
            <PinField label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
            <button onClick={handlePinChange} disabled={!currentPin || !newPin || !confirmPin || changePin.isPending}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-60 transition active:scale-95">
              {changePin.isPending ? "Saving…" : "Update PIN"}
            </button>
          </div>
        )}
      </div>

      {/* Diary theme */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold text-foreground mb-1">Diary theme</p>
        <p className="text-xs text-muted-foreground mb-4">Pick a colour and mode just for the diary — independent from the rest of the app.</p>

        {/* Light / Dark toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => handleThemeChange(diaryColor, false)}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition",
              !diaryDark ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-foreground")}>
            ☀️ Light
          </button>
          <button onClick={() => handleThemeChange(diaryColor, true)}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition",
              diaryDark ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-foreground")}>
            🌙 Dark
          </button>
        </div>

        {/* Colour grid */}
        <div className="grid grid-cols-4 gap-2">
          {DIARY_COLORS.map((c) => (
            <button key={c.id} onClick={() => handleThemeChange(c.id, diaryDark)}
              className={cn("flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition",
                diaryColor === c.id ? "border-primary" : "border-transparent bg-muted")}>
              <div className="w-7 h-7 rounded-full shadow-sm" style={{ background: c.swatch }} />
              <span className="text-[10px] font-semibold text-foreground">{c.label}</span>
            </button>
          ))}
        </div>
        {changeTheme.isPending && (
          <p className="text-[11px] text-muted-foreground mt-3 text-center">Saving…</p>
        )}
      </div>

      {/* Lock */}
      <button onClick={handleLock}
        className="w-full flex items-center justify-center gap-2 py-4 border border-border rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        <LogOut className="w-4 h-4" />Lock diary now
      </button>
    </div>
    </div>
  );
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <input type="password" inputMode="numeric" value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="••••"
        className="w-full bg-muted rounded-xl px-4 py-2.5 text-base font-bold text-foreground text-center tracking-[0.4em] outline-none" />
    </div>
  );
}
