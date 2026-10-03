/* ==========================================================================
   Player · one persistent, gesture-unlocked <audio> (plus an FX twin).
   Continuous playback: on `ended` the next src is set and play() is called
   synchronously in the same handler — this is what keeps iOS going,
   including on the lock screen.
   ========================================================================== */
const Player = (() => {
  const SILENT = (() => { // 0.1 s of silence, used to unlock elements on the first gesture
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  })();

  function makeEl(id, cors) {
    const a = document.createElement('audio');
    a.id = id; a.preload = 'auto'; a.playsInline = true;
    a.setAttribute('playsinline', ''); a.setAttribute('webkit-playsinline', ''); a.setAttribute('x-webkit-airplay', 'allow');
    if (cors) a.crossOrigin = 'anonymous';
    a.className = 'sr-only'; document.body.appendChild(a);
    return a;
  }
  const els = { direct: makeEl('nativeAudioPlayer', false), fx: makeEl('mtFxAudioPlayer', true) };
  let activeName = 'direct';
  const el = () => els[activeName];

  let queue = [];        // entries: { t, user?, radio? }
  let index = -1;
  let context = { kind: 'none', title: '', theme: null };
  let current = null;
  let cands = [], ci = 0;
  let wantPlay = false;
  let failStreak = 0;
  let lastTime = -1, stuckTicks = 0, endHandledFor = null;
  let prefetched = '';
  let shuffleBackup = null;
  let airplay = false;
  let handoffSeq = 0;
  let localAvail = sess.get('mt.localAudio', null); // null unknown · true · false
  let audioProxy = '', proxyReady = false;
  const proxyEndpoint = base => {
    if (!base) return '';
    try {
      const u = new URL(base, document.baseURI);
      if (!/^https?:$/.test(u.protocol)) return '';
      if (!/\/api\/audio\/?$/.test(u.pathname)) u.pathname = u.pathname.replace(/\/$/, '') + '/api/audio';
      u.search = ''; u.hash = ''; return u.href.replace(/\/$/, '');
    } catch (_) { return ''; }
  };
  const proxyURL = raw => {
    if (!proxyReady || !audioProxy || !raw) return null;
    try {
      const u = new URL(raw, document.baseURI);
      if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return null;
      return audioProxy + '?u=' + encodeURIComponent(u.href);
    } catch (_) { return null; }
  };
  async function probeAudioProxy() {
    const configured = proxyEndpoint(window.CITYMUS_AUDIO_PROXY || '');
    const sameOrigin = proxyEndpoint(location.origin);
    for (const ep of [...new Set([configured, sameOrigin].filter(Boolean))]) {
      try {
        const r = await fetch(ep + '?health=1', { mode: 'cors', cache: 'no-store' });
        if (!r.ok || r.headers.get('x-citymus-proxy') !== '1') continue;
        const j = await r.json().catch(() => null); if (!j?.ok) continue;
        audioProxy = ep; proxyReady = true;
        await FX.probeCors(ep + '?health=1').catch(() => false);
        bus.emit('audio-proxy', { ready: true, endpoint: ep });
        return true;
      } catch (_) {}
    }
    proxyReady = false; bus.emit('audio-proxy', { ready: false }); return false;
  }
  probeAudioProxy();

  /* ---------- where can this track be played from? ---------- */
  const abs = u => { try { return new URL(u, document.baseURI).href; } catch (_) { return u; } };
  function nullrightsAudio(t) { const id = t.embed || (String(t.source || '').match(/nullrights\.com\/track\/([^/?#]+)/i) || [])[1]; return id ? `https://nullrights.com/audio/${encodeURIComponent(id)}` : null; }
  function sourcesFor(t) {
    if (!t) return [];
    if (t.localPersonal) return [t.audioSrc];
    const off = Offline.url(t);
    const q = Settings.get('quality');
    if (t.stream) {
      const order = (q === 'hq' || q === 'lossless') ? [t.stream, LIT_MAP[t.shareId], off] : [off, LIT_MAP[t.shareId], t.stream];
      return [...new Set(order.filter(Boolean))];
    }
    const local = t.audioSrc ? abs(t.audioSrc) : null, remote = (t.masterId && REMOTE_MAP[t.masterId]) || null, dl = t.download || null, nr = nullrightsAudio(t);
    let order;
    if (q === 'lossless') order = [dl, remote, nr, local];
    else if (q === 'hq') order = [remote, dl, nr, local];
    else if (localAvail === false) order = [remote, dl, nr, local];
    else if (localAvail === true || q === 'saver' || (FX.level > 0)) order = [local, remote, dl, nr];
    else order = remote ? [remote, local, dl, nr] : [local, dl, nr];

    // When the verified proxy exists, place its CORS-safe Range stream before
    // each remote original. A failed proxy candidate simply falls through to
    // the untouched source, so GitHub Pages playback never depends on it.
    const expanded = [];
    for (const u of order.filter(Boolean)) {
      const p = proxyURL(u);
      if (p && graphWanted()) expanded.push(p);
      expanded.push(u);
    }
    const all = (q === 'hq' || q === 'lossless') ? [...expanded, off] : [off, ...expanded];
    return [...new Set(all.filter(Boolean))];
  }
  /* is the site shipping its own MP3s? (branch deploys don't) */
  (async function probeLocal() {
    if (localAvail !== null) return;
    const t = ALL_TRACKS.find(x => x.audioSrc && !x.localPersonal); if (!t) return;
    try { const r = await fetch(abs(t.audioSrc), { method: 'HEAD', cache: 'no-store' }); const ct = r.headers.get('content-type') || ''; localAvail = r.ok && /audio|mpeg|octet/.test(ct); }
    catch (_) { localAvail = false; }
    sess.set('mt.localAudio', localAvail);
  })();

  /* ---------- unlock both elements on the first real gesture ---------- */
  function unlock() {
    Object.values(els).forEach(a => {
      if (a._unlocked || a._track) return;
      a._unlocking = true; a.muted = true; a.src = SILENT;
      const p = a.play();
      const done = ok => { a._unlocking = false; a.muted = false; if (ok) a._unlocked = true; if (!a._track) { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (_) {} } };
      if (p && p.then) p.then(() => done(true), () => done(false)); else done(true);
    });
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
  }
  ['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, function once() {
    unlock(); ['touchend', 'click', 'keydown'].forEach(e2 => document.removeEventListener(e2, once, true));
  }, true));

  /* ---------- element events (only the active element speaks) ---------- */
  function wire(a) {
    const mine = () => a === el() && !a._unlocking && !a._switching;
    a.addEventListener('playing', () => { a._unlocked = true; if (!mine()) return; failStreak = 0; FX.setSurface(FX.level > 0); Fader.apply(); emitState(); ms.state(); });
    a.addEventListener('pause', () => { if (!mine()) return; FX.setSurface(false); emitState(); ms.state(); });
    a.addEventListener('timeupdate', () => { if (!mine()) return; bus.emit('time'); onProgress(); Fader.apply(); });
    a.addEventListener('loadedmetadata', () => { if (!mine()) return; if (a._seekTo != null) { try { a.currentTime = a._seekTo; } catch (_) {} a._seekTo = null; } bus.emit('time'); ms.position(); if (Number.isFinite(a.duration) && a.duration <= 90) setTimeout(warmNext, 250); });
    a.addEventListener('durationchange', () => { if (mine()) { bus.emit('time'); ms.position(); } });
    a.addEventListener('seeked', () => { if (mine()) { bus.emit('time'); ms.position(); Fader.seeked(); } });
    a.addEventListener('ended', () => { if (mine()) onEnded(); });
    a.addEventListener('error', () => { if (mine() && a.getAttribute('src')) onError(); });
    a.addEventListener('waiting', () => { if (mine()) bus.emit('buffering', true); });
    a.addEventListener('canplay', () => { if (mine()) bus.emit('buffering', false); });
    a.addEventListener('webkitplaybacktargetavailabilitychanged', e => { airplay = e.availability === 'available'; bus.emit('airplay', airplay); });
  }
  Object.values(els).forEach(wire);

  function emitState() { bus.emit('state', { playing: isPlaying(), track: current }); }
  const isPlaying = () => !!current && !el().paused && !el().ended;

  /* ---------- choose element: FX twin only when vintage is on and the source can be processed ---------- */
  /* iOS ignores element.volume, so fades there need the Web Audio path */
  const fadesOn = () => Settings.get('fades') !== false;
  const graphWanted = () => FX.tailActive || FX.level > 0 || FX.eqActive || FX.qualityActive || (IS_IOS && fadesOn());
  function elementFor(url) { return (graphWanted() && FX.canProcess(url) && (!document.hidden || FX.running || !FX.ctx)) ? 'fx' : 'direct'; }
  function activate(name) {
    if (name === activeName) return;
    const prev = el(); activeName = name;
    try { prev._switching = true; prev.pause(); prev.removeAttribute('src'); prev._track = null; prev.load(); } catch (_) {}
    prev._switching = false;
    if (name === 'fx') FX.attach(els.fx);
  }

  /* ---------- fades: 2 s in at the start, 3 s out at the end ----------
     Web Audio path: sample-accurate ramps on a music-only gain.
     Elsewhere: element.volume (iOS ignores it, hence the Web Audio route there). */
  const FADE_IN = 1.2, AUTO_FADE_IN = .45, FADE_OUT = .9;
  const Fader = (() => {
    let endSet = false, startSet = false, raf = 0, transition = 'manual';
    const inSec = () => transition === 'auto' ? AUTO_FADE_IN : FADE_IN;
    const envelope = (ct, d) => { const fi = inSec(); let g = Math.min(1, ct / fi); if (Number.isFinite(d) && d > fi + FADE_OUT + 1) g = Math.min(g, (d - ct) / FADE_OUT); return clamp(g, 0, 1); };
    function apply(force = false) {
      const a = el(), d = a.duration, ct = a.currentTime || 0;
      if (!fadesOn()) { if (force) reset(); return; }
      if (activeName === 'fx') {
        if (!FX.ctx) return;
        const fi = inSec(), rem = Number.isFinite(d) ? d - ct : Infinity, long = Number.isFinite(d) && d > fi + FADE_OUT + 1;
        if (long && rem <= FADE_OUT + .3) { if (!endSet && !a.paused) { endSet = true; FX.fade.to(.0001, Math.max(.05, rem)); } }
        else if (ct < fi - .03) { if (!startSet && !a.paused) { startSet = true; FX.fade.set(Math.max(.0001, envelope(ct, d))); FX.fade.to(1, fi - ct); } }
        else if (force || endSet || FX.fade.value < .999) { endSet = false; FX.fade.to(1, .12); }
      } else if (!IS_IOS) {
        try { a.volume = envelope(ct, d); } catch (_) {}
        cancelAnimationFrame(raf); if (!a.paused && a.volume < 1 && !document.hidden) raf = requestAnimationFrame(() => apply());
      }
    }
    function newTrack(mode = 'manual') { transition = mode; endSet = false; startSet = false; if (!fadesOn()) return; const start = mode === 'auto' ? .18 : .0001; if (activeName === 'fx' && FX.ctx) FX.fade.set(start); else if (!IS_IOS) { try { el().volume = start; } catch (_) {} } }
    function seeked() { endSet = false; startSet = false; apply(true); }
    function reset() { if (FX.ctx) FX.fade.set(1); Object.values(els).forEach(a => { try { a.volume = 1; } catch (_) {} }); }
    bus.on('settings', ({ k }) => { if (k === 'fades') { reset(); apply(true); } });
    return { apply, newTrack, seeked, reset };
  })();

  /* ---------- load + play ---------- */
  function load(t, { autoplay = true, startAt = 0, transition = 'manual' } = {}) {
    if (!t) return;
    handoffSeq++; // invalidate any async vintage/original pipeline switch from the previous state
    current = t; cands = sourcesFor(t); ci = 0; endHandledFor = null; prefetched = ''; warmKey = ''; try { warmAbort?.abort(); } catch (_) {} warmAbort = null; lastTime = -1; stuckTicks = 0;
    const url = cands[0];
    if (!url) { onError(); return; }
    activate(elementFor(url));
    if (activeName === 'fx') FX.ensure();
    Fader.newTrack(transition);
    const a = el(); a._track = t; a._seekTo = startAt > 0 ? startAt : null;
    a.src = url;
    wantPlay = autoplay;
    if (autoplay) playEl(a);
    if (!t.localPersonal) Stats.started(t);
    ms.meta(t); bus.emit('track', t); emitState(); saveSession();
    // learn about CORS for next time (enables full vintage processing on remote audio)
    if (graphWanted() && !FX.canProcess(url)) FX.probeCors(url);
  }
  function playEl(a) {
    if (activeName === 'fx') FX.ensure();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
    const p = a.play();
    if (p && p.catch) p.catch(err => {
      if (err && err.name === 'NotAllowedError') { wantPlay = false; emitState(); bus.emit('needs-tap'); }
      else if (err && err.name === 'NotSupportedError') onError();
    });
  }
  function onError() {
    const a = el();
    if (ci + 1 < cands.length) {
      ci++; const url = cands[ci];
      const name = elementFor(url);
      const t0 = a.currentTime || 0;
      if (name !== activeName) { activate(name); }
      const b = el(); b._track = current; b._seekTo = t0 > 1 ? t0 : null; b.src = url;
      if (wantPlay) playEl(b);
      return;
    }
    failStreak++;
    bus.emit('track-failed', current);
    if (failStreak >= 6) { toast('目前無法連線到音源，請稍後再試'); wantPlay = false; emitState(); return; }
    toast('這首暫時無法播放，已換下一首');
    advance({ auto: true, keepWant: true });
  }

  /* ---------- progress, prefetch, watchdog ---------- */
  let lastMsPos = 0, lastSystemPos = 0, warmKey = '', warmAbort = null;
  const preconnected = new Set();
  function ensureAutoplayTail() {
    if (peekNext() || Settings.get('autoplay') === false || !current) return peekNext();
    const add = Reco.radio(current, 10, { avoid: queue.slice(-30).map(e => e.t) }).map(t => entry(t, { radio: true }));
    if (add.length) { queue.push(...add); bus.emit('queue'); }
    return peekNext();
  }
  function preconnect(url) {
    try {
      const u = new URL(url, document.baseURI); if (!/^https?:$/.test(u.protocol) || preconnected.has(u.origin)) return;
      preconnected.add(u.origin);
      const l = document.createElement('link'); l.rel = 'preconnect'; l.href = u.origin;
      if (u.origin !== location.origin) l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    } catch (_) {}
  }
  function warmNext() {
    const nx = ensureAutoplayTail(); if (!nx?.t) return;
    const urls = sourcesFor(nx.t), url = urls[0]; if (!url) return;
    const key = trackKey(nx.t) + '|' + url; if (key === warmKey) return;
    warmKey = key; prefetched = key; preconnect(url);
    if (graphWanted() && !FX.canProcess(url)) FX.probeCors(url).catch(() => {});
    try {
      const u = new URL(url, document.baseURI); if (!/^https?:$/.test(u.protocol)) return;
      warmAbort?.abort(); warmAbort = new AbortController();
      const timer = setTimeout(() => warmAbort?.abort(), 7000);
      fetch(url, { headers: { Range: 'bytes=0-524287' }, cache: 'force-cache', priority: 'low', signal: warmAbort.signal })
        .then(r => { try { return r.body?.cancel?.(); } catch (_) {} })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    } catch (_) {}
  }
  function onProgress() {
    const a = el(); const d = a.duration;
    const now = performance.now();
    if (now - lastSystemPos > 1200) { lastSystemPos = now; ms.position(); }
    if (now - lastMsPos > 4000) { lastMsPos = now; saveSession(); }
    if (!Number.isFinite(d) || d <= 0) return;
    const rem = d - a.currentTime;
    if (rem < 55 && !warmKey) warmNext();
  }
  setInterval(() => {
    const a = el(); if (!current || a._unlocking || a._switching) return;
    if (a.ended && endHandledFor !== current) { onEnded(); return; }
    if (!a.paused && wantPlay) {
      const ct = a.currentTime;
      if (Math.abs(ct - lastTime) < .01) stuckTicks++; else stuckTicks = 0;
      lastTime = ct;
      const d = a.duration;
      if (Number.isFinite(d) && d > 0 && ct >= d - .35 && stuckTicks >= 2) { onEnded(); return; }
      if (stuckTicks >= 14 && a.readyState < 3) { stuckTicks = 0; onError(); }
    }
  }, 1000);

  /* ---------- queue logic ---------- */
  function entry(t, extra = {}) { return Object.assign({ t }, extra); }
  function onEnded() {
    if (endHandledFor === current) return;
    endHandledFor = current;
    Stats.finished(current, 1);
    if (Settings.get('repeat') === 'one') { const a = el(); try { a.currentTime = 0; } catch (_) {} playEl(a); endHandledFor = null; return; }
    advance({ auto: true, keepWant: true });
  }
  function peekNext() {
    for (let i = index + 1; i < queue.length; i++) if (!Dislikes.has(queue[i].t)) return queue[i];
    return null;
  }
  function advance({ auto = false, keepWant = false } = {}) {
    if (current && !auto) { const a = el(); const r = Number.isFinite(a.duration) && a.duration > 0 ? a.currentTime / a.duration : 0; Stats.finished(current, r); }
    let i = index + 1;
    while (i < queue.length && auto && Dislikes.has(queue[i].t)) i++;
    if (i >= queue.length) {
      if (Settings.get('repeat') === 'all' && queue.length) i = 0;
      else if (Settings.get('autoplay') !== false) {
        ensureAutoplayTail();
        i = index + 1;
        while (i < queue.length && auto && Dislikes.has(queue[i].t)) i++;
      }
    }
    if (i >= queue.length) { wantPlay = false; emitState(); return; }
    index = i;
    load(queue[index].t, { autoplay: keepWant ? (wantPlay || auto) : true, transition: auto ? 'auto' : 'manual' });
    bus.emit('queue');
  }

  /* public: start a list (theme, library, edit…) at position */
  function playList(tracks, start = 0, ctx = {}, opts = {}) {
    const list = tracks.filter(Boolean); if (!list.length) return;
    let first = list[clamp(start, 0, list.length - 1)];
    let arr = list;
    const ordered = !!(ctx.theme && THEME_BY_T.get(ctx.theme)?.ordered);
    if (Settings.get('shuffle') && !ordered) { shuffleBackup = list.slice(); arr = Reco.smartShuffle(list, first); }
    else shuffleBackup = null;
    queue = arr.map(t => entry(t)); index = Math.max(0, arr.indexOf(first));
    context = Object.assign({ kind: 'list', title: '', theme: null }, ctx);
    failStreak = 0;
    load(first, { autoplay: opts.autoplay !== false, startAt: opts.startAt || 0 });
    bus.emit('queue');
  }
  function playTrack(t, ctx = {}) {
    const th = ctx.theme ? THEME_BY_T.get(ctx.theme) : null;
    if (ctx.list) { playList(ctx.list, ctx.list.indexOf(t), ctx); return; }
    if (th) { playList(th.tracks, th.tracks.indexOf(t), { kind: 'theme', title: th.name, theme: th.t }); return; }
    playList([t], 0, ctx);
  }
  function toggle() {
    if (!current) { const t = Reco.todaysEdit(1)[0]; if (t) playTrack(t); return; }
    const a = el();
    if (a.paused || a.ended) { wantPlay = true; if (a.ended) { try { a.currentTime = 0; } catch (_) {} } if (!a.getAttribute('src')) load(current, { autoplay: true }); else { if (activeName === 'fx') FX.ensure(); playEl(a); if (FX.level > 0) FX.needleDrop(); } }
    else { wantPlay = false; a.pause(); }
  }
  function next() { haptic(); advance({ auto: false }); }
  function prev() {
    haptic();
    const a = el();
    if (a.currentTime > 3 || index <= 0) { if (index <= 0 && Settings.get('repeat') === 'all' && queue.length > 1 && a.currentTime <= 3) { index = queue.length - 1; load(queue[index].t); bus.emit('queue'); return; } try { a.currentTime = 0; } catch (_) {} return; }
    index--; load(queue[index].t, { autoplay: true }); bus.emit('queue');
  }
  function jump(i) { if (i < 0 || i >= queue.length) return; index = i; load(queue[i].t, { autoplay: true }); bus.emit('queue'); }
  function seek(sec) { const a = el(); try { if (Number.isFinite(sec)) a.currentTime = clamp(sec, 0, Number.isFinite(a.duration) ? a.duration - .05 : sec); } catch (_) {} bus.emit('time'); }
  function playNext(t) {
    if (!current) { playTrack(t); return; }
    queue.splice(index + 1, 0, entry(t, { user: true })); warmKey = ''; bus.emit('queue'); warmNext(); toast('下一首播放');
  }
  function addToQueue(t) {
    if (!current) { playTrack(t); return; }
    let p = index + 1; while (p < queue.length && queue[p].user) p++;
    queue.splice(p, 0, entry(t, { user: true })); warmKey = ''; bus.emit('queue'); warmNext(); toast('已加入播放佇列');
  }
  function removeAt(i) { if (i <= index || i >= queue.length) return; queue.splice(i, 1); warmKey = ''; bus.emit('queue'); warmNext(); }
  function setShuffle(on) {
    Settings.set('shuffle', !!on);
    const rest = queue.slice(index + 1);
    if (on) { shuffleBackup = queue.map(e => e.t); const mixed = Reco.smartShuffle(rest.map(e => e.t)); queue = queue.slice(0, index + 1).concat(mixed.map(t => entry(t))); }
    else if (shuffleBackup) { const i0 = shuffleBackup.indexOf(current); const tail = i0 >= 0 ? shuffleBackup.slice(i0 + 1) : rest.map(e => e.t); queue = queue.slice(0, index + 1).concat(tail.map(t => entry(t))); shuffleBackup = null; }
    warmKey = ''; bus.emit('queue'); warmNext(); emitState();
  }
  function cycleRepeat() { const r = Settings.get('repeat'); const n = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'; Settings.set('repeat', n); emitState(); return n; }

  /* ---------- vintage switch: move playback between direct and FX element ---------- */
  bus.on('vintage', lv => {
    if (!current) return;
    const a = el(); const url = a.currentSrc || a.src; if (!url) return;
    const want = elementFor(url);
    if (graphWanted() && !FX.canProcess(url)) FX.probeCors(url).then(ok => { if (ok && graphWanted() && el().src === url && activeName !== 'fx') handoff('fx'); });
    if (want !== activeName) handoff(want);
    FX.setSurface(!a.paused && lv > 0);
  });
  bus.on('settings', ({ k }) => {
    if (!['eqBass','eqVocal','eqTreble','quality','tailEnabled'].includes(k) || !current) return;
    const a = el(), url = a.currentSrc || a.src; if (!url) return;
    const want = elementFor(url);
    if (graphWanted() && !FX.canProcess(url)) FX.probeCors(url).then(ok => {
      const cur = el().currentSrc || el().src;
      if (ok && graphWanted() && cur === url && activeName !== 'fx') handoff('fx');
    });
    if (want !== activeName) handoff(want);
  });
  function handoff(name) {
    const from = el(), url = from.currentSrc || from.src, at = from.currentTime || 0, playing = !from.paused, track = current;
    const to = els[name]; if (!url || !track || to === from) return;
    if (name === 'fx' && !FX.attach(to)) return;
    const seq = ++handoffSeq;
    from._switching = true; to._switching = true;
    to._track = track; to.muted = true; to.src = url;

    const stale = () => seq !== handoffSeq || current !== track;
    const cleanupTarget = () => {
      if (to._track !== track) return;
      try { to.pause(); to.removeAttribute('src'); to.load(); } catch (_) {}
      to._track = null; to._switching = false; to.muted = false;
    };
    const fail = () => {
      if (stale()) { cleanupTarget(); return; }
      to._switching = false; to.muted = false; from._switching = false;
      if (playing && from.paused) playEl(from);
      emitState();
    };
    const finish = () => {
      if (stale()) { cleanupTarget(); from._switching = false; return; }
      activeName = name;
      to.muted = false; to._switching = false;
      try { from.pause(); from.removeAttribute('src'); from.load(); } catch (_) {}
      from._track = null; from._switching = false;
      lastTime = to.currentTime || at; stuckTicks = 0;
      Fader.seeked(); emitState(); FX.setSurface(isPlaying() && FX.level > 0);
    };
    const go = () => {
      if (stale()) { cleanupTarget(); from._switching = false; return; }
      const d = Number.isFinite(to.duration) ? to.duration : from.duration;
      const safeAt = Number.isFinite(d) && d > .4 ? Math.min(at, d - .35) : at;
      try { to.currentTime = Math.max(0, safeAt); } catch (_) {}
      if (!playing) { finish(); return; }
      to.addEventListener('playing', finish, { once: true });
      const p = to.play();
      if (p && p.catch) p.catch(fail);
    };
    to.addEventListener('error', fail, { once: true });
    if (to.readyState >= 1) go(); else to.addEventListener('loadedmetadata', go, { once: true });
  }
  /* if iOS suspends Web Audio in the background, continue on the direct element */
  bus.on('fx-state', st => {
    if (activeName === 'fx' && st !== 'running' && wantPlay) {
      if (!document.hidden) { FX.ensure(); return; }
      // Only background suspension is allowed to trigger a native-audio handoff.
      setTimeout(() => {
        if (document.hidden && activeName === 'fx' && !FX.running && wantPlay && current) handoff('direct');
      }, 900);
    }
  });
  document.addEventListener('visibilitychange', () => {
    // Navigation / app switching must not itself swap media elements. The
    // existing fx-state fallback below handles a *real* suspended AudioContext.
    // This keeps the exact same track/source alive when iPhone changes screens.
    if (!document.hidden && FX.ctx && FX.ctx.state !== 'running') {
      FX.ctx.resume().catch(() => {});
    }
  }, { passive: true });

  /* ---------- Media Session (iPhone lock screen, Control Center, AirPods) ---------- */
  const ms = (() => {
    const has = 'mediaSession' in navigator;
    let metaSeq = 0;
    const systemText = (v, max = 72) => {
      const s = String(v || '').replace(/\s+/g, ' ').trim();
      return s.length > max ? s.slice(0, max - 1) + '…' : s;
    };
    const fallbackArtwork = () => [
      { src: abs('icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: abs('icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: abs('apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }
    ];
    function meta(t) {
      if (!has || !t) return;
      const seq = ++metaSeq;
      const th = themeOf(t), systemName = th?.systemName || '';
      const themeLabel = systemName || th?.cn || th?.name || context.title || 'Library';
      const base = {
        title: systemText(t.title || 'CITYMUS', 64),
        artist: systemText(t.artist || t.composerCn || 'CITYMUS', 56),
        album: systemText(themeLabel || 'CITYMUS', 58)
      };
      // Set a same-origin image synchronously so iOS never shows a blank card
      // while the track-specific artwork is still being decoded.
      try { navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: fallbackArtwork() }); } catch (_) {}

      // A larger square is used only for the OS media card; Artwork.cover caches
      // it, so rapid foreground renders do not repeat the canvas work.
      Artwork.coverURL(t, 1024).then(src => {
        if (!src || seq !== metaSeq || current !== t) return;
        const type = /\.png(?:\?|$)/i.test(src) ? 'image/png' : 'image/jpeg';
        const art = [{ src, sizes: '1024x1024', type }, ...fallbackArtwork()];
        try { navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: art }); } catch (_) {}
        bus.emit('artwork', { t, src });
      }).catch(() => {});
    }
    bus.on('geo', () => { if (current) meta(current); });

    function state() {
      if (!has) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
      try { navigator.mediaSession.playbackState = isPlaying() ? 'playing' : (current ? 'paused' : 'none'); } catch (_) {}
      position();
    }
    function position() {
      if (!has) return;
      const a = el(), d = a.duration, p = a.currentTime;
      if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(p)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: d,
          playbackRate: Number.isFinite(a.playbackRate) && a.playbackRate > 0 ? a.playbackRate : 1,
          position: clamp(p, 0, d)
        });
      } catch (_) {}
    }
    function refresh() {
      if (!has || !current) return;
      meta(current);
      state();
      position();
    }

    if (has) {
      const set = (n, f) => { try { navigator.mediaSession.setActionHandler(n, f); } catch (_) {} };
      set('play', () => { try { if (el().paused || el().ended) toggle(); } finally { setTimeout(state, 0); } });
      set('pause', () => { try { if (!el().paused) toggle(); } finally { setTimeout(state, 0); } });
      set('previoustrack', () => { prev(); setTimeout(refresh, 0); });
      set('nexttrack', () => { next(); setTimeout(refresh, 0); });
      set('seekto', d => {
        if (!Number.isFinite(d?.seekTime)) return;
        const a = el(), dur = Number.isFinite(a.duration) ? a.duration : Infinity;
        const target = clamp(d.seekTime, 0, Math.max(0, dur - .01));
        try {
          if (d.fastSeek && typeof a.fastSeek === 'function') a.fastSeek(target);
          else seek(target);
        } catch (_) { seek(target); }
        setTimeout(position, 0);
      });
      set('seekbackward', d => { seek(el().currentTime - (d?.seekOffset || 10)); setTimeout(position, 0); });
      set('seekforward', d => { seek(el().currentTime + (d?.seekOffset || 10)); setTimeout(position, 0); });
      set('stop', () => {
        wantPlay = false;
        try { el().pause(); el().currentTime = 0; } catch (_) {}
        state();
      });
    }
    return { meta, state, position, refresh };
  })();

  /* ---------- session restore ---------- */
  function saveSession() {
    if (!current || current.localPersonal) return;
    store.set(K.session, { id: current.shareId, at: Math.floor(el().currentTime || 0), ctx: { kind: context.kind, title: context.title, theme: context.theme }, q: queue.slice(Math.max(0, index - 5), index + 40).map(e => e.t.shareId).filter(Boolean) });
  }
  const syncSystemSession = () => {
    saveSession();
    if (current) ms.refresh();
  };
  window.addEventListener('pagehide', syncSystemSession, { passive: true });
  window.addEventListener('pageshow', () => { if (current) setTimeout(() => ms.refresh(), 80); }, { passive: true });
  window.addEventListener('focus', () => { if (!document.hidden && current) setTimeout(() => ms.refresh(), 80); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) syncSystemSession();
    else if (current) setTimeout(() => ms.refresh(), 100);
  }, { passive: true });
  function restore() {
    const s = store.get(K.session, null); if (!s || !s.id) return false;
    const t = TRACK_BY_SHARE.get(s.id); if (!t) return false;
    const list = (s.q || []).map(id => TRACK_BY_SHARE.get(id)).filter(Boolean);
    queue = (list.length ? list : [t]).map(x => entry(x)); index = Math.max(0, queue.findIndex(e => e.t === t));
    context = s.ctx || { kind: 'list' };
    current = t; cands = sourcesFor(t); ci = 0;
    const a = el(); a._track = t; a.preload = 'metadata'; a._seekTo = s.at || null; a.src = cands[0] || '';
    wantPlay = false; ms.meta(t); bus.emit('track', t); emitState(); bus.emit('queue');
    return true;
  }

  return {
    playList, playTrack, toggle, next, prev, jump, seek, playNext, addToQueue, removeAt, setShuffle, cycleRepeat, restore, sourcesFor,
    showRoutes() { const a = el(); if (a.webkitShowPlaybackTargetPicker) { try { a.webkitShowPlaybackTargetPicker(); return true; } catch (_) {} } return false; },
    get el() { return el(); },
    get current() { return current; },
    get queue() { return queue; },
    get index() { return index; },
    get context() { return context; },
    get playing() { return isPlaying(); },
    get airplay() { return airplay || !!window.WebKitPlaybackTargetAvailabilityEvent; },
    get time() { const a = el(); return { cur: a.currentTime || 0, dur: Number.isFinite(a.duration) ? a.duration : 0, buffered: a.buffered }; },
    pauseForScrub() { const a = el(); const was = !a.paused; if (was) { a._switching = true; a.pause(); a._switching = false; } return was; },
    resumeAfterScrub(was) { const a = el(); if (was) { wantPlay = true; playEl(a); } emitState(); }
  };
})();
