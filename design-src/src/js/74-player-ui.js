/* ==========================================================================
   PlayerUI · full player sheet
   - morphs out of the mini capsule (clip-path + record flies from the disc)
   - the record spins on the compositor (WAAPI): slow, steady, 120 Hz-smooth,
     with an eased motor start/stop; no tonearm, just the coloured vinyl
   - drag the record to scrub: you hear the stylus and the groove (FX.Scratch)
   - order: record · title · seek · transport · vintage (quiet) · actions
   ========================================================================== */
const PlayerUI = (() => {
  const root = byId('player');
  const PERIOD = 24; // seconds of music per visual turn
  root.innerHTML = `<div class="player__sheet" id="plSheet">
    <div class="player__wash"></div>
    <div class="player__scroll" id="plScroll"><div class="player__inner" id="plInner">
      <div class="player__grab" aria-hidden="true"></div>
      <header class="player__head" id="plHead">
        <button class="icon-btn" type="button" id="plClose" aria-label="收起播放器">${icon('down')}</button>
        <div class="player__from"><small id="plFromLabel">播放自</small><button type="button" id="plFrom"></button></div>
        <button class="icon-btn" type="button" id="plMore" aria-label="更多選項">${icon('more')}</button>
      </header>
      <div class="stage" id="plStage">
        <button class="album-cover" id="plCover" type="button" aria-label="切換到彩膠互動">
          <img id="plCoverImg" alt="" decoding="async">
          <span class="album-cover__hint">${icon('vinyl')}<b>VINYL</b></span>
        </button>
        <div class="limited" id="plLimited" aria-hidden="true"></div>
        <div class="vinyl" id="plVinyl" role="slider" tabindex="0" aria-label="唱片：順時針拖曳快轉，逆時針倒轉" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="vinyl__rotor" id="plRotor">
            <div class="vinyl__label"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><path id="plRing" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs><text><textPath href="#plRing" textLength="226" lengthAdjust="spacing">CITYMUS · CITY SOUND ARCHIVE ·</textPath></text></svg><span class="vinyl__code" id="plCode"></span></div>
          </div>
          <div class="vinyl__sheen"></div><div class="vinyl__hole"></div>
        </div>
        <div class="scrub-readout" id="plReadout">0:00</div>
      </div>
      <div class="np"><span class="np__disc" aria-hidden="true"></span><div style="min-width:0"><div class="np__title" id="plTitle"></div><div class="np__artist" id="plArtist"></div></div><div class="np__actions"><button class="icon-btn" type="button" id="plFav" aria-label="收藏">${icon('heart')}</button></div></div>
      <div class="seek" id="plSeek"><div class="seek__track" id="plSeekTrack" role="slider" tabindex="0" aria-label="播放進度" aria-valuemin="0" aria-valuemax="100"><div class="seek__rail"><i class="seek__buf" id="plBuf"></i><i class="seek__fill" id="plFill"></i></div></div><div class="seek__times"><span id="plCur">0:00</span><span id="plDur">0:00</span></div></div>
      <div class="transport">
        <button class="icon-btn t-small" type="button" id="plShuffle" aria-label="隨機播放">${icon('shuffle')}</button>
        <button class="icon-btn" type="button" id="plPrev" aria-label="上一首">${icon('prev')}</button>
        <button class="icon-btn playbtn" type="button" id="plPlay" aria-label="播放">${icon('play')}</button>
        <button class="icon-btn" type="button" id="plNext" aria-label="下一首">${icon('next')}</button>
        <button class="icon-btn t-small" type="button" id="plRepeat" aria-label="重複播放">${icon('repeat')}</button>
      </div>
      <section class="vintage" aria-label="老舊音樂模式">
        <div class="vintage__head"><b>${icon('vinyl')}老舊音樂</b><span class="vintage__state" id="plVState" aria-live="polite"></span></div>
        <div id="plVSeg"></div>
      </section>
      <div class="pactions" role="toolbar" aria-label="這首歌">
        <button class="pact" type="button" id="plOut" aria-label="輸出裝置">${icon('airplay')}</button>
        <button class="pact" type="button" id="plAdd" aria-label="加入播放清單">${icon('listAdd')}</button>
        <button class="pact" type="button" id="plShare" aria-label="分享這首歌">${icon('share')}</button>
        <button class="pact" type="button" id="plDl" aria-label="存到這台裝置">${icon('download')}</button>
        <button class="pact" type="button" id="plQ" aria-pressed="false" aria-label="接下來播放">${icon('queue')}</button>
      </div>
      <section class="queue" id="plQueue" aria-label="接下來播放"></section>
      <section class="story" id="plStory"></section>
    </div></div>
  </div>`;
  const sheet = byId('plSheet'), scroller = byId('plScroll'), vinyl = byId('plVinyl'), rotor = byId('plRotor'), stage = byId('plStage');
  const coverBtn = byId('plCover'), coverImg = byId('plCoverImg');
  let open = false, closingViaUI = false, coverSeq = 0;

  function showCoverMode() {
    stage.classList.add('is-cover');
    coverBtn?.setAttribute('aria-expanded', 'false');
  }
  function showVinylMode() {
    stage.classList.remove('is-cover');
    coverBtn?.setAttribute('aria-expanded', 'true');
  }
  coverBtn?.addEventListener('click', () => { haptic(); showVinylMode(); });

  /* ---------- vinyl rotation on the compositor ---------- */
  const spin = rotor.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: PERIOD * 1000, iterations: Infinity });
  spin.pause();
  let ramp = null;
  function rampTo(target, ms) {
    cancelAnimationFrame(ramp);
    if (REDUCE) { if (target > 0) { spin.playbackRate = 1; spin.play(); } else spin.pause(); return; }
    const from = spin.playState === 'running' ? spin.playbackRate : 0; const t0 = performance.now();
    if (target > 0 && spin.playState !== 'running') { spin.playbackRate = 0.0001; spin.play(); }
    const step = now => {
      const k = clamp((now - t0) / ms, 0, 1), e = k * k * (3 - 2 * k), r = from + (target - from) * e;
      try { spin.updatePlaybackRate ? spin.updatePlaybackRate(Math.max(.0001, r)) : (spin.playbackRate = Math.max(.0001, r)); } catch (_) { spin.playbackRate = Math.max(.0001, r); }
      if (k < 1) ramp = requestAnimationFrame(step); else if (target === 0) { spin.pause(); spin.playbackRate = 1; }
    };
    ramp = requestAnimationFrame(step);
  }
  function syncSpin(force) {
    const a = Player.el; if (!a) return;
    const want = ((a.currentTime || 0) % PERIOD) * 1000, cur = (spin.currentTime || 0) % (PERIOD * 1000);
    let d = Math.abs(want - cur); d = Math.min(d, PERIOD * 1000 - d);
    if (force || d > 1600) spin.currentTime = want;
  }

  /* ---------- Taipei Limited: the wordmark sits behind the record ---------- */
  function drawLimited() {
    const th = themeOf(Player.current), lim = Limited.active(th?.t), host = byId('plLimited');
    stage.classList.toggle('is-limited', !!lim);
    if (!lim) { host.innerHTML = ''; return; }
    if (!host.firstChild) host.innerHTML = `<img class="limited__word" src="${lim.word}" alt="" decoding="async"><img class="limited__cn" src="${lim.cn}" alt="" decoding="async">`;
  }

  /* ---------- render ---------- */
  function render() {
    const t = Player.current; if (!t) return;
    const th = themeOf(t);
    setAccent(root, th);
    byId('plTitle').textContent = t.title || 'Untitled'; byId('plTitle').classList.toggle('is-long', String(t.title || '').length > 22);
    byId('plArtist').textContent = [t.artist, t.note].filter(Boolean).join(' · ');
    byId('plCode').textContent = th?.code || 'MT';
    const vc = vinylColor(t); vinyl.dataset.material = vc.material; vinyl.style.setProperty('--disc', vc.hex); vinyl.setAttribute('aria-valuetext', `${vc.name} 唱片`);
    showVinylMode();
    const seq = ++coverSeq;
    coverImg.alt = `${t.title || 'CITYMUS'} 封面`;
    Artwork.cover(t, 900).then(src => {
      if (seq !== coverSeq || Player.current !== t || !src) return;
      coverImg.src = src;
    }).catch(() => {});
    const ctx = Player.context; byId('plFrom').textContent = ctx.title || (th ? (th.kind === 'literature' ? th.cn : th.name) : '音樂庫');
    const fav = Library.isFav(t); const f = byId('plFav'); f.hidden = !!t.localPersonal; f.classList.toggle('is-fav', fav); f.innerHTML = icon(fav ? 'heartFill' : 'heart'); f.setAttribute('aria-label', fav ? '從收藏移除' : '加入收藏');
    let host = ''; try { host = t.source ? new URL(t.source).host.replace(/^www\./, '') : ''; } catch (_) {}
    const lic = String(t.license || '').trim();
    const showLic = !!lic && !/^(?:CC0|Public Domain|Public Domain Mark|PDM|PD\b)/i.test(lic);
    const attr = String(t.attribution || '').trim();
    const tags = vibeTags(t).filter((x, i, a) => a.indexOf(x) === i).slice(0, 6);
    byId('plStory').innerHTML = t.localPersonal ? `<h3>本機音樂</h3><p>這首來自你的裝置，只存在這個瀏覽器，不會上傳。</p>` :
      th?.kind === 'literature'
        ? `<h3>${esc(th.cn)} · ${esc(t.note || '')}</h3><p>${esc(t.composerCn || '')}〈${esc(t.title)}〉。${esc(th.line)}</p><p class="story__src">演奏 ${esc(t.performer || 'Musopen')} · 作曲者逝於 ${esc(t.composerDied || '')} 年${showLic ? ` · ${esc(lic)}` : ''}${host ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener">${esc(host)}</a>` : ''}</p>`
        : `<h3>關於這首歌</h3><p>〈${esc(t.title)}〉收錄在 ${esc(th?.name || t.culture || 'CITYMUS')}${th ? `（${esc(th.cn)}）` : ''}。${esc(th?.line || '')}</p><div class="story__tags">${tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div><p class="story__src">${esc(lic || '')}${attr ? ` · ${esc(attr)}` : ''}${host ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener">${esc(host)}</a>` : ''}</p>`;
    drawLimited(); drawVintageState(); drawDl(); state(); if (root.classList.contains('q-open')) drawQueue();
    byId('plOut').innerHTML = icon(Player.airplay ? 'airplay' : 'headphones');
  }
  function drawDl() {
    const t = Player.current, b = byId('plDl'); if (!t) return;
    b.hidden = !!t.localPersonal || !Offline.supported;
    const has = Offline.has(t), p = Offline.progress(t);
    b.classList.toggle('is-on', has); b.innerHTML = icon(has ? 'downloaded' : 'download');
    b.setAttribute('aria-label', has ? '已存在這台裝置' : p != null ? `下載中 ${Math.round(p * 100)}%` : '存到這台裝置');
    b.style.setProperty('--p', p != null ? p : 0); b.classList.toggle('is-busy', p != null);
  }
  function state() {
    const on = Player.playing;
    root.classList.toggle('is-playing', on);
    const b = byId('plPlay'); b.innerHTML = icon(on ? 'pause' : 'play'); b.setAttribute('aria-label', on ? '暫停' : '播放');
    byId('plShuffle').classList.toggle('is-on', !!Settings.get('shuffle')); byId('plShuffle').setAttribute('aria-pressed', String(!!Settings.get('shuffle')));
    const r = Settings.get('repeat'); const rb = byId('plRepeat'); rb.classList.toggle('is-on', r !== 'off'); rb.innerHTML = icon(r === 'one' ? 'repeatOne' : 'repeat'); rb.setAttribute('aria-label', { off: '重複播放：關', all: '重複播放：全部', one: '重複播放：單曲' }[r]);
    if (!scrubbing) { syncSpin(); rampTo(on ? 1 : 0, on ? 650 : 900); }
    if (open) tick();
  }

  /* ---------- time / seek ---------- */
  let ticking = false, seeking = null, lastSec = -1;
  function paintTime(cur, dur) {
    byId('plFill').style.transform = `scaleX(${dur ? clamp(cur / dur, 0, 1) : 0})`;
    const s = Math.floor(cur);
    if (s !== lastSec || seeking) { lastSec = s; byId('plCur').textContent = fmtTime(cur); byId('plDur').textContent = dur ? '-' + fmtTime(Math.max(0, dur - cur)) : '0:00'; }
    byId('plSeekTrack').setAttribute('aria-valuenow', dur ? Math.round(cur / dur * 100) : 0);
  }
  function tick() {
    if (ticking) return; ticking = true;
    const f = () => {
      if (!open) { ticking = false; return; }
      if (!seeking && !scrubbing) { const { cur, dur, buffered } = Player.time; paintTime(cur, dur); try { if (buffered && buffered.length && dur) byId('plBuf').style.transform = `scaleX(${clamp(buffered.end(buffered.length - 1) / dur, 0, 1)})`; } catch (_) {} }
      if (Player.playing || seeking || scrubbing) requestAnimationFrame(f); else ticking = false;
    };
    requestAnimationFrame(f);
  }
  const seekEl = byId('plSeek'), track = byId('plSeekTrack');
  const fracAt = e => { const r = track.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  track.addEventListener('pointerdown', e => { seeking = { id: e.pointerId }; seekEl.classList.add('is-active'); try { track.setPointerCapture(e.pointerId); } catch (_) {} const { dur } = Player.time; seeking.t = fracAt(e) * dur; paintTime(seeking.t, dur); tick(); });
  track.addEventListener('pointermove', e => { if (!seeking) return; const { dur } = Player.time; seeking.t = fracAt(e) * dur; paintTime(seeking.t, dur); });
  const endSeek = () => { if (!seeking) return; const t = seeking.t; seeking = null; seekEl.classList.remove('is-active'); if (Number.isFinite(t)) { Player.seek(t); syncSpin(true); haptic(); } };
  track.addEventListener('pointerup', endSeek); track.addEventListener('pointercancel', endSeek);
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') Player.seek(Player.time.cur + 5); if (e.key === 'ArrowLeft') Player.seek(Player.time.cur - 5); });

  /* ---------- record gesture: rotary scratch only ---------- */
  let scrubbing = null, scrubIdleTimer = 0, recordGestureBlockedUntil = 0;
  const angleOf = e => { const r = vinyl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  const wrap = d => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };

  function beginScratch(s, e) {
    if (!s || s.mode !== 'pending') return;
    const a = Player.el, dur = Player.time.dur;
    s.mode = 'scratch';
    s.ang = angleOf(e); s.turns = 0; s.base = a.currentTime || 0; s.target = s.base;
    s.speed = 0; s.t = performance.now(); s.lastTick = Math.floor(s.base / 15);
    FX.ensure();
    try { if (FX.ctx && FX.ctx.state !== 'running') FX.ctx.resume().catch(() => {}); } catch (_) {}
    s.was = Player.pauseForScrub();
    cancelAnimationFrame(ramp); spin.pause(); syncSpin(true);
    root.classList.add('is-scrubbing');
    FX.Scratch.begin(a.currentSrc || a.src, s.base, dur);
    armScrubIdle();
    byId('plReadout').textContent = fmtTime(s.base);
    haptic();
  }

  vinyl.addEventListener('pointerdown', e => {
    showVinylMode();
    if (performance.now() < recordGestureBlockedUntil) return;
    if (!Player.current || (e.pointerType === 'mouse' && e.button)) return;
    e.preventDefault();
    scrubbing = {
      id: e.pointerId, mode: 'pending',
      x: e.clientX, y: e.clientY,
      started: performance.now(), path: 0, a0: angleOf(e)
    };
    try { vinyl.setPointerCapture(e.pointerId); } catch (_) {}
  });

  vinyl.addEventListener('pointermove', e => {
    const s = scrubbing; if (!s) return;
    const now = performance.now();
    const stepx = e.clientX - s.x, stepy = e.clientY - s.y;
    s.path += Math.hypot(stepx, stepy); s.x = e.clientX; s.y = e.clientY;

    if (s.mode === 'pending') {
      const ad = Math.abs(wrap(angleOf(e) - s.a0));
      // Only a genuine rotary movement starts scratch. Horizontal flicking
      // no longer has any previous/next-track meaning.
      if (s.path >= 16 && ad >= 7) beginScratch(s, e);
      return;
    }
    if (s.mode !== 'scratch') return;

    const ang = angleOf(e), d = wrap(ang - s.ang); s.ang = ang;
    const dt = Math.max(.008, (now - s.t) / 1000); s.t = now;
    s.turns += d / 360; s.speed = s.speed * .55 + (d / 360 / dt) * .45;
    const dur = Player.time.dur || Infinity;
    s.target = clamp(s.base + s.turns * PERIOD, 0, Math.max(0, dur - .25));
    spin.currentTime = ((s.target % PERIOD) + PERIOD) % PERIOD * 1000;
    const shift = s.target - s.base;
    byId('plReadout').textContent = `${fmtTime(s.target)}  ${shift >= 0 ? '+' : '−'}${Math.abs(shift).toFixed(1)}s`;
    paintTime(s.target, Player.time.dur);
    FX.Scratch.move(s.turns, s.speed);
    const tk = Math.floor(s.target / 15); if (tk !== s.lastTick) { s.lastTick = tk; haptic(); }
  });

  /* holding still: the stylus goes quiet; no idle timer runs outside a scrub session */
  function armScrubIdle() {
    if (scrubIdleTimer) clearTimeout(scrubIdleTimer);
    if (!scrubbing || scrubbing.mode !== 'scratch') { scrubIdleTimer = 0; return; }
    scrubIdleTimer = setTimeout(() => {
      scrubIdleTimer = 0;
      const s = scrubbing;
      if (!s || s.mode !== 'scratch') return;
      if (performance.now() - s.t > 90) { s.speed *= .5; FX.Scratch.move(s.turns, s.speed); }
      armScrubIdle();
    }, 80);
  }

  const endRecordGesture = () => {
    const s = scrubbing; if (!s) return; scrubbing = null;
    if (scrubIdleTimer) { clearTimeout(scrubIdleTimer); scrubIdleTimer = 0; }

    if (s.mode === 'scratch') {
      root.classList.remove('is-scrubbing'); FX.Scratch.end();
      Player.seek(s.target); Player.resumeAfterScrub(s.was);
      syncSpin(true); if (s.was) rampTo(1, 400);
      return;
    }

    // A tap, horizontal flick, or tiny move does nothing.
    root.classList.remove('is-scrubbing');
  };
  vinyl.addEventListener('pointerup', endRecordGesture);
  vinyl.addEventListener('pointercancel', endRecordGesture);
  vinyl.addEventListener('keydown', e => { if (e.key === 'ArrowRight') Player.seek(Player.time.cur + 10); if (e.key === 'ArrowLeft') Player.seek(Player.time.cur - 10); if (e.key === ' ') { e.preventDefault(); Player.toggle(); } });

  /* ---------- vintage (quiet, below the transport; persists for the next songs) ---------- */
  const vintageHost = byId('plVSeg');
  const vseg = Seg(vintageHost, {
    label: '老舊音樂程度', value: String(FX.level), draggable: false,
    items: [{ key: '0', html: '原音' }, { key: '1', html: '1970s' }, { key: '2', html: '1950s' }, { key: '3', html: '1930s' }],
    onChange: k => {
      recordGestureBlockedUntil = performance.now() + 900;
      FX.setLevel(Number(k));
      if (Number(k) > 0) FX.needleDrop();
      drawVintageState();
    }
  });
  // Vintage buttons are controls, never record gestures. Safari occasionally
  // preserves a prior pointer sequence across fast taps; isolate this zone.
  ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend'].forEach(type => {
    vintageHost.addEventListener(type, e => {
      recordGestureBlockedUntil = performance.now() + 900;
      e.stopPropagation();
    }, { passive: true });
  });
  function drawVintageState() {
    const lv = FX.level; root.classList.toggle('is-vintage', lv > 0);
    let txt = lv === 0 ? '之後的歌也會沿用這個設定' : ERAS[lv].note;
    const a = Player.el; const url = a.currentSrc || a.src;
    if (lv > 0 && url && !FX.canProcess(url)) txt = '此音源僅疊加底噪';
    byId('plVState').textContent = txt;
  }
  bus.on('vintage', lv => { vseg.set(String(lv), false); setTimeout(drawVintageState, 300); });

  /* ---------- queue (Up Next) ---------- */
  function drawQueue() {
    const q = Player.queue, i0 = Player.index;
    const upcoming = q.slice(i0 + 1).map((e, k) => ({ e, i: i0 + 1 + k }));
    const user = upcoming.filter(x => x.e.user), ctx = upcoming.filter(x => !x.e.user && !x.e.radio), radio = upcoming.filter(x => x.e.radio);
    const list = (arr, label, sub) => arr.length ? `<div class="queue__head"><b>${label}</b><span>${sub}</span></div><div class="rows" data-q>${arr.map(x => rowHTML(x.e.t, x.i, { num: pad2(x.i - i0), radio: !!x.e.radio, removable: true })).join('')}</div>` : '';
    byId('plQueue').innerHTML = `
      ${list(user, '接著播放', `${user.length} 首 · 你加入的`)}
      ${list(ctx.slice(0, 60), `來自 ${esc(Player.context.title || '這個清單')}`, `${ctx.length} 首`)}
      ${list(radio.slice(0, 20), '為你延續', '依照這首的聲音挑選')}
      ${!upcoming.length ? `<div class="empty" style="margin-top:16px"><b>清單到這裡結束</b><p>開啟「自動延續播放」，會接著播放相近的歌。</p></div>` : ''}
      <div class="queue__auto mt-16"><div><b>自動延續播放</b><span>清單播完後，接著播放相近的歌</span></div><button class="switch" type="button" role="switch" id="plAuto" aria-checked="${Settings.get('autoplay') !== false}" aria-label="自動延續播放"></button></div>`;
    byId('plAuto').onclick = () => { Settings.set('autoplay', !(Settings.get('autoplay') !== false)); drawQueue(); };
  }
  byId('plQueue').addEventListener('click', e => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = Number(row.dataset.i); const entry = Player.queue[i]; if (!entry) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'remove') { Player.removeAt(i); haptic(); return; }
    if (act === 'fav') { toggleFav(entry.t); return; }
    if (act === 'more') { trackSheet(entry.t); return; }
    haptic(); Player.jump(i);
  });
  byId('plQ').onclick = () => { const on = !root.classList.contains('q-open'); root.classList.toggle('q-open', on); byId('plQ').setAttribute('aria-pressed', String(on)); if (on) { drawQueue(); scroller.scrollTo({ top: 0, behavior: 'smooth' }); } haptic(); };
  bus.on('queue', () => { if (open && root.classList.contains('q-open')) drawQueue(); });

  /* ---------- controls ---------- */
  const control = (id, fn) => {
    const b = byId(id); if (!b) return;
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(e); };
    // Keep iOS player controls out of the sheet-dismiss gesture recogniser.
    b.addEventListener('pointerdown', e => e.stopPropagation(), { passive: true });
    b.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  };
  control('plPlay', () => { haptic(); Player.toggle(); });
  control('plNext', () => Player.next());
  control('plPrev', () => Player.prev());
  control('plShuffle', () => { haptic(); Player.setShuffle(!Settings.get('shuffle')); toast(Settings.get('shuffle') ? '隨機播放：開' : '隨機播放：關'); });
  control('plRepeat', () => { haptic(); const r = Player.cycleRepeat(); toast({ off: '重複播放：關', all: '重複播放：整個清單', one: '重複播放：這一首' }[r]); });
  control('plFav', e => { if (Player.current) { toggleFav(Player.current, e.currentTarget); render(); } });
  control('plMore', () => Player.current && trackSheet(Player.current));
  control('plAdd', () => { const t = Player.current; if (t && !t.localPersonal) { haptic(); libraryPicker(t); } });
  control('plShare', e => { const t = Player.current; if (t) { haptic(); actionBurst(e.currentTarget, 'share', '分享'); Share.track(t); } });
  control('plDl', () => { const t = Player.current; if (!t) return; haptic(); if (Offline.has(t)) offlineSheet(t); else Offline.download(t).then(ok => ok && toast('已存到這台裝置，可離線播放')); });
  control('plOut', () => { haptic(); if (!Player.showRoutes()) Ritual.output(); });
  control('plFrom', () => { const th = Player.context.theme ? THEME_BY_T.get(Player.context.theme) : themeOf(Player.current); if (th) navFromPlayer('theme', { slug: th.slug }); });
  control('plClose', () => hide());

  /* ---------- open / close with the morph ---------- */
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  function show({ from = null } = {}) {
    if (open || !Player.current) return;
    open = true; render();
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false'); scrollLock.lock();
    try { history.pushState(Object.assign({}, history.state, { player: true }), ''); } catch (_) {}
    scroller.scrollTop = 0; syncSpin(true); tick();
    if (REDUCE || !sheet.animate) return;
    const W = innerWidth, H = innerHeight;
    const useMini = from === 'mini' && document.documentElement.classList.contains('has-mini');
    const mr = useMini ? Mini.el.getBoundingClientRect() : null;
    const clip0 = mr ? `inset(${mr.top}px ${W - mr.right}px ${H - mr.bottom}px ${mr.left}px round ${mr.height / 2}px)` : `inset(${H * .6}px 0px 0px 0px round 28px)`;
    sheet.animate([{ clipPath: clip0, webkitClipPath: clip0 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', webkitClipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 560, easing: EASE });
    if (mr) {
      const d = Mini.discEl.getBoundingClientRect(), v = vinyl.getBoundingClientRect();
      if (v.width) vinyl.animate([{ transform: `translate(${d.left + d.width / 2 - (v.left + v.width / 2)}px, ${d.top + d.height / 2 - (v.top + v.height / 2)}px) scale(${d.width / v.width})` }, { transform: 'none' }], { duration: 560, easing: EASE });
    }
    [...byId('plInner').children].filter(n => n !== stage).forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 80 + i * 28, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  }
  function finishHide() { root.classList.remove('is-open', 'q-open'); byId('plQ').setAttribute('aria-pressed', 'false'); root.setAttribute('aria-hidden', 'true'); sheet.style.transform = ''; sheet.style.borderRadius = ''; scrollLock.unlock(); }
  function hide(fromHistory = false, { slide = false } = {}) {
    if (!open) return; open = false;
    if (!fromHistory) { closingViaUI = true; try { if (history.state && history.state.player) history.back(); else closingViaUI = false; } catch (_) { closingViaUI = false; } }
    if (REDUCE || !sheet.animate) { finishHide(); return; }
    const W = innerWidth, H = innerHeight;
    if (slide) {
      const cur = sheet.style.transform || 'translateY(0px)';
      const an = sheet.animate([{ transform: cur }, { transform: `translateY(${H}px)` }], { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' });
      an.onfinish = finishHide; return;
    }
    const useMini = document.documentElement.classList.contains('has-mini');
    const mr = useMini ? Mini.el.getBoundingClientRect() : null;
    const clip1 = mr ? `inset(${mr.top}px ${W - mr.right}px ${H - mr.bottom}px ${mr.left}px round ${mr.height / 2}px)` : `inset(${H}px 0px 0px 0px round 28px)`;
    const an = sheet.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', webkitClipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: clip1, webkitClipPath: clip1 }], { duration: 440, easing: EASE });
    if (mr && scroller.scrollTop < 200 && !root.classList.contains('q-open')) {
      const d = Mini.discEl.getBoundingClientRect(), v = vinyl.getBoundingClientRect();
      if (v.width) vinyl.animate([{ transform: 'none' }, { transform: `translate(${d.left + d.width / 2 - (v.left + v.width / 2)}px, ${d.top + d.height / 2 - (v.top + v.height / 2)}px) scale(${d.width / v.width})` }], { duration: 440, easing: EASE, fill: 'forwards' }).onfinish = function () { this.cancel(); };
    }
    [...byId('plInner').children].filter(n => n !== stage).forEach(n => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = function () { setTimeout(() => this.cancel(), 300); });
    an.onfinish = finishHide;
  }

  /* drag down to dismiss (header, grabber, or the top of the scroll area) */
  let dd = null;
  const dragStart = y => { dd = { y, t: performance.now(), dy: 0 }; sheet.style.transition = 'none'; };
  const dragMove = y => { if (!dd) return false; const dy = Math.max(0, y - dd.y); dd.dy = dy; sheet.style.transform = `translateY(${dy}px)`; sheet.style.borderRadius = `${Math.min(34, dy / 4)}px`; return dy > 4; };
  const dragEnd = () => {
    if (!dd) return; const v = dd.dy / Math.max(1, performance.now() - dd.t); const dy = dd.dy; dd = null;
    if (dy > 140 || (v > .6 && dy > 40)) hide(false, { slide: true });
    else { sheet.style.transition = 'transform .45s cubic-bezier(.34,1.3,.55,1), border-radius .45s'; sheet.style.transform = ''; sheet.style.borderRadius = ''; setTimeout(() => sheet.style.transition = '', 460); }
  };
  const head = byId('plHead');
  head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dragStart(e.clientY); try { head.setPointerCapture(e.pointerId); } catch (_) {} });
  head.addEventListener('pointermove', e => dragMove(e.clientY));
  head.addEventListener('pointerup', dragEnd); head.addEventListener('pointercancel', dragEnd);
  let ts = null;
  scroller.addEventListener('touchstart', e => { if (scroller.scrollTop <= 0 && !e.target.closest('.vinyl,.seek,.seg')) ts = { y: e.touches[0].clientY, armed: false }; else ts = null; }, { passive: true });
  scroller.addEventListener('touchmove', e => {
    if (!ts) return; const y = e.touches[0].clientY;
    if (!ts.armed) { if (y - ts.y > 6 && scroller.scrollTop <= 0) { ts.armed = true; dragStart(ts.y); } else if (y < ts.y) { ts = null; return; } else return; }
    if (e.cancelable) e.preventDefault(); dragMove(y);
  }, { passive: false });
  scroller.addEventListener('touchend', () => { if (ts?.armed) dragEnd(); ts = null; });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,[contenteditable]')) return;
    if (e.key === ' ' && Player.current && !e.target.closest('button,[role=slider]')) { e.preventDefault(); Player.toggle(); }
    if (e.key === 'Escape' && open && !Sheet.isOpen) hide();
  });

  bus.on('track', () => { render(); syncSpin(true); });
  bus.on('state', state);
  bus.on('time', () => { if (open) tick(); });
  bus.on('library', () => open && render());
  bus.on('airplay', () => open && render());
  bus.on('geo', () => open && render());
  bus.on('offline', () => open && drawDl());
  bus.on('offline-progress', () => open && drawDl());
  bus.on('needs-tap', () => toast('點一下播放鍵繼續'));

  /* When iOS returns to the PWA/Safari from the lock-screen Now Playing card,
     reopen the same full-player surface instead of leaving the listener on a
     stale underlying page. Web apps cannot control the OS artwork tap itself,
     but they can make the return path deterministic once the page is resumed. */
  const RETURN_KEY = 'mt.nowPlayingReturn.v2';
  let returnTimer = 0;
  const markLockReturn = () => {
    if (Player.current && Player.playing) sess.set(RETURN_KEY, { at: Date.now(), track: Player.current.shareId || '' });
  };
  const resumeLockReturn = () => {
    if (!IS_IOS || document.hidden || !Player.current) return;
    const r = sess.get(RETURN_KEY, null);
    if (!r || Date.now() - Number(r.at || 0) >= 12 * 60 * 60 * 1000) return;
    // Do not require the same route or page state: the OS may resume an existing
    // standalone client rather than creating a fresh navigation.
    sess.set(RETURN_KEY, null);
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      if (!open && Player.current && !Sheet.isOpen && !PassSheet.isOpen) show();
    }, 100);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) markLockReturn();
    else resumeLockReturn();
  }, { passive: true });
  window.addEventListener('pagehide', markLockReturn, { passive: true });
  window.addEventListener('pageshow', resumeLockReturn, { passive: true });
  window.addEventListener('focus', resumeLockReturn, { passive: true });

  return { show, hide, get isOpen() { return open; }, consumeHistoryClose() { const c = closingViaUI; closingViaUI = false; return c; } };
})();

/* manage a downloaded song */
function offlineSheet(t) {
  Sheet.open({
    title: '已存在這台裝置', sub: t.title,
    html: `<p class="sheet-note">${STANDALONE ? '主畫面 App 會保留這首，沒有網路也能播放。' : '在 Safari 裡，太久沒開的網站資料可能被清除。加入主畫面後，下載的歌會穩定保留。'}</p>
      <div class="menu"><button type="button" data-a="lib">${icon('library')}查看所有下載</button><button type="button" class="is-danger" data-a="rm">${icon('trash')}從這台裝置移除</button></div>`,
    mount(b, s) {
      $('[data-a=rm]', b).onclick = async () => { await Offline.remove(t); s.close(); toast('已從這台裝置移除'); };
      $('[data-a=lib]', b).onclick = () => { s.close(); navFromPlayer('library', {}); bus.emit('library-show-offline'); };
    }
  });
}
