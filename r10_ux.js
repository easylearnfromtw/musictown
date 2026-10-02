/* =====================================================================
   musicetown R10 · Flow & Glass shell
   ---------------------------------------------------------------------
   Talks to the app only through window.MT and the mt:* events
   (mt:ready, mt:view, mt:group, mt:track, mt:welcome, mt:segment).
   Injected as the "r10-ux-script" block by apply_r10_ux.py; must be the
   last script in <body>.
   ===================================================================== */
(()=>{
'use strict';
const MT=window.MT;
if(!MT){console.warn('[musicetown R10] window.MT missing; shell disabled');return}

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
  logo.setAttribute('aria-label','musicetown · 回到探索');
  logo.querySelector('.logo-wordmark')?.setAttribute('class','mt-logo-word');
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
  $('mtMiniTitle').textContent=t.title||'musicetown';
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
    if(tool==='share'&&MT.track){const t=MT.track;MT.shareTracks([t],t.title||'musicetown');}
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
   boot
   ===================================================================== */
body.classList.add(MT.view==='branch'?'mt-view-detail':'mt-view-home');
paintTabs();paintMini();measure();
syncPageState();syncModalState();
document.addEventListener('mt:welcome',()=>{updateResume();requestAnimationFrame(measure)});
addEventListener('load',()=>{
  measure();
  setTimeout(()=>{openInitialRoute();updateResume();measure();},200);
});
if(document.readyState==='complete')setTimeout(()=>{openInitialRoute();updateResume();measure();},200);


/* =====================================================================
   MUSICTOWN R10.2 · recommender / onboarding / lyrics preview / library
   ===================================================================== */
const MT_PROFILE_KEY='musicetown.r10.algorithmProfile';
const MT_BEHAVIOR_KEY='musicetown.r10.behavior';
const MT_RECO_TAB_KEY='musicetown.r10.recoTab';
const MT_NOW=()=>Date.now();
const safeJSON=(raw,fallback)=>{try{const x=JSON.parse(raw);return x??fallback}catch(_){return fallback}};
const storeGet=(k,f)=>{try{return safeJSON(localStorage.getItem(k),f)}catch(_){return f}};
const storeSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const defaultProfile=()=>({
  energy:'balanced',contexts:['commute','night'],macro:['music','city'],discovery:'mix',favorites:[],updatedAt:0
});
function mtProfile(){return Object.assign(defaultProfile(),storeGet(MT_PROFILE_KEY,{}))}
function mtBehavior(){const x=storeGet(MT_BEHAVIOR_KEY,[]);return Array.isArray(x)?x.slice(-240):[]}
function hash01(str){let h=2166136261>>>0;for(const ch of String(str)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967295}
function weekKey(d=new Date()){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));const w=Math.ceil((((x-y0)/86400000)+1)/7);return `${x.getUTCFullYear()}-W${String(w).padStart(2,'0')}`}
function dayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function themeText(d){return [d?.t,d?.sub,d?.key,...(d?.meters||[]).flat(),...(d?.tracks||[]).slice(0,12).flatMap(t=>[t.title,t.artist,t.vibe,t.curatedTheme])].filter(Boolean).join(' ').toLowerCase()}
function macroGroups(key){const m=MT.THEME_MACROS?.find(x=>x.key===key);return m?.groups||[]}
function macroMatchesTheme(d,macro){const g=MT.themeGroupKeyForName(d.t);return macroGroups(macro).includes(g)}
const ENERGY_WORDS={
  calm:['lo-fi','quiet','soft','poem','rain','ambient','solemn','mist','chill','lounge'],
  balanced:['jazz','indie','soul','city','dream','pop','crooner','vintage'],
  energetic:['rock','sport','running','punk','metal','workout','energy','motion','dance','intense']
};
const CONTEXT_WORDS={
  study:['lo-fi','quiet','poem','ambient','jazz','soft','university','campus'],
  commute:['city','street','downtown','taipei','tokyo','new york','hong kong','running'],
  workout:['sport','running','rock','punk','energy','motion','workout'],
  night:['night','midnight','vapor','jazz','crooner','neon','soho','mist','rain'],
  social:['jazz','soul','dance','rome','barcelona','shanghai','crooner','party','city']
};
function wordScore(text,words,w){let n=0;for(const q of words||[])if(text.includes(q))n+=w;return n}
function themeQuality(d){
  const tracks=d?.tracks||[];if(!tracks.length)return -8;
  const usable=tracks.filter(t=>t.audioSrc&&!String(t.title||'').toUpperCase().includes('ONLINE SOURCE')).length/tracks.length;
  const licensed=tracks.filter(t=>t.licenseVerified||/CC0/i.test(t.license||'')).length/tracks.length;
  const artists=new Set(tracks.map(t=>t.artist).filter(Boolean)).size/Math.max(1,tracks.length);
  return Math.min(2.2,tracks.length/24)+usable*2.2+licensed*1.4+artists*.9+(d.limitedTheme?.15:0);
}
function behaviorScore(d,kind){
  const now=MT_NOW(),hist=mtBehavior(),theme=d.t;let score=0;
  for(const e of hist){if(e.theme!==theme)continue;const age=(now-(e.ts||0))/86400000;if(age>35)continue;const decay=Math.exp(-age/(kind==='week'?7:14));score+=decay*(e.kind==='play'?1:e.kind==='favorite'?3:e.kind==='dislike'?-4:.3)}
  let fav=0,dis=0;for(const t of d.tracks||[]){try{if(MT.isFavorite(t))fav++;if(MT.isDisliked(t))dis++}catch(_){}}
  score+=Math.min(8,fav*1.8)-Math.min(8,dis*2.3);
  return score;
}
function profileScore(d,profile){
  const text=themeText(d);let s=0;
  if((profile.favorites||[]).includes(d.t))s+=9;
  for(const m of profile.macro||[])if(macroMatchesTheme(d,m))s+=2.3;
  s+=wordScore(text,ENERGY_WORDS[profile.energy],1.2);
  for(const c of profile.contexts||[])s+=wordScore(text,CONTEXT_WORDS[c],.72);
  return s;
}
function rankedThemes(kind='daily',limit=8){
  const p=mtProfile(),seed=kind==='daily'?dayKey():kind==='week'?weekKey():'mt';
  const scored=MT.DATA.map((d,i)=>{
    let s=themeQuality(d);
    if(kind!=='mt')s+=profileScore(d,p)+behaviorScore(d,kind);
    if(kind==='week')s+=behaviorScore(d,'week')*.7;
    if(kind==='mt'){
      const text=themeText(d);s+=wordScore(text,['taipei','tokyo','jazz','lo-fi','rock','new york','london','shanghai'],.18);
    }
    const discovery=p.discovery||'mix';
    const jitter=(hash01(`${seed}|${d.t}`)-.5)*(kind==='mt'?.25:discovery==='familiar'?.25:discovery==='explore'?2.2:1.0);
    return {i,d,s:s+jitter,g:MT.themeGroupKeyForName(d.t)};
  }).sort((a,b)=>b.s-a.s);
  /* diversity: do not let one family consume the whole recommendation row */
  const out=[],used={};
  for(const x of scored){if((used[x.g]||0)>=2&&out.length<Math.min(5,limit))continue;out.push(x);used[x.g]=(used[x.g]||0)+1;if(out.length>=limit)break}
  return out;
}
function recordBehavior(kind,track){
  const t=track||MT.track;if(!t)return;const i=MT.themeIndexOfTrack(t);if(i<0)return;
  const arr=mtBehavior();arr.push({kind,theme:MT.DATA[i].t,track:t.shareId||t.title,ts:MT_NOW()});storeSet(MT_BEHAVIOR_KEY,arr.slice(-240));
}
let lastRecordedTrack='';
document.addEventListener('mt:track',()=>{
  const t=MT.track,id=t?.shareId||`${t?.title}|${t?.artist}`;
  if(t&&id!==lastRecordedTrack){lastRecordedTrack=id;recordBehavior('play',t);setTimeout(renderRecoHub,60)}
});
document.addEventListener('click',e=>{
  if(e.target.closest('.favorite-btn,.deck-favorite'))setTimeout(()=>{recordBehavior('favorite',MT.track);renderRecoHub()},120);
  if(e.target.closest('.dislike-btn,.deck-dislike'))setTimeout(()=>{recordBehavior('dislike',MT.track);renderRecoHub()},120);
},true);

let recoTab='daily';
try{recoTab=localStorage.getItem(MT_RECO_TAB_KEY)||'daily'}catch(_){recoTab='daily'}
function recoLabel(kind){return kind==='daily'?'今日推薦':kind==='week'?'本週推薦':'MT 推薦榜'}
function renderRecoHub(){
  const shelf=$('mtShelf');if(!shelf)return;
  let hub=$('mtRecoHub');
  if(!hub){hub=h('section','');hub.id='mtRecoHub';const chips=$('themeGroupTabs');shelf.insertBefore(hub,chips||shelf.lastChild);hub.addEventListener('click',e=>{
    const tab=e.target.closest('[data-reco-tab]');if(tab){recoTab=tab.dataset.recoTab;try{localStorage.setItem(MT_RECO_TAB_KEY,recoTab)}catch(_){}renderRecoHub();return}
    const card=e.target.closest('[data-reco-theme]');if(card){const i=Number(card.dataset.recoTheme);if(Number.isInteger(i)&&MT.DATA[i])MT.showTheme(i)}
  })}
  const list=rankedThemes(recoTab,8);
  const reason=recoTab==='daily'?'依你的偏好與近期聆聽，每天重新排列':recoTab==='week'?'把最近 7 天的聆聽與收藏拉高權重':'依曲庫完整度、授權與多樣性整理，不代表全站人氣';
  hub.innerHTML=`<div class="mt-reco-top"><b>FOR YOU · ${recoLabel(recoTab)}</b><small>${esc(reason)}</small></div>
    <div class="mt-reco-tabs" role="tablist">
      ${['daily','week','mt'].map(k=>`<button type="button" class="mt-reco-tab${k===recoTab?' is-active':''}" data-reco-tab="${k}" role="tab" aria-selected="${k===recoTab}">${recoLabel(k)}</button>`).join('')}
    </div>
    <div class="mt-reco-grid">${list.map((x,n)=>{const nm=MT.splitThemeName(x.d.t),ui=MT.genreUiFor(x.d.t);return `<button type="button" class="mt-reco-card" data-reco-theme="${x.i}" style="--reco-accent:${ui.accent}"><small>${String(n+1).padStart(2,'0')} · ${esc(MT.HOME_GROUPS[x.g]?.zh||'MUSICTOWN')}</small><b>${esc(nm.main)}</b><span>${esc(nm.sub||`${x.d.tracks?.length||0} 首`)}</span></button>`}).join('')}</div>`;
  requestAnimationFrame(measure);
}

/* full lyrics preview -------------------------------------------------- */
let lyricsSourceObserver=null;
function ensureLyricsSheet(){
  let sheet=$('mtLyricsSheet');if(sheet)return sheet;
  sheet=h('div','mt-lyrics-sheet',`<div class="mt-lyrics-backdrop" data-lyrics-close></div><section class="mt-lyrics-card" role="dialog" aria-modal="true" aria-labelledby="mtLyricsTitle"><header class="mt-lyrics-head"><div><small>FULL LYRICS · VERTICAL PREVIEW</small><h3 id="mtLyricsTitle">LYRICS</h3></div><button class="mt-lyrics-close" type="button" data-lyrics-close aria-label="關閉">×</button></header><div class="mt-lyrics-full" id="mtLyricsFull"></div></section>`);
  sheet.id='mtLyricsSheet';body.appendChild(sheet);
  sheet.addEventListener('click',e=>{
    if(e.target.closest('[data-lyrics-close]')){closeLyricsPreview();return}
    const line=e.target.closest('[data-lyrics-time]');if(line&&MT.audio){const t=Number(line.dataset.lyricsTime);if(Number.isFinite(t)){try{MT.audio.currentTime=t;MT.audio.play().catch(()=>{})}catch(_){}}}
  });
  return sheet;
}
function syncLyricsPreviewActive(){
  const src=document.querySelector('#playerSheet .live-lyrics-lines');const full=$('mtLyricsFull');if(!src||!full)return;
  const srcLines=[...src.querySelectorAll('.live-lyric-line')],dst=[...full.querySelectorAll('[data-lyrics-line]')];
  let active=-1;srcLines.forEach((el,i)=>{if(el.classList.contains('active'))active=i});
  dst.forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('past',i<active)});
  if(active>=0&&dst[active]&&$('mtLyricsSheet')?.classList.contains('open')){
    const box=full,el=dst[active],top=el.offsetTop-(box.clientHeight-el.offsetHeight)/2;box.scrollTo({top:Math.max(0,top),behavior:REDUCE?'auto':'smooth'});
  }
}
function openLyricsPreview(){
  const src=document.querySelector('#playerSheet .live-lyrics-lines');if(!src)return;
  const lines=[...src.querySelectorAll('.live-lyric-line')];if(!lines.length)return;
  const sheet=ensureLyricsSheet(),full=$('mtLyricsFull');
  $('mtLyricsTitle').textContent=MT.track?.title||'LYRICS';
  full.innerHTML=lines.map((el,i)=>`<button type="button" data-lyrics-line="${i}" ${el.dataset.time!=null?`data-lyrics-time="${esc(el.dataset.time)}"`:''}>${esc(el.textContent||'')}</button>`).join('');
  lyricsSourceObserver?.disconnect();lyricsSourceObserver=new MutationObserver(syncLyricsPreviewActive);lyricsSourceObserver.observe(src,{attributes:true,subtree:true,attributeFilter:['class']});
  syncLyricsPreviewActive();sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');
}
function closeLyricsPreview(){lyricsSourceObserver?.disconnect();lyricsSourceObserver=null;const s=$('mtLyricsSheet');s?.classList.remove('open');s?.setAttribute('aria-hidden','true')}
document.addEventListener('click',e=>{if(e.target.closest('#playerSheet .live-lyrics')&&!e.target.closest('a,button,input'))openLyricsPreview()},true);
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('mtLyricsSheet')?.classList.contains('open'))closeLyricsPreview()});

