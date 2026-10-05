/* ==========================================================================
   Shell · router, top bar, dock (tab bar + mini player), sheets, rows
   ========================================================================== */
const setAccent = (el, th) => {
  const s = el.style;
  if (!th) { s.removeProperty('--accent'); s.removeProperty('--accent-ink'); s.removeProperty('--wash'); return; }
  s.setProperty('--accent', th.accent); s.setProperty('--accent-ink', th.ink);
  s.setProperty('--wash', `color-mix(in srgb, ${th.accent} 14%, white)`);
};
const accentStyle = th => th ? `--accent:${th.accent};--accent-ink:${th.ink};--wash:color-mix(in srgb, ${th.accent} 14%, white)` : '';

/* ---------- segmented control with sliding glass thumb (draggable) ---------- */
function Seg(host, { items, value, onChange, label = '', draggable = true }) {
  host.classList.add('seg'); host.setAttribute('role', 'tablist'); if (label) host.setAttribute('aria-label', label);
  host.innerHTML = `<i class="seg__thumb" aria-hidden="true"></i>` + items.map(it => `<button class="seg__btn" type="button" role="tab" data-k="${esc(it.key)}" aria-selected="${it.key === value}">${it.html || esc(it.label)}</button>`).join('');
  const thumb = host.firstElementChild; const btns = $$('.seg__btn', host);
  let cur = value;
  const place = (k, instant) => {
    const b = btns.find(x => x.dataset.k === String(k)) || btns[0]; if (!b) return;
    if (instant) thumb.style.transition = 'none';
    thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = `translateX(${b.offsetLeft}px)`;
    if (instant) { void thumb.offsetWidth; thumb.style.transition = ''; }
  };
  const set = (k, fire = true) => {
    cur = k; btns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === String(k)))); place(k);
    if (fire) { haptic(); onChange && onChange(k); }
  };
  host.addEventListener('click', e => { const b = e.target.closest('.seg__btn'); if (!b || b.dataset.k === String(cur)) return; set(b.dataset.k); });
  // drag the thumb like a liquid lens (optional; some controls are tap-only)
  let drag = null;
  if (draggable) {
    host.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button) return; drag = { x: e.clientX, moved: false, id: e.pointerId }; });
    host.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 8) return;
      if (!drag.moved) { drag.moved = true; host.classList.add('is-dragging'); try { host.setPointerCapture(drag.id); } catch (_) {} }
      const r = host.getBoundingClientRect(); const w = thumb.offsetWidth;
      const x = clamp(e.clientX - r.left - w / 2, 4, r.width - w - 4);
      thumb.style.transform = `translateX(${x}px) scale(1.06)`;
    });
    const end = e => {
      if (!drag) return; const was = drag.moved; drag = null; host.classList.remove('is-dragging');
      if (!was) return;
      const r = host.getBoundingClientRect(); const x = e.clientX - r.left;
      const b = btns.reduce((best, b) => Math.abs(b.offsetLeft + b.offsetWidth / 2 - x) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - x) ? b : best, btns[0]);
      if (b.dataset.k !== String(cur)) set(b.dataset.k); else place(cur);
      host.addEventListener('click', ev => ev.stopPropagation(), { capture: true, once: true });
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', () => { drag = null; host.classList.remove('is-dragging'); place(cur); });
  }
  new ResizeObserver(() => place(cur, true)).observe(host);
  requestAnimationFrame(() => place(cur, true));
  return { set, get value() { return cur; } };
}

