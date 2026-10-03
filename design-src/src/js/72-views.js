/* ==========================================================================
   Views
   ========================================================================== */

/* ---------- local files (same IndexedDB as R8.x) ---------- */
const LocalFiles = (() => {
  const DB = 'musicetownLocalLibrary', STORE = 'tracks'; let urls = new Map(); let rows = [];
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('addedAt', 'addedAt'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => { db.close(); res(out && 'result' in out ? out.result : out); }; t.onerror = () => { db.close(); rej(t.error); }; }); };
  async function refresh() {
    try { rows = await tx('readonly', s => s.getAll()) || []; } catch (_) { rows = []; }
    urls.forEach(u => URL.revokeObjectURL(u)); urls = new Map();
    bus.emit('localfiles');
  }
  function tracks(libId = Library.activeId()) {
    return rows.filter(r => String(r.libraryId || DEFAULT_LIB) === libId).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).map(r => {
      if (!urls.has(r.id)) urls.set(r.id, URL.createObjectURL(r.blob));
      return { id: r.id, title: r.title, artist: r.artist, vibe: '本機音樂', license: 'PERSONAL', audioSrc: urls.get(r.id), localPersonal: true, fileName: r.name, fileSize: r.size };
    });
  }
  const parse = n => { const stem = String(n || '').replace(/\.[^.]+$/, '').trim(); const p = stem.split(/\s+-\s+/); return p.length >= 2 ? { artist: p.shift().trim(), title: p.join(' - ').trim() } : { artist: '本機音樂', title: stem || 'Untitled' }; };
  async function importFiles(list) {
    const files = [...list].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|flac|aac|ogg|oga|opus)$/i.test(f.name)); if (!files.length) return 0;
    let n = 0;
    for (const f of files) { const p = parse(f.name); try { await tx('readwrite', s => s.put({ id: `${f.name}::${f.size}::${f.lastModified}`, name: f.name, title: p.title, artist: p.artist, type: f.type || 'audio/mpeg', size: f.size, lastModified: f.lastModified, addedAt: Date.now(), libraryId: Library.activeId(), blob: f })); n++; } catch (_) { toast('裝置儲存空間不足，部分檔案未加入'); break; } }
    await refresh(); return n;
  }
  async function remove(id) { try { await tx('readwrite', s => s.delete(id)); } catch (_) {} await refresh(); }
  async function removeLibrary(libId) { for (const r of rows.filter(r => String(r.libraryId || DEFAULT_LIB) === libId)) { try { await tx('readwrite', s => s.delete(r.id)); } catch (_) {} } await refresh(); }
  if ('indexedDB' in window) refresh();
  return { tracks, importFiles, remove, removeLibrary, refresh };
})();

/* ---------- card modal (FLIP from a 3D card) ---------- */
const CardModal = (() => {
  const m = byId('cardModal'), card = byId('cardModalCard'); let cur = null, anim = null;
  function open(i, th) {
    if (!th) return; cur = { i, th };
    setAccent(card, th);
    card.innerHTML = `<span class="cardmodal__num">${pad2(i + 1)}</span><span class="cardmodal__label">${esc(th.cn)}</span><div></div><div><div class="cardmodal__name">${esc(th.name)}<small>${esc(th.line || '')}</small></div><button class="btn btn--block cardmodal__cta" type="button" data-go>前往 ${esc(th.name)}</button></div>`;
    $('[data-go]', card).onclick = () => { const s = th.slug; close(true); Router.go('theme', { slug: s }); };
    Drawer.hold(i); m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); scrollLock.lock();
    const r = Drawer.cardRect(i, false); const b = card.getBoundingClientRect();
    if (r && card.animate && !REDUCE) {
      const s = Math.max(r.w, r.h) / b.width, dx = r.x + r.w / 2 - (b.left + b.width / 2), dy = r.y + r.h / 2 - (b.top + b.height / 2);
      anim?.cancel(); anim = card.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.75,.25,1)' });
    }
    if (!COARSE) setTimeout(() => $('[data-go]', card)?.focus({ preventScroll: true }), 80);
  }
  function close(instant) {
    if (!cur) return; const { i } = cur; cur = null; scrollLock.unlock();
    const finish = () => { m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); Drawer.release(i); };
    if (instant || REDUCE || !card.animate) { finish(); return; }
    const r = Drawer.cardRect(i, true), b = card.getBoundingClientRect();
    if (!r) { finish(); return; }
    const s = Math.max(r.w, r.h) / b.width, dx = r.x + r.w / 2 - (b.left + b.width / 2), dy = r.y + r.h / 2 - (b.top + b.height / 2);
    m.classList.remove('is-open'); m.style.visibility = 'visible';
    anim?.cancel(); anim = card.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0 }], { duration: 360, easing: 'cubic-bezier(.5,0,.3,1)' });
    setTimeout(() => Drawer.release(i), 240);
    anim.onfinish = () => { m.style.visibility = ''; m.setAttribute('aria-hidden', 'true'); };
  }
  byId('cardModalClose').innerHTML = icon('close');
  byId('cardModalScrim').addEventListener('click', () => close());
  byId('cardModalClose').addEventListener('click', () => close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) close(); });
  return { open, close };
})();


/* ---------- shared bits ---------- */
const themeTitle = th => th.kind === 'literature' ? th.cn : th.name;
const themeSub = th => th.kind === 'literature' ? `${th.authorCn} · ${th.era}` : th.cn;
const postcardHTML = th => {
  const here = Geo.theme === th.t;
  return `<button class="postcard" type="button" data-slug="${th.slug}" style="${accentStyle(th)}">
    <span class="postcard__field"><span class="postcard__code">${esc(th.code)}</span><span class="postcard__time tnum" data-tz="${esc(th.tz)}">${esc(localTimeIn(th.tz))}</span>${here ? `<span class="postcard__here">${icon('pin')}</span>` : ''}</span>
    <i class="perf"></i>
    <span class="postcard__txt"><b>${esc(th.name)}</b><span>${esc(th.cityCn)} · ${th.tracks.length} 首</span></span>
  </button>`;
};
const tileHTML = th => `<button class="tile" type="button" data-slug="${th.slug}" style="${accentStyle(th)}"><small>${esc(th.code)}</small><b>${esc(th.name)}</b><span>${esc(th.cn)} · ${th.tracks.length} 首</span></button>`;
const bookHTML = th => `<button class="book" type="button" data-slug="${th.slug}" style="${accentStyle(th)}"><span class="book__spine"><b>${esc(th.authorCn)}</b></span><span class="book__txt"><b>${esc(th.cn)}</b><em>${esc(th.name)}</em><span>${esc(th.era)}</span></span></button>`;
function citiesOrdered() {
  const recent = Stats.recentThemes();
  return CITY_THEMES.slice().sort((a, b) => {
    const s = th => (Geo.theme === th.t ? -100 : 0) + (recent.includes(th.t) ? recent.indexOf(th.t) - 50 : 0);
    return s(a) - s(b) || a.index - b.index;
  });
}
function bindSlugClicks(el) { el.addEventListener('click', e => { const b = e.target.closest('[data-slug]'); if (b && el.contains(b)) { haptic(); Router.go('theme', { slug: b.dataset.slug }); } }); }
setInterval(() => $$('[data-tz]').forEach(n => { n.textContent = localTimeIn(n.dataset.tz); }), 30000);

