import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Filter directly by hospital_id on the queue table — never rely on
  // cross-referencing with the patients table for filtering, because any
  // hospital_id mismatch on a patient row would silently drop their entry.
  const { data: queueEntries, error } = await supabase
    .from("queue")
    .select("*")
    .eq("hospital_id", hospital.username)
    .order("position", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!queueEntries || queueEntries.length === 0) { res.json([]); return; }

  // Enrich with live contact info and the hospital-assigned patient code ("PT-001")
  const patientIds = queueEntries.map((e) => e.patient_id).filter(Boolean);
  const { data: patients } = await supabase
    .from("patients")
    .select("id, phone, email, whatsapp_number, hospital_id, pre_queue_stage, patient_id")
    .in("id", patientIds);

  const patientMap = Object.fromEntries((patients ?? []).map((p) => [p.id, p]));

  const result = queueEntries.map((e) => {
    const p = patientMap[e.patient_id] ?? {};
    return {
      ...camelize(e),
      // patientId stays as the numeric DB patient FK (required by schema + dequeue route)
      patientId: e.patient_id,
      // patientCode is the hospital-assigned display ID like "PT-001"
      patientCode: p.patient_id ?? null,
      phone: p.phone ?? e.phone ?? null,
      email: p.email ?? e.email ?? null,
      whatsappNumber: p.whatsapp_number ?? e.whatsapp_number ?? null,
      hospitalId: p.hospital_id ?? e.hospital_id ?? null,
      stage: p.pre_queue_stage ?? null,
    };
  });

  res.json(result);
});

export default router;