/* ---------- router (real history: iOS swipe-back works) ---------- */
const TABS = ['home', 'cities', 'search', 'library'];
const Router = (() => {
  let view = null, params = {}, lastTab = 'home', animatePop = false;
  const renderers = {};
  try { history.scrollRestoration = 'manual'; } catch (_) {}
  function urlFor(v, p) {
    const u = new URL(location.href); u.search = ''; u.hash = '';
    if (v === 'theme' && p.slug) u.searchParams.set('theme', p.slug);
    else if (v === 'reader' && p.slug) u.searchParams.set('read', p.slug);
    else if (v !== 'home') u.searchParams.set('tab', v);
    return u.pathname + u.search;
  }
  function motionFor(prev, next, explicit = null) {
    if (explicit) return explicit;
    if (!prev || prev === next) return 'fade';
    const a = TABS.indexOf(prev), b = TABS.indexOf(next);
    if (a >= 0 && b >= 0) return b > a ? 'next' : 'prev';
    if (next === 'theme' || next === 'reader') return 'forward';
    if (prev === 'theme' || prev === 'reader') return 'back';
    return 'fade';
  }
  function show(v, p = {}, { enter = true, direction = null } = {}) {
    if (!renderers[v]) v = 'home';
    const prev = view, dir = motionFor(prev, v, direction);
    view = v; params = p;
    if (TABS.includes(v)) lastTab = v;
    const el = byId('view-' + v);
    const render = () => {
      $('.view').forEach(s => { s.hidden = s.dataset.view !== v; });
      renderers[v](el, p, prev);
      Shell.onView(v, p);
      bus.emit('view', { v, p });
    };
    /* Keep page geometry untouched: animate only the entering view itself.
       Native View Transition snapshots can reposition complex fixed/sticky UI on iOS. */
    render();
    if (enter && dir !== 'none' && !REDUCE) {
      const cls = dir === 'next' ? 'is-enter-next' : dir === 'prev' ? 'is-enter-prev' : dir === 'back' ? 'is-enter-back' : dir === 'fade' ? 'is-enter-fade' : 'is-enter-forward';
      el.classList.remove('is-entering','is-enter-next','is-enter-prev','is-enter-forward','is-enter-back','is-enter-fade');
      void el.offsetWidth;
      el.classList.add('is-entering', cls);
      el.addEventListener('animationend', function done(ev) {
        if (ev.target === el) {
          el.classList.remove('is-entering','is-enter-next','is-enter-prev','is-enter-forward','is-enter-back','is-enter-fade');
          el.removeEventListener('animationend', done);
        }
      });
    }
  }
  function go(v, p = {}, { replace = false } = {}) {
    try { history.replaceState(Object.assign({}, history.state, { v: view, p: params, y: window.scrollY }), ''); } catch (_) {}
    show(v, p);
    const st = { v, p, y: 0 };
    try { replace ? history.replaceState(st, '', urlFor(v, p)) : history.pushState(st, '', urlFor(v, p)); } catch (_) {}
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', e => {
    if (PlayerUI.consumeHistoryClose()) return;
    const s = e.state;
    if (PlayerUI.isOpen) { PlayerUI.hide(true); if (s && s.v === view && JSON.stringify(s.p || {}) === JSON.stringify(params || {})) return; }
    if (!s || !s.v) { show('home', {}); window.scrollTo(0, 0); return; }
    show(s.v, s.p || {}, { enter: animatePop, direction: animatePop ? 'back' : 'none' });
    animatePop = false;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, s.y || 0)));
  });
  return {
    register(v, fn) { renderers[v] = fn; },
    go, show,
    back() { if (history.length > 1 && history.state && history.state.v) { animatePop = true; history.back(); } else go(lastTab); },
    start() {
      const q = new URLSearchParams(location.search);
      const th = themeBySlug(q.get('theme')) || THEME_BY_SLUG.get(norm(q.get('theme')).replace(/\s+/g, '-'));
      const read = q.get('read'); let v = 'home', p = {};
      if (read && Reader.has(read)) { v = 'reader'; p = { slug: read }; }
      else if (th) { v = 'theme'; p = { slug: th.slug }; }
      else if (TABS.includes(q.get('tab'))) v = q.get('tab');
      show(v, p, { enter: false });
      try { history.replaceState({ v, p, y: 0 }, '', urlFor(v, p) + location.hash); } catch (_) {}
    },
    get view() { return view; }, get params() { return params; }, get lastTab() { return lastTab; }
  };
})();

