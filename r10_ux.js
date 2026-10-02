/* =====================================================================
   CITYMUSIC R10 · Flow & Glass shell
   ---------------------------------------------------------------------
   Talks to the app only through window.MT and the mt:* events
   (mt:ready, mt:view, mt:group, mt:track, mt:welcome, mt:segment).
   Injected as the "r10-ux-script" block by apply_r10_ux.py; must be the
   last script in <body>.
   ===================================================================== */
(()=>{
'use strict';
const MT=window.MT;
if(!MT){console.warn('[CITYMUSIC R10] window.MT missing; shell disabled');return}

const $=id=>document.getElementById(id);
const body=document.body,root=document.documentElement;
const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=MT.esc;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const h=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n};

/* ---------------- icons ---------------- */
const SV=(d,extra='')=>`<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON={
  explore:SV('<circle cx="12" cy="12" r="8.6"/><ellipse cx="12" cy="12" rx="3.7" ry="8.6"/><path d="M3.6 12h16.8"/>'),
  search:SV('<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/>'),
  library:SV('<path d="M5.2 4.5v15M9.2 4.5v15"/><path d="m12.8 5.3 4.4-1.1 3.3 14.7-4.4 1.1z"/>'),
  passbook:SV('<path d="M4 8.2c.9 0 1.6-.7 1.6-1.6h12.8c0 .9.7 1.6 1.6 1.6v2.2a1.6 1.6 0 0 0 0 3.2v2.2c-.9 0-1.6.7-1.6 1.6H5.6c0-.9-.7-1.6-1.6-1.6v-2.2a1.6 1.6 0 0 0 0-3.2z"/><path d="M14.4 7.4v1.6M14.4 11.2v1.6M14.4 15v1.6"/>'),
  back:SV('<path d="M15 5 8 12l7 7"/>'),
  chev:SV('<path d="m9 6 6 6-6 6"/>'),
  dice:SV('<rect x="4.5" y="4.5" width="15" height="15" rx="3.6"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'),
  share:SV('<path d="M12 15V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/><path d="M5.5 11.5v6.3c0 .9.8 1.7 1.7 1.7h9.6c.9 0 1.7-.8 1.7-1.7v-6.3"/>'),
  play:SV('<path d="M8 5.6v12.8l10.4-6.4z" fill="currentColor" stroke="none"/>'),
  pause:SV('<rect x="6.8" y="5.6" width="3.7" height="12.8" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.5" y="5.6" width="3.7" height="12.8" rx="1.1" fill="currentColor" stroke="none"/>'),
  next:SV('<path d="M5.5 6.2v11.6l8.7-5.8z" fill="currentColor" stroke="none"/><rect x="15.6" y="6.2" width="2.6" height="11.6" rx="1" fill="currentColor" stroke="none"/>'),
  shuffle:SV('<path d="M3.5 7h3.3c1.9 0 3 .9 4.1 2.6l1.9 3.2c1 1.7 2.2 2.7 4.1 2.7h3.6"/><path d="m17.8 13 2.7 2.5-2.7 2.5"/><path d="M3.5 17h3.3c1.3 0 2.3-.5 3.1-1.3M13.2 8.3c.8-.8 1.8-1.3 3.1-1.3h4.2"/><path d="m17.8 4.5 2.7 2.5-2.7 2.5"/>'),
  repeat:SV('<path d="M4.5 11V9.5a3 3 0 0 1 3-3h11"/><path d="m16 4 2.6 2.5L16 9"/><path d="M19.5 13v1.5a3 3 0 0 1-3 3h-11"/><path d="m8 20-2.6-2.5L8 15"/>'),
  output:SV('<path d="M5 13.5V12a7 7 0 0 1 14 0v1.5"/><rect x="4" y="13" width="4" height="6.5" rx="1.6"/><rect x="16" y="13" width="4" height="6.5" rx="1.6"/>'),
  close:SV('<path d="m7 7 10 10M17 7 7 17"/>')
};

/* =====================================================================
   1 · build the shell
   ===================================================================== */
const TABS=[
  {key:'explore',label:'探索'},
  {key:'search',label:'搜尋'},
  {key:'library',label:'音樂庫'},
  {key:'passbook',label:'票夾'}
];

const top=h('header','',`
  <div class="mt-top-left">
    <button class="mt-back mt-glass" type="button" id="mtBack" aria-label="回到探索">${ICON.back}<span>探索</span></button>
  </div>
  <div class="mt-brand" id="mtBrand">
    <div class="mt-top-title mt-glass" id="mtTopTitle" aria-hidden="true"></div>
  </div>
  <div class="mt-top-right">
    <button class="mt-icon-btn mt-glass" type="button" id="mtTopAction" aria-label="隨機打開一個主題" title="隨機打開一個主題">${ICON.dice}</button>
  </div>`);
top.id='mtTop';
body.appendChild(top);

/* the animated globe logo keeps its listeners and the per-frame path update */
const logo=$('logo');
if(logo){
  logo.className='mt-logo mt-glass';
  logo.setAttribute('aria-label','CITYMUSIC · 回到探索');
  const cityWord=logo.querySelector('.logo-wordmark,.mt-logo-word');
  if(cityWord){cityWord.setAttribute('class','mt-logo-word');cityWord.textContent='CITYMUSIC';}
  $('mtBrand').prepend(logo);
  /* the core click handler calls backToStage(); route it through history instead */
  logo.addEventListener('click',e=>{e.stopImmediatePropagation();goHome();},true);
}

const tabMarkup=TABS.map((t,i)=>`<button class="mt-tab" type="button" role="tab" data-tab="${t.key}" data-i="${i}" aria-label="${t.label}">${ICON[t.key]}<span>${t.label}</span>${t.key==='passbook'?'<i class="mt-badge" id="mtPassBadge"></i>':''}</button>`).join('');
const dock=h('div','',`
  <div id="mtMini" class="mt-glass" role="region" aria-label="正在播放">
    <button class="mt-mini-main" type="button" id="mtMiniOpen" aria-label="打開播放器">
      <span class="mt-mini-disc" aria-hidden="true"></span>
      <span class="mt-mini-copy"><b id="mtMiniTitle">—</b><span id="mtMiniSub"></span></span>
    </button>
    <button class="mt-mini-btn" type="button" data-mini="play" aria-label="播放">${ICON.play}</button>
    <button class="mt-mini-btn" type="button" data-mini="next" aria-label="下一首">${ICON.next}</button>
    <i class="mt-mini-progress" aria-hidden="true"><i></i></i>
  </div>
  <nav id="mtTabs" class="mt-glass" role="tablist" aria-label="主要導覽">
    <div class="mt-tabs-strip">${tabMarkup}</div>
    <div class="mt-lens" aria-hidden="true"><div class="mt-lens-strip">${tabMarkup.replace(/ id="mtPassBadge"/,'').replace(/<button /g,'<span ').replace(/<\/button>/g,'</span>').replace(/ type="button" role="tab"/g,'')}</div></div>
    <button class="mt-tab-compact" type="button" id="mtTabCompact" aria-label="展開導覽列"></button>
  </nav>`);
dock.id='mtDock';
body.appendChild(dock);

const resume=h('div','mt-glass',`
  <button class="mt-resume-go" type="button" id="mtResumeGo"><i>${ICON.play}</i><span><small>從上次停下的地方繼續</small><b id="mtResumeTitle"></b></span></button>
  <button class="mt-resume-x" type="button" id="mtResumeX" aria-label="不用了">${ICON.close}</button>`);
resume.id='mtResume';
body.appendChild(resume);

/* SVG displacement map for the refracting capsule (Chromium renders it
   through backdrop-filter:url(); elsewhere the lens is plain frosted glass) */
const svgNS='http://www.w3.org/2000/svg';
const defs=document.createElementNS(svgNS,'svg');
defs.setAttribute('width','0');defs.setAttribute('height','0');defs.setAttribute('aria-hidden','true');
defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
defs.innerHTML='<filter id="mtRefract" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="80" height="52"><feImage id="mtRefractMap" x="0" y="0" width="80" height="52" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>';
body.appendChild(defs);
const canRefract=!!window.chrome&&CSS.supports?.('backdrop-filter','url(#mtRefract)')&&!matchMedia('(prefers-reduced-transparency: reduce)').matches;
function buildRefraction(w,hh){
  if(!canRefract||w<8||hh<8)return;
  w=Math.round(w);hh=Math.round(hh);
  const c=document.createElement('canvas');c.width=w;c.height=hh;
  const ctx=c.getContext('2d'),img=ctx.createImageData(w,hh),d=img.data;
  const r=hh/2,edge=Math.min(13,r*.62),zoom=.12;
  for(let y=0;y<hh;y++)for(let x=0;x<w;x++){
    const px=clamp(x+.5,r,w-r),dx=x+.5-px,dy=y+.5-r,dist=Math.hypot(dx,dy),inside=r-dist;
    let ox=-(x+.5-w/2)/(w/2)*zoom,oy=-(y+.5-hh/2)/(hh/2)*zoom;
    if(inside<edge&&dist>0){const k=Math.pow(1-Math.max(0,inside)/edge,2.2);ox-=dx/dist*k*.85;oy-=dy/dist*k*.85;}
    const o=(y*w+x)*4;
    d[o]=clamp(128+ox*127,0,255);d[o+1]=clamp(128+oy*127,0,255);d[o+2]=128;d[o+3]=255;
  }
  ctx.putImageData(img,0,0);
  const f=$('mtRefract'),m=$('mtRefractMap');
  [f,m].forEach(n=>{n.setAttribute('width',w);n.setAttribute('height',hh)});
  m.setAttribute('href',c.toDataURL());
  document.querySelector('.mt-lens')?.classList.add('is-refracting');
}

/* =====================================================================
   2 · glass capsule (tab bar + segmented controls share one behaviour):
   tap to move, press-and-hold to enlarge, drag to slide, release to snap
   ===================================================================== */
function capsule({host,items,lens,getIndex,onCommit,onMove,inset=0,disabled=()=>false}){
  let drag=null,pressTimer=0;
  const widthOf=()=>(host.clientWidth-inset*2)/items().length;
  const place=(x,animate=true)=>{
    host.classList.toggle('is-dragging',!animate);
    onMove(x,widthOf());
  };
  const indexAt=clientX=>{
    const r=host.getBoundingClientRect();
    return clamp(Math.floor((clientX-r.left-inset)/widthOf()),0,items().length-1);
  };
  host.addEventListener('pointerdown',e=>{
    if(e.button>0||disabled())return;
    const r=host.getBoundingClientRect();
    drag={id:e.pointerId,x0:e.clientX,lx0:getIndex()*widthOf(),moved:false,onLens:!!lens&&e.target.closest('.mt-lens,.mt-seg-lens')===lens,left:r.left};
    clearTimeout(pressTimer);
    pressTimer=setTimeout(()=>host.classList.add('is-pressed'),drag.onLens?0:110);
    try{host.setPointerCapture(e.pointerId)}catch(_){}
  });
  host.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x0;
    if(!drag.moved&&Math.abs(dx)<7)return;
    drag.moved=true;host.classList.add('is-pressed');
    const w=widthOf();
    const x=drag.onLens?drag.lx0+dx:(e.clientX-drag.left-inset-w/2);
    place(clamp(x,0,w*(items().length-1)),false);
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    clearTimeout(pressTimer);
    host.classList.remove('is-pressed','is-dragging');
    const i=drag.moved?clamp(Math.round(parseFloat(getComputedStyle(host).getPropertyValue(host.classList.contains('mt-seg')?'--sx':'--lx'))/widthOf()),0,items().length-1):indexAt(e.clientX);
    const wasDrag=drag.moved;drag=null;
    if(e.type==='pointercancel'){place(getIndex()*widthOf());return}
    onCommit(i,wasDrag);
  };
  host.addEventListener('pointerup',end);
  host.addEventListener('pointercancel',end);
  /* keyboard: the buttons stay real buttons; clicks without a pointer (Enter/Space) commit directly */
  host.addEventListener('click',e=>{
    if(!e.isTrusted||e.detail!==0)return;e.preventDefault();
    const b=e.target.closest('[data-i],[data-welcome-macro]');if(!b)return;
    onCommit(items().indexOf(b),false);
  });
  host.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    const list=items(),i=list.indexOf(document.activeElement);if(i<0)return;
    e.preventDefault();list[clamp(i+(e.key==='ArrowRight'?1:-1),0,list.length-1)].focus();
  });
  return {place:i=>place(i*widthOf())};
}

/* ----- tab bar ----- */
const tabsEl=$('mtTabs');
const tabBtns=()=>[...tabsEl.querySelectorAll('.mt-tabs-strip .mt-tab')];
let activeTab='explore';
const tabIndex=()=>TABS.findIndex(t=>t.key===activeTab);
function setLens(x,w){
  tabsEl.style.setProperty('--lx',x+'px');
  tabsEl.style.setProperty('--lw',w+'px');
  tabsEl.style.setProperty('--tw',tabsEl.clientWidth+'px');
}
const tabCapsule=capsule({
  host:tabsEl,items:tabBtns,lens:tabsEl.querySelector('.mt-lens'),inset:5,
  getIndex:tabIndex,
  onMove:setLens,
  disabled:()=>innerWidth<900&&body.classList.contains('mt-compact')&&body.classList.contains('mt-has-track'),
  onCommit:(i,wasDrag)=>selectTab(TABS[i].key,{fromUser:true,wasDrag})
});
function paintTabs(){
  const i=tabIndex();
  tabBtns().forEach((b,k)=>{b.setAttribute('aria-selected',k===i?'true':'false');b.tabIndex=k===i?0:-1;});
  const w=(tabsEl.clientWidth-10)/TABS.length;
  setLens(i*w,w);
  $('mtTabCompact').innerHTML=ICON[activeTab];
  $('mtTabCompact').setAttribute('aria-label',`${TABS[i].label} · 展開導覽列`);
  const lens=tabsEl.querySelector('.mt-lens');
  if(lens&&canRefract&&lens.dataset.w!==String(Math.round(w))){lens.dataset.w=String(Math.round(w));buildRefraction(w,lens.offsetHeight||52);}
}
const PAGES={search:'globalSearchSheet',library:'localLibrarySheet',passbook:'passbookSheet'};
const pageOpen=k=>$(PAGES[k])?.classList.contains('open');
function closePages(except){
  if(except!=='search'&&pageOpen('search'))MT.closeSearch();
  if(except!=='library'&&pageOpen('library'))MT.closeLibrary();
  if(except!=='passbook'&&pageOpen('passbook'))MT.closePassbook();
}
function selectTab(key,{fromUser=false,wasDrag=false}={}){
  const was=activeTab;
  if(key==='explore'){
    const hadPage=Object.keys(PAGES).some(pageOpen);
    closePages();
    /* tapping 探索 again while already there pops back to the drawer */
    if(fromUser&&!wasDrag&&!hadPage&&was==='explore'&&MT.view==='branch')goHome();
  }else{
    closePages(key);
    if(!pageOpen(key)){
      if(key==='search')$('globalSearchBtn')?.click();
      if(key==='library')$('localLibraryFab')?.click();
      if(key==='passbook')$('passbookOpen')?.click();
    }else if(key==='search'){
      $('globalSearchInput')?.focus();
    }
  }
  activeTab=key;paintTabs();syncPageState();
}
$('mtTabCompact').addEventListener('click',()=>{body.classList.remove('mt-compact');});

/* the tab follows the pages, however they were opened or closed */
function syncPageState(){
  const open=Object.keys(PAGES).find(pageOpen);
  if(!!open!==body.classList.contains('mt-tabpage'))body.classList.remove('mt-compact');
  body.classList.toggle('mt-tabpage',!!open);
  const want=open||'explore';
  if(want!==activeTab){activeTab=want;paintTabs();}
}
const modalIds=['shareComposerSheet','sharePlaylistSheet','libraryNameSheet','libraryPassSheet','sharedLibrarySheet','cityPassSheet','passWelcomeSheet','audioAccessorySheet'];
function syncModalState(){
  body.classList.toggle('mt-modal-open',modalIds.some(id=>$(id)?.classList.contains('open')));
  body.classList.toggle('mt-player-open',!!$('playerSheet')?.classList.contains('open'));
}
const classWatch=new MutationObserver(()=>{syncPageState();syncModalState();onPlayerToggle();});
[...Object.values(PAGES),...modalIds,'playerSheet'].forEach(id=>{const n=$(id);if(n)classWatch.observe(n,{attributes:true,attributeFilter:['class']})});

/* passbook badge mirrors the core counter */
const passCount=$('passbookCount');
function syncBadge(){const n=Number(passCount?.textContent||0)||0;const b=$('mtPassBadge');if(b)b.textContent=n?String(n):'';}
if(passCount)new MutationObserver(syncBadge).observe(passCount,{childList:true,characterData:true,subtree:true});
syncBadge();

/* ----- welcome segmented control (same capsule behaviour) ----- */
function enhanceSegment(host){
  if(!host)return;
  let lens=host.querySelector('.mt-seg-lens');
  if(!lens){lens=h('span','mt-seg-lens');lens.setAttribute('aria-hidden','true');host.prepend(lens);}
  const items=()=>[...host.querySelectorAll('.mt-seg-item')];
  const idx=()=>Math.max(0,items().findIndex(b=>b.classList.contains('is-active')));
  const move=(x,w)=>{host.style.setProperty('--sx',x+'px');host.style.setProperty('--sw',w+'px');};
  if(!host.dataset.mtCapsule){
    host.dataset.mtCapsule='1';
    /* the welcome steps start hidden (zero width); re-place once visible */
    if('ResizeObserver' in window)new ResizeObserver(()=>{const w=(host.clientWidth-8)/Math.max(1,items().length);if(w>0)move(idx()*w,w);}).observe(host);
    capsule({host,items,lens,inset:4,getIndex:idx,onMove:move,onCommit:i=>{const b=items()[i];if(b&&!b.classList.contains('is-active'))b.click();else{const w=(host.clientWidth-8)/items().length;move(idx()*w,w);}}});
  }
  requestAnimationFrame(()=>{const w=(host.clientWidth-8)/Math.max(1,items().length);move(idx()*w,w);});
}
document.addEventListener('mt:segment',e=>enhanceSegment(e.detail?.host));
enhanceSegment($('welcomeMacroSeg'));

/* =====================================================================
   3 · history: every theme has a URL (#t=slug) and the back button works
   ===================================================================== */
let routing=false,lastGesture=0,lastThemeIndex=-1,homeAt=0,groupAt=0;
['pointerdown','keydown'].forEach(t=>addEventListener(t,()=>{lastGesture=performance.now()},true));
const homeUrl=()=>location.pathname+location.search;
function goHome(){
  const depth=history.state?.mtDepth||0;
  if(history.state?.mtTheme&&depth>0){history.go(-depth);return}
  MT.home();
}
document.addEventListener('mt:view',e=>{
  const v=e.detail||{};
  if(v.view==='detail'){
    lastThemeIndex=v.index;
    if(!routing){
      const slug=MT.themeSlug(v.theme),target='#t='+slug;
      if(location.hash!==target){
        const user=performance.now()-lastGesture<1500&&!MT.welcomeActive;
        const depth=(history.state?.mtDepth||0)+1;
        if(user)history.pushState({mtTheme:slug,mtDepth:depth},'',target);
        else history.replaceState({mtTheme:slug,mtDepth:history.state?.mtDepth||0},'',target);
      }
    }
  }else if(v.view==='home'){
    if(!routing&&/^#t=/.test(location.hash))history.replaceState({mtHome:1},'',homeUrl());
    /* land on the drawer that holds the theme you just left */
    homeAt=performance.now();
    const from=MT.DATA[lastThemeIndex];
    if(from){
      const gk=MT.themeGroupKeyForName(from.t);
      setTimeout(()=>{if(MT.view==='stage'&&groupAt<homeAt&&MT.groupKey!==gk)MT.stageGroup(gk)},0);
    }
  }
  onView(v);
});
document.addEventListener('mt:group',()=>{groupAt=performance.now()});
addEventListener('popstate',()=>{
  routing=true;
  try{
    const m=location.hash.match(/^#t=([a-z0-9-]+)/);
    if(m){
      const i=MT.themeIndexBySlug(m[1]);
      if(i>=0&&(MT.view!=='branch'||MT.themeIndex!==i)){closePages();MT.showTheme(i);}
    }else if(MT.view==='branch'&&!/^#(mix|library)=/.test(location.hash)){
      closePages();MT.home();
    }
  }finally{routing=false}
});
function openInitialRoute(){
  const m=location.hash.match(/^#t=([a-z0-9-]+)/);
  if(!m)return;
  const i=MT.themeIndexBySlug(m[1]);
  if(i<0)return;
  routing=true;
  try{MT.showTheme(i);history.replaceState({mtTheme:m[1],mtDepth:0},'',location.href);}finally{routing=false}
}

/* =====================================================================
   4 · views: top bar, detail page additions
   ===================================================================== */
function onView(v){
  const detail=v.view==='detail';
  body.classList.toggle('mt-view-detail',detail);
  body.classList.toggle('mt-view-home',!detail);
  body.classList.remove('mt-compact','mt-title-docked','mt-scrolled');
  lastY=0;
  const act=$('mtTopAction');
  if(detail){
    const d=MT.DATA[v.index],nm=MT.splitThemeName(d.t);
    $('mtTopTitle').textContent=nm.main;
    act.innerHTML=ICON.share;act.setAttribute('aria-label',`分享 ${nm.main}`);act.title='分享這個主題';
    decorateDetail(v.index);
  }else{
    act.innerHTML=ICON.dice;act.setAttribute('aria-label','隨機打開一個主題');act.title='隨機打開一個主題';
    updateResume();
  }
  requestAnimationFrame(measure);
}
$('mtBack').addEventListener('click',goHome);
$('mtTopTitle').addEventListener('click',()=>scrollTo({top:0,behavior:REDUCE?'auto':'smooth'}));
$('mtTopAction').addEventListener('click',()=>{
  if(MT.view==='branch'){$('shareDrawerBtn')?.click();return}
  const pool=MT.DATA.map((d,i)=>i).filter(i=>MT.DATA[i].tracks?.length&&i!==lastThemeIndex);
  if(pool.length)MT.showTheme(pool[Math.floor(Math.random()*pool.length)]);
});

let detailBuilt=false;
function buildDetailOnce(){
  if(detailBuilt)return;detailBuilt=true;
  const heroCopy=document.querySelector('#detail .music-hero > div');
  heroCopy?.prepend(h('nav','mt-crumbs'));
  heroCopy?.querySelector('.mt-crumbs')?.setAttribute('aria-label','你在這裡');
  const actions=h('div','mt-detail-actions',`
    <button class="mt-act is-primary" type="button" data-act="play">${ICON.play}<span>播放全部</span></button>
    <button class="mt-act mt-glass" type="button" data-act="shuffle">${ICON.shuffle}<span>隨機播放</span></button>`);
  document.querySelector('#detail .music-hero')?.after(actions);
  const share=$('shareDrawerBtn'),pass=$('cityPassBtn');
  if(share){share.className='';share.querySelector('span').textContent='分享';actions.appendChild(share);}
  if(pass){pass.className='';actions.appendChild(pass);}
  actions.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    MT.playTheme(MT.themeIndex,{shuffle:b.dataset.act==='shuffle'});
  });
  $('shuffleBtn')?.setAttribute('hidden','');
  if($('shuffleBtn'))$('shuffleBtn').style.display='none';

  const list=$('trackList');
  const more=h('button','mt-more');more.type='button';more.id='mtMoreTracks';
  list?.after(more);
  more.addEventListener('click',()=>{
    const open=list.classList.toggle('mt-collapsed')===false;
    paintMore();
    if(!open)list.closest('.music-panel')?.scrollIntoView({block:'start',behavior:REDUCE?'auto':'smooth'});
  });
  $('genreSearch')?.addEventListener('input',()=>{list.classList.toggle('mt-collapsed',!$('genreSearch').value.trim()&&list.dataset.mtLong==='1');paintMore();});

  const next=h('section','mt-next');next.id='mtNext';
  document.querySelector('#detail .music-grid')?.after(next);
  next.addEventListener('click',e=>{
    const card=e.target.closest('[data-theme-index]');
    if(card){MT.showTheme(Number(card.dataset.themeIndex));return}
  });
}
function paintMore(){
  const list=$('trackList'),more=$('mtMoreTracks');if(!list||!more)return;
  const n=list.querySelectorAll('.track-row').length;
  const long=n>12;list.dataset.mtLong=long?'1':'0';
  more.hidden=!long;
  const collapsed=list.classList.contains('mt-collapsed');
  more.setAttribute('aria-expanded',collapsed?'false':'true');
  more.innerHTML=collapsed?`顯示全部 ${n} 首<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`:`收起<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
}
function neighbour(list,i,dir){
  /* walk the whole atlas in group order so every theme links onward */
  const all=Object.values(MT.HOME_GROUPS).flatMap(g=>g.items);
  const k=all.indexOf(list[i]);
  const name=all[(k+dir+all.length)%all.length];
  return MT.DATA.findIndex(d=>d.t===name);
}
function decorateDetail(index){
  buildDetailOnce();
  const d=MT.DATA[index];if(!d)return;
  const gk=MT.themeGroupKeyForName(d.t),g=MT.HOME_GROUPS[gk],nm=MT.splitThemeName(d.t);

  const crumbs=document.querySelector('#detail .mt-crumbs');
  if(crumbs)crumbs.innerHTML=`<button type="button" data-mt-action="home">探索</button>${ICON.chev}<button type="button" data-mt-action="stage-group" data-group="${gk}">${esc(g?.zh||'主題')}</button>${ICON.chev}<span aria-current="page">${esc(nm.main)}</span>`;

  const list=$('trackList');
  if(list){list.classList.add('mt-collapsed');}
  requestAnimationFrame(paintMore);

  const next=$('mtNext');
  if(next&&g){
    const at=g.items.indexOf(d.t);
    const cards=g.items.map((name,i)=>{
      const di=MT.DATA.findIndex(x=>x.t===name);if(di<0)return '';
      const n2=MT.splitThemeName(name),ui=MT.genreUiFor(name),cnt=MT.DATA[di].tracks?.length||0;
      const cur=di===index;
      return `<button type="button" class="mt-theme-card${cur?' is-current':''}" data-theme-index="${di}" ${cur?'aria-current="page"':''} style="--card-accent:${ui.accent}"><i>${String(i+1).padStart(2,'0')}</i><b>${esc(n2.main)}</b><span>${esc(cur?'你在這裡':(n2.sub||`${cnt} 首`))}</span></button>`;
    }).join('');
    const pi=neighbour(g.items,at,-1),ni=neighbour(g.items,at,1);
    const pName=MT.splitThemeName(MT.DATA[pi]?.t).main,nName=MT.splitThemeName(MT.DATA[ni]?.t).main;
    next.innerHTML=`
      <div class="mt-next-head"><h3>下一站</h3><span>同在「${esc(g.zh)}」的 ${g.items.length} 個主題</span></div>
      <div class="mt-shelf-cards">${cards}</div>
      <div class="mt-next-nav">
        <button type="button" data-theme-index="${pi}"><small>上一站</small><b>‹ ${esc(pName)}</b></button>
        <button type="button" data-theme-index="${ni}"><small>下一站</small><b>${esc(nName)} ›</b></button>
      </div>
      <div class="mt-next-foot"><button type="button" class="mt-text-btn" data-mt-action="home">回到探索</button></div>`;
    requestAnimationFrame(()=>{
      const row=next.querySelector('.mt-shelf-cards'),cur=row?.querySelector('.is-current');
      if(row&&cur)row.scrollLeft=Math.max(0,cur.offsetLeft-row.clientWidth/2+cur.offsetWidth/2);
    });
  }
}
/* the core re-renders #trackList on search; keep the "show all" button honest */
if($('trackList'))new MutationObserver(()=>requestAnimationFrame(paintMore)).observe($('trackList'),{childList:true});

