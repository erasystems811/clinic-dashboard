import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanionSettings, useChangePin, useChangeGesture,
  isCompanionUnlocked, clearCompanionUnlock,
  GESTURE_ELEMENTS, gestureLabel, decodeGesture,
} from "@/lib/companion-api";
import { cn } from "@/lib/utils";
import type { GestureConfig } from "@/lib/companion-api";

const COUNTS = [2, 3, 4, 5];

export default function CompanionSettingsPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const { data: settings } = useCompanionSettings();
  const changePin = useChangePin();
  const changeGesture = useChangeGesture();

  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [gestureElement, setGestureElement] = useState<GestureConfig["element"]>("coins");
  const [gestureCount, setGestureCount] = useState(3);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    if (settings) {
      setGestureElement(settings.gestureElement);
      setGestureCount(settings.gestureCount);
      setIsHidden(!!settings.isHidden);
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
    const encoded = JSON.stringify({ element: el, count: cnt, hidden: hid });
    localStorage.setItem("era_companion_tab", encoded);
    changeGesture.mutate({ element: el, count: cnt, hidden: hid });
  }

  function handleHideToggle() {
    const newHidden = !isHidden;
    setIsHidden(newHidden);
    const encoded = JSON.stringify({ element: gestureElement, count: gestureCount, hidden: newHidden });
    localStorage.setItem("era_companion_tab", encoded);
    changeGesture.mutate({ element: gestureElement, count: gestureCount, hidden: newHidden });
  }

  function handleLock() {
    clearCompanionUnlock();
    navigate("/companion");
  }

  const currentLabel = gestureLabel({ element: gestureElement, count: gestureCount });

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }} className="px-5 pt-6 pb-8">
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
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0",
              !isHidden ? "bg-primary" : "bg-muted border border-border"
            )}>
            <span className={cn(
              "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
              !isHidden ? "translate-x-6" : "translate-x-0.5"
            )} />
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

      {/* Lock */}
      <button onClick={handleLock}
        className="w-full flex items-center justify-center gap-2 py-4 border border-border rounded-2xl text-sm font-semibold text-muted-foreground transition active:scale-95">
        <LogOut className="w-4 h-4" />Lock diary now
      </button>
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