/* ==========================================================================
   Home
   ========================================================================== */
Router.register('home', (el) => {
  if (!el._built) {
    el._built = true;
    el.innerHTML = `<div class="wrap">
      <div class="home-grid">
        <section class="hero">
          <p class="hero__meta" id="homeMeta"></p>
          <h1 class="hero__title"><span>Music for</span><span>where you are.</span></h1>
          <p class="hero__lede">二十三個目的地與十部文學作品，每一個都有一抽屜的聲音。人在當地的時候，還能收下一張城市限定的票根。</p>
          <div id="homeStub"></div>
        </section>
        <section class="box" aria-label="目的地收納盒">
          <div class="box__seg" id="homeSeg"></div>
          <div class="box__stage" id="homeBox"><span class="box__hint" id="boxHint">點一張卡片</span></div>
          <div class="box__caption"><div style="min-width:0"><b id="boxName"></b><span id="boxLine"></span></div><button class="icon-btn icon-btn--quiet" type="button" id="boxOpen" aria-label="前往">${icon('chevron')}</button></div>
          <div class="box__index" id="boxIndex"></div>
        </section>
        <section class="sec home-edit" id="editSec">
          <div class="sec__head"><h2 class="sec__title">今日選曲<small id="editSub"></small></h2><button class="icon-btn icon-btn--quiet" type="button" id="editPlay" aria-label="全部播放">${icon('play')}</button></div>
          <div class="panel"><div class="rows" id="editRows"></div></div>
        </section>
      </div>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">城市<small>當地時間與限定票根</small></h2><button class="link-btn" type="button" id="toCities" aria-label="所有城市">${icon('chevron')}</button></div>
        <div class="rail" id="homeRail"></div>
      </section>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">文學<small>依作品的時代與心緒選曲 · 公有領域與 CC 授權錄音</small></h2></div>
        <div class="books" id="homeBooks"></div>
      </section>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">風格與心情</h2></div>
        <div class="tiles" id="homeTiles"></div>
      </section>
      <section class="sec" id="homeWalletSec" hidden>
        <div class="sec__head"><h2 class="sec__title">你的票夾</h2><button class="link-btn" type="button" id="toWallet" aria-label="全部票根">${icon('chevron')}</button></div>
        <div class="wallet" id="homeWallet"></div>
      </section>
      <footer class="foot"><b>musicetown</b><span>${THEMES.length} 個主題 · ${TOTAL_TRACKS} 首 · 音樂皆來自標示 CC0、CC 授權或公有領域的來源</span><span>${MT_BUILD}</span></footer>
    </div>`;
    const box = byId('homeBox');
    let group = GROUPS.find(g => g.key === Settings.get('homeGroup')) || GROUPS[0];
    let selected = 0;
    const themesOf = g => g.names.map(n => THEME_BY_T.get(n)).filter(Boolean);
    const caption = i => {
      const ths = themesOf(group); const th = ths[i ?? selected] || ths[0]; if (!th) return;
      byId('boxName').textContent = themeTitle(th); byId('boxLine').textContent = th.kind === 'literature' ? `${th.authorCn} · ${th.line}` : `${th.cn} · ${th.line}`;
      byId('boxOpen').dataset.slug = th.slug;
      $$('#boxIndex .chip').forEach(c => c.classList.toggle('is-active', c.dataset.slug === th.slug));
    };
    const cardsFor = g => themesOf(g).map((th, i) => ({ num: pad2(i + 1), label: th.cn, title: th.kind === 'literature' ? th.authorCn : th.name, sub: th.kind === 'city' ? th.city : th.kind === 'literature' ? th.name : '', code: th.code }));
    const renderIndex = () => { byId('boxIndex').innerHTML = themesOf(group).map(th => `<button class="chip" type="button" data-slug="${th.slug}">${esc(themeTitle(th))}</button>`).join(''); caption(); };
    el._mountBox = (build) => {
      if (!Drawer.mount(box, { cards: cardsFor(group), mode: 'home', build })) { box.innerHTML = `<div class="empty" style="margin:20px"><b>這台裝置無法顯示 3D 收納盒</b><p>可以直接從下方選擇。</p></div>`; }
      Drawer.onHover = i => { if (i != null) { selected = i; byId('boxHint').style.opacity = 0; } caption(i); };
      Drawer.onTap = i => CardModal.open(i, themesOf(group)[i]);
    };
    Seg(byId('homeSeg'), {
      label: '分類', value: group.key, items: GROUPS.map(g => ({ key: g.key, label: g.label })),
      onChange: k => { group = GROUPS.find(g => g.key === k) || GROUPS[0]; selected = 0; Settings.set('homeGroup', k); Drawer.setCards(cardsFor(group)); renderIndex(); }
    });
    renderIndex();
    byId('boxOpen').addEventListener('click', e => { const s = e.currentTarget.dataset.slug; if (s) Router.go('theme', { slug: s }); });
    bindSlugClicks(byId('boxIndex')); bindSlugClicks(byId('homeRail')); bindSlugClicks(byId('homeTiles')); bindSlugClicks(byId('homeBooks'));
    byId('toCities').onclick = () => Router.go('cities');
    byId('toWallet').onclick = () => Router.go('library');
    byId('homeTiles').innerHTML = THEMES.filter(t => t.kind === 'style' || t.kind === 'mood').map(tileHTML).join('');
    byId('homeBooks').innerHTML = LIT_THEMES.map(bookHTML).join('');
    const editRows = byId('editRows');
    bindRows(editRows, () => el._edit || [], (t) => Player.playList(el._edit, el._edit.indexOf(t), { kind: 'edit', title: '今日選曲' }));
    byId('editPlay').onclick = () => { haptic(); Player.playList(el._edit, 0, { kind: 'edit', title: '今日選曲' }); };
    bus.on('geo', () => { if (Router.view === 'home') homeDynamic(el); });
    bus.on('wallet', () => { if (Router.view === 'home') homeWallet(); });
    el._mountBox(true);
  } else {
    el._mountBox(false);
  }
  homeDynamic(el);
  if (!el._edit) { el._edit = Reco.todaysEdit(6); byId('editRows').innerHTML = el._edit.map((t, i) => rowHTML(t, i)).join(''); }
  homeWallet();
});
function homeDynamic(el) {
  const pod = partOfDay();
  const th = Geo.theme ? THEME_BY_T.get(Geo.theme) : null;
  const now = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  byId('homeMeta').innerHTML = th ? `${icon('pin')}<span>${GREETING[pod]}，你在 <b>${esc(th.cityCn)}</b></span><span class="tnum">${esc(now)}</span>` : `<span>${GREETING[pod]}</span><span class="tnum">${esc(now)}</span>`;
  byId('editSub').textContent = { morning: '早晨的選曲，輕快一點', day: '白天的選曲', evening: '傍晚的選曲', night: '夜晚的選曲，慢一點', late: '深夜的選曲，安靜一點' }[pod];
  const stub = byId('homeStub');
  if (th) {
    const owned = Wallet.has(`city-${th.slug}`), lim = th?.t === 'TAIPEI DREAM' ? Limited.active() : null;
    stub.innerHTML = `<button class="stub" type="button" style="${accentStyle(th)}"><span class="stub__code">${esc(th.code)}</span><span class="stub__txt"><b>${owned ? `你的${esc(th.cityCn)}票根` : `${esc(th.cityCn)}限定票根可領取`}</b><span>${lim ? `${esc(lim.label)}封面已開啟` : owned ? '在票夾裡，隨時打開' : `${esc(th.name)} · 只在當地發行`}</span></span>${icon('ticket')}</button>`;
    stub.firstElementChild.onclick = () => Pass.openCity(th);
  } else stub.innerHTML = '';
  byId('homeRail').innerHTML = citiesOrdered().map(postcardHTML).join('');
}
function homeWallet() {
  const list = Wallet.all(); const sec = byId('homeWalletSec'); if (!sec) return;
  sec.hidden = !list.length; if (!list.length) return;
  byId('homeWallet').innerHTML = list.slice(0, 3).map(walletCardHTML).join('');
  byId('homeWallet').onclick = e => { const b = e.target.closest('[data-tk]'); if (b) Pass.openTicket(Wallet.all().find(x => x.id === b.dataset.tk)); };
}
const walletCardHTML = tk => { const th = THEME_BY_T.get(tk.theme); return `<button class="wallet__card" type="button" data-tk="${esc(tk.id)}" style="${accentStyle(th)}"><b>${esc(tk.code)}</b><span>${esc(tk.kind === 'spot' ? tk.spot : th?.name || '')}<small>${tk.kind === 'spot' ? 'SPOT EDITION' : 'CITY LIMITED PASS'}</small></span><em class="tnum">${esc(tk.issued)}</em></button>`; };

