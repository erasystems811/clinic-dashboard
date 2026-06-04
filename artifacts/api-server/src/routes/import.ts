import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";

const router: IRouter = Router();

const ImportRowSchema = z.object({
  fullName:      z.string().optional(),
  firstName:     z.string().optional(),
  lastName:      z.string().optional(),
  email:         z.string().optional(),
  phone:         z.string().optional(),
  dateOfBirth:   z.string().optional(),
  age:           z.string().optional(),
  gender:        z.string().optional(),
  lastVisitedAt: z.string().optional(),
  notes:         z.string().optional(),
  patientId:     z.string().optional(),
});

const ImportBody = z.object({
  patients: z.array(ImportRowSchema).min(1).max(5000),
});

router.post("/patients/import", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid import data" }); return; }

  // Resolve full name → first/last when separate columns are absent
  const rows = parsed.data.patients.map(row => {
    if (row.fullName && !row.firstName && !row.lastName) {
      const trimmed = row.fullName.trim();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx > 0) {
        return { ...row, firstName: trimmed.slice(0, spaceIdx), lastName: trimmed.slice(spaceIdx + 1).trim() };
      }
      // Single-token name: put it all in firstName, leave lastName as placeholder
      return { ...row, firstName: trimmed, lastName: "-" };
    }
    return row;
  });

  // Load the hospital's dormant threshold so we can auto-classify on import
  const { data: hospitalSettings } = await supabase
    .from("hospital_settings")
    .select("pipeline_dormant_days")
    .eq("hospital_id", hospital.intId)
    .maybeSingle();
  const dormantDays = (hospitalSettings?.pipeline_dormant_days as number | null) ?? 90;
  const dormantCutoff = new Date(Date.now() - dormantDays * 24 * 60 * 60 * 1000);

  // Duplicate check: patient ID (MRN) only — email is intentionally excluded
  // because family members (e.g. children) may share the same email address.
  const { data: existing } = await supabase
    .from("patients")
    .select("patient_id")
    .eq("hospital_id", hospital.code);

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
    const firstName = row.firstName?.trim() || "";
    const lastName  = row.lastName?.trim() || "";

    if (!firstName) {
      skipped++;
      errors.push({ row: rowNum, reason: "Could not determine patient name (no Name, First Name, or Last Name column mapped)" });
      continue;
    }

    if (pidNorm && existingPatientIds.has(pidNorm)) {
      skipped++;
      errors.push({ row: rowNum, reason: `Patient ID "${row.patientId}" already exists in this hospital` });
      continue;
    }

    const ageNum = row.age ? parseInt(row.age, 10) : null;

    // Parse last visited date — try ISO and common date formats
    let lastVisitedIso: string | null = null;
    if (row.lastVisitedAt?.trim()) {
      const parsed = new Date(row.lastVisitedAt.trim());
      if (!isNaN(parsed.getTime())) lastVisitedIso = parsed.toISOString();
    }

    // Auto-classify: if last visit is older than dormant threshold → Dormant; otherwise Active.
    // If no last visit provided, the patient starts Active and their dormant clock begins from now.
    const stage = lastVisitedIso && new Date(lastVisitedIso) < dormantCutoff ? "Dormant" : "Active";
    // checked_in_at drives the dormant clock. Use the provided last visit date, or fall back to
    // the import timestamp so the clock starts counting from today, not from a null baseline.
    const checkedInAt = lastVisitedIso || now;

    const { error: insertErr } = await supabase.from("patients").insert({
      first_name:     firstName,
      last_name:      lastName,
      email:          emailNorm || null,
      phone:          row.phone?.trim() || "",
      date_of_birth:  row.dateOfBirth?.trim() || null,
      age:            (!isNaN(ageNum!) && ageNum !== null) ? ageNum : null,
      gender:         row.gender?.trim() || null,
      notes:          row.notes?.trim() || null,
      patient_id:     pidNorm || null,
      checked_in_at:  checkedInAt,
      stage,
      hospital_id:    hospital.code,
      created_at:     now,
      updated_at:     now,
    });

    if (insertErr) {
      errors.push({ row: rowNum, reason: insertErr.message });
      skipped++;
    } else {
      imported++;
      if (pidNorm) existingPatientIds.add(pidNorm);
    }
  }

  res.json({ imported, skipped, total: rows.length, errors: errors.slice(0, 100) });
});

export default router;
