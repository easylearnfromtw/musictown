/* ==========================================================================
   CITYMUS Reader · site-native public-domain reading while music continues
   ========================================================================== */
const EBOOKS = Array.isArray(window.CITYMUS_EBOOKS) ? window.CITYMUS_EBOOKS : [];
const EBOOK_BY_SLUG = new Map(EBOOKS.map(b => [b.slug, b]));
const Reader = (() => {
  const K='citymus.reader.settings.v1', P='citymus.reader.progress.v1', B='citymus.reader.bookmarks.v1';
  const defaults={size:19,line:1.95,width:700,theme:'paper'};
  const settings=()=>Object.assign({},defaults,store.get(K,{}));
  const progress=()=>store.get(P,{})||{}, bookmarks=()=>store.get(B,{})||{};
  const has=slug=>EBOOK_BY_SLUG.has(String(slug||'')), get=slug=>EBOOK_BY_SLUG.get(String(slug||''))||null;
  function setSetting(k,v){const s=settings();s[k]=v;store.set(K,s);bus.emit('reader-setting',s)}
  function saveProgress(slug,y,pct){const p=progress();p[slug]={y:Math.max(0,Math.round(y)),pct:clamp(Number(pct)||0,0,1),at:Date.now()};store.set(P,p)}
  function toggleBookmark(slug,y,pct){const b=bookmarks();if(b[slug]){delete b[slug];store.set(B,b);return false}b[slug]={y:Math.round(y),pct:clamp(pct,0,1),at:Date.now()};store.set(B,b);return true}
  function share(book){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('read',book.slug);return nativeShare({title:book.title,text:`${book.title} · ${book.author} · CITYMUS Reader`,url:url.href})}
  return {has,get,settings,setSetting,progress,bookmarks,saveProgress,toggleBookmark,share};
})();

Router.register('reader',(el,p)=>{
  const book=Reader.get(p.slug);
  if(!book){el.innerHTML='<div class="wrap"><div class="empty"><b>這本書目前沒有合法原文版本</b><p>只有通過公版／開放授權白名單的原文會出現在 CITYMUS Reader。</p></div></div>';return}
  const s=Reader.settings(), saved=Reader.progress()[book.slug], mark=Reader.bookmarks()[book.slug], sections=book.sections||[];
  el.innerHTML=`<div class="reader" data-reader-theme="${esc(s.theme)}" style="--reader-size:${s.size}px;--reader-line:${s.line};--reader-width:${s.width}px">
    <div class="reader__progress" aria-hidden="true"><i id="readerProgress"></i></div>
    <header class="reader__mast"><span class="reader__eyebrow">CITYMUS READER · ORIGINAL TEXT</span><h1>${esc(book.title)}</h1><p>${esc(book.author)}</p><div class="reader__meta"><span>${esc(book.lang)}</span><span>${book.chars.toLocaleString()} 字元</span><span>公版原文</span></div></header>
    <div class="reader__tools glass" id="readerTools">
      <button type="button" data-r="toc" aria-label="目錄">${icon('list')}</button><button type="button" data-r="smaller" aria-label="縮小字體">A−</button><button type="button" data-r="larger" aria-label="放大字體">A＋</button><button type="button" data-r="line" aria-label="切換行距">↕</button><button type="button" data-r="width" aria-label="切換頁寬">↔</button><button type="button" data-r="theme" aria-label="切換閱讀背景">${icon('moon')}</button><button type="button" data-r="mark" aria-label="書籤" class="${mark?'is-active':''}">${icon(mark?'heartFill':'heart')}</button>
    </div>
    <article class="reader__paper" id="readerPaper" lang="${esc(book.lang)}">${sections.map((sec,i)=>`<section class="reader-chapter" id="read-${esc(sec.id||('s'+i))}"><h2>${esc(sec.title||book.title)}</h2>${(sec.paragraphs||[]).map(x=>`<p>${esc(x)}</p>`).join('')}</section>`).join('')}</article>
    <footer class="reader__source"><b>原文來源</b><p>${esc(book.rights)}</p><a href="${esc(book.url)}" target="_blank" rel="noopener">${esc(book.source)} · 查看來源與權利資訊</a></footer>
  </div>`;
  const host=$('.reader',el), bar=byId('readerProgress');
  const apply=()=>{const q=Reader.settings();host.dataset.readerTheme=q.theme;host.style.setProperty('--reader-size',q.size+'px');host.style.setProperty('--reader-line',q.line);host.style.setProperty('--reader-width',q.width+'px')};
  let ticking=false; const sync=()=>{ticking=false;const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),pct=clamp(scrollY/max,0,1);bar.style.transform=`scaleX(${pct})`;Reader.saveProgress(book.slug,scrollY,pct)};
  const onScroll=()=>{if(!ticking){ticking=true;requestAnimationFrame(sync)}}; window.addEventListener('scroll',onScroll,{passive:true}); el._readerCleanup?.(); el._readerCleanup=()=>window.removeEventListener('scroll',onScroll);
  byId('readerTools').onclick=e=>{
    const a=e.target.closest('[data-r]')?.dataset.r;if(!a)return;haptic();const q=Reader.settings();
    if(a==='larger')Reader.setSetting('size',clamp(q.size+1,16,28)); if(a==='smaller')Reader.setSetting('size',clamp(q.size-1,16,28)); if(a==='line')Reader.setSetting('line',q.line>=2.05?1.65:q.line+.2); if(a==='width')Reader.setSetting('width',q.width>=820?580:q.width+120); if(a==='theme')Reader.setSetting('theme',q.theme==='paper'?'sepia':q.theme==='sepia'?'night':'paper');
    if(a==='mark'){const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),pct=clamp(scrollY/max,0,1),on=Reader.toggleBookmark(book.slug,scrollY,pct),b=e.target.closest('button');b.classList.toggle('is-active',on);b.innerHTML=icon(on?'heartFill':'heart');toast(on?'已加入閱讀書籤':'已移除閱讀書籤')}
    if(a==='toc')Sheet.open({title:'目錄',sub:book.title,label:'閱讀目錄',html:`<div class="menu">${sections.map(sec=>`<button type="button" data-sec="${esc(sec.id)}">${icon('book')}${esc(sec.title)}</button>`).join('')}</div>`,mount(body,api){body.onclick=ev=>{const id=ev.target.closest('[data-sec]')?.dataset.sec;if(!id)return;api.close();setTimeout(()=>document.getElementById('read-'+CSS.escape(id))?.scrollIntoView({behavior:REDUCE?'auto':'smooth'}),120)}}});
    apply();
  };
  bus.on('reader-setting',apply); requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo(0,saved?.y||0);sync()}));
});
bus.on('share-current',()=>{if(Router.view==='reader'){const b=Reader.get(Router.params.slug);if(b)Reader.share(b)}});
