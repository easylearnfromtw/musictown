/* ==========================================================================
   Artwork · covers drawn on the device
   - lock screen / Dynamic Island (Media Session) get a cover per song:
     every theme has its own layout, and neighbouring songs alternate
     light ↔ dark grounds so the change is visible even in the tiny pill
   - Taipei Limited: while the listener is in Taipei, covers and the player
     wear the TAIPEI / 台北 wordmark with the record in front of it
   ========================================================================== */
/* coloured vinyl, chosen per recording (palette kept from R8.6) */
const VINYLS = [
  { name: 'Smoked Black', hex: '#1d2232', material: 'black' }, { name: 'Apple Green', hex: '#b9dc7c', material: 'color' }, { name: 'Light Blue', hex: '#aed6f1', material: 'color' },
  { name: 'Light Pink', hex: '#f1c3d2', material: 'color' }, { name: 'Tiffany', hex: '#93d8d0', material: 'color' }, { name: 'Frosted Glass', hex: '#e2eaf4', material: 'frost' },
  { name: 'Champagne Purple', hex: '#c6b2d8', material: 'color' }, { name: 'Oxblood', hex: '#7a2a3c', material: 'color' }, { name: 'Light Yellow', hex: '#efe3a8', material: 'color' }
];
const vinylColor = t => VINYLS[hash32(`${t?.artist || ''}|${t?.title || ''}`) % VINYLS.length];