/* ==========================================================================
   Cities · a calm grid of passes (current city first), then landmarks
   ========================================================================== */
const mpassHTML = th => {
  const here = Geo.theme === th.t, owned = Wallet.has(`city-${th.slug}`);
  const st = here ? `${icon('pin')}${owned ? '你在這裡' : '可領取'}` : owned ? `${icon('ticket')}已收藏` : `${icon('lock')}${esc(th.cityCn)}`;
  return `<button class="mpass${here ? ' is-here' : ''}${owned ? ' is-owned' : ''}" type="button" data-slug="${th.slug}" style="${accentStyle(th)}">
    <span class="mpass__top"><b class="mpass__code">${esc(th.code)}</b><span class="mpass__time tnum" data-tz="${esc(th.tz)}">${esc(localTimeIn(th.tz))}</span></span>
    <i class="mpass__perf"></i>
    <span class="mpass__bot"><b>${esc(th.name)}</b><span class="mpass__st">${st}</span></span>
  </button>`;
};
Router.register('cities', (el) => {
  if (!el._built) {
    el._built = true;
    el.innerHTML = `<div class="wrap">
      <h1 class="page-title">Cities</h1>
      <p class="page-lede">十七座城市，各自的當地時間。人在城裡，就能收下那座城市的限定票根。</p>
      <div class="mt-24" id="citySeg"></div>
      <div id="cityHere"></div>
      <div class="passgrid mt-16" id="passgrid"></div>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">地標票根<small>站在地標附近打卡，收下 Spot Edition</small></h2><button class="icon-btn icon-btn--quiet" type="button" id="spotCheck" aria-label="用定位打卡">${icon('location')}</button></div>
        <div class="spots" id="spots"></div>
        <p class="rights">定位只在這台裝置上比對距離，不會上傳或儲存你的位置。</p>
      </section>
    </div>`;
    let region = 'all';
    const draw = () => {
      const all = citiesOrdered(), here = all.find(th => Geo.theme === th.t);
      const list = all.filter(th => (region === 'all' || th.region === region || (region === 'europe' && th.region === 'mideast')) && th !== here);
      byId('cityHere').innerHTML = here && (region === 'all' || here.region === region) ? `<div class="herepass mt-16" style="${accentStyle(here)}">
          <div class="herepass__l"><small class="pass__label">YOU ARE IN</small><b class="herepass__code">${esc(here.code)}</b><span>${esc(here.name)} · ${esc(here.cityCn)} <i class="tnum" data-tz="${esc(here.tz)}">${esc(localTimeIn(here.tz))}</i></span></div>
          <div class="herepass__r"><button class="pbtn pbtn--primary" type="button" data-pass aria-label="${Wallet.has(`city-${here.slug}`) ? '打開票根' : '領取票根'}">${icon('ticket')}<span>${Wallet.has(`city-${here.slug}`) ? '打開' : '領取'}</span></button><button class="pbtn pbtn--round" type="button" data-slug="${here.slug}" aria-label="前往 ${esc(here.name)}">${icon('play')}</button></div>
        </div>` : '';
      const hp = $('[data-pass]', byId('cityHere')); if (hp) hp.onclick = () => Pass.openCity(here);
      byId('passgrid').innerHTML = list.map(mpassHTML).join('');
      byId('spots').innerHTML = LANDMARKS.filter(lm => { const r = THEME_BY_T.get(lm.theme)?.region; return region === 'all' || r === region || (region === 'europe' && r === 'mideast'); }).map(lm => {
        const th = THEME_BY_T.get(lm.theme); const owned = Wallet.has(`spot-${lm.id}`);
        return `<div class="spot" style="${accentStyle(th)}"><button class="spot__main" type="button" data-lm="${lm.id}"><span class="spot__code">${esc(th.code)}</span><span><b>${esc(lm.cn)}</b><span>${esc(lm.name)} · ${owned ? '已收藏' : '尚未打卡'}</span></span>${icon(owned ? 'ticket' : 'chevron')}</button><a class="icon-btn" href="${esc(Pass.mapsUrl(lm))}" target="_blank" rel="noopener" aria-label="在 Apple 地圖打開 ${esc(lm.cn)}">${icon('map')}</a></div>`;
      }).join('');
    };
    Seg(byId('citySeg'), { label: '地區', value: 'all', items: [{ key: 'all', label: '全部' }, { key: 'asia', label: '亞洲' }, { key: 'europe', label: '歐洲' }, { key: 'americas', label: '美洲' }], onChange: k => { region = k; draw(); } });
    bindSlugClicks(byId('passgrid')); bindSlugClicks(byId('cityHere'));
    byId('spots').addEventListener('click', e => { const b = e.target.closest('[data-lm]'); if (!b) return; const lm = LANDMARKS.find(x => x.id === b.dataset.lm); const id = `spot-${lm.id}`; if (Wallet.has(id)) Pass.openTicket(Wallet.all().find(x => x.id === id)); else Pass.explainSpot(lm); });
    byId('spotCheck').onclick = () => Pass.checkInSpot();
    el._draw = draw; bus.on('geo', () => el._draw()); bus.on('wallet', () => el._draw());
  }
  el._draw();
});