/* =====================================================================
   5 · mini player
   ===================================================================== */
let boundAudio=null;
const mini=$('mtMini'),miniPlay=mini.querySelector('[data-mini="play"]'),miniBar=mini.querySelector('.mt-mini-progress');
function trackTheme(t){const gi=MT.themeIndexOfTrack(t);return gi>=0?MT.DATA[gi].t:null}
function paintMini(){
  const t=MT.track,a=MT.audio;
  body.classList.toggle('mt-has-track',!!t);
  if(!t){return}
  const theme=trackTheme(t);
  $('mtMiniTitle').textContent=t.title||'CITYMUSIC';
  $('mtMiniSub').textContent=[t.artist,theme?MT.splitThemeName(theme).main:(t.localPersonal?'本機音樂':'')].filter(Boolean).join(' · ');
  mini.style.setProperty('--mini-vinyl',theme?MT.genreUiFor(theme).accent:'#8f8bbb');
  const playing=!!a&&!a.paused;
  body.classList.toggle('mt-playing',playing);
  miniPlay.innerHTML=playing?ICON.pause:ICON.play;
  miniPlay.setAttribute('aria-label',playing?'暫停':'播放');
  paintProgress();
}
function paintProgress(){
  const a=MT.audio;const dur=a&&Number.isFinite(a.duration)?a.duration:0;
  miniBar.style.setProperty('--p',dur?String(clamp(a.currentTime/dur,0,1)):'0');
}
function bindAudio(a){
  if(boundAudio===a)return;
  if(boundAudio){['play','pause','ended','loadedmetadata'].forEach(ev=>boundAudio.removeEventListener(ev,paintMini));boundAudio.removeEventListener('timeupdate',paintProgress);}
  boundAudio=a;
  if(a){['play','pause','ended','loadedmetadata'].forEach(ev=>a.addEventListener(ev,paintMini));a.addEventListener('timeupdate',paintProgress);}
}
document.addEventListener('mt:track',e=>{
  bindAudio(e.detail?.audio||MT.audio);
  paintMini();updateResume();decoratePlayer();
  requestAnimationFrame(measure);
});
$('mtMiniOpen').addEventListener('click',()=>MT.expandPlayer());
miniPlay.addEventListener('click',()=>{MT.togglePlay();setTimeout(paintMini,60)});
mini.querySelector('[data-mini="next"]').addEventListener('click',()=>MT.jump(1));
/* swipe up on the mini player opens the full player */
{let sy=null;mini.addEventListener('pointerdown',e=>{sy=e.clientY},{passive:true});
 mini.addEventListener('pointerup',e=>{if(sy!=null&&sy-e.clientY>28)MT.expandPlayer();sy=null},{passive:true});}

