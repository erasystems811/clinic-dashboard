import { Router, type IRouter, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getHospitalFromRequest, verifyHospitalToken } from "../lib/hospital-auth.js";
import { sendEmail, wrapHtml } from "../lib/email.js";

const router: IRouter = Router();

function fromAddress(): string {
  const email = process.env.PLATFORM_FROM_EMAIL || "onboarding@resend.dev";
  const name = process.env.PLATFORM_FROM_NAME || "Era Systems";
  return `${name} <${email}>`;
}

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

// Generate slots for next N days based on time blocks
function generateSlots(blocks: { day_of_week: number; start_time: string; end_time: string; slot_minutes: number }[], days = 30): string[] {
  const slots: string[] = [];
  const now = new Date();
  for (let d = 1; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    const dayBlocks = blocks.filter(b => b.day_of_week === dow);
    for (const block of dayBlocks) {
      const [startH, startM] = block.start_time.split(":").map(Number);
      const [endH, endM] = block.end_time.split(":").map(Number);
      let cur = startH * 60 + startM;
      const end = endH * 60 + endM;
      while (cur + block.slot_minutes <= end) {
        const slotDate = new Date(date);
        slotDate.setHours(Math.floor(cur / 60), cur % 60, 0, 0);
        if (slotDate > now) slots.push(slotDate.toISOString());
        cur += block.slot_minutes;
      }
    }
  }
  return slots;
}

// ── GET /public/book/:slug — public: get hospital info + available slots ───────
router.get("/public/book/:slug", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("id, name, slug, active")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalId = hospital.id as number;

  const [{ data: blocks }, { data: takenAppts }, { data: takenBookings }] = await Promise.all([
    supabase.from("appointment_time_blocks").select("*").eq("hospital_id", hospitalId).eq("active", true),
    supabase.from("appointments").select("scheduled_at")
      .eq("hospital_id", hospitalId)
      .gte("scheduled_at", new Date().toISOString())
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("requested_at")
      .eq("hospital_id", hospitalId)
      .in("status", ["pending", "confirmed"]),
  ]);

  const takenSet = new Set([
    ...(takenAppts ?? []).map(a => new Date(a.scheduled_at as string).toISOString()),
    ...(takenBookings ?? []).map(b => new Date(b.requested_at as string).toISOString()),
  ]);

  const allSlots = generateSlots((blocks ?? []) as { day_of_week: number; start_time: string; end_time: string; slot_minutes: number }[]);
  const available = allSlots.filter(s => !takenSet.has(s)).map(s => ({
    datetime: s,
    label: formatSlotLabel(s),
  }));

  res.json({
    hospital: { name: hospital.name as string, slug: hospital.slug as string },
    slots: available,
  });
});

// ── POST /public/book/:slug — patient self-books ──────────────────────────────
router.post("/public/book/:slug", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { patientName, patientPhone, reason, requestedAt } = body;
  const patientEmail = body.patientEmail as string | undefined;

  if (!patientName || !patientPhone || !reason || !requestedAt) {
    res.status(400).json({ error: "patientName, patientPhone, reason and requestedAt are required" }); return;
  }

  const { data: hospital } = await supabase
    .from("hospitals").select("id, name, active").eq("slug", slug).eq("active", true).single();
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalId = hospital.id as number;
  const requestedAtIso = new Date(requestedAt as string).toISOString();

  // Check slot not already taken
  const [{ count: apptCount }, { count: bookCount }] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("hospital_id", hospitalId).eq("scheduled_at", requestedAtIso)
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("*", { count: "exact", head: true })
      .eq("hospital_id", hospitalId).eq("requested_at", requestedAtIso)
      .in("status", ["pending", "confirmed"]),
  ]);

  if ((apptCount ?? 0) > 0 || (bookCount ?? 0) > 0) {
    res.status(409).json({ error: "This slot is no longer available. Please choose another time." }); return;
  }

  const { data: booking, error } = await supabase.from("self_bookings").insert({
    hospital_id: hospitalId,
    patient_name: patientName as string,
    patient_phone: patientPhone as string,
    patient_email: patientEmail ?? null,
    reason: reason as string,
    requested_at: requestedAtIso,
    status: "pending",
  }).select("id").single();

  if (error || !booking) { res.status(500).json({ error: "Failed to create booking" }); return; }

  res.status(201).json({
    id: booking.id as number,
    message: "Your booking request has been received. The clinic will confirm it shortly.",
  });
});

