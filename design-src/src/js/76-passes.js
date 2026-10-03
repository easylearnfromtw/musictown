/* ==========================================================================
   Geo · approximate city by IP (ipwho.is, IP itself never stored),
   precise check-ins by GPS only when the listener taps "check in".
   ========================================================================== */
const CITY_CENTER = { TPE:[25.0330,121.5654], TNN:[22.9997,120.2270], LXA:[29.6520,91.1721], MLE:[4.1755,73.5093], TYO:[35.6762,139.6503], SHA:[31.2304,121.4737], BJS:[39.9042,116.4074], HKG:[22.3193,114.1694], KYO:[35.0116,135.7681], LYA:[34.6197,112.4540], LON:[51.5072,-0.1276], ROM:[41.9028,12.4964], PAR:[48.8566,2.3522], DXB:[25.2048,55.2708], YVR:[49.2827,-123.1207], NYC:[40.7128,-74.0060], HNL:[21.3099,-157.8581], LAX:[34.0522,-118.2437], SEL:[37.5665,126.9780], KUL:[3.1390,101.6869], MNL:[14.5995,120.9842], BKK:[13.7563,100.5018], BER:[52.5200,13.4050], RTM:[51.9244,4.4777], SYD:[-33.8688,151.2093], CBR:[-35.2809,149.1300], TJK:[39.9965,116.4682], NKG:[32.0603,118.7969] };
const distKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

const Geo = (() => {
  const KEY = 'musicetown.citypass.geo.v1';
  let geo = null, theme = null, promise = null, override = null;
  const cached = sess.get(KEY, null); if (cached && Date.now() - Number(cached.ts || 0) < 6 * 3600e3) { geo = cached; theme = match(geo); }
  function match(g) {
    if (!g) return null; const city = norm(g.city).replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); const cc = String(g.country_code || '').toUpperCase();
    if (!city) return null;
    const th = CITY_THEMES.find(t => t.country === cc && (t.aliases || []).some(a => { const x = norm(a); return city === x || city.includes(x) || x.includes(city); }));
    return th ? th.t : null;
  }
  function ensure() {
    if (geo || promise) return promise || Promise.resolve(geo);
    promise = (async () => {
      try {
        const ac = new AbortController(); setTimeout(() => ac.abort(), 6000);
        const r = await fetch('https://ipwho.is/', { mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ac.signal });
        const raw = await r.json(); if (raw?.success === false) throw new Error('geo');
        geo = { city: String(raw.city || ''), region: String(raw.region || ''), country_code: String(raw.country_code || '').toUpperCase(), ts: Date.now() };
        sess.set(KEY, geo);
      } catch (_) { geo = null; }
      theme = override || match(geo); bus.emit('geo', theme); return geo;
    })();
    return promise;
  }
  function gps() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude, p.coords.accuracy]), e => rej(e), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
  }
  return {
    ensure, gps,
    get theme() { return override || theme; },
    get city() { return override ? THEME_BY_T.get(override)?.city : geo?.city || ''; },
    get resolved() { return !!geo || !!override; },
    confirm(t) { override = t; bus.emit('geo', t); },
    preview(t) { override = t; bus.emit('geo', t); }
  };
})();

/* ==========================================================================
   PassSheet · the ticket surface used by City Pass, Spot Edition,
   Library Pass and every "received" page. One-handed: actions sit in a
   bar at the bottom, the sheet closes with a downward swipe.
   ========================================================================== */
const PassSheet = (() => {
  const root = byId('ticketModal'); let api = null;
  function open({ html, actions = '', accent = null, label = 'CITYMUS pass', mount = null }) {
    if (api) close(true);
    root.innerHTML = `<div class="passsheet__scrim"></div><section class="passsheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" style="${accentStyle(accent)}"><div class="passsheet__scroll">${html}</div>${actions ? `<div class="passsheet__bar">${actions}</div>` : ''}</section>`;
    const sheet = $('.passsheet', root), scroller = $('.passsheet__scroll', root);
    scrollLock.lock(); root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
    api = { close, sheet, root };
    $('.passsheet__scrim', root).onclick = () => close();
    root.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close());
    // swipe down from the top of the sheet to dismiss
    let d = null;
    sheet.addEventListener('touchstart', e => { if (scroller.scrollTop <= 0 && !e.target.closest('button,a,input')) d = { y: e.touches[0].clientY, t: performance.now(), dy: 0 }; else d = null; }, { passive: true });
    sheet.addEventListener('touchmove', e => { if (!d) return; const dy = e.touches[0].clientY - d.y; if (dy <= 0) { d = null; sheet.style.transform = ''; return; } d.dy = dy; if (e.cancelable) e.preventDefault(); sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; }, { passive: false });
    sheet.addEventListener('touchend', () => { if (!d) return; const v = d.dy / Math.max(1, performance.now() - d.t), dy = d.dy; d = null; sheet.style.transition = ''; if (dy > 120 || (v > .6 && dy > 40)) close(); else sheet.style.transform = ''; });
    if (mount) mount(sheet, api);
    return api;
  }
  function close(instant) {
    if (!api) return; api = null;
    root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); scrollLock.unlock();
    const sheet = $('.passsheet', root); if (sheet) sheet.style.transform = '';
    setTimeout(() => { if (!root.classList.contains('is-open')) root.innerHTML = ''; }, instant ? 0 : 460);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && api) close(); });
  /* the top strip of QR codes that drifts right → left (from the R8 ticket) */
  function marquee(url, label) {
    const chip = `<span class="qrchip">${QR.svg(url, { ecl: 'L', fg: '#29465D', border: 1 })}<b>${esc(label)}</b></span>`;
    const run = chip.repeat(4);
    return `<div class="pass__marquee" aria-hidden="true"><div class="pass__track">${run}${run}</div></div>`;
  }
  const head = (kind, right = '') => `<header class="pass__head"><span class="pass__globe">${globeMark()}</span><div class="pass__brand"><b>CITYMUS</b><span>${esc(kind)}</span></div>${right}<button class="pass__x" type="button" data-x aria-label="關閉">${icon('close')}</button></header>`;
  const rows = list => `<ol class="pass__rows">${list.map((t, i) => `<li data-i="${i}"><em>${pad2(i + 1)}</em><span><b>${esc(t.title)}</b><small>${esc(t.artist || '')}</small></span><i>${icon('play')}</i></li>`).join('')}</ol>`;
  return { open, close, marquee, head, rows, get isOpen() { return !!api; } };
})();