/* =====================================================================
   6 · full player additions: where it came from, tools, up next, swipe down
   ===================================================================== */
let playerBuilt=false,toolsEl=null,upEl=null;
/* tools + up next sit between the deck and the track story; the core rebuilds
   #playerBody on every track, so they are re-inserted each time */
function placePlayerExtras(){
  if(!toolsEl||!upEl)return;
  const pb=$('playerBody');if(!pb)return;
  const story=pb.querySelector('.track-story-grid');
  if(story){story.before(toolsEl,upEl);}
  else if(toolsEl.parentNode!==pb.parentNode||toolsEl.previousElementSibling!==pb){pb.after(toolsEl,upEl);}
}
function buildPlayerOnce(){
  if(playerBuilt)return;
  const card=document.querySelector('#playerSheet .player-card');if(!card)return;
  playerBuilt=true;
  card.prepend(h('div','mt-grab'));
  card.querySelector('.mt-grab').setAttribute('aria-hidden','true');
  const from=h('div','mt-player-from');from.id='mtPlayerFrom';
  card.querySelector('.player-head')?.after(from);
  const tools=h('div','mt-player-tools');tools.id='mtPlayerTools';
  const up=h('section','mt-upnext');up.id='mtUpNext';
  toolsEl=tools;upEl=up;placePlayerExtras();
  from.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.go==='library'){MT.closePlayer();selectTab('library',{fromUser:true});return}
    const i=Number(b.dataset.go);
    MT.closePlayer();
    if(Number.isInteger(i)&&i>=0&&!(MT.view==='branch'&&MT.themeIndex===i)){closePages();MT.showTheme(i);}
    else closePages();
  });
  tools.addEventListener('click',e=>{
    const b=e.target.closest('[data-tool]');if(!b)return;
    const tool=b.dataset.tool;
    if(tool==='autonext'){MT.setAutoNext(!MT.autoNext);paintTools();decoratePlayer();}
    if(tool==='output')MT.openAudioOutput();
    if(tool==='share'&&MT.track){const t=MT.track;MT.shareTracks([t],t.title||'CITYMUSIC');}
  });
  up.addEventListener('click',e=>{
    const b=e.target.closest('[data-up]');if(!b)return;
    const t=upNextCache[Number(b.dataset.up)];if(t)MT.openTrack(t,true);
  });
  /* swipe down to close (phones) */
  let drag=null;
  const startDrag=e=>{
    if(innerWidth>760||card.scrollTop>2)return;
    if(e.target.closest('button,input,a,.vinyl-wrap'))return;
    drag={y0:e.clientY,id:e.pointerId,dy:0};
  };
  const moveDrag=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    drag.dy=Math.max(0,e.clientY-drag.y0);
    if(drag.dy>4){$('playerSheet').classList.add('mt-dragging');card.style.transform=`translateY(${drag.dy}px)`;}
  };
  const endDrag=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dy=drag.dy;drag=null;
    $('playerSheet').classList.remove('mt-dragging');
    if(dy>110){card.style.transform=`translateY(100%)`;setTimeout(()=>{MT.closePlayer();card.style.transform='';},REDUCE?0:220);}
    else card.style.transform='';
  };
  [card.querySelector('.mt-grab'),card.querySelector('.player-head'),from].forEach(n=>{
    n?.addEventListener('pointerdown',startDrag);
  });
  addEventListener('pointermove',moveDrag,{passive:true});
  addEventListener('pointerup',endDrag);
  addEventListener('pointercancel',endDrag);
}
let upNextCache=[];
function paintTools(){
  const tools=toolsEl;if(!tools)return;
  const on=MT.autoNext;
  tools.innerHTML=`
    <button type="button" data-tool="autonext" id="autoNextProxy" class="${on?'active':''}" aria-pressed="${on}">${ICON.repeat}<span>${on?'自動播下一首':'播完就停'}</span></button>
    <button type="button" data-tool="output">${ICON.output}<span>音訊輸出</span></button>
    ${MT.track?.shareId?`<button type="button" data-tool="share">${ICON.share}<span>分享這首</span></button>`:''}`;
  tools.querySelector('#autoNextProxy')?.setAttribute('id','');
  const b=tools.querySelector('[data-tool="autonext"]');
  if(b&&on){b.style.background='var(--mt-ink)';b.style.color='#fff';}
}
function decoratePlayer(){
  buildPlayerOnce();
  placePlayerExtras();
  const t=MT.track;const from=$('mtPlayerFrom'),up=upEl;
  if(!from||!up)return;
  if(!t){from.innerHTML='';up.innerHTML='';return}
  const gi=MT.themeIndexOfTrack(t);
  if(gi>=0){
    const nm=MT.splitThemeName(MT.DATA[gi].t);
    const here=MT.view==='branch'&&MT.themeIndex===gi;
    from.innerHTML=`<button type="button" data-go="${gi}">${here?'正在播放':'來自'} · <span>${esc(nm.main)}</span>${here?'':ICON.chev}</button>`;
  }else if(t.localPersonal||t.librarySaved||t.favoriteSaved){
    from.innerHTML=`<button type="button" data-go="library">來自 · <span>${esc(MT.activeLibraryName())}</span>${ICON.chev}</button>`;
  }else from.innerHTML='';
  paintTools();
  upNextCache=MT.upNext(t,4);
  if(!MT.autoNext){up.innerHTML=`<h4>接下來</h4><p class="mt-upnext-off">自動播放已關閉，這首播完就會停下。</p>`;return}
  up.innerHTML=upNextCache.length?`<h4>接下來</h4><ol>${upNextCache.map((x,k)=>`<li><button type="button" data-up="${k}"><em>${k+1}</em><span><b>${esc(x.title||'Untitled')}</b><small>${esc(x.artist||'')}</small></span>${ICON.play}</button></li>`).join('')}</ol>`:'';
}
function onPlayerToggle(){
  const open=!!$('playerSheet')?.classList.contains('open');
  if(open&&!onPlayerToggle.was){decoratePlayer();scheduleBackdrop();}
  onPlayerToggle.was=open;
}
document.addEventListener('mt:autonext',()=>{paintTools();decoratePlayer();});

