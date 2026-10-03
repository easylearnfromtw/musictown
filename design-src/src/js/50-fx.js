/* ==========================================================================
   FX · Vintage eras + record scratch
   - Music is processed only on the dedicated FX element (same-origin / CORS).
   - Surface noise is a steady floor; crackle is sparse and soft.
   - Wow & flutter come from a modulated delay line, never from playbackRate,
     so iOS never re-buffers (that was the old stutter).
   ========================================================================== */
const ERAS = [
  { id: 0, name: '原音', era: 'Original', note: '原始音源，不加效果' },
  { id: 1, name: '七〇年代黑膠', era: '1970s', note: '溫暖低頻，淡淡底噪' },
  { id: 2, name: '五〇年代單聲道', era: '1950s', note: '單聲道，偶爾的爆裂' },
  { id: 3, name: '三〇年代蟲膠', era: '1930s', note: '78 轉，明顯底噪' }
];
const ERA_PARAMS = [
  { hp: 12, lp: 20000, lp2: 20000, peakF: 200, peakG: 0, presF: 3000, presG: 0, drive: 0, mono: 0, noise: 0, crackle: 0, crackleAmp: 0, wow: 0, flutter: 0, rumble: 0, tick: 0, makeup: 1 },
  { hp: 30, lp: 14500, lp2: 18000, peakF: 140, peakG: 2.2, presF: 3400, presG: -1.6, drive: .9, mono: 0, noise: .014, crackle: .55, crackleAmp: .07, wow: .00035, flutter: .000012, rumble: .006, tick: 0, makeup: .8 },
  { hp: 80, lp: 8200, lp2: 11000, peakF: 1100, peakG: 2.4, presF: 3200, presG: 1.2, drive: 1.4, mono: .9, noise: .028, crackle: 1.6, crackleAmp: .1, wow: .0006, flutter: .00002, rumble: .008, tick: 0, makeup: .7 },
  { hp: 240, lp: 4300, lp2: 5600, peakF: 1650, peakG: 5, presF: 2600, presG: 2, drive: 1.9, mono: 1, noise: .06, crackle: 3.6, crackleAmp: .14, wow: .0011, flutter: .00004, rumble: .004, tick: .022, makeup: .58 }
];