/* ==========================================================================
   Pass · City Limited & Spot Edition tickets (the original R8 design)
   ========================================================================== */
const Pass = (() => {
  const today = () => { const d = new Date(); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
  const ticketNo = code => { const d = new Date(); let r = ''; try { const a = new Uint16Array(1); crypto.getRandomValues(a); r = String(a[0] % 10000).padStart(4, '0'); } catch (_) { r = String(Math.floor(Math.random() * 1e4)).padStart(4, '0'); } return `CM-${code}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${r}`; };
  function hot5(th, seed) {
    const withPlays = th.tracks.filter(t => Number(t.plays) > 0);
    if (withPlays.length >= 5) return withPlays.slice().sort((a, b) => b.plays - a.plays).slice(0, 5);
    return seed ? Reco.forLandmark(seed, 5) : (() => { const r = seeded(th.t + 'hot'); return th.tracks.map(t => ({ t, k: r() })).sort((a, b) => a.k - b.k).map(x => x.t).filter((t, i, a) => a.findIndex(y => recKey(y) === recKey(t)) === i).slice(0, 5); })();
  }
  function issueCity(th, how = 'IP') {
    return { id: `city-${th.slug}`, kind: 'city', theme: th.t, code: th.code, title: th.name, city: th.city, cityCn: th.cityCn, where: `${(Geo.city || th.city).toUpperCase()}`, how, no: ticketNo(th.code), issued: today(), localTime: localTimeIn(th.tz), tracks: hot5(th).map(t => t.shareId).filter(Boolean) };
  }
  function issueSpot(lm) {
    const th = THEME_BY_T.get(lm.theme), code = lm.code || th.code;
    return { id: `spot-${lm.id}`, kind: 'spot', theme: th.t, code, title: lm.area || th.name, city: lm.area || th.city, cityCn: lm.areaCn || th.cityCn, area: lm.area || th.name, areaCn: lm.areaCn || th.cityCn, spot: lm.cn, spotEn: lm.name, where: `${lm.lat.toFixed(2)}°, ${lm.lng.toFixed(2)}°`, how: 'GPS', no: ticketNo(code), issued: today(), tracks: Reco.forLandmark(lm, 5).map(t => t.shareId).filter(Boolean) };
  }
  const stateFor = th => !th || th.kind !== 'city' ? 'none' : Wallet.has(`city-${th.slug}`) ? 'owned' : Geo.theme === th.t ? 'ready' : 'locked';

  function openCity(th) {
    const st = stateFor(th);
    if (st === 'owned') return openTicket(Wallet.all().find(x => x.id === `city-${th.slug}`));
    if (st === 'ready') { const tk = issueCity(th); Wallet.add(tk); haptic('success'); return openTicket(tk, { fresh: true }); }
    if (st === 'none') return;
    explainCity(th);
  }
  function explainCity(th) {
    Sheet.open({
      accent: th, title: `${th.cityCn}限定票根`, sub: `${th.name} · City Limited Music Pass`,
      html: `<div class="stubline" style="${accentStyle(th)}"><b>${esc(th.code)}</b><span>只在${esc(th.cityCn)}當地發行</span></div>
        <p class="sheet-note">人在${esc(th.cityCn)}時打開這個目的地，就能收下一張只屬於這座城市的票根，附上當地最常播放的五首歌。城市由連線位置估算；如果你其實就在當地（例如開著 VPN），可以用定位確認。</p>
        <div class="sheet-actions sheet-actions--2"><button class="btn btn--primary" type="button" data-gps aria-label="用定位確認">${icon('location')}定位確認</button><button class="btn" type="button" data-play aria-label="先聽聽 ${esc(th.name)}">${icon('play')}先聽聽</button></div>
        <p class="rights">定位只在這台裝置上比對距離，不會上傳或儲存。</p>`,
      mount(body, s) {
        $('[data-play]', body).onclick = () => { s.close(); Player.playList(Reco.smartShuffle(th.tracks), 0, { kind: 'theme', title: th.name, theme: th.t }); };
        $('[data-gps]', body).onclick = async e => {
          const b = e.currentTarget; b.disabled = true; b.innerHTML = '定位中⋯';
          try {
            const [lat, lng] = await Geo.gps(); const d = distKm([lat, lng], CITY_CENTER[th.code]);
            if (d <= 45) { Geo.confirm(th.t, 'GPS'); s.close(); const tk = issueCity(th, 'GPS'); Wallet.add(tk); haptic('success'); openTicket(tk, { fresh: true }); }
            else { b.disabled = false; b.innerHTML = `${icon('location')}再試一次`; toast(`你距離${th.cityCn}約 ${Math.round(d).toLocaleString()} 公里`); }
          } catch (err) { b.disabled = false; b.innerHTML = `${icon('location')}再試一次`; toast(err?.code === 1 ? '需要允許定位才能確認' : '暫時無法取得定位'); }
        };
      }
    });
  }
  async function checkInSpot(target = null) {
    toast('定位中⋯', { ms: 4000 });
    try {
      const [lat, lng] = await Geo.gps();
      const ranked = LANDMARKS.map(lm => ({ lm, d: distKm([lat, lng], [lm.lat, lm.lng]) * 1000 })).sort((a, b) => a.d - b.d);
      const hit = (target ? ranked.filter(x => x.lm.id === target.id) : ranked).find(x => x.d <= x.lm.r);
      if (hit) {
        const id = `spot-${hit.lm.id}`;
        const tk = Wallet.has(id) ? Wallet.all().find(x => x.id === id) : issueSpot(hit.lm);
        const fresh = Wallet.add(tk); if (fresh) haptic('success');
        const th = THEME_BY_T.get(hit.lm.theme); if (th?.kind === 'city' && (hit.lm.code || th.code) === th.code) Geo.confirm(th.t, 'GPS');
        openTicket(tk, { fresh }); return;
      }
      const near = target ? ranked.find(x => x.lm.id === target.id) : ranked[0];
      const km = near.d / 1000;
      toast(`距離${near.lm.cn}還有 ${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString()} 公里`, { ms: 3200 });
    } catch (err) { toast(err?.code === 1 ? '需要允許定位才能打卡' : '暫時無法取得定位'); }
  }
  const mapsUrl = lm => `https://maps.apple.com/?q=${encodeURIComponent(lm.name)}&ll=${lm.lat},${lm.lng}`;
  function explainSpot(lm) {
    const th = THEME_BY_T.get(lm.theme);
    Sheet.open({
      accent: th, title: lm.cn, sub: `${lm.name} · Spot Edition`,
      html: `<div class="stubline" style="${accentStyle(th)}"><b>${esc(lm.code || th.code)}</b><span>${esc(lm.name)} · ${esc(lm.areaCn || th.cityCn || th.name)}</span></div>
        <p class="sheet-note">走到${esc(lm.cn)}附近（約 ${lm.r >= 1000 ? (lm.r / 1000).toFixed(1) + ' 公里' : lm.r + ' 公尺'}內）打卡，就能收下這個地標的限定票根，附上為這裡挑的五首歌。</p>
        <div class="sheet-actions sheet-actions--3"><button class="btn btn--primary" type="button" data-check aria-label="我在這裡，打卡">${icon('location')}打卡</button><a class="btn" href="${esc(mapsUrl(lm))}" target="_blank" rel="noopener" aria-label="在 Apple 地圖打開">${icon('map')}</a><button class="btn" type="button" data-go aria-label="前往 ${esc(th.name)}">${icon('chevron')}</button></div>`,
      mount(body, s) { $('[data-check]', body).onclick = () => { s.close(); checkInSpot(lm); }; $('[data-go]', body).onclick = () => { s.close(); Router.go('theme', { slug: th.slug }); }; }
    });
  }

  /* ---------- the ticket (R8 layout, restored) ---------- */
  function ticketHTML(tk, { fresh = false } = {}) {
    const th = THEME_BY_T.get(tk.theme); const tracks = (tk.tracks || []).map(id => TRACK_BY_SHARE.get(id)).filter(Boolean);
    const url = shareBase({ theme: th.slug });
    const spot = tk.kind === 'spot';
    const desc = spot ? `${tk.spot}限定。${th.line}` : (th.summary || th.line);
    return `<article class="pass" aria-label="${esc(spot ? tk.spot : th.cityCn)} 票根">
      ${PassSheet.marquee(url, spot ? 'CITYMUS · SPOT LINK' : 'CITYMUS · CITY LINK')}
      <div class="pass__inner">
        ${PassSheet.head(spot ? 'SPOT EDITION MUSIC PASS' : 'CITY LIMITED MUSIC PASS')}
        <div class="pass__code">${esc(tk.code)}</div>
        <p class="pass__eyebrow">${spot ? `SPOT EDITION · ${esc(tk.spotEn.toUpperCase())}` : `CITY EXCLUSIVE · ${tk.how === 'GPS' ? 'GPS MATCH' : 'IP MATCH'}`}</p>
        <h2 class="pass__title">${esc((spot ? (tk.area || tk.city || th.name) : th.name).toUpperCase())}</h2>
        <p class="pass__desc">${esc(desc)}</p>
        <div class="pass__fields"><i class="pass__notch"></i>
          <div><small>PROGRAM</small><b>CITYMUS</b></div>
          <div><small>${spot ? 'SPOT' : 'LOCATION'}</small><b>${esc(spot ? tk.spot : tk.where)}</b></div>
          <div><small>STATUS</small><b>${tk.how === 'GPS' ? 'GPS CHECK-IN' : 'IP CITY MATCH'}</b></div>
          <div><small>TICKET</small><b>${esc(tk.no)}</b></div>
        </div>
        <section class="pass__index">
          <small class="pass__label">LOCAL SOUND INDEX</small>
          <div class="pass__h"><b>${spot ? '為這裡挑的五首' : '熱門音樂 · HOT 5'}</b><span>TOP FIVE</span></div>
          ${PassSheet.rows(tracks)}
        </section>
        <footer class="pass__foot"><small class="pass__label">${spot ? 'GPS CHECK-IN' : 'APPROXIMATE LOCATION'} · COLLECTIBLE DIGITAL TICKET</small>
          <div><p>${spot ? '座標只在這台裝置上比對，CITYMUS 不儲存你的位置。' : '城市以連線位置估算，CITYMUS 不儲存你的完整 IP。'}${fresh ? ' 已收進票夾。' : ''}</p><b>CITYMUS · ${esc(tk.code)}</b></div>
        </footer>
      </div>
    </article>`;
  }
  function openTicket(tk, { fresh = false } = {}) {
    if (!tk) return;
    const th = THEME_BY_T.get(tk.theme);
    const list = (tk.tracks || []).map(id => TRACK_BY_SHARE.get(id)).filter(Boolean);
    PassSheet.open({
      accent: th, label: `${tk.code} 票根`,
      html: ticketHTML(tk, { fresh }),
      actions: `<button class="pbtn pbtn--primary" type="button" data-play aria-label="播放票根上的歌">${icon('play')}<span>播放</span></button><button class="pbtn" type="button" data-save aria-label="存成圖片">${icon('image')}</button><button class="pbtn" type="button" data-share aria-label="分享票根">${icon('share')}</button>`,
      mount(sheet, api) {
        const play = (i = 0) => { api.close(); Player.playList(list.concat(Reco.smartShuffle(th.tracks).filter(t => !list.includes(t))), i, { kind: 'pass', title: `${tk.code} 票根`, theme: th.t }); };
        $('[data-play]', sheet).onclick = () => play(0);
        $$('.pass__rows li', sheet).forEach(li => li.onclick = () => play(Number(li.dataset.i)));
        $('[data-save]', sheet).onclick = e => saveImage(tk, e.currentTarget);
        $('[data-share]', sheet).onclick = async e => { const b = e.currentTarget; b.disabled = true; const blob = await ticketPNG(tk).catch(() => null); b.disabled = false; shareFiles({ blob, name: `CITYMUS-${tk.id}.png`, title: `CITYMUS · ${th.name}`, text: `${tk.kind === 'spot' ? tk.spot : th.cityCn} 的限定票根 · ${th.name}`, url: shareBase({ theme: th.slug }) }); };
      }
    });
  }

  /* 1080×1720 PNG, laid out like the R8 export */
  async function ticketPNG(tk) {
    const th = THEME_BY_T.get(tk.theme); const tracks = (tk.tracks || []).map(id => TRACK_BY_SHARE.get(id)).filter(Boolean);
    await Artwork.fonts();
    const W = 1080, H = 1720, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const ARC = 'Archivo, "Helvetica Neue", Arial, sans-serif', GAR = '"EB Garamond", Georgia, serif', CJK = '"Noto Serif TC", "Songti TC", serif';
    const acc = th.accent, ink = th.ink, soft = '#8C9AA3', spot = tk.kind === 'spot';
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#EEF3F8'); bg.addColorStop(1, '#F7F9FC'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    x.save(); x.shadowColor = 'rgba(41,70,93,.10)'; x.shadowBlur = 40; x.shadowOffsetY = 14; rr(64, 60, W - 128, H - 120, 46); const cg = x.createLinearGradient(0, 60, 0, H); cg.addColorStop(0, '#FBFCFE'); cg.addColorStop(1, '#F4F7FA'); x.fillStyle = cg; x.fill(); x.restore();
    x.strokeStyle = 'rgba(41,70,93,.10)'; x.lineWidth = 2; rr(64, 60, W - 128, H - 120, 46); x.stroke();
    x.fillStyle = '#fff'; rr(104, 104, 212, 212, 18); x.fill();
    QR.draw(x, shareBase({ theme: th.slug }), 114, 114, 192, { fg: ink });
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = ink; x.font = `700 31px ${ARC}`; x.fillText('CITYMUS', 360, 145);
    x.fillStyle = soft; x.font = `700 15px ${ARC}`; x.fillText(spot ? 'SPOT EDITION MUSIC PASS' : 'CITY LIMITED MUSIC PASS', 360, 180);
    x.fillStyle = acc; x.font = `700 64px ${ARC}`; x.textAlign = 'right'; x.fillText(tk.code, 930, 262); x.textAlign = 'left';
    x.setLineDash([14, 12]); x.strokeStyle = 'rgba(41,70,93,.2)'; x.lineWidth = 2; x.beginPath(); x.moveTo(104, 350); x.lineTo(930, 350); x.stroke(); x.setLineDash([]);
    x.fillStyle = acc; x.font = `700 15px ${ARC}`; x.fillText(spot ? `SPOT EDITION · ${tk.spotEn.toUpperCase()}` : `CITY EXCLUSIVE · ${tk.how === 'GPS' ? 'GPS MATCH' : 'IP CITY MATCH'}`, 105, 412);
    x.fillStyle = ink; x.font = `700 58px ${ARC}`; let title = (spot ? (tk.area || tk.city || th.name) : th.name).toUpperCase(); while (x.measureText(title).width > 830 && title.length > 4) title = title.slice(0, -1); x.fillText(title, 102, 478);
    x.fillStyle = '#6E7F87'; x.font = `500 24px ${CJK}`;
    const desc = spot ? `${tk.spot}限定。${th.line}` : (th.summary || th.line); const lines = []; let cur = '';
    for (const ch of desc) { if (x.measureText(cur + ch).width > 820) { lines.push(cur); cur = ch; } else cur += ch; } if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((l, i) => x.fillText(l, 105, 535 + i * 38));
    const fields = [['PROGRAM', 'CITYMUS'], [spot ? 'SPOT' : 'LOCATION', spot ? tk.spot : tk.where], ['STATUS', tk.how === 'GPS' ? 'GPS CHECK-IN' : 'APPROX. IP MATCH'], ['TICKET', tk.no]];
    fields.forEach(([k, v], i) => { const fx = 105 + i * 206; x.fillStyle = soft; x.font = `700 13px ${ARC}`; x.fillText(k, fx, 705); x.fillStyle = ink; x.font = `700 18px ${ARC}`; let vv = String(v); while (x.measureText(vv).width > 190 && vv.length > 3) vv = vv.slice(0, -2); if (vv !== String(v)) vv += '…'; x.fillText(vv, fx, 738); });
    x.fillStyle = acc; x.font = `700 14px ${ARC}`; x.fillText('LOCAL SOUND INDEX', 105, 818);
    x.fillStyle = ink; x.font = `700 34px ${CJK}`; x.fillText(spot ? '為這裡挑的五首' : '熱門音樂 · HOT 5', 105, 868);
    tracks.slice(0, 5).forEach((t, i) => {
      const y = 932 + i * 118;
      x.save(); x.shadowColor = 'rgba(41,70,93,.06)'; x.shadowBlur = 14; rr(104, y, 826, 92, 18); x.fillStyle = '#FFFFFF'; x.fill(); x.restore();
      x.fillStyle = acc; x.font = `700 20px ${ARC}`; x.fillText(pad2(i + 1), 132, y + 54);
      x.fillStyle = ink; x.font = `600 27px ${GAR}`; let tt = String(t.title); while (x.measureText(tt).width > 560 && tt.length > 4) tt = tt.slice(0, -2); if (tt !== String(t.title)) tt += '…'; x.fillText(tt, 190, y + 44);
      x.fillStyle = soft; x.font = `500 16px ${ARC}`; x.fillText(String(t.artist || ''), 190, y + 72);
      x.font = `700 13px ${ARC}`; x.textAlign = 'right'; x.fillText('HOT', 898, y + 52); x.textAlign = 'left';
    });
    x.fillStyle = acc; x.font = `700 13px ${ARC}`; x.fillText(`${spot ? 'GPS CHECK-IN' : 'APPROXIMATE LOCATION'} · COLLECTIBLE DIGITAL TICKET`, 105, 1572);
    x.fillStyle = soft; x.font = `500 15px ${ARC}`; x.fillText(spot ? 'Coordinates are compared on this device only.' : 'IP city is approximate. CITYMUS does not store your full IP address.', 105, 1604);
    x.fillStyle = ink; x.font = `700 14px ${ARC}`; x.textAlign = 'right'; x.fillText(`CITYMUS · ${tk.code}`, 930, 1604);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  }
  async function saveImage(tk, btn) {
    btn && (btn.disabled = true);
    try { const blob = await ticketPNG(tk); await shareFiles({ blob, name: `CITYMUS-${tk.id}.png`, title: 'CITYMUS ticket', save: true }); }
    catch (e) { console.warn(e); toast('暫時無法產生圖片'); }
    btn && (btn.disabled = false);
  }

  async function autoHiddenSpot() {
    const hidden = LANDMARKS.filter(lm => lm.hidden && lm.auto);
    if (!hidden.length || !navigator.geolocation || !navigator.permissions?.query) return;
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state !== 'granted') return;
      const [lat, lng] = await Geo.gps();
      const hit = hidden.map(lm => ({ lm, d: distKm([lat, lng], [lm.lat, lm.lng]) * 1000 }))
        .sort((a, b) => a.d - b.d).find(x => x.d <= x.lm.r);
      if (!hit) return;
      const once = `musicetown.hiddenSpot.${hit.lm.id}.${today()}`;
      if (sess.get(once, false)) return;
      sess.set(once, true);
      const id = `spot-${hit.lm.id}`;
      const tk = Wallet.has(id) ? Wallet.all().find(x => x.id === id) : issueSpot(hit.lm);
      const fresh = Wallet.add(tk); if (fresh) haptic('success');
      setTimeout(() => { if (!PassSheet.isOpen && !Sheet.isOpen) openTicket(tk, { fresh }); }, 220);
    } catch (_) {}
  }

  bus.on('open-pass', () => {
    const th = Geo.theme ? THEME_BY_T.get(Geo.theme) : null;
    if (th) return openCity(th);
    const list = Wallet.all();
    if (list.length) return openTicket(list[0]);
    Sheet.open({ title: 'City Pass', sub: '城市與景點的限定票根',
      html: `<p class="sheet-note">人在 CITYMUS 的 ${CITY_THEMES.length} 座城市之一時，打開那座城市就能收下限定票根；站在地標附近，還能用定位打卡收下 Spot Edition。${Geo.resolved ? '' : '正在確認你所在的城市⋯'}</p><div class="sheet-actions sheet-actions--2"><button class="btn btn--primary" type="button" data-c>${icon('board')}看所有城市</button><button class="btn" type="button" data-s>${icon('location')}定位打卡</button></div>`,
      mount(b, s) { $('[data-c]', b).onclick = () => { s.close(); Router.go('cities'); }; $('[data-s]', b).onclick = () => { s.close(); checkInSpot(); }; } });
  });
  bus.on('geo', t => { document.documentElement.classList.toggle('has-pass', !!t && !Wallet.has(`city-${THEME_BY_T.get(t)?.slug}`)); });
  bus.on('wallet', () => { const t = Geo.theme; document.documentElement.classList.toggle('has-pass', !!t && !Wallet.has(`city-${THEME_BY_T.get(t)?.slug}`)); });

  return { stateFor, openCity, openTicket, checkInSpot, explainSpot, issueCity, mapsUrl, autoHiddenSpot };
})();