/* ---------- shell: top bar + dock ---------- */
const Shell = (() => {
  const tb = byId('topbar'), tbLeft = byId('tbLeft'), tbRight = byId('tbRight'), tbPage = byId('tbPage');
  const tabbar = byId('tabbar'), lens = byId('tabLens'), lensTrack = byId('tabLensTrack');
  const tabs = $$('.tab', tabbar);
  let leftMode = null, rightMode = null;

  function setLeft(mode) {
    if (leftMode === mode) return; leftMode = mode;
    tbLeft.innerHTML = mode === 'back' ? icon('back') : globeMark();
    tbLeft.setAttribute('aria-label', mode === 'back' ? '返回' : 'CITYMUS 首頁');
  }
  function setRight(mode) {
    if (rightMode === mode) return; rightMode = mode; tbRight.dataset.mode = mode;
    tbRight.innerHTML = (mode === 'share' ? icon('share') : icon('ticket')) + '<i class="tb-dot"></i>';
    tbRight.setAttribute('aria-label', mode === 'share' ? '分享' : 'City Pass 票根');
  }
  setLeft('home'); setRight('pass');
  tbLeft.addEventListener('click', () => { haptic(); if (leftMode === 'back') Router.back(); else if (Router.view !== 'home') Router.go('home'); else window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); });
  tbRight.addEventListener('click', () => { haptic(); bus.emit(rightMode === 'share' ? 'share-current' : 'open-pass'); });

  /* tab bar with the liquid lens */
  function lensTo(i, instant) {
    const t = tabs[i]; if (!t) return;
    const w = t.offsetWidth, x = t.offsetLeft;
    if (instant) { lens.style.transition = 'none'; lensTrack.style.transition = 'none'; }
    lens.style.width = w + 'px'; lens.style.transform = `translateX(${x}px)`;
    lensTrack.style.width = tabbar.clientWidth + 'px'; lensTrack.style.transform = `translateX(${-x}px)`;
    tabs.forEach((b, j) => b.style.opacity = j === i ? '0' : '');
    if (instant) { void lens.offsetWidth; lens.style.transition = ''; lensTrack.style.transition = ''; }
  }
  function selectTab(name) {
    const i = TABS.indexOf(name); tabs.forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) lensTo(i);
  }
  tabs.forEach(t => { if (!t.querySelector('svg')) t.insertAdjacentHTML('afterbegin', icon(t.dataset.icon)); });
  lensTrack.innerHTML = tabs.map(t => `<span>${t.innerHTML}</span>`).join('');
  let drag = null, holdT = null;
  tabbar.addEventListener('pointerdown', e => {
    if (document.documentElement.classList.contains('dock-compact')) return;
    drag = { x: e.clientX, id: e.pointerId, moved: false };
    holdT = setTimeout(() => { if (drag) { tabbar.classList.add('is-holding'); lens.style.transform += ' scale(1.1)'; haptic(); } }, 260);
  });
  tabbar.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; tabbar.classList.add('is-dragging'); try { tabbar.setPointerCapture(drag.id); } catch (_) {} }
    const r = tabbar.getBoundingClientRect(), w = lens.offsetWidth;
    const x = clamp(e.clientX - r.left - w / 2, 4, r.width - w - 4);
    lens.style.transform = `translateX(${x}px) scale(1.12, 1.06)`; lensTrack.style.transform = `translateX(${-x}px)`;
    tabs.forEach(b => { const c = b.offsetLeft + b.offsetWidth / 2; b.style.opacity = Math.abs(c - (x + w / 2)) < w * .5 ? '0' : ''; });
  });
  const endDrag = e => {
    clearTimeout(holdT); tabbar.classList.remove('is-holding');
    if (!drag) return; const d = drag; drag = null; tabbar.classList.remove('is-dragging');
    if (!d.moved) { const b = e.target.closest('.tab'); if (b) { haptic(); goTab(b.dataset.tab); } else lensTo(TABS.indexOf(Router.lastTab)); return; }
    const r = tabbar.getBoundingClientRect(), x = e.clientX - r.left;
    const i = tabs.reduce((bi, b, j) => Math.abs(b.offsetLeft + b.offsetWidth / 2 - x) < Math.abs(tabs[bi].offsetLeft + tabs[bi].offsetWidth / 2 - x) ? j : bi, 0);
    haptic(); goTab(TABS[i]);
  };
  tabbar.addEventListener('pointerup', endDrag);
  tabbar.addEventListener('pointercancel', () => { clearTimeout(holdT); drag = null; tabbar.classList.remove('is-dragging', 'is-holding'); lensTo(TABS.indexOf(Router.lastTab)); });
  tabbar.addEventListener('click', e => { if (document.documentElement.classList.contains('dock-compact')) { e.preventDefault(); setCompact(false); } });
  tabbar.addEventListener('keydown', e => { const b = e.target.closest('.tab'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goTab(b.dataset.tab); } });
  function goTab(name) {
    selectTab(name); setCompact(false);
    if (Router.view === name) { window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); if (name === 'search') bus.emit('focus-search'); return; }
    Router.go(name);
  }
  new ResizeObserver(() => lensTo(Math.max(0, TABS.indexOf(Router.lastTab)), true)).observe(tabbar);

  /* compact dock + large-title collapse while scrolling */
  let lastY = 0, compact = false, ticking = false;
  function setCompact(on) { if (compact === on) return; compact = on; document.documentElement.classList.toggle('dock-compact', on); if (!on) requestAnimationFrame(() => lensTo(Math.max(0, TABS.indexOf(Router.lastTab)), true)); }
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; if (scrollLock.locked) return;
      const y = window.scrollY, d = y - lastY; lastY = y;
      if (y < 80) setCompact(false); else if (d > 8) setCompact(true); else if (d < -10) setCompact(false);
      const title = byId('destTitle');
      tb.classList.toggle('show-page', !!title && Router.view === 'theme' && title.getBoundingClientRect().bottom < (parseFloat(getComputedStyle(tb).paddingTop) + 60));
    });
  }, { passive: true });

  function onView(v, p) {
    setCompact(false); tb.classList.remove('show-page');
    document.documentElement.classList.toggle('is-reader', v === 'reader');
    if (v === 'theme') { setLeft('back'); setRight('share'); const th = themeBySlug(p.slug); tbPage.textContent = th ? th.name : ''; selectTab(Router.lastTab); }
    else if (v === 'reader') { setLeft('back'); setRight('share'); const b = Reader.get(p.slug); tbPage.textContent = b ? b.title : 'Reader'; selectTab(Router.lastTab); }
    else { setLeft('home'); setRight('pass'); tbPage.textContent = ''; selectTab(v); }
    const th = v === 'theme' ? themeBySlug(p.slug) : null;
    setAccent(document.documentElement, th || (Player.current ? themeOf(Player.current) : null));
    const meta = $('meta[name=theme-color]'); if (meta) meta.content = '#F5F6FA';
  }
  return { onView, setCompact, selectTab, lensTo };
})();

