/* ==========================================================================
   Store · same localStorage keys as R8.x so existing favourites carry over
   ========================================================================== */
const K = {
  favLegacy: 'musicetownFavoritesV1',
  libs: 'musicetownLibrariesV2',
  activeLib: 'musicetownActiveLibraryV2',
  dislikes: 'musicetownDislikesV1',
  vintageLegacy: 'musicetownVintageLevelV1',
  settings: 'musicetown.settings.v10',
  stats: 'musicetown.stats.v10',
  tickets: 'musicetown.tickets.v10',
  session: 'musicetown.session.v10',
  recentSearch: 'musicetown.recentSearch.v10',
  visits: 'musicetown.visits.v10'
};
const DEFAULT_LIB = 'library-main';

/* ---------- settings ---------- */
const Settings = (() => {
  const legacyVintage = Number(store.raw(K.vintageLegacy)) || 0;
  const s = Object.assign({
    quality: 'auto',            // auto | hq | saver
    vintage: legacyVintage > 0 ? (legacyVintage < 34 ? 1 : legacyVintage < 67 ? 2 : 3) : 0,
    autoplay: true,
    shuffle: false,
    repeat: 'off',              // off | all | one
    onboarded: false,
    homeGroup: 'asia',
    a2hsDismissed: false,
    fades: true                 // 2 s fade-in · 3 s fade-out
  }, store.get(K.settings, {}));
  return {
    get: k => s[k],
    set(k, v) { s[k] = v; store.set(K.settings, s); bus.emit('settings', { k, v }); },
    all: () => ({ ...s })
  };
})();