/* =====================================================================
   7 · resume pill (returning visitors)
   ===================================================================== */
let resumeDismissed=false;
try{resumeDismissed=sessionStorage.getItem('musicetown.r10.resumeDismissed')==='1'}catch(_){}
function updateResume(){
  const last=resumeDismissed||MT.track?null:MT.lastTrack();
  body.classList.toggle('mt-show-resume',!!last&&MT.view==='stage');
  if(last)$('mtResumeTitle').textContent=`${last.track.title} · ${MT.splitThemeName(MT.DATA[last.index].t).main}`;
  resume.dataset.index=last?String(last.index):'';
}
$('mtResumeGo').addEventListener('click',()=>{
  const last=MT.lastTrack();if(!last)return;
  body.classList.remove('mt-show-resume');
  MT.showTheme(last.index);
  MT.openTrack(last.track,true);
});
$('mtResumeX').addEventListener('click',()=>{
  resumeDismissed=true;body.classList.remove('mt-show-resume');
  try{sessionStorage.setItem('musicetown.r10.resumeDismissed','1')}catch(_){}
});

/* =====================================================================
   8 · shared actions inside any panel (capture phase: the library panel
   stops propagation of its own clicks)
   ===================================================================== */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-mt-action]');if(!b)return;
  const a=b.dataset.mtAction;
  if(a==='home'||a==='explore'){e.preventDefault();e.stopPropagation();closePages();activeTab='explore';paintTabs();goHome();}
  if(a==='stage-group'){e.preventDefault();e.stopPropagation();closePages();MT.stageGroup(b.dataset.group);}
},true);

/* =====================================================================
   9 · scrolling: blur edge under the top bar, title docking, dock shrink
   ===================================================================== */
let lastY=0,ticking=false;
function onScrollY(y){
  body.classList.toggle('mt-scrolled',y>6);
  if(MT.view==='branch'){
    const title=$('dTitle');
    const edge=top.getBoundingClientRect().bottom;
    body.classList.toggle('mt-title-docked',!!title&&title.getBoundingClientRect().bottom<edge+2);
  }
  const dy=y-lastY;
  if(Math.abs(dy)>8){
    if(dy>0&&y>140)body.classList.add('mt-compact');
    else if(dy<0)body.classList.remove('mt-compact');
    lastY=y;
  }
}
addEventListener('scroll',()=>{
  if(ticking)return;ticking=true;
  requestAnimationFrame(()=>{ticking=false;if(body.classList.contains('mt-tabpage'))return;onScrollY(scrollY);});
},{passive:true});
['globalSearchResults','libraryPanel'].forEach(id=>{
  const n=$(id);if(!n)return;let last=0;
  n.addEventListener('scroll',()=>{
    const y=n.scrollTop,dy=y-last;
    if(Math.abs(dy)>8){body.classList.toggle('mt-compact',dy>0&&y>120);last=y;}
  },{passive:true});
});
document.addEventListener('mt:view',()=>{body.classList.remove('mt-compact')});

/* =====================================================================
   10 · live layout: dock + shelf heights feed CSS (and the WebGL canvas)
   ===================================================================== */
let resizeTimer=0,lastDock=0,lastShelf=0;
function measure(){
  if(body.classList.contains('mt-compact'))return;
  const dockH=Math.round(dock.offsetHeight+(parseFloat(getComputedStyle(dock).bottom)||0)+6);
  const shelf=$('mtShelf');const shelfH=shelf&&!body.classList.contains('detail-open')?Math.round(shelf.offsetHeight):lastShelf;
  let changed=false;
  if(dockH>40&&Math.abs(dockH-lastDock)>1){root.style.setProperty('--mt-dock-h',dockH+'px');lastDock=dockH;changed=true}
  if(shelfH>40&&Math.abs(shelfH-lastShelf)>1){root.style.setProperty('--mt-shelf-h',shelfH+'px');lastShelf=shelfH;changed=true}
  /* the free band the WebGL drawer is framed in (read by the core camera) */
  const sceneTop=Math.round(top.offsetHeight+4);
  const sceneBottom=Math.round((lastDock||dockH)+(lastShelf||shelfH)+(innerWidth<900?14:22));
  if(root.style.getPropertyValue('--mt-scene-top')!==sceneTop+'px'){root.style.setProperty('--mt-scene-top',sceneTop+'px');changed=true}
  if(root.style.getPropertyValue('--mt-scene-bottom')!==sceneBottom+'px'){root.style.setProperty('--mt-scene-bottom',sceneBottom+'px');changed=true}
  if(changed){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>dispatchEvent(new Event('resize')),60);}
  paintTabs();
}
if('ResizeObserver' in window){
  const ro=new ResizeObserver(()=>requestAnimationFrame(measure));
  ro.observe(dock);if($('mtShelf'))ro.observe($('mtShelf'));
}
addEventListener('resize',()=>requestAnimationFrame(()=>{paintTabs();}));

/* =====================================================================
   11 · player backdrop: wordmarks behind the record
   Ratios measured on the reference mock-up (D = record diameter):
   TAIPEI  width 1.163·D (max 93.3% of the card), top edge 0.080·D above the
           record, centred on the text column
   台北     width 0.288·D, bottom edge 0.007·D above the "musicetown · …" line
   To give another theme its own art: add CSS for data-backdrop="<key>" and
   map the theme name below.
   ===================================================================== */