/* ==========================================================================
   MonthlyPass · a different collectible surface from City / Spot tickets
   ========================================================================== */
const MonthlyPass = (() => {
  const html = s => '<article class="monthly-pass" aria-label="' + esc(s.monthLabel) + ' 聆聽月報">' +
    '<header class="monthly-pass__head"><b>CITYMUS.</b><span>CITY SOUND ARCHIVE</span></header>' +
    '<div class="monthly-pass__hero"><div><small>MONTHLY</small><h2>LISTENING<br>REPORT</h2><p>' + esc(s.issueDate) + '</p></div><i class="monthly-pass__disc">' + globeMark() + '</i></div>' +
    '<div class="monthly-pass__rule"></div>' +
    '<div class="monthly-pass__stats"><div><small>TOTAL LISTENING</small><b>' + s.hours.toFixed(1) + '<em> hrs</em></b></div><div><small>TRACKS PLAYED</small><b>' + s.tracks + '</b></div></div>' +
    '<div class="monthly-pass__taste"><small>TASTE FINGERPRINT</small><div>' + s.tastes.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div>' +
    '<p class="monthly-pass__desc">' + esc(s.desc) + '</p>' +
    '<div class="monthly-pass__route"><span><small>MONTH</small><b>' + esc(s.monthLabel) + '</b></span><span><small>COLLECTIBLE CODE</small><b>' + esc(s.code) + '</b></span></div>' +
    '<footer><span>ISSUED EVERY MONTH ON THE 10TH</span><b>CITYMUS.</b></footer></article>';

  async function png(s) {
    await Artwork.fonts();
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), ARC = 'Archivo, Arial, sans-serif', GAR = '"EB Garamond", Georgia, serif', CJK = '"Noto Serif TC", serif';
    x.fillStyle = '#EEF2F8'; x.fillRect(0,0,W,H);
    const rr=(X,Y,w,h,r)=>{x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();};
    x.save(); x.shadowColor='rgba(41,70,93,.14)'; x.shadowBlur=44; x.shadowOffsetY=18; rr(70,60,940,1230,44); x.fillStyle='#FBFCFE'; x.fill(); x.restore();
    x.strokeStyle='rgba(47,54,84,.12)'; x.lineWidth=2; rr(70,60,940,1230,44); x.stroke();
    x.fillStyle='#111722'; x.font='700 31px '+ARC; x.fillText('CITYMUS.',110,125);
    x.fillStyle='#8E93AA'; x.font='700 15px '+ARC; x.textAlign='right'; x.fillText('CITY SOUND ARCHIVE',970,123); x.textAlign='left';
    x.strokeStyle='rgba(47,54,84,.20)'; x.beginPath(); x.moveTo(110,158); x.lineTo(970,158); x.stroke();
    x.fillStyle='#111722'; x.font='700 104px '+ARC; x.fillText('MONTHLY',110,310);
    x.fillStyle='#40506B'; x.font='400 82px '+ARC; x.fillText('LISTENING',110,400); x.fillText('REPORT',110,480);
    x.fillStyle='#6F7890'; x.font='700 28px '+ARC; x.fillText(s.issueDate,112,535);
    x.strokeStyle='rgba(47,54,84,.13)'; x.beginPath(); x.moveTo(110,575); x.lineTo(970,575); x.stroke();
    x.fillStyle='#8E93AA'; x.font='700 17px '+ARC; x.fillText('TOTAL LISTENING',110,625); x.fillText('TRACKS PLAYED',650,625);
    x.fillStyle='#111722'; x.font='700 94px '+ARC; x.fillText(s.hours.toFixed(1),110,730);
    x.fillStyle='#6F7890'; x.font='500 34px '+ARC; x.fillText('hrs',365,730);
    x.fillStyle='#111722'; x.font='500 94px '+GAR; x.fillText(String(s.tracks),650,730);
    x.strokeStyle='rgba(47,54,84,.13)'; x.beginPath(); x.moveTo(110,780); x.lineTo(970,780); x.stroke();
    x.fillStyle='#8E93AA'; x.font='700 16px '+ARC; x.fillText('TASTE FINGERPRINT',110,830);
    let px=110; s.tastes.slice(0,4).forEach((v,i)=>{ const w=Math.min(205, Math.max(130, x.measureText(v).width+54)); rr(px,855,w,56,28); x.fillStyle=['#E8EFF7','#F1EBDD','#ECE9F4','#E5EDF2'][i%4];x.fill();x.fillStyle='#40506B';x.font='500 23px '+CJK;x.textAlign='center';x.fillText(v,px+w/2,891);px+=w+12;}); x.textAlign='left';
    x.fillStyle='#40506B'; x.font='italic 400 34px '+GAR;
    const wrap=(txt,max)=>{const a=[];let cur='';for(const ch of txt){if(x.measureText(cur+ch).width>max){a.push(cur);cur=ch}else cur+=ch}if(cur)a.push(cur);return a;};
    wrap(s.desc,820).slice(0,3).forEach((l,i)=>x.fillText(l,110,985+i*48));
    x.setLineDash([10,10]);x.strokeStyle='rgba(47,54,84,.20)';x.beginPath();x.moveTo(110,1145);x.lineTo(970,1145);x.stroke();x.setLineDash([]);
    x.fillStyle='#8E93AA';x.font='700 14px '+ARC;x.fillText('MONTH',110,1190);x.fillText('COLLECTIBLE CODE',530,1190);
    x.fillStyle='#111722';x.font='600 26px '+CJK;x.fillText(s.monthLabel,110,1230);x.font='700 23px '+ARC;x.fillText(s.code,530,1230);
    x.fillStyle='#111722';x.font='700 25px '+ARC;x.fillText('CITYMUS.',110,1270);
    return await new Promise(r=>c.toBlob(r,'image/png'));
  }
  function open(s) {
    if (!s) return;
    PassSheet.open({
      label: s.monthLabel + ' 聆聽月報',
      html: html(s),
      actions: '<button class="pbtn pbtn--primary" type="button" data-month-save aria-label="存成圖片">' + icon('image') + '<span>儲存</span></button><button class="pbtn" type="button" data-month-share aria-label="分享">' + icon('share') + '</button>',
      mount(sheet) {
        $('[data-month-save]',sheet).onclick = async e => { const b=e.currentTarget;b.disabled=true;const blob=await png(s);b.disabled=false;await shareFiles({blob,name:'CITYMUS-monthly-'+s.month+'.png',title:'CITYMUS monthly report',save:true}); };
        $('[data-month-share]',sheet).onclick = async e => { const b=e.currentTarget;b.disabled=true;const blob=await png(s);b.disabled=false;await shareFiles({blob,name:'CITYMUS-monthly-'+s.month+'.png',title:'CITYMUS · '+s.monthLabel,text:s.desc}); };
      }
    });
  }
  const card = s => '<button class="monthly-card" type="button" data-monthly="' + esc(s.id) + '"><span><small>' + esc(s.month) + '</small><b>' + s.hours.toFixed(1) + ' hrs</b></span><span>' + esc(s.tastes.slice(0,2).join(' · ')) + '</span>' + icon('chevron') + '</button>';
  return { open, png, card };
})();