// ── GET /api/hospital/time-blocks ─────────────────────────────────────────────
router.get("/hospital/time-blocks", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("appointment_time_blocks")
    .select("*")
    .eq("hospital_id", ctx.intId)
    .order("day_of_week").order("start_time");

  res.json((data ?? []).map(b => ({
    id: b.id as number,
    dayOfWeek: b.day_of_week as number,
    startTime: b.start_time as string,
    endTime: b.end_time as string,
    slotMinutes: b.slot_minutes as number,
    active: b.active as boolean,
  })));
});

// ── POST /api/hospital/time-blocks ────────────────────────────────────────────
router.post("/hospital/time-blocks", async (req: Request, res: Response): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { dayOfWeek, startTime, endTime, slotMinutes } = body;

  if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
    res.status(400).json({ error: "dayOfWeek must be 0-6" }); return;
  }
  if (!startTime || !endTime || !/^\d{2}:\d{2}$/.test(startTime as string) || !/^\d{2}:\d{2}$/.test(endTime as string)) {
    res.status(400).json({ error: "startTime and endTime must be HH:MM" }); return;
  }
  if (!slotMinutes || Number(slotMinutes) <= 0) {
    res.status(400).json({ error: "slotMinutes must be > 0" }); return;
  }

  const { data, error } = await supabase.from("appointment_time_blocks").insert({
    hospital_id: hospitalId,
    day_of_week: dayOfWeek,
    start_time: startTime as string,
    end_time: endTime as string,
    slot_minutes: Number(slotMinutes),
    active: true,
  }).select("*").single();

  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }

  res.status(201).json({
    id: data.id as number,
    dayOfWeek: data.day_of_week as number,
    startTime: data.start_time as string,
    endTime: data.end_time as string,
    slotMinutes: data.slot_minutes as number,
    active: data.active as boolean,
  });
});

// ── DELETE /api/hospital/time-blocks/:id ──────────────────────────────────────
router.delete("/hospital/time-blocks/:id", async (req: Request, res: Response): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await supabase.from("appointment_time_blocks").delete().eq("id", id).eq("hospital_id", hospitalId);
  res.sendStatus(204);
});

// ── GET /api/hospital/self-bookings ───────────────────────────────────────────
router.get("/hospital/self-bookings", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const status = req.query.status as string | undefined;

  let q = supabase.from("self_bookings")
    .select("*, hospital_doctors(full_name, specialty)")
    .eq("hospital_id", ctx.intId)
    .order("status") // pending first alphabetically before confirmed/cancelled
    .order("requested_at", { ascending: true })
    .limit(100);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(b => ({
    id: b.id as number,
    patientName: b.patient_name as string,
    patientPhone: b.patient_phone as string,
    patientEmail: (b.patient_email as string | null) ?? null,
    reason: b.reason as string,
    requestedAt: b.requested_at as string,
    status: b.status as string,
    doctorId: (b.doctor_id as number | null) ?? null,
    doctorName: b.doctor_id ? ((b.hospital_doctors as { full_name: string } | null)?.full_name ?? null) : null,
    appointmentId: (b.appointment_id as number | null) ?? null,
    durationMinutes: (b.duration_minutes as number | null) ?? null,
    confirmedBy: (b.confirmed_by as string | null) ?? null,
    confirmedAt: (b.confirmed_at as string | null) ?? null,
    createdAt: b.created_at as string,
  })));
});

