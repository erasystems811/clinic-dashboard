import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { verifyHospitalToken } from "./super-admin.js";

const router: IRouter = Router();

// ── Category sets per role ──────────────────────────────────────────────────
const ROLE_CATEGORIES: Record<string, string[]> = {
  admin:        ["queue", "appointment", "care", "treatment", "general", "wellness"],
  receptionist: ["queue", "appointment"],
  nurse:        ["care", "treatment"],
};

// ── GET /messages — list inbound messages filtered by role ──────────────────
router.get("/messages", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const role = (req.query.role as string) || "admin";
  const categories = ROLE_CATEGORIES[role] ?? ROLE_CATEGORIES.admin;
  const unreadOnly = req.query.unread === "true";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  let q = supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("hospital_id", hospitalId)
    .eq("direction", "inbound")
    .in("category", categories)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) q = q.eq("read", false);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map((m) => camelize(m)));
});

// ── PATCH /messages/:id/read — mark a message as read ──────────────────────
router.patch("/messages/:id/read", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ read: true })
    .eq("id", id)
    .eq("hospital_id", hospitalId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── PATCH /messages/read-all — mark all visible messages as read ────────────
router.patch("/messages/read-all", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const role = (req.query.role as string) || "admin";
  const categories = ROLE_CATEGORIES[role] ?? ROLE_CATEGORIES.admin;

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ read: true })
    .eq("hospital_id", hospitalId)
    .in("category", categories);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

// ── GET /messages/unread-count — badge count for nav ───────────────────────
router.get("/messages/unread-count", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const role = (req.query.role as string) || "admin";
  const categories = ROLE_CATEGORIES[role] ?? ROLE_CATEGORIES.admin;

  const { count, error } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("direction", "inbound")
    .eq("read", false)
    .in("category", categories);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ count: count ?? 0 });
});

export default router;