/* library presentation ------------------------------------------------ */
function enhanceLibrary(){
  const panel=$('libraryPanel');if(!panel)return;
  let hero=panel.querySelector('.mt-library-hero');
  if(!hero){hero=h('section','mt-library-hero');panel.querySelector('.library-head')?.after(hero)}
  const songs=Number(MT.libraryCount?.()||0),collections=panel.querySelectorAll('.library-collection-tab').length;
  let favs=0;for(const d of MT.DATA)for(const t of d.tracks||[]){try{if(MT.isFavorite(t))favs++}catch(_){}}
  const active=MT.activeLibraryName?.()||'MY LIBRARY';
  hero.innerHTML=`<div class="mt-library-stat"><small>CURRENT LIBRARY</small><b>${esc(active)}</b><span>收藏、匯入音樂與分享票根都集中在這裡</span></div><div class="mt-library-stat"><small>TRACKS</small><b>${songs}</b><span>目前資料庫</span></div><div class="mt-library-stat"><small>FAVORITES</small><b>${favs}</b><span>${collections} 個音樂庫</span></div>`;
}
const libSheet=$('localLibrarySheet');if(libSheet)new MutationObserver(()=>{if(libSheet.classList.contains('open'))requestAnimationFrame(enhanceLibrary)}).observe(libSheet,{attributes:true,attributeFilter:['class']});
if($('libraryPanel'))new MutationObserver(()=>{if(libSheet?.classList.contains('open'))requestAnimationFrame(enhanceLibrary)}).observe($('libraryPanel'),{childList:true,subtree:true});