// ── PATCH /api/hospital/self-bookings/:id/confirm ─────────────────────────────
router.patch("/hospital/self-bookings/:id/confirm", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { doctorId, durationMinutes, confirmedBy } = body;
  if (!durationMinutes) {
    res.status(400).json({ error: "durationMinutes is required" }); return;
  }

  const { data: booking } = await supabase.from("self_bookings")
    .select("*").eq("id", id).eq("hospital_id", ctx.intId).single();
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  let doctorName: string | null = null;
  if (doctorId) {
    const { data: doctor } = await supabase.from("hospital_doctors")
      .select("full_name").eq("id", Number(doctorId)).eq("hospital_id", ctx.intId).single();
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }
    doctorName = doctor.full_name as string;
  }

  // Create appointment
  const { data: appt, error: apptError } = await supabase.from("appointments").insert({
    hospital_id: ctx.intId,
    patient_id: 0, // self-bookings don't have a patient record yet — receptionist can link later
    patient_name: booking.patient_name as string,
    title: booking.reason as string,
    scheduled_at: booking.requested_at as string,
    duration_minutes: Number(durationMinutes),
    duration: Number(durationMinutes),
    doctor_id: doctorId ? Number(doctorId) : null,
    doctor_name: doctorName,
    status: "scheduled",
    confirmed_by: (confirmedBy as string) ?? null,
  }).select("id").single();

  if (apptError || !appt) { res.status(500).json({ error: apptError?.message ?? "Failed to create appointment" }); return; }

  const now = new Date().toISOString();
  await supabase.from("self_bookings").update({
    status: "confirmed",
    appointment_id: appt.id as number,
    doctor_id: doctorId ? Number(doctorId) : null,
    duration_minutes: Number(durationMinutes),
    confirmed_by: (confirmedBy as string) ?? null,
    confirmed_at: now,
  }).eq("id", id);

  // Send confirmation email to patient
  if (booking.patient_email) {
    const { data: hospital } = await supabase.from("hospitals").select("name").eq("id", ctx.intId).single();
    const hospName = (hospital?.name as string) ?? "The Clinic";
    const dateStr = new Date(booking.requested_at as string).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const doctorRow = doctorName ? `<tr><td style="padding:4px 16px 4px 0;color:#888;font-size:14px;">Doctor</td><td style="font-size:14px;">Dr. ${doctorName}</td></tr>` : "";
    const body = `Hi ${booking.patient_name},\n\nYour appointment at ${hospName} has been confirmed.\n\nDate: ${dateStr}${doctorName ? `\nDoctor: Dr. ${doctorName}` : ""}\nDuration: ${durationMinutes} minutes\n\nPlease arrive a few minutes early. If you need to reschedule, contact the clinic directly.\n\nWarm regards,\n${hospName}`;
    const html = wrapHtml(`
      <p>Hi <strong>${booking.patient_name}</strong>,</p>
      <p>Your appointment at <strong>${hospName}</strong> has been confirmed.</p>
      <table style="margin:12px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 16px 4px 0;color:#888;font-size:14px;">Date</td><td style="font-size:14px;">${dateStr}</td></tr>
        ${doctorRow}
        <tr><td style="padding:4px 16px 4px 0;color:#888;font-size:14px;">Duration</td><td style="font-size:14px;">${durationMinutes} minutes</td></tr>
      </table>
      <p>Please arrive a few minutes early. If you need to reschedule, contact the clinic directly.</p>
    `, hospName);
    sendEmail({ to: booking.patient_email as string, from: fromAddress(), subject: `Appointment Confirmed — ${hospName}`, html, text: body })
      .catch(err => console.error("[self-booking-confirm-email]", err));
  }

  await supabase.from("activity").insert({
    type: "self_booking_confirmed",
    description: `Self-booking confirmed for ${booking.patient_name}${doctorName ? ` — Dr. ${doctorName}` : ""} at ${new Date(booking.requested_at as string).toLocaleString()}`,
    hospital_id: ctx.intId,
    performed_by: (confirmedBy as string) ?? null,
  });

  res.json({ ok: true, appointmentId: appt.id as number });
});

// ── PATCH /api/hospital/self-bookings/:id/cancel ──────────────────────────────
router.patch("/hospital/self-bookings/:id/cancel", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data: booking } = await supabase.from("self_bookings")
    .update({ status: "cancelled" })
    .eq("id", id).eq("hospital_id", ctx.intId)
    .select("patient_name").single();

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  await supabase.from("activity").insert({
    type: "self_booking_cancelled",
    description: `Self-booking cancelled for ${booking.patient_name}`,
    hospital_id: ctx.intId,
    performed_by: (req.headers["x-performed-by"] as string) ?? null,
  });

  res.json({ ok: true });
});

