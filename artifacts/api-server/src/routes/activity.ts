import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const limit = query.data.limit ?? 20;

  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json(ListActivityResponse.parse((data ?? []).map(a => camelize(a))));
});

export default router;
