/* CITYMUS service worker · caches the app shell so the Home Screen app
   opens without a connection. Audio is never touched here: downloaded songs
   live in IndexedDB and stream/range requests go straight to the network. */
const VERSION = '__BUILD__';
const CACHE = 'mt-shell-' + VERSION;
const SHELL = ['./', 'index.html', 'remote-audio-map.js', 'literature-catalog.js', 'literature-audio-map.js', 'citymus-library.js', 'ebook-catalog.js', 'site.webmanifest',
  'apple-touch-icon.png', 'assets/icons/apple-touch-icon-152.png', 'assets/icons/apple-touch-icon-167.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.svg', 'assets/limited/taipei-word.png', 'assets/limited/taipei-cn.png', 'assets/citymus-wordmark.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ((k.startsWith('mt-') && k !== CACHE && k !== 'mt-fonts') || k.startsWith('citymus-lockscreen-'))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin CITYMUS audio identity bridge. It never caches audio and it
  // forwards byte-range requests so Safari can seek normally. Providers that
  // disallow CORS return 502 here; Player then falls through to the original
  // remote URL, preserving playback reliability.
  if (url.origin === location.origin && /\/__citymus_audio\/?$/.test(url.pathname)) {
    const raw = url.searchParams.get('u') || '';
    let target;
    try {
      target = new URL(raw);
      if (!/^https?:$/.test(target.protocol) || target.origin === location.origin) throw new Error('bad target');
    } catch (_) {
      e.respondWith(new Response('', { status: 400, headers: { 'Cache-Control': 'no-store' } }));
      return;
    }
    const h = new Headers();
    const range = req.headers.get('range');
    if (range) h.set('Range', range);
    e.respondWith(fetch(target.href, {
      method: 'GET',
      headers: h,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store'
    }).then(up => {
      const headers = new Headers();
      for (const k of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']) {
        const v = up.headers.get(k); if (v) headers.set(k, v);
      }
      headers.set('Cache-Control', 'no-store');
      headers.set('X-CITYMUS-Audio', '1');
      return new Response(up.body, { status: up.status, statusText: up.statusText, headers });
    }).catch(() => new Response('', { status: 502, headers: { 'Cache-Control': 'no-store' } })));
    return;
  }

  if (req.headers.has('range')) return;
  if (/\.(mp3|m4a|ogg|oga|flac|wav|aac|opus)$/i.test(url.pathname)) return;
  if (url.origin === location.origin && url.pathname.includes('/__citymus_art/')) {
    // Generated artwork may live in the generic track-art cache or in a
    // dedicated lock-screen cache. Search every CacheStorage bucket instead of
    // hard-coding the legacy mt-artwork-v2 store.
    e.respondWith(caches.match(req).then(hit => hit || new Response('', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' }
    })));
    return;
  }
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {}); return r; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('mt-fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
