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

/* Broken audio is retried once with a cache-busting URL.  If it still fails,
   silently remove it from the local rotation instead of showing ONLINE SOURCE. */
const MT_BAD_AUDIO_KEY='musicetown.r10.badAudio';
function mtReadBadAudio(){
  try{return new Set(JSON.parse(localStorage.getItem(MT_BAD_AUDIO_KEY)||'[]'))}catch(_){return new Set()}
}
function mtMarkBadAudio(t){
  const id=String(t?.shareId||t?.audioSrc||'').trim();if(!id)return;
  const s=mtReadBadAudio();s.add(id);try{localStorage.setItem(MT_BAD_AUDIO_KEY,JSON.stringify([...s].slice(-80)))}catch(_){}
}
function mtAudioIsBad(t){return mtReadBadAudio().has(String(t?.shareId||t?.audioSrc||''))}
function mtHideBadTrackRows(){
  document.querySelectorAll('.track-row[data-genre-index][data-track-index]').forEach(row=>{
    const gi=Number(row.dataset.genreIndex),ti=Number(row.dataset.trackIndex),t=DATA[gi]?.tracks?.[ti];
    row.hidden=!!t&&mtAudioIsBad(t);
  });
}
let mtAudioFallbackBusy=false;
if(typeof mountOnlinePlaybackFallback==='function'){
  mountOnlinePlaybackFallback=function(t){
    document.querySelectorAll('.online-fallback').forEach(n=>n.remove());
    const a=$('nativeAudioPlayer');
    if(a&&t&&!t.__mtCacheRetry){
      t.__mtCacheRetry=true;
      try{
        const raw=String(t.audioSrc||t.originalLocalAudio||t.originalAudioSrc||'').trim();
        if(raw){
          const u=new URL(raw,document.baseURI);u.searchParams.set('mt_audio','r102');
          a.src=u.href;a.preload='auto';a.load();
          const p=a.play();if(p?.catch)p.catch(()=>{});
          showClickToast?.('重新連線音訊…');
          return;
        }
      }catch(_){}
    }
    mtMarkBadAudio(t);mtHideBadTrackRows();
    if(mtAudioFallbackBusy)return;
    let nxt=t;
    for(let i=0;i<18;i++){
      nxt=nextTrackFrom(nxt,1);
      if(nxt&&nxt!==t&&!mtAudioIsBad(nxt)&&nxt.audioSrc)break;
    }
    if(!nxt||nxt===t||mtAudioIsBad(nxt)){
      try{showClickToast('這首音訊暫時不可用，已從清單隱藏')}catch(_){}
      return;
    }
    mtAudioFallbackBusy=true;
    try{showClickToast('音訊來源失效，已自動略過')}catch(_){}
    setTimeout(()=>{
      try{openTrack(nxt,true,{reveal:$('playerSheet')?.classList.contains('open')!==false})}finally{mtAudioFallbackBusy=false}
    },90);
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
  version:'R10.2',
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
  togglePlay:()=>{const a=activeAudio||$('nativeAudioPlayer');if(!a)return;if(a.paused)a.play().catch(()=>{});else a.pause()},
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
  audioIsBad:mtAudioIsBad
});
queueMicrotask(()=>{mtEmit('ready',{});mtEmit('view',state?.view==='branch'?{view:'detail',index:window.__genreIndex??-1,theme:DATA[window.__genreIndex??-1]?.t}:{view:'home'});mtHideBadTrackRows()});
/* ================= R10.2 CORE BRIDGE END ================= */'''

OLD_BRIDGE=re.compile(r'/\* ================= R10 · bridge for the navigation shell =================[\s\S]*?mtEmit\(\'ready\',\{\}\);\s*',re.M)
CURRENT=re.compile(re.escape(START)+r'[\s\S]*?'+re.escape(END))

def patch(text:str,name:str)->str:
    text=CURRENT.sub('',text)
    text=OLD_BRIDGE.sub('',text)
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