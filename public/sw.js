/* TopHand Web Push service worker.
 * Served from /sw.js. Shows notifications when a push arrives (even with the
 * tab closed) and focuses/opens the right page when one is clicked. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'TopHand', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TopHand';
  const options = {
    body: data.body || '',
    icon: data.icon || '/TOPHAND.uz (1).png',
    badge: data.badge || '/TOPHAND.uz (1).png',
    tag: data.tag || undefined,
    timestamp: data.timestamp ? Date.parse(data.timestamp) : Date.now(),
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an existing tab if we have one.
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(url).catch(() => {});
          }
          return client.focus();
        }
      }
      // Otherwise open a fresh tab.
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(Promise.resolve());
});
