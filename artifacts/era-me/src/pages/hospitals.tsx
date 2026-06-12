import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Plus, Search, ArrowLeft, X, ChevronRight, Trash2, MessageCircle, Send, Calendar, CheckCircle2 } from "lucide-react";
import {
  useMyHospitals,
  useHospitalSearch,
  useRequestConnection,
  useVerifyConnection,
  useRemoveConnection,
  useHospitalMessages,
  useSendMessage,
  useUnreadCounts,
  type HospitalSearchResult,
  type HospitalConnection,
} from "@/lib/hospitals-api";

// ── Main hospitals page ────────────────────────────────────────────────────────
export default function HospitalsPage() {
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [chatConnectionId, setChatConnectionId] = useState<number | null>(null);
  const { data: connections, isLoading } = useMyHospitals();
  const { data: unread = {} } = useUnreadCounts();
  const removeConnection = useRemoveConnection();

  if (chatConnectionId !== null) {
    const conn = connections?.find((c) => c.connectionId === chatConnectionId);
    if (conn) {
      return <HospitalChatPage connection={conn} onBack={() => setChatConnectionId(null)} />;
    }
  }

  if (showAddFlow) {
    return <AddHospitalFlow onDone={() => setShowAddFlow(false)} />;
  }

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ background: "linear-gradient(135deg,var(--text-main),#7dd3fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Hospitals
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
            {connections?.length ?? 0} connected · Search & message your hospital
          </p>
        </div>
        <button onClick={() => setShowAddFlow(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", border: "1px solid rgba(96,165,250,0.3)", boxShadow: "0 4px 16px rgba(30,64,175,0.4)" }}>
          <Plus className="w-4 h-4" />
          Connect
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => (
            <HospitalCard
              key={conn.connectionId}
              conn={conn}
              unreadCount={unread[conn.connectionId] ?? 0}
              removing={removingId === conn.connectionId && removeConnection.isPending}
              onChat={() => setChatConnectionId(conn.connectionId)}
              onRemove={() => {
                setRemovingId(conn.connectionId);
                removeConnection.mutate(conn.connectionId, { onSettled: () => setRemovingId(null) });
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyHospitals onAdd={() => setShowAddFlow(true)} />
      )}
    </div>
  );
}

// ── Connected hospital card ────────────────────────────────────────────────────
function HospitalCard({ conn, unreadCount, removing, onChat, onRemove }: {
  conn: HospitalConnection;
  unreadCount: number;
  removing: boolean;
  onChat: () => void;
  onRemove: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--glass-bg)", border: "1px solid rgba(96,165,250,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
      {/* Hospital header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", border: "1px solid rgba(96,165,250,0.3)" }}>
          {conn.hospitalLogo ? (
            <img src={conn.hospitalLogo} alt={conn.hospitalName} className="w-10 h-10 rounded-xl object-contain" />
          ) : (
            <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{conn.hospitalName}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-sub)" }}>{conn.patientName}</p>
          <div className="flex gap-2 mt-1.5">
            {conn.stage && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(20,184,166,0.15)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.25)" }}>
                {conn.stage}
              </span>
            )}
            {conn.department && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
                {conn.department}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setShowOptions((p) => !p)} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ChevronRight className={`w-4 h-4 transition-transform ${showOptions ? "rotate-90" : ""}`} style={{ color: "var(--text-sub)" }} />
        </button>
      </div>

      {/* Action row */}
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={onChat}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition relative"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", border: "1px solid rgba(96,165,250,0.25)", color: "#fff" }}>
          <MessageCircle className="w-4 h-4" />
          Messages
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: "#ef4444", color: "#fff" }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <button onClick={onChat}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition"
          style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", color: "#14b8a6" }}>
          <Calendar className="w-4 h-4" />
          Book
        </button>
      </div>

      {/* Remove option */}
      {showOptions && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <button onClick={onRemove} disabled={removing}
            className="flex items-center gap-2 text-xs font-semibold mt-3 active:opacity-70 transition disabled:opacity-50"
            style={{ color: "#f87171" }}>
            <Trash2 className="w-3.5 h-3.5" />
            {removing ? "Removing…" : "Remove this connection"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Hospital chat page ─────────────────────────────────────────────────────────
function HospitalChatPage({ connection, onBack }: { connection: HospitalConnection; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [bookReason, setBookReason] = useState("");
  const [bookDate, setBookDate] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useHospitalMessages(connection.connectionId);
  const sendMessage = useSendMessage(connection.connectionId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = message.trim();
    if (!text || sendMessage.isPending) return;
    setMessage("");
    sendMessage.mutate({ content: text, messageType: "text" });
  }

  function handleBookConsultation() {
    if (!bookReason.trim()) return;
    const content = `📅 Consultation Request\n\nReason: ${bookReason.trim()}${bookDate ? `\nPreferred date: ${bookDate}` : ""}`;
    sendMessage.mutate({
      content,
      messageType: "consultation_request",
      metadata: { reason: bookReason.trim(), preferredDate: bookDate || null },
    });
    setShowBook(false);
    setBookReason("");
    setBookDate("");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)", background: "rgba(var(--glow-rgb),0.02)", backdropFilter: "blur(20px)" }}>
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--text-sub)" }} />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
          {connection.hospitalLogo
            ? <img src={connection.hospitalLogo} alt={connection.hospitalName} className="w-7 h-7 rounded-lg object-contain" />
            : <Building2 className="w-4 h-4" style={{ color: "#60a5fa" }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{connection.hospitalName}</p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-sub)" }}>Hospital messaging</p>
        </div>
        <button onClick={() => setShowBook(!showBook)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition"
          style={{ background: showBook ? "rgba(20,184,166,0.2)" : "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", color: "#14b8a6" }}>
          <Calendar className="w-3.5 h-3.5" />
          Book
        </button>
      </div>

      {/* Book consultation form */}
      {showBook && (
        <div className="mx-4 mt-3 p-4 rounded-2xl shrink-0"
          style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text-main)" }}>📅 Request a consultation</p>
          <textarea
            value={bookReason}
            onChange={(e) => setBookReason(e.target.value)}
            placeholder="What's the reason for your visit?"
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-2"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", caretColor: "#14b8a6", color: "var(--text-main)" }}
          />
          <input
            type="date"
            value={bookDate}
            onChange={(e) => setBookDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)" }}
          />
          <div className="flex gap-2">
            <button onClick={() => setShowBook(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
              style={{ background: "var(--glass-bg)", color: "var(--text-sub)" }}>
              Cancel
            </button>
            <button onClick={handleBookConsultation} disabled={!bookReason.trim() || sendMessage.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 4px 12px rgba(20,184,166,0.3)" }}>
              Send request
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p style={{ fontSize: 44, marginBottom: 12 }}>💬</p>
            <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 15, marginBottom: 6 }}>No messages yet</p>
            <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.5 }}>
              Send a message to {connection.hospitalName} or book a consultation above.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} hospitalName={connection.hospitalName} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <div className="px-4 py-4 shrink-0"
        style={{ borderTop: "1px solid var(--glass-border)", background: "rgba(var(--glow-rgb),0.02)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${connection.hospitalName}…`}
            rows={1}
            className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              color: "var(--text-main)",
              caretColor: "#14b8a6",
              maxHeight: 120,
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 transition disabled:opacity-40 shrink-0"
            style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 4px 12px rgba(30,64,175,0.4)" }}>
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, hospitalName }: { message: import("@/lib/hospitals-api").HospitalMessage; hospitalName: string }) {
  const isPatient = message.sender === "patient";
  const isConsultation = message.message_type === "consultation_request";
  const time = new Date(message.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
      <div style={{ maxWidth: "80%" }}>
        {!isPatient && (
          <p style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4, paddingLeft: 4 }}>{hospitalName}</p>
        )}
        <div className="rounded-2xl px-4 py-3"
          style={{
            background: isPatient
              ? isConsultation ? "linear-gradient(135deg,#0d9488,#14b8a6)" : "linear-gradient(135deg,#1e3a5f,#1e40af)"
              : "rgba(255,255,255,0.07)",
            border: isPatient ? "none" : "1px solid var(--glass-border)",
            borderTopRightRadius: isPatient ? 4 : 16,
            borderTopLeftRadius: isPatient ? 16 : 4,
          }}>
          {isConsultation && (
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-white opacity-80" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Consultation Request
              </span>
            </div>
          )}
          <p style={{ fontSize: 14, color: isPatient ? "#fff" : "var(--text-main)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{message.content}</p>
          <p style={{ fontSize: 10, color: isPatient ? "rgba(255,255,255,0.65)" : "var(--text-dim)", marginTop: 4, textAlign: isPatient ? "right" : "left" }}>{time}</p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyHospitals({ onAdd }: { onAdd: () => void }) {
  return (
    <div>
      <div className="rounded-2xl p-7 text-center mb-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <p style={{ fontSize: 48, marginBottom: 14 }}>🏥</p>
        <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 16, marginBottom: 8 }}>No hospitals connected</p>
        <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.55, marginBottom: 22 }}>
          Connect your hospital to see your records, message your care team, and book consultations — all in one place.
        </p>
        <button onClick={onAdd}
          className="px-7 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 6px 20px rgba(30,64,175,0.4)", border: "1px solid rgba(96,165,250,0.3)" }}>
          Connect a hospital →
        </button>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.18)" }}>
        <p className="text-sm font-bold mb-1" style={{ color: "var(--text-main)" }}>How it works</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
          Search for your hospital, enter your patient ID, and we'll send a verification code to the email your hospital has on file. Once verified, you can message your care team directly.
        </p>
      </div>
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
      { hospitalId: selectedHospital.id, patientRecordId: patientRecordId.trim() },
      {
        onSuccess: (data) => { setMaskedEmail(data.maskedEmail); setPatientName(data.patientName); setStep("otp"); },
        onError: (err) => setError(err.message),
      }
    );
  }

  function handleVerifyOtp() {
    if (!selectedHospital || !otp.trim()) return;
    setError("");
    verifyConnection.mutate(
      { hospitalId: selectedHospital.id, patientRecordId: patientRecordId.trim(), otp: otp.trim() },
      {
        onSuccess: () => setStep("done"),
        onError: (err) => setError(err.message),
      }
    );
  }

  if (step === "done") {
    return (
      <div className="px-4 pt-16 pb-8 flex flex-col items-center text-center">
        <p style={{ fontSize: 60, marginBottom: 20 }}>🏥</p>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Hospital connected!</p>
        <p style={{ fontSize: 14, color: "var(--text-sub)", marginBottom: 8 }}>
          <strong style={{ color: "var(--text-main)" }}>{selectedHospital?.name}</strong> has been linked to your ERA Health account.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-sub)", marginBottom: 32 }}>
          Your records for <strong style={{ color: "var(--text-main)" }}>{patientName}</strong> are now accessible.
        </p>
        <button onClick={onDone}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 8px 24px rgba(30,64,175,0.4)" }}>
          Go to messages →
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <button onClick={step === "search" ? onDone : () => { setStep(step === "otp" ? "patientId" : "search"); setError(""); }}
        className="flex items-center gap-1.5 mb-6" style={{ color: "var(--text-sub)", fontSize: 13, fontWeight: 500 }}>
        <ArrowLeft className="w-4 h-4" />
        {step === "search" ? "Cancel" : "Previous step"}
      </button>

      {/* Step dots */}
      <div className="flex items-center gap-2 mb-8">
        {(["search", "patientId", "otp"] as AddStep[]).map((s, i) => {
          const stepIdx = ["search", "patientId", "otp"].indexOf(step);
          const isDone = i < stepIdx;
          const isCurrent = s === step;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition"
                style={{
                  background: isCurrent ? "linear-gradient(135deg,#1e3a5f,#1e40af)" : isDone ? "rgba(20,184,166,0.2)" : "var(--glass-bg)",
                  border: isCurrent ? "1px solid rgba(96,165,250,0.5)" : isDone ? "1px solid rgba(20,184,166,0.4)" : "1px solid var(--glass-border)",
                  color: isCurrent ? "#fff" : isDone ? "#14b8a6" : "var(--text-dim)",
                }}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 2 && <div className="w-6 h-px" style={{ background: isDone ? "rgba(20,184,166,0.4)" : "var(--glass-border)" }} />}
            </div>
          );
        })}
      </div>

      {step === "search" && <SearchStep onSelect={handleSelectHospital} />}
      {step === "patientId" && selectedHospital && (
        <PatientIdStep
          hospital={selectedHospital} patientRecordId={patientRecordId}
          onChange={setPatientRecordId} onSubmit={handleRequestOtp}
          loading={requestConnection.isPending} error={error}
        />
      )}
      {step === "otp" && selectedHospital && (
        <OtpStep
          hospital={selectedHospital} maskedEmail={maskedEmail} otp={otp}
          onChange={setOtp} onSubmit={handleVerifyOtp} onResend={handleRequestOtp}
          loading={verifyConnection.isPending} resending={requestConnection.isPending} error={error}
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
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Find your hospital</h2>
      <p className="text-sm mb-5" style={{ color: "var(--text-sub)" }}>Search by hospital name</p>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-dim)" }} />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Lagos University Teaching Hospital"
          className="w-full rounded-2xl pl-10 pr-10 py-3.5 text-sm outline-none"
          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", caretColor: "#60a5fa", color: "var(--text-main)" }}
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
          </button>
        )}
      </div>

      {isFetching && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
        </div>
      )}
      {!isFetching && results && results.length === 0 && q.length >= 2 && (
        <div className="text-center py-10">
          <p style={{ fontSize: 36, marginBottom: 10 }}>🏥</p>
          <p className="font-bold mb-1" style={{ color: "var(--text-main)" }}>No hospitals found</p>
          <p className="text-sm" style={{ color: "var(--text-sub)" }}>Try a different spelling or shorter search.</p>
        </div>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((h) => (
            <button key={h.id} onClick={() => onSelect(h)}
              className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.98] transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
                {h.logo_url
                  ? <img src={h.logo_url} alt={h.name} className="w-8 h-8 rounded-lg object-contain" />
                  : <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
                }
              </div>
              <p className="flex-1 font-semibold text-sm" style={{ color: "var(--text-main)" }}>{h.name}</p>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            </button>
          ))}
        </div>
      )}
      {q.length < 2 && (
        <p className="text-center text-sm py-8" style={{ color: "var(--text-dim)" }}>Type at least 2 characters to search</p>
      )}
    </div>
  );
}

