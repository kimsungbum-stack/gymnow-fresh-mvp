const CACHE_NAME = 'gymnow-v3.8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css?v=3.8',
  '/script.js?v=3.8',
  '/firebase-config.js?v=3.8',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('/index.html', networkResponse.clone());
        return networkResponse;
      } catch (error) {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const networkResponse = await fetch(event.request);
    if (event.request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  })());
});
