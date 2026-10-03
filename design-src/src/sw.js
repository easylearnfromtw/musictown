/* musicetown service worker · caches the app shell so the Home Screen app
   opens without a connection. Audio is never touched here: downloaded songs
   live in IndexedDB and stream/range requests go straight to the network. */
const VERSION = 'R13.1-2026-10-03-TAIL-HIFI';
const CACHE = 'mt-shell-' + VERSION;
const SHELL = ['./', 'index.html', 'remote-audio-map.js', 'literature-catalog.js', 'literature-audio-map.js', 'citymus-library.js', 'ebook-catalog.js', 'site.webmanifest',
  'apple-touch-icon.png', 'assets/icons/apple-touch-icon-152.png', 'assets/icons/apple-touch-icon-167.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.svg', 'assets/limited/taipei-word.png', 'assets/limited/taipei-cn.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mt-') && k !== CACHE && k !== 'mt-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (/\.(mp3|m4a|ogg|oga|flac|wav|aac|opus)$/i.test(url.pathname)) return;
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
