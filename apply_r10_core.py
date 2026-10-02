#!/usr/bin/env python3
"""Install the small in-core R10.2 compatibility bridge.

The catalog builders keep the legacy app closure intact.  R10's shell runs as
an external script, so it needs a deliberately tiny API exposed from inside
that closure.  This patch is source-stable: it removes older R10 bridge blocks
and re-inserts the current bridge immediately before the app closure ends.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
START='/* ================= R10.2 CORE BRIDGE START ================= */'
END='/* ================= R10.2 CORE BRIDGE END ================= */'

# R10.2.4 · AUDIO / HOME FRAME
# CITYMUSIC VISUAL QUALITY V1 · Retina-aware WebGL quality with mobile safety caps

CAMERA=r'''/* camera */
let VP=null, invVP=null, eye=[0,0,0];
/* R10.2.4: keep the 3D drawer inside the visible band between top chrome
   and the recommendation/dock stack while the WebGL canvas still covers
   the whole viewport. */
function sceneSafeBand(){
  if(state.view!=='stage'||canvas.parentNode===$('detailSceneMount'))return null;
  const cs=getComputedStyle(document.documentElement);
  const top=parseFloat(cs.getPropertyValue('--mt-scene-top'))||0;
  const bottom=parseFloat(cs.getPropertyValue('--mt-scene-bottom'))||0;
  if(top+bottom<=0||cssH-top-bottom<140)return null;
  return {top,bottom,h:cssH-top-bottom};
}
function layoutCamera(){
  const band=sceneSafeBand();
  const asp=cssW/(band?band.h:cssH);

  let half=CAM.half;
  if(cssW < 1180) half*=1.16;
  if(cssW < 980)  half*=1.15;
  if(cssW < 760)  half*=1.12;
  if(asp < 1.18) half*=1.08;

  const needHalfW = cssW < 980 ? 320 : 285;
  if(asp*half < needHalfW) half=needHalfW/asp;

  const dist=half/Math.tan(CAM.fov/2);
  const dir=[
    -Math.sin(CAM.psi)*Math.cos(CAM.phi),
    Math.sin(CAM.phi),
    Math.cos(CAM.psi)*Math.cos(CAM.phi)
  ];
  const compactShift = cssW < 980 ? 22 : (cssW < 1180 ? 12 : 0);
  const tg=[
    CAM.target[0],
    CAM.target[1]-(half-CAM.half)*.10 + compactShift,
    CAM.target[2]
  ];

  eye=[
    tg[0]+dir[0]*dist,
    tg[1]+dir[1]*dist,
    tg[2]+dir[2]*dist
  ];
  VP=mul(
    persp(CAM.fov,asp,dist-1100,dist+1100),
    lookAt(eye,tg,[0,1,0])
  );
  if(band){
    const sy=band.h/cssH, ty=1-2*(band.top+band.h/2)/cssH;
    VP=mul(new Float32Array([1,0,0,0, 0,sy,0,0, 0,0,1,0, 0,ty,0,1]),VP);
  }
  invVP=inv(VP);
}
'''

QUALITY_RESIZE=r'''function resize(){
  // CITYMUSIC HQ: render the actual CSS box at a Retina-aware scale while
  // capping total pixels so mobile Safari does not trade sharpness for stalls.
  const r=canvas.getBoundingClientRect();
  cssW=Math.max(1,r.width||window.innerWidth);
  cssH=Math.max(1,r.height||window.innerHeight);

  const nativeDpr=Math.max(1,window.devicePixelRatio||1);
  const coarse=matchMedia('(pointer:coarse)').matches;
  const mobileLike=coarse||cssW<=820;
  const tierCap=MT_RENDER_LOW_POWER
    ? (mobileLike?1.52:1.65)
    : (mobileLike?1.88:2.05);
  const pixelBudget=MT_RENDER_LOW_POWER?2600000:(mobileLike?3600000:7200000);
  const areaCap=Math.sqrt(pixelBudget/Math.max(1,cssW*cssH));
  dpr=Math.max(1,Math.min(nativeDpr,tierCap,areaCap));

  W=Math.max(1,Math.round(cssW*dpr));
  H=Math.max(1,Math.round(cssH*dpr));
  if(canvas.width!==W)canvas.width=W;
  if(canvas.height!==H)canvas.height=H;

  if(gl){ makeTargets(); layoutCamera(); }
}'''


BRIDGE=r'''/* ================= R10.2 CORE BRIDGE START ================= */
/* R10.2 exposes only the navigation/player surface the external shell needs. */
function mtEmit(name,detail){
  try{document.dispatchEvent(new CustomEvent('mt:'+name,{detail:detail||{}}))}catch(_){}
}
function mtSplitThemeName(name){
  const raw=String(name||'').trim();
  const parts=raw.split(/\s*[·｜|]\s*/).filter(Boolean);
  return {main:parts[0]||raw,sub:parts.slice(1).join(' · ')};
}
function mtThemeSlug(name){
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-+|-+$/g,'');
}
function mtStageGroup(key){
  if(typeof setHomeGroup==='function'&&HOME_GROUPS?.[key])setHomeGroup(key);
}
function mtStageCustom(names){
  const cleaned=(Array.isArray(names)?names:[]).filter((n,i,a)=>DATA.some(d=>d.t===n)&&a.indexOf(n)===i).slice(0,HOME_CARD_SLOTS||9);
  if(!cleaned.length)return;
  while(cleaned.length<(HOME_CARD_SLOTS||9)){
    const pool=DATA.map(d=>d.t).filter(n=>!cleaned.includes(n));
    if(!pool.length)break;cleaned.push(pool[cleaned.length%pool.length]);
  }
  HOME_CITY_ORDER=[...cleaned];HOME_CITY_DEFAULT=[...cleaned];
  if(state){state.force=null;state.hovered=null;}
  try{refreshCardKeyLabels()}catch(_){}
  const di=homeDataIndex?.(0),d=Number.isInteger(di)&&di>=0?DATA[di]:null;
  if(d)try{setUiTheme(d.t,di)}catch(_){}
  if(gl&&state?.ready){try{uploadCardTextures();startIntro();requestAnimationFrame(resize)}catch(_){}}
  mtEmit('group',{key:'RECOMMENDED',items:[...cleaned]});
}
function mtPlayTheme(i,{shuffle=false}={}){
  const d=DATA[i];if(!d?.tracks?.length)return;
  const bad=mtReadBadAudio();
  const pool=d.tracks.filter(t=>!isDisliked(t)&&!bad.has(t.shareId||t.audioSrc));
  const list=pool.length?pool:d.tracks.filter(t=>!bad.has(t.shareId||t.audioSrc));
  const use=list.length?list:d.tracks;
  const t=shuffle?use[Math.floor(Math.random()*use.length)]:use[0];
  if(!autoNextEnabled&&typeof mtSetAutoNext==='function')mtSetAutoNext(true);
  openTrack(t,true);
}
function mtSetAutoNext(v){
  autoNextEnabled=!!v;
  const b=$('autoNextToggle');
  if(b){b.classList.toggle('active',autoNextEnabled);b.setAttribute('aria-pressed',autoNextEnabled?'true':'false');b.textContent=autoNextEnabled?'AUTO NEXT':'AUTO NEXT OFF';}
  mtEmit('autonext',{on:autoNextEnabled});
}
function mtLastTrack(){
  try{
    const x=JSON.parse(localStorage.getItem('musicetown.r10.lastTrack')||'null');
    if(!x?.id)return null;
    const gi=DATA.findIndex(d=>d.t===x.theme);
    const t=gi>=0?DATA[gi].tracks.find(tr=>(tr.shareId||tr.audioSrc)===x.id):null;
    return t?{track:t,index:gi}:null;
  }catch(_){return null}
}

/* R10.2.4 audio reliability.
   - never render the legacy source-page / iframe fallback
   - resolve project-page MP3s from the repository root
   - retry same-origin MP3s with cache busting
   - bad-audio state is short-lived per tab, never permanent */
const MT_BAD_AUDIO_KEY='musicetown.r10.2.4.badAudio';
const MT_BAD_AUDIO_TTL=120000;
function mtAudioId(t){return String(t?.shareId||t?.audioSrc||'').trim()}
function mtReadBadAudioMap(){
  try{return JSON.parse(sessionStorage.getItem(MT_BAD_AUDIO_KEY)||'{}')||{}}catch(_){return {}}
}
function mtWriteBadAudioMap(map){try{sessionStorage.setItem(MT_BAD_AUDIO_KEY,JSON.stringify(map))}catch(_){}}
function mtReadBadAudio(){
  const now=Date.now(),map=mtReadBadAudioMap(),out=new Set();let dirty=false;
  for(const [id,at] of Object.entries(map)){
    if(now-Number(at||0)<MT_BAD_AUDIO_TTL)out.add(id);
    else{delete map[id];dirty=true}
  }
  if(dirty)mtWriteBadAudioMap(map);
  return out;
}
function mtMarkBadAudio(t){
  const id=mtAudioId(t);if(!id)return;
  const map=mtReadBadAudioMap();map[id]=Date.now();mtWriteBadAudioMap(map);
  setTimeout(()=>{mtHideBadTrackRows()},MT_BAD_AUDIO_TTL+80);
}
function mtClearBadAudio(t){
  const id=mtAudioId(t);if(!id)return;
  const map=mtReadBadAudioMap();if(map[id]){delete map[id];mtWriteBadAudioMap(map);mtHideBadTrackRows()}
}
function mtAudioIsBad(t){return mtReadBadAudio().has(mtAudioId(t))}
function mtHideBadTrackRows(){
  document.querySelectorAll('.track-row[data-genre-index][data-track-index]').forEach(row=>{
    const gi=Number(row.dataset.genreIndex),ti=Number(row.dataset.trackIndex),t=DATA[gi]?.tracks?.[ti];
    row.hidden=!!t&&mtAudioIsBad(t);
  });
}
function mtSiteRoot(){
  try{
    if(location.protocol==='file:')return new URL('./',document.baseURI).href;
    if(/\.github\.io$/i.test(location.hostname)){
      const first=location.pathname.split('/').filter(Boolean)[0];
      return new URL('/'+(first?first+'/':''),location.origin).href;
    }
    return new URL('/',location.origin).href;
  }catch(_){return document.baseURI}
}
const mtResolveSiteCloudAudioCore=resolveSiteCloudAudio;
resolveSiteCloudAudio=function(t){
  const raw=String(t?.audioSrc||'').trim();
  if(raw&&!/^[a-z][a-z0-9+.-]*:/i.test(raw)&&!raw.startsWith('//')){
    try{return new URL(raw.replace(/^\/+/,''),mtSiteRoot()).href}catch(_){}
  }
  return mtResolveSiteCloudAudioCore(t);
};
function mtAudioCandidates(t){
  const raws=[t?.audioSrc,t?.originalLocalAudio,t?.originalAudioSrc,t?.download].map(x=>String(x||'').trim()).filter(Boolean);
  const out=[];
  for(const raw of raws){
    try{
      const u=/^[a-z][a-z0-9+.-]*:/i.test(raw)||raw.startsWith('//')
        ?new URL(raw,document.baseURI)
        :new URL(raw.replace(/^\/+/,''),mtSiteRoot());
      if(!out.includes(u.href))out.push(u.href);
    }catch(_){}
  }
  return out;
}
function mtTryAudioRecovery(t,a){
  if(!a||!t)return false;
  const urls=mtAudioCandidates(t);
  let n=Math.max(0,Number(a.dataset.mtRetryIndex||0));
  if(n>=urls.length)return false;
  try{
    const u=new URL(urls[n]);
    a.dataset.mtRetryIndex=String(n+1);
    if(u.origin===location.origin)u.searchParams.set('mt_audio','r1024-'+Date.now().toString(36));
    a.src=u.href;a.preload='auto';a.load();
    const p=a.play();if(p?.catch)p.catch(()=>{});
    try{showClickToast('重新連線音訊…')}catch(_){}
    return true;
  }catch(_){return false}
}
let mtAudioFallbackBusy=false;
if(typeof mountOnlinePlaybackFallback==='function'){
  mountOnlinePlaybackFallback=function(t){
    document.querySelectorAll('.online-fallback').forEach(n=>n.remove());
    const a=$('nativeAudioPlayer');
    if(mtTryAudioRecovery(t,a))return;

    mtMarkBadAudio(t);mtHideBadTrackRows();
    if(mtAudioFallbackBusy)return;
    let nxt=t;
    for(let i=0;i<24;i++){
      nxt=nextTrackFrom(nxt,1);
      if(nxt&&nxt!==t&&!mtAudioIsBad(nxt)&&nxt.audioSrc)break;
    }
    if(!nxt||nxt===t||mtAudioIsBad(nxt)){
      try{showClickToast('這首音訊暫時不可用，已從清單暫時隱藏')}catch(_){}
      return;
    }
    mtAudioFallbackBusy=true;
    try{showClickToast('音訊載入失敗，已自動換下一首')}catch(_){}
    setTimeout(()=>{
      try{openTrack(nxt,true,{reveal:$('playerSheet')?.classList.contains('open')!==false})}
      finally{mtAudioFallbackBusy=false}
    },120);
  };
}

/* Emit a stable event layer without forcing the legacy app to know R10. */
const mtOpenTrackCore=openTrack;
openTrack=function(t,userGesture=true,opts={}){
  const out=mtOpenTrackCore(t,userGesture,opts);
  try{
    activeTrack=t||activeTrack;
    const gi=t?DATA.findIndex(d=>d.tracks?.includes(t)):-1;
    if(t&&gi>=0)localStorage.setItem('musicetown.r10.lastTrack',JSON.stringify({id:t.shareId||t.audioSrc,theme:DATA[gi].t,at:Date.now()}));
    const a=activeAudio||$('nativeAudioPlayer');
    if(a)a.dataset.mtRetryIndex='0';
    mtEmit('track',{track:t,audio:a,index:gi});
    if(a&&t){
      const check=()=>{if(a.readyState===0&&!a.error&&a.networkState!==HTMLMediaElement.NETWORK_NO_SOURCE)mountOnlinePlaybackFallback(t)};
      setTimeout(check,7000);
    }
  }catch(_){}
  return out;
};
const mtShowDetailCore=showDetail;
showDetail=function(i){const out=mtShowDetailCore(i);mtEmit('view',{view:'detail',index:Number(i),theme:DATA[Number(i)]?.t});return out};
const mtBackToStageCore=backToStage;
backToStage=function(){const out=mtBackToStageCore();mtEmit('view',{view:'home'});return out};
if(typeof setHomeGroup==='function'){
  const mtSetHomeGroupCore=setHomeGroup;
  setHomeGroup=function(key,opts={}){const out=mtSetHomeGroupCore(key,opts);mtEmit('group',{key,items:[...(HOME_GROUPS[key]?.items||[])]});return out};
}
if(typeof renderTracks==='function'){
  const mtRenderTracksCore=renderTracks;
  renderTracks=function(...args){const out=mtRenderTracksCore(...args);requestAnimationFrame(mtHideBadTrackRows);return out};
}
if(typeof finishWelcome==='function'){
  const mtFinishWelcomeCore=finishWelcome;
  finishWelcome=function(...args){const out=mtFinishWelcomeCore(...args);mtEmit('welcome',{done:true});return out};
}

window.MT=Object.freeze({
  version:'R10.2.4',
  DATA,HOME_GROUPS,
  get view(){return state?.view==='branch'?'branch':'stage'},
  get modalOpen(){return state?.modal!=null},
  get groupKey(){return HOME_GROUP_KEY},
  get homeOrder(){return [...HOME_CITY_ORDER]},
  get themeIndex(){return state?.view==='branch'?(window.__genreIndex??-1):-1},
  get audio(){return activeAudio||$('nativeAudioPlayer')||null},
  get track(){return activeTrack||currentTrack||null},
  get autoNext(){return !!autoNextEnabled},
  get welcomeActive(){return document.body.classList.contains('welcome-active')},
  splitThemeName:mtSplitThemeName,themeSlug:mtThemeSlug,genreUiFor,themeGroupKeyForName,
  themeIndexBySlug:slug=>DATA.findIndex(d=>mtThemeSlug(d.t)===slug),
  showTheme:i=>navigateToThemeIndex(i),
  home:()=>{dismissWelcomeForNavigation();if(state?.view==='branch')backToStage();},
  stageGroup:mtStageGroup,stageCustom:mtStageCustom,
  playTheme:mtPlayTheme,
  reroll:()=>{if(typeof renderBranchDrawer==='function')renderBranchDrawer(window.__genreIndex||0)},
  openTrack:(t,gesture=true)=>openTrack(t,gesture),
  closePlayer:closeTrack,
  expandPlayer:()=>{if(!activeTrack)return false;if(!$('playerBody')?.children?.length)openTrack(activeTrack,false);$('playerSheet')?.classList.add('open');$('playerSheet')?.setAttribute('aria-hidden','false');return true},
  togglePlay:()=>{const a=activeAudio||$('nativeAudioPlayer');if(!a)return;if(a.paused){if((!a.currentSrc||a.error||a.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)&&activeTrack)mtTryAudioRecovery(activeTrack,a);else a.play().catch(()=>{})}else a.pause()},
  jump:jumpGlobal,
  upNext:(t,count=4)=>{const out=[];let cur=t;for(let k=0;k<count;k++){const nxt=cur?nextTrackFrom(cur,1):null;if(!nxt||nxt===t||out.includes(nxt))break;if(!mtAudioIsBad(nxt))out.push(nxt);cur=nxt}return out},
  themeIndexOfTrack:t=>{for(let gi=0;gi<DATA.length;gi++){if(DATA[gi].tracks?.includes(t))return gi}return -1},
  setAutoNext:mtSetAutoNext,
  isFavorite,toggleFavorite,isDisliked,toggleDislike,
  activeLibraryName:()=>getActiveLibrary()?.name||'MY LIBRARY',
  libraryCount:()=>localLibraryTracks?.length||0,
  passCount:()=>readPassbook?.().length||0,
  lastTrack:mtLastTrack,
  openSearch:openGlobalSearch,closeSearch:closeGlobalSearch,
  openLibrary:()=>openLibrary(),closeLibrary,
  openPassbook,closePassbook,
  openAudioOutput:()=>openAudioAccessoryEffect({auto:false}),
  shareTracks:(tracks,title)=>openShareComposer(tracks,title),
  shareTheme:i=>{const d=DATA[i];if(d)openShareComposer(currentDrawerTracks?.length?currentDrawerTracks:d.tracks.slice(0,12),d.t)},
  toast:showClickToast,icon:musicetownIcon,esc,
  audioIsBad:mtAudioIsBad,
  recoverAudio:(t=activeTrack,a=activeAudio||$('nativeAudioPlayer'))=>mtTryAudioRecovery(t,a)
});
queueMicrotask(()=>{mtEmit('ready',{});mtEmit('view',state?.view==='branch'?{view:'detail',index:window.__genreIndex??-1,theme:DATA[window.__genreIndex??-1]?.t}:{view:'home'});mtHideBadTrackRows()});
/* ================= R10.2 CORE BRIDGE END ================= */'''

OLD_BRIDGE=re.compile(r'/\* ================= R10 · bridge for the navigation shell =================[\s\S]*?mtEmit\(\'ready\',\{\}\);\s*',re.M)
CURRENT=re.compile(re.escape(START)+r'[\s\S]*?'+re.escape(END))

def patch(text:str,name:str)->str:
    text=CURRENT.sub('',text)
    text=OLD_BRIDGE.sub('',text)

    # Strip the legacy source-page/iframe fallback completely. R10.2.4 handles
    # recovery inside the bridge and never exposes ONLINE SOURCE to users.
    fb_start=text.find('function mountOnlinePlaybackFallback(t){')
    fb_end=text.find('\nlet mtWarmAudio=',fb_start)
    if fb_start<0 or fb_end<0:
        raise RuntimeError(f'{name}: audio fallback markers not found')
    clean_fallback="""function mountOnlinePlaybackFallback(t){
  try{document.querySelectorAll('.online-fallback').forEach(n=>n.remove())}catch(_){}
}
"""
    text=text[:fb_start]+clean_fallback+text[fb_end:]

    # CITYMUSIC VISUAL QUALITY V1.
    # Builders rewrite the legacy WebGL block on each production build, so
    # these replacements intentionally run against the generated HTML.
    gl_old="const gl = canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});"
    gl_new="const gl = canvas.getContext('webgl2',{antialias:true,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});"
    if gl_old not in text:
        raise RuntimeError(f'{name}: WebGL context quality marker not found')
    text=text.replace(gl_old,gl_new,1)

    tex_old="const S=768, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');"
    tex_new="const S=MT_PERF_MOBILE?768:1024, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d',{alpha:false}); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';"
    if tex_old not in text:
        raise RuntimeError(f'{name}: card texture quality marker not found')
    text=text.replace(tex_old,tex_new,1)

    aniso_old="Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))"
    aniso_new="Math.min(16,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))"
    if aniso_old not in text:
        raise RuntimeError(f'{name}: anisotropy quality marker not found')
    text=text.replace(aniso_old,aniso_new,1)

    rt_old="let W=1,H=1,cssW=1,cssH=1,dpr=1,T=null;"
    rt_new="""/* CITYMUSIC HQ render tier */