/* ---------- mini player ---------- */
const Mini = (() => {
  const box = byId('mini'), title = byId('miniTitle'), subEl = byId('miniSub'), play = byId('miniPlay'), nextB = byId('miniNext'), disc = byId('miniDisc'), prog = byId('miniProg');
  play.innerHTML = icon('play'); nextB.innerHTML = icon('next');
  const spin = disc.animate ? disc.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 9000, iterations: Infinity }) : null;
  spin && spin.pause();
  function render() {
    const t = Player.current; document.documentElement.classList.toggle('has-mini', !!t);
    if (!t) return;
    const th = themeOf(t);
    title.textContent = t.title || 'CITYMUS'; subEl.textContent = `${t.artist || ''}${th ? ' · ' + th.name : ''}`;
    setAccent(box, th);
  }
  function state() {
    const on = Player.playing;
    play.innerHTML = icon(on ? 'pause' : 'play'); play.setAttribute('aria-label', on ? '暫停' : '播放');
    if (spin) on ? spin.play() : spin.pause();
    loop();
  }
  let rafOn = false, miniLastPaint = 0;
  const miniFrameMs = 1000 / (typeof PERF_PROFILE !== 'undefined' ? PERF_PROFILE.progressFps : 60);
  function loop() {
    if (rafOn) return; rafOn = true;
    const f = now => {
      if (now - miniLastPaint >= miniFrameMs) {
        miniLastPaint = now;
        const { cur, dur } = Player.time; prog.firstElementChild.style.transform = `scaleX(${dur ? clamp(cur / dur, 0, 1) : 0})`;
      }
      if (Player.playing && !document.hidden) requestAnimationFrame(f); else rafOn = false;
    };
    requestAnimationFrame(f);
  }
  byId('miniOpen').addEventListener('click', () => { haptic(); PlayerUI.show({ from: 'mini' }); });
  play.addEventListener('click', e => { e.stopPropagation(); haptic(); Player.toggle(); });
  nextB.addEventListener('click', e => { e.stopPropagation(); Player.next(); });
  // Mini-player gestures must never fight iPhone system navigation.
  // Horizontal touch swipes used to skip tracks, but iOS app/page switching can
  // deliver the same pointer sequence to the page and accidentally change song.
  // Keep horizontal skip only for a precise mouse/trackpad pointer; touch gets
  // the explicit Next button and a vertical swipe-up to open Now Playing.
  let sx = null;
  box.addEventListener('pointerdown', e => {
    sx = { x: e.clientX, y: e.clientY, t: performance.now(), pointerType: e.pointerType || 'touch' };
  });
  box.addEventListener('pointercancel', () => { sx = null; });
  box.addEventListener('pointerup', e => {
    if (!sx) return;
    const g = sx; sx = null;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, dt = performance.now() - g.t;
    if (g.pointerType === 'mouse' && Math.abs(dx) > 80 && Math.abs(dy) < 24 && dt < 420) {
      e.preventDefault();
      dx < 0 ? Player.next() : Player.prev();
      box.addEventListener('click', ev => ev.stopPropagation(), { capture: true, once: true });
      return;
    }
    if (Math.abs(dx) < 28 && dy < -52 && dt < 500) PlayerUI.show({ from: 'mini' });
  });
  bus.on('track', render); bus.on('state', state); bus.on('time', loop);
  return { render, get discEl() { return disc; }, get el() { return box; } };
})();

