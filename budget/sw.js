/* Offline support for the Budget home-screen app. The app shell is cached so it opens with no
   signal; your budget itself lives in this phone's local storage and never passes through here.
   VERSION is replaced at publish time so each release refreshes the cache. */
const VERSION = 'dev';
const CACHE = 'budget-' + VERSION;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('budget-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Same-origin files: network first so updates show up, cache as the offline fallback.
   Fonts and the PDF reader from their CDNs: cache first, since they never change. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cdn = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname);
  if (url.origin !== location.origin && !cdn) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (cdn) {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());
      return r;
    }
    const page = e.request.mode === 'navigate';
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) c.put(page ? 'index.html' : e.request, r.clone());
      return r;
    } catch {
      return (await c.match(page ? 'index.html' : e.request)) || (page && await c.match('./')) || Response.error();
    }
  })());
});