/* region-limited editions (only Taipei for now) */
const Limited = (() => {
  const ED = {
    'TAIPEI DREAM': { code: 'TPE', word: 'assets/limited/taipei-word.png', cn: 'assets/limited/taipei-cn.png', label: '', en: 'TAIPEI LIMITED' }
  };
  const q = new URLSearchParams(location.search).get('limited');
  if (q) sess.set('mt.limitedPreview', q.toLowerCase());
  const preview = sess.get('mt.limitedPreview', null);
  const imgs = {};
  const load = src => imgs[src] || (imgs[src] = new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  function active(themeKey = null) {
    if (themeKey && themeKey !== 'TAIPEI DREAM') return null;
    if (preview === 'taipei' || preview === 'tpe') return ED['TAIPEI DREAM'];
    try { return Geo.theme === 'TAIPEI DREAM' ? ED['TAIPEI DREAM'] : null; } catch (_) { return null; }
  }
  return { active, load, ED };
})();

const Artwork = (() => {
  const LIGHT = ['#CFE8FB', '#FBD7E4', '#C7C3E6', '#E6D3A6', '#A9D7F4', '#F4D2DE', '#DCE8F3', '#E9E2F2'];
  const DARK = ['#1F3B66', '#3E3D55', '#29465D', '#5B4E7A', '#2F4F4F', '#4A3B52', '#203247', '#5A4636'];
  const hex = h => { h = String(h || '#888').replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lum = c => { const [r, g, b] = hex(c); return (r * .299 + g * .587 + b * .114) / 255; };

  /* the song's ground: alternate light/dark by position, tinted toward the theme */
  function ground(t, th) {
    const i = Number.isFinite(t?.__ti) ? t.__ti : hash32(trackKey(t)) % 50;
    const h = hash32(th?.t || 'lib');
    const dark = i % 2 === 1;
    const base = dark ? DARK[(Math.floor(i / 2) + h) % DARK.length] : LIGHT[(Math.floor(i / 2) + h) % LIGHT.length];
    const bg = mix(base, th?.accent || '#9C98C9', dark ? .18 : .22);
    return { bg, fg: lum(bg) > .55 ? (th?.ink || '#29465D') : '#FFFFFF', dark, n: i + 1 };
  }

  let fontsReady = null;
  function fonts() {
    if (fontsReady) return fontsReady;
    const list = ['700 120px Archivo', 'italic 400 120px "EB Garamond"', '400 120px "EB Garamond"', '900 120px "Noto Serif TC"', '500 60px "Noto Serif TC"'];
    fontsReady = Promise.race([Promise.all(list.map(f => document.fonts?.load(f).catch(() => null))), sleep(1600)]).catch(() => null);
    return fontsReady;
  }
  const ARCHIVO = 'Archivo, "Helvetica Neue", Arial, sans-serif', GARA = '"EB Garamond", Georgia, "Noto Serif TC", serif', CJK = '"Noto Serif TC", "Songti TC", serif';

  function record(x, cx, cy, R, label, t, opts = {}) {
    const vc = vinylColor(t);
    x.save(); x.shadowColor = 'rgba(17,22,40,.28)'; x.shadowBlur = R * .18; x.shadowOffsetY = R * .07;
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = vc.material === 'frost' ? '#EEF2F8' : vc.hex; x.fill(); x.restore();
    x.strokeStyle = vc.material === 'black' ? 'rgba(255,255,255,.07)' : 'rgba(24,33,58,.08)'; x.lineWidth = Math.max(1, R * .006);
    for (let r = R * .4; r < R * .97; r += R * .028) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
    const gl = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R); gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(.45, 'rgba(255,255,255,0)'); gl.addColorStop(.6, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.14)');
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = gl; x.fill();
    x.beginPath(); x.arc(cx, cy, R * .34, 0, Math.PI * 2); x.fillStyle = opts.labelColor || '#F6F8FC'; x.fill();
    if (label) { x.fillStyle = opts.labelInk || '#29465D'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${R * .13}px ${ARCHIVO}`; x.fillText(label, cx, cy - R * .12); }
    x.beginPath(); x.arc(cx, cy, R * .025, 0, Math.PI * 2); x.fillStyle = 'rgba(24,33,58,.55)'; x.fill();
  }

  async function paint(t, S = 512) {
    await fonts();
    const th = themeOf(t), c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const g = ground(t, th), lim = Limited.active(th?.t);
    x.textBaseline = 'alphabetic';
    if (lim) {
      // Taipei Limited: porcelain ground, wordmark behind the record
      x.fillStyle = '#F6F8FC'; x.fillRect(0, 0, S, S);
      const [w, cn] = await Promise.all([Limited.load(lim.word), Limited.load(lim.cn)]);
      if (w) { const ww = S * .9, wh = ww * w.height / w.width; x.drawImage(w, (S - ww) / 2, S * .07, ww, wh); }
      record(x, S / 2, S * .56, S * .3, g.n < 10 ? `0${g.n}` : String(g.n), t, { labelColor: '#F6F8FC' });
      if (cn) { const cw = S * .2, ch = cw * cn.height / cn.width; x.drawImage(cn, (S - cw) / 2, S * .89, cw, ch); }
      return c;
    }
    x.fillStyle = g.bg; x.fillRect(0, 0, S, S);
    const kind = th?.kind || 'style';
    if (kind === 'city') {
      // a ticket stub: the code, a perforation, the song number
      x.fillStyle = g.fg; x.font = `700 ${S * .36}px ${ARCHIVO}`; x.textAlign = 'left';
      x.fillText(th.code, S * .07, S * .42);
      x.globalAlpha = .75; x.font = `700 ${S * .042}px ${ARCHIVO}`; x.fillText('CITY LIMITED MUSIC PASS', S * .08, S * .53); x.globalAlpha = 1;
      x.setLineDash([S * .03, S * .025]); x.strokeStyle = g.fg; x.globalAlpha = .4; x.lineWidth = S * .006; x.beginPath(); x.moveTo(S * .06, S * .64); x.lineTo(S * .94, S * .64); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
      x.fillStyle = mix(g.bg, g.dark ? '#000000' : '#FFFFFF', .35); [0, S].forEach(px => { x.beginPath(); x.arc(px, S * .64, S * .045, 0, Math.PI * 2); x.fill(); });
      x.fillStyle = g.fg; x.font = `italic 400 ${S * .3}px ${GARA}`; x.textAlign = 'right'; x.fillText(String(g.n).padStart(2, '0'), S * .93, S * .93);
      x.textAlign = 'left'; x.font = `500 ${S * .055}px ${CJK}`; x.fillText(th.cityCn || '', S * .08, S * .9);
    } else if (kind === 'literature') {
      // a book jacket: vertical title, author, a thin frame, the song number
      x.strokeStyle = g.fg; x.globalAlpha = .35; x.lineWidth = S * .004; x.strokeRect(S * .05, S * .05, S * .9, S * .9); x.globalAlpha = 1;
      x.fillStyle = g.fg; x.textAlign = 'center'; x.textBaseline = 'top';
      const title = [...th.cn]; const fs = title.length > 4 ? S * .13 : S * .17;
      x.font = `900 ${fs}px ${CJK}`; title.forEach((ch, k) => x.fillText(ch, S * .76, S * .1 + k * fs * 1.04));
      x.font = `500 ${S * .045}px ${CJK}`; x.globalAlpha = .8; [...(th.authorCn || '')].forEach((ch, k) => x.fillText(ch, S * .6, S * .12 + k * S * .055)); x.globalAlpha = 1;
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.font = `italic 400 ${S * .34}px ${GARA}`; x.fillText(String(g.n).padStart(2, '0'), S * .09, S * .9);
      x.font = `500 ${S * .045}px ${CJK}`; x.globalAlpha = .85; const note = String(t.note || '').slice(0, 10); x.fillText(note, S * .1, S * .55); x.globalAlpha = 1;
    } else {
      // style & mood: a record in the corner, the code, the song number
      record(x, S * .64, S * .62, S * .42, th?.code || 'MT', t, { labelColor: g.bg, labelInk: g.fg });
      x.fillStyle = g.fg; x.textAlign = 'left'; x.font = `700 ${S * .15}px ${ARCHIVO}`; x.fillText(th?.code || 'MT', S * .07, S * .2);
      x.font = `italic 400 ${S * .2}px ${GARA}`; x.fillText(String(g.n).padStart(2, '0'), S * .07, S * .38);
    }
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = g.fg; x.globalAlpha = .7; x.font = `700 ${S * .032}px ${ARCHIVO}`;
    if (kind !== 'literature') x.fillText('MUSICETOWN', S * .08, S * .965 - (kind === 'city' ? S * .12 : 0));
    x.globalAlpha = 1;
    return c;
  }

  const cache = new Map();
  function cover(t, S = 512) {
    if (!t) return Promise.resolve(null);
    const k = `${trackKey(t)}|${S}|${Limited.active(themeOf(t)?.t) ? 'L' : ''}`;
    if (cache.has(k)) return cache.get(k);
    const p = paint(t, S).then(c => c.toDataURL('image/jpeg', .9)).catch(() => null);
    cache.set(k, p); if (cache.size > 60) cache.delete(cache.keys().next().value);
    return p;
  }

  const urlCache = new Map();
  async function coverURL(t, S = 1024) {
    if (!t) return null;
    const key = `${trackKey(t)}|${S}|${Limited.active(themeOf(t)?.t) ? 'L' : ''}`;
    if (urlCache.has(key)) return urlCache.get(key);
    const safe = String(t.shareId || hash32(key)).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 96) || String(hash32(key));
    const url = new URL(`__citymus_art/${safe}-${S}.jpg`, document.baseURI).href;
    const p = (async () => {
      try {
        const c = await paint(t, S);
        const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', .92));
        if (!blob) throw new Error('artwork blob failed');
        const artCache = await caches.open('mt-artwork-v1');
        await artCache.put(url, new Response(blob, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }
        }));
        return url;
      } catch (_) {
        return cover(t, S);
      }
    })();
    urlCache.set(key, p);
    if (urlCache.size > 80) urlCache.delete(urlCache.keys().next().value);
    return p;
  }

  /* 1080×1350 share card for one song (the Taipei edition follows the attached design) */
  async function card(t) {
    await fonts();
    const th = themeOf(t), W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const lim = Limited.active(th?.t), g = ground(t, th);
    x.fillStyle = '#F6F8FC'; x.fillRect(0, 0, W, H);
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    x.save(); x.shadowColor = 'rgba(41,70,93,.14)'; x.shadowBlur = 60; x.shadowOffsetY = 24; rr(60, 60, W - 120, H - 120, 48); x.fillStyle = '#FFFFFF'; x.fill(); x.restore();
    if (lim) {
      const [w, cn] = await Promise.all([Limited.load(lim.word), Limited.load(lim.cn)]);
      if (w) { const ww = W - 200, wh = ww * w.height / w.width; x.drawImage(w, 100, 120, ww, wh); }
      record(x, W / 2, 560, 330, null, { ...t, title: t.title }, { labelColor: '#F6F8FC' });
      x.save(); x.translate(W / 2, 560); x.fillStyle = '#29465D'; x.font = `700 22px ${ARCHIVO}`; x.textAlign = 'center';
      const ring = 'MUSICETOWN · CITY SOUND ARCHIVE · '; [...ring].forEach((ch, i, a) => { x.save(); x.rotate(i / a.length * Math.PI * 2); x.fillText(ch, 0, -90); x.restore(); }); x.restore();
      if (cn) { const cw = 200, ch = cw * cn.height / cn.width; x.drawImage(cn, (W - cw) / 2, 925, cw, ch); }
    } else {
      x.save(); rr(60, 60, W - 120, 640, 48); x.clip(); x.fillStyle = g.bg; x.fillRect(60, 60, W - 120, 640); x.restore();
      x.fillStyle = g.fg; x.font = `700 230px ${ARCHIVO}`; x.textAlign = 'left'; x.fillText(th?.kind === 'literature' ? th.code : (th?.code || 'MT'), 110, 330);
      x.globalAlpha = .75; x.font = `700 26px ${ARCHIVO}`; x.fillText(th?.kind === 'literature' ? `${th.cn} · ${th.authorCn}` : (th ? `${th.name.toUpperCase()} · ${th.cn}` : 'MUSICETOWN'), 116, 400); x.globalAlpha = 1;
      record(x, W - 300, 560, 230, null, t, { labelColor: g.bg });
    }
    x.textAlign = 'center'; x.fillStyle = '#8583A0'; x.font = `700 24px ${ARCHIVO}`;
    x.fillText(`CITYMUS · ${(th ? (th.kind === 'literature' ? th.cn : th.name) : 'Library').toUpperCase()}`, W / 2, lim ? 1080 : 800);
    x.fillStyle = '#3E3D55'; let tt = String(t.title || ''); x.font = `500 66px ${GARA}`;
    while (x.measureText(tt).width > W - 220 && tt.length > 6) tt = tt.slice(0, -2); if (tt !== String(t.title || '')) tt += '…';
    x.fillText(tt, W / 2, lim ? 1160 : 890);
    x.fillStyle = '#8583A0'; x.font = `500 30px ${ARCHIVO}`; x.fillText([t.artist, t.note || shortVibe(t)].filter(Boolean).join(' · ').slice(0, 60), W / 2, lim ? 1212 : 945);
    if (!lim) {
      x.fillStyle = '#29465D'; x.font = `500 32px ${CJK}`; x.fillText(th?.line || '', W / 2, 1012);
      if (t.shareId) {
        try { x.fillStyle = '#FFFFFF'; x.fillRect(W / 2 - 78, 1048, 156, 156); QR.draw(x, shareBase({ hash: 't=' + encodeURIComponent(t.shareId) }), W / 2 - 70, 1056, 140, { ecl: 'M', fg: '#29465D' }); } catch (_) {}
        x.fillStyle = '#A3A9BC'; x.font = `700 20px ${ARCHIVO}`; x.fillText('SCAN TO LISTEN', W / 2, 1238);
      }
    }
    return c;
  }


  /* Literature playlist share card: editorial book-cover composition.
     Keeps the visual center around the title block instead of a generic record. */
  async function themeCard(th) {
    await fonts();
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const accent = th?.accent || '#8A91B6', ink = th?.ink || '#3E3D55';
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    const fitLine = (txt, maxW, maxPx, minPx, fontFamily, weight='700') => {
      let px = maxPx; const s = String(txt || '');
      while (px > minPx) { x.font = `${weight} ${px}px ${fontFamily}`; if (x.measureText(s).width <= maxW) break; px -= 2; }
      return px;
    };
    x.fillStyle = '#F4F1EA'; x.fillRect(0, 0, W, H);

    x.save(); x.shadowColor='rgba(54,48,42,.13)'; x.shadowBlur=70; x.shadowOffsetY=28;
    rr(72, 66, 936, 1218, 44); x.fillStyle='#FFFDF8'; x.fill(); x.restore();

    // book spine / left visual mass
    rr(72, 66, 126, 1218, 44); x.fillStyle=accent; x.fill();
    x.save(); x.translate(135, 1168); x.rotate(-Math.PI/2);
    x.fillStyle='rgba(255,255,255,.94)'; x.textAlign='left'; x.font=`700 30px ${CJK}`;
    x.fillText(String(th?.authorCn || th?.author || 'CITYMUS'), 0, 0);
    x.restore();

    // small masthead and oversized code watermark balance the spine
    x.fillStyle='#8F8A82'; x.textAlign='left'; x.font=`700 24px ${ARCHIVO}`;
    x.fillText('CITYMUS · LITERATURE', 246, 142);
    x.fillStyle=accent; x.globalAlpha=.12; x.font=`700 220px ${ARCHIVO}`; x.textAlign='right';
    x.fillText(String(th?.code || 'LIT'), 946, 334); x.globalAlpha=1;

    // centered title block: primary visual center
    x.textAlign='left'; x.fillStyle=ink;
    const title = String(th?.cn || th?.name || 'Literature');
    const titlePx = fitLine(title, 660, 118, 72, CJK, '800');
    x.font=`800 ${titlePx}px ${CJK}`; x.fillText(title, 246, 430);

    x.fillStyle='#6F6A64'; x.font=`italic 500 46px ${GARA}`;
    let en=String(th?.name || ''); while(x.measureText(en).width>660 && en.length>8) en=en.slice(0,-2); if(en!==String(th?.name||'')) en+='…';
    x.fillText(en, 248, 505);

    x.fillStyle='#8A857E'; x.font=`600 28px ${CJK}`;
    x.fillText([th?.authorCn, th?.era].filter(Boolean).join(' · '), 248, 574);

    // quiet editorial rule + quote
    x.fillStyle=accent; x.globalAlpha=.7; x.fillRect(248, 630, 120, 3); x.globalAlpha=1;
    x.fillStyle=ink; x.font=`500 34px ${CJK}`;
    const quote='「'+String(th?.line || '').replace(/[「」]/g,'')+'」';
    const chars=[...quote]; const lines=[]; let line='';
    for(const ch of chars){ const test=line+ch; if(x.measureText(test).width>650 && line){lines.push(line); line=ch;} else line=test; }
    if(line) lines.push(line);
    lines.slice(0,3).forEach((ln,i)=>x.fillText(ln,248,710+i*58));

    // simple book-page motif at lower right
    x.save(); x.translate(760, 968); x.rotate(-.055);
    rr(-122,-154,244,308,24); x.fillStyle='#F5F0E6'; x.fill();
    x.strokeStyle='rgba(62,61,85,.12)'; x.lineWidth=2; x.stroke();
    x.fillStyle=accent; x.globalAlpha=.22; for(let i=0;i<6;i++) x.fillRect(-82,-88+i*34,164-(i%3)*24,3); x.globalAlpha=1;
    x.restore();

    // QR and footer
    try {
      x.fillStyle='#FFFFFF'; rr(248, 1012, 176, 176, 18); x.fill();
      QR.draw(x, shareBase({ theme: th.slug }), 260, 1024, 152, { ecl:'M', fg: ink });
    } catch (_) {}
    x.fillStyle='#97928B'; x.textAlign='left'; x.font=`700 18px ${ARCHIVO}`; x.fillText('SCAN TO OPEN', 248, 1226);
    x.textAlign='right'; x.fillStyle=ink; x.font=`700 23px ${ARCHIVO}`; x.fillText('CITYMUS.', 946, 1226);
    return c;
  }

  return { cover, coverURL, card, themeCard, ground, record, fonts };
})();