/* ---------- bottom sheets ---------- */
const Sheet = (() => {
  const root = byId('sheetRoot'); let api = null, closeT = null;
  function open({ title = '', sub = '', html = '', mount = null, accent = null, label = '' }) {
    clearTimeout(closeT);
    const wasOpen = !!api;
    root.innerHTML = `<div class="sheet-scrim"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || title)}" style="${accentStyle(accent)}"><div class="sheet__grab"><i></i></div><header class="sheet__head"><div>${title ? `<h2>${esc(title)}</h2>` : ''}${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="icon-btn icon-btn--quiet icon-btn--sm" type="button" data-close aria-label="關閉">${icon('close')}</button></header><div class="sheet__body">${html}</div></section>`;
    const sheet = $('.sheet', root), body = $('.sheet__body', root);
    if (!wasOpen) scrollLock.lock();
    api = { close, body, sheet };
    root.querySelector('.sheet-scrim').addEventListener('click', close);
    root.querySelector('[data-close]').addEventListener('click', close);
    // drag to dismiss
    let d = null;
    const startDrag = e => { d = { y: e.clientY, t: performance.now(), id: e.pointerId }; sheet.style.transition = 'none'; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    const moveDrag = e => { if (!d) return; const dy = Math.max(0, e.clientY - d.y); sheet.style.transform = `translateY(${dy}px)`; };
    const endDrag = e => { if (!d) return; const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t); d = null; sheet.style.transition = ''; if (dy > 110 || v > .7) close(); else sheet.style.transform = ''; };
    [$('.sheet__grab', root), $('.sheet__head', root)].forEach(h => { h.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; startDrag(e); }); h.addEventListener('pointermove', moveDrag); h.addEventListener('pointerup', endDrag); h.addEventListener('pointercancel', endDrag); });
    if (mount) mount(body, api);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
    setTimeout(() => { const f = body.querySelector('[autofocus]'); if (f) f.focus(); }, 380);
    return api;
  }
  function close() {
    if (!api) return; api = null; root.classList.remove('is-open'); scrollLock.unlock();
    closeT = setTimeout(() => { if (!api) root.innerHTML = ''; }, 480);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && api) close(); });
  return { open, close, get isOpen() { return !!api; } };
})();

