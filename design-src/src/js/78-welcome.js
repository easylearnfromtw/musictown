/* ==========================================================================
   Welcome · skippable, and the city you're in comes first
   ========================================================================== */
const Welcome = (() => {
  const el = byId('welcome'); let tab = 'city', isOpen = false;
  function render() {
    el.innerHTML = `<button class="welcome__skip glass" type="button" data-skip>略過</button>
    <section class="welcome__step is-active" data-step="1">
      <div class="welcome__globe">${globeMark()}</div>
      <p class="welcome__word">CITYMUS</p>
      <h1 class="welcome__title"><span>Music for</span><span>where you are.</span></h1>
      <p class="welcome__lede">每座城市、每部作品、每種心情，都有一抽屜的聲音。人在當地的時候，還能收下一張只屬於那裡的票根。</p>
      <div class="welcome__cta"><button class="btn btn--primary" type="button" data-next>選一個目的地</button><button class="btn btn--glass" type="button" data-skip>直接進入</button></div>
    </section>
    <section class="welcome__step" data-step="2">
      <h2 class="welcome__h2">先去哪裡？</h2>
      <p class="welcome__sub">選一個開始，之後隨時可以從首頁換。</p>
      <div class="near" id="wNear"></div>
      <div id="wSeg"></div>
      <div class="choices" id="wChoices"></div>
      <p class="welcome__privacy">我們用連線位置估算你所在的城市，只用來排序與開放城市票根，不會儲存你的 IP。</p>
    </section>`;
    el.addEventListener('click', onClick);
    Seg(byId('wSeg'), { label: '分類', value: tab, items: [{ key: 'city', label: '城市' }, { key: 'literature', label: '文學' }, { key: 'style', label: '風格' }, { key: 'mood', label: '心情' }], onChange: k => { tab = k; drawChoices(); } });
    drawNear(); drawChoices();
  }
  function drawNear() {
    const host = byId('wNear'); if (!host) return;
    const th = Geo.theme ? THEME_BY_T.get(Geo.theme) : null;
    if (th) host.innerHTML = `<button class="near__card" type="button" data-slug="${th.slug}"><b>${esc(th.code)}</b><span style="min-width:0"><strong>你在${esc(th.cityCn)} · ${esc(th.name)}</strong><span>城市限定 · 進入就能領取票根</span></span>${icon('chevron')}</button>`;
    else if (!Geo.resolved) host.innerHTML = `<p class="near__status"><i class="dotpulse"></i>正在確認你所在的城市⋯</p>`;
    else host.innerHTML = '';
  }
  function drawChoices() {
    const host = byId('wChoices'); if (!host) return;
    let list = THEMES.filter(t => t.kind === tab && t.tracks.length);
    if (tab === 'city' && Geo.theme) list = list.sort((a, b) => (b.t === Geo.theme) - (a.t === Geo.theme));
    host.innerHTML = list.map(th => `<button class="choice${th.t === Geo.theme ? ' is-here' : ''}" type="button" data-slug="${th.slug}"><em>${esc(th.code)}</em><span><b>${esc(th.kind === 'literature' ? th.cn : th.name)}</b><span>${esc(th.kind === 'literature' ? th.authorCn : th.cn)}${th.kind === 'city' ? ' · ' + esc(localTimeIn(th.tz)) : ''}</span></span></button>`).join('');
  }
  function onClick(e) {
    if (e.target.closest('[data-skip]')) { haptic(); close(); return; }
    if (e.target.closest('[data-next]')) { haptic(); $$('.welcome__step', el).forEach(s => s.classList.toggle('is-active', s.dataset.step === '2')); el.scrollTo(0, 0); return; }
    const c = e.target.closest('[data-slug]'); if (c) { haptic('success'); const slug = c.dataset.slug; close(() => Router.go('theme', { slug })); }
  }
  function open() {
    if (isOpen) return; isOpen = true; el.hidden = false; el.classList.remove('is-leaving'); render(); scrollLock.lock(); Geo.ensure();
  }
  function close(after) {
    if (!isOpen) return; isOpen = false; Settings.set('onboarded', true);
    el.classList.add('is-leaving'); scrollLock.unlock(); after && after();
    setTimeout(() => { el.hidden = true; el.innerHTML = ''; el.removeEventListener('click', onClick); }, 520);
  }
  bus.on('geo', () => { if (isOpen) { drawNear(); drawChoices(); } });
  return { open, close, get isOpen() { return isOpen; } };
})();

/* ==========================================================================
   Ritual · Bluetooth audio route (from the native iOS shell) + output info
   Contract kept: window event `musicetown:bluetooth-audio`,
   webkit.messageHandlers.musicetownReady, ?previewAudioLink=1
   ========================================================================== */
const Ritual = (() => {
  const el = byId('ritual'); let connected = false, timer = null;
  function open({ auto = false, preview = false } = {}) {
    const t = Player.current, th = t ? themeOf(t) : null;
    setAccent(el, th);
    el.innerHTML = `<div class="ritual__scrim"></div><div class="ritual__card glass" role="dialog" aria-label="音訊輸出"><div class="buds"><i class="bud bud--l"></i><i class="buds__ring"></i><i class="buds__ring"></i><i class="bud bud--r"></i></div>
      <h3>${connected || preview ? '耳機已連上' : '音訊輸出'}</h3><p>${connected || preview ? '聲音已切到 Bluetooth 音訊，唱片和耳機現在在同一條線上。' : '輸出裝置由系統管理。在 iPhone 控制中心可以切換 AirPods 或 AirPlay 喇叭。'}</p>
      ${t ? `<div class="ritual__np"><b>${esc(t.title)}</b> · ${esc(t.artist || '')}</div>` : ''}<button class="btn btn--block mt-16" type="button" data-x>完成</button></div>`;
    el.classList.remove('is-open'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
    if (connected || preview) haptic('success');
    el.querySelector('[data-x]').onclick = close; el.querySelector('.ritual__scrim').onclick = close;
    clearTimeout(timer); if (auto) timer = setTimeout(close, 4600);
  }
  function close() { clearTimeout(timer); el.classList.remove('is-open'); setTimeout(() => { if (!el.classList.contains('is-open')) el.innerHTML = ''; }, 500); }
  window.addEventListener('musicetown:bluetooth-audio', e => {
    const d = e?.detail || {}; const was = connected; connected = d.connected === true;
    if (connected && !was) open({ auto: true });
    if (!connected && el.classList.contains('is-open')) close();
  });
  window.addEventListener('load', () => setTimeout(() => { try { window.webkit?.messageHandlers?.musicetownReady?.postMessage({ ready: true }); } catch (_) {} }, 80));
  return { open, close, output: () => open({ auto: false }) };
})();