/* clean, multi-step onboarding that trains only this device's recommender */
function installWelcomeV2(){
  const w=$('welcome');if(!w||root.classList.contains('mt-skip-welcome')||w.dataset.mtV2==='1')return;
  w.dataset.mtV2='1';w.classList.add('mt-welcome-v2');
  const draft=mtProfile();draft.contexts=[...(draft.contexts||[])];draft.macro=[...(draft.macro||[])];draft.favorites=[...(draft.favorites||[])];
  let step=0;
  const steps=[
    {k:'start',title:'讓 MUSICTOWN 先認識你的耳朵',copy:'這次不會一次塞給你 101 個主題。用幾個簡短選擇建立本機偏好，之後的今日推薦、本週推薦與 MT 推薦榜會自動整理。'},
    {k:'energy',title:'你通常想聽多有力的聲音？',copy:'這會影響搖滾、運動、Lo-fi、爵士等主題的初始權重。'},
    {k:'context',title:'你最常在什麼時候聽？',copy:'可選最多 3 個。之後實際播放與收藏會繼續修正，不會永遠綁死。'},
    {k:'macro',title:'你比較常從哪種入口找音樂？',copy:'可複選。城市、音樂風格、校園、景點都只是入口，演算法仍以實際聆聽行為為主。'},
    {k:'discovery',title:'推薦要多熟悉，還是多冒險？',copy:'熟悉會更貼近既有偏好；探索會提高你較少接觸的主題。'},
    {k:'favorites',title:'最後，挑幾個第一眼有感的主題',copy:'選 1–4 個即可。這些只作為起始種子，之後會被你的真實使用行為慢慢取代。'},
    {k:'done',title:'推薦引擎準備好了',copy:'資料只存在這個瀏覽器。你仍會進到同一個主頁，只是主題架最上方會多出三組推薦。'}
  ];
  const energy=[['calm','安靜一點','Lo-fi、雨夜、爵士、詩意'],['balanced','剛剛好','城市感、indie、soul、jazz'],['energetic','有力一點','Rock、跑步、運動、punk']];
  const contexts=[['study','讀書 / 工作','需要背景感，不搶注意力'],['commute','通勤 / 移動','城市節奏與行進感'],['workout','運動','節奏與能量優先'],['night','夜晚','夜色、雨、霓虹、低光'],['social','聚會 / 空間','有氛圍但可以一起聊天']];
  const macros=[['music','音樂風格','先從聲音本身出發'],['city','城市','先選一座城市'],['campus','大學','校園限定世界'],['spot','景點','從地點與故事進入']];
  const discovery=[['familiar','貼近我','較少突然跳很遠'],['mix','一半熟悉一半探索','平衡模式'],['explore','多給我意外','提高陌生主題權重']];
  w.innerHTML=`<div class="mt-onboard-card"><div class="mt-onboard-top"><div class="mt-onboard-brand"><i>MT</i><span>MUSICTOWN</span></div><div class="mt-onboard-progress" id="mtOnboardProgress"></div></div><div id="mtOnboardBody"></div><div class="mt-onboard-actions"><div class="left"><button class="mt-onboard-btn" type="button" data-ob="back">上一步</button><button class="mt-onboard-btn" type="button" data-ob="skip">直接進入</button></div><div class="right"><button class="mt-onboard-btn primary" type="button" data-ob="next">下一步</button></div></div></div>`;
  const bodyEl=w.querySelector('#mtOnboardBody'),progress=w.querySelector('#mtOnboardProgress');
  const selectedClass=(cond)=>cond?' is-selected':'';
  function themeCandidates(){
    let pool=MT.DATA.map((d,i)=>({d,i}));const chosen=draft.macro||[];if(chosen.length)pool=pool.filter(x=>chosen.some(m=>macroMatchesTheme(x.d,m)));
    return pool.sort((a,b)=>profileScore(b.d,draft)+themeQuality(b.d)-profileScore(a.d,draft)-themeQuality(a.d)).slice(0,18);
  }
  function render(){
    const cfg=steps[step];progress.textContent=`${step+1} / ${steps.length}`;
    let controls='';
    if(cfg.k==='start')controls=`<div class="mt-onboard-summary"><div><small>PRIVACY</small><b>只存在這個裝置</b></div><div><small>LEARNS FROM</small><b>播放 · 收藏 · 不喜歡</b></div></div>`;
    if(cfg.k==='energy')controls=`<div class="mt-onboard-options three">${energy.map(x=>`<button type="button" class="mt-onboard-choice${selectedClass(draft.energy===x[0])}" data-pick="energy" data-v="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</div>`;
    if(cfg.k==='context')controls=`<div class="mt-onboard-options">${contexts.map(x=>`<button type="button" class="mt-onboard-choice${selectedClass(draft.contexts.includes(x[0]))}" data-pick="context" data-v="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</div>`;
    if(cfg.k==='macro')controls=`<div class="mt-onboard-options">${macros.map(x=>`<button type="button" class="mt-onboard-choice${selectedClass(draft.macro.includes(x[0]))}" data-pick="macro" data-v="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</div>`;
    if(cfg.k==='discovery')controls=`<div class="mt-onboard-options three">${discovery.map(x=>`<button type="button" class="mt-onboard-choice${selectedClass(draft.discovery===x[0])}" data-pick="discovery" data-v="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></button>`).join('')}</div>`;
    if(cfg.k==='favorites')controls=`<div class="mt-onboard-theme-grid">${themeCandidates().map(x=>{const nm=MT.splitThemeName(x.d.t);return `<button type="button" class="mt-onboard-theme${selectedClass(draft.favorites.includes(x.d.t))}" data-pick="theme" data-v="${esc(x.d.t)}"><b>${esc(nm.main)}</b><span>${esc(MT.HOME_GROUPS[MT.themeGroupKeyForName(x.d.t)]?.zh||'MUSICTOWN')}</span></button>`}).join('')}</div>`;
    if(cfg.k==='done')controls=`<div class="mt-onboard-summary"><div><small>ENERGY</small><b>${esc(energy.find(x=>x[0]===draft.energy)?.[1]||'剛剛好')}</b></div><div><small>SCENES</small><b>${esc((draft.contexts||[]).map(k=>contexts.find(x=>x[0]===k)?.[1]).filter(Boolean).join(' · ')||'自由探索')}</b></div><div><small>DISCOVERY</small><b>${esc(discovery.find(x=>x[0]===draft.discovery)?.[1]||'平衡模式')}</b></div><div><small>SEEDS</small><b>${draft.favorites.length} 個主題</b></div></div>`;
    bodyEl.innerHTML=`<section class="mt-onboard-step is-active"><div class="mt-onboard-kicker">${step===0?'WELCOME':step===steps.length-1?'READY':`PREFERENCE ${String(step).padStart(2,'0')}`}</div><h2>${cfg.title}</h2><p>${cfg.copy}</p>${controls}</section>`;
    const back=w.querySelector('[data-ob="back"]'),skip=w.querySelector('[data-ob="skip"]'),next=w.querySelector('[data-ob="next"]');
    back.style.visibility=step===0?'hidden':'visible';skip.style.display=step===steps.length-1?'none':'inline-flex';next.textContent=step===steps.length-1?'進入 MUSICTOWN':'下一步';
    next.disabled=(cfg.k==='favorites'&&draft.favorites.length<1);
  }
  function finish(defaultOnly=false){
    if(defaultOnly&&!(draft.updatedAt>0)){Object.assign(draft,defaultProfile())}
    draft.updatedAt=MT_NOW();storeSet(MT_PROFILE_KEY,draft);try{localStorage.setItem('musicetown.r10.onboarded','1')}catch(_){}
    MT.home();w.classList.add('is-out');w.classList.remove('welcome-active');body.classList.remove('welcome-active');w.setAttribute('aria-hidden','true');renderRecoHub();document.dispatchEvent(new CustomEvent('mt:welcome',{detail:{done:true,profile:draft}}));
  }
  w.addEventListener('click',e=>{
    const pick=e.target.closest('[data-pick]');if(pick){const k=pick.dataset.pick,v=pick.dataset.v;if(k==='energy')draft.energy=v;if(k==='discovery')draft.discovery=v;if(k==='context'){const a=draft.contexts,i=a.indexOf(v);if(i>=0)a.splice(i,1);else if(a.length<3)a.push(v)}if(k==='macro'){const a=draft.macro,i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v)}if(k==='theme'){const a=draft.favorites,i=a.indexOf(v);if(i>=0)a.splice(i,1);else if(a.length<4)a.push(v)}render();return}
    const b=e.target.closest('[data-ob]');if(!b)return;if(b.dataset.ob==='back'){step=Math.max(0,step-1);render()}if(b.dataset.ob==='skip')finish(true);if(b.dataset.ob==='next'){if(step<steps.length-1){step++;render()}else finish(false)}
  });
  render();
}

/* ensure default/full dock is used until the user actually scrolls down */
document.addEventListener('mt:view',()=>{body.classList.remove('mt-compact');requestAnimationFrame(()=>{if(scrollY<120)body.classList.remove('mt-compact')})});
document.addEventListener('mt:track',()=>{if(scrollY<120)body.classList.remove('mt-compact')});
addEventListener('scroll',()=>{if(scrollY<72)body.classList.remove('mt-compact')},{passive:true});
installWelcomeV2();
renderRecoHub();

})();