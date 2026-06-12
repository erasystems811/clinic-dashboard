import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanionSettings, useChangePin, useChangeEntryTab,
  isCompanionUnlocked, clearCompanionUnlock,
} from "@/lib/companion-api";
import { cn } from "@/lib/utils";

const NAV_TABS = [
  { value: "/",          label: "Home tab" },
  { value: "/wellness",  label: "Wellness tab" },
  { value: "/hospitals", label: "Hospitals tab" },
  { value: "/profile",   label: "Profile tab" },
];

export default function CompanionSettingsPage() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const { data: settings } = useCompanionSettings();
  const changePin = useChangePin();
  const changeTab = useChangeEntryTab();

  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [selectedTab, setSelectedTab] = useState(settings?.entryTab ?? "/profile");

  useEffect(() => {
    if (account && !isCompanionUnlocked(account.id)) navigate("/companion");
  }, [account, navigate]);

  useEffect(() => {
    if (settings) setSelectedTab(settings.entryTab);
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

  function handleTabChange(tab: string) {
    setSelectedTab(tab);
    localStorage.setItem("era_companion_tab", tab);
    changeTab.mutate(tab);
  }

  function handleLock() {
    clearCompanionUnlock();
    navigate("/companion");
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={() => navigate("/companion")} className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">Companion settings</h1>

      {/* Secret entry tab */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold text-foreground mb-1">Secret entry</p>
        <p className="text-xs text-muted-foreground mb-4">Which tab to long-press to open the companion</p>
        <div className="space-y-2">
          {NAV_TABS.map((t) => (
            <button key={t.value} onClick={() => handleTabChange(t.value)}
              className={cn("w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition",
                selectedTab === t.value ? "border-primary bg-primary/5" : "border-border")}>
              <div className={cn("w-4 h-4 rounded-full border-2 shrink-0",
                selectedTab === t.value ? "border-primary bg-primary" : "border-muted-foreground")} />
              <p className="text-sm font-semibold text-foreground">{t.label}</p>
              {changeTab.isPending && selectedTab === t.value && (
                <div className="ml-auto w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          ))}
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
        <LogOut className="w-4 h-4" />Lock companion now
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
