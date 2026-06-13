import webpush from "web-push";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

let webPushReady = false;

export function initWebPush(): boolean {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT ?? "mailto:admin@erasystems.com.ng";

  if (!publicKey || !privateKey) {
    logger.warn("[push] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — web push disabled");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  webPushReady = true;
  logger.info("[push] Web push initialised");
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Sends to all registered devices for one account.
// Designed to be native-app-ready: the `type` column lets future FCM/APNs
// handlers live alongside the existing web handler with no schema changes.
export async function sendPushToAccount(accountId: number, payload: PushPayload): Promise<void> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, type, subscription")
    .eq("account_id", accountId);

  if (!subs?.length) return;

  const data = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url ?? "/",
    tag:   payload.tag ?? "era-health",
    icon:  "/era-icon-192.png",
    badge: "/era-badge-72.png",
  });

  for (const sub of subs) {
    if (sub.type === "web") {
      if (!webPushReady) continue;
      try {
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, data);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 410 || code === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id as number);
          logger.info(`[push] Cleaned up expired web subscription id=${sub.id as number}`);
        } else {
          logger.warn({ err }, `[push] Web push failed for account ${accountId}`);
        }
      }
    }
    // 'fcm' and 'apns' handlers will slot in here when the native app ships
  }
}

// Convenience: send to multiple accounts at once
export async function sendPushToAccounts(accountIds: number[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(accountIds.map(id => sendPushToAccount(id, payload)));
}
