/* ==========================================================================
   Offline · keep songs on this device (best on the Home Screen app)
   - audio is stored as Blobs in IndexedDB and played from blob: URLs
   - the app shell is cached by sw.js so the Home Screen app opens offline
   - Safari may clear data of sites not used for a while; Home Screen apps
     keep theirs, so downloads are presented as a Home Screen feature
   ========================================================================== */
const Offline = (() => {
  const DB = 'musicetownOffline', ST = 'audio';
  const meta = new Map();   // trackKey → { size, savedAt, title, artist, theme }
  const urls = new Map();   // trackKey → blob: URL
  const busy = new Map();   // trackKey → progress 0..1
  let ready = false;
  const supported = 'indexedDB' in window;
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(ST)) db.createObjectStore(ST, { keyPath: 'key' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => { db.close(); res(out && 'result' in out ? out.result : out); }; t.onerror = () => { db.close(); rej(t.error); }; t.onabort = () => { db.close(); rej(t.error); }; }); };

  async function init() {
    if (!supported) { ready = true; return; }
    try {
      const rows = await tx('readonly', s => s.getAll()) || [];
      rows.forEach(r => { meta.set(r.key, { size: r.size, savedAt: r.savedAt, title: r.title, artist: r.artist, theme: r.theme }); if (r.blob) urls.set(r.key, URL.createObjectURL(r.blob)); });
    } catch (_) {}
    ready = true; bus.emit('offline');
  }
  init();

  const has = t => !!t && meta.has(trackKey(t));
  const url = t => (t && urls.get(trackKey(t))) || null;
  const progress = t => busy.get(trackKey(t));

  async function fetchBlob(src, onp) {
    const r = await fetch(src, { mode: 'cors', cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const total = Number(r.headers.get('content-length')) || 0;
    if (!r.body || !total) return await r.blob();
    const reader = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onp && onp(got / total); }
    return new Blob(parts, { type: r.headers.get('content-type') || 'audio/mpeg' });
  }

  async function download(t, { quiet = false } = {}) {
    if (!supported || !t || t.localPersonal) return false;
    const k = trackKey(t); if (meta.has(k) || busy.has(k)) return true;
    busy.set(k, 0); bus.emit('offline');
    const cands = Player.sourcesFor(t).filter(u => !String(u).startsWith('blob:'));
    let blob = null;
    for (const src of cands) {
      try { blob = await fetchBlob(src, p => { busy.set(k, p); bus.emit('offline-progress', { k, p }); }); if (blob && blob.size > 20000) break; blob = null; } catch (_) { blob = null; }
    }
    busy.delete(k);
    if (!blob) { bus.emit('offline'); if (!quiet) toast('這首的音源不允許存到裝置'); return false; }
    const th = themeOf(t);
    try { await tx('readwrite', s => s.put({ key: k, blob, size: blob.size, savedAt: Date.now(), title: t.title, artist: t.artist, theme: th?.t || '' })); }
    catch (_) { bus.emit('offline'); toast('裝置空間不足，無法再儲存'); return false; }
    meta.set(k, { size: blob.size, savedAt: Date.now(), title: t.title, artist: t.artist, theme: th?.t || '' }); urls.set(k, URL.createObjectURL(blob));
    persist();
    bus.emit('offline'); return true;
  }
  async function downloadMany(list, label = '') {
    const todo = list.filter(t => t && !t.localPersonal && !has(t));
    if (!todo.length) { toast('已全部存在這台裝置'); return; }
    let ok = 0; toast(`開始下載 ${todo.length} 首${label ? ` · ${label}` : ''}`, { ms: 2600 });
    for (const t of todo) { if (await download(t, { quiet: true })) ok++; bus.emit('offline-batch', { done: ok, total: todo.length }); }
    toast(ok === todo.length ? `已存好 ${ok} 首，可以離線播放` : `已存好 ${ok} 首 · ${todo.length - ok} 首的音源不提供下載`, { ms: 3200 });
  }
  async function remove(t) {
    const k = trackKey(t); if (!meta.has(k)) return;
    try { await tx('readwrite', s => s.delete(k)); } catch (_) {}
    meta.delete(k); const u = urls.get(k); if (u) { setTimeout(() => URL.revokeObjectURL(u), 3000); urls.delete(k); }
    bus.emit('offline');
  }
  async function clear() { for (const k of [...meta.keys()]) { try { await tx('readwrite', s => s.delete(k)); } catch (_) {} } meta.clear(); urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); bus.emit('offline'); }
  let persisted = null;
  async function persist() { if (persisted !== null) return persisted; try { persisted = navigator.storage?.persist ? await navigator.storage.persist() : false; } catch (_) { persisted = false; } return persisted; }
  async function estimate() { try { return await navigator.storage.estimate(); } catch (_) { return null; } }
  function tracks() {
    const out = [];
    meta.forEach((m, k) => { const t = k.startsWith('id:') ? TRACK_BY_SHARE.get(k.slice(3)) : null; if (t) out.push(t); });
    return out.sort((a, b) => (meta.get(trackKey(b))?.savedAt || 0) - (meta.get(trackKey(a))?.savedAt || 0));
  }
  const bytes = () => [...meta.values()].reduce((n, m) => n + (m.size || 0), 0);

  /* the app shell (index, scripts, icons, fonts) — never the audio.
     Force a network check on every deployed build and reload once when a new
     worker takes control; this prevents an iPhone Home Screen app from looking
     "unchanged" after GitHub Pages has already deployed a newer build. */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/[?&]nosw\b/.test(location.search)) {
    window.addEventListener('load', async () => {
      const hadController = !!navigator.serviceWorker.controller;
      try {
        const reg = await navigator.serviceWorker.register('sw.js?build=' + encodeURIComponent(MT_BUILD), { updateViaCache: 'none' });
        try { await reg.update(); } catch (_) {}
        if (hadController) {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            const key = 'mt.swReload.' + MT_BUILD;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
            location.reload();
          }, { once: true });
        }
      } catch (_) {}
    }, { once: true });
  }

  return { has, url, progress, download, downloadMany, remove, clear, estimate, persist, tracks, bytes, get count() { return meta.size; }, get ready() { return ready; }, supported };
})();