const BACKDROP_DEFAULT='taipei';
const BACKDROP_BY_THEME={/* 'OLD TOKYO':'tokyo' */};
const BD_RATIO={en:{w:1.163,aspect:286/1050,card:.933,top:-.080},zh:{w:.288,aspect:111/266,above:.007,below:.072}};
function backdropKey(t){
  const theme=t?trackTheme(t):null;
  return (theme&&BACKDROP_BY_THEME[theme])||BACKDROP_DEFAULT;
}
function layoutBackdrop(){
  const deck=document.querySelector('#playerBody .musicetown-deck');
  if(!deck)return;
  const vinyl=deck.querySelector('#vinylDisc');
  if(!vinyl)return;
  const key=backdropKey(MT.track);
  let layer=deck.querySelector(':scope > .mt-deck-backdrop');
  if(!key){layer?.remove();deck.classList.remove('mt-has-backdrop');return}
  if(!layer){
    layer=h('div','mt-deck-backdrop','<i class="mt-bd-en"></i><i class="mt-bd-zh"></i>');
    layer.setAttribute('aria-hidden','true');
    deck.prepend(layer);
  }
  layer.dataset.backdrop=key;
  deck.classList.add('mt-has-backdrop');
  const dr=deck.getBoundingClientRect(),vr=vinyl.getBoundingClientRect();
  if(!vr.width||!dr.width)return;
  /* while the sheet is still animating in, sizes are scaled; measure later */
  const scale=deck.offsetWidth?dr.width/deck.offsetWidth:1;
  const D=vr.width/scale;
  const X=v=>(v-dr.left)/scale,Y=v=>(v-dr.top)/scale;
  const eyebrow=deck.querySelector('.deck-eyebrow');
  const er=eyebrow?.getBoundingClientRect();
  const stacked=!!er&&er.top>vr.bottom-2;
  const colCx=stacked?(er.left+er.right)/2:(vr.left+vr.right)/2;
  const en=layer.querySelector('.mt-bd-en'),zh=layer.querySelector('.mt-bd-zh');
  /* TAIPEI */
  /* stacked: limited by the card; side by side: by the record's own column */
  const colW=stacked?deck.offsetWidth:(deck.querySelector('.vinyl-wrap')?.offsetWidth||deck.offsetWidth);
  const w=Math.min(BD_RATIO.en.w*D,colW*BD_RATIO.en.card);
  const hh=w*BD_RATIO.en.aspect;
  Object.assign(en.style,{width:w+'px',height:hh+'px',left:(X(colCx)-w/2)+'px',top:(Y(vr.top)+BD_RATIO.en.top*D)+'px'});
  /* 台北 */
  let zw=BD_RATIO.zh.w*D,zhh=zw*BD_RATIO.zh.aspect,ztop;
  if(stacked){
    const bottom=Y(er.top)-BD_RATIO.zh.above*D,minTop=Y(vr.bottom)+.02*D;
    ztop=bottom-zhh;
    if(ztop<minTop){zhh=Math.max(0,bottom-minTop);zw=zhh/BD_RATIO.zh.aspect;ztop=minTop;}
  }else{
    ztop=Y(vr.bottom)+BD_RATIO.zh.below*D;
  }
  layer.classList.toggle('no-zh',zhh<D*.05);
  Object.assign(zh.style,{width:zw+'px',height:zhh+'px',left:(X(colCx)-zw/2)+'px',top:ztop+'px'});
  layer.classList.add('is-placed');
}
let backdropTimers=[];
function scheduleBackdrop(){
  backdropTimers.forEach(clearTimeout);
  requestAnimationFrame(layoutBackdrop);
  backdropTimers=[120,380,800].map(ms=>setTimeout(layoutBackdrop,ms));
}
document.addEventListener('mt:track',scheduleBackdrop);
addEventListener('resize',()=>{if(body.classList.contains('mt-player-open'))scheduleBackdrop();});
document.fonts?.ready?.then(()=>scheduleBackdrop());
if('ResizeObserver' in window){
  const pb=$('playerBody');
  if(pb)new ResizeObserver(()=>{if(body.classList.contains('mt-player-open'))requestAnimationFrame(layoutBackdrop);}).observe(pb);
}


/* =====================================================================
   12 · R10.2 recommendation engine + rebuilt home / library / lyrics / onboarding
   ===================================================================== */
const ALG_PROFILE_KEY='musicetown.r10.2.profile';
const ALG_STATE_KEY='musicetown.r10.2.signals';
const ALG_ONBOARD_KEY='musicetown.r10.2.4.onboarded';
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(_){return fallback}}
function writeJson(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch(_){}}
function algProfile(){return Object.assign({moments:[],moods:[],energy:'mid',tempo:'mid',vocal:'mixed',textures:[],worlds:[],discovery:'balanced',seeds:[]},readJson(ALG_PROFILE_KEY,{}))}
function algSignals(){return readJson(ALG_STATE_KEY,{views:{},plays:{},finishes:{},skips:{},lastThemes:[]})}
function hash32(str){let h=2166136261>>>0;for(const ch of String(str)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function seeded01(str){let x=hash32(str)||1;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967295}
function dateKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function weekKey(){const d=new Date(),u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));u.setUTCDate(u.getUTCDate()+4-(u.getUTCDay()||7));const y=new Date(Date.UTC(u.getUTCFullYear(),0,1));const w=Math.ceil((((u-y)/86400000)+1)/7);return `${u.getUTCFullYear()}-W${String(w).padStart(2,'0')}`}
function groupKeyOfTheme(name){for(const [k,g] of Object.entries(MT.HOME_GROUPS||{}))if(g.items?.includes(name))return k;return 'OTHER'}
function themeBlob(d){return [d?.t,d?.sub,d?.key,groupKeyOfTheme(d?.t),...(d?.tracks||[]).slice(0,16).flatMap(t=>[t?.vibe,t?.artist,t?.title])].filter(Boolean).join(' ').toLowerCase()}
const ALG_TERMS={
  moments:{focus:['lo-fi','jazz','study','university','quiet','ambient'],night:['night','tokyo','taipei','vapor','jazz','crooner','midnight'],drive:['rock','new york','city','road','sport'],workout:['sport','rock','energy','punk','metal'],chill:['lo-fi','vancouver','jazz','soft','acoustic'],social:['crooner','pop','city','jazz','festival']},
  moods:{warm:['warm','soul','acoustic','crooner','jazz'],dreamy:['dream','ambient','lo-fi','vapor','night'],bright:['pop','city','summer','festival','dance'],dark:['dark','night','metal','punk','cinematic'],intense:['rock','sport','punk','metal','energy'],nostalgic:['vintage','retro','old','crooner','tokyo','shanghai']},
  energy:{low:['lo-fi','ambient','quiet','soft','slow','acoustic'],mid:['jazz','crooner','city','pop','groove'],high:['rock','sport','punk','metal','energy','dance']},
  tempo:{slow:['slow','ambient','lo-fi','ballad','quiet'],mid:['jazz','groove','city','pop','crooner'],fast:['rock','sport','punk','dance','energy']},
  vocal:{instrumental:['instrumental','ambient','lo-fi','jazz'],soft:['soft','crooner','acoustic','dream'],clear:['vocal','pop','crooner'],strong:['rock','punk','metal','anthem'],mixed:['jazz','city','indie','pop']},
  textures:{jazz:['jazz','swing','blues'],rock:['rock','punk','guitar','metal'],lofi:['lo-fi','ambient','study'],city:['city','tokyo','taipei','shanghai','new york','london'],cinematic:['cinematic','landmark','world','journey'],campus:['university','college','campus','ntu','mit','oxford']},
  worlds:{taiwan:['taiwan','taipei','ntu','nthu','ncku','landmark_tw'],asia:['asia','tokyo','shanghai','hong','seoul','kyoto','nus'],world:['world','new york','london','europe','sydney','rio','sahara'],campus:['university','campus','college'],landmark:['landmark','spot','temple','museum','bridge','square']}
};
function termScore(blob,terms,weight){let s=0;for(const term of terms||[])if(blob.includes(term))s+=weight;return s}
function themeScore(di,mode='daily'){
  const d=MT.DATA[di];if(!d)return -1e9;
  const p=algProfile(),sig=algSignals(),blob=themeBlob(d),name=d.t;
  let score=0;
  for(const x of p.moments||[])score+=termScore(blob,ALG_TERMS.moments[x],2.7);
  for(const x of p.moods||[])score+=termScore(blob,ALG_TERMS.moods[x],2.15);
  score+=termScore(blob,ALG_TERMS.energy[p.energy],2.1);
  score+=termScore(blob,ALG_TERMS.tempo[p.tempo],1.7);
  score+=termScore(blob,ALG_TERMS.vocal[p.vocal],1.8);
  for(const x of p.textures||[])score+=termScore(blob,ALG_TERMS.textures[x],2.4);
  for(const x of p.worlds||[])score+=termScore(blob,ALG_TERMS.worlds[x],1.8);
  if((p.seeds||[]).includes(name))score+=5.5;
  score+=Math.log1p(sig.views?.[name]||0)*1.25+Math.log1p(sig.plays?.[name]||0)*2.1;
  score+=Math.log1p(sig.finishes?.[name]||0)*2.8-Math.log1p(sig.skips?.[name]||0)*2.5;
  const discovery=p.discovery||'balanced',group=groupKeyOfTheme(name),recent=(sig.lastThemes||[]).indexOf(name);
  if(discovery==='explore'){
    if(recent>=0)score-=4/(recent+1);
    if(/CITY|LIMITED|SPOT|LANDMARK|UNIVERSITY|COLLEGE|WORLD|ASIA/i.test(group))score+=2.2;
  }else if(discovery==='familiar'){
    if(recent>=0)score+=2.4/(recent+1);
    if(/STYLE|CORE|GENRE/i.test(group)||['JAZZ','CROONER','ROCK','SPORT','LO-FI'].includes(name))score+=2.2;
  }else if(recent>=0)score-=.45/(recent+1);
  let fav=0,dis=0,verified=0,local=0;
  for(const t of d.tracks||[]){if(MT.isFavorite?.(t))fav++;if(MT.isDisliked?.(t))dis++;if(t.licenseVerified)verified++;if(t.localMp3||t.audioSrc) local++;}
  score+=fav*3.1-dis*4.4;
  const n=Math.max(1,d.tracks?.length||0);score+=(verified/n)*1.7+(local/n)*1.2+Math.min(2,Math.log1p(n)/2);
  const seed=mode==='weekly'?weekKey():mode==='mt'?'mt-r10.2':dateKey();
  const jitter=seeded01(seed+'|'+name);
  score+=(mode==='weekly'?2.8:mode==='daily'?1.4:.35)*jitter;
  if(mode==='mt')score=(verified/n)*5+(local/n)*3+Math.min(3,Math.log1p(n))+(fav*1.2)+(score*.22);
  return score;
}
function recommendThemes(mode='daily',count=9){
  const candidates=MT.DATA.map((d,i)=>({i,d,score:themeScore(i,mode),group:groupKeyOfTheme(d.t)})).filter(x=>x.d?.tracks?.length);
  candidates.sort((a,b)=>b.score-a.score);
  const out=[],groups=new Map();
  for(const c of candidates){
    const same=groups.get(c.group)||0;
    const adjusted=c.score-same*(mode==='weekly'?2.1:1.1);
    let insert=out.findIndex(x=>adjusted>x.adjusted);
    const row={...c,adjusted};if(insert<0)out.push(row);else out.splice(insert,0,row);
    groups.set(c.group,same+1);
    if(out.length>count*3)out.length=count*3;
  }
  /* one final greedy diversity pass */
  const picked=[],seen={};
  for(const c of out){const penalty=(seen[c.group]||0)*(mode==='weekly'?2.4:.9);c.final=c.adjusted-penalty;}
  out.sort((a,b)=>b.final-a.final);
  for(const c of out){if(picked.length>=count)break;picked.push(c);seen[c.group]=(seen[c.group]||0)+1;}
  return picked;
}
function recordThemeSignal(kind,name){
  if(!name)return;
  const s=algSignals();
  const key={view:'views',play:'plays',finish:'finishes',skip:'skips'}[kind];
  if(key){s[key]=s[key]||{};s[key][name]=(s[key][name]||0)+1}
  if(kind==='view'||kind==='play'||kind==='finish')s.lastThemes=[name,...(s.lastThemes||[]).filter(x=>x!==name)].slice(0,16);
  writeJson(ALG_STATE_KEY,s);
}
document.addEventListener('mt:view',e=>{
  if(e.detail?.view==='detail')recordThemeSignal('view',e.detail.theme||MT.DATA[e.detail.index]?.t);
  requestAnimationFrame(()=>renderRecoShelf(activeRecoMode));
});
let algoBoundAudio=null,algoSession=null;
function accrueAlgoSession(){
  if(!algoSession||!algoSession.playWall)return;
  algoSession.listenedMs+=Date.now()-algoSession.playWall;
  algoSession.playWall=0;
}
function closeAlgoSession(){
  if(!algoSession)return;
  accrueAlgoSession();
  const sec=algoSession.listenedMs/1000;
  if(!algoSession.finished&&sec>=2&&sec<25&&algoSession.theme)recordThemeSignal('skip',algoSession.theme);
  algoSession=null;
}
function bindAlgoAudio(a){
  if(!a||a===algoBoundAudio)return;
  algoBoundAudio=a;
  a.addEventListener('play',()=>{
    const t=MT.track,theme=trackTheme(t);
    if(algoSession&&algoSession.track!==t)closeAlgoSession();
    if(!algoSession||algoSession.track!==t){
      algoSession={track:t,theme,listenedMs:0,playWall:Date.now(),finished:false};
      recordThemeSignal('play',theme);
    }else if(!algoSession.playWall)algoSession.playWall=Date.now();
  },{passive:true});
  a.addEventListener('pause',()=>accrueAlgoSession(),{passive:true});
  a.addEventListener('ended',()=>{
    accrueAlgoSession();
    if(algoSession&&!algoSession.finished){
      algoSession.finished=true;
      recordThemeSignal('finish',algoSession.theme||trackTheme(MT.track));
    }
  },{passive:true});
}
document.addEventListener('mt:track',e=>{
  const t=e.detail?.track||MT.track,a=e.detail?.audio||MT.audio;
  if(algoSession&&algoSession.track&&algoSession.track!==t)closeAlgoSession();
  bindAlgoAudio(a);
  if(t)requestAnimationFrame(()=>renderRecoShelf(activeRecoMode));
});

