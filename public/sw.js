// SIPBD Mempawah - Service Worker for Push Notifications

const APP_URL = self.location.origin;

// Handle push event — show notification
self.addEventListener('push', (event) => {
  let data = {
    title: 'SIPBD Mempawah',
    body: 'Anda memiliki notifikasi baru',
    url: APP_URL,
    icon: `${APP_URL}/logo-mempawah.png`,
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      // If data is not JSON, use it as body text
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || `${APP_URL}/logo-mempawah.png`,
    badge: `${APP_URL}/logo-mempawah.png`,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || APP_URL,
    },
    actions: [
      { action: 'open', title: 'Buka Aplikasi' },
      { action: 'close', title: 'Tutup' },
    ],
    tag: 'sipbd-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || APP_URL;

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url.includes(APP_URL) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Handle push subscription change — resubscribe with new endpoint
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[sw] Push subscription changed, resubscribing...');

  event.waitUntil(
    self.registration.pushManager.getSubscription().then(async (subscription) => {
      if (!subscription) {
        console.log('[sw] No active subscription');
        return;
      }

      // Notify the server about the new subscription
      try {
        const response = await fetch(`${APP_URL}/api/notifications/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            userId: 'admin',
          }),
        });

        if (response.ok) {
          console.log('[sw] Successfully resubscribed');
        } else {
          console.error('[sw] Failed to resubscribe:', response.status);
        }
      } catch (error) {
        console.error('[sw] Error resubscribing:', error);
      }
    })
  );
});

// Install event — cache essential assets
self.addEventListener('install', () => {
  console.log('[sw] Service Worker installed');
  self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[sw] Service Worker activated');
  event.waitUntil(self.clients.claim());
});
