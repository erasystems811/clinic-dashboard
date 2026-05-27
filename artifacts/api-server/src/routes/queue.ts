import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Queue table is the source of truth — populated by the checkin route.
  const { data: entries, error } = await supabase
    .from("queue")
    .select("*")
    .eq("hospital_id", hospital.username)
    .order("position", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!entries || entries.length === 0) { res.json([]); return; }

  // Enrich with live patient data
  const patientIds = entries.map(e => e.patient_id as number);
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone, email, whatsapp_number, patient_id, stage, department, checked_in_at")
    .in("id", patientIds);

  const patientMap = Object.fromEntries((patients ?? []).map(p => [p.id, p]));

  // Fetch appointment scheduled times for entries with an appointment_id
  const appointmentIds = entries
    .map(e => e.appointment_id as number | null)
    .filter((id): id is number => id != null);

  let appointmentScheduledMap: Record<number, string> = {};
  if (appointmentIds.length > 0) {
    const { data: apts } = await supabase
      .from("appointments")
      .select("id, scheduled_at")
      .in("id", appointmentIds);
    appointmentScheduledMap = Object.fromEntries((apts ?? []).map(a => [a.id, a.scheduled_at]));
  }

  const result = entries.map(e => {
    const p = patientMap[e.patient_id] ?? {} as Record<string, unknown>;
    return {
      ...camelize(e),
      patientId: e.patient_id,
      patientCode: (p.patient_id as string) ?? null,
      phone: (p.phone as string) ?? (e.phone as string) ?? null,
      email: (p.email as string) ?? (e.email as string) ?? null,
      whatsappNumber: (p.whatsapp_number as string) ?? (e.whatsapp_number as string) ?? null,
      department: (p.department as string) ?? null,
      hospitalId: hospital.username,
      appointmentScheduledAt: e.appointment_id ? (appointmentScheduledMap[e.appointment_id as number] ?? null) : null,
    };
  });

  res.json(result);
});

export default router;
