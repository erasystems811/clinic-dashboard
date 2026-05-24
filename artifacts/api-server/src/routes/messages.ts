import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { camelize } from "../lib/camel.js";
import { verifyHospitalToken } from "./super-admin.js";
import { deliverWhatsApp } from "../lib/whatsapp.js";
import { z } from "zod/v4";

const router: IRouter = Router();

const ROLE_CATEGORIES: Record<string, string[]> = {
  admin:        ["queue", "appointment", "care", "treatment", "general", "wellness"],
  receptionist: ["queue", "appointment"],
  nurse:        ["care", "treatment"],
};

// ── GET /messages/conversations — one entry per patient phone ────────────────
router.get("/messages/conversations", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const role = (req.query.role as string) || "admin";
  const categories = ROLE_CATEGORIES[role] ?? ROLE_CATEGORIES.admin;

  // All messages for this hospital/role, ordered newest first
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("hospital_id", hospitalId)
    .in("category", categories)
    .order("received_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Group by patient_phone — keep latest message + unread count per thread
  const threads = new Map<string, {
    phone: string;
    patientName: string | null;
    patientId: number | null;
    latestMessage: string;
    latestAt: string;
    latestDirection: string;
    unreadCount: number;
    category: string;
  }>();

  for (const row of data ?? []) {
    const phone = row.patient_phone as string;
    if (!threads.has(phone)) {
      threads.set(phone, {
        phone,
        patientName: row.patient_name as string | null,
        patientId: row.patient_id as number | null,
        latestMessage: row.message_body as string,
        latestAt: (row.received_at ?? row.created_at) as string,
        latestDirection: row.direction as string,
        unreadCount: (!row.read && row.direction === "inbound") ? 1 : 0,
        category: row.category as string,
      });
    } else {
      const t = threads.get(phone)!;
      if (!row.read && row.direction === "inbound") t.unreadCount++;
    }
  }

  res.json([...threads.values()]);
});

// ── GET /messages/thread?phone=xxx — full thread for one patient ─────────────
router.get("/messages/thread", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const phone = req.query.phone as string;
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("hospital_id", hospitalId)
    .eq("patient_phone", phone)
    .order("received_at", { ascending: true });

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Mark all inbound as read
  await supabase
    .from("whatsapp_messages")
    .update({ read: true })
    .eq("hospital_id", hospitalId)
    .eq("patient_phone", phone)
    .eq("direction", "inbound");

  res.json((data ?? []).map((m) => camelize(m)));
});

// ── POST /messages/inbound — receive an inbound patient reply (webhook) ──────
// Routing: look up last outbound message sent to this phone; use its category
// to decide which inbox receives the reply.
//   queue / appointment  →  receptionist inbox
//   care  / treatment    →  nurse inbox
//   anything else / none →  general (admin default)
const InboundBody = z.object({
  phone:       z.string().min(1),
  body:        z.string().min(1),
  patientName: z.string().optional(),
  patientId:   z.number().optional(),
});

router.post("/messages/inbound", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = InboundBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { phone, body, patientName, patientId } = parsed.data;

  // Find the last outbound message sent to this phone number at this hospital
  const { data: lastOutbound } = await supabase
    .from("whatsapp_messages")
    .select("category")
    .eq("hospital_id", hospitalId)
    .eq("patient_phone", phone)
    .eq("direction", "outbound")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Route reply to the correct inbox based on what the outbound message was about
  const outboundCategory = lastOutbound?.category as string | undefined;
  let routedCategory: string;
  if (outboundCategory === "queue" || outboundCategory === "appointment") {
    routedCategory = outboundCategory;   // → receptionist inbox
  } else if (outboundCategory === "care" || outboundCategory === "treatment") {
    routedCategory = outboundCategory;   // → nurse inbox
  } else {
    routedCategory = "general";          // → admin inbox (default / unclassified)
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      hospital_id:   hospitalId,
      patient_id:    patientId ?? null,
      patient_name:  patientName ?? null,
      patient_phone: phone,
      direction:     "inbound",
      message_body:  body,
      category:      routedCategory,
      read:          false,
      received_at:   now,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(camelize(inserted));
});

// ── POST /messages/reply — send an outbound reply ────────────────────────────
const ReplyBody = z.object({
  phone:       z.string().min(1),
  body:        z.string().min(1),
  patientName: z.string().optional(),
  patientId:   z.number().optional(),
  category:    z.string().optional(),
});

router.post("/messages/reply", async (req, res): Promise<void> => {
  const token = req.headers["x-hospital-token"] as string;
  const hospitalId = token ? verifyHospitalToken(token) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { phone, body, patientName, patientId, category } = parsed.data;
  const now = new Date().toISOString();

  // Store outbound message
  const { data: inserted, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      hospital_id:   hospitalId,
      patient_id:    patientId ?? null,
      patient_name:  patientName ?? null,
      patient_phone: phone,
      direction:     "outbound",
      message_body:  body,
      category:      category ?? "general",
      read:          true,
      received_at:   now,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Attempt delivery via WhatsApp stub (no-op until Meta API is connected)
  try {
    await deliverWhatsApp({ to: phone, body });
  } catch {
    // Delivery failure doesn't block — message is stored, will be retried when connected
  }

  res.json(camelize(inserted));
});

// ── GET /messages — flat list (legacy, kept for unread badge) ────────────────
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

// ── PATCH /messages/:id/read ─────────────────────────────────────────────────
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

// ── PATCH /messages/read-all ─────────────────────────────────────────────────
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

// ── GET /messages/unread-count ───────────────────────────────────────────────
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
