const CACHE_NAME = 'gymnow-v3.6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css?v=3.6',
    '/script.js?v=3.6',
    '/firebase-config.js?v=3.6',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    'https://unpkg.com/lucide@latest'
];

// Install: Cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Pre-caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

// Fetch: Serve from cache, then network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
