const CACHE_NAME = 'existo-chatapp-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/logo.jpg'];

const shouldBypassCache = (request) => {
  const url = new URL(request.url);
  return request.method !== 'GET'
    || request.headers.has('range')
    || url.pathname.startsWith('/socket.io/')
    || url.pathname.startsWith('/api/');
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (shouldBypassCache(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          const isCacheable = response.ok
            && response.status !== 206
            && event.request.url.startsWith(self.location.origin);
          if (isCacheable) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match('/'));
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.some((client) => client.visibilityState === 'visible')) return;
      return self.registration.showNotification(payload.title || 'New message', {
        body: payload.body || 'You have a new message',
        icon: '/logo.jpg',
        badge: '/favicon.svg',
        tag: payload.tag || 'chat-message',
        data: { url: payload.url || '/' },
        vibrate: [120, 60, 120],
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