/* ---------- libraries & favourites ---------- */
const Library = (() => {
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const mkId = () => `lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  function load() {
    const rows = store.get(K.libs, null);
    if (Array.isArray(rows) && rows.length) {
      return rows.map((l, i) => ({ id: String(l.id || mkId()), name: clean(l.name) || `Library ${i + 1}`, keys: Array.isArray(l.keys) ? [...new Set(l.keys.map(String))] : [], cats: Array.isArray(l.cats) ? l.cats.map(String).slice(0, 12) : [], createdAt: +l.createdAt || Date.now(), updatedAt: +l.updatedAt || Date.now() }));
    }
    const legacy = store.get(K.favLegacy, []);
    const first = { id: DEFAULT_LIB, name: 'MY LIBRARY', keys: Array.isArray(legacy) ? [...new Set(legacy.map(String))] : [], createdAt: Date.now(), updatedAt: Date.now() };
    store.set(K.libs, [first]); store.setRaw(K.activeLib, first.id);
    return [first];
  }
  let libs = load();
  const save = () => { store.set(K.libs, libs); bus.emit('library'); };
  const activeId = () => { let id = store.raw(K.activeLib) || ''; if (!libs.some(l => l.id === id)) { id = libs[0].id; store.setRaw(K.activeLib, id); } return id; };
  const active = () => libs.find(l => l.id === activeId()) || libs[0];
  const keysSet = (lib = active()) => new Set(lib?.keys || []);
  function resolve(lib = active()) {
    const keys = new Set(lib?.keys || []), out = [], seen = new Set();
    for (const th of THEMES) for (const t of th.tracks) {
      const k = trackKey(t); if (!keys.has(k) || seen.has(k)) continue; seen.add(k); out.push(t);
    }
    // keep the order in which they were saved (newest first)
    const order = new Map((lib?.keys || []).map((k, i) => [k, i]));
    return out.sort((a, b) => (order.get(trackKey(b)) ?? 0) - (order.get(trackKey(a)) ?? 0));
  }
  function isFav(t) { if (!t || t.localPersonal) return false; return keysSet().has(trackKey(t)); }
  function toggle(t, libId = activeId()) {
    if (!t || t.localPersonal) return false;
    const lib = libs.find(l => l.id === libId); if (!lib) return false;
    const k = trackKey(t); const i = lib.keys.indexOf(k); const add = i < 0;
    if (add) lib.keys.push(k); else lib.keys.splice(i, 1);
    lib.updatedAt = Date.now();
    if (lib.id === DEFAULT_LIB) store.set(K.favLegacy, lib.keys);
    save(); return add;
  }
  function uniqueName(base) {
    const c = clean(base) || 'NEW LIBRARY'; const names = new Set(libs.map(l => l.name.toLowerCase()));
    if (!names.has(c.toLowerCase())) return c;
    for (let i = 2; i < 100; i++) if (!names.has(`${c} ${i}`.toLowerCase())) return `${c} ${i}`;
    return `${c} ${Date.now().toString().slice(-4)}`;
  }
  function create(name, keys = [], activate = true, cats = []) {
    const lib = { id: mkId(), name: uniqueName(name), keys: [...new Set(keys.map(String))], cats: cats.slice(0, 12), createdAt: Date.now(), updatedAt: Date.now() };
    libs.push(lib); if (activate) store.setRaw(K.activeLib, lib.id); save(); return lib;
  }
  function rename(id, name) { const l = libs.find(x => x.id === id); if (!l || !clean(name)) return; l.name = clean(name); l.updatedAt = Date.now(); save(); }
  function remove(id) { if (libs.length <= 1) return false; libs = libs.filter(l => l.id !== id); if (activeId() === id) store.setRaw(K.activeLib, libs[0].id); save(); return true; }
  function clear(id) { const l = libs.find(x => x.id === id); if (!l) return; l.keys = []; if (l.id === DEFAULT_LIB) store.set(K.favLegacy, []); save(); }
  function setActive(id) { if (!libs.some(l => l.id === id)) return; store.setRaw(K.activeLib, id); bus.emit('library'); }
  function addMany(keys, libId = activeId()) { const l = libs.find(x => x.id === libId); if (!l) return; keys.forEach(k => { if (!l.keys.includes(k)) l.keys.push(k); }); save(); }
  return { all: () => libs, active, activeId, resolve, isFav, toggle, create, rename, remove, clear, setActive, addMany, clean };
})();

/* ---------- dislikes (auto-skip) ---------- */
const Dislikes = (() => {
  let set = new Set(store.get(K.dislikes, []));
  return {
    has: t => !!t && set.has(trackKey(t)),
    toggle(t) { const k = trackKey(t); const on = !set.has(k); on ? set.add(k) : set.delete(k); store.set(K.dislikes, [...set]); bus.emit('dislikes'); return on; },
    clear() { set = new Set(); store.set(K.dislikes, []); bus.emit('dislikes'); },
    get size() { return set.size; }
  };
})();

/* ---------- listening stats (drive the recommender) ---------- */
const Stats = (() => {
  const s = Object.assign({ plays: {}, recs: {}, themes: {}, artists: {}, skips: {}, recent: [], recentThemes: [] }, store.get(K.stats, {}));
  let saveT = null; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => store.set(K.stats, s), 400); };
  return {
    started(t) {
      if (!t || t.localPersonal) return;
      const rk = recKey(t);
      s.recent = [{ k: trackKey(t), r: rk, ts: Date.now() }, ...s.recent.filter(x => x.r !== rk)].slice(0, 80);
      const th = themeOf(t); if (th) s.recentThemes = [th.t, ...s.recentThemes.filter(x => x !== th.t)].slice(0, 12);
      save();
    },
    finished(t, ratio) {
      if (!t || t.localPersonal) return;
      const k = trackKey(t), rk = recKey(t), th = themeOf(t), a = norm(t.artist);
      if (ratio >= .6) {
        s.plays[k] = (s.plays[k] || 0) + 1; s.recs[rk] = (s.recs[rk] || 0) + 1;
        if (th) s.themes[th.t] = (s.themes[th.t] || 0) + 1;
        s.artists[a] = (s.artists[a] || 0) + 1;
      } else if (ratio < .25) {
        s.skips[rk] = (s.skips[rk] || 0) + 1;
      }
      save();
    },
    recentRecs: (n = 40) => s.recent.slice(0, n).map(x => x.r),
    recentKeys: (n = 40) => s.recent.slice(0, n).map(x => x.k),
    recentThemes: () => s.recentThemes.slice(),
    themeAffinity: t => s.themes[t] || 0,
    artistAffinity: a => s.artists[norm(a)] || 0,
    skips: rk => s.skips[rk] || 0,
    plays: rk => s.recs[rk] || 0,
    get totalPlays() { return Object.values(s.recs).reduce((a, b) => a + b, 0); }
  };
})();

/* ---------- ticket wallet ---------- */
const Wallet = (() => {
  let list = store.get(K.tickets, []);
  return {
    all: () => list.slice(),
    has: id => list.some(x => x.id === id),
    add(tk) { if (list.some(x => x.id === tk.id)) return false; list = [tk, ...list]; store.set(K.tickets, list); bus.emit('wallet'); return true; },
    remove(id) { list = list.filter(x => x.id !== id); store.set(K.tickets, list); bus.emit('wallet'); }
  };
})();

/* visit counter (for the add-to-home-screen hint) */
const VISITS = (() => { const n = (Number(store.raw(K.visits)) || 0) + 1; store.setRaw(K.visits, String(n)); return n; })();
