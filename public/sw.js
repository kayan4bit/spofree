// Atomic Player service worker
// Cache strategy:
//  - App shell (navigation + static assets): stale-while-revalidate
//  - Images (covers, artwork): cache-first with size cap
//  - Media / audio streams: NEVER cached (range-request incompatible + signed URLs expire)
//  - API responses: network-first with 30s cache fallback

const VERSION = 'atomic-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const IMG_CACHE = `${VERSION}-img`;
const API_CACHE = `${VERSION}-api`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/ios-logo.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const isAudio = (req) => {
  const url = req.url;
  if (/\.(flac|m4a|mp3|aac|ogg|opus|wav|mp4)(\?|$)/i.test(url)) return true;
  const accept = req.headers.get('accept') || '';
  if (accept.includes('audio/')) return true;
  if (req.headers.get('range')) return true;
  return false;
};
const isImage = (req) => req.destination === 'image' || /\.(png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i.test(req.url);
const isApi = (url) => /qqdl\.site|squid\.wtf|itunes\.apple\.com|allorigins\.win|corsproxy\.io|cors\.sh/i.test(url);

const cacheFirst = async (req, cacheName, maxEntries = 120) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone());
      // Trim
      const keys = await cache.keys();
      if (keys.length > maxEntries) {
        for (const k of keys.slice(0, keys.length - maxEntries)) await cache.delete(k);
      }
    }
    return res;
  } catch {
    return hit || Response.error();
  }
};

const staleWhileRevalidate = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetchPromise;
};

const networkFirst = async (req, cacheName, timeoutMs = 4000) => {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept audio streams (Range requests break caching and CDN URLs expire)
  if (isAudio(req)) return;

  // SPA navigation fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try { return await fetch(req); }
        catch {
          const cache = await caches.open(SHELL_CACHE);
          const fallback = await cache.match('/index.html') || await cache.match('/');
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  if (isImage(req)) {
    event.respondWith(cacheFirst(req, IMG_CACHE, 200));
    return;
  }

  if (isApi(url.href)) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Static JS/CSS/fonts etc.
  event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
});