// ── GET /public/book/:slug/my-bookings — patient looks up their confirmed bookings ─
router.get("/public/book/:slug/my-bookings", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const email = req.query.email as string | undefined;
  const phone = req.query.phone as string | undefined;

  if (!email && !phone) { res.status(400).json({ error: "email or phone required" }); return; }

  const { data: hospital } = await supabase
    .from("hospitals").select("id").eq("slug", slug).eq("active", true).single();
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalId = hospital.id as number;
  const now = new Date().toISOString();

  let q = supabase.from("self_bookings")
    .select("id, patient_name, reason, requested_at")
    .eq("hospital_id", hospitalId)
    .eq("status", "confirmed")
    .gt("requested_at", now)
    .order("requested_at", { ascending: true });

  if (email && phone) {
    q = q.or(`patient_email.eq.${email},patient_phone.eq.${phone}`);
  } else if (email) {
    q = q.eq("patient_email", email);
  } else {
    q = q.eq("patient_phone", phone!);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json((data ?? []).map(b => ({
    id: b.id as number,
    patientName: b.patient_name as string,
    reason: b.reason as string,
    requestedAt: b.requested_at as string,
  })));
});

// ── POST /public/book/:slug/reschedule — patient requests a reschedule ────────
router.post("/public/book/:slug/reschedule", async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { bookingId, newRequestedAt, patientEmail, patientPhone } = body;

  if (!bookingId || !newRequestedAt || (!patientEmail && !patientPhone)) {
    res.status(400).json({ error: "bookingId, newRequestedAt, and email or phone required" }); return;
  }

  const { data: hospital } = await supabase
    .from("hospitals").select("id").eq("slug", slug).eq("active", true).single();
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  const hospitalId = hospital.id as number;

  const { data: booking } = await supabase.from("self_bookings")
    .select("*").eq("id", Number(bookingId)).eq("hospital_id", hospitalId).eq("status", "confirmed").single();
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  // Identity check — submitted email or phone must match what's on the booking
  const emailMatch = patientEmail && booking.patient_email === patientEmail;
  const phoneMatch = patientPhone && booking.patient_phone === patientPhone;
  if (!emailMatch && !phoneMatch) {
    res.status(403).json({ error: "Details do not match our records. Please check your email or phone number." }); return;
  }

  const newRequestedAtIso = new Date(newRequestedAt as string).toISOString();

  // Check new slot is available
  const [{ count: apptCount }, { count: bookCount }] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true })
      .eq("hospital_id", hospitalId).eq("scheduled_at", newRequestedAtIso)
      .not("status", "in", '("cancelled","no_show")'),
    supabase.from("self_bookings").select("*", { count: "exact", head: true })
      .eq("hospital_id", hospitalId).eq("requested_at", newRequestedAtIso)
      .in("status", ["pending", "confirmed"]),
  ]);
  if ((apptCount ?? 0) > 0 || (bookCount ?? 0) > 0) {
    res.status(409).json({ error: "This slot is no longer available. Please choose another time." }); return;
  }

  // Cancel the original booking and its confirmed appointment
  const originalApptId = booking.appointment_id as number | null;
  await supabase.from("self_bookings").update({ status: "cancelled" }).eq("id", Number(bookingId));
  if (originalApptId) {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", originalApptId);
  }

  // Build note showing the original date
  const oldDateStr = new Date(booking.requested_at as string).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });

  // Create new pending booking so receptionist re-confirms
  const { data: newBooking, error } = await supabase.from("self_bookings").insert({
    hospital_id: hospitalId,
    patient_name: booking.patient_name as string,
    patient_phone: booking.patient_phone as string,
    patient_email: (booking.patient_email as string | null) ?? null,
    reason: `${booking.reason as string} (Reschedule — was: ${oldDateStr})`,
    requested_at: newRequestedAtIso,
    status: "pending",
  }).select("id").single();

  if (error || !newBooking) { res.status(500).json({ error: "Failed to create reschedule request" }); return; }

  res.status(201).json({
    id: newBooking.id as number,
    message: "Your reschedule request has been received. The clinic will confirm your new appointment shortly.",
  });
});

export default router;