// ── Step: patient ID ───────────────────────────────────────────────────────────
function PatientIdStep({ hospital, patientRecordId, onChange, onSubmit, loading, error }: {
  hospital: HospitalSearchResult; patientRecordId: string; onChange: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
          <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Connecting to</p>
          <p className="font-semibold text-sm" style={{ color: "var(--text-main)" }}>{hospital.name}</p>
        </div>
      </div>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Enter your patient ID</h2>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-sub)" }}>
        Your patient ID is on your clinic card, appointment slip, or ask a staff member.
      </p>
      <input type="text" value={patientRecordId} onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1234 or P001-2024"
        className="w-full rounded-2xl px-4 py-4 text-2xl font-bold text-center outline-none mb-3"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", caretColor: "#60a5fa", color: "var(--text-main)" }}
      />
      {error && (
        <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>
        </div>
      )}
      <p className="text-xs text-center mb-5" style={{ color: "var(--text-dim)" }}>
        We'll send a code to the email {hospital.name} has on file.
      </p>
      <button onClick={onSubmit} disabled={!patientRecordId.trim() || loading}
        className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 6px 20px rgba(30,64,175,0.4)" }}>
        {loading ? "Looking up record…" : "Send verification code"}
      </button>
    </div>
  );
}

// ── Step: OTP ──────────────────────────────────────────────────────────────────
function OtpStep({ hospital, maskedEmail, otp, onChange, onSubmit, onResend, loading, resending, error }: {
  hospital: HospitalSearchResult; maskedEmail: string; otp: string; onChange: (v: string) => void;
  onSubmit: () => void; onResend: () => void; loading: boolean; resending: boolean; error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
          <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Connecting to</p>
          <p className="font-semibold text-sm" style={{ color: "var(--text-main)" }}>{hospital.name}</p>
        </div>
      </div>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Enter the code</h2>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-sub)" }}>
        We sent a 6-digit code to <strong style={{ color: "var(--text-main)" }}>{maskedEmail}</strong>
      </p>
      <input type="text" inputMode="numeric" maxLength={6} value={otp}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="w-full rounded-2xl px-4 py-4 text-3xl font-bold text-center outline-none mb-3"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", letterSpacing: "0.4em", caretColor: "#60a5fa", color: "var(--text-main)" }}
      />
      {error && (
        <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p>
        </div>
      )}
      <button onClick={onSubmit} disabled={otp.length !== 6 || loading}
        className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-60 mb-4"
        style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 6px 20px rgba(30,64,175,0.4)" }}>
        {loading ? "Verifying…" : "Verify & connect"}
      </button>
      <button onClick={onResend} disabled={resending}
        className="w-full py-2 text-sm font-semibold disabled:opacity-50"
        style={{ color: "var(--text-sub)" }}>
        {resending ? "Sending…" : "Didn't receive it? Resend code"}
      </button>
      <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
        Code expires in 10 minutes. Check spam folder if not received.
      </p>
    </div>
  );
}
