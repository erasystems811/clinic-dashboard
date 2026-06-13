import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Settings, Heart, Activity, Grid3X3, Users, Copy, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useIntimacyTheme } from "@/lib/section-theme";
import { cn } from "@/lib/utils";
import {
  isIntimacyUnlocked, setIntimacyUnlocked, clearIntimacyUnlocked,
  useIntimacySettings, useSetupIntimacy, useVerifyIntimacyPin, useUpdateIntimacySettings, useSaveIntimacyDob,
  useCelibacyData, useCelibacyCheckin,
  useIntimacySessions, useLogSession,
  usePositionStats,
  usePostinorData,
  usePartnerData, useGenerateInvite, useJoinPartner, useDisconnectPartner,
  POSITIONS, CELIBACY_MILESTONES,
  type IntimacySettings,
} from "@/lib/intimacy-api";

// ── SVG Position Silhouettes ──────────────────────────────────────────────────
function PositionSVG({ id }: { id: string }) {
  const C = "rgba(225,29,72,";
  const shapes: Record<string, React.ReactNode> = {
    missionary: <>
      <ellipse cx="40" cy="38" rx="28" ry="9" fill={C+"0.35)"} transform="rotate(-4 40 38)" />
      <ellipse cx="42" cy="23" rx="22" ry="8" fill={C+"0.65)"} transform="rotate(-8 42 23)" />
      <circle cx="14" cy="34" r="7" fill={C+"0.28)"} />
      <circle cx="20" cy="18" r="7" fill={C+"0.55)"} />
    </>,
    cowgirl: <>
      <ellipse cx="40" cy="41" rx="27" ry="9" fill={C+"0.35)"} />
      <ellipse cx="40" cy="22" rx="10" ry="17" fill={C+"0.65)"} />
      <circle cx="14" cy="39" r="6" fill={C+"0.28)"} />
      <circle cx="40" cy="6" r="7" fill={C+"0.55)"} />
    </>,
    reverse_cowgirl: <>
      <ellipse cx="40" cy="41" rx="27" ry="9" fill={C+"0.35)"} />
      <ellipse cx="40" cy="22" rx="10" ry="17" fill={C+"0.6)"} transform="rotate(5 40 22)" />
      <circle cx="14" cy="39" r="6" fill={C+"0.28)"} />
      <circle cx="40" cy="6" r="7" fill={C+"0.5)"} />
      <ellipse cx="40" cy="32" rx="14" ry="5" fill={C+"0.2)"} transform="rotate(-10 40 32)" />
    </>,
    doggy: <>
      <ellipse cx="38" cy="32" rx="26" ry="9" fill={C+"0.35)"} transform="rotate(8 38 32)" />
      <ellipse cx="44" cy="20" rx="22" ry="8" fill={C+"0.6)"} transform="rotate(8 44 20)" />
      <circle cx="63" cy="28" r="7" fill={C+"0.28)"} />
      <circle cx="66" cy="15" r="6" fill={C+"0.55)"} />
    </>,
    spooning: <>
      <ellipse cx="40" cy="37" rx="27" ry="9" fill={C+"0.35)"} transform="rotate(4 40 37)" />
      <ellipse cx="40" cy="23" rx="25" ry="8" fill={C+"0.6)"} transform="rotate(4 40 23)" />
      <circle cx="65" cy="34" r="7" fill={C+"0.28)"} />
      <circle cx="63" cy="20" r="6" fill={C+"0.55)"} />
    </>,
    lotus: <>
      <ellipse cx="26" cy="34" rx="12" ry="19" fill={C+"0.45)"} transform="rotate(5 26 34)" />
      <ellipse cx="54" cy="34" rx="12" ry="19" fill={C+"0.6)"} transform="rotate(-5 54 34)" />
      <circle cx="26" cy="11" r="7" fill={C+"0.38)"} />
      <circle cx="54" cy="11" r="7" fill={C+"0.55)"} />
    </>,
    butterfly: <>
      <ellipse cx="36" cy="38" rx="25" ry="9" fill={C+"0.35)"} transform="rotate(6 36 38)" />
      <ellipse cx="60" cy="23" rx="11" ry="19" fill={C+"0.6)"} />
      <circle cx="12" cy="34" r="7" fill={C+"0.28)"} />
      <circle cx="60" cy="5" r="7" fill={C+"0.55)"} />
    </>,
    standing: <>
      <ellipse cx="31" cy="30" rx="11" ry="22" fill={C+"0.4)"} />
      <ellipse cx="49" cy="30" rx="11" ry="22" fill={C+"0.6)"} />
      <circle cx="31" cy="6" r="7" fill={C+"0.35)"} />
      <circle cx="49" cy="6" r="7" fill={C+"0.55)"} />
    </>,
    chair: <>
      <ellipse cx="40" cy="40" rx="15" ry="11" fill={C+"0.35)"} />
      <ellipse cx="40" cy="22" rx="12" ry="16" fill={C+"0.6)"} />
      <circle cx="26" cy="36" r="6" fill={C+"0.28)"} />
      <circle cx="40" cy="7" r="7" fill={C+"0.55)"} />
    </>,
    edge_of_bed: <>
      <ellipse cx="32" cy="39" rx="26" ry="9" fill={C+"0.35)"} />
      <ellipse cx="62" cy="25" rx="11" ry="20" fill={C+"0.6)"} />
      <circle cx="8" cy="36" r="7" fill={C+"0.28)"} />
      <circle cx="62" cy="6" r="7" fill={C+"0.55)"} />
      <line x1="57" y1="45" x2="67" y2="45" stroke={C+"0.4)"} strokeWidth="3" strokeLinecap="round" />
    </>,
    scissors: <>
      <ellipse cx="40" cy="28" rx="28" ry="9" fill={C+"0.4)"} transform="rotate(22 40 28)" />
      <ellipse cx="40" cy="30" rx="28" ry="9" fill={C+"0.55)"} transform="rotate(-22 40 30)" />
      <circle cx="14" cy="16" r="7" fill={C+"0.32)"} />
      <circle cx="66" cy="16" r="6" fill={C+"0.5)"} />
    </>,
    bridge: <>
      <path d="M 12 44 Q 40 10 68 44" fill="none" stroke={C+"0.5)"} strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="55" cy="36" rx="13" ry="9" fill={C+"0.55)"} transform="rotate(-20 55 36)" />
      <circle cx="14" cy="44" r="7" fill={C+"0.35)"} />
      <circle cx="55" cy="24" r="7" fill={C+"0.55)"} />
    </>,
    wall: <>
      <line x1="72" y1="5" x2="72" y2="55" stroke={C+"0.25)"} strokeWidth="4" />
      <ellipse cx="52" cy="30" rx="11" ry="22" fill={C+"0.45)"} />
      <ellipse cx="34" cy="30" rx="11" ry="22" fill={C+"0.6)"} />
      <circle cx="52" cy="7" r="7" fill={C+"0.38)"} />
      <circle cx="34" cy="7" r="7" fill={C+"0.55)"} />
    </>,
    pretzel: <>
      <ellipse cx="36" cy="35" rx="13" ry="20" fill={C+"0.4)"} transform="rotate(15 36 35)" />
      <ellipse cx="44" cy="25" rx="13" ry="20" fill={C+"0.6)"} transform="rotate(-15 44 25)" />
      <circle cx="28" cy="12" r="7" fill={C+"0.32)"} />
      <circle cx="52" cy="8" r="7" fill={C+"0.55)"} />
    </>,
    flat: <>
      <ellipse cx="40" cy="36" rx="28" ry="9" fill={C+"0.35)"} />
      <ellipse cx="40" cy="24" rx="28" ry="8" fill={C+"0.6)"} />
      <circle cx="14" cy="34" r="7" fill={C+"0.28)"} />
      <circle cx="14" cy="22" r="7" fill={C+"0.55)"} />
    </>,
    table_top: <>
      <line x1="10" y1="42" x2="70" y2="42" stroke={C+"0.3)"} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="34" cy="36" rx="24" ry="8" fill={C+"0.35)"} />
      <ellipse cx="60" cy="24" rx="11" ry="19" fill={C+"0.6)"} />
      <circle cx="12" cy="32" r="7" fill={C+"0.28)"} />
      <circle cx="60" cy="6" r="7" fill={C+"0.55)"} />
    </>,
    cradle: <>
      <ellipse cx="40" cy="36" rx="26" ry="9" fill={C+"0.35)"} transform="rotate(-5 40 36)" />
      <ellipse cx="42" cy="23" rx="22" ry="8" fill={C+"0.6)"} transform="rotate(-8 42 23)" />
      <path d="M 54 38 Q 66 28 54 18" fill="none" stroke={C+"0.5)"} strokeWidth="5" strokeLinecap="round" />
      <circle cx="18" cy="33" r="7" fill={C+"0.28)"} />
      <circle cx="20" cy="18" r="7" fill={C+"0.55)"} />
    </>,
    waterfall: <>
      <ellipse cx="40" cy="22" rx="26" ry="9" fill={C+"0.35)"} />
      <ellipse cx="42" cy="36" rx="22" ry="8" fill={C+"0.6)"} transform="rotate(5 42 36)" />
      <circle cx="14" cy="21" r="7" fill={C+"0.28)"} />
      <circle cx="20" cy="46" r="7" fill={C+"0.55)"} />
      <line x1="10" y1="48" x2="70" y2="48" stroke={C+"0.25)"} strokeWidth="3" strokeLinecap="round" />
    </>,
    cat: <>
      <ellipse cx="40" cy="38" rx="28" ry="9" fill={C+"0.35)"} transform="rotate(-3 40 38)" />
      <ellipse cx="38" cy="24" rx="26" ry="8" fill={C+"0.6)"} transform="rotate(-3 38 24)" />
      <circle cx="13" cy="35" r="7" fill={C+"0.28)"} />
      <circle cx="13" cy="21" r="7" fill={C+"0.55)"} />
    </>,
    wheelbarrow: <>
      <ellipse cx="28" cy="34" rx="12" ry="22" fill={C+"0.35)"} transform="rotate(-10 28 34)" />
      <ellipse cx="52" cy="26" rx="11" ry="20" fill={C+"0.6)"} transform="rotate(10 52 26)" />
      <circle cx="28" cy="10" r="7" fill={C+"0.28)"} />
      <circle cx="52" cy="48" r="7" fill={C+"0.55)"} />
    </>,
  };

  return (
    <svg viewBox="0 0 80 55" className="w-full h-full">
      {shapes[id] ?? shapes.missionary}
    </svg>
  );
}

