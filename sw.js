/* Offline support for the phone / web version. Only registered when the app is hosted on the web
   (never in the desktop app). The app shell is cached; your data lives in IndexedDB and never passes through here.
   VERSION is replaced at publish time so each release refreshes the cache. */
const VERSION = 'dev';
const CACHE = 'ocd-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const list = await fetch('precache.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
    await c.addAll(['./', 'index.html', ...list]).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Network first for the page (so updates arrive), cache first for versioned assets; never touch other sites */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  const page = e.request.mode === 'navigate';
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (page) {
      try { const r = await fetch(e.request); c.put('index.html', r.clone()); return r; }
      catch { return (await c.match('index.html')) || (await c.match('./')) || Response.error(); }
    }
    const hit = await c.match(e.request);
    if (hit) return hit;
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch { return Response.error(); }
  })());
});
