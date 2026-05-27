import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const DEFAULT_DEPARTMENTS = [
  "General Outpatient",
  "Antenatal / Maternity",
  "Paediatrics",
  "Surgery / Post-Op",
  "Dental",
  "Eye",
  "Fertility / IVF",
];

const CreateDepartmentBody = z.object({ name: z.string().min(1) });

async function ensureDepartmentsExist() {
  const { data: existing } = await supabase.from("departments").select("name");
  const existingNames = new Set((existing ?? []).map((d: { name: string }) => d.name));
  const missing = DEFAULT_DEPARTMENTS.filter((n) => !existingNames.has(n));
  if (missing.length > 0) {
    await supabase.from("departments").insert(missing.map((name) => ({ name })));
  }
}

router.get("/departments", async (req, res): Promise<void> => {
  await ensureDepartmentsExist();
  const { data, error } = await supabase.from("departments").select("*").order("name", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map((d) => camelize(d)));
});

router.post("/departments", async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { data, error } = await supabase.from("departments").insert(parsed.data).select().single();
  if (error || !data) { res.status(500).json({ error: error?.message ?? "Insert failed" }); return; }
  res.status(201).json(camelize(data));
});

router.delete("/departments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await supabase.from("departments").delete().eq("id", id);
  res.sendStatus(204);
});

export default router;
