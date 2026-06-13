import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("era_me_session");
    if (!stored) return null;
    return (JSON.parse(stored) as { token: string }).token ?? null;
  } catch { return null; }
}

function headers(extra: Record<string, string> = {}) {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}), ...extra };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function del<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "DELETE", headers: headers(), body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// ── Notification preferences ──────────────────────────────────────────────────

export interface NotificationPreferences {
  hospitalEnabled:  boolean;
  personalEnabled:  boolean;
  leadMins:         number;
  companionEnabled: boolean;
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ["notifications", "preferences"],
    queryFn: () => get<NotificationPreferences>(`${BASE}/notifications/preferences`),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, Partial<NotificationPreferences>>({
    mutationFn: (prefs) => patch(`${BASE}/notifications/preferences`, prefs),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
  });
}

// ── Inbox (hospital notifications) ───────────────────────────────────────────

export interface InboxNotification {
  id: number;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

export function useNotificationInbox() {
  return useQuery<InboxNotification[]>({
    queryKey: ["notifications", "inbox"],
    queryFn: () => get<InboxNotification[]>(`${BASE}/notifications/inbox`),
  });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: ["notifications", "unread"],
    queryFn: () => get<{ count: number }>(`${BASE}/notifications/unread-count`),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) => patch(`${BASE}/notifications/inbox/${id}/read`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      void qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    },
  });
}

// ── Push subscription management ─────────────────────────────────────────────

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch { return null; }
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY not set — push disabled");
    return null;
  }
  const reg = await registerServiceWorker();
  if (!reg) return null;

  const permission = await getPushPermission();
  if (permission !== "granted") return null;

  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await post(`${BASE}/push/subscribe`, { subscription: sub.toJSON(), type: "web" });
    return sub;
  } catch { return null; }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await del(`${BASE}/push/unsubscribe`, { endpoint }).catch(() => {});
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}
