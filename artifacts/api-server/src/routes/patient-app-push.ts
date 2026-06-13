import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { getPatientFromRequest } from "../lib/patient-auth.js";
import { verifyHospitalToken } from "./super-admin.js";
import { sendPushToAccounts } from "../lib/push-service.js";

const router: IRouter = Router();

// ── GET /api/patient-app/notifications/preferences ───────────────────────────
router.get("/patient-app/notifications/preferences", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("account_id", account.id)
    .maybeSingle();

  res.json({
    hospitalEnabled:  data?.hospital_enabled  ?? true,
    personalEnabled:  data?.personal_enabled  ?? true,
    leadMins:         data?.lead_mins         ?? 10,
    companionEnabled: data?.companion_enabled ?? true,
  });
});

// ── PATCH /api/patient-app/notifications/preferences ─────────────────────────
router.patch("/patient-app/notifications/preferences", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { hospitalEnabled, personalEnabled, leadMins, companionEnabled } = req.body ?? {};
  const updates: Record<string, unknown> = { account_id: account.id, updated_at: new Date().toISOString() };
  if (hospitalEnabled  !== undefined) updates.hospital_enabled  = !!hospitalEnabled;
  if (personalEnabled  !== undefined) updates.personal_enabled  = !!personalEnabled;
  if (leadMins         !== undefined) updates.lead_mins         = Number(leadMins);
  if (companionEnabled !== undefined) updates.companion_enabled = !!companionEnabled;

  await supabase.from("notification_preferences").upsert(updates, { onConflict: "account_id" });
  res.json({ ok: true });
});

// ── POST /api/patient-app/push/subscribe ─────────────────────────────────────
// Saves a web push subscription. The `type` field defaults to 'web'.
// When the native app ships, it will call this same endpoint with type='fcm'
// and subscription = { token: "<FCM token>" } — no schema changes needed.
router.post("/patient-app/push/subscribe", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { subscription, type = "web", deviceLabel } = req.body ?? {};
  if (!subscription) { res.status(400).json({ error: "subscription required" }); return; }

  // For web: endpoint uniquely identifies a subscription per browser
  const endpoint = type === "web" ? (subscription as { endpoint?: string }).endpoint : null;

  if (endpoint) {
    // Upsert by endpoint so re-subscribes don't create duplicates
    await supabase.from("push_subscriptions").upsert(
      { account_id: account.id, type, subscription, device_label: deviceLabel ?? null, created_at: new Date().toISOString() },
      { onConflict: "account_id,endpoint" }
    );
  } else {
    await supabase.from("push_subscriptions").insert(
      { account_id: account.id, type, subscription, device_label: deviceLabel ?? null, created_at: new Date().toISOString() }
    );
  }

  res.json({ ok: true });
});

// ── DELETE /api/patient-app/push/unsubscribe ─────────────────────────────────
router.delete("/patient-app/push/unsubscribe", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { endpoint } = req.body ?? {};
  if (endpoint) {
    await supabase.from("push_subscriptions")
      .delete().eq("account_id", account.id).eq("endpoint", endpoint);
  } else {
    await supabase.from("push_subscriptions")
      .delete().eq("account_id", account.id).eq("type", "web");
  }
  res.json({ ok: true });
});

// ── POST /api/hospital/push/broadcast (era-patient → push to all patients) ───
// Hospital staff use this to send a push message to all their ERA app patients.
router.post("/hospital/push/broadcast", async (req, res): Promise<void> => {
  const hospitalToken = req.headers["x-hospital-token"] as string;
  const hospitalId = hospitalToken ? verifyHospitalToken(hospitalToken) : null;
  if (!hospitalId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { title, body, url } = req.body ?? {};
  if (!title || !body) { res.status(400).json({ error: "title and body required" }); return; }

  // Get hospital code
  const { data: hospital } = await supabase
    .from("hospitals").select("hospital_code, name").eq("id", hospitalId).maybeSingle();
  if (!hospital) { res.status(404).json({ error: "Hospital not found" }); return; }

  // Get all patient accounts linked to this hospital
  const { data: accounts } = await supabase
    .from("patient_accounts")
    .select("id")
    .eq("hospital_id", hospital.hospital_code as string);

  const accountIds = (accounts ?? []).map(a => a.id as number);

  // Filter by hospital notification preference
  const { data: optedOut } = await supabase
    .from("notification_preferences")
    .select("account_id")
    .in("account_id", accountIds)
    .eq("hospital_enabled", false);
  const optedOutSet = new Set((optedOut ?? []).map(r => r.account_id as number));
  const targets = accountIds.filter(id => !optedOutSet.has(id));

  // Store as in-app notification too (so patients who missed push see it)
  await supabase.from("hospital_notifications").insert(
    targets.map(accountId => ({
      account_id: accountId,
      hospital_id: hospitalId,
      title,
      body,
      url: url ?? null,
      read: false,
      created_at: new Date().toISOString(),
    }))
  );

  // Send push
  await sendPushToAccounts(targets, { title, body, url: url ?? "/", tag: "hospital-message" });

  res.json({ ok: true, sent: targets.length });
});

// ── GET /api/patient-app/notifications/inbox ─────────────────────────────────
// In-app hospital notification inbox
router.get("/patient-app/notifications/inbox", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("hospital_notifications")
    .select("id, title, body, url, read, created_at")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(50);

  res.json(data ?? []);
});

// ── PATCH /api/patient-app/notifications/inbox/:id/read ──────────────────────
router.patch("/patient-app/notifications/inbox/:id/read", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  await supabase.from("hospital_notifications")
    .update({ read: true }).eq("id", req.params.id).eq("account_id", account.id);
  res.json({ ok: true });
});

// ── GET /api/patient-app/notifications/unread-count ──────────────────────────
router.get("/patient-app/notifications/unread-count", async (req, res): Promise<void> => {
  const account = await getPatientFromRequest(req);
  if (!account) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { count } = await supabase
    .from("hospital_notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id)
    .eq("read", false);

  res.json({ count: count ?? 0 });
});

export default router;
