import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  // ── Ground truth: all patients currently marked as Queued for this hospital ──
  const { data: queuedPatients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone, email, whatsapp_number, hospital_id, pre_queue_stage, patient_id, checked_in_at")
    .eq("hospital_id", hospital.username)
    .eq("stage", "Queued");

  if (!queuedPatients || queuedPatients.length === 0) {
    // Also clear any stale queue entries for this hospital
    await supabase.from("queue").delete().eq("hospital_id", hospital.username);
    res.json([]);
    return;
  }

  const queuedPatientIds = queuedPatients.map((p) => p.id);

  // ── Fetch existing queue entries for these patients (by patient_id FK, not hospital_id) ──
  // This catches entries created before hospital_id was stored correctly on the queue table.
  const { data: existingEntries } = await supabase
    .from("queue")
    .select("*")
    .in("patient_id", queuedPatientIds);

  const entryByPatientId = Object.fromEntries((existingEntries ?? []).map((e) => [e.patient_id, e]));

  // ── Heal: fix hospital_id mismatches and create missing entries ──
  const now = new Date().toISOString();
  const healPromises: Promise<unknown>[] = [];

  for (const p of queuedPatients) {
    const entry = entryByPatientId[p.id];
    if (!entry) {
      // Queue entry is missing — auto-create it
      const { count: currentCount } = await supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("hospital_id", hospital.username);
      const position = (currentCount ?? 0) + 1;

      healPromises.push(
        supabase.from("queue").insert({
          patient_id: p.id,
          patient_name: `${p.first_name} ${p.last_name}`,
          phone: p.phone,
          email: p.email,
          whatsapp_number: p.whatsapp_number,
          hospital_id: hospital.username,
          position,
          added_at: p.checked_in_at ?? now,
        })
      );
    } else if (entry.hospital_id !== hospital.username) {
      // hospital_id is wrong on the queue entry — fix it
      healPromises.push(
        supabase.from("queue").update({ hospital_id: hospital.username }).eq("id", entry.id)
      );
    }
  }

  if (healPromises.length > 0) {
    await Promise.all(healPromises);
  }

  // ── Remove stale queue entries for patients no longer marked Queued ──
  const { data: allHospitalEntries } = await supabase
    .from("queue")
    .select("id, patient_id")
    .eq("hospital_id", hospital.username);

  const staleIds = (allHospitalEntries ?? [])
    .filter((e) => !queuedPatientIds.includes(e.patient_id))
    .map((e) => e.id);

  if (staleIds.length > 0) {
    await supabase.from("queue").delete().in("id", staleIds);
  }

  // ── Fetch the final, clean queue for this hospital ──
  const { data: finalEntries, error } = await supabase
    .from("queue")
    .select("*")
    .eq("hospital_id", hospital.username)
    .order("position", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // ── Fetch appointment times for any entries that have an appointment_id ──
  const appointmentIds = (finalEntries ?? [])
    .map((e) => e.appointment_id)
    .filter((id): id is number => id != null);

  let appointmentScheduledMap: Record<number, string> = {};
  if (appointmentIds.length > 0) {
    const { data: apts } = await supabase
      .from("appointments")
      .select("id, scheduled_at")
      .in("id", appointmentIds);
    appointmentScheduledMap = Object.fromEntries((apts ?? []).map((a) => [a.id, a.scheduled_at]));
  }

  const patientMap = Object.fromEntries(queuedPatients.map((p) => [p.id, p]));

  const result = (finalEntries ?? []).map((e) => {
    const p = patientMap[e.patient_id] ?? {};
    return {
      ...camelize(e),
      patientId: e.patient_id,
      patientCode: p.patient_id ?? null,
      phone: p.phone ?? e.phone ?? null,
      email: p.email ?? e.email ?? null,
      whatsappNumber: p.whatsapp_number ?? e.whatsapp_number ?? null,
      hospitalId: hospital.username,
      stage: p.pre_queue_stage ?? null,
      appointmentScheduledAt: e.appointment_id ? (appointmentScheduledMap[e.appointment_id] ?? null) : null,
    };
  });

  res.json(result);
});

export default router;
