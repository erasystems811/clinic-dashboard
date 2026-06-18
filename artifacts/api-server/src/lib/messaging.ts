/**
 * Mobile messaging delivery service.
 *
 * WhatsApp → Termii (DND does not affect WhatsApp)
 * SMS      → Termii (DND route for transactional, generic for promotional)
 *
 * Environment variables:
 *   TERMII_API_KEY   — Termii key (WhatsApp + SMS)
 *   TERMII_SENDER_ID — Fallback Termii sender ID
 *
 * Per-hospital sender ID is stored in hospital_settings.termii_sender_id.
 */

const TERMII_URL = "https://api.ng.termii.com/api/sms/send";

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

// ── Termii (WhatsApp + SMS) ───────────────────────────────────────────────────

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

// ── Promotional SMS time restriction ─────────────────────────────────────────
// Termii blocks promotional/generic SMS 5 PM – 8 AM WAT (UTC+1).
// DND/transactional route (N-Alert) is not affected.
export function isPromotionalSmsRestricted(): boolean {
  const watHour = (new Date().getUTCHours() + 1) % 24; // WAT = UTC+1
  return watHour >= 17 || watHour < 8;
}

export const PROMOTIONAL_SMS_RESTRICTED_MSG =
  "Promotional SMS is unavailable between 5:00 PM and 8:00 AM (Termii restriction). Please try again after 8:00 AM.";

// ── Public delivery functions ─────────────────────────────────────────────────

export async function deliverWhatsApp(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  const result = await termiiSend(msg, "whatsapp", opts);
  if (!result.ok) throw new Error(result.detail);
}

export async function deliverSms(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  if (opts.smsChannel === "dnd") {
    // DND-approved transactional route via Termii N-Alert sender.
    const branded = { ...msg, body: msg.body + "\n\nPowered by Era Patient" };
    const result = await termiiSend(branded, "dnd", { senderId: "N-Alert" });
    if (!result.ok) throw new Error(result.detail);
    return;
  }

  // Promotional/generic route — blocked by Termii 5 PM – 8 AM WAT.
  if (isPromotionalSmsRestricted()) {
    throw new Error(`TIME_RESTRICTED: ${PROMOTIONAL_SMS_RESTRICTED_MSG}`);
  }

  const result = await termiiSend(msg, "generic", opts);
  if (!result.ok) throw new Error(result.detail);
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