// ── Gate / Entry point ────────────────────────────────────────────────────────
export default function IntimacyGate() {
  const { account } = useAuth();
  const { data, isLoading } = useIntimacySettings();
  const [unlocked, setUnlocked] = useState(false);

  useIntimacyTheme();

  useEffect(() => {
    if (account && isIntimacyUnlocked(account.id)) setUnlocked(true);
  }, [account]);

  if (isLoading || !account) return <Shell><Spinner /></Shell>;

  // No DOB on file → let them enter it in-app
  if (!data?.ageOk && data?.age === null) return <Shell><DobScreen /></Shell>;
  // DOB on file but under 18 → hard block
  if (!data?.ageOk) return <Shell><UnderAgeScreen /></Shell>;
  if (!data?.isSetUp) return <Shell><SetupFlow /></Shell>;
  if (!unlocked) return <Shell><PinScreen accountId={account.id} onUnlock={() => setUnlocked(true)} /></Shell>;

  return <Shell><IntimacyHome settings={data.settings!} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--bg-base, #0d0006)" }}>
      <div className="max-w-md mx-auto h-full flex flex-col shadow-2xl">{children}</div>
    </div>
  );
}

// ── DOB collection (no DOB on account yet) ───────────────────────────────────
function DobScreen() {
  const [, navigate] = useLocation();
  const saveDob = useSaveIntimacyDob();
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!dob) { setError("Please enter your date of birth"); return; }
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    if (age < 18) { setError("You must be 18 or older to access this feature"); return; }
    setError("");
    saveDob.mutate(dob);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🔞</div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Age verification</h1>
      <p className="text-sm leading-relaxed mb-8 max-w-xs" style={{ color: "var(--text-sub)" }}>
        This feature is for ages 18 and above. Enter your date of birth to continue.
      </p>
      <div className="w-full max-w-xs space-y-4">
        <input
          type="date"
          value={dob}
          onChange={(e) => { setDob(e.target.value); setError(""); }}
          max={new Date().toISOString().split("T")[0]}
          className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none text-center"
          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }}
        />
        <p className="text-xs text-center px-2" style={{ color: "var(--text-dim)" }}>
          🔒 Your date of birth cannot be changed after this step
        </p>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        {saveDob.isError && <p className="text-sm text-red-400 text-center">{(saveDob.error as Error).message}</p>}
        <button
          onClick={handleSubmit}
          disabled={saveDob.isPending || !dob}
          className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--btn-gradient)" }}
        >
          {saveDob.isPending ? "Verifying…" : "Confirm & continue"}
        </button>
        <button onClick={() => navigate("/")} className="w-full py-2 text-sm" style={{ color: "var(--text-dim)" }}>
          Go back
        </button>
      </div>
    </div>
  );
}