/* ---------- track rows (shared by every list) ---------- */
function rowHTML(t, i, { num = null, radio = false, removable = false } = {}) {
  const fav = Library.isFav(t), dis = Dislikes.has(t), cur = Player.current && trackKey(Player.current) === trackKey(t);
  const th = themeOf(t);
  const sub = t.composerCn && !radio ? [t.note, t.composerCn].filter(Boolean).join(' · ') : [t.artist, radio && th ? (th.kind === 'literature' ? th.cn : th.name) : (t.note || shortVibe(t))].filter(Boolean).join(' · ');
  const off = !t.localPersonal && typeof Offline !== 'undefined' && Offline.has(t);
  return `<div class="row${cur ? ' is-current' : ''}${dis ? ' is-disliked' : ''}${radio ? ' row--radio' : ''}" role="button" tabindex="0" data-i="${i}" data-k="${esc(trackKey(t))}" aria-label="播放 ${esc(t.title)}">
    <span class="row__no">${cur ? '<span class="eq"><i></i><i></i><i></i></span>' : (num ?? pad2(i + 1))}</span>
    <span class="row__main"><b class="row__title">${esc(t.title || 'Untitled')}</b><span class="row__sub">${off ? `<i class="row__off" title="已存在這台裝置">${icon('downloaded')}</i>` : ''}${esc(sub)}</span></span>
    <span class="row__actions">${removable ? `<button class="icon-btn" type="button" data-act="remove" aria-label="從佇列移除">${icon('minus')}</button>` : ''}${t.localPersonal ? '' : `<button class="icon-btn${fav ? ' is-fav' : ''}" type="button" data-act="fav" aria-pressed="${fav}" aria-label="${fav ? '從收藏移除' : '加入收藏'}">${icon(fav ? 'heartFill' : 'heart')}</button>`}<button class="icon-btn" type="button" data-act="more" aria-label="更多選項">${icon('more')}</button></span>
  </div>`;
}
/* wire a list container: tracks array lives on the element */
function bindRows(el, getTracks, onPlay) {
  if (el._bound) return; el._bound = true;
  const resolveRow = e => { const row = e.target.closest('.row'); if (!row || !el.contains(row)) return null; const t = getTracks()[Number(row.dataset.i)]; return t ? { row, t, i: Number(row.dataset.i) } : null; };
  el.addEventListener('click', e => {
    const r = resolveRow(e); if (!r) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fav') { e.stopPropagation(); toggleFav(r.t, e.target.closest('[data-act=fav]')); return; }
    if (act === 'more') { e.stopPropagation(); trackSheet(r.t); return; }
    if (act === 'remove') { e.stopPropagation(); bus.emit('row-remove', r.i); return; }
    haptic(); onPlay(r.t, r.i);
  });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('row')) { e.preventDefault(); const r = resolveRow(e); if (r) onPlay(r.t, r.i); } });
}
function toggleFav(t, sourceEl = null) {
  const on = Library.toggle(t); haptic(on ? 'success' : 'light');
  if (sourceEl) actionBurst(sourceEl, on ? 'heart' : 'spark', on ? '已收藏' : '已取消收藏');
  toast(on ? `已收藏到 ${Library.active().name}` : `已從 ${Library.active().name} 移除`);
}
function refreshRows() {
  const ck = Player.current ? trackKey(Player.current) : '';
  $$('.row[data-k]').forEach(r => {
    const on = r.dataset.k === ck;
    if (on !== r.classList.contains('is-current')) {
      r.classList.toggle('is-current', on);
      const no = r.querySelector('.row__no');
      if (no) no.innerHTML = on ? '<span class="eq"><i></i><i></i><i></i></span>' : pad2(Number(r.dataset.i) + 1);
    }
  });
  document.documentElement.classList.toggle('is-paused', !Player.playing);
}
function refreshFavButtons() {
  $$('.row[data-k] [data-act=fav]').forEach(b => {
    const k = b.closest('.row').dataset.k; const t = trackFromKey(k); if (!t) return;
    const on = Library.isFav(t); b.classList.toggle('is-fav', on); b.setAttribute('aria-pressed', on); b.innerHTML = icon(on ? 'heartFill' : 'heart');
  });
}
function trackFromKey(k) { if (k.startsWith('id:')) return TRACK_BY_SHARE.get(k.slice(3)); return null; }
bus.on('track', refreshRows); bus.on('state', refreshRows); bus.on('library', refreshFavButtons);
bus.on('dislikes', () => $$('.row[data-k]').forEach(r => { const t = trackFromKey(r.dataset.k); if (t) r.classList.toggle('is-disliked', Dislikes.has(t)); }));

