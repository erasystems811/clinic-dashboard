import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/api";
import { Calendar, Clock, CheckCircle2, Loader2, ChevronDown } from "lucide-react";

interface Slot {
  datetime: string;
  label: string;
}

interface HospitalInfo {
  name: string;
  slug: string;
}

export default function BookingPage({ hospitalSlug }: { hospitalSlug: string }) {
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
          {email && (
            <p className="text-xs text-muted-foreground mt-3">A confirmation will be sent to {email}.</p>
          )}
        </div>
      </div>
    );
  }

  // Group slots by date
  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    const d = new Date(s.datetime).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    if (!slotsByDate[d]) slotsByDate[d] = [];
    slotsByDate[d].push(s);
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{hospital.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">Book an appointment online</p>
        </div>

        {slots.length === 0 ? (
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
              <Label htmlFor="slot">Choose a Time Slot *</Label>
              <div className="relative">
                <select
                  id="slot"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm appearance-none pr-10"
                  value={selectedSlot}
                  onChange={e => setSelectedSlot(e.target.value)}
                  required
                >
                  <option value="">Select an available time…</option>
                  {Object.entries(slotsByDate).map(([dateLabel, dateSlots]) => (
                    <optgroup key={dateLabel} label={dateLabel}>
                      {dateSlots.map(s => {
                        const timeLabel = new Date(s.datetime).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
                        return (
                          <option key={s.datetime} value={s.datetime}>{timeLabel}</option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-xs text-muted-foreground">
                {slots.length} slot{slots.length !== 1 ? "s" : ""} available over the next 30 days
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !name || !phone || !reason || !selectedSlot}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Request Appointment"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your booking will be reviewed by the clinic before confirmation.
            </p>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          ERA Patient by <strong>ERA Systems</strong>
        </p>
      </div>
    </div>
  );
}
