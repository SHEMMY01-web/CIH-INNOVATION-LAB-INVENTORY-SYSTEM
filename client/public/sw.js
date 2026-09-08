/**
 * CIH Innovation Lab Inventory - Offline-First Service Worker
 * Implements intelligent caching strategies inspired by Google Docs:
 * - Cache-First for all images (lab items, logos, diagrams)
 * - Cache-First for Google Fonts & Material Symbols
 * - Network-First with Cache Fallback for Supabase inventory queries (GET /rest/v1/*)
 * - Stale-While-Revalidate for application code, stylesheets, and HTML shell
 */

const CACHE_VERSION = 'v1.0.1';
const STATIC_CACHE = `cih-static-${CACHE_VERSION}`;
const IMAGES_CACHE = `cih-images-${CACHE_VERSION}`;
const FONTS_CACHE = `cih-fonts-${CACHE_VERSION}`;
const API_CACHE = `cih-api-${CACHE_VERSION}`;

const CORE_STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/IMAGES/cih-footer-logo.png',
  '/IMAGES/cih.jpeg',
  '/IMAGES/community-innovation-hub-logo.jpeg',
  '/IMAGES/empty-state.png',
  '/IMAGES/hero-bg.jpg',
  '/IMAGES/projects/project-rover.webp',
  '/IMAGES/projects/project-iot.webp',
  '/IMAGES/projects/project-ai.webp'
];

// Install Event: Pre-cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      try {
        await cache.addAll(CORE_STATIC_ASSETS);
      } catch (err) {
        console.warn('[SW] Some core assets could not be pre-cached:', err);
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, IMAGES_CACHE, FONTS_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent multi-tier routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (POST, PUT, DELETE should hit live server directly)
  if (request.method !== 'GET') {
    return;
  }

  // Ignore browser extension requests or chrome-devtools
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. Google Fonts & Material Symbols: Cache-First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirstStrategy(request, FONTS_CACHE));
    return;
  }

  // 2. Images: Cache-First (Item photos, assets, icons, logos)
  if (
    request.destination === 'image' ||
    url.pathname.startsWith('/IMAGES/') ||
    /\.(webp|png|jpg|jpeg|svg|gif|ico)(\?.*)?$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirstStrategy(request, IMAGES_CACHE));
    return;
  }

  // 3. Supabase REST API Queries: Network-First with Cache Fallback (allows offline inventory browsing)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    event.respondWith(networkFirstWithCacheFallback(request, API_CACHE));
    return;
  }

  // 4. HTML Navigation (Single Page App): Network-First, fallback to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 5. Static Assets (Scripts, Stylesheets, Vite chunks): Stale-While-Revalidate
  if (
    url.origin === self.location.origin &&
    (/\.(js|css|json)$/i.test(url.pathname) || url.pathname.startsWith('/assets/'))
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Default fetch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/**
 * Cache-First Strategy with Background Cache Population
 */
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // If offline and request is an image, provide fallback
    if (request.destination === 'image') {
      const fallback = await caches.match('/IMAGES/empty-state.png');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * Network-First Strategy with Offline Cache Fallback (for API data)
 */
async function networkFirstWithCacheFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Network failed (offline or timeout): Check cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add custom header indicating data served from offline cache
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Served-By', 'CIH-Offline-Cache');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }
    throw err;
  }
}

/**
 * Stale-While-Revalidate Strategy (Instant cache return + background refresh)
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || fetchPromise;
}
