// ERA Health Service Worker — handles push notifications and notification clicks.
// Designed for web-first with native app in mind:
// when the native app ships, this file stays for web fallback, native uses its own channel.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { return; }

  const title = data.title ?? "ERA Health";
  const options = {
    body:    data.body ?? "",
    icon:    data.icon ?? "/era-icon-192.png",
    badge:   data.badge ?? "/era-badge-72.png",
    tag:     data.tag  ?? "era-health",
    data:    { url: data.url ?? "/" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "NAVIGATE", url });
          return client.focus();
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});

// Re-subscribe when the push subscription expires
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch("/api/patient-app/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON(), type: "web" }),
        });
      })
      .catch(() => {})
  );
});
