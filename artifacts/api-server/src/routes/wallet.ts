import { Router, type IRouter, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { requireSuperAdmin } from "./super-admin.js";
import { creditWallet } from "../lib/wallet.js";
import { isPromotionalSmsRestricted } from "../lib/messaging.js";

const router: IRouter = Router();

const SMS_COST_KOBO = 700; // ₦7 per SMS
const FLW_SECRET_KEY = () => process.env.FLUTTERWAVE_SECRET_KEY ?? "";
const FLW_BASE = "https://api.flutterwave.com/v3";

// ── Helper: verify a Flutterwave transaction and return amount in kobo ────────
async function verifyFlutterwavePayment(txRef: string): Promise<{ ok: boolean; amountKobo: number; detail: string }> {
  const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${FLW_SECRET_KEY()}` },
  });
  if (!res.ok) return { ok: false, amountKobo: 0, detail: `Flutterwave verification HTTP ${res.status}` };
  const json = await res.json() as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | null;
  if (!data || json.status !== "success") return { ok: false, amountKobo: 0, detail: "Verification failed" };
  if (data.status !== "successful") return { ok: false, amountKobo: 0, detail: `Transaction status: ${data.status}` };
  const amountKobo = Math.round((data.amount as number) * 100);
  return { ok: true, amountKobo, detail: "ok" };
}

// ── GET /api/wallet/balance — hospital checks their own balance ───────────────
router.get("/wallet/balance", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("hospitals")
    .select("wallet_balance_kobo")
    .eq("id", ctx.intId)
    .single();

  if (error || !data) { res.status(500).json({ error: "Failed to fetch balance" }); return; }
  res.json({ balanceKobo: data.wallet_balance_kobo as number, balanceNaira: (data.wallet_balance_kobo as number) / 100 });
});

// ── POST /api/wallet/fund/initiate — create Flutterwave payment link ──────────
router.post("/wallet/fund/initiate", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const amountNaira = Number(req.body?.amountNaira);
  if (!amountNaira || amountNaira < 500) {
    res.status(400).json({ error: "Minimum funding amount is ₦500" });
    return;
  }

  const { data: hospital } = await supabase.from("hospitals").select("name, contact_email").eq("id", ctx.intId).single();
  const txRef = `era-wallet-${ctx.intId}-${Date.now()}`;

  const payload = {
    tx_ref: txRef,
    amount: amountNaira,
    currency: "NGN",
    redirect_url: `${(process.env.APP_BASE_URL ?? "https://app.erasystems.com.ng").replace(/\/$/, "")}/settings?wallet_funded=1`,
    customer: {
      email: (hospital?.contact_email as string | null) ?? `${ctx.username}@era.clinic`,
      name: (hospital?.name as string | null) ?? ctx.username,
    },
    customizations: {
      title: "Era Wallet Top-up",
      description: `Fund SMS wallet for ${(hospital?.name as string | null) ?? ctx.username}`,
    },
    meta: { hospital_id: ctx.intId, tx_ref: txRef },
  };

  if (!FLW_SECRET_KEY()) {
    console.error("[wallet] FLUTTERWAVE_SECRET_KEY is not set");
    res.status(503).json({ error: "Payment provider not configured — contact support" });
    return;
  }

  let flwRes: globalThis.Response;
  try {
    flwRes = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${FLW_SECRET_KEY()}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[wallet] Flutterwave request failed:", err);
    res.status(502).json({ error: "Could not reach payment provider" });
    return;
  }

  const flwJson = await flwRes.json() as Record<string, unknown>;
  if (!flwRes.ok || flwJson.status !== "success") {
    console.error("[wallet] Flutterwave initiate failed:", flwJson);
    res.status(502).json({ error: "Failed to create payment link" });
    return;
  }

  const link = (flwJson.data as Record<string, unknown>)?.link as string;
  res.json({ paymentUrl: link, txRef });
});

// ── POST /api/wallet/webhook — Flutterwave calls this after payment ───────────
router.post("/wallet/webhook", async (req: Request, res: Response): Promise<void> => {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (secretHash) {
    const signature = req.headers["verif-hash"] as string | undefined;
    if (signature !== secretHash) { res.status(401).json({ error: "Invalid signature" }); return; }
  }

  const event = req.body as Record<string, unknown>;
  if (event.event !== "charge.completed") { res.json({ ok: true }); return; }

  const data = event.data as Record<string, unknown>;
  const txRef = data?.tx_ref as string | undefined;

  // Flutterwave may return meta as a plain object OR as [{metaname, metavalue}] array
  const rawMeta = data?.meta;
  let hospitalId: number | undefined;
  if (Array.isArray(rawMeta)) {
    const entry = (rawMeta as Array<{ metaname: string; metavalue: unknown }>).find(m => m.metaname === "hospital_id");
    hospitalId = entry ? Number(entry.metavalue) : undefined;
  } else if (rawMeta && typeof rawMeta === "object") {
    hospitalId = (rawMeta as Record<string, unknown>).hospital_id as number | undefined;
  }
  // Fallback: parse from tx_ref "era-wallet-{id}-{timestamp}"
  if (!hospitalId && txRef) {
    const parts = txRef.split("-");
    if (parts.length >= 4 && parts[0] === "era" && parts[1] === "wallet") {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) hospitalId = parsed;
    }
  }

  if (!txRef || !hospitalId) { res.json({ ok: true }); return; }

  // Idempotency check — skip if already processed
  const { data: existing } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("flutterwave_ref", txRef)
    .maybeSingle();
  if (existing) { res.json({ ok: true }); return; }

  const { ok, amountKobo, detail } = await verifyFlutterwavePayment(txRef);
  if (!ok) {
    console.error("[wallet webhook] Verification failed:", detail);
    res.status(400).json({ error: detail });
    return;
  }

  await creditWallet(hospitalId, amountKobo, "Wallet top-up via Flutterwave", txRef);

  console.log(`[wallet] Credited ₦${amountKobo / 100} to hospital ${hospitalId} (ref: ${txRef})`);
  res.json({ ok: true });
});

// ── GET /api/wallet/transactions — hospital views their transaction history ───
router.get("/wallet/transactions", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount_kobo, description, flutterwave_ref, created_at")
    .eq("hospital_id", ctx.intId)
    .order("created_at", { ascending: false })
    .limit(50);

  res.json(data ?? []);
});

// ── POST /api/super-admin/hospitals/:id/wallet/credit — super admin manually credits wallet ──
router.post("/super-admin/hospitals/:id/wallet/credit", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const amountNaira = Number(req.body?.amountNaira);
  const description = (req.body?.description as string | undefined)?.trim() || "Manual credit by admin";
  if (!amountNaira || amountNaira <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }

  const amountKobo = Math.round(amountNaira * 100);
  await creditWallet(id, amountKobo, description);
  const { data } = await supabase.from("hospitals").select("wallet_balance_kobo").eq("id", id).single();
  res.json({ ok: true, balanceKobo: data?.wallet_balance_kobo, balanceNaira: (data?.wallet_balance_kobo as number) / 100 });
});

// ── GET /api/super-admin/hospitals/:id/wallet — super admin views wallet ──────
router.get("/super-admin/hospitals/:id/wallet", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [{ data: hospital }, { data: transactions }] = await Promise.all([
    supabase.from("hospitals").select("wallet_balance_kobo, name").eq("id", id).single(),
    supabase.from("wallet_transactions").select("*").eq("hospital_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    balanceKobo: hospital.wallet_balance_kobo,
    balanceNaira: (hospital.wallet_balance_kobo as number) / 100,
    transactions: transactions ?? [],
  });
});

// ── GET /api/hospital/sms-modules — hospital gets their SMS flip settings ──────
router.get("/hospital/sms-modules", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("hospital_modules").select("call_task_sms_enabled, followup_sms_enabled, appointment_reminder_sms_enabled").eq("hospital_id", ctx.intId).maybeSingle(),
    supabase.from("hospital_settings").select("termii_sender_id, sms_sender_id_approved").eq("hospital_id", ctx.intId).maybeSingle(),
  ]);

  const hasSenderId = !!(settings?.termii_sender_id as string | null)?.trim();
  const isApproved = !!(settings?.sms_sender_id_approved as boolean | null);
  const hasAt = !!process.env.AFRICAS_TALKING_API_KEY;
  const smsReady = hasAt || (hasSenderId && isApproved);
  const senderIdPending = !hasAt && hasSenderId && !isApproved;

  res.json({
    callTaskSmsEnabled: (data?.call_task_sms_enabled as boolean | null) ?? false,
    followupSmsEnabled: (data?.followup_sms_enabled as boolean | null) ?? false,
    appointmentReminderSmsEnabled: (data?.appointment_reminder_sms_enabled as boolean | null) ?? false,
    smsReady,
    senderIdPending,
    promotionalSmsRestricted: isPromotionalSmsRestricted(),
  });
});

// ── PATCH /api/hospital/sms-modules — hospital toggles their SMS flip settings ─
router.patch("/hospital/sms-modules", async (req: Request, res: Response): Promise<void> => {
  const ctx = await getHospitalFromRequest(req);
  if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, boolean> = {};
  if (typeof body.callTaskSmsEnabled === "boolean") updates.call_task_sms_enabled = body.callTaskSmsEnabled;
  if (typeof body.followupSmsEnabled === "boolean") updates.followup_sms_enabled = body.followupSmsEnabled;
  if (typeof body.appointmentReminderSmsEnabled === "boolean") updates.appointment_reminder_sms_enabled = body.appointmentReminderSmsEnabled;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields provided" }); return; }

  const { error } = await supabase.from("hospital_modules").update(updates).eq("hospital_id", ctx.intId);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ ok: true, ...updates });
});

export default router;