const MT_RENDER_DM=Number(navigator.deviceMemory||0);
const MT_RENDER_HC=Number(navigator.hardwareConcurrency||6);
const MT_RENDER_LOW_POWER=(MT_RENDER_DM>0&&MT_RENDER_DM<=4)||MT_RENDER_HC<=4;
let W=1,H=1,cssW=1,cssH=1,dpr=1,T=null;"""
    if rt_old not in text:
        raise RuntimeError(f'{name}: render-target quality marker not found')
    text=text.replace(rt_old,rt_new,1)

    samples_old="const samples=Math.min(((navigator.deviceMemory||4)<=4||cssW<700)?2:4,gl.getParameter(gl.MAX_SAMPLES)||0);"
    samples_new="const samples=Math.min(MT_RENDER_LOW_POWER?2:4,gl.getParameter(gl.MAX_SAMPLES)||0);"
    if samples_old not in text:
        raise RuntimeError(f'{name}: MSAA quality marker not found')
    text=text.replace(samples_old,samples_new,1)

    # Reinstall the safe-band camera on every generated catalog. Builders can
    # rewrite the legacy WebGL block, so this must live in the source pipeline.
    cam_start=text.find('/* camera */')
    resize_start=text.find('function resize(){',cam_start)
    if cam_start<0 or resize_start<0:
        raise RuntimeError(f'{name}: camera markers not found')
    text=text[:cam_start]+CAMERA+'\n'+text[resize_start:]

    resize_pat=re.compile(r'function resize\(\)\{[\s\S]*?\n\}\n\n(?=/\* ================= interaction state)',re.M)
    text,count=resize_pat.subn(QUALITY_RESIZE+'\n\n',text,count=1)
    if count!=1:
        raise RuntimeError(f'{name}: generated resize quality block not found')
    boot=text.find('/* ================= boot ================= */')
    if boot<0: raise RuntimeError(f'{name}: boot marker not found')
    close=text.find('\n})();\n</script>',boot)
    if close<0: raise RuntimeError(f'{name}: main app closure end not found')
    return text[:close]+'\n\n'+BRIDGE+'\n'+text[close:]

for name in ('index.html','404.html'):
    p=ROOT/name
    if not p.exists():continue
    p.write_text(patch(p.read_text(encoding='utf-8'),name),encoding='utf-8')
    print(name,'R10.2 core bridge installed')