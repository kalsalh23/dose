const CACHE = 'dose-v7';
const CORE = ['/', '/logo.jpg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

/* الإشعارات الفورية */
self.addEventListener('push', (e) => {
  let d = { title: 'Dose Cafe', body: '' };
  try { d = e.data.json(); } catch { try { d = { title: 'Dose Cafe', body: e.data.text() }; } catch {} }
  const title = d.title || 'Dose Cafe';
  const url = d.url || (title.includes('طلب جديد') ? '/admin?tab=orders' : '/orders');
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: { url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          try { c.navigate(url); } catch {}
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* تخزين الصور مؤقتًا (تشمل صور Supabase) لتسريع الفتح */
  if (e.request.destination === 'image' || url.pathname.includes('/storage/v1/object/public/images/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => Response.error()))
    );
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/img/') || url.pathname === '/logo.jpg') {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }
  if (url.pathname === '/' || url.pathname.startsWith('/kiosk') || url.pathname.startsWith('/admin')) {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
});
