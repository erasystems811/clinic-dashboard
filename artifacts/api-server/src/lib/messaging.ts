/**
 * Mobile messaging delivery service.
 *
 * WhatsApp  → Termii (DND does not affect WhatsApp)
 * SMS       → Africa's Talking if configured (proper transactional route, bypasses DND)
 *             Falls back to Termii SMS if Africa's Talking is not configured.
 *
 * Environment variables:
 *   TERMII_API_KEY                — Termii key (WhatsApp + SMS fallback)
 *   TERMII_SENDER_ID              — Fallback Termii sender ID
 *   AFRICAS_TALKING_API_KEY       — Africa's Talking key (preferred for SMS)
 *   AFRICAS_TALKING_USERNAME      — Africa's Talking username (usually "sandbox" for test, your AT username for prod)
 *   AFRICAS_TALKING_SENDER_ID     — Africa's Talking sender ID / shortcode (optional)
 *
 * Per-hospital sender ID is stored in hospital_settings.termii_sender_id.
 */

const TERMII_URL     = "https://api.ng.termii.com/api/sms/send";
const AT_SMS_URL     = "https://api.africastalking.com/version1/messaging";

export interface MobileMessage {
  to: string;
  body: string;
}

export interface MessagingOptions {
  senderId?: string | null;
  /** "dnd" = Termii DND route (N-Alert sender, bypasses DND, 4 approved templates only).
   *  "generic" = promotional route (hospital sender ID). Defaults to "generic". */
  smsChannel?: "dnd" | "generic";
}

// ── Phone normalisation ───────────────────────────────────────────────────────
/** Convert local Nigerian format to E.164 international (09012345678 → 2349012345678) */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length <= 11) return "234" + digits.slice(1);
  return digits;
}

// ── Africa's Talking SMS ──────────────────────────────────────────────────────
// Proper transactional route — bypasses DND for healthcare/transactional messages.

