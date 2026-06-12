export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifPermission(): NotificationPermission | null {
  return canNotify() ? Notification.permission : null;
}

export async function requestNotifPermission(): Promise<boolean> {
  if (!canNotify()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function fireNotification(title: string, body: string) {
  if (!canNotify() || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icon-192.png" });
}

// Call on home mount — fires an evening reminder once per day
export function maybeFireEveningReminder(pendingCount: number) {
  if (!canNotify() || Notification.permission !== "granted") return;
  if (pendingCount === 0) return;
  const hour = new Date().getHours();
  if (hour < 18) return;

  const today = new Date().toDateString();
  if (localStorage.getItem("era_reminded") === today) return;
  localStorage.setItem("era_reminded", today);

  fireNotification(
    "ERA Health — evening check-in 🌙",
    `${pendingCount} habit${pendingCount > 1 ? "s" : ""} still to log today. Keep your streak alive!`
  );
}
