import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { getHospitalFromRequest, getPatientIdsForHospital } from "../lib/hospital-auth.js";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limit = query.data.limit ?? 50;

  const patientIds = await getPatientIdsForHospital(hospital.code);
  const safePatientIds = patientIds.length ? patientIds : [-1];

  // Fetch both patient-linked activity AND hospital-level activity (e.g. patient_deleted
  // entries where patient_id is nulled out to preserve the audit trail after deletion).
  let q = supabase
    .from("activity")
    .select("*")
    .or(`patient_id.in.(${safePatientIds.join(",")}),and(patient_id.is.null,hospital_id.eq.${hospital.intId})`)
    .order("created_at", { ascending: false });

  // Date range filter — when provided, search full history for that window
  if (query.data.from) q = q.gte("created_at", `${query.data.from}T00:00:00.000Z`);
  if (query.data.to)   q = q.lte("created_at", `${query.data.to}T23:59:59.999Z`);

  q = q.limit(limit);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json(ListActivityResponse.parse((data ?? []).map(a => camelize(a))));
});

export default router;