const FX = (() => {
  let ctx = null, g = null, level = Settings.get('vintage') || 0, attachedEl = null, surfaceOn = false;
  const corsOK = new Map(Object.entries(sess.get('mt.cors', {})));
  const AC = window.AudioContext || window.webkitAudioContext;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { ctx = new AC(); }
      build();
      ctx.addEventListener?.('statechange', () => { bus.emit('fx-state', ctx.state); syncCrackleScheduler(); });
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
    return ctx;
  }

  function noiseBuffer(sec, kind) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .16; }
        else { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
      }
      // crossfade the loop seam
      const f = Math.floor(ctx.sampleRate * .05);
      for (let i = 0; i < f; i++) { const a = i / f; d[n - f + i] = d[n - f + i] * (1 - a) + d[i] * a; }
    }
    return b;
  }
  function clickBuffers() {
    const out = [];
    for (let v = 0; v < 8; v++) {
      const len = Math.floor(ctx.sampleRate * (.0015 + Math.random() * .004)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      const sign = Math.random() < .5 ? -1 : 1;
      for (let i = 0; i < len; i++) { const env = Math.exp(-i / (len * .22)); d[i] = sign * env * (i < 3 ? 1 : (Math.random() * 2 - 1) * .6 + Math.cos(i * .9) * .4); }
      out.push(b);
    }
    return out;
  }
  function satCurve(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; c[i] = k <= 0 ? x : Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }

  function build() {
    const n = () => ctx.createGain();
    g = {};
    g.master = n(); g.master.connect(ctx.destination);
    // music chain (fed by the FX element when attached)
    g.input = n();
    g.stereo = n(); g.monoSum = n(); g.monoSum.channelCount = 1; g.monoSum.channelCountMode = 'explicit'; g.monoSum.channelInterpretation = 'speakers';
    g.monoGain = n(); g.monoGain.gain.value = 0;
    g.input.connect(g.stereo); g.input.connect(g.monoSum); g.monoSum.connect(g.monoGain);
    g.hp = ctx.createBiquadFilter(); g.hp.type = 'highpass'; g.hp.Q.value = .6;
    g.lp = ctx.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.Q.value = .55;
    g.lp2 = ctx.createBiquadFilter(); g.lp2.type = 'lowpass'; g.lp2.Q.value = .5;
    g.peak = ctx.createBiquadFilter(); g.peak.type = 'peaking'; g.peak.Q.value = .8;
    g.pres = ctx.createBiquadFilter(); g.pres.type = 'peaking'; g.pres.Q.value = 1.1;
    g.drive = ctx.createWaveShaper(); g.drive.oversample = '2x';
    g.makeup = n();
    g.wow = ctx.createDelay(.1); g.wow.delayTime.value = .012;
    g.music = n();
    [g.stereo, g.monoGain].forEach(x => x.connect(g.hp));
    g.fade = n();
    g.hp.connect(g.lp); g.lp.connect(g.lp2); g.lp2.connect(g.peak); g.peak.connect(g.pres); g.pres.connect(g.drive); g.drive.connect(g.makeup); g.makeup.connect(g.wow); g.wow.connect(g.music); g.music.connect(g.fade); g.fade.connect(g.master);
    // wow & flutter LFOs → delay time (smooth pitch drift, no rebuffering)
    g.wowOsc = ctx.createOscillator(); g.wowOsc.frequency.value = .55; g.wowAmt = n(); g.wowAmt.gain.value = 0;
    g.flOsc = ctx.createOscillator(); g.flOsc.frequency.value = 6.3; g.flAmt = n(); g.flAmt.gain.value = 0;
    g.wowOsc.connect(g.wowAmt); g.wowAmt.connect(g.wow.delayTime); g.flOsc.connect(g.flAmt); g.flAmt.connect(g.wow.delayTime);
    g.wowOsc.start(); g.flOsc.start();
    // surface: steady noise floor + rumble + sparse crackle
    g.surface = n(); g.surface.gain.value = 0; g.surface.connect(g.master);
    g.noiseSrc = ctx.createBufferSource(); g.noiseSrc.buffer = noiseBuffer(5, 'pink'); g.noiseSrc.loop = true;
    g.noiseHP = ctx.createBiquadFilter(); g.noiseHP.type = 'highpass'; g.noiseHP.frequency.value = 400;
    g.noiseLP = ctx.createBiquadFilter(); g.noiseLP.type = 'lowpass'; g.noiseLP.frequency.value = 9000;
    g.noise = n(); g.noise.gain.value = 0;
    g.noiseSrc.connect(g.noiseHP); g.noiseHP.connect(g.noiseLP); g.noiseLP.connect(g.noise); g.noise.connect(g.surface); g.noiseSrc.start();
    g.rumSrc = ctx.createBufferSource(); g.rumSrc.buffer = noiseBuffer(4, 'brown'); g.rumSrc.loop = true;
    g.rumLP = ctx.createBiquadFilter(); g.rumLP.type = 'lowpass'; g.rumLP.frequency.value = 55;
    g.rumble = n(); g.rumble.gain.value = 0;
    g.rumSrc.connect(g.rumLP); g.rumLP.connect(g.rumble); g.rumble.connect(g.surface); g.rumSrc.start();
    g.clickBus = n(); g.clickBP = ctx.createBiquadFilter(); g.clickBP.type = 'bandpass'; g.clickBP.frequency.value = 2400; g.clickBP.Q.value = .65;
    g.clickBus.connect(g.clickBP); g.clickBP.connect(g.surface);
    g.clicks = clickBuffers();
    apply(level, true);
  }

  let nextClick = 0, nextTick = 0, crackleTimer = 0;
  function crackleActive() {
    return !!(ctx && g && ctx.state === 'running' && surfaceOn && level > 0 && !document.hidden);
  }
  function syncCrackleScheduler() {
    if (!crackleActive()) {
      if (crackleTimer) { clearTimeout(crackleTimer); crackleTimer = 0; }
      return;
    }
    if (crackleTimer) return;
    const tick = () => {
      crackleTimer = 0;
      if (!crackleActive()) return;
      scheduleCrackle();
      crackleTimer = setTimeout(tick, 110);
    };
    crackleTimer = setTimeout(tick, 0);
  }
  function scheduleCrackle() {
    if (!ctx || ctx.state !== 'running' || !surfaceOn || level === 0) return;
    const p = ERA_PARAMS[level], now = ctx.currentTime, horizon = now + .25;
    if (nextClick < now) nextClick = now + Math.random() * .2;
    while (nextClick < horizon) {
      const s = ctx.createBufferSource(), gg = ctx.createGain();
      s.buffer = g.clicks[(Math.random() * g.clicks.length) | 0];
      const r = Math.random(); gg.gain.value = p.crackleAmp * (r < .9 ? .15 + r * .5 : .9 + Math.random() * .5);
      s.playbackRate.value = .7 + Math.random() * .7;
      s.connect(gg); gg.connect(g.clickBus); s.start(nextClick);
      nextClick += -Math.log(1 - Math.random()) / Math.max(.05, p.crackle);
    }
    if (p.tick > 0) {
      if (nextTick < now) nextTick = now + .77;
      while (nextTick < horizon) {
        const s = ctx.createBufferSource(), gg = ctx.createGain(); s.buffer = g.clicks[0]; gg.gain.value = p.tick * (.6 + Math.random() * .4);
        s.connect(gg); gg.connect(g.clickBus); s.start(nextTick + (Math.random() - .5) * .01); nextTick += .769;
      }
    }
  }

  function apply(lv, instant = false) {
    level = clamp(lv | 0, 0, 3);
    if (!g) return;
    const p = ERA_PARAMS[level], t = ctx.currentTime, k = instant ? .001 : .12;
    const to = (param, v) => { try { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, k); } catch (_) { param.value = v; } };
    to(g.hp.frequency, p.hp); to(g.lp.frequency, p.lp); to(g.lp2.frequency, p.lp2);
    to(g.peak.frequency, p.peakF); to(g.peak.gain, p.peakG); to(g.pres.frequency, p.presF); to(g.pres.gain, p.presG);
    g.drive.curve = satCurve(p.drive); to(g.makeup.gain, p.makeup);
    to(g.monoGain.gain, p.mono); to(g.stereo.gain, 1 - p.mono);
    to(g.wowAmt.gain, p.wow); to(g.flAmt.gain, p.flutter);
    to(g.noise.gain, p.noise); to(g.rumble.gain, p.rumble);
    to(g.noiseLP.frequency, Math.min(12000, p.lp * 1.15)); to(g.noiseHP.frequency, Math.max(300, p.hp * 1.6));
    setSurface(surfaceOn);
  }
  function setSurface(on) {
    surfaceOn = !!on;
    if (!g) return;
    const t = ctx.currentTime;
    try { g.surface.gain.cancelScheduledValues(t); g.surface.gain.setTargetAtTime(on && level > 0 ? 1 : 0, t, on ? .18 : .06); } catch (_) {}
    syncCrackleScheduler();
  }
  document.addEventListener('visibilitychange', syncCrackleScheduler, { passive: true });

  function attach(el) {
    if (!ensure()) return false;
    if (attachedEl === el) return true;
    try { const s = ctx.createMediaElementSource(el); s.connect(g.input); attachedEl = el; return true; }
    catch (e) { console.warn('[fx attach]', e); return false; }
  }

  /* can the FX element play & process this URL? */
  function canProcess(url) {
    try {
      const u = new URL(url, document.baseURI);
      if (u.protocol === 'blob:' || u.origin === location.origin) return true;
      return corsOK.get(u.origin) === true;
    } catch (_) { return false; }
  }
  async function probeCors(url) {
    let origin; try { origin = new URL(url, document.baseURI).origin; } catch (_) { return false; }
    if (origin === location.origin) return true;
    if (corsOK.has(origin)) return corsOK.get(origin);
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 4000);
    let ok = false;
    try { const r = await fetch(url, { mode: 'cors', signal: ac.signal, cache: 'no-store' }); ok = r.ok || r.status === 206; ac.abort(); } catch (_) { ok = false; }
    clearTimeout(timer); corsOK.set(origin, ok); sess.set('mt.cors', Object.fromEntries(corsOK)); return ok;
  }

  /* ------------------------------------------------------------------
     Scratch: drag the record → hear the record.
     A ±14 s window around the needle is decoded; forward/reverse copies
     are played at the finger's angular speed (physical 33⅓ mapping).
     Without a decodable window we fall back to needle friction.
     ------------------------------------------------------------------ */
  const Scratch = (() => {
    let s = null; // session
    const windows = new Map(); // url → {buf, rbuf, t0, dur}
    const sizes = new Map();
    const PHYS = 1.8; // seconds of groove per turn at 33⅓ rpm
    function reverse(buf) {
      const r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c), b = r.getChannelData(c); for (let i = 0, n = a.length; i < n; i++) b[i] = a[n - 1 - i]; }
      return r;
    }
    async function fileSize(url) {
      if (sizes.has(url)) return sizes.get(url);
      const r = await fetch(url, { headers: { Range: 'bytes=0-1' } });
      const cr = r.headers.get('Content-Range'); let total = cr ? Number(cr.split('/')[1]) : Number(r.headers.get('Content-Length'));
      if (!Number.isFinite(total) || total <= 2) total = 0;
      try { await r.body?.cancel(); } catch (_) {}
      sizes.set(url, total); return total;
    }
    async function loadWindow(url, t, dur) {
      const hit = windows.get(url);
      if (hit && t > hit.t0 + 3 && t < hit.t0 + hit.dur - 3) return hit;
      let u; try { u = new URL(url, document.baseURI); } catch (_) { return null; }
      const local = u.protocol === 'blob:' || u.origin === location.origin;
      if (!local && corsOK.get(u.origin) !== true) return null;
      let ab, t0 = 0;
      if (u.protocol === 'blob:') {
        const blob = await (await fetch(url)).blob();
        if (!dur || blob.size < 4e6) ab = await blob.arrayBuffer();
        else { const bps = blob.size / dur, a = Math.max(0, Math.floor((t - 14) * bps)), b = Math.min(blob.size, Math.ceil((t + 14) * bps)); ab = await blob.slice(a, b).arrayBuffer(); t0 = a / bps; }
      } else {
        const size = await fileSize(url);
        if (size && dur) {
          const bps = size / dur, a = Math.max(0, Math.floor((t - 14) * bps)), b = Math.min(size - 1, Math.ceil((t + 14) * bps));
          const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } });
          ab = await r.arrayBuffer(); t0 = r.status === 206 ? a / bps : 0;
        } else { ab = await (await fetch(url)).arrayBuffer(); }
      }
      const buf = await new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p?.then) p.then(res, rej); } catch (e) { rej(e); } });
      const w = { buf, rbuf: reverse(buf), t0, dur: buf.duration };
      windows.clear(); windows.set(url, w); return w;
    }
    /* the record under the hand: a stylus "zip" whose pitch follows the
       finger (resonant band-passed noise + a low whirr), always audible,
       even when the music itself can't be decoded */
    function friction() {
      const src = ctx.createBufferSource(); src.buffer = g.noiseSrc.buffer; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3.2;
      const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 1800; bp2.Q.value = 6;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70;
      const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 420;
      const og = ctx.createGain(); og.gain.value = 0;
      src.connect(bp); src.connect(bp2); bp.connect(gain); bp2.connect(gain); gain.connect(ctx.destination);
      osc.connect(olp); olp.connect(og); og.connect(ctx.destination);
      src.start(); osc.start();
      return { src, bp, bp2, gain, osc, og };
    }
    function begin(url, startTime, duration) {
      if (!ensure()) return;
      end(true);
      const bus = ctx.createGain(); bus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = .7;
      bus.connect(lp); lp.connect(ctx.destination);
      s = { bus, lp, fr: friction(), dir: 0, node: null, ng: null, win: null, startTime, turns: 0, playPos: 0, est: 0, lastT: ctx.currentTime };
      try { const t = ctx.currentTime, b = ctx.createBufferSource(), gg = ctx.createGain(), f = ctx.createBiquadFilter(); b.buffer = g.clicks[1]; b.playbackRate.value = .5; f.type = 'lowpass'; f.frequency.value = 1400; gg.gain.value = .35; b.connect(f); f.connect(gg); gg.connect(ctx.destination); b.start(t); } catch (_) {}
      const mine = s;
      loadWindow(url, startTime, duration).then(w => { if (s === mine && w) { s.win = w; } }).catch(() => {});
    }
    function restart(dir, pos) {
      const now = ctx.currentTime;
      if (s.node) { const old = s.node, og = s.ng; try { og.gain.setTargetAtTime(0, now, .004); old.stop(now + .03); } catch (_) {} }
      const w = s.win; const node = ctx.createBufferSource(); node.buffer = dir > 0 ? w.buf : w.rbuf;
      const ng = ctx.createGain(); ng.gain.value = 0; ng.gain.setTargetAtTime(1, now, .004);
      node.connect(ng); ng.connect(s.bus);
      const off = clamp(dir > 0 ? pos : w.dur - pos, 0, w.dur - .01);
      node.start(now, off); s.node = node; s.ng = ng; s.dir = dir; s.est = pos;
    }
    /* turns: accumulated record rotation since grab; speed: turns per second (signed) */
    function move(turns, speed) {
      if (!s || !ctx) return;
      const now = ctx.currentTime, dt = Math.max(0, now - s.lastT); s.lastT = now;
      const rate = Math.abs(speed) * PHYS, dir = speed > .02 ? 1 : speed < -.02 ? -1 : 0;
      // friction always reacts to the hand
      const fv = clamp(Math.abs(speed) / 1.4, 0, 1), dirSign = speed < 0 ? .82 : 1;
      s.fr.gain.gain.setTargetAtTime(fv < .02 ? 0 : (s.win ? .5 : 1.7) * (.25 + fv * .75), now, .018);
      s.fr.bp.frequency.setTargetAtTime((380 + fv * 2600) * dirSign, now, .025);
      s.fr.bp2.frequency.setTargetAtTime((900 + fv * 4200) * dirSign, now, .025);
      s.fr.osc.frequency.setTargetAtTime((45 + fv * 210) * dirSign, now, .03);
      s.fr.og.gain.setTargetAtTime(fv < .02 ? 0 : (s.win ? .015 : .05) * fv, now, .03);
      if (!s.win) return;
      const pos = (s.startTime - s.win.t0) + turns * PHYS;
      if (pos < .05 || pos > s.win.dur - .05 || dir === 0) { s.bus.gain.setTargetAtTime(0, now, .02); if (dir === 0 && s.node) s.est = pos; return; }
      s.est += s.dir * (s.node ? 1 : 0) * Math.min(4, rate) * dt;
      if (dir !== s.dir || !s.node || Math.abs(s.est - pos) > .18) restart(dir, pos);
      s.node.playbackRate.setTargetAtTime(clamp(rate, .04, 4), now, .012);
      s.bus.gain.setTargetAtTime(clamp(.35 + rate * .5, 0, 1), now, .015);
      s.lp.frequency.setTargetAtTime(700 + Math.min(1, rate) * 9000, now, .02);
    }
    function end(silent) {
      if (!s) return; const x = s; s = null; const now = ctx.currentTime;
      try { x.bus.gain.setTargetAtTime(0, now, silent ? .002 : .03); x.fr.gain.gain.setTargetAtTime(0, now, .03); x.fr.og.gain.setTargetAtTime(0, now, .03); } catch (_) {}
      setTimeout(() => { try { x.node?.stop(); x.fr.src.stop(); x.fr.osc.stop(); x.bus.disconnect(); x.fr.gain.disconnect(); x.fr.og.disconnect(); } catch (_) {} }, 220);
    }
    return { begin, move, end };
  })();

  /* a short needle-drop thump when playback starts with vintage on */
  function needleDrop() {
    if (!ctx || !g || level === 0) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(), gg = ctx.createGain(), lp = ctx.createBiquadFilter();
    s.buffer = g.clicks[2]; s.playbackRate.value = .35; lp.type = 'lowpass'; lp.frequency.value = 900; gg.gain.value = .12;
    s.connect(lp); lp.connect(gg); gg.connect(g.master); s.start(t);
  }

  /* music-only gain for fades (surface noise keeps going) */
  const fade = {
    set(v) { if (!g) return; const t = ctx.currentTime; try { g.fade.gain.cancelScheduledValues(t); g.fade.gain.setValueAtTime(v, t); } catch (_) { g.fade.gain.value = v; } },
    to(v, sec) { if (!g) return; const t = ctx.currentTime; try { g.fade.gain.cancelScheduledValues(t); g.fade.gain.setValueAtTime(g.fade.gain.value, t); g.fade.gain.linearRampToValueAtTime(v, t + Math.max(.02, sec)); } catch (_) { g.fade.gain.value = v; } },
    get value() { return g ? g.fade.gain.value : 1; }
  };

  return {
    ensure, attach, canProcess, probeCors, setSurface, needleDrop, Scratch, fade,
    get ctx() { return ctx; },
    get level() { return level; },
    setLevel(lv) { level = clamp(lv | 0, 0, 3); Settings.set('vintage', level); if (level > 0) ensure(); apply(level); bus.emit('vintage', level); },
    get running() { return !!ctx && ctx.state === 'running'; }
  };
})();
