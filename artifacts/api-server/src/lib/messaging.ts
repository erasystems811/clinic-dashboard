/**
 * Mobile messaging delivery service.
 *
 * Both WhatsApp and SMS are delivered via Termii.
 *
 * Required environment variables:
 *   TERMII_API_KEY     — Termii API key
 *   TERMII_SENDER_ID   — Approved sender ID (used for both channels)
 *
 * Termii docs: https://developers.termii.com/messaging
 */

const TERMII_URL = "https://api.ng.termii.com/api/sms/send";

export interface MobileMessage {
  to: string;
  body: string;
}

async function termiiSend(
  msg: MobileMessage,
  channel: "whatsapp" | "generic",
): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;

  if (!apiKey || !senderId) {
    console.warn(`[messaging] Termii not configured — skipping ${channel} message to ${msg.to}`);
    return;
  }

  const response = await fetch(TERMII_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: msg.to,
      from: senderId,
      sms: msg.body,
      type: "plain",
      channel,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Termii error (${channel}): ${text}`);
  }
}

export async function deliverWhatsApp(msg: MobileMessage): Promise<void> {
  await termiiSend(msg, "whatsapp");
}

export async function deliverSms(msg: MobileMessage): Promise<void> {
  await termiiSend(msg, "generic");
}

export async function deliverMobileMessage(
  channel: "whatsapp" | "sms",
  to: string,
  body: string,
): Promise<void> {
  if (channel === "sms") {
    await deliverSms({ to, body });
  } else {
    await deliverWhatsApp({ to, body });
  }
}
