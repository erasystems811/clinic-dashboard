import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const ImportRowSchema = z.object({
  firstName:   z.string().min(1),
  lastName:    z.string().min(1),
  email:       z.string().optional(),
  phone:       z.string().optional(),
  dateOfBirth: z.string().optional(),
  age:         z.string().optional(),
  gender:      z.string().optional(),
  notes:       z.string().optional(),
  patientId:   z.string().optional(),
});

const ImportBody = z.object({
  patients: z.array(ImportRowSchema).min(1).max(5000),
});

router.post("/patients/import", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid import data" }); return; }

  const rows = parsed.data.patients;

  // Fetch existing emails + patient IDs for this hospital to detect duplicates
  const { data: existing } = await supabase
    .from("patients")
    .select("email, patient_id")
    .eq("hospital_id", hospital.code);

  const existingEmails = new Set(
    (existing ?? []).map(p => (p.email as string | null)?.toLowerCase()).filter(Boolean)
  );
  const existingPatientIds = new Set(
    (existing ?? []).map(p => (p.patient_id as string | null)?.toUpperCase()).filter(Boolean)
  );

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const emailNorm = row.email?.trim().toLowerCase();
    const pidNorm   = row.patientId?.trim().toUpperCase();

    if (emailNorm && existingEmails.has(emailNorm)) {
      skipped++;
      errors.push({ row: rowNum, reason: `Email "${row.email}" already exists in this hospital` });
      continue;
    }

    if (pidNorm && existingPatientIds.has(pidNorm)) {
      skipped++;
      errors.push({ row: rowNum, reason: `Patient ID "${row.patientId}" already exists in this hospital` });
      continue;
    }

    const ageNum = row.age ? parseInt(row.age, 10) : null;

    const { error: insertErr } = await supabase.from("patients").insert({
      first_name:    row.firstName.trim(),
      last_name:     row.lastName.trim(),
      email:         emailNorm || null,
      phone:         row.phone?.trim() || "",
      date_of_birth: row.dateOfBirth?.trim() || null,
      age:           (!isNaN(ageNum!) && ageNum !== null) ? ageNum : null,
      gender:        row.gender?.trim() || null,
      notes:         row.notes?.trim() || null,
      patient_id:    pidNorm || null,
      stage:         "Active",
      hospital_id:   hospital.code,
      created_at:    now,
      updated_at:    now,
    });

    if (insertErr) {
      errors.push({ row: rowNum, reason: insertErr.message });
      skipped++;
    } else {
      imported++;
      if (emailNorm) existingEmails.add(emailNorm);
      if (pidNorm)   existingPatientIds.add(pidNorm);
    }
  }

  res.json({ imported, skipped, total: rows.length, errors: errors.slice(0, 100) });
});

export default router;