/* ----- replacement home shelf: Daily / Weekly / MT + real theme groups ----- */
let activeRecoMode='daily';
const legacyShelf=$('themeShelf');
if(legacyShelf)legacyShelf.setAttribute('aria-hidden','true');
let recoShelf=$('mtShelf');
if(!recoShelf){
  recoShelf=h('section','mt-shelf mt-glass mt-reco-shelf',`
    <div class="mt-shelf-head"><div class="mt-shelf-title"><em class="mt-brand-kicker">CITYMUSIC CURATED</em><b id="mtRecoTitle">為你探索</b><span id="themeShelfCount">根據你的偏好與使用紀錄</span></div><button id="mtAtlasAll" class="mt-text-btn" type="button">全部主題</button></div>
    <div class="mt-shelf-chips" id="mtRecoChips"></div>
    <div class="mt-shelf-cards" id="mtRecoCards"></div>`);
  recoShelf.id='mtShelf';
  const scene=$('scene');scene?.parentNode?.insertBefore(recoShelf,scene);
}
const recoChips=$('mtRecoChips')||recoShelf?.querySelector('.mt-shelf-chips');
const recoCards=$('mtRecoCards')||recoShelf?.querySelector('.mt-shelf-cards');
const QUICK_GROUPS=Object.entries(MT.HOME_GROUPS||{}).filter(([k,g])=>g?.items?.length).slice(0,5);
function shelfChip(key,label,active,mode='group'){return `<button type="button" class="mt-chip${active?' is-active':''}" data-${mode==='reco'?'reco-mode':'group-key'}="${esc(key)}">${esc(label)}</button>`}
function renderRecoShelf(mode='daily'){
  if(!recoShelf||!recoCards||!recoChips)return;
  activeRecoMode=mode;
  const special=[['daily','每日推薦'],['weekly','每週推薦'],['mt','CT 推薦']];
  recoChips.innerHTML=special.map(([k,l])=>shelfChip(k,l,mode===k,'reco')).join('')+QUICK_GROUPS.map(([k,g])=>shelfChip(k,g.short||g.label||k,mode===`group:${k}`)).join('');
  let rows,title,sub;
  if(mode.startsWith('group:')){
    const key=mode.slice(6),g=MT.HOME_GROUPS[key];
    rows=(g?.items||[]).map(name=>({i:MT.DATA.findIndex(d=>d.t===name),score:0})).filter(x=>x.i>=0).slice(0,9);
    title=g?.label||'主題分類';sub=`${rows.length} 個主題 · 點選直接進入`;
    MT.stageGroup?.(key);
  }else{
    rows=recommendThemes(mode,9);
    title=mode==='daily'?'每日推薦':mode==='weekly'?'每週推薦':'CT 推薦';
    sub=mode==='daily'?'依你的喜好、收藏與最近播放':mode==='weekly'?'加入更多探索性，週一更新':'CITYMUSIC 編輯排序＋你的偏好綜合權重';
    MT.stageCustom?.(rows.map(x=>MT.DATA[x.i].t));
  }
  $('mtRecoTitle').textContent=title;$('themeShelfCount').textContent=sub;
  recoCards.innerHTML=rows.map((x,k)=>{const d=MT.DATA[x.i],nm=MT.splitThemeName(d.t),ui=MT.genreUiFor(d.t);return `<button type="button" class="mt-theme-card${mode.startsWith('group:')?'':' is-algo'}" data-theme-index="${x.i}" data-score-label="${mode==='mt'?'CT PICK':mode==='weekly'?'WEEKLY':'TODAY'}" style="--card-accent:${ui.accent}"><i>${String(k+1).padStart(2,'0')}</i><b>${esc(nm.main)}</b><span>${esc(nm.sub||groupKeyOfTheme(d.t).replaceAll('_',' '))}</span></button>`}).join('');
  requestAnimationFrame(measure);
}
recoShelf?.addEventListener('click',e=>{
  const r=e.target.closest('[data-reco-mode]');if(r){renderRecoShelf(r.dataset.recoMode);return}
  const g=e.target.closest('[data-group-key]');if(g){renderRecoShelf('group:'+g.dataset.groupKey);return}
  const c=e.target.closest('[data-theme-index]');if(c){MT.showTheme(Number(c.dataset.themeIndex));return}
});
$('mtAtlasAll')?.addEventListener('click',()=>{selectTab('search',{fromUser:true});setTimeout(()=>$('globalSearchInput')?.focus(),50)});
renderRecoShelf('daily');

/* ----- beautiful library overview, updated from the real library DOM ----- */
function ensureLibraryHero(){
  const panel=$('libraryPanel');if(!panel||panel.querySelector('.mt-library-hero'))return;
  const hero=h('section','mt-library-hero',`<div class="mt-library-eyebrow">CITYMUSIC LIBRARY</div><h2 class="mt-library-title">我的音樂庫</h2><p class="mt-library-sub">收藏、匯入與整理你真正想再聽一次的聲音。所有個人資料仍只留在這個瀏覽器。</p><div class="mt-library-stats"><div class="mt-library-stat"><b id="mtLibTracks">0</b><span>收藏歌曲</span></div><div class="mt-library-stat"><b id="mtLibCollections">0</b><span>音樂庫</span></div><div class="mt-library-stat"><b id="mtLibPlaying">—</b><span>正在播放</span></div></div>`);
  panel.prepend(hero);
}
function updateLibraryHero(){ensureLibraryHero();const panel=$('libraryPanel');if(!panel)return;$('mtLibTracks').textContent=String(panel.querySelectorAll('.local-track-row').length||MT.libraryCount?.()||0);$('mtLibCollections').textContent=String(panel.querySelectorAll('.library-collection-tab').length||1);$('mtLibPlaying').textContent=MT.track?'1':'—'}
ensureLibraryHero();updateLibraryHero();
if($('libraryPanel'))new MutationObserver(()=>requestAnimationFrame(updateLibraryHero)).observe($('libraryPanel'),{childList:true,subtree:true});
document.addEventListener('mt:track',updateLibraryHero);