async function africasTalkingSend(
  msg: MobileMessage,
  opts: MessagingOptions = {},
): Promise<{ ok: boolean; detail: string }> {
  const apiKey   = process.env.AFRICAS_TALKING_API_KEY;
  const username = process.env.AFRICAS_TALKING_USERNAME;
  const from     = opts.senderId?.trim() || process.env.AFRICAS_TALKING_SENDER_ID;
  const to       = "+" + normalisePhone(msg.to); // AT requires + prefix

  if (!apiKey || !username) {
    return { ok: false, detail: "[messaging] Africa's Talking not configured" };
  }

  const params = new URLSearchParams({
    username,
    to,
    message: msg.body,
  });
  if (from) params.set("from", from);

  console.log(`[messaging] Africa's Talking SMS → ${to} from "${from ?? "default"}"`);

  try {
    const response = await fetch(AT_SMS_URL, {
      method: "POST",
      headers: {
        "apiKey":       apiKey,
        "Accept":       "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    console.log(`[messaging] Africa's Talking response: ${responseText}`);

    if (!response.ok) {
      const detail = `[messaging] Africa's Talking HTTP ${response.status}: ${responseText}`;
      console.error(detail);
      return { ok: false, detail };
    }

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(responseText); } catch { /* keep empty */ }

    // AT response: { SMSMessageData: { Recipients: [{ status: "Success", ... }] } }
    const smsData = parsed.SMSMessageData as Record<string, unknown> | undefined;
    const recipients = (smsData?.Recipients as Array<Record<string, unknown>>) ?? [];
    const anySuccess = recipients.some(r => String(r.status ?? "").toLowerCase() === "success");

    if (!anySuccess && recipients.length > 0) {
      const detail = `[messaging] Africa's Talking delivery failed: ${responseText}`;
      console.error(detail);
      return { ok: false, detail };
    }

    return { ok: true, detail: responseText };
  } catch (err) {
    const detail = `[messaging] Africa's Talking fetch error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(detail);
    return { ok: false, detail };
  }
}

// ── Termii (WhatsApp + SMS fallback) ─────────────────────────────────────────

async function termiiSend(
  msg: MobileMessage,
  channel: "whatsapp" | "generic" | "dnd",
  opts: MessagingOptions = {},
): Promise<{ ok: boolean; detail: string; isDndBlocked?: boolean }> {
  const apiKey   = process.env.TERMII_API_KEY;
  const senderId = opts.senderId?.trim() || process.env.TERMII_SENDER_ID;
  const to       = normalisePhone(msg.to);

  if (!apiKey) {
    const detail = `[messaging] TERMII_API_KEY not set — skipping ${channel} to ${msg.to}`;
    console.warn(detail);
    return { ok: false, detail };
  }

  if (channel === "whatsapp" && !senderId) {
    const detail = `[messaging] WhatsApp requires a Sender ID — set TERMII_SENDER_ID or configure per-hospital Termii Sender ID.`;
    console.warn(detail);
    throw new Error(detail);
  }

  const payload: Record<string, string> = {
    api_key: apiKey,
    to,
    sms: msg.body,
    type: "plain",
    channel,
  };
  if (senderId) payload.from = senderId;

  console.log(`[messaging] Termii ${channel} → ${to} from "${senderId ?? "default"}"`);

  let responseText = "";
  try {
    const response = await fetch(TERMII_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    responseText = await response.text();

    if (!response.ok) {
      const detail = `[messaging] Termii HTTP ${response.status} (${channel}): ${responseText}`;
      console.error(detail);
      throw new Error(detail);
    }

    console.log(`[messaging] Termii response (${channel}): ${responseText}`);

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(responseText); } catch { /* keep empty */ }

    const code         = String(parsed.code ?? parsed.Code ?? "").toLowerCase();
    const termiiMsg    = String(parsed.message ?? parsed.Message ?? "").toLowerCase();
    const isDndBlocked = termiiMsg.includes("dnd") || termiiMsg.includes("do not disturb") || termiiMsg.includes("not deliverable");
    const isFailure    = isDndBlocked || (code && code !== "ok") ||
      termiiMsg.includes("insufficient") ||
      termiiMsg.includes("invalid") ||
      termiiMsg.includes("rejected") ||
      termiiMsg.includes("failed");

    if (isFailure) {
      const rawMsg = String(parsed.message ?? parsed.Message ?? responseText);
      const prefix = isDndBlocked ? "DND_BLOCKED" : "Termii error";
      console.error(`[messaging] Termii ${isDndBlocked ? "DND blocked" : "rejected"} (${channel}): ${responseText}`);
      return { ok: false, detail: `${prefix}: ${rawMsg}`, isDndBlocked };
    }

    return { ok: true, detail: responseText };
  } catch (err) {
    const detail = `[messaging] Termii fetch error (${channel}): ${err instanceof Error ? err.message : String(err)}. Response: ${responseText}`;
    console.error(detail);
    throw new Error(detail);
  }
}

// ── Public delivery functions ─────────────────────────────────────────────────

export async function deliverWhatsApp(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  const result = await termiiSend(msg, "whatsapp", opts);
  if (!result.ok) throw new Error(result.detail);
}

export async function deliverSms(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  if (opts.smsChannel === "dnd") {
    // DND-approved transactional messages — branded with "Powered by Era Patient".
    // Try AT (transactional, bypasses DND), then Termii DND with fixed N-Alert sender.
    const branded = { ...msg, body: msg.body + "\n\nPowered by Era Patient" };
    const atResult = await africasTalkingSend(branded, opts);
    if (atResult.ok) return;
    if (!atResult.detail.includes("not configured")) throw new Error(atResult.detail);
    const dndResult = await termiiSend(branded, "dnd", { senderId: "N-Alert" });
    if (!dndResult.ok) throw new Error(dndResult.detail);
    return;
  }

  // Promotional/generic route — no extra branding. Try AT, then Termii generic.
  const atResult = await africasTalkingSend(msg, opts);
  if (atResult.ok) return;
  if (!atResult.detail.includes("not configured")) throw new Error(atResult.detail);

  console.log("[messaging] Africa's Talking not configured, falling back to Termii for SMS");
  const termiiResult = await termiiSend(msg, "generic", opts);
  if (!termiiResult.ok) throw new Error(termiiResult.detail); // detail already prefixed "DND_BLOCKED:" when applicable
}

export async function deliverMobileMessage(
  channel: "whatsapp" | "sms",
  to: string,
  body: string,
  opts: MessagingOptions = {},
): Promise<void> {
  if (channel === "sms") {
    await deliverSms({ to, body }, opts);
  } else {
    await deliverWhatsApp({ to, body }, opts);
  }
}

/**
 * Test SMS delivery — used by /api/super-admin/test-sms
 */
export async function testSmsDelivery(
  to: string,
  senderId?: string,
  channel: "generic" | "dnd" = "dnd",
): Promise<{ ok: boolean; detail: string }> {
  // Test Africa's Talking first if configured
  if (process.env.AFRICAS_TALKING_API_KEY) {
    return africasTalkingSend({ to, body: "Era test message — SMS delivery is working." }, { senderId });
  }
  // Otherwise test Termii
  try {
    return await termiiSend(
      { to, body: "Era test message — SMS delivery is working." },
      channel,
      { senderId },
    );
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
