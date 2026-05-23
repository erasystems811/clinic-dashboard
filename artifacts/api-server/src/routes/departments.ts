import { Router, type IRouter } from "express";
import { db, departmentsTable } from "@workspace/db";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_DEPARTMENTS = [
  "General Practice",
  "Fertility and Reproductive Health",
  "Surgery",
  "Maternity and Antenatal",
  "Pediatrics",
  "Oncology",
  "Physiotherapy and Rehabilitation",
  "Mental Health and Psychiatry",
  "Cardiology",
  "Dental",
  "Orthopaedics",
  "Urology",
  "Gastroenterology",
  "Ophthalmology and Eye",
  "Dermatology",
  "Endocrinology",
  "Radiology",
  "Chronic Disease Management",
  "Emergency and Trauma",
  "ENT",
  "Neurology",
];

const CreateDepartmentBody = z.object({ name: z.string().min(1) });

async function ensureDepartmentsExist() {
  const existing = await db.select().from(departmentsTable);
  const existingNames = new Set(existing.map(d => d.name));
  const missing = DEFAULT_DEPARTMENTS.filter(n => !existingNames.has(n));
  if (missing.length > 0) {
    await db.insert(departmentsTable).values(missing.map(name => ({ name })));
  }
}

router.get("/departments", async (req, res): Promise<void> => {
  await ensureDepartmentsExist();
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(departments.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })));
});

router.post("/departments", async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [dept] = await db.insert(departmentsTable).values(parsed.data).returning();
  res.status(201).json({ ...dept, createdAt: dept.createdAt.toISOString() });
});

router.delete("/departments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.sendStatus(204);
});

export default router;
