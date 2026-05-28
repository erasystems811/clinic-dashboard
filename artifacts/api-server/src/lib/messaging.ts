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
  channel: "whatsapp" | "generic" | "dnd",
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
  // WhatsApp requires a sender ID (the registered WhatsApp Business name/number).
  // DND/generic SMS can work without one — Termii uses a default numeric sender.
  if (channel === "whatsapp" && !senderId) {
    const detail = `[messaging] WhatsApp requires a Sender ID — set TERMII_SENDER_ID env var or configure a per-hospital Termii Sender ID in hospital settings.`;
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

    // Termii returns HTTP 200 even for failures — must check the body
    console.log(`[messaging] Termii response (${channel}): ${responseText}`);

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(responseText); } catch { /* keep empty */ }

    // Termii success: { "code": "ok", "message_id": "...", "message": "Successfully Sent" }
    // Termii errors: { "Code": "22", "Message": "Insufficient Balance" }
    //                { "code": "rejected", "message": "..." }
    const code = String(parsed.code ?? parsed.Code ?? "").toLowerCase();
    const termiiMessage = String(parsed.message ?? parsed.Message ?? "").toLowerCase();
    const isFailure = (code && code !== "ok") ||
      termiiMessage.includes("insufficient") ||
      termiiMessage.includes("invalid") ||
      termiiMessage.includes("rejected") ||
      termiiMessage.includes("failed");

    if (isFailure) {
      const detail = `[messaging] Termii rejected message (${channel}): ${responseText}`;
      console.error(detail);
      return { ok: false, detail: `Termii error: ${parsed.message ?? parsed.Message ?? responseText}` };
    }

    return { ok: true, detail: responseText };
  } catch (err) {
    const detail = `[messaging] Termii fetch error (${channel}): ${err instanceof Error ? err.message : String(err)}. Response: ${responseText}`;
    console.error(detail);
    throw new Error(detail);
  }
}

export async function deliverWhatsApp(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
  const result = await termiiSend(msg, "whatsapp", opts);
  if (!result.ok) throw new Error(result.detail);
}

export async function deliverSms(msg: MobileMessage, opts: MessagingOptions = {}): Promise<void> {
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
 * Test SMS delivery — used by the /api/super-admin/test-sms endpoint.
 * Returns a result object instead of throwing.
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
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, detail };
  }
}
