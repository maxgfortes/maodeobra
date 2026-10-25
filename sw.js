importScripts('sw-manifest.js');

const VERSION = self.SW_VERSION;
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const PRECACHE = self.SW_PRECACHE;

const NEVER_CACHE = [
  /googleapis\.com/, /firebaseio\.com/, /cloudfunctions\.net/, /run\.app/,
  /mercadopago\.com/, /mercadolibre\.com/, /mlstatic\.com/, /\/api\//, /__\//,
];

const clean = (res) => (res.redirected
  ? res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers }))
  : res);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, await clean(res));
      } catch {}
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function cachedPage(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  return (await caches.match(request, { ignoreSearch: true }))
    || (await caches.match(path, { ignoreSearch: true }))
    || (await caches.match(`${path}.html`, { ignoreSearch: true }))
    || (await caches.match('./'))
    || (await caches.match('./index.html'));
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res.ok) cache.put(request, (await clean(res.clone())));
    return res;
  } catch {
    return (await cachedPage(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await caches.match(request, { ignoreSearch: true });
  const key = new URL(request.url);
  key.search = '';
  const network = fetch(request)
    .then((res) => { if (res.ok) cache.put(key.href, res.clone()); return res; })
    .catch(() => cached || Response.error());
  return cached || network;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(RUNTIME)).put(request, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (NEVER_CACHE.some((rx) => rx.test(url.href))) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
  }
});
