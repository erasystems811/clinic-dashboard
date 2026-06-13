import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Plus, Search, ArrowLeft, X, ChevronRight, Trash2, MessageCircle, Send, Calendar, CheckCircle2, Star, Clock, RefreshCw } from "lucide-react";
import {
  useMyHospitals,
  useHospitalSearch,
  useRequestConnection,
  useVerifyConnection,
  useRemoveConnection,
  useHospitalMessages,
  useSendMessage,
  useUnreadCounts,
  useBookingSlots,
  useCreateBooking,
  useMyBookings,
  useRescheduleBooking,
  type HospitalSearchResult,
  type HospitalConnection,
} from "@/lib/hospitals-api";

type HospView = "list" | "chat" | "book";

export default function HospitalsPage() {
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [view, setView] = useState<HospView>("list");
  const [activeConnectionId, setActiveConnectionId] = useState<number | null>(null);
  const { data: connections, isLoading } = useMyHospitals();
  const { data: unread = {} } = useUnreadCounts();
  const removeConnection = useRemoveConnection();

  const activeConn = connections?.find((c) => c.connectionId === activeConnectionId) ?? null;

  if (view === "chat" && activeConn) {
    return <HospitalChatPage connection={activeConn} onBack={() => { setView("list"); setActiveConnectionId(null); }} />;
  }

  if (view === "book" && activeConn) {
    return <BookingPage connection={activeConn} onBack={() => { setView("list"); setActiveConnectionId(null); }} />;
  }

  if (showAddFlow) {
    return <AddHospitalFlow onDone={() => setShowAddFlow(false)} />;
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ background: "linear-gradient(135deg,var(--text-main),#7dd3fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Hospitals
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
            {connections?.length ?? 0} connected
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
              onChat={() => { setActiveConnectionId(conn.connectionId); setView("chat"); }}
              onBook={() => { setActiveConnectionId(conn.connectionId); setView("book"); }}
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

// ── Hospital card ─────────────────────────────────────────────────────────────
function HospitalCard({ conn, unreadCount, removing, onChat, onBook, onRemove }: {
  conn: HospitalConnection; unreadCount: number; removing: boolean;
  onChat: () => void; onBook: () => void; onRemove: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--glass-bg)", border: "1px solid rgba(96,165,250,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", border: "1px solid rgba(96,165,250,0.3)" }}>
          {conn.hospitalLogo
            ? <img src={conn.hospitalLogo} alt={conn.hospitalName} className="w-10 h-10 rounded-xl object-contain" />
            : <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
          }
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
        <button onClick={() => setShowOptions(p => !p)} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ChevronRight className={`w-4 h-4 transition-transform ${showOptions ? "rotate-90" : ""}`} style={{ color: "var(--text-sub)" }} />
        </button>
      </div>

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
        <button onClick={onBook}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition"
          style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)", color: "#14b8a6" }}>
          <Calendar className="w-4 h-4" />
          Book
        </button>
      </div>

      {showOptions && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
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

// ── Booking page ──────────────────────────────────────────────────────────────
function SlotPicker({ slots, value, onChange }: {
  slots: { datetime: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const grouped: Record<string, { datetime: string; label: string }[]> = {};
  for (const s of slots) {
    const key = new Date(s.datetime).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none appearance-none"
      style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: value ? "var(--text-main)" : "var(--text-dim)" }}
    >
      <option value="">Select a date &amp; time…</option>
      {Object.entries(grouped).map(([dateLabel, daySlots]) => (
        <optgroup key={dateLabel} label={dateLabel}>
          {daySlots.map((s) => {
            const timeStr = new Date(s.datetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
            return <option key={s.datetime} value={s.datetime}>{timeStr}</option>;
          })}
        </optgroup>
      ))}
    </select>
  );
}

function BookingPage({ connection, onBack }: { connection: HospitalConnection; onBack: () => void }) {
  const [tab, setTab] = useState<"book" | "reschedule">("book");

  // Book tab state
  const [bookSlot, setBookSlot] = useState("");
  const [reason, setReason] = useState("");
  const [bookDone, setBookDone] = useState(false);

  // Reschedule tab state
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleDone, setRescheduleDone] = useState(false);

  const { data: slotsData, isLoading: slotsLoading, error: slotsError } = useBookingSlots(connection.connectionId, true);
  const { data: myBookings = [], isLoading: bookingsLoading } = useMyBookings(connection.connectionId);
  const createBooking = useCreateBooking(connection.connectionId);
  const reschedule = useRescheduleBooking(connection.connectionId);

  const slots = slotsData?.slots ?? [];

  function handleBook() {
    if (!bookSlot || !reason.trim() || createBooking.isPending) return;
    createBooking.mutate({ requestedAt: bookSlot, reason: reason.trim() }, { onSuccess: () => setBookDone(true) });
  }

  function handleReschedule() {
    if (!selectedBookingId || !rescheduleSlot || reschedule.isPending) return;
    reschedule.mutate({ bookingId: selectedBookingId, newRequestedAt: rescheduleSlot }, { onSuccess: () => setRescheduleDone(true) });
  }

  if (bookDone) {
    return (
      <div className="px-4 pt-16 pb-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(20,184,166,0.15)", border: "2px solid rgba(20,184,166,0.4)" }}>
          <CheckCircle2 className="w-10 h-10" style={{ color: "#14b8a6" }} />
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Appointment requested</p>
        <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--text-sub)" }}>
          Your request has been sent to <strong style={{ color: "var(--text-main)" }}>{connection.hospitalName}</strong>.
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--text-sub)" }}>
          {bookSlot && new Date(bookSlot).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: true })}
        </p>
        <p className="text-xs mb-10 px-4 py-3 rounded-xl" style={{ color: "#14b8a6", background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
          The clinic will confirm or suggest an alternative time. You'll be notified in the app.
        </p>
        <button onClick={onBack}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 8px 24px rgba(30,64,175,0.4)" }}>
          Back to hospitals
        </button>
      </div>
    );
  }

  if (rescheduleDone) {
    return (
      <div className="px-4 pt-16 pb-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(99,102,241,0.15)", border: "2px solid rgba(99,102,241,0.4)" }}>
          <RefreshCw className="w-10 h-10" style={{ color: "#818cf8" }} />
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Reschedule requested</p>
        <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--text-sub)" }}>
          Your new slot request has been sent to <strong style={{ color: "var(--text-main)" }}>{connection.hospitalName}</strong>.
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--text-sub)" }}>
          {rescheduleSlot && new Date(rescheduleSlot).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: true })}
        </p>
        <button onClick={onBack}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 8px 24px rgba(30,64,175,0.4)" }}>
          Back to hospitals
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 shrink-0 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl active:scale-90 transition"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--text-sub)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{connection.hospitalName}</p>
          <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>Appointments</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-4 pb-0 shrink-0">
        <div className="flex rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)" }}>
          {(["book", "reschedule"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-semibold transition"
              style={{
                background: tab === t ? "rgba(20,184,166,0.18)" : "transparent",
                color: tab === t ? "#14b8a6" : "var(--text-sub)",
                borderBottom: tab === t ? "2px solid #14b8a6" : "2px solid transparent",
              }}>
              {t === "book" ? "Book Appointment" : "Reschedule"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {tab === "book" && (
          <>
            {slotsLoading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
                <p style={{ fontSize: 12, color: "var(--text-sub)" }}>Loading available slots…</p>
              </div>
            ) : slotsError ? (
              <div className="text-center py-12">
                <p style={{ fontSize: 36, marginBottom: 12 }}>😕</p>
                <p style={{ fontSize: 14, color: "var(--text-sub)" }}>Could not load slots. Try again later.</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ fontSize: 40, marginBottom: 12 }}>📅</p>
                <p className="font-bold mb-2" style={{ color: "var(--text-main)", fontSize: 15 }}>No slots available</p>
                <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.5 }}>
                  {connection.hospitalName} hasn't published any open slots yet. Check back later or contact them directly.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Preferred slot</p>
                  <SlotPicker slots={slots} value={bookSlot} onChange={setBookSlot} />
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Reason for visit</p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Follow-up consultation, routine check-up…"
                    rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)", caretColor: "#14b8a6" }}
                  />
                </div>

                {bookSlot && (
                  <div className="px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: "#14b8a6" }} />
                    <p style={{ fontSize: 12, color: "#14b8a6", fontWeight: 600 }}>
                      {new Date(bookSlot).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </p>
                  </div>
                )}

                <button onClick={handleBook} disabled={!bookSlot || !reason.trim() || createBooking.isPending}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 6px 20px rgba(20,184,166,0.35)" }}>
                  {createBooking.isPending ? "Sending request…" : "Request appointment"}
                </button>
                {createBooking.error && (
                  <p className="text-center text-xs" style={{ color: "#f87171" }}>{createBooking.error.message}</p>
                )}
              </div>
            )}
          </>
        )}

        {tab === "reschedule" && (
          <>
            {bookingsLoading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
                <p style={{ fontSize: 12, color: "var(--text-sub)" }}>Loading your bookings…</p>
              </div>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ fontSize: 40, marginBottom: 12 }}>📋</p>
                <p className="font-bold mb-2" style={{ color: "var(--text-main)", fontSize: 15 }}>No active bookings</p>
                <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.5 }}>
                  You don't have any pending or confirmed appointments to reschedule.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Select booking to reschedule</p>
                  <div className="space-y-2">
                    {myBookings.map((b) => {
                      const isSelected = selectedBookingId === b.id;
                      return (
                        <button key={b.id} onClick={() => { setSelectedBookingId(b.id); setRescheduleSlot(""); }}
                          className="w-full text-left px-4 py-3 rounded-xl transition active:scale-[0.99]"
                          style={{
                            background: isSelected ? "rgba(20,184,166,0.12)" : "var(--glass-bg)",
                            border: isSelected ? "1px solid rgba(20,184,166,0.4)" : "1px solid var(--glass-border)",
                          }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-main)" }}>{b.reason}</p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-sub)" }}>
                                {new Date(b.requestedAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize"
                              style={{
                                background: b.status === "confirmed" ? "rgba(20,184,166,0.15)" : "rgba(251,191,36,0.15)",
                                color: b.status === "confirmed" ? "#14b8a6" : "#fbbf24",
                                border: `1px solid ${b.status === "confirmed" ? "rgba(20,184,166,0.3)" : "rgba(251,191,36,0.3)"}`,
                              }}>
                              {b.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedBookingId && (
                  <>
                    {slotsLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
                        <p style={{ fontSize: 12, color: "var(--text-sub)" }}>Loading slots…</p>
                      </div>
                    ) : slots.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--text-sub)" }}>No available slots to reschedule to.</p>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>New preferred slot</p>
                        <SlotPicker slots={slots} value={rescheduleSlot} onChange={setRescheduleSlot} />
                      </div>
                    )}

                    {rescheduleSlot && (
                      <div className="px-3 py-2 rounded-xl flex items-center gap-2"
                        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                        <RefreshCw className="w-4 h-4 shrink-0" style={{ color: "#818cf8" }} />
                        <p style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
                          New time: {new Date(rescheduleSlot).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </p>
                      </div>
                    )}

                    <button onClick={handleReschedule} disabled={!rescheduleSlot || reschedule.isPending}
                      className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#4f46e5,#818cf8)", boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }}>
                      {reschedule.isPending ? "Sending request…" : "Request reschedule"}
                    </button>
                    {reschedule.error && (
                      <p className="text-center text-xs" style={{ color: "#f87171" }}>{reschedule.error.message}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Hospital chat page ─────────────────────────────────────────────────────────
function HospitalChatPage({ connection, onBack }: { connection: HospitalConnection; onBack: () => void }) {
  const [message, setMessage] = useState("");
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

  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--glass-border)" }}>
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
          <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>Hospital messaging</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p style={{ fontSize: 44, marginBottom: 12 }}>💬</p>
            <p style={{ fontWeight: 700, color: "var(--text-main)", fontSize: 15, marginBottom: 6 }}>No messages yet</p>
            <p style={{ fontSize: 13, color: "var(--text-sub)", lineHeight: 1.5 }}>Send a message to {connection.hospitalName}.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} hospitalName={connection.hospitalName} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-4 shrink-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${connection.hospitalName}…`}
            rows={1}
            className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none resize-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-main)", caretColor: "#14b8a6", maxHeight: 120, lineHeight: 1.5 }}
          />
          <button onClick={handleSend} disabled={!message.trim() || sendMessage.isPending}
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
  const time = new Date(message.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  if (message.sender === "system") {
    return (
      <div className="flex justify-center py-1">
        <span style={{ fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border)", borderRadius: 20, padding: "3px 12px" }}>
          {message.content}
        </span>
      </div>
    );
  }

  const isPatient = message.sender === "patient";
  return (
    <div className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
      <div style={{ maxWidth: "80%" }}>
        {!isPatient && <p style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4, paddingLeft: 4 }}>{hospitalName}</p>}
        <div className="rounded-2xl px-4 py-3"
          style={{
            background: isPatient ? "linear-gradient(135deg,#1e3a5f,#1e40af)" : "rgba(255,255,255,0.07)",
            border: isPatient ? "none" : "1px solid var(--glass-border)",
            borderTopRightRadius: isPatient ? 4 : 16,
            borderTopLeftRadius: isPatient ? 16 : 4,
          }}>
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
          Connect your hospital to see your records, message your care team, and book appointments.
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
          Search for your hospital, enter your patient ID, and we'll send a verification code to the email your hospital has on file.
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

  function handleSelectHospital(h: HospitalSearchResult) { setSelectedHospital(h); setStep("patientId"); setError(""); }

  function handleRequestOtp() {
    if (!selectedHospital || !patientRecordId.trim()) return;
    setError("");
    requestConnection.mutate(
      { hospitalId: selectedHospital.id, patientRecordId: patientRecordId.trim() },
      { onSuccess: (data) => { setMaskedEmail(data.maskedEmail); setPatientName(data.patientName); setStep("otp"); }, onError: (err) => setError(err.message) }
    );
  }

  function handleVerifyOtp() {
    if (!selectedHospital || !otp.trim()) return;
    setError("");
    verifyConnection.mutate(
      { hospitalId: selectedHospital.id, patientRecordId: patientRecordId.trim(), otp: otp.trim() },
      { onSuccess: () => setStep("done"), onError: (err) => setError(err.message) }
    );
  }

  if (step === "done") {
    return (
      <div className="px-4 pt-16 pb-8 flex flex-col items-center text-center">
        <p style={{ fontSize: 60, marginBottom: 20 }}>🏥</p>
        <p className="text-xl font-bold mb-2" style={{ color: "var(--text-main)" }}>Hospital connected!</p>
        <p style={{ fontSize: 14, color: "var(--text-sub)", marginBottom: 8 }}>
          <strong style={{ color: "var(--text-main)" }}>{selectedHospital?.name}</strong> has been linked to your account.
        </p>
        <p style={{ fontSize: 14, color: "var(--text-sub)", marginBottom: 32 }}>
          Records for <strong style={{ color: "var(--text-main)" }}>{patientName}</strong> are now accessible.
        </p>
        <button onClick={onDone}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 8px 24px rgba(30,64,175,0.4)" }}>
          Done →
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

      <div className="flex items-center gap-2 mb-8">
        {(["search", "patientId", "otp"] as AddStep[]).map((s, i) => {
          const stepIdx = ["search", "patientId", "otp"].indexOf(step);
          const isDone = i < stepIdx; const isCurrent = s === step;
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
        <PatientIdStep hospital={selectedHospital} patientRecordId={patientRecordId}
          onChange={setPatientRecordId} onSubmit={handleRequestOtp} loading={requestConnection.isPending} error={error} />
      )}
      {step === "otp" && selectedHospital && (
        <OtpStep hospital={selectedHospital} maskedEmail={maskedEmail} otp={otp}
          onChange={setOtp} onSubmit={handleVerifyOtp} onResend={handleRequestOtp}
          loading={verifyConnection.isPending} resending={requestConnection.isPending} error={error} />
      )}
    </div>
  );
}

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
        {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4" style={{ color: "var(--text-dim)" }} /></button>}
      </div>
      {isFetching && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#60a5fa", borderTopColor: "transparent" }} /></div>}
      {!isFetching && results && results.length === 0 && q.length >= 2 && (
        <div className="text-center py-10"><p style={{ fontSize: 36, marginBottom: 10 }}>🏥</p><p className="font-bold mb-1" style={{ color: "var(--text-main)" }}>No hospitals found</p><p className="text-sm" style={{ color: "var(--text-sub)" }}>Try a different spelling.</p></div>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((h) => (
            <button key={h.id} onClick={() => onSelect(h)}
              className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.98] transition"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
                {h.logo_url ? <img src={h.logo_url} alt={h.name} className="w-8 h-8 rounded-lg object-contain" /> : <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />}
              </div>
              <p className="flex-1 font-semibold text-sm" style={{ color: "var(--text-main)" }}>{h.name}</p>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            </button>
          ))}
        </div>
      )}
      {q.length < 2 && <p className="text-center text-sm py-8" style={{ color: "var(--text-dim)" }}>Type at least 2 characters to search</p>}
    </div>
  );
}

function PatientIdStep({ hospital, patientRecordId, onChange, onSubmit, loading, error }: {
  hospital: HospitalSearchResult; patientRecordId: string; onChange: (v: string) => void;
  onSubmit: () => void; loading: boolean; error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
          <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
        </div>
        <div><p className="text-xs" style={{ color: "var(--text-dim)" }}>Connecting to</p><p className="font-semibold text-sm" style={{ color: "var(--text-main)" }}>{hospital.name}</p></div>
      </div>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-main)" }}>Enter your patient ID</h2>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-sub)" }}>Your patient ID is on your clinic card or appointment slip.</p>
      <input type="text" value={patientRecordId} onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1234 or P001-2024"
        className="w-full rounded-2xl px-4 py-4 text-2xl font-bold text-center outline-none mb-3"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", caretColor: "#60a5fa", color: "var(--text-main)" }}
      />
      {error && <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}><p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p></div>}
      <p className="text-xs text-center mb-5" style={{ color: "var(--text-dim)" }}>We'll send a code to the email {hospital.name} has on file.</p>
      <button onClick={onSubmit} disabled={!patientRecordId.trim() || loading}
        className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 6px 20px rgba(30,64,175,0.4)" }}>
        {loading ? "Looking up record…" : "Send verification code"}
      </button>
    </div>
  );
}

function OtpStep({ hospital, maskedEmail, otp, onChange, onSubmit, onResend, loading, resending, error }: {
  hospital: HospitalSearchResult; maskedEmail: string; otp: string; onChange: (v: string) => void;
  onSubmit: () => void; onResend: () => void; loading: boolean; resending: boolean; error: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)" }}>
          <Building2 className="w-5 h-5" style={{ color: "#60a5fa" }} />
        </div>
        <div><p className="text-xs" style={{ color: "var(--text-dim)" }}>Connecting to</p><p className="font-semibold text-sm" style={{ color: "var(--text-main)" }}>{hospital.name}</p></div>
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
      {error && <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}><p className="text-sm" style={{ color: "#fca5a5" }}>{error}</p></div>}
      <button onClick={onSubmit} disabled={otp.length !== 6 || loading}
        className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition disabled:opacity-60 mb-4"
        style={{ background: "linear-gradient(135deg,#1e3a5f,#1e40af)", boxShadow: "0 6px 20px rgba(30,64,175,0.4)" }}>
        {loading ? "Verifying…" : "Verify & connect"}
      </button>
      <button onClick={onResend} disabled={resending} className="w-full py-2 text-sm font-semibold disabled:opacity-50" style={{ color: "var(--text-sub)" }}>
        {resending ? "Sending…" : "Didn't receive it? Resend code"}
      </button>
      <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>Code expires in 10 minutes. Check spam folder if not received.</p>
    </div>
  );
}
