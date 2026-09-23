/**
 * CIH Innovation Lab Inventory - Offline-First Service Worker
 * Implements intelligent caching strategies inspired by Google Docs:
 * - Cache-First for all images (lab items, logos, diagrams)
 * - Cache-First for Google Fonts & Material Symbols
 * - Network-First with Cache Fallback for Supabase inventory queries (GET /rest/v1/*)
 * - Stale-While-Revalidate for application code, stylesheets, and HTML shell
 */

const CACHE_VERSION = 'v1.0.5';
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

  // 3. Supabase REST API Queries: Network-First with Cache Fallback for public catalog & comments.
  // Privileged queries (transactions, projects, attendance, RPCs) bypass CacheStorage to ensure fresh data.
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    // CRITICAL: CacheStorage only supports idempotent GET requests.
    // Mutations (POST, PATCH, PUT, DELETE) must bypass the cache handler completely.
    if (request.method !== 'GET') {
      return;
    }

    const isPublicEndpoint = url.pathname.includes('/items') || url.pathname.includes('/comments');
    const isStaffEndpoint = url.pathname.includes('/transactions') || 
                            url.pathname.includes('/projects') || 
                            url.pathname.includes('/attendance_logs') ||
                            url.pathname.includes('/rpc/');

    if (isPublicEndpoint && !isStaffEndpoint) {
      event.respondWith(networkFirstWithCacheFallback(request, API_CACHE));
      return;
    }
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
 * 
 * When serving from cache (offline mode), stamps the response with:
 *   X-CIH-Cache-Status: STALE  — signals to the React layer that this is cached data
 *   X-CIH-Cached-At: <ISO>     — timestamp of when the response was originally cached
 *
 * The application can inspect these headers after fetch() to show an ambient
 * "Viewing cached data — stock levels may be outdated" warning banner.
 */
async function networkFirstWithCacheFallback(request, cacheName) {
  const controller = new AbortController();
  // 4-second timeout: Prevents stalling on Lie-Fi / captive portals by falling back to cache
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    // Network failed or timed out (offline/Lie-Fi): serve from cache with staleness headers
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      const cachedAt = cachedResponse.headers.get('date') || new Date().toISOString();
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Served-By', 'CIH-Offline-Cache');
      headers.set('X-CIH-Cache-Status', 'STALE');
      headers.set('X-CIH-Cached-At', cachedAt);
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
 * Includes MIME type guards to prevent caching HTML SPA rewrites as CSS/JS assets.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const isCodeAsset = /\.(js|css)$/i.test(request.url);

  // If cached response exists, verify it is not a corrupted HTML fallback
  if (cachedResponse) {
    const cachedType = cachedResponse.headers.get('content-type') || '';
    if (isCodeAsset && cachedType.includes('text/html')) {
      // Poisoned entry from SPA rewrite! Discard and purge from cache.
      await cache.delete(request);
    } else {
      // Revalidate in background to keep cache fresh
      fetch(request.clone())
        .then((networkResponse) => {
          if (networkResponse?.ok) {
            const netType = networkResponse.headers.get('content-type') || '';
            if (!isCodeAsset || !netType.includes('text/html')) {
              cache.put(request, networkResponse.clone());
            }
          }
        })
        .catch(() => null);

      return cachedResponse;
    }
  }

  // Not in cache or purged: fetch fresh from network
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse && networkResponse.ok) {
      const netType = networkResponse.headers.get('content-type') || '';
      if (!isCodeAsset || !netType.includes('text/html')) {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch (err) {
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

/**
 * Message Event: Invalidate API cache upon inventory mutations to prevent stale stock reads
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INVALIDATE_API_CACHE') {
    event.waitUntil(
      caches.open(API_CACHE)
        .then(async (cache) => {
          // Delete all keys within the cache instead of deleting the cache itself.
          // caches.delete() then caches.open() has a race window where concurrent
          // fetches see no cache and fail to store responses.
          const keys = await cache.keys();
          await Promise.all(keys.map(key => cache.delete(key)));

          // Notify all controlled clients that invalidation is complete
          const clients = await self.clients.matchAll({ includeUncontrolled: false });
          clients.forEach(client => {
            client.postMessage({ type: 'API_CACHE_INVALIDATED', timestamp: Date.now() });
          });
        })
    );
  }
});
