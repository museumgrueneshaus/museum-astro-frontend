/*
  Minimal App Shell service worker for Astro kiosk
  - Precaches app shell and offline page
  - Runtime cache for same-origin assets (stale-while-revalidate)
  - Network-first for navigation + Sanity API with offline fallback
*/

const VERSION = 'v1.0.0';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_URLS = [
  '/',
  '/offline.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function isImage(request) {
  return request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg)$/i.test(new URL(request.url).pathname);
}

function isSanityApi(url) {
  return /\.sanity\.io\//.test(url.hostname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // App-like navigation: network-first, fallback to cache, then offline
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/offline.html')))
    );
    return;
  }

  // Sanity API: network-first, fallback to cache
  if (isSanityApi(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Images: stale-while-revalidate
  if (isImage(req)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || network || fetch(req);
      })
    );
    return;
  }

  // Static assets (CSS/JS): stale-while-revalidate
  if (req.destination === 'style' || req.destination === 'script' || req.destination === 'font') {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || network || fetch(req);
      })
    );
  }
});

