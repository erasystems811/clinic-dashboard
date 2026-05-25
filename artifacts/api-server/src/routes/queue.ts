import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

router.get("/queue", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: queueEntries, error } = await supabase
    .from("queue")
    .select("*")
    .order("position", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!queueEntries || queueEntries.length === 0) { res.json([]); return; }

  const patientIds = queueEntries.map((e) => e.patient_id).filter(Boolean);
  const { data: patients } = await supabase
    .from("patients")
    .select("id, phone, email, whatsapp_number, hospital_id, pre_queue_stage")
    .in("id", patientIds)
    .eq("hospital_id", hospital.username);

  const patientMap = Object.fromEntries((patients ?? []).map((p) => [p.id, p]));

  const result = queueEntries
    .filter((e) => e.patient_id in patientMap)
    .map((e) => {
      const p = patientMap[e.patient_id] ?? {};
      return {
        ...camelize(e),
        phone: p.phone ?? null,
        email: p.email ?? null,
        whatsappNumber: p.whatsapp_number ?? null,
        hospitalId: p.hospital_id ?? null,
        stage: p.pre_queue_stage ?? null,
      };
    });

  res.json(result);
});

export default router;