/* share a file through the iOS share sheet (Save Image, AirDrop, Messages…) */
async function shareFiles({ blob, name, title = 'CITYMUS', text = '', url = '', save = false }) {
  if (blob) {
    const file = new File([blob], name, { type: blob.type || 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(save ? { files: [file], title } : { files: [file], title, text: [text, url].filter(Boolean).join('\n') }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'aborted'; }
    }
    if (save || !url) { downloadBlob(blob, name); return 'downloaded'; }
  }
  return nativeShare({ title, text, url });
}

/* ==========================================================================
   Share · playlists (#mix=), single songs (#t=), themes (?theme=),
   Library Pass (#library=L2.) — and the pages that receive them
   ========================================================================== */
function shareBase({ theme = null, hash = '' } = {}) {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  if (theme) u.searchParams.set('theme', theme);
  return u.toString() + (hash ? '#' + hash : '');
}
const LIB_REF_THEMES = ['JAZZ', 'CROONER', 'ROCK', 'SPORT', 'LO-FI', 'TAIPEI DREAM', 'OLD TOKYO', 'SPLENDOR SHANGHAI', 'VANCOUVER', 'VAPOR LONDON', 'NEW YORK', 'EMO', 'RUNNING', 'POEM', 'TRADITIONAL BEIJING', 'TROPICAL HAWAII', 'BUSTLING HONG KONG', 'SLIGHTLY TIPSY ROME', 'PSYCHEDELIC LA', 'SOLEMN KYOTO', 'MIRACULOUS LUOYANG', 'CHAMPS-ÉLYSÉES', 'MENACING DUBAI',
  /* appended in R11 — order is part of the L2 format */
  'DREAM OF THE RED CHAMBER', 'THE GOLDEN CANGUE', 'LOVE IN A FALLEN CITY', 'TAIPEI PEOPLE', 'CALL TO ARMS', 'JOURNEY UNDER THE MIDNIGHT SUN', 'IN SEARCH OF THE SUPERNATURAL', 'ROBINSON CRUSOE', 'PRIDE AND PREJUDICE', 'A TALE OF TWO CITIES',
  /* appended in R11.3 — keep old L2 indexes stable */
  'ROUGE TIBET', 'FANTASY TAINAN', 'PEACH BLOSSOM SPRING', 'XIANG YU ANNALS', 'MEMORIAL ON THE NORTHERN EXPEDITION', 'STRANGE TALES FROM A CHINESE STUDIO', 'ONE THOUSAND AND ONE NIGHTS', 'THE SCHOLARS', 'TO LIVE', 'THE PLUM IN THE GOLDEN VASE', 'MALDIVES PARADISE'];
const Share = (() => {
  const trackList = (tracks, title) => [`CITYMUS · ${title}`, '', ...tracks.map((t, i) => `${pad2(i + 1)}. ${t.title} — ${t.artist}`)].join('\n');
  const mixUrl = (tracks, title) => shareBase({ hash: 'mix=' + b64urlEncode({ v: 1, title: String(title || 'CITYMUS playlist').slice(0, 80), ids: [...new Set(tracks.map(t => t.shareId).filter(Boolean))] }) });
  const trackUrl = t => shareBase({ hash: 't=' + encodeURIComponent(t.shareId) });
  function shareSheet({ title, sub, url, text, accent, listText }) {
    Sheet.open({
      accent, title: '分享', sub: title,
      html: `<div class="stubline" style="${accentStyle(accent)}"><b>${esc(accent?.code || 'CM')}</b><span>${esc(sub)}</span></div><div class="sheet-actions sheet-actions--3"><button class="btn btn--primary" type="button" data-n aria-label="分享">${icon('share')}</button><button class="btn" type="button" data-c aria-label="複製連結">${icon('link')}</button><button class="btn" type="button" data-l aria-label="複製曲目">${icon('list')}</button></div>`,
      mount(b, s) {
        $('[data-n]', b).onclick = async () => { const r = await nativeShare({ title: `CITYMUS · ${title}`, text, url }); if (r === 'shared') s.close(); };
        $('[data-c]', b).onclick = async () => { await copyText(url); toast('已複製連結'); };
        $('[data-l]', b).onclick = async () => { await copyText(listText); toast('已複製曲目'); };
      }
    });
  }
  function theme(th) { shareSheet({ title: th.name, sub: `${th.cn} · ${th.tracks.length} 首`, url: shareBase({ theme: th.slug }), text: `${th.name}｜${th.line}`, accent: th, listText: trackList(th.tracks, th.name) }); }
  function tracks(list, title) {
    const clean = list.filter(t => t.shareId); if (!clean.length) { toast('本機音樂無法分享'); return; }
    if (clean.length === 1) return track(clean[0]);
    const th = themeOf(clean[0]);
    shareSheet({ title, sub: `${clean.length} 首 · CITYMUS`, url: mixUrl(clean, title), text: `${title} · ${clean.length} 首`, accent: th, listText: trackList(clean, title) });
  }
  /* one song: a card (Taipei edition when in Taipei) + link */
  async function track(t) {
    if (!t?.shareId) { toast('本機音樂無法分享'); return; }
    const th = themeOf(t), url = trackUrl(t);
    let blob = null, src = '';
    Sheet.open({
      accent: th, title: '分享這首歌', sub: `${t.title} · ${t.artist || ''}`,
      html: `<figure class="songcard"><div class="songcard__img" id="scImg"><span class="songcard__wait">${icon('vinyl')}</span></div></figure>
        <div class="sheet-actions sheet-actions--3"><button class="btn btn--primary" type="button" data-n aria-label="分享">${icon('share')}</button><button class="btn" type="button" data-c aria-label="複製連結">${icon('link')}</button><button class="btn" type="button" data-s aria-label="存成圖片">${icon('image')}</button></div>`,
      async mount(b, s) {
        Artwork.card(t).then(c => new Promise(r => c.toBlob(r, 'image/png'))).then(bl => { blob = bl; if (!bl) return; src = URL.createObjectURL(bl); const host = $('#scImg', b); if (host) host.innerHTML = `<img src="${src}" alt="${esc(t.title)} 分享卡">`; }).catch(() => {});
        $('[data-n]', b).onclick = async () => { const r = await shareFiles({ blob, name: `CITYMUS-${t.shareId}.png`, title: `CITYMUS · ${t.title}`, text: `${t.title} — ${t.artist}${th ? ` · ${th.kind === 'literature' ? th.cn : th.name}` : ''}`, url }); if (r === 'shared') s.close(); };
        $('[data-c]', b).onclick = async () => { await copyText(url); toast('已複製連結'); };
        $('[data-s]', b).onclick = async () => { if (blob) await shareFiles({ blob, name: `CITYMUS-${t.shareId}.png`, save: true }); };
      }
    });
  }

  /* ---------- Library Pass (R8 design) ---------- */
  const ref = t => { for (let gi = 0; gi < LIB_REF_THEMES.length; gi++) { const th = THEME_BY_T.get(LIB_REF_THEMES[gi]); if (!th) continue; const ti = th.tracks.findIndex(x => x.shareId === t.shareId); if (ti < 0 || ti >= 1296) continue; return gi.toString(36) + ti.toString(36).padStart(2, '0'); } return ''; };
  const fromRef = r => { if (!/^[0-9a-z]{3}$/i.test(r)) return null; const th = THEME_BY_T.get(LIB_REF_THEMES[parseInt(r[0], 36)]); return th?.tracks?.[parseInt(r.slice(1), 36)] || null; };
  const libUrl = (name, list) => shareBase({ hash: `library=L2.${b64urlEncode({ n: String(name || 'MUSICETOWN LIBRARY').slice(0, 40) })}.${[...new Set(list.map(ref).filter(Boolean))].join('')}` });
  function libraryPass(lib) {
    const list = Library.resolve(lib).filter(t => t.shareId); if (!list.length) { toast('這個收藏還沒有可分享的歌'); return; }
    const url = libUrl(lib.name, list); const locals = LocalFiles.tracks(lib.id).length;
    PassSheet.open({
      label: 'Library Pass',
      html: `<article class="pass pass--library"><i class="pass__dots" aria-hidden="true"></i><div class="pass__inner">
        ${PassSheet.head('LIBRARY PASS', '<span class="pass__live">SHAREABLE SNAPSHOT</span>')}
        <p class="pass__eyebrow pass__center">PERSONAL SOUND ARCHIVE</p>
        <h2 class="pass__big">${esc(lib.name)}</h2>
        <p class="pass__meta">${list.length} TRACKS · MUSICETOWN SNAPSHOT</p>
        ${PassSheet.rows(list.slice(0, 8))}${list.length > 8 ? `<p class="pass__more">＋ ${list.length - 8} 首</p>` : ''}
        <div class="pass__qr"><div class="pass__qrbox">${QR.svg(url, { ecl: 'M', fg: '#29465D' })}<span class="pass__qrlogo">${globeMark()}</span></div><small class="pass__label">SCAN TO OPEN</small></div>
        <div class="pass__fields pass__fields--2"><i class="pass__notch"></i><div><small>FORMAT</small><b>LIBRARY PASS</b></div><div><small>ACCESS</small><b>VIEW · PLAY · SAVE</b></div><div><small>LOCAL FILES</small><b>${locals ? 'NOT INCLUDED' : 'NONE'}</b></div><div><small>TRACKS</small><b>${list.length}</b></div></div>
        <p class="pass__note">這張票根是一個當下快照：掃碼的人可以查看、播放、另存成自己的音樂庫。之後你在這台裝置的增刪不會改動已分享的票根，本機音樂不會被分享。</p>
      </div></article>`,
      actions: `<button class="pbtn pbtn--primary pbtn--wide" type="button" data-n>${icon('share')}<span>SHARE PASS</span></button><button class="pbtn" type="button" data-c aria-label="複製連結">${icon('link')}</button>`,
      mount(sheet) {
        $('[data-n]', sheet).onclick = () => nativeShare({ title: `CITYMUS · ${lib.name}`, text: `${lib.name} · ${list.length} 首 · Library Pass`, url });
        $('[data-c]', sheet).onclick = async () => { await copyText(url); toast('已複製 Library Pass 連結'); };
        $$('.pass__rows li', sheet).forEach(li => li.onclick = () => { PassSheet.close(); Player.playList(list, Number(li.dataset.i), { kind: 'library', title: lib.name }); });
      }
    });
  }

  /* ---------- receivers: the ticket page with the drifting QR strip ---------- */
  function received({ kind, title, meta, list, url, saveLabel = '存成收藏', onSave }) {
    const th = themeOf(list[0]);
    PassSheet.open({
      accent: th, label: title,
      html: `<article class="pass pass--received">${PassSheet.marquee(url, `CITYMUS · ${kind}`)}<div class="pass__inner">
        ${PassSheet.head(`${kind} · RECEIVED`)}
        <p class="pass__eyebrow">SOMEONE SHARED THIS WITH YOU</p>
        <h2 class="pass__big pass__big--left">${esc(title)}</h2>
        <p class="pass__meta pass__meta--left">${esc(meta)}</p>
        ${PassSheet.rows(list)}
        <footer class="pass__foot"><small class="pass__label">MUSICETOWN · CITY SOUND ARCHIVE</small><div><p>所有曲目都來自標示 CC0、CC 授權或公有領域的來源。</p><b>CITYMUS</b></div></footer>
      </div></article>`,
      actions: `<button class="pbtn pbtn--primary" type="button" data-p>${icon('play')}<span>播放</span></button><button class="pbtn" type="button" data-s aria-label="${esc(saveLabel)}">${icon('listAdd')}</button><button class="pbtn" type="button" data-d aria-label="存到這台裝置">${icon('download')}</button>`,
      mount(sheet, api) {
        $('[data-p]', sheet).onclick = () => { api.close(); Player.playList(list, 0, { kind: 'mix', title }); };
        $('[data-s]', sheet).onclick = () => { onSave(); haptic('success'); };
        $('[data-d]', sheet).onclick = () => Offline.downloadMany(list, title);
        $$('.pass__rows li', sheet).forEach(li => li.onclick = () => { api.close(); Player.playList(list, Number(li.dataset.i), { kind: 'mix', title }); });
      }
    });
  }
  function receiveMix(p) {
    const list = (p?.ids || []).map(id => TRACK_BY_SHARE.get(id)).filter(Boolean); if (!list.length) return;
    const title = p.title || '分享的歌單';
    received({ kind: 'SHARED MIX', title, meta: `${list.length} TRACKS · SHARED MIX`, list, url: location.href, onSave: () => { const l = Library.create(title, list.map(trackKey), false); toast(`已存成「${l.name}」`); } });
  }
  function receiveTrack(id) {
    const t = TRACK_BY_SHARE.get(id); if (!t) return;
    const th = themeOf(t);
    received({ kind: 'SHARED TRACK', title: t.title, meta: `${t.artist || ''}${th ? ` · ${th.kind === 'literature' ? th.cn : th.name}` : ''}`, list: [t], url: location.href, saveLabel: '加入收藏', onSave: () => { if (!Library.isFav(t)) toggleFav(t); else toast('已在收藏裡'); } });
  }
  function receiveLibrary(m) {
    const name = b64urlDecode(m[1])?.n || 'SHARED LIBRARY'; const raw = m[2] || ''; const refs = []; for (let i = 0; i + 2 < raw.length; i += 3) refs.push(raw.slice(i, i + 3));
    const list = refs.map(fromRef).filter(Boolean); if (!list.length) return;
    received({ kind: 'LIBRARY PASS', title: Library.clean(name) || 'Library Pass', meta: `${list.length} TRACKS · LIBRARY PASS`, list, url: location.href, onSave: () => { const l = Library.create(name, list.map(trackKey), true); toast(`已建立「${l.name}」`); } });
  }
  function readHash() {
    const h = location.hash;
    const lib = h.match(/^#library=L2\.([A-Za-z0-9_-]+)\.([0-9a-z]*)$/i);
    if (lib) receiveLibrary(lib);
    else if (/^#t=/.test(h)) receiveTrack(decodeURIComponent(h.slice(3)));
    else { const mix = h.match(/^#mix=(.+)$/); if (mix) { const p = b64urlDecode(mix[1]); if (p) receiveMix(p); } else return false; }
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (_) {}
    return true;
  }
  window.addEventListener('hashchange', readHash);
  return { theme, tracks, track, libraryPass, readHash };
})();
