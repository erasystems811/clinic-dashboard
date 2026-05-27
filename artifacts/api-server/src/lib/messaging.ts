/**
 * Mobile messaging delivery service.
 *
 * Both WhatsApp and SMS are delivered via Termii.
 *
 * Platform-level environment variables (Railway API Server):
 *   TERMII_API_KEY     — Termii API key (shared across all hospitals)
 *   TERMII_SENDER_ID   — Fallback sender ID when a hospital hasn't set their own
 *
 * Per-hospital sender ID is stored in hospital_settings.termii_sender_id.
 * Pass it via the `senderId` option to override the platform default.
 *
 * Termii docs: https://developers.termii.com/messaging
 */

const TERMII_URL = "https://api.ng.termii.com/api/sms/send";

export interface MobileMessage {
  to: string;
  body: string;
}

export interface MessagingOptions {
  /** Per-hospital Termii sender ID. Falls back to TERMII_SENDER_ID env var. */
  senderId?: string | null;
}

/** Normalise phone to international format (09012345678 → 2349012345678) */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length <= 11) return "234" + digits.slice(1);
  return digits;
}

async function termiiSend(
  msg: MobileMessage,
  channel: "whatsapp" | "generic",
  opts: MessagingOptions = {},
): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = opts.senderId?.trim() || process.env.TERMII_SENDER_ID;
  const to = normalisePhone(msg.to);

  if (!apiKey) {
    const detail = `[messaging] TERMII_API_KEY not set — skipping ${channel} to ${msg.to}`;
    console.warn(detail);
    return { ok: false, detail };
  }
  if (!senderId) {
    const detail = `[messaging] No sender ID (TERMII_SENDER_ID env var or per-hospital termii_sender_id) — skipping ${channel} to ${msg.to}`;
    console.warn(detail);
    return { ok: false, detail };
  }

  const payload = {
    api_key: apiKey,
    to,
    from: senderId,
    sms: msg.body,
    type: "plain",
    channel,
  };

  console.log(`[messaging] Sending ${channel} to ${to} (raw: ${msg.to}) from "${senderId}"`);

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

    // Termii may return 200 with an error object — log the full body either way
    console.log(`[messaging] Termii response (${channel}): ${responseText}`);
    return { ok: true, detail: responseText };
  } catch (err) {
    const detail = `[messaging] Termii fetch error (${channel}): ${err instanceof Error ? err.message : String(err)}. Response: ${responseText}`;
    console.error(detail);
    throw new Error(detail);
  }
}

export async function deliverWhatsApp(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  await termiiSend(msg, "whatsapp", opts);
}

export async function deliverSms(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  await termiiSend(msg, "generic", opts);
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
 * Test SMS delivery — used by the /api/super-admin/test-sms endpoint.
 * Returns a result object instead of throwing.
 */
export async function testSmsDelivery(to: string, senderId?: string): Promise<{ ok: boolean; detail: string }> {
  try {
    return await termiiSend(
      { to, body: "Era test message — SMS delivery is working." },
      "generic",
      { senderId },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, detail };
  }
}
