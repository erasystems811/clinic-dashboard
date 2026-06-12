import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Building2, Plus, Crown, Search, ArrowLeft, X, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  useMyHospitals,
  useHospitalSearch,
  useRequestConnection,
  useVerifyConnection,
  useRemoveConnection,
  type HospitalSearchResult,
  type HospitalConnection,
} from "@/lib/hospitals-api";

// ── Top-level page ─────────────────────────────────────────────────────────────
export default function HospitalsPage() {
  const { account } = useAuth();
  const isPremium = account?.isPremium ?? false;
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const { data: connections, isLoading } = useMyHospitals();
  const removeConnection = useRemoveConnection();

  if (!isPremium) {
    return (
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground mb-6">Hospitals</h1>
        <div className="bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Premium Feature</h2>
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Connect your hospital accounts to see your care plans, appointments, and treatment details — all in one place.
          </p>
          <Link href="/pricing">
            <button className="w-full py-3.5 bg-amber-500 text-white rounded-2xl font-semibold text-sm transition active:scale-95">
              Unlock with ERA Premium
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (showAddFlow) {
    return <AddHospitalFlow onDone={() => setShowAddFlow(false)} />;
  }

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Hospitals</h1>
        <button onClick={() => setShowAddFlow(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95">
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => (
            <HospitalCard
              key={conn.connectionId}
              conn={conn}
              removing={removingId === conn.connectionId && removeConnection.isPending}
              onRemove={() => {
                setRemovingId(conn.connectionId);
                removeConnection.mutate(conn.connectionId, { onSettled: () => setRemovingId(null) });
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-2">No hospitals connected</p>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
              Add a hospital to view your records, care plan, and appointment history.
            </p>
            <button onClick={() => setShowAddFlow(true)}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold transition active:scale-95">
              Add your first hospital
            </button>
          </div>

          <div className="mt-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
              <strong>How it works:</strong> Search for your hospital, enter your patient ID, and we'll send a code to the email your hospital has on file to verify it's you.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Connected hospital card ────────────────────────────────────────────────────
function HospitalCard({ conn, removing, onRemove }: { conn: HospitalConnection; removing: boolean; onRemove: () => void }) {
  const [showRemove, setShowRemove] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          {conn.hospitalLogo ? (
            <img src={conn.hospitalLogo} alt={conn.hospitalName} className="w-9 h-9 rounded-lg object-contain" />
          ) : (
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{conn.hospitalName}</p>
          <p className="text-xs text-muted-foreground">{conn.patientName}</p>
        </div>
        <button onClick={() => setShowRemove((p) => !p)}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition", showRemove && "rotate-90")} />
        </button>
      </div>

      <div className="flex gap-2">
        {conn.stage && (
          <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {conn.stage}
          </span>
        )}
        {conn.department && (
          <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
            {conn.department}
          </span>
        )}
      </div>

      {showRemove && (
        <div className="mt-3 pt-3 border-t border-border">
          <button onClick={onRemove} disabled={removing}
            className="flex items-center gap-2 text-xs font-semibold text-destructive disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
            {removing ? "Removing…" : "Remove this connection"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add hospital flow ─────────────────────────────────────────────────────────
type AddStep = "search" | "patientId" | "otp" | "done";

function AddHospitalFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<AddStep>("search");
  const [selectedHospital, setSelectedHospital] = useState<HospitalSearchResult | null>(null);
  const [patientRecordId, setPatientRecordId] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [error, setError] = useState("");

  const requestConnection = useRequestConnection();
  const verifyConnection = useVerifyConnection();

  function handleSelectHospital(h: HospitalSearchResult) {
    setSelectedHospital(h);
    setStep("patientId");
    setError("");
  }

  function handleRequestOtp() {
    if (!selectedHospital || !patientRecordId.trim()) return;
    setError("");
    requestConnection.mutate(
      { hospitalId: selectedHospital.id, patientRecordId: parseInt(patientRecordId, 10) },
      {
        onSuccess: (data) => {
          setMaskedEmail(data.maskedEmail);
          setPatientName(data.patientName);
          setStep("otp");
        },
        onError: (err) => setError(err.message),
      }
    );
  }

  function handleVerifyOtp() {
    if (!selectedHospital || !otp.trim()) return;
    setError("");
    verifyConnection.mutate(
      { hospitalId: selectedHospital.id, patientRecordId: parseInt(patientRecordId, 10), otp: otp.trim() },
      {
        onSuccess: () => setStep("done"),
        onError: (err) => setError(err.message),
      }
    );
  }

  if (step === "done") {
    return (
      <div className="px-5 pt-16 pb-8 flex flex-col items-center text-center">
        <div className="text-6xl mb-6">🏥</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Hospital connected!</h2>
        <p className="text-muted-foreground text-sm mb-2">
          <strong>{selectedHospital?.name}</strong> has been linked to your ERA Me account.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Your records for <strong>{patientName}</strong> are now accessible.
        </p>
        <button onClick={onDone}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95">
          Back to hospitals
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <button onClick={step === "search" ? onDone : () => { setStep(step === "otp" ? "patientId" : "search"); setError(""); }}
        className="flex items-center gap-1.5 text-muted-foreground mb-6 -ml-1">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">{step === "search" ? "Back" : "Previous step"}</span>
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(["search", "patientId", "otp"] as AddStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition",
              step === s ? "bg-primary text-primary-foreground"
                : (["patientId", "otp"] as AddStep[]).indexOf(step) > i ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-border w-6" />}
          </div>
        ))}
      </div>

      {step === "search" && <SearchStep onSelect={handleSelectHospital} />}
      {step === "patientId" && selectedHospital && (
        <PatientIdStep
          hospital={selectedHospital}
          patientRecordId={patientRecordId}
          onChange={setPatientRecordId}
          onSubmit={handleRequestOtp}
          loading={requestConnection.isPending}
          error={error}
        />
      )}
      {step === "otp" && selectedHospital && (
        <OtpStep
          hospital={selectedHospital}
          maskedEmail={maskedEmail}
          otp={otp}
          onChange={setOtp}
          onSubmit={handleVerifyOtp}
          onResend={handleRequestOtp}
          loading={verifyConnection.isPending}
          resending={requestConnection.isPending}
          error={error}
        />
      )}
    </div>
  );
}

// ── Step: search ──────────────────────────────────────────────────────────────
function SearchStep({ onSelect }: { onSelect: (h: HospitalSearchResult) => void }) {
  const [q, setQ] = useState("");
  const { data: results, isFetching } = useHospitalSearch(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Find your hospital</h2>
      <p className="text-sm text-muted-foreground mb-5">Search by hospital name</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Lagos University Teaching Hospital"
          className="w-full bg-muted rounded-xl pl-9 pr-10 py-3 text-sm text-foreground outline-none"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isFetching && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isFetching && results && results.length === 0 && q.length >= 2 && (
        <div className="text-center py-8">
          <p className="text-2xl mb-2">🏥</p>
          <p className="text-foreground font-medium mb-1">No hospitals found</p>
          <p className="text-sm text-muted-foreground">Try a different spelling or a shorter search term.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((h) => (
            <button key={h.id} onClick={() => onSelect(h)}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 text-left transition active:scale-[0.98]">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                {h.logo_url ? (
                  <img src={h.logo_url} alt={h.name} className="w-8 h-8 rounded-lg object-contain" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{h.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {q.length < 2 && (
        <p className="text-center text-sm text-muted-foreground py-6">Type at least 2 characters to search</p>
      )}
    </div>
  );
}

// ── Step: patient ID ───────────────────────────────────────────────────────────
function PatientIdStep({
  hospital, patientRecordId, onChange, onSubmit, loading, error,
}: {
  hospital: HospitalSearchResult;
  patientRecordId: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Connecting to</p>
          <p className="font-semibold text-foreground text-sm">{hospital.name}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-1">Enter your patient ID</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        This is the ID number assigned to you at {hospital.name}. You can find it on your clinic card, appointment slip, or ask a staff member.
      </p>

      <input
        type="number"
        inputMode="numeric"
        value={patientRecordId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter patient ID"
        className="w-full bg-muted rounded-xl px-4 py-4 text-xl font-bold text-foreground text-center outline-none mb-4 tracking-widest"
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mb-5">
        We'll send a verification code to the email address {hospital.name} has on file for this patient ID.
      </p>

      <button onClick={onSubmit} disabled={!patientRecordId.trim() || loading}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60">
        {loading ? "Looking up record…" : "Send verification code"}
      </button>
    </div>
  );
}

// ── Step: OTP ──────────────────────────────────────────────────────────────────
function OtpStep({
  hospital, maskedEmail, otp, onChange, onSubmit, onResend, loading, resending, error,
}: {
  hospital: HospitalSearchResult;
  maskedEmail: string;
  otp: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  loading: boolean;
  resending: boolean;
  error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Connecting to</p>
          <p className="font-semibold text-foreground text-sm">{hospital.name}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-1">Enter the code</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        We sent a 6-digit code to <strong className="text-foreground">{maskedEmail}</strong> — the email {hospital.name} has on file for your patient ID.
      </p>

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={otp}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="w-full bg-muted rounded-xl px-4 py-4 text-3xl font-bold text-foreground text-center outline-none mb-4 tracking-[0.5em]"
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button onClick={onSubmit} disabled={otp.length !== 6 || loading}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-base transition active:scale-95 disabled:opacity-60 mb-4">
        {loading ? "Verifying…" : "Verify & connect"}
      </button>

      <button onClick={onResend} disabled={resending}
        className="w-full py-2 text-sm text-muted-foreground font-semibold disabled:opacity-50">
        {resending ? "Sending…" : "Didn't get it? Resend code"}
      </button>

      <p className="text-xs text-muted-foreground text-center mt-3">
        The code expires in 10 minutes. Check your spam folder if you don't see it.
      </p>
    </div>
  );
}
