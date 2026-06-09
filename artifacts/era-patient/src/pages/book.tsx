import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/api";
import { Calendar, Clock, CheckCircle2, Loader2, ChevronDown, RefreshCw, Search } from "lucide-react";

interface Slot {
  datetime: string;
  label: string;
}

interface HospitalInfo {
  name: string;
  slug: string;
}

interface ExistingBooking {
  id: number;
  patientName: string;
  reason: string;
  requestedAt: string;
}

export default function BookingPage({ hospitalSlug }: { hospitalSlug: string }) {
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Book tab ──
  const [activeTab, setActiveTab] = useState<"book" | "reschedule">("book");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // ── Reschedule tab ──
  const [rescheduleSearch, setRescheduleSearch] = useState("");
  const [rescheduleSearchType, setRescheduleSearchType] = useState<"email" | "phone">("email");
  const [rescheduleSearching, setRescheduleSearching] = useState(false);
  const [rescheduleResults, setRescheduleResults] = useState<ExistingBooking[] | null>(null);
  const [rescheduleSearchError, setRescheduleSearchError] = useState("");
  const [rescheduleSearchInput, setRescheduleSearchInput] = useState("");
  const [rescheduleSelectedId, setRescheduleSelectedId] = useState<number | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleSubmitted, setRescheduleSubmitted] = useState(false);
  const [rescheduleSubmitError, setRescheduleSubmitError] = useState("");

  useEffect(() => {
    if (!hospitalSlug) return;
    fetch(apiUrl(`/api/public/book/${hospitalSlug}`))
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data: { hospital: HospitalInfo; slots: Slot[] } | null) => {
        if (!data) return;
        setHospital(data.hospital);
        setSlots(data.slots);
      })
      .finally(() => setLoading(false));
  }, [hospitalSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !reason.trim() || !selectedSlot) return;
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/public/book/${hospitalSlug}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: name.trim(),
          patientPhone: phone.trim(),
          patientEmail: email.trim() || undefined,
          reason: reason.trim(),
          requestedAt: selectedSlot,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setSubmitted(true);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleSearch.trim()) return;
    setRescheduleSearching(true);
    setRescheduleSearchError("");
    setRescheduleResults(null);
    setRescheduleSelectedId(null);
    setRescheduleSlot("");
    setRescheduleSearchInput(rescheduleSearch.trim());
    try {
      const param = rescheduleSearchType === "email"
        ? `email=${encodeURIComponent(rescheduleSearch.trim())}`
        : `phone=${encodeURIComponent(rescheduleSearch.trim())}`;
      const res = await fetch(apiUrl(`/api/public/book/${hospitalSlug}/my-bookings?${param}`));
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json() as ExistingBooking[];
      setRescheduleResults(data);
    } catch {
      setRescheduleSearchError("Could not look up your bookings. Please try again.");
    } finally {
      setRescheduleSearching(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleSelectedId || !rescheduleSlot) return;
    setRescheduleSubmitError(""); setRescheduleSubmitting(true);
    try {
      const payload: Record<string, unknown> = { bookingId: rescheduleSelectedId, newRequestedAt: rescheduleSlot };
      if (rescheduleSearchType === "email") payload.patientEmail = rescheduleSearchInput;
      else payload.patientPhone = rescheduleSearchInput;

      const res = await fetch(apiUrl(`/api/public/book/${hospitalSlug}/reschedule`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reschedule request failed");
      setRescheduleSubmitted(true);
    } catch (err: unknown) {
      setRescheduleSubmitError((err as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Booking Not Available</h1>
          <p className="text-muted-foreground text-sm">This booking link is inactive or does not exist. Please contact the clinic directly.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Booking Received!</h1>
          <p className="text-muted-foreground text-sm mb-1">
            Thank you, <strong>{name}</strong>. Your appointment request at <strong>{hospital.name}</strong> has been received.
          </p>
          <p className="text-muted-foreground text-sm">
            The clinic will review and confirm your booking. You will be contacted if any changes are needed.
          </p>
          {email && <p className="text-xs text-muted-foreground mt-3">A confirmation will be sent to {email}.</p>}
        </div>
      </div>
    );
  }

  if (rescheduleSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-teal-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Reschedule Request Sent!</h1>
          <p className="text-muted-foreground text-sm">
            Your request has been received. The clinic will confirm your new appointment time shortly.
          </p>
        </div>
      </div>
    );
  }

  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    const d = new Date(s.datetime).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    if (!slotsByDate[d]) slotsByDate[d] = [];
    slotsByDate[d].push(s);
  }

  const SlotPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="relative">
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none pr-10"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Select a time…</option>
        {Object.entries(slotsByDate).map(([dateLabel, dateSlots]) => (
          <optgroup key={dateLabel} label={dateLabel}>
            {dateSlots.map(s => {
              const timeLabel = new Date(s.datetime).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
              return <option key={s.datetime} value={s.datetime}>{timeLabel}</option>;
            })}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{hospital.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">Appointments</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab("book")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === "book" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <Calendar className="w-4 h-4" />
            Book Appointment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reschedule")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === "reschedule" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <RefreshCw className="w-4 h-4" />
            Reschedule
          </button>
        </div>

        {/* ── BOOK TAB ── */}
        {activeTab === "book" && (
          slots.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No available slots at this time. Please call the clinic to book.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 08012345678" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-muted-foreground font-normal">(optional — for confirmation)</span></Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for Visit *</Label>
                <textarea
                  id="reason"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Briefly describe your symptoms or reason for visit…"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Choose a Time Slot *</Label>
                <SlotPicker value={selectedSlot} onChange={setSelectedSlot} />
                <p className="text-xs text-muted-foreground">
                  {slots.length} slot{slots.length !== 1 ? "s" : ""} available over the next 30 days
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={submitting || !name || !phone || !reason || !selectedSlot}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Request Appointment"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Your booking will be reviewed by the clinic before confirmation.</p>
            </form>
          )
        )}

        {/* ── RESCHEDULE TAB ── */}
        {activeTab === "reschedule" && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div>
              <p className="text-sm font-semibold mb-1">Find Your Booking</p>
              <p className="text-xs text-muted-foreground">Enter the email or phone number you used when you booked.</p>
            </div>

            <form onSubmit={handleRescheduleSearch} className="space-y-3">
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setRescheduleSearchType("email"); setRescheduleSearch(""); }}
                  className={`px-3 py-2 text-xs font-medium border-r border-input transition-colors shrink-0 ${rescheduleSearchType === "email" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setRescheduleSearchType("phone"); setRescheduleSearch(""); }}
                  className={`px-3 py-2 text-xs font-medium border-r border-input transition-colors shrink-0 ${rescheduleSearchType === "phone" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Phone
                </button>
                <input
                  type={rescheduleSearchType === "email" ? "email" : "tel"}
                  className="flex-1 px-3 py-2 text-sm bg-background outline-none min-w-0"
                  placeholder={rescheduleSearchType === "email" ? "your@email.com" : "08012345678"}
                  value={rescheduleSearch}
                  onChange={e => setRescheduleSearch(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="outline" className="w-full gap-2" disabled={rescheduleSearching || !rescheduleSearch.trim()}>
                {rescheduleSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Find My Bookings
              </Button>
            </form>

            {rescheduleSearchError && <p className="text-sm text-destructive">{rescheduleSearchError}</p>}

            {rescheduleResults !== null && rescheduleResults.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm space-y-1">
                <p>No upcoming confirmed bookings found for that {rescheduleSearchType}.</p>
                <p className="text-xs opacity-70">Only confirmed bookings can be rescheduled. Contact the clinic if you need help.</p>
              </div>
            )}

            {rescheduleResults && rescheduleResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Upcoming Bookings</p>
                {rescheduleResults.map(booking => {
                  const isSelected = rescheduleSelectedId === booking.id;
                  const dateStr = new Date(booking.requestedAt).toLocaleString("en-NG", {
                    weekday: "long", day: "numeric", month: "long",
                    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos",
                  });
                  return (
                    <div key={booking.id} className={`rounded-lg border p-4 space-y-3 transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-background"}`}>
                      <div>
                        <p className="text-sm font-medium">{booking.reason}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
                      </div>
                      {!isSelected && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setRescheduleSelectedId(booking.id); setRescheduleSlot(""); setRescheduleSubmitError(""); }}>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reschedule this
                        </Button>
                      )}
                      {isSelected && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <p className="text-xs font-medium text-primary">Choose a new time slot:</p>
                          {slots.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No available slots right now. Contact the clinic directly.</p>
                          ) : (
                            <>
                              <SlotPicker value={rescheduleSlot} onChange={setRescheduleSlot} />
                              {rescheduleSubmitError && <p className="text-xs text-destructive">{rescheduleSubmitError}</p>}
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setRescheduleSelectedId(null); setRescheduleSlot(""); }}>
                                  Cancel
                                </Button>
                                <Button size="sm" className="gap-1.5 flex-1" onClick={handleRescheduleSubmit} disabled={rescheduleSubmitting || !rescheduleSlot}>
                                  {rescheduleSubmitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Submitting…</> : "Confirm Reschedule Request"}
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">The clinic will confirm your new time. Your current appointment will be cancelled immediately.</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          ERA Patient by <strong>ERA Systems</strong>
        </p>
      </div>
    </div>
  );
}