/* ----- lyrics full preview ----- */
const lyricsPreview=h('div','mt-lyrics-preview',`<section class="mt-lyrics-preview-panel" role="dialog" aria-modal="true" aria-labelledby="mtLyricsPreviewTitle"><header class="mt-lyrics-preview-head"><div><small>CITYMUSIC · FULL LYRICS</small><b id="mtLyricsPreviewTitle">歌詞</b></div><button class="mt-lyrics-preview-close" type="button" aria-label="關閉歌詞">${ICON.close}</button></header><div class="mt-lyrics-preview-lines" id="mtLyricsPreviewLines"></div></section>`);
body.appendChild(lyricsPreview);
let lyricsAudio=null,lyricsSync=null;
function closeLyricsPreview(){lyricsPreview.classList.remove('open');if(lyricsAudio&&lyricsSync)lyricsAudio.removeEventListener('timeupdate',lyricsSync);lyricsAudio=null;lyricsSync=null}
function openLyricsPreview(source){
  const lines=[...source.querySelectorAll('.live-lyric-line')];if(!lines.length)return;
  $('mtLyricsPreviewTitle').textContent=MT.track?.title||'歌詞';
  $('mtLyricsPreviewLines').innerHTML=lines.map((el,i)=>`<p class="mt-lyrics-preview-line${el.classList.contains('active')?' active':''}${el.classList.contains('past')?' past':''}" data-time="${esc(el.dataset.time||'')}" data-li="${i}">${esc(el.textContent||'')}</p>`).join('');
  lyricsPreview.classList.add('open');
  lyricsAudio=MT.audio;
  lyricsSync=()=>{const a=lyricsAudio;if(!a)return;const timed=[...$('mtLyricsPreviewLines').children].map(el=>({el,time:Number(el.dataset.time)})).filter(x=>Number.isFinite(x.time));if(!timed.length)return;let at=0;for(let i=0;i<timed.length;i++){if(timed[i].time<=a.currentTime)at=i;else break}timed.forEach((x,i)=>{x.el.classList.toggle('active',i===at);x.el.classList.toggle('past',i<at)});const el=timed[at]?.el,host=$('mtLyricsPreviewLines');if(el&&host){const top=el.offsetTop-(host.clientHeight-el.offsetHeight)/2;host.scrollTo({top:Math.max(0,top),behavior:REDUCE?'auto':'smooth'})}};
  lyricsAudio?.addEventListener('timeupdate',lyricsSync,{passive:true});lyricsSync?.();
}
document.addEventListener('click',e=>{const l=e.target.closest('#playerSheet .live-lyrics');if(l){e.preventDefault();openLyricsPreview(l)}});
lyricsPreview.querySelector('.mt-lyrics-preview-close').addEventListener('click',closeLyricsPreview);
lyricsPreview.addEventListener('click',e=>{if(e.target===lyricsPreview)closeLyricsPreview()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&lyricsPreview.classList.contains('open'))closeLyricsPreview()});

/* ----- onboarding v2: eight focused screens that actually seed the algorithm ----- */
const ONBOARD_STEPS=[
  {k:'intro',title:'歡迎來到 CITYMUSIC',copy:'先用幾個很短的選擇建立你的初始聲音輪廓。之後實際播放、收藏、聽完與快速略過，會持續修正推薦。'},
  {k:'moments',title:'你通常在什麼時候聽？',copy:'可以複選。情境會影響每日推薦的熟悉感、節奏與氛圍。'},
  {k:'moods',title:'你現在比較常找哪種心情？',copy:'可以複選。這讓演算法知道同一個曲風裡，你偏好的情緒方向。'},
  {k:'energy',title:'你喜歡多大的能量？',copy:'決定推薦主題的推進感與刺激程度。'},
  {k:'tempo',title:'你偏好的速度感？',copy:'不是硬性 BPM 篩選，而是排序訊號。'},
  {k:'vocal',title:'你對人聲的偏好？',copy:'人聲只是權重，不會把其他歌曲完全排除。'},
  {k:'textures',title:'先選一些聲音質地',copy:'可以複選。Jazz、Rock、Lo-fi、城市感等會成為初始偏好。'},
  {k:'worlds',title:'你想先從哪種世界出發？',copy:'城市、校園與景點可以混在同一份推薦裡。'},
  {k:'discovery',title:'你希望推薦多敢探索？',copy:'熟悉優先會回到你常聽的世界；探索模式會主動提高新城市與跨風格主題。'},
  {k:'seeds',title:'挑幾個你願意先試的主題',copy:'最多選四個作為起點；之後行為訊號會逐漸取代初始選擇。'},
  {k:'summary',title:'你的推薦輪廓準備好了',copy:'完成後直接回到主頁，先看到每日推薦；每週推薦與 CT 推薦會用不同權重重新排序。'}
];
const ONBOARD_OPTIONS={
  moments:[['focus','專注 / 工作','安靜、穩定、不搶注意力'],['night','夜晚','城市夜色、較深的氛圍'],['drive','通勤 / 開車','有流動感與節奏'],['workout','運動','更高能量與推進感'],['chill','放空','柔軟、慢一些'],['social','聚會','容易進入狀態的聲音']],
  moods:[['warm','溫暖','Soul、Acoustic、柔和爵士'],['dreamy','夢幻','Ambient、Lo-fi、夜色感'],['bright','明亮','Pop、城市、夏日感'],['dark','深色','Night、Punk、Cinematic'],['intense','強烈','Rock、Sport、Metal'],['nostalgic','懷舊','Vintage、Retro、老城市']],
  energy:[['low','低能量','安靜、留白多'],['mid','中等','耐聽、節奏適中'],['high','高能量','更直接、更有衝擊']],
  tempo:[['slow','偏慢','適合放空、專注與深夜'],['mid','中速','耐聽、適合長時間播放'],['fast','偏快','更有推進感與節奏']],
  vocal:[['instrumental','偏器樂','人聲不是重點'],['soft','柔和人聲','輕、近、低刺激'],['clear','清楚人聲','旋律與歌唱感明顯'],['strong','強人聲','搖滾、龐克、張力更高'],['mixed','都可以','讓行為慢慢決定']],
  textures:[['jazz','Jazz / Blues','爵士、藍調、groove'],['rock','Rock / Guitar','吉他、龐克、搖滾'],['lofi','Lo-fi / Ambient','低彩度、環境感'],['city','City Sound','城市、indie、都會'],['cinematic','Cinematic','場景感與旅行感'],['campus','Campus','校園與年輕感']],
  worlds:[['taiwan','台灣','城市、景點、校園'],['asia','亞洲','東京、上海、首爾等'],['world','世界城市','歐美與世界地景'],['campus','大學','各地校園限定'],['landmark','景點','地標與旅行主題']],
  discovery:[['familiar','熟悉優先','多一點你已經喜歡的聲音與核心主題'],['balanced','平衡探索','熟悉與新鮮大約各半'],['explore','多給我驚喜','提高限定主題、城市與跨風格探索']]
};
let onboardStep=0,onboard=algProfile();
function optionSelected(k,v){const cur=onboard[k];return Array.isArray(cur)?cur.includes(v):cur===v}
function toggleOnboard(k,v){if(['moments','moods','textures','worlds','seeds'].includes(k)){const a=Array.isArray(onboard[k])?[...onboard[k]]:[];const i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);onboard[k]=a.slice(0,k==='seeds'?4:5)}else onboard[k]=v}
function onboardSeedRows(){const prev=readJson(ALG_PROFILE_KEY,null);writeJson(ALG_PROFILE_KEY,onboard);const rows=recommendThemes('daily',6);if(prev)writeJson(ALG_PROFILE_KEY,prev);else try{localStorage.removeItem(ALG_PROFILE_KEY)}catch(_){}return rows}
function onboardLabel(k,v){
  const row=(ONBOARD_OPTIONS[k]||[]).find(x=>x[0]===v);
  return row?.[1]||String(v||'');
}
function onboardSummaryHtml(){
  const rows=[
    ['情境',(onboard.moments||[]).map(v=>onboardLabel('moments',v))],
    ['心情',(onboard.moods||[]).map(v=>onboardLabel('moods',v))],
    ['能量',[onboardLabel('energy',onboard.energy)]],
    ['速度',[onboardLabel('tempo',onboard.tempo)]],
    ['人聲',[onboardLabel('vocal',onboard.vocal)]],
    ['質地',(onboard.textures||[]).map(v=>onboardLabel('textures',v))],
    ['世界',(onboard.worlds||[]).map(v=>onboardLabel('worlds',v))],
    ['探索',[onboardLabel('discovery',onboard.discovery)]]
  ].filter(x=>x[1].filter(Boolean).length);
  return '<div class="mt-onboard-summary"><div class="mt-onboard-summary-grid">'+
    rows.map(r=>'<section><small>'+esc(r[0])+'</small><b>'+r[1].filter(Boolean).map(esc).join(' · ')+'</b></section>').join('')+
    '</div><p>之後「聽完」會提高權重，太快略過會降低權重；每日、每週與 CT 推薦會用不同探索比例重新排序。</p></div>';
}
function renderOnboard(){
  const welcome=$('welcome');if(!welcome)return;
  const st=ONBOARD_STEPS[onboardStep];
  const bodyEl=welcome.querySelector('.mt-onboard-body'),counter=welcome.querySelector('.mt-onboard-counter'),bar=welcome.querySelector('.mt-onboard-progress i'),next=welcome.querySelector('.mt-onboard-next'),back=welcome.querySelector('.mt-onboard-back');
  counter.textContent=(onboardStep+1)+' / '+ONBOARD_STEPS.length;
  bar.style.setProperty('--p',(((onboardStep+1)/ONBOARD_STEPS.length)*100)+'%');
  back.disabled=onboardStep===0;
  let options='';
  if(st.k==='intro'){
    options='<div class="mt-onboard-intro-card"><b>推薦不是一次設定完就不變</b><span>這裡只建立初始輪廓；實際播放、收藏、完整聽完與快速略過會繼續修正權重。</span><div><i>每日推薦</i><i>每週推薦</i><i>CT 推薦</i></div></div>';
  }else if(st.k==='seeds'){
    options='<div class="mt-onboard-options mt-onboard-seeds">'+onboardSeedRows().map((x,i)=>{
      const d=MT.DATA[x.i],nm=MT.splitThemeName(d.t),sel=optionSelected('seeds',d.t);
      return '<button class="mt-onboard-option mt-onboard-seed'+(sel?' selected':'')+'" data-ob-value="'+esc(d.t)+'" type="button"><small>SEED '+(i+1)+'</small><b>'+esc(nm.main)+'</b><span>'+esc(nm.sub||groupKeyOfTheme(d.t).replaceAll('_',' '))+'</span></button>';
    }).join('')+'</div>';
  }else if(st.k==='summary'){
    options=onboardSummaryHtml();
  }else{
    options='<div class="mt-onboard-options">'+(ONBOARD_OPTIONS[st.k]||[]).map(row=>{
      const v=row[0],b=row[1],s=row[2];
      return '<button class="mt-onboard-option'+(optionSelected(st.k,v)?' selected':'')+'" data-ob-value="'+v+'" type="button"><b>'+b+'</b><span>'+s+'</span></button>';
    }).join('')+'</div>';
  }
  const heading=onboardStep===0?'h1':'h2';
  bodyEl.innerHTML='<div class="mt-onboard-kicker">CITYMUSIC · '+String(onboardStep+1).padStart(2,'0')+' · PERSONALIZE</div><'+heading+'>'+st.title+'</'+heading+'><p>'+st.copy+'</p>'+options;
  next.textContent=st.k==='summary'?'進入主頁':'下一步';
  next.disabled=false;
  bodyEl.scrollTop=0;
}
function finishOnboard(skip=false){
  if(skip)onboard={moments:[],moods:[],energy:'mid',tempo:'mid',vocal:'mixed',textures:[],worlds:[],discovery:'balanced',seeds:[]};
  writeJson(ALG_PROFILE_KEY,onboard);try{localStorage.setItem(ALG_ONBOARD_KEY,'1');localStorage.setItem('musicetown.r10.onboarded','1');localStorage.setItem('musicetown.r10.2.4.onboarded','1')}catch(_){}
  const welcome=$('welcome');welcome?.classList.add('is-out');welcome?.classList.remove('welcome-active','finalizing','previewing');body.classList.remove('welcome-active');
  setTimeout(()=>{if(welcome)welcome.style.display='none'},360);
  renderRecoShelf('daily');requestAnimationFrame(measure);document.dispatchEvent(new CustomEvent('mt:welcome',{detail:{done:true,profile:onboard}}));
}
function installOnboardV2(){
  const welcome=$('welcome');if(!welcome)return;
  let done=false;try{done=localStorage.getItem(ALG_ONBOARD_KEY)==='1'}catch(_){}
  if(done)return;
  welcome.style.display='grid';welcome.classList.remove('is-out','finalizing','previewing');welcome.classList.add('welcome-active','mt-onboard-v2');body.classList.add('welcome-active');
  welcome.innerHTML=`<div class="welcome-card"><header class="mt-onboard-head"><div class="mt-onboard-brand"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"></circle><ellipse cx="20" cy="20" rx="7" ry="16"></ellipse><ellipse cx="20" cy="20" rx="16" ry="7"></ellipse></svg><span>CITYMUSIC</span></div><div class="mt-onboard-progress"><span class="mt-onboard-counter">1 / ${ONBOARD_STEPS.length}</span><i></i></div></header><main class="mt-onboard-body"></main><footer class="mt-onboard-foot"><button class="mt-onboard-back" type="button">上一步</button><button class="mt-onboard-skip" type="button">先略過</button><button class="mt-onboard-next" type="button">下一步</button></footer></div>`;
  welcome.addEventListener('click',e=>{const o=e.target.closest('[data-ob-value]');if(!o)return;const k=ONBOARD_STEPS[onboardStep].k;toggleOnboard(k,o.dataset.obValue);renderOnboard()});
  welcome.querySelector('.mt-onboard-back').addEventListener('click',()=>{if(onboardStep>0){onboardStep--;renderOnboard()}});
  welcome.querySelector('.mt-onboard-skip').addEventListener('click',()=>finishOnboard(true));
  welcome.querySelector('.mt-onboard-next').addEventListener('click',()=>{if(onboardStep<ONBOARD_STEPS.length-1){onboardStep++;renderOnboard()}else finishOnboard(false)});
  renderOnboard();
}
installOnboardV2();