/* leaving the player for a page replaces the player's history entry */
function navFromPlayer(v, p) {
  if (PlayerUI.isOpen) { const rep = !!(history.state && history.state.player); PlayerUI.hide(true); Router.go(v, p, { replace: rep }); }
  else Router.go(v, p);
}
/* ---------- the ⋯ sheet for any song ---------- */
function trackSheet(t) {
  const th = themeOf(t); const dis = Dislikes.has(t);
  const src = t.source && /^https?:/.test(t.source) ? t.source : '';
  const lic = String(t.license || '').trim();
  const showLic = !!lic && !/^(?:CC0|Public Domain|Public Domain Mark|PDM|PD\b)/i.test(lic);
  const attribution = String(t.attribution || '').trim();
  const off = !t.localPersonal && Offline.supported, has = off && Offline.has(t);
  const thName = th ? (th.kind === 'literature' ? th.cn : th.name) : '';
  Sheet.open({
    accent: th, label: t.title,
    html: `<div class="sheet-track"><span class="sheet-track__art" id="stArt">${esc(th?.code || 'MT')}</span><div><b>${esc(t.title)}</b><span>${esc([t.artist, t.note].filter(Boolean).join(' · '))}${thName ? ' · ' + esc(thName) : ''}</span></div></div>
    <div class="menu">
      <button type="button" data-a="next">${icon('queue')}下一首播放</button>
      <button type="button" data-a="queue">${icon('list')}加入播放佇列</button>
      ${t.localPersonal ? '' : `<button type="button" data-a="lib">${icon('listAdd')}加入播放清單⋯</button>`}
      ${t.shareId ? `<button type="button" data-a="share">${icon('share')}分享這首歌</button>` : ''}
      ${off ? `<button type="button" data-a="dl">${icon(has ? 'downloaded' : 'download')}${has ? '已存在這台裝置 · 移除' : '存到這台裝置'}</button>` : ''}
      ${th ? `<button type="button" data-a="go">${icon(th.kind === 'literature' ? 'book' : 'globe')}前往 ${esc(thName)}</button>` : ''}
      <button type="button" data-a="radio">${icon('radio')}從這首開始電台</button>
      ${t.localPersonal ? '' : `<button type="button" data-a="dislike">${icon('ban')}${dis ? '取消「不適合我」' : '不適合我 · 自動略過'}</button>`}
      ${src ? `<a href="${esc(src)}" target="_blank" rel="noopener" data-a="src">${icon('source')}來源 · ${esc(lic || '授權來源')}</a>` : ''}
      ${attribution ? `<div class="menu__note">授權標示 · ${esc(attribution)}</div>` : ''}
    </div>`,
    mount(body, s) {
      Artwork.cover(t, 160).then(u => { const a = $('#stArt', body); if (u && a) { a.style.backgroundImage = `url(${u})`; a.textContent = ''; } });
      body.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a || a === 'src') return;
        if (a === 'next') { Player.playNext(t); s.close(); }
        else if (a === 'queue') { Player.addToQueue(t); s.close(); }
        else if (a === 'dl') { s.close(); if (Offline.has(t)) Offline.remove(t).then(() => toast('已從這台裝置移除')); else Offline.download(t).then(ok => ok && toast('已存到這台裝置')); }
        else if (a === 'lib') libraryPicker(t);
        else if (a === 'go') { s.close(); navFromPlayer('theme', { slug: th.slug }); }
        else if (a === 'radio') { s.close(); const list = [t, ...Reco.radio(t, 14)]; Player.playList(list, 0, { kind: 'radio', title: `${t.title} 電台` }); }
        else if (a === 'dislike') { const on = Dislikes.toggle(t); toast(on ? '之後自動播放會略過這首' : '已取消'); s.close(); }
        else if (a === 'share') { actionBurst(e.target.closest('[data-a]'), 'share', '分享'); setTimeout(()=>s.close(),120); Share.track(t); }
      });
    }
  });
}
function libraryPicker(t) {
  const libs = Library.all();
  Sheet.open({
    title: '加入播放清單', sub: t.title,
    html: `<div class="menu">${libs.map(l => { const has = new Set(l.keys).has(trackKey(t)); return `<button type="button" data-lib="${esc(l.id)}">${icon(has ? 'check' : 'library')}<span style="flex:1">${esc(l.name)}</span><small style="color:var(--ink-3)">${l.keys.length}</small></button>`; }).join('')}<button type="button" data-lib="__new">${icon('plus')}新增播放清單⋯</button></div>`,
    mount(body, s) {
      body.addEventListener('click', e => {
        const id = e.target.closest('[data-lib]')?.dataset.lib; if (!id) return;
        if (id === '__new') { libraryCreator({ seed: [t] }); return; }
        const b=e.target.closest('[data-lib]'); const on = Library.toggle(t, id); const libName=Library.all().find(l => l.id === id)?.name || '收藏庫'; actionBurst(b, on ? 'library' : 'spark', on ? `已加入 ${libName}` : '已移除'); toast(on ? `已加入 ${libName}` : '已移除'); setTimeout(()=>s.close(), on ? 320 : 100);
      });
    }
  });
}
/* new library: a name, plus categories to start from (seeded by the recommender) */
function libraryCreator({ seed = [] } = {}) {
  const picked = new Set(); let per = 8;
  const groupsHTML = GROUPS.map(g => `<div class="picker__group"><small>${esc(g.label)}</small><div class="picker__chips">${g.names.map(n => THEME_BY_T.get(n)).filter(Boolean).map(th => `<button class="pchip" type="button" data-t="${esc(th.t)}" aria-pressed="false"><b>${esc(th.kind === 'literature' ? th.cn : th.name)}</b><span>${esc(th.kind === 'literature' ? th.authorCn : th.cn)}</span></button>`).join('')}</div></div>`).join('');
  Sheet.open({
    title: '新增播放清單', sub: '取個名字，再選幾個分類當作起點；也可以從空白開始。',
    html: `<input class="field" id="lcName" type="text" maxlength="40" autocomplete="off" placeholder="例如：雨天的台北">
      <div class="picker">${groupsHTML}</div>
      <div class="setting setting--plain"><div><b>每個分類放入</b><span id="lcSum">還沒選分類 · 會建立空白清單</span></div><div id="lcPer"></div></div>
      <div class="sheet-actions sheet-actions--2"><button class="btn" type="button" data-x>取消</button><button class="btn btn--primary" type="button" data-ok>建立</button></div>`,
    mount(body, s) {
      const f = $('#lcName', body);
      const sum = () => { const n = picked.size; $('#lcSum', body).textContent = n ? `${n} 個分類 · 約 ${n * per + seed.length} 首` : (seed.length ? `從這首開始 · 之後再慢慢加` : '還沒選分類 · 會建立空白清單'); };
      Seg($('#lcPer', body), { label: '每個分類', value: String(per), items: [{ key: '5', label: '5' }, { key: '8', label: '8' }, { key: '15', label: '15' }, { key: '50', label: '全部' }], onChange: k => { per = Number(k); sum(); } });
      body.querySelector('.picker').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; const on = !picked.has(b.dataset.t); on ? picked.add(b.dataset.t) : picked.delete(b.dataset.t); b.setAttribute('aria-pressed', String(on)); haptic(); if (!f.value.trim() && picked.size === 1) f.placeholder = THEME_BY_T.get([...picked][0])?.cn || f.placeholder; sum(); });
      const ok = () => {
        const cats = [...picked]; let name = Library.clean(f.value) || (cats.length === 1 ? (THEME_BY_T.get(cats[0])?.cn || '') : '') || (seed[0] ? seed[0].title : '') || 'NEW PLAYLIST';
        const tracks = [...seed]; cats.forEach(tn => { const th = THEME_BY_T.get(tn); if (!th) return; const pool = per >= 50 ? th.tracks : Reco.drawFive(th).concat(th.tracks.filter(t => !tracks.includes(t))).slice(0, per); pool.forEach(t => { if (!tracks.includes(t)) tracks.push(t); }); });
        const l = Library.create(name, tracks.map(trackKey), true, cats); s.close(); haptic('success');
        toast(tracks.length ? `已建立「${l.name}」 · ${tracks.length} 首` : `已建立「${l.name}」`);
        if (Router.view !== 'library' && !PlayerUI.isOpen) Router.go('library');
      };
      $('[data-ok]', body).onclick = ok; $('[data-x]', body).onclick = s.close;
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); f.blur(); } });
      sum();
    }
  });
}
function nameSheet(initial, done, { title = '新增收藏', cta = '建立' } = {}) {
  Sheet.open({
    title, sub: '名稱只會存在這台裝置上。',
    html: `<input class="field" id="nameField" type="text" maxlength="40" autocomplete="off" placeholder="例如：雨天的台北" value="${esc(initial)}" autofocus><div class="sheet-actions sheet-actions--2"><button class="btn" type="button" data-x>取消</button><button class="btn btn--primary" type="button" data-ok>${esc(cta)}</button></div>`,
    mount(body, s) {
      const f = $('#nameField', body);
      const ok = () => { const v = Library.clean(f.value); if (!v) { f.focus(); return; } s.close(); done(v); };
      $('[data-ok]', body).onclick = ok; $('[data-x]', body).onclick = s.close;
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    }
  });
}
