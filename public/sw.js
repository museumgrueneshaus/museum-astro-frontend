/*
  Service Worker for Museum Kiosk System
  Cache name: museum-kiosk-v1

  Fetch strategies:
  - Sanity API (api.sanity.io)         : Network-first, 5 s timeout, cache 1 h
  - Sanity CDN images (cdn.sanity.io/images) : Cache-first
  - Sanity CDN files  (cdn.sanity.io/files)  : Network-only (videos, too large to cache)
  - Local static assets (/_astro/, fonts, /favicon) : Cache-first
  - Navigation (HTML pages)            : Network-first, fallback to cache
  - Everything else                    : Network-first, fallback to cache
*/

const CACHE_NAME = 'museum-kiosk-v1';

// Shell resources pre-cached on install
const SHELL_URLS = [
  '/kiosk/',
  '/kiosk/video',
  '/kiosk/slideshow',
  '/kiosk/explorer',
  '/kiosk/reader',
];

// Optional resources — missing ones won't abort install
const OPTIONAL_URLS = [
  '/kiosk-config.json',
];

// How long (ms) to wait for the network before falling back to cache (Sanity API)
const API_NETWORK_TIMEOUT_MS = 5000;

// How long (s) a Sanity API response stays fresh in cache
const API_CACHE_MAX_AGE_S = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log('[SW museum-kiosk-v1]', ...args);
}

/**
 * Race a fetch against a timeout.  Resolves with the Response or rejects when
 * the timeout fires first.
 */
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Returns true if the cached response is still within maxAgeSeconds. */
function isFresh(response, maxAgeSeconds) {
  if (!response) return false;
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  const ageMs = Date.now() - new Date(dateHeader).getTime();
  return ageMs < maxAgeSeconds * 1000;
}

// ---------------------------------------------------------------------------
// Install — pre-cache shell resources
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  log('Installing…');

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Required shell URLs — fail install if any are unreachable
      log('Pre-caching shell URLs:', SHELL_URLS);
      await cache.addAll(SHELL_URLS);

      // Optional URLs — cache individually so a 404 doesn't break install
      await Promise.all(
        OPTIONAL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            log(`Optional resource not cached (${url}):`, err.message);
          })
        )
      );

      log('Pre-cache complete.');
    })
  );
});

// ---------------------------------------------------------------------------
// Activate — delete old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  log('Activating…');

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              log('Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        log('Activation complete — claiming clients.');
        return self.clients.claim();
      })
  );
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    log('SKIP_WAITING received — activating immediately.');
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Fetch — routing
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // Unparseable URL — let browser handle it
  }

  // ------------------------------------------------------------------
  // 1. Sanity CDN files (cdn.sanity.io/files) — videos, Network-only
  // ------------------------------------------------------------------
  if (url.hostname === 'cdn.sanity.io' && url.pathname.startsWith('/files')) {
    // Do NOT cache — too large (video files)
    event.respondWith(fetch(request));
    return;
  }

  // ------------------------------------------------------------------
  // 2. Sanity CDN images (cdn.sanity.io/images) — Cache-first
  // ------------------------------------------------------------------
  if (url.hostname === 'cdn.sanity.io' && url.pathname.startsWith('/images')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ------------------------------------------------------------------
  // 3. Sanity API (api.sanity.io) — Network-first with timeout + 1 h cache
  // ------------------------------------------------------------------
  if (url.hostname === 'api.sanity.io') {
    event.respondWith(sanityApiStrategy(request));
    return;
  }

  // ------------------------------------------------------------------
  // 4. Local static assets — Cache-first
  //    Matches: /_astro/*, /fonts/*, /favicon*
  // ------------------------------------------------------------------
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_astro/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname.startsWith('/favicon'));

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ------------------------------------------------------------------
  // 5. Navigation requests (HTML pages) — Network-first, fallback cache
  // ------------------------------------------------------------------
  if (
    request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ------------------------------------------------------------------
  // 6. Everything else — Network-first, fallback cache
  // ------------------------------------------------------------------
  event.respondWith(networkFirst(request));
});

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

/** Cache-first: serve from cache; fetch and populate cache on miss. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    log('Cache-first fetch failed (no cached fallback):', request.url, err.message);
    throw err;
  }
}

/** Network-first: try network, fall back to cache on failure. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    log('Network-first falling back to cache:', request.url, err.message);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Sanity API strategy:
 * - Network-first with 5 s timeout
 * - Successful responses cached for 1 hour
 * - On timeout / failure, fall back to cache regardless of age
 */
async function sanityApiStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetchWithTimeout(request, API_NETWORK_TIMEOUT_MS);

    if (response.ok) {
      // Store response with a synthetic Date header so we can check freshness later
      const headers = new Headers(response.headers);
      if (!headers.get('date')) {
        headers.set('date', new Date().toUTCString());
      }
      const body = await response.arrayBuffer();
      const cachedResponse = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, cachedResponse.clone());

      // Return a fresh copy to the page
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: new Headers(cachedResponse.headers),
      });
    }

    return response; // Non-OK — return as-is without caching
  } catch (err) {
    log('Sanity API network failed, checking cache:', request.url, err.message);

    const cached = await cache.match(request);
    if (cached) {
      if (isFresh(cached, API_CACHE_MAX_AGE_S)) {
        log('Serving fresh cached Sanity API response:', request.url);
      } else {
        log('Serving stale cached Sanity API response (network unavailable):', request.url);
      }
      return cached;
    }

    log('No cached Sanity API response available:', request.url);
    throw err;
  }
}
