/**
 * Mobile messaging delivery service.
 *
 * Supports two channels per hospital configuration:
 *   whatsapp — Twilio WhatsApp API (stub until credentials are set)
 *   sms       — Termii SMS API (stub until credentials are set)
 *
 * To activate either channel, fill in the TODO block for that channel and
 * set the corresponding environment variables in Railway.
 */

export interface MobileMessage {
  to: string;
  body: string;
}

export async function deliverWhatsApp(msg: MobileMessage): Promise<void> {
  // TODO: Replace with Twilio WhatsApp API call once credentials are ready.
  // const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // const authToken  = process.env.TWILIO_AUTH_TOKEN;
  // const from       = process.env.TWILIO_WHATSAPP_FROM; // e.g. +14155238886
  // const response = await fetch(
  //   `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  //   {
  //     method: "POST",
  //     headers: {
  //       Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
  //       "Content-Type": "application/x-www-form-urlencoded",
  //     },
  //     body: new URLSearchParams({
  //       From: `whatsapp:${from}`,
  //       To:   `whatsapp:${msg.to}`,
  //       Body: msg.body,
  //     }),
  //   },
  // );
  // if (!response.ok) throw new Error(`Twilio error: ${await response.text()}`);
  void msg;
}

export async function deliverSms(msg: MobileMessage): Promise<void> {
  // TODO: Replace with Termii SMS API call once credentials are ready.
  // await fetch("https://api.ng.termii.com/api/sms/send", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     to:      msg.to,
  //     from:    process.env.TERMII_SENDER_ID,
  //     sms:     msg.body,
  //     type:    "plain",
  //     channel: "dnd",
  //     api_key: process.env.TERMII_API_KEY,
  //   }),
  // });
  void msg;
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