/* R10.2.2 · new tracks always start in full dock.
   Compact glass is a scroll state, never the initial playback state. */
document.addEventListener('mt:track',()=>{
  body.classList.remove('mt-compact');
  requestAnimationFrame(()=>{paintMini();measure()});
});

/* detail/library scroll is the canonical mobile compact trigger. */
[$('detail'),$('libraryPanel'),$('globalSearchResults')].filter(Boolean).forEach(n=>{
  if(n.dataset.mtCompactScroll==='1')return;n.dataset.mtCompactScroll='1';let y0=n.scrollTop||0;
  n.addEventListener('scroll',()=>{const y=n.scrollTop||0,dy=y-y0;if(Math.abs(dy)>10){if(dy>0&&y>120)body.classList.add('mt-compact');else if(dy<0)body.classList.remove('mt-compact');y0=y}}, {passive:true});
});


/* =====================================================================
   boot
   ===================================================================== */
body.classList.add(MT.view==='branch'?'mt-view-detail':'mt-view-home');paintTabs();paintMini();measure();
syncPageState();syncModalState();
document.addEventListener('mt:welcome',()=>{updateResume();requestAnimationFrame(measure)});
addEventListener('load',()=>{
  measure();
  setTimeout(()=>{openInitialRoute();updateResume();measure();},200);
});
if(document.readyState==='complete')setTimeout(()=>{openInitialRoute();updateResume();measure();},200);
})();

/* ================= R10.2.4 EXPERIENCE STABILIZER START ================= */
;(()=>{
'use strict';
const MT=window.MT;if(!MT)return;
const $=id=>document.getElementById(id);
const body=document.body,root=document.documentElement;
const mobile=()=>matchMedia('(max-width:760px)').matches;
/* Playback recovery is exclusively owned by the R10.2.4 core state machine. */
let playerBound=false;
function playerScrollY(){
  const sheet=$('playerSheet'),card=sheet?.querySelector('.player-card');
  return Math.max(Number(card?.scrollTop||0),Number(sheet?.scrollTop||0));
}
function syncPlayerCompact(){
  const sheet=$('playerSheet'),open=!!sheet?.classList.contains('open');
  if(!mobile()||!open){
    body.classList.remove('mt-player-scrolled');
    if(open)body.classList.remove('mt-compact');
    return;
  }
  const y=playerScrollY(),deck=sheet.querySelector('.musicetown-deck,.vinyl-wrap,.deck-info');
  const viewportTop=window.visualViewport?.offsetTop||0;
  const compact=y>130&&(!deck||deck.getBoundingClientRect().bottom<(viewportTop+118));
  body.classList.toggle('mt-player-scrolled',compact);
  body.classList.toggle('mt-compact',compact);
}
function bindPlayerScroll(){
  if(playerBound)return;
  const sheet=$('playerSheet'),card=sheet?.querySelector('.player-card');if(!sheet)return;
  playerBound=true;
  const onScroll=()=>requestAnimationFrame(syncPlayerCompact);
  sheet.addEventListener('scroll',onScroll,{passive:true});
  card?.addEventListener('scroll',onScroll,{passive:true});
  new MutationObserver(()=>requestAnimationFrame(syncPlayerCompact)).observe(sheet,{attributes:true,attributeFilter:['class']});
}
bindPlayerScroll();
document.addEventListener('mt:track',()=>{
  body.classList.remove('mt-player-scrolled','mt-compact');
  requestAnimationFrame(syncPlayerCompact);
});
addEventListener('resize',()=>requestAnimationFrame(syncPlayerCompact),{passive:true});
window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(syncPlayerCompact),{passive:true});
let bandRAF=0;
function syncHomeBand(){
  bandRAF=0;if(!body.classList.contains('mt-view-home'))return;
  const vv=window.visualViewport,viewTop=vv?.offsetTop||0;
  const viewH=vv?.height||window.innerHeight||document.documentElement.clientHeight||0;if(!viewH)return;
  const top=$('mtTop'),dock=$('mtDock'),shelf=$('mtShelf');
  const tr=top&&getComputedStyle(top).display!=='none'?top.getBoundingClientRect():null;
  const topPx=Math.max(0,Math.round((tr?.bottom||viewTop)-viewTop+4));
  const lower=[];
  for(const n of [shelf,dock]){
    if(!n||getComputedStyle(n).display==='none'||Number(getComputedStyle(n).opacity)===0)continue;
    const r=n.getBoundingClientRect();if(r.height>1)lower.push(r.top);
  }
  const lowerTop=lower.length?Math.min(...lower):(viewTop+viewH);
  const bottomPx=Math.max(0,Math.round((viewTop+viewH)-lowerTop+8));
  let changed=false;
  if(root.style.getPropertyValue('--mt-scene-top')!==topPx+'px'){root.style.setProperty('--mt-scene-top',topPx+'px');changed=true}
  if(root.style.getPropertyValue('--mt-scene-bottom')!==bottomPx+'px'){root.style.setProperty('--mt-scene-bottom',bottomPx+'px');changed=true}
  if(changed)requestAnimationFrame(()=>dispatchEvent(new Event('resize')));
}
function queueBand(){if(!bandRAF)bandRAF=requestAnimationFrame(syncHomeBand)}
['resize','orientationchange'].forEach(ev=>addEventListener(ev,queueBand,{passive:true}));
window.visualViewport?.addEventListener('resize',queueBand,{passive:true});
document.addEventListener('mt:view',queueBand);document.addEventListener('mt:group',queueBand);
for(const n of [$('mtShelf'),$('mtDock')])if(n&&'ResizeObserver'in window)new ResizeObserver(queueBand).observe(n);
setTimeout(queueBand,80);setTimeout(queueBand,500);
function scrubOnlineSource(){
  document.querySelectorAll('.online-fallback').forEach(n=>n.remove());
  document.querySelectorAll('#playerBody .track-row,#playerBody .source-row,#playerBody [data-track-title],#playerBody b,#playerBody small').forEach(n=>{
    const t=(n.textContent||'').trim().toUpperCase();
    if(t!=='ONLINE SOURCE'&&t!=='ONLINE CC0 PLAYER')return;
    const row=n.closest('.online-fallback,.track-row,.source-row,[data-track-title]');
    if(row)row.remove();else n.hidden=true;
  });
}
new MutationObserver(()=>requestAnimationFrame(scrubOnlineSource)).observe(document.body,{childList:true,subtree:true});
scrubOnlineSource();
const lyr=document.querySelector('.mt-lyrics-preview');
if(lyr)new MutationObserver(()=>body.classList.toggle('mt-lyrics-full',lyr.classList.contains('open')))
  .observe(lyr,{attributes:true,attributeFilter:['class']});
queueMicrotask(()=>{bindPlayerScroll();syncPlayerCompact();queueBand();scrubOnlineSource()});
})();
/* ================= R10.2.4 EXPERIENCE STABILIZER END ================= */
