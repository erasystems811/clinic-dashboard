import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const UpsertNewsletterBody = z.object({
  content: z.string().min(1),
  weekOf: z.string().min(1),
});

function weekOfDate(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

router.get("/wellness", async (req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("wellness_newsletter")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map((e) => camelize(e)));
});

router.get("/wellness/current", async (req, res): Promise<void> => {
  const weekOf = weekOfDate(new Date());
  const { data } = await supabase.from("wellness_newsletter").select("*").eq("week_of", weekOf).single();
  if (!data) { res.json(null); return; }
  res.json(camelize(data));
});

router.put("/wellness", async (req, res): Promise<void> => {
  const parsed = UpsertNewsletterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { data: existing } = await supabase
    .from("wellness_newsletter")
    .select("id")
    .eq("week_of", parsed.data.weekOf)
    .single();

  let entry;
  const now = new Date().toISOString();

  if (existing) {
    const { data } = await supabase
      .from("wellness_newsletter")
      .update({ content: parsed.data.content, updated_at: now })
      .eq("week_of", parsed.data.weekOf)
      .select()
      .single();
    entry = data;
  } else {
    const { data } = await supabase
      .from("wellness_newsletter")
      .insert({ content: parsed.data.content, week_of: parsed.data.weekOf, updated_at: now })
      .select()
      .single();
    entry = data;
  }

  if (!entry) { res.status(500).json({ error: "Operation failed" }); return; }
  res.json(camelize(entry));
});

router.post("/wellness/:id/send", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { data, error } = await supabase
    .from("wellness_newsletter")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ error: "Newsletter not found" }); return; }
  res.json(camelize(data));
});

export default router;