// ── Hard block for confirmed under-18 ────────────────────────────────────────
function UnderAgeScreen() {
  const [, navigate] = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">🔞</div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-main)" }}>18+ Only</h1>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-sub)" }}>
        This feature is only available to accounts aged 18 and above.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-8 py-3 rounded-2xl font-bold text-white transition active:scale-95"
        style={{ background: "var(--btn-gradient)" }}
      >
        Go back
      </button>
    </div>
  );
}

// ── Setup flow ────────────────────────────────────────────────────────────────
function SetupFlow() {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const setup = useSetupIntimacy();
  const [step, setStep] = useState<"intro" | "mode" | "pin">("intro");
  const [mode, setMode] = useState<"celibacy" | "active">("active");
  const [celibacyReason, setCelibacyReason] = useState("personal");
  const [celibacyStart, setCelibacyStart] = useState(new Date().toISOString().split("T")[0]);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  function handleFinish() {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs don't match"); return; }
    setError("");
    setup.mutate({
      pin, mode,
      celibacyStartDate: mode === "celibacy" ? celibacyStart : undefined,
      celibacyReason: mode === "celibacy" ? celibacyReason : undefined,
    }, {
      onSuccess: () => {
        if (account) setIntimacyUnlocked(account.id);
      },
    });
  }

  if (step === "intro") return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-16 pb-8 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 text-4xl"
        style={{ background: "linear-gradient(135deg,rgba(159,18,57,0.4),rgba(225,29,72,0.2))", border: "1px solid rgba(225,29,72,0.3)" }}>
        🌹
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-main)" }}>Sex Life</h1>
      <p className="text-sm leading-relaxed mb-8 max-w-xs" style={{ color: "var(--text-sub)" }}>
        Your private safe space. Track your intimacy journey — celibacy streaks, session logs, positions, and more. Locked with your PIN.
      </p>
      <div className="space-y-3 w-full text-left mb-8">
        {[
          { icon: "🌿", label: "Celibacy tracking", sub: "Streaks, milestones, daily check-ins" },
          { icon: "💗", label: "Active mode", sub: "Sessions, frequency goals, Postinor 2 tracker" },
          { icon: "🌹", label: "Freaky mode", sub: "Position explorer with personal stats" },
          { icon: "🔗", label: "Partner space", sub: "Invite your partner to connect" },
          { icon: "🔒", label: "PIN protected", sub: "Only you can open this space" },
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-4 rounded-2xl p-4"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-main)" }}>{f.label}</p>
              <p className="text-xs" style={{ color: "var(--text-sub)" }}>{f.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setStep("mode")}
        className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95"
        style={{ background: "var(--btn-gradient)" }}>
        Set it up
      </button>
      <button onClick={() => navigate("/")} className="mt-3 text-sm" style={{ color: "var(--text-sub)" }}>Maybe later</button>
    </div>
  );

  if (step === "mode") return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8">
      <button onClick={() => setStep("intro")} className="flex items-center gap-1.5 mb-8 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>What are you tracking?</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>You can switch between modes anytime.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { id: "active", icon: "💗", label: "Active", sub: "Track sessions & health" },
          { id: "celibacy", icon: "🌿", label: "Celibacy", sub: "Streaks & milestones" },
        ].map((m) => (
          <button key={m.id} onClick={() => setMode(m.id as "celibacy" | "active")}
            className={cn("flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition active:scale-95 font-semibold",
              mode === m.id ? "border-[#e11d48]" : "border-transparent")}
            style={{ background: mode === m.id ? "rgba(225,29,72,0.12)" : "var(--glass-bg)" }}>
            <span className="text-3xl">{m.icon}</span>
            <span className="text-sm" style={{ color: "var(--text-main)" }}>{m.label}</span>
            <span className="text-xs" style={{ color: "var(--text-sub)" }}>{m.sub}</span>
          </button>
        ))}
      </div>

      {mode === "celibacy" && (
        <div className="space-y-4 mb-6">
          <Field label="Start date">
            <input type="date" value={celibacyStart} onChange={(e) => setCelibacyStart(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
          </Field>
          <Field label="Reason">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "spiritual", label: "Spiritual / Faith" },
                { id: "personal", label: "Personal reset" },
                { id: "healing", label: "Healing" },
                { id: "challenge", label: "90-day challenge" },
              ].map((r) => (
                <button key={r.id} onClick={() => setCelibacyReason(r.id)}
                  className={cn("py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition",
                    celibacyReason === r.id ? "border-[#e11d48]" : "border-transparent")}
                  style={{
                    background: celibacyReason === r.id ? "rgba(225,29,72,0.12)" : "var(--glass-bg)",
                    color: "var(--text-main)",
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      <button onClick={() => setStep("pin")}
        className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95"
        style={{ background: "var(--btn-gradient)" }}>
        Next — Set PIN
      </button>
    </div>
  );

  // PIN step
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8">
      <button onClick={() => setStep("mode")} className="flex items-center gap-1.5 mb-8 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Set your PIN</h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-sub)" }}>You'll enter this every time you open your space.</p>
      <PinPad label="Choose a PIN (4+ digits)" value={pin} onChange={setPin} />
      <div className="mt-4" />
      <PinPad label="Confirm PIN" value={confirm} onChange={setConfirm} />
      {error && <p className="text-sm text-red-400 text-center mt-3">{error}</p>}
      {setup.error && <p className="text-sm text-red-400 text-center mt-2">{(setup.error as Error).message}</p>}
      <button onClick={handleFinish} disabled={setup.isPending || pin.length < 4 || confirm.length < 4}
        className="w-full mt-6 py-4 rounded-2xl font-bold text-base text-white transition active:scale-95 disabled:opacity-50"
        style={{ background: "var(--btn-gradient)" }}>
        {setup.isPending ? "Setting up…" : "Enter my space"}
      </button>
    </div>
  );
}

// ── PIN entry screen ──────────────────────────────────────────────────────────
function PinScreen({ accountId, onUnlock }: { accountId: number; onUnlock: () => void }) {
  const [, navigate] = useLocation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const verify = useVerifyIntimacyPin();

  function handleDigit(d: string) {
    if (pin.length >= 8) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      verify.mutate(next, {
        onSuccess: () => { setIntimacyUnlocked(accountId); onUnlock(); },
        onError: () => {
          setError("Wrong PIN");
          setShake(true);
          setTimeout(() => { setShake(false); setPin(""); setError(""); }, 700);
        },
      });
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8 flex flex-col items-center">
      <button onClick={() => navigate("/")} className="self-start flex items-center gap-1.5 mb-8 -ml-1" style={{ color: "var(--text-sub)" }}>
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-main)" }}>Enter your PIN</h2>

      <div className={cn("flex gap-3 mb-8 transition-all", shake && "animate-bounce")}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <div key={i} className={cn("w-4 h-4 rounded-full border-2 transition-all",
            i < pin.length ? "scale-110" : "")}
            style={{
              background: i < pin.length ? "#e11d48" : "transparent",
              borderColor: i < pin.length ? "#e11d48" : "rgba(225,29,72,0.4)",
            }} />
        ))}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d) => (
          d === "" ? <div key="empty" /> :
          d === "⌫" ? (
            <button key="del" onClick={() => setPin((p) => p.slice(0, -1))}
              className="h-16 rounded-2xl flex items-center justify-center text-xl font-bold transition active:scale-95"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
              {d}
            </button>
          ) : (
            <button key={d} onClick={() => handleDigit(d)} disabled={verify.isPending}
              className="h-16 rounded-2xl flex items-center justify-center text-xl font-bold transition active:scale-95"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)" }}>
              {d}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

// ── Main app home ─────────────────────────────────────────────────────────────
type Tab = "home" | "track" | "positions" | "partner";

function IntimacyHome({ settings }: { settings: IntimacySettings }) {
  const [, navigate] = useLocation();
  const { account } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [showSettings, setShowSettings] = useState(false);

  function handleLock() {
    if (account) clearIntimacyUnlocked(account.id);
    navigate("/");
  }

  const TABS: { id: Tab; icon: typeof Heart; label: string }[] = [
    { id: "home",      icon: Heart,      label: "Home" },
    { id: "track",     icon: Activity,   label: "Track" },
    { id: "positions", icon: Grid3X3,    label: "Explore" },
    { id: "partner",   icon: Users,      label: "Partner" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <button onClick={handleLock}
              className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <ArrowLeft className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
            <span className="text-xl">🌹</span>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Sex Life</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: settings.mode === "celibacy" ? "rgba(34,197,94,0.15)" : "rgba(225,29,72,0.15)",
                       color: settings.mode === "celibacy" ? "#4ade80" : "#fb7185",
                       border: `1px solid ${settings.mode === "celibacy" ? "rgba(34,197,94,0.3)" : "rgba(225,29,72,0.3)"}` }}>
              {settings.mode === "celibacy" ? "🌿 Celibacy" : "💗 Active"}
            </span>
            <button onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <Settings className="w-4 h-4" style={{ color: "var(--text-sub)" }} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-2xl p-1" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[11px] font-semibold transition-all")}
              style={tab === id
                ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.3)" }
                : { color: "var(--text-dim)" }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-8">
        {tab === "home"      && <HomeTab settings={settings} onSwitchTab={setTab} />}
        {tab === "track"     && <TrackTab settings={settings} />}
        {tab === "positions" && <PositionsTab freakyEnabled={settings.freakyMode} />}
        {tab === "partner"   && <PartnerTab />}
      </div>

      {showSettings && <SettingsSheet settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ settings, onSwitchTab }: { settings: IntimacySettings; onSwitchTab: (t: Tab) => void }) {
  const { data: celibacy } = useCelibacyData();
  const { data: sessions } = useIntimacySessions();
  const { data: postinor } = usePostinorData();

  const isCelibacy = settings.mode === "celibacy";

  return (
    <div className="space-y-4">
      {/* Hero card */}
      {isCelibacy && celibacy?.streak ? (
        <div className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#0a2010,#163320)" }}>
          <div className="absolute top-3 right-4 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
            🌿 Celibacy
          </div>
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full" style={{ background: "radial-gradient(circle,rgba(34,197,94,0.15),transparent)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "rgba(134,239,172,0.8)" }}>Days of celibacy</p>
          <p className="text-7xl font-black mb-1" style={{ color: "#4ade80" }}>{celibacy.streak.daysFree}</p>
          <p className="text-lg font-bold" style={{ color: "rgba(134,239,172,0.7)" }}>{celibacy.streak.daysFree === 1 ? "day" : "days"}</p>
          {(() => {
            const next = CELIBACY_MILESTONES.find((m) => m.days > celibacy.streak!.daysFree);
            return next ? (
              <p className="text-xs mt-3" style={{ color: "rgba(134,239,172,0.6)" }}>
                {next.days - celibacy.streak.daysFree} more {next.days - celibacy.streak.daysFree === 1 ? "day" : "days"} to {next.emoji} {next.label}
              </p>
            ) : null;
          })()}
        </div>
      ) : !isCelibacy && sessions ? (
        <div className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1a0008,#3d001a)" }}>
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle,rgba(225,29,72,0.2),transparent)" }} />
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-sub)" }}>This week</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: sessions.stats.thisWeek,    label: "This week",  emoji: "📅" },
              { n: sessions.stats.thisMonth,   label: "This month", emoji: "📊" },
              { n: sessions.stats.totalSessions, label: "All time", emoji: "🏆" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black" style={{ color: "#fb7185" }}>{s.n}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-sub)" }}>{s.label}</p>
              </div>
            ))}
          </div>
          {settings.weeklyGoal && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(225,29,72,0.2)" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs" style={{ color: "var(--text-sub)" }}>Weekly goal</p>
                <p className="text-xs font-bold" style={{ color: "#fb7185" }}>{sessions.stats.thisWeek}/{settings.weeklyGoal}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(225,29,72,0.15)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (sessions.stats.thisWeek / settings.weeklyGoal) * 100)}%`, background: "#e11d48" }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl p-6 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-4xl mb-2">🌹</p>
          <p className="font-semibold" style={{ color: "var(--text-main)" }}>Welcome to your space</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-sub)" }}>Start tracking your journey</p>
        </div>
      )}

      {/* Postinor alert */}
      {!isCelibacy && postinor?.latest && !postinor.safeNow && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#f87171" }}>Postinor 2 — wait {postinor.daysToSafe} more {postinor.daysToSafe === 1 ? "day" : "days"}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.75)" }}>Safe to take again after {postinor.latest.nextSafeDate}. Taking too soon harms your cycle.</p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onSwitchTab("track")}
          className="rounded-2xl p-4 text-left transition active:scale-95"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xl mb-2">{isCelibacy ? "✅" : "📝"}</p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{isCelibacy ? "Check in today" : "Log a session"}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>Keep your streak going</p>
        </button>
        <button onClick={() => onSwitchTab("positions")}
          className="rounded-2xl p-4 text-left transition active:scale-95"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xl mb-2">🌹</p>
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Explore positions</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>Discover something new</p>
        </button>
      </div>

      {/* Recentcount warning */}
      {!isCelibacy && postinor && postinor.recentCount >= 3 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>💊 Consider regular contraception</p>
          <p className="text-xs mt-1" style={{ color: "rgba(251,191,36,0.7)" }}>
            You've used Postinor 2 {postinor.recentCount} times in the last 6 months. A doctor can recommend a method that's safer long-term.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Track Tab ─────────────────────────────────────────────────────────────────
function TrackTab({ settings }: { settings: IntimacySettings }) {
  return settings.mode === "celibacy" ? <CelibacyTrack /> : <ActiveTrack settings={settings} />;
}

function CelibacyTrack() {
  const { data, isLoading } = useCelibacyData();
  const checkin = useCelibacyCheckin();

  if (isLoading) return <Spinner />;

  const daysFree = data?.streak?.daysFree ?? 0;
  const todayDone = data?.todayCheckin != null;
  const maintained = data?.todayCheckin?.maintained;

  return (
    <div className="space-y-4">
      {/* Today check-in */}
      <div className="rounded-2xl p-5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Today's check-in</p>
        {todayDone ? (
          <div className="text-center py-2">
            <p className="text-3xl mb-1">{maintained ? "✅" : "💔"}</p>
            <p className="text-sm font-semibold" style={{ color: maintained ? "#4ade80" : "#fb7185" }}>
              {maintained ? "Logged — staying strong" : "Logged honestly"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={() => checkin.mutate({ maintained: true })} disabled={checkin.isPending}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
              {checkin.isPending ? "Saving…" : "I maintained my celibacy today ✓"}
            </button>
            <button onClick={() => checkin.mutate({ maintained: false })} disabled={checkin.isPending}
              className="w-full py-2 rounded-xl text-xs font-semibold transition active:scale-95"
              style={{ color: "var(--text-dim)" }}>
              Had a slip? Log honestly
            </button>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Milestones</p>
        <div className="grid grid-cols-4 gap-2">
          {CELIBACY_MILESTONES.map((m) => {
            const reached = daysFree >= m.days;
            return (
              <div key={m.days} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl")}
                style={{ background: reached ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", border: reached ? "1px solid rgba(34,197,94,0.3)" : "none" }}>
                <span className={cn("text-xl", !reached && "grayscale opacity-40")}>{m.emoji}</span>
                <span className="text-[9px] font-semibold text-center leading-tight"
                  style={{ color: reached ? "#4ade80" : "var(--text-dim)" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Past streaks */}
      {(data?.history?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Past streaks</p>
          <div className="space-y-2">
            {data!.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--text-sub)" }}>{h.startDate} → {h.endDate}</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(225,29,72,0.1)", color: "#fb7185" }}>
                  {h.days}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveTrack({ settings }: { settings: IntimacySettings }) {
  const { data: sessions, isLoading } = useIntimacySessions();
  const { data: postinor } = usePostinorData();
  const [showLog, setShowLog] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const DAY_CHARS = ["S","M","T","W","T","F","S"];

  if (isLoading) return <Spinner />;

  const todayLogged = sessions?.week.some((s) => s.date === today);

  return (
    <div className="space-y-4">
      {/* Log session CTA */}
      <div className="rounded-2xl p-5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Today</p>
        {todayLogged ? (
          <div className="text-center py-2">
            <p className="text-3xl mb-1">✅</p>
            <p className="text-sm font-semibold" style={{ color: "var(--text-sub)" }}>Session logged for today</p>
            <button onClick={() => setShowLog(true)} className="mt-2 text-xs font-semibold" style={{ color: "#fb7185" }}>
              Log another
            </button>
          </div>
        ) : (
          <button onClick={() => setShowLog(true)}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition active:scale-95"
            style={{ background: "var(--btn-gradient)" }}>
            Log today's session
          </button>
        )}
      </div>

      {/* Week grid */}
      {sessions && sessions.week.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>This week</p>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              const ds = d.toISOString().split("T")[0];
              const logged = sessions.week.some((s) => s.date === ds);
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{DAY_CHARS[d.getDay()]}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                    style={logged
                      ? { background: "rgba(225,29,72,0.2)", border: "1px solid rgba(225,29,72,0.4)", color: "#fb7185" }
                      : { background: "rgba(255,255,255,0.04)", color: "var(--text-dim)" }}>
                    {logged ? "💗" : "–"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STI test reminder */}
      {settings.lastStiTest && settings.stiTestIntervalMonths && (() => {
        const d = new Date(settings.lastStiTest);
        d.setMonth(d.getMonth() + settings.stiTestIntervalMonths);
        const due = d.toISOString().split("T")[0];
        const overdue = due <= today;
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
        return (
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: overdue ? "rgba(239,68,68,0.08)" : "var(--glass-bg)", border: `1px solid ${overdue ? "rgba(239,68,68,0.3)" : "var(--glass-border)"}` }}>
            <span className="text-xl">🔬</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: overdue ? "#f87171" : "var(--text-main)" }}>
                {overdue ? "STI test overdue!" : `STI test due in ${daysLeft} days`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>Every {settings.stiTestIntervalMonths} months</p>
            </div>
          </div>
        );
      })()}

      {/* Postinor tracker */}
      <div className="rounded-2xl p-5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Postinor 2 tracker</p>
        {postinor?.latest ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--text-sub)" }}>Last taken</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{postinor.latest.takenAt as string}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--text-sub)" }}>Safe to take again</p>
              <p className="text-sm font-semibold" style={{ color: postinor.safeNow ? "#4ade80" : "#fb7185" }}>
                {postinor.safeNow ? "✅ Now" : postinor.latest.nextSafeDate as string}
              </p>
            </div>
            {!postinor.safeNow && (
              <div className="rounded-xl p-3 text-center"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p className="text-sm font-bold" style={{ color: "#f87171" }}>{postinor.daysToSafe} days to go</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.7)" }}>Taking too soon disrupts your hormones and cycle</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-center py-2" style={{ color: "var(--text-dim)" }}>No Postinor 2 logged yet</p>
        )}
      </div>

      {showLog && <LogSessionModal onClose={() => setShowLog(false)} freakyEnabled={settings.freakyMode} />}
    </div>
  );
}

// ── Log session modal ─────────────────────────────────────────────────────────
function LogSessionModal({ onClose, freakyEnabled }: { onClose: () => void; freakyEnabled: boolean }) {
  const log = useLogSession();
  const [type, setType] = useState<"solo" | "partnered">("partnered");
  const [duration, setDuration] = useState<"quick" | "moderate" | "long" | "">("");
  const [protection, setProtection] = useState<boolean | null>(null);
  const [postinor, setPostinor] = useState(false);
  const [satisfaction, setSatisfaction] = useState(0);
  const [connection, setConnection] = useState(0);
  const [libido, setLibido] = useState(0);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  const durationMap: Record<string, number> = { quick: 10, moderate: 30, long: 60 };

  function togglePosition(id: string) {
    setSelectedPositions((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 5));
  }

  function handleSave() {
    log.mutate({
      type,
      durationMinutes: duration ? durationMap[duration] : undefined,
      protectionUsed: protection ?? undefined,
      postinorTaken: postinor,
      satisfaction: satisfaction || undefined,
      emotionalConnection: connection || undefined,
      libidoLevel: libido || undefined,
      positionIds: selectedPositions.length ? selectedPositions : undefined,
    }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
        style={{ background: "#1a0008", border: "1px solid rgba(225,29,72,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="px-5 pt-5 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Log session</h3>
            <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-sub)" }} /></button>
          </div>

          <div className="space-y-5">
            {/* Type */}
            <Field label="Type">
              <div className="grid grid-cols-2 gap-2">
                {(["partnered","solo"] as const).map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className="py-3 rounded-xl text-sm font-semibold transition active:scale-95 capitalize"
                    style={type === t
                      ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                      : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
                    {t === "partnered" ? "💑 Partnered" : "🙋 Solo"}
                  </button>
                ))}
              </div>
            </Field>

            {/* Duration */}
            <Field label="How long?">
              <div className="grid grid-cols-3 gap-2">
                {[["quick","Quick","< 15 min"],["moderate","Moderate","15–45 min"],["long","Long","45+ min"]].map(([id, label, hint]) => (
                  <button key={id} onClick={() => setDuration(id === duration ? "" : id as typeof duration)}
                    className="py-3 rounded-xl text-xs font-semibold transition active:scale-95 text-center"
                    style={duration === id
                      ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                      : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
                    {label}<br /><span style={{ opacity: 0.6 }}>{hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            {/* Protection */}
            <Field label="Protection used?">
              <div className="grid grid-cols-2 gap-2">
                {([[true,"Yes 🛡️"],[false,"No"]] as [boolean,string][]).map(([v,label]) => (
                  <button key={String(v)} onClick={() => setProtection(protection === v ? null : v)}
                    className="py-3 rounded-xl text-sm font-semibold transition active:scale-95"
                    style={protection === v
                      ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                      : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Ratings */}
            {[
              { label: "Satisfaction", val: satisfaction, set: setSatisfaction },
              { label: "Emotional connection", val: connection, set: setConnection },
              { label: "Libido level", val: libido, set: setLibido },
            ].map(({ label, val, set }) => (
              <Field key={label} label={label}>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} onClick={() => set(val === n ? 0 : n)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
                      style={val >= n
                        ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                        : { background: "var(--glass-bg)", color: "var(--text-dim)", border: "1px solid var(--glass-border)" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
            ))}

            {/* Positions (freaky mode) */}
            {freakyEnabled && (
              <Field label="Positions (optional)">
                <button onClick={() => setShowPositionPicker((p) => !p)}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition active:scale-95"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-sub)" }}>
                  {selectedPositions.length > 0
                    ? `${selectedPositions.length} selected — tap to change`
                    : "Select positions"}
                </button>
                {showPositionPicker && (
                  <div className="mt-2 grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {POSITIONS.map((p) => (
                      <button key={p.id} onClick={() => togglePosition(p.id)}
                        className="py-2 px-1 rounded-xl text-[10px] font-semibold transition active:scale-95 text-center"
                        style={selectedPositions.includes(p.id)
                          ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                          : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}

            {/* Postinor */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Took Postinor 2?</p>
                <p className="text-xs" style={{ color: "var(--text-sub)" }}>Emergency contraception</p>
              </div>
              <button onClick={() => setPostinor((p) => !p)}
                className="w-12 h-6 rounded-full transition-all relative"
                style={{ background: postinor ? "#e11d48" : "rgba(255,255,255,0.1)" }}>
                <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all", postinor ? "left-6" : "left-0.5")} />
              </button>
            </div>

            <button onClick={handleSave} disabled={log.isPending}
              className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: "var(--btn-gradient)" }}>
              {log.isPending ? "Saving…" : "Save session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Positions Tab ─────────────────────────────────────────────────────────────
function PositionsTab({ freakyEnabled }: { freakyEnabled: boolean }) {
  const update = useUpdateIntimacySettings();
  const { data: statsData } = usePositionStats();
  const [filter, setFilter] = useState<string>("all");

  const statsMap = new Map((statsData?.stats ?? []).map((s) => [s.positionId, s]));
  const categories = ["all", "classic", "intimate", "elevated", "adventurous"];

  const filtered = POSITIONS.filter((p) => filter === "all" || p.category === filter);
  const sorted = [...filtered].sort((a, b) => {
    const ca = statsMap.get(a.id)?.count ?? 0;
    const cb = statsMap.get(b.id)?.count ?? 0;
    return cb - ca;
  });

  if (!freakyEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-5xl mb-4">🔓</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Unlock Explore Mode</h2>
        <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: "var(--text-sub)" }}>
          Enable the position explorer to discover, log, and get recommendations based on your preferences.
        </p>
        <button
          onClick={() => update.mutate({ freakyMode: true })}
          disabled={update.isPending}
          className="px-8 py-3.5 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--btn-gradient)" }}>
          {update.isPending ? "Enabling…" : "Enable Explore Mode"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top positions */}
      {statsMap.size > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-sub)" }}>Your favourites</p>
          <div className="space-y-2">
            {[...statsMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([id, stat], i) => {
              const pos = POSITIONS.find((p) => p.id === id);
              if (!pos) return null;
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-sm font-black w-5" style={{ color: "#fb7185" }}>#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{pos.name}</p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-sub)" }}>{stat.count}×</span>
                  {stat.avgSatisfaction && (
                    <span className="text-xs font-bold" style={{ color: "#fb7185" }}>★{stat.avgSatisfaction}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className="whitespace-nowrap py-1.5 px-3 rounded-full text-xs font-semibold transition capitalize"
            style={filter === c
              ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
              : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Position grid */}
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((pos) => {
          const stat = statsMap.get(pos.id);
          const tried = !!stat;
          return (
            <div key={pos.id} className="rounded-2xl overflow-hidden relative"
              style={{ background: "linear-gradient(135deg,#1a0008,#2d0010)", border: `1px solid ${tried ? "rgba(225,29,72,0.4)" : "rgba(225,29,72,0.15)"}` }}>
              {/* SVG art */}
              <div className="h-24 w-full p-2">
                <PositionSVG id={pos.id} />
              </div>
              {/* Info */}
              <div className="px-3 pb-3">
                <p className="font-bold text-sm" style={{ color: "var(--text-main)" }}>{pos.name}</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "var(--text-sub)" }}>{pos.desc}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full capitalize"
                    style={{ background: "rgba(225,29,72,0.12)", color: "#fb7185" }}>
                    {pos.category}
                  </span>
                  {tried && (
                    <span className="text-[9px] font-bold" style={{ color: "var(--text-sub)" }}>
                      {stat.count}× {stat.avgSatisfaction ? `★${stat.avgSatisfaction}` : ""}
                    </span>
                  )}
                </div>
              </div>
              {/* Difficulty dots */}
              <div className="absolute top-2 right-2 flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i < pos.difficulty ? "#e11d48" : "rgba(255,255,255,0.15)" }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Partner Tab ───────────────────────────────────────────────────────────────
function PartnerTab() {
  const { data, isLoading } = usePartnerData();
  const generate = useGenerateInvite();
  const join = useJoinPartner();
  const disconnect = useDisconnectPartner();
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [joinError, setJoinError] = useState("");

  if (isLoading) return <Spinner />;

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function handleGenerate() {
    generate.mutate(undefined, { onSuccess: (d) => setCode((d as { code: string }).code) });
  }

  function handleJoin() {
    setJoinError("");
    join.mutate(joinCode.toUpperCase(), {
      onError: (e) => setJoinError((e as Error).message),
    });
  }

  if (data?.hasPartner && data.partner) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl p-6 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1a0008,#3d001a)", border: "1px solid rgba(225,29,72,0.3)" }}>
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full" style={{ background: "radial-gradient(circle,rgba(225,29,72,0.15),transparent)" }} />
          <div className="text-4xl mb-3">💑</div>
          <p className="font-bold text-lg" style={{ color: "var(--text-main)" }}>Connected with</p>
          <p className="text-2xl font-black mt-1" style={{ color: "#fb7185" }}>{data.partner.displayName}</p>
          <p className="text-xs mt-2" style={{ color: "var(--text-sub)" }}>Your private space is linked</p>
        </div>

        <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition active:scale-95 disabled:opacity-50"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
          {disconnect.isPending ? "Disconnecting…" : "Disconnect partner"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-3xl mb-2">🔗</p>
        <p className="font-bold" style={{ color: "var(--text-main)" }}>Invite your partner</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-sub)" }}>
          Generate a 6-character code. Your partner enters it in their app to connect your spaces.
        </p>
      </div>

      {/* Generate invite */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>Your invite code</p>
        {code || data?.pendingInvite?.code ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 py-3 px-4 rounded-xl text-center">
              <p className="text-3xl font-black tracking-widest" style={{ color: "#fb7185" }}>
                {code || data?.pendingInvite?.code}
              </p>
            </div>
            <button onClick={handleCopy}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-95"
              style={{ background: "rgba(225,29,72,0.15)", border: "1px solid rgba(225,29,72,0.3)" }}>
              {copied ? <Check className="w-4 h-4" style={{ color: "#4ade80" }} /> : <Copy className="w-4 h-4" style={{ color: "#fb7185" }} />}
            </button>
          </div>
        ) : null}
        <button onClick={handleGenerate} disabled={generate.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--btn-gradient)" }}>
          {generate.isPending ? "Generating…" : (code || data?.pendingInvite ? "Generate new code" : "Generate invite code")}
        </button>
        <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>Code expires after 24 hours</p>
      </div>

      {/* Join */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>Have a code?</p>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="ENTER CODE"
          className="w-full py-3 px-4 rounded-xl text-center text-2xl font-black tracking-widest outline-none"
          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }}
          maxLength={6}
        />
        {joinError && <p className="text-sm text-red-400 text-center">{joinError}</p>}
        <button onClick={handleJoin} disabled={join.isPending || joinCode.length < 6}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
          style={{ background: "var(--btn-gradient)" }}>
          {join.isPending ? "Joining…" : "Join partner space"}
        </button>
      </div>
    </div>
  );
}

// ── Settings sheet ────────────────────────────────────────────────────────────
function SettingsSheet({ settings, onClose }: { settings: IntimacySettings; onClose: () => void }) {
  const update = useUpdateIntimacySettings();
  const { account } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState(settings.mode);
  const [weeklyGoal, setWeeklyGoal] = useState(String(settings.weeklyGoal ?? ""));
  const [contraception, setContraception] = useState(settings.contraception ?? "");
  const [stiInterval, setStiInterval] = useState(String(settings.stiTestIntervalMonths));
  const [lastStiTest, setLastStiTest] = useState(settings.lastStiTest ?? "");
  const [celibacyStart, setCelibacyStart] = useState(new Date().toISOString().split("T")[0]);

  function handleSave() {
    update.mutate({
      mode,
      weeklyGoal: weeklyGoal ? parseInt(weeklyGoal) : null,
      contraception: contraception || null,
      stiTestIntervalMonths: parseInt(stiInterval) || 6,
      lastStiTest: lastStiTest || null,
      celibacyStartDate: mode === "celibacy" ? celibacyStart : undefined,
    }, { onSuccess: onClose });
  }

  function handleLockAndLeave() {
    if (account) clearIntimacyUnlocked(account.id);
    navigate("/");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
        style={{ background: "#1a0008", border: "1px solid rgba(225,29,72,0.25)", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="px-5 pt-5 pb-8 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>Settings</h3>
            <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-sub)" }} /></button>
          </div>

          <Field label="Mode">
            <div className="grid grid-cols-2 gap-2">
              {(["active","celibacy"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className="py-3 rounded-xl text-sm font-semibold capitalize transition active:scale-95"
                  style={mode === m
                    ? { background: "rgba(225,29,72,0.2)", color: "#fb7185", border: "1px solid rgba(225,29,72,0.4)" }
                    : { background: "var(--glass-bg)", color: "var(--text-sub)", border: "1px solid var(--glass-border)" }}>
                  {m === "active" ? "💗 Active" : "🌿 Celibacy"}
                </button>
              ))}
            </div>
          </Field>

          {mode === "celibacy" && (
            <Field label="New celibacy start date">
              <input type="date" value={celibacyStart} onChange={(e) => setCelibacyStart(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
            </Field>
          )}

          {mode === "active" && (
            <>
              <Field label="Weekly frequency goal">
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 3"
                  className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
              </Field>
              <Field label="Contraception method">
                <input value={contraception} onChange={(e) => setContraception(e.target.value)}
                  placeholder="e.g. Condom, Pill, IUD..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
              </Field>
              <Field label="Last STI test">
                <input type="date" value={lastStiTest} onChange={(e) => setLastStiTest(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
              </Field>
              <Field label="STI test reminder (months)">
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={stiInterval}
                  onChange={(e) => setStiInterval(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl px-4 py-3 text-base font-semibold outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
              </Field>
            </>
          )}

          <button onClick={handleSave} disabled={update.isPending}
            className="w-full py-4 rounded-2xl font-bold text-base text-white transition active:scale-95 disabled:opacity-50"
            style={{ background: "var(--btn-gradient)" }}>
            {update.isPending ? "Saving…" : "Save settings"}
          </button>

          <button onClick={handleLockAndLeave}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-dim)", border: "1px solid var(--glass-border)" }}>
            🔒 Lock & leave
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-sub)" }}>{label}</p>
      {children}
    </div>
  );
}

function PinPad({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-sub)" }}>{label}</p>
      <input type="password" inputMode="numeric" value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="••••"
        className="w-full rounded-xl px-4 py-3 text-2xl font-bold text-center tracking-[0.5em] outline-none"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }} />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#e11d48", borderTopColor: "transparent" }} />
    </div>
  );
}