/* ==========================================================================
   Search · destinations, literature (by work, author, era), songs,
   artists & composers
   ========================================================================== */
const SearchIndex = (() => {
  const themes = THEMES.map(th => ({ th, blob: norm([th.t, th.name, th.cn, th.code, th.city, th.cityCn, th.line, th.summary, th.data.key, th.data.sub, th.author, th.authorCn, th.era, KIND_LABEL[th.kind], REGION_LABEL[th.region], th.kind === 'literature' ? 'literature 文學 小說 作者' : ''].join(' ')) }));
  const seen = new Set(); const tracks = [];
  ALL_TRACKS.forEach(t => { const k = recKey(t); if (seen.has(k)) return; seen.add(k); const th = themeOf(t); tracks.push({ t, blob: norm([t.title, t.artist, t.composerCn, t.performer, t.note, t.vibe, t.genre, th?.name, th?.cn, th?.authorCn, th?.author].join(' ')) }); });
  const people = new Map(); // artist / composer / author → tracks
  const add = (name, t) => { const a = String(name || '').trim(); if (!a) return; if (!people.has(a)) people.set(a, []); people.get(a).push(t); };
  tracks.forEach(({ t }) => { add(t.artist, t); if (t.composerCn) add(t.composerCn, t); });
  LIT_THEMES.forEach(th => th.tracks.forEach(t => { add(th.authorCn, t); add(th.author, t); }));
  return { themes, tracks, people };
})();
Router.register('search', (el) => {
  if (!el._built) {
    el._built = true;
    el.innerHTML = `<div class="wrap">
      <h1 class="page-title">Search</h1>
      <label class="searchbox glass"><span class="sr-only">搜尋</span>${icon('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="城市、作品、作者、歌名"><button class="icon-btn icon-btn--sm" type="button" id="qClear" aria-label="清除" hidden>${icon('close')}</button></label>
      <div class="filters" id="qFilters"></div>
      <div class="mt-24" id="qOut"></div>
    </div>`;
    const q = byId('q'), out = byId('qOut'); let filter = 'all';
    const F = [['all', '全部'], ['dest', '目的地'], ['lit', '文學'], ['song', '歌曲'], ['people', '作者與歌手']];
    const drawFilters = () => { byId('qFilters').innerHTML = F.map(([k, l]) => `<button class="chip${k === filter ? ' is-active' : ''}" type="button" data-f="${k}">${l}</button>`).join(''); };
    drawFilters();
    byId('qFilters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; haptic(); drawFilters(); run(); });
    el._songs = [];
    bindRows(out, () => el._songs, (t) => Player.playList(el._songs, el._songs.indexOf(t), { kind: 'search', title: `搜尋：${q.value.trim()}` }));
    function run() {
      const v = norm(q.value); byId('qClear').hidden = !v;
      if (!v) {
        const recent = store.get(K.recentSearch, []);
        out.innerHTML = `${recent.length ? `<div class="result-group"><div class="result-label">最近搜尋</div><div class="filters filters--wrap">${recent.map(r => `<button class="chip" type="button" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>` : ''}
          <div class="result-group"><div class="result-label">作者</div><div class="filters filters--wrap">${[...new Set(LIT_THEMES.map(th => th.authorCn))].map(a => `<button class="chip" type="button" data-q="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>
          <div class="result-group"><div class="result-label">現在適合</div>${Reco.themesForNow(6).map(themeResult).join('')}</div>`;
        el._songs = []; return;
      }
      const words = v.split(/\s+/).filter(Boolean); const hit = blob => words.every(w => blob.includes(w));
      const hitThemes = SearchIndex.themes.filter(x => hit(x.blob)).map(x => x.th);
      const ths = filter === 'all' || filter === 'dest' ? hitThemes.filter(th => th.kind !== 'literature') : [];
      const lits = filter === 'all' || filter === 'lit' ? hitThemes.filter(th => th.kind === 'literature') : [];
      const songs = filter === 'all' || filter === 'song' || filter === 'lit' ? SearchIndex.tracks.filter(x => hit(x.blob) && (filter !== 'lit' || themeOf(x.t)?.kind === 'literature')).map(x => x.t).slice(0, filter === 'all' ? 40 : 120) : [];
      const ppl = filter === 'all' || filter === 'people' ? [...SearchIndex.people.keys()].filter(a => hit(norm(a))).slice(0, 12) : [];
      el._songs = songs;
      let html = '';
      if (lits.length) html += `<div class="result-group"><div class="result-label">文學 · ${lits.length}</div>${lits.map(themeResult).join('')}</div>`;
      if (ths.length) html += `<div class="result-group"><div class="result-label">目的地 · ${ths.length}</div>${ths.map(themeResult).join('')}</div>`;
      if (ppl.length) html += `<div class="result-group"><div class="result-label">作者與歌手 · ${ppl.length}</div>${ppl.map(a => `<button class="result-theme" type="button" data-artist="${esc(a)}"><span class="result-theme__code result-theme__code--person">${esc([...a][0] || '')}</span><span><b>${esc(a)}</b><span>${SearchIndex.people.get(a).length} 首</span></span>${icon('chevron')}</button>`).join('')}</div>`;
      if (songs.length) html += `<div class="result-group"><div class="result-label">歌曲 · ${songs.length}</div><div class="rows">${songs.map((t, i) => rowHTML(t, i)).join('')}</div></div>`;
      out.innerHTML = html || `<div class="empty"><b>找不到「${esc(q.value.trim())}」</b><p>試試城市（Tokyo、台北）、作品（紅樓夢、Pride and Prejudice）、作者（張愛玲、狄更斯）或歌名。</p></div>`;
    }
    const themeResult = th => `<button class="result-theme" type="button" data-slug="${th.slug}" style="${accentStyle(th)}"><span class="result-theme__code">${esc(th.code)}</span><span><b>${esc(themeTitle(th))}</b><span>${esc(th.kind === 'literature' ? `${th.authorCn} · ${th.name}` : `${th.cn} · ${th.line}`)}</span></span>${icon('chevron')}</button>`;
    let t0 = null; q.addEventListener('input', () => { clearTimeout(t0); t0 = setTimeout(run, 90); });
    const remember = () => { const v = q.value.trim(); if (v) store.set(K.recentSearch, [v, ...store.get(K.recentSearch, []).filter(x => x !== v)].slice(0, 8)); };
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { remember(); q.blur(); } });
    byId('qClear').onclick = () => { q.value = ''; run(); q.focus(); };
    out.addEventListener('click', e => {
      const s = e.target.closest('[data-slug]'); if (s) { remember(); Router.go('theme', { slug: s.dataset.slug }); return; }
      const r = e.target.closest('[data-q]'); if (r) { q.value = r.dataset.q; run(); return; }
      const a = e.target.closest('[data-artist]'); if (a) { const list = SearchIndex.people.get(a.dataset.artist) || []; el._songs = list; q.value = a.dataset.artist; filter = 'song'; drawFilters(); out.innerHTML = `<div class="result-group"><div class="result-label">${esc(a.dataset.artist)} · ${list.length} 首</div><div class="rows">${list.map((t, i) => rowHTML(t, i)).join('')}</div></div>`; }
    });
    bus.on('focus-search', () => q.focus());
    el._run = run;
  }
  el._run();
});

/* ==========================================================================
   Library · playlists as covers (no sideways scrolling), filters by
   category, downloads, wallet and settings
   ========================================================================== */
const libCats = list => { const c = new Set(); list.forEach(t => { if (t.localPersonal) c.add('local'); else { const th = themeOf(t); if (th) c.add(th.kind); } if (Offline.has(t)) c.add('offline'); }); return c; };
const LIB_FILTERS = [['all', '全部'], ['city', '城市'], ['style', '風格'], ['mood', '心情'], ['literature', '文學'], ['local', '本機'], ['offline', '已下載']];
Router.register('library', (el) => {
  if (!el._built) {
    el._built = true;
    el.innerHTML = `<div class="wrap">
      <h1 class="page-title">Library</h1>
      <div class="libgrid" id="libGrid" role="tablist" aria-label="播放清單"></div>
      <section class="libdetail" id="libDetail">
        <div class="libhead" id="libHead"></div>
        <div class="filters filters--wrap mt-16" id="libFilters"></div>
        <div class="panel mt-16"><div class="rows" id="libRows"></div></div>
        <label class="btn btn--block btn--quiet mt-16" id="libImport">${icon('folder')}加入這台裝置上的音樂<input type="file" accept="audio/*,.mp3,.m4a,.wav,.flac,.aac,.ogg,.opus" multiple hidden id="libFile"></label>
      </section>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">票夾<small>城市與地標的限定票根</small></h2></div>
        <div id="libWallet"></div>
      </section>
      <section class="sec">
        <div class="sec__head"><h2 class="sec__title">設定</h2></div>
        <div id="a2hsSlot"></div>
        <div class="settings mt-16" id="settings"></div>
      </section>
      <footer class="foot"><b>musicetown</b><span>播放清單、票夾、下載與本機音樂只存在這台裝置上。</span><span>${MT_BUILD}</span></footer>
    </div>`;
    const gridEl = byId('libGrid'), rowsEl = byId('libRows');
    let filter = 'all', view = null; // view: null = active library, '__offline' = downloads
    el._list = [];
    bindRows(rowsEl, () => el._list, (t) => Player.playList(el._list, el._list.indexOf(t), { kind: 'library', title: view === '__offline' ? '已下載' : Library.active().name }));
    gridEl.addEventListener('click', e => {
      const b = e.target.closest('[data-lib]'); if (!b) return; haptic();
      if (b.dataset.lib === '__new') { libraryCreator(); return; }
      if (b.dataset.lib === '__offline') { view = '__offline'; filter = 'all'; draw(); byId('libDetail').scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' }); return; }
      view = null; filter = 'all'; Library.setActive(b.dataset.lib);
      requestAnimationFrame(() => byId('libDetail').scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' }));
    });
    byId('libFilters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; haptic(); draw(); });
    byId('libFile').addEventListener('change', async e => { const n = await LocalFiles.importFiles(e.target.files); e.target.value = ''; if (n) toast(`已加入 ${n} 首本機音樂`); });
    const coverHTML = (l, n, active) => `<button class="libcard${active ? ' is-active' : ''}" type="button" role="tab" aria-selected="${active}" data-lib="${esc(l.id)}"><span class="libcard__name">${esc(l.name)}</span><span class="libcard__meta"><b class="tnum">${n}</b> 首${(l.cats || []).length ? ` · ${esc((l.cats || []).slice(0, 2).map(c => THEME_BY_T.get(c)).filter(Boolean).map(themeTitle).join('、'))}` : ''}</span></button>`;
    const draw = () => {
      const libs = Library.all(), act = Library.active();
      const offN = Offline.count;
      gridEl.innerHTML = libs.map(l => coverHTML(l, l.keys.length + LocalFiles.tracks(l.id).length, !view && l.id === act.id)).join('')
        + (offN ? `<button class="libcard libcard--offline${view === '__offline' ? ' is-active' : ''}" type="button" data-lib="__offline" role="tab" aria-selected="${view === '__offline'}"><span class="libcard__name">${icon('downloaded')}已下載</span><span class="libcard__meta"><b class="tnum">${offN}</b> 首 · ${fmtBytes(Offline.bytes())}</span></button>` : '')
        + `<button class="libcard libcard--new" type="button" data-lib="__new" aria-label="新增播放清單">${icon('plus')}<span>新增</span></button>`;
      if (view === '__offline' && !offN) view = null;
      const base = view === '__offline' ? Offline.tracks() : [...Library.resolve(act), ...LocalFiles.tracks(act.id)];
      const cats = libCats(base);
      const pass = t => filter === 'all' ? true : filter === 'local' ? !!t.localPersonal : filter === 'offline' ? Offline.has(t) : (!t.localPersonal && themeOf(t)?.kind === filter);
      el._list = base.filter(pass);
      byId('libFilters').innerHTML = LIB_FILTERS.filter(([k]) => k === 'all' || cats.has(k)).map(([k, l]) => `<button class="chip${k === filter ? ' is-active' : ''}" type="button" data-f="${k}">${l}</button>`).join('');
      byId('libFilters').hidden = cats.size < 2;
      const name = view === '__offline' ? '已下載' : act.name;
      const favN = view === '__offline' ? 0 : Library.resolve(act).length;
      byId('libHead').innerHTML = `<div class="libhead__name"><h2>${esc(name)}</h2>${view === '__offline' ? '' : `<button class="icon-btn icon-btn--quiet" type="button" id="libMore" aria-label="清單選項">${icon('more')}</button>`}</div>
        <p class="libhead__stat">${view === '__offline' ? `${offN} 首 · ${fmtBytes(Offline.bytes())} · ${STANDALONE ? '主畫面 App 會保留這些歌' : '加入主畫面後保留得更穩定'}` : `${base.length} 首${(act.cats || []).length ? ` · ${esc((act.cats || []).map(c => THEME_BY_T.get(c)).filter(Boolean).map(themeTitle).join('、'))}` : ''}`}</p>
        <div class="libhead__actions">
          <button class="pbtn pbtn--primary" type="button" id="libPlay" aria-label="播放"${el._list.length ? '' : ' disabled'}>${icon('play')}</button>
          <button class="pbtn" type="button" id="libShuffle" aria-label="隨機播放"${el._list.length ? '' : ' disabled'}>${icon('shuffle')}</button>
          ${view === '__offline' ? `<button class="pbtn" type="button" id="libClearOff" aria-label="移除全部下載">${icon('trash')}</button>` : `<button class="pbtn" type="button" id="libDl" aria-label="全部存到這台裝置"${favN ? '' : ' disabled'}>${icon('download')}</button><button class="pbtn" type="button" id="libPass" aria-label="Library Pass"${favN ? '' : ' disabled'}>${icon('ticket')}</button>`}
        </div>`;
      rowsEl.innerHTML = el._list.length ? el._list.map((t, i) => rowHTML(t, i)).join('') : `<div class="empty" style="box-shadow:none"><b>這裡還是空的</b><p>${view === '__offline' ? '在歌曲選單裡選「存到這台裝置」，就能離線播放。' : `在任何歌曲旁點愛心，或用「加入播放清單」，就會收進「${esc(act.name)}」。`}</p><button class="btn btn--small" type="button" data-go-home>去找音樂</button></div>`;
      const go = rowsEl.querySelector('[data-go-home]'); if (go) go.onclick = () => Router.go('home');
      byId('libImport').hidden = view === '__offline';
      byId('libPlay').onclick = () => Player.playList(el._list, 0, { kind: 'library', title: name });
      byId('libShuffle').onclick = () => { const l = Reco.smartShuffle(el._list); Player.playList(l, 0, { kind: 'library', title: name }); };
      const dl = byId('libDl'); if (dl) dl.onclick = () => Offline.downloadMany(el._list.filter(t => !t.localPersonal), name);
      const ps = byId('libPass'); if (ps) ps.onclick = () => Share.libraryPass(act);
      const mo = byId('libMore'); if (mo) mo.onclick = () => libraryMenu(act);
      const co = byId('libClearOff'); if (co) co.onclick = async () => { if (confirm('移除這台裝置上所有下載的歌？')) { await Offline.clear(); toast('已移除全部下載'); } };
      drawWallet();
    };
    const drawWallet = () => {
      const list = Wallet.all();
      byId('libWallet').innerHTML = list.length ? `<div class="wallet">${list.map(walletCardHTML).join('')}</div>` : `<div class="empty"><b>還沒有票根</b><p>人在城市裡，打開那座城市就能領取 City Pass；到了地標，也能用定位打卡收下景點票根。</p><button class="btn btn--small" type="button" data-to-cities>看所有城市</button></div>`;
      const b = byId('libWallet').querySelector('[data-to-cities]'); if (b) b.onclick = () => Router.go('cities');
    };
    byId('libWallet').addEventListener('click', e => { const b = e.target.closest('[data-tk]'); if (b) Pass.openTicket(Wallet.all().find(x => x.id === b.dataset.tk)); });
    const drawSettings = async () => {
      const est = await Offline.estimate();
      byId('settings').innerHTML = `
        <div class="setting setting--stack"><div><b>音質</b><span>${{ auto: '自動選擇最穩定的音源', hq: '優先串流原始高音質檔案', saver: '使用網站壓縮檔，省流量' }[Settings.get('quality')]}</span></div><div id="qualSeg"></div></div>
        <button class="setting" type="button" id="setFades"><div><b>淡入淡出</b><span>每首開頭 2 秒淡入、結尾 3 秒淡出</span></div><span class="switch" role="switch" aria-checked="${Settings.get('fades') !== false}"></span></button>
        <button class="setting" type="button" id="setAuto"><div><b>自動延續播放</b><span>清單播完後，接著播放相近的歌</span></div><span class="switch" role="switch" aria-checked="${Settings.get('autoplay') !== false}"></span></button>
        <div class="setting"><div><b>儲存空間</b><span>${Offline.count ? `已下載 ${Offline.count} 首 · ${fmtBytes(Offline.bytes())}` : '還沒有下載的歌'}${est?.quota ? ` · 這台裝置還可用約 ${fmtBytes(Math.max(0, est.quota - (est.usage || 0)))}` : ''}</span></div>${icon('cloud')}</div>
        <button class="setting" type="button" id="setDislikes"><div><b>不適合我</b><span>${Dislikes.size ? `${Dislikes.size} 首會在自動播放時略過 · 點一下清除` : '在歌曲選單標記後，自動播放會略過'}</span></div>${icon('ban')}</button>
        <button class="setting" type="button" id="setWelcome"><div><b>重新看一次歡迎頁</b><span>重新選擇想先去的地方</span></div>${icon('chevron')}</button>`;
      Seg(byId('qualSeg'), { label: '音質', value: Settings.get('quality'), items: [{ key: 'auto', label: '自動' }, { key: 'hq', label: '高音質' }, { key: 'saver', label: '省流量' }], onChange: k => { Settings.set('quality', k); drawSettings(); toast('下一首開始套用'); } });
      byId('setFades').onclick = () => { Settings.set('fades', !(Settings.get('fades') !== false)); drawSettings(); };
      byId('setAuto').onclick = () => { Settings.set('autoplay', !(Settings.get('autoplay') !== false)); drawSettings(); };
      byId('setDislikes').onclick = () => { if (!Dislikes.size) return; Dislikes.clear(); toast('已清除「不適合我」'); drawSettings(); };
      byId('setWelcome').onclick = () => Welcome.open();
      const slot = byId('a2hsSlot');
      slot.innerHTML = (IS_IOS && !STANDALONE) ? `<div class="a2hs"><img src="apple-touch-icon.png" alt=""><div><b>加入主畫面</b><p>在 Safari 點 ${icon('share')} 分享，再選「加入主畫面」。之後從主畫面開啟：全螢幕、鎖定畫面與靈動島都能控制播放，下載的歌也會穩定保留在 iPhone 上。</p></div></div>` : '';
    };
    el._draw = draw;
    bus.on('library', () => el._draw()); bus.on('localfiles', () => el._draw()); bus.on('wallet', () => el._draw()); bus.on('dislikes', () => drawSettings());
    bus.on('offline', () => { if (Router.view === 'library') { el._draw(); drawSettings(); } });
    bus.on('library-show-offline', () => { view = Offline.count ? '__offline' : null; el._draw(); });
    drawSettings();
  }
  el._draw();
});
function libraryMenu(lib) {
  const many = Library.all().length > 1;
  Sheet.open({
    title: lib.name, sub: `${lib.keys.length} 首`,
    html: `<div class="menu"><button type="button" data-a="rename">${icon('edit')}重新命名</button><button type="button" data-a="pass">${icon('ticket')}分享 Library Pass</button><button type="button" data-a="new">${icon('plus')}新增另一個播放清單</button><button type="button" data-a="clear">${icon('minus')}清空這個清單</button>${many ? `<button type="button" class="is-danger" data-a="delete">${icon('trash')}刪除「${esc(lib.name)}」</button>` : ''}</div>`,
    mount(body, s) {
      body.addEventListener('click', async e => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'rename') nameSheet(lib.name, v => Library.rename(lib.id, v), { title: '重新命名', cta: '儲存' });
        if (a === 'pass') { s.close(); Share.libraryPass(lib); }
        if (a === 'new') libraryCreator();
        if (a === 'clear') { s.close(); if (confirm(`清空「${lib.name}」裡的歌與本機音樂？`)) { Library.clear(lib.id); await LocalFiles.removeLibrary(lib.id); toast('已清空'); } }
        if (a === 'delete') { s.close(); if (confirm(`刪除「${lib.name}」？這會一併刪除其中的本機音樂。`)) { await LocalFiles.removeLibrary(lib.id); Library.remove(lib.id); toast('已刪除'); } }
      });
    }
  });
}

/* ==========================================================================
   Destination page (cities, styles, moods, literature)
   ========================================================================== */
Router.register('theme', (el, p) => {
  const th = themeBySlug(p.slug) || THEMES[0];
  const lit = th.kind === 'literature';
  setAccent(el, th);
  const kindTag = th.kind === 'city' ? `<span class="tag">${icon('ticket')}City Limited</span>` : `<span class="tag">${KIND_LABEL[th.kind] || ''}</span>`;
  el.innerHTML = `<div class="wrap dest${lit ? ' dest--lit' : ''}">
    <header class="dest__hero">
      <span class="dest__code" aria-hidden="true">${esc(lit ? th.cn : th.code)}</span>
      <div class="dest__meta">${kindTag}${th.kind === 'city' ? `<span class="tag tnum" data-tz-label="${esc(th.tz)}">${esc(th.cityCn)} ${esc(localTimeIn(th.tz))}</span>` : ''}${lit ? `<span class="tag">${esc(th.era)}</span>` : ''}<span class="tag">${th.tracks.length} 首</span></div>
      <h1 class="dest__title" id="destTitle">${esc(lit ? th.cn : th.name)}</h1>
      <p class="dest__cn">${esc(lit ? `${th.name} · ${th.authorCn} ${th.author}` : th.cn)}</p>
      <p class="dest__line">${lit ? `「${esc(th.line)}」` : esc(th.line)}</p>
      ${th.data.sub ? `<button class="link-btn dest__more" type="button" id="destMore" aria-expanded="false">${lit ? '關於選曲' : '關於這個抽屜'} ${icon('down')}</button><p class="dest__desc" id="destDesc" hidden>${esc(th.data.sub)}</p>` : ''}
      <div class="actionbar" id="actionbar"></div>
      ${th.data.archiveEdit ? `<p class="note">${icon('sparkle')}<span>這個目的地的 50 首專屬選曲還在策展中，現在先從 musicetown 的曲庫挑出最接近的聲音暫代。完成安裝後會自動換上正式選曲。</span></p>` : ''}
    </header>
    <section class="sec">
      <div class="sec__head"><h2 class="sec__title">抽屜<small>每次抽出五首，點卡片直接播放</small></h2></div>
      <div class="box__stage" id="themeBox" style="aspect-ratio:1/0.92"></div>
      <div class="drawer-actions"><button class="btn" type="button" id="reroll">${icon('refresh')}換一組</button><button class="btn" type="button" id="drawRandom" aria-label="隨機播放一首">${icon('shuffle')}抽一首</button></div>
    </section>
    <section class="sec">
      <div class="sec__head"><h2 class="sec__title">全部曲目<small>${th.tracks.length} 首${lit ? ' · 皆為公有領域或 CC 授權錄音' : th.data.bpm ? ` · ${esc(th.data.bpm)}` : ''}</small></h2></div>
      <div class="tracks-tools"><label class="minisearch">${icon('search')}<span class="sr-only">在這裡搜尋</span><input id="tq" type="search" placeholder="${lit ? '搜尋曲名、章回、作曲家' : '搜尋這裡的歌'}" autocomplete="off"></label><div id="sortSeg"></div></div>
      <div class="panel"><div class="rows" id="themeRows"></div></div>
    </section>
    ${lit ? `<section class="sec"><div class="sec__head"><h2 class="sec__title">選曲與授權</h2></div><p class="rights">每一首都選自作曲者逝世超過五十年的作品，錄音本身也是公有領域（Public Domain Mark、CC0）或 CC 授權（CC BY、CC BY-SA），來源為 Internet Archive 上 Musopen 等計畫的公開錄音。點歌曲選單可查看演奏者、來源與授權。</p></section>`
      : `<section class="sec"><div class="sec__head"><h2 class="sec__title">聲音輪廓</h2></div>
      <div class="meters">${metersOf(th).map(m => `<div class="meter"><span>${esc(m[0])}</span><i style="--v:${clamp(+m[1] || 0, 0, 100)}%"></i><b>${esc(m[1])}</b></div>`).join('')}</div>
      <p class="rights">${esc(th.data.key || '')}。所有曲目皆來自來源頁明確標示 CC0 1.0 Universal 或公有領域的作品，點歌曲選單可查看來源與授權。</p></section>`}
  </div>`;
  const more = byId('destMore'); if (more) more.onclick = () => { const d = byId('destDesc'); d.hidden = !d.hidden; more.setAttribute('aria-expanded', String(!d.hidden)); };
  // fixed slots: play · shuffle · pass/radio · download · share (icons only)
  const drawActions = () => {
    const st = Pass.stateFor(th);
    const slot3 = th.kind !== 'city' ? `<button class="action" type="button" data-a="radio" aria-label="從這裡開始電台">${icon('radio')}</button>`
      : st === 'ready' ? `<button class="action is-ready" type="button" data-a="pass" aria-label="領取${esc(th.cityCn)}限定票根">${icon('ticket')}<i class="action__dot"></i></button>`
        : st === 'owned' ? `<button class="action is-ready" type="button" data-a="pass" aria-label="打開我的票根">${icon('ticket')}</button>`
          : `<button class="action is-locked" type="button" data-a="pass" aria-label="到${esc(th.cityCn)}解鎖票根">${icon('lock')}</button>`;
    const allOff = th.tracks.length && th.tracks.every(t => Offline.has(t));
    byId('actionbar').innerHTML = `<button class="action action--primary" type="button" data-a="play" aria-label="播放">${icon('play')}</button><button class="action" type="button" data-a="shuffle" aria-label="隨機播放">${icon('shuffle')}</button>${slot3}<button class="action${allOff ? ' is-ready' : ''}" type="button" data-a="dl" aria-label="${allOff ? '已全部存在這台裝置' : '全部存到這台裝置'}">${icon(allOff ? 'downloaded' : 'download')}</button><button class="action" type="button" data-a="share" aria-label="分享">${icon('share')}</button>`;
  };
  drawActions();
  byId('actionbar').onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; haptic();
    const ctx = { kind: 'theme', title: themeTitle(th), theme: th.t };
    if (a === 'play') Player.playList(sortedTracks(), 0, ctx);
    if (a === 'shuffle') Player.playList(Reco.smartShuffle(th.tracks), 0, ctx);
    if (a === 'radio') { const seed = Reco.drawFive(th)[0]; Player.playList([seed, ...Reco.radio(seed, 14)], 0, { kind: 'radio', title: `${themeTitle(th)} 電台`, theme: th.t }); }
    if (a === 'pass') Pass.openCity(th);
    if (a === 'dl') { if (th.tracks.every(t => Offline.has(t))) toast('已全部存在這台裝置'); else Offline.downloadMany(th.tracks, themeTitle(th)); }
    if (a === 'share') Share.theme(th);
  };
  el._unsubs?.forEach(f => f());
  el._unsubs = [bus.on('geo', drawActions), bus.on('wallet', drawActions), bus.on('offline', drawActions)];
  // drawer: five tracks
  let five = Reco.drawFive(th);
  const cards = () => five.map((t, i) => ({ num: pad2(i + 1), label: lit ? (t.note || th.cn) : th.cn, title: lit ? (t.composerCn ? `${t.composerCn}` : t.artist) : t.title, sub: lit ? t.title : t.artist }));
  if (!Drawer.mount(byId('themeBox'), { cards: cards(), mode: 'theme' })) byId('themeBox').innerHTML = `<div class="rows" style="padding:8px 16px;background:var(--paper)" id="fiveRows"></div>`;
  Drawer.onHover = () => {};
  Drawer.onTap = i => { const t = five[i]; if (t) Player.playList(five, i, { kind: 'drawer', title: `${themeTitle(th)} · 抽屜`, theme: th.t }); };
  byId('reroll').onclick = () => { haptic(); five = Reco.drawFive(th, five); Drawer.setCards(cards()); };
  byId('drawRandom').onclick = () => { haptic(); const t = five[Math.floor(Math.random() * five.length)]; Player.playList(five, five.indexOf(t), { kind: 'drawer', title: `${themeTitle(th)} · 抽屜`, theme: th.t }); };
  // tracks with search + sort
  let sort = 'curated', q = '';
  const sortedTracks = () => { let l = th.tracks.slice(); if (sort === 'az') l.sort((a, b) => String(a.title).localeCompare(String(b.title))); if (q) l = l.filter(t => norm(`${t.title} ${t.artist} ${t.vibe} ${t.note || ''} ${t.composerCn || ''}`).includes(q)); return l; };
  const rowsEl = byId('themeRows'); el._list = sortedTracks();
  const drawRows = () => { el._list = sortedTracks(); rowsEl.innerHTML = el._list.length ? el._list.map((t, i) => rowHTML(t, i)).join('') : `<div class="empty" style="box-shadow:none"><b>沒有符合的歌</b><p>換個關鍵字試試。</p></div>`; };
  rowsEl._bound = false; bindRows(rowsEl, () => el._list, t => Player.playList(el._list, el._list.indexOf(t), { kind: 'theme', title: themeTitle(th), theme: th.t }));
  Seg(byId('sortSeg'), { label: '排序', value: 'curated', items: [{ key: 'curated', label: lit ? '章回' : '精選' }, { key: 'az', label: 'A–Z' }], onChange: k => { sort = k; drawRows(); } });
  let tq = null; byId('tq').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { q = norm(e.target.value); drawRows(); }, 80); });
  drawRows();
  if (th.kind === 'city') Geo.ensure();
});
bus.on('share-current', () => { if (Router.view === 'theme') { const th = themeBySlug(Router.params.slug); if (th) Share.theme(th); } });
