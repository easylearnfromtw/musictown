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
POOL_START='/* ================= CITYMUSIC TRACK POOL V1 START ================= */'
POOL_END='/* ================= CITYMUSIC TRACK POOL V1 END ================= */'

POOL_RUNTIME=r'''/* ================= CITYMUSIC TRACK POOL V1 START ================= */
function hydrateCitymusicTrackPools(data){
  const master=new Map(),masterNames=new Set(['JAZZ','CROONER','ROCK','SPORT','LO-FI']);
  for(const d of data){
    if(!masterNames.has(d.t))continue;
    (d.tracks||[]).slice(0,50).forEach((t,i)=>{const ref=String(t.masterRef||d.t+':'+i);t.masterRef=ref;master.set(ref,{...t})});
  }
  for(const d of data){
    const refs=Array.isArray(d.poolRefs)?d.poolRefs:[];if(!refs.length)continue;
    const existing=new Map((d.tracks||[]).map(t=>[String(t.shareId||''),t])),expanded=[];
    for(let i=0;i<refs.length;i++){
      const e=refs[i]||{},ref=String(e.r||''),base=master.get(ref);if(!base)continue;
      const sid=String(e.id||base.shareId||ref),t=existing.get(sid)||{...base};
      t.shareId=sid;t.trackNo=i+1;t.masterRef=ref;t.curatedTheme=d.t;t.curationScore=Number(e.q??t.curationScore??t.limitedCurationScore??0);
      t.curatedFromDrawer=e.src||t.curatedFromDrawer||ref.split(':')[0];t.poolRank=i+1;t.poolSize=refs.length;
      if(d.limitedTheme){t.limitedTheme=true;t.limitedSourceTheme=e.src||t.limitedSourceTheme||''}
      if(!existing.has(sid))t.vibe=(d.key||d.sub||d.t)+' · '+(base.genre||base.vibe||e.src||'CC0 Music');
      expanded.push(t);
    }
    const target=Math.max(1,Number(d.targetTracks||50)||50);
    if(expanded.length>=target){
      d.tracks=expanded;d.poolSize=expanded.length;d.searchableTracks=expanded.length;
    }else if((d.tracks||[]).length<target&&master.size){
      /* CITYMUSIC NO-BLANK THEME FALLBACK:
         CI should make this path unnecessary. It exists so a stale cached shell
         can never render a named theme with an empty music list. */
      const seed=String(d.t||'CITYMUSIC');
      const rows=[...master.entries()].map(([ref,t])=>({ref,t,h:[...seed+'|'+ref].reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619)>>>0,2166136261)}))
        .sort((a,b)=>a.h-b.h).slice(0,target);
      d.tracks=rows.map((x,i)=>({...x.t,masterRef:x.ref,shareId:(String(d.key||d.t||'theme').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'theme')+'-fallback-'+String(i+1).padStart(3,'0'),trackNo:i+1,curatedTheme:d.t,curationTier:'runtime-emergency-fallback'}));
      d.poolSize=d.tracks.length;d.searchableTracks=d.tracks.length;
      console.warn('[CITYMUSIC] emergency non-blank fallback used for',d.t);
    }
  }
}
hydrateCitymusicTrackPools(DATA);
/* ================= CITYMUSIC TRACK POOL V1 END ================= */'''

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
  const bad=mtReadBadAudio(),weekly=mtVisibleTracks(i);
  const pool=weekly.filter(t=>!isDisliked(t)&&!bad.has(t.shareId||t.audioSrc));
  const list=pool.length?pool:weekly.filter(t=>!bad.has(t.shareId||t.audioSrc));
  const use=list.length?list:(weekly.length?weekly:d.tracks);
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

/* ================= CITYMUSIC WEEKLY TRACK MIX V1 ================= */
const MT_TRACK_SIGNAL_KEY='citymusic.r10.5.trackSignals';
let mtTrackSignalSession=null;
function mtTrackKey(t){return String(t?.masterRef||t?.originalLocalAudio||t?.originalAudioSrc||t?.audioSrc||t?.source||((t?.artist||'')+'|'+(t?.title||'')))}
function mtTrackSignals(){try{const x=JSON.parse(localStorage.getItem(MT_TRACK_SIGNAL_KEY)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return {}}}
function mtSaveTrackSignals(x){try{localStorage.setItem(MT_TRACK_SIGNAL_KEY,JSON.stringify(x))}catch(_){}}
function mtBumpTrackSignal(t,kind){
  if(!t)return;const k=mtTrackKey(t),all=mtTrackSignals(),r=all[k]||{plays:0,finishes:0,skips:0,last:0,artist:''};
  if(kind==='play')r.plays=(r.plays||0)+1;if(kind==='finish')r.finishes=(r.finishes||0)+1;if(kind==='skip')r.skips=(r.skips||0)+1;
  r.last=Date.now();r.artist=String(t.artist||'');all[k]=r;
  const keys=Object.keys(all);if(keys.length>700)keys.sort((a,b)=>(all[b].last||0)-(all[a].last||0)).slice(700).forEach(x=>delete all[x]);
  mtSaveTrackSignals(all);
}
function mtCloseTrackSignalSession(){
  const s=mtTrackSignalSession;if(!s||s.closed)return;s.closed=true;
  const sec=Number(s.audio?.currentTime||0),dur=Number(s.audio?.duration||0);
  if(s.finished)return;
  if((Number.isFinite(dur)&&dur>0&&sec/dur>=.82)||sec>=150){s.finished=true;mtBumpTrackSignal(s.track,'finish')}
  else if(sec<25)mtBumpTrackSignal(s.track,'skip');
}
function mtStartTrackSignal(t,a){
  if(!t)return;const key=mtTrackKey(t);
  if(mtTrackSignalSession&&!mtTrackSignalSession.closed&&mtTrackSignalSession.key===key)return;
  const s={key,track:t,audio:a,closed:false,finished:false};mtTrackSignalSession=s;mtBumpTrackSignal(t,'play');
  a?.addEventListener?.('ended',()=>{if(!s.finished){s.finished=true;s.closed=true;mtBumpTrackSignal(t,'finish')}},{once:true});
}
window.addEventListener('pagehide',mtCloseTrackSignalSession,{passive:true});
function mtWeekSeed(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function mtHash32(s){let h=2166136261>>>0;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function mtSeed01(s){return mtHash32(s)/4294967295}
function mtVisibleTrackIndexes(gi){
  const d=DATA[gi];if(!d?.tracks?.length)return [];const target=Math.min(themeTrackTarget(d),d.tracks.length),week=mtWeekSeed(),sig=mtTrackSignals();
  const favs=typeof loadFavoriteKeys==='function'?loadFavoriteKeys():new Set(),dis=typeof loadDislikeKeys==='function'?loadDislikeKeys():new Set(),bad=typeof mtReadBadAudio==='function'?mtReadBadAudio():new Set(),aff={};
  for(const r of Object.values(sig)){const a=String(r?.artist||'').trim().toLowerCase();if(a)aff[a]=(aff[a]||0)+Math.max(-4,(r.finishes||0)*2.4-(r.skips||0)*1.7+Math.log1p(r.plays||0))}
  const rows=d.tracks.map((t,i)=>{
    const key=mtTrackKey(t),r=sig[key]||{},artist=String(t.artist||'').trim().toLowerCase();let q=Number(t.curationScore??t.limitedCurationScore??0);if(!Number.isFinite(q))q=0;
    let score=q*.075+Math.log1p(r.plays||0)*1.8+(r.finishes||0)*5.2-(r.skips||0)*4.4;
    if((r.plays||0)>0)score+=Math.max(-5,Math.min(7,((r.finishes||0)-(r.skips||0))/(r.plays||1)*5));
    if(typeof favoriteKey==='function'&&favs.has(favoriteKey(t)))score+=28;score+=Math.max(-3,Math.min(8,(aff[artist]||0)*.7));
    const age=Date.now()-Number(r.last||0);if(r.last&&age<86400000)score-=5.5;else if(r.last&&age<604800000)score-=2;
    score+=mtSeed01(week+'|p|'+d.t+'|'+key)*.75;
    return {i,t,key,q,score,disliked:typeof dislikeKey==='function'&&dis.has(dislikeKey(t)),bad:bad.has(typeof mtAudioId==='function'?mtAudioId(t):'')};
  });
  let usable=rows.filter(x=>!x.disliked&&!x.bad);if(usable.length<target)usable=rows.filter(x=>!x.bad);if(usable.length<target)usable=rows;
  usable.sort((a,b)=>b.score-a.score||b.q-a.q||a.i-b.i);
  const pc=Math.min(target,Math.max(1,Math.round(target*.70))),personal=usable.slice(0,pc),chosen=new Set(personal.map(x=>x.i));
  const rest=usable.filter(x=>!chosen.has(x.i)).sort((a,b)=>b.q-a.q||b.score-a.score).slice(0,Math.min(usable.length,Math.max(target,Math.round(target*1.65))));
  rest.sort((a,b)=>mtSeed01(week+'|x|'+d.t+'|'+a.key)-mtSeed01(week+'|x|'+d.t+'|'+b.key));
  const out=[...personal,...rest.slice(0,target-personal.length)];
  if(out.length<target)for(const x of usable){if(!out.some(y=>y.i===x.i)){out.push(x);if(out.length>=target)break}}
  return out.slice(0,target).map(x=>x.i);
}
function mtVisibleTracks(i){const d=DATA[i];return mtVisibleTrackIndexes(i).map(x=>d.tracks[x]).filter(Boolean)}
function mtRenderWeeklyTracks(gi,query=''){
  const d=DATA[gi],q=String(query||'').trim().toLowerCase();
  const idx=q?d.tracks.map((t,i)=>({t,i})).filter(x=>(String(x.t.title||'')+' '+String(x.t.artist||'')+' '+String(x.t.vibe||'')).toLowerCase().includes(q)).map(x=>x.i):mtVisibleTrackIndexes(gi);
  $('trackList').innerHTML=idx.map((i,n)=>{const t=d.tracks[i],saved=isFavorite(t),disliked=isDisliked(t);return '<div class="track-row '+(disliked?'disliked':'')+'" data-genre-index="'+gi+'" data-track-index="'+i+'" tabindex="0" role="button" aria-label="開啟 '+esc(t.title)+'"><div class="track-no">'+String(n+1).padStart(2,'0')+'</div><div><div class="track-name">'+esc(t.title)+'</div><div class="track-note">'+esc(t.artist)+' · '+esc(t.vibe)+'</div></div><div class="track-actions"><span class="cc0-badge">'+esc(t.license)+'</span><button class="favorite-btn '+(saved?'saved':'')+'" type="button" data-genre-index="'+gi+'" data-track-index="'+i+'">'+(saved?'♥':'♡')+'</button><button class="dislike-btn '+(disliked?'disliked':'')+'" type="button" data-genre-index="'+gi+'" data-track-index="'+i+'">'+(disliked?'−':'⊘')+'</button><button class="play-dot" type="button" tabindex="-1" aria-hidden="true">'+musicetownIcon('play')+'</button></div></div>'}).join('')||'<div class="track-note" style="padding:20px">找不到符合的歌曲</div>';
}
function mtPaintThemePoolCounts(){document.querySelectorAll('.theme-shelf-item[data-theme-index]').forEach(el=>{const i=Number(el.dataset.themeIndex),d=DATA[i],s=el.querySelector('span');if(d&&s)s.textContent=themeTrackTarget(d)+' 本週 · '+d.tracks.length+' 曲池'})}
/* ================= /CITYMUSIC WEEKLY TRACK MIX V1 ================= */

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
  const sameSignal=!!(mtTrackSignalSession&&!mtTrackSignalSession.closed&&mtTrackSignalSession.key===mtTrackKey(t));
  if(!sameSignal)mtCloseTrackSignalSession();
  const out=mtOpenTrackCore(t,userGesture,opts);
  try{
    activeTrack=t||activeTrack;
    const gi=t?DATA.findIndex(d=>d.tracks?.includes(t)):-1;
    if(t&&gi>=0)localStorage.setItem('musicetown.r10.lastTrack',JSON.stringify({id:t.shareId||t.audioSrc,theme:DATA[gi].t,at:Date.now()}));
    const a=activeAudio||$('nativeAudioPlayer');
    if(a)a.dataset.mtRetryIndex='0';
    if(!sameSignal)mtStartTrackSignal(t,a);
    mtEmit('track',{track:t,audio:a,index:gi});
    if(a&&t){
      const check=()=>{if(a.readyState===0&&!a.error&&a.networkState!==HTMLMediaElement.NETWORK_NO_SOURCE)mountOnlinePlaybackFallback(t)};
      setTimeout(check,7000);
    }
  }catch(_){}
  return out;
};
const mtShowDetailCore=showDetail;
showDetail=function(i){const out=mtShowDetailCore(i),d=DATA[Number(i)];if(d){const target=themeTrackTarget(d),pool=d.tracks?.length||target;if($('archivePoolLabel'))$('archivePoolLabel').textContent=target+' 本週精選 · '+pool+' 可搜尋';if($('all50Btn'))$('all50Btn').textContent=DATA.reduce((n,x)=>n+themeTrackTarget(x),0)+' 本週 · '+DATA.reduce((n,x)=>n+(x.tracks?.length||0),0)+' 曲池';if($('musicMeta')&&!$('musicMeta').querySelector('.mt-weekly-chip'))$('musicMeta').insertAdjacentHTML('beforeend','<span class="music-chip mt-weekly-chip">WEEKLY ADAPTIVE</span>');if($('rightsNote'))$('rightsNote').innerHTML='<strong>每週自適應：</strong>約 70% 依收藏、聽完、播放與略過行為排序；其餘約 30% 每週固定換一批。搜尋仍可找到完整 '+pool+' 首曲池。'}mtEmit('view',{view:'detail',index:Number(i),theme:d?.t});return out};
const mtBackToStageCore=backToStage;
backToStage=function(){const out=mtBackToStageCore();mtEmit('view',{view:'home'});return out};
if(typeof setHomeGroup==='function'){
  const mtSetHomeGroupCore=setHomeGroup;
  setHomeGroup=function(key,opts={}){const out=mtSetHomeGroupCore(key,opts);mtEmit('group',{key,items:[...(HOME_GROUPS[key]?.items||[])]});return out};
}
if(typeof renderTracks==='function'){
  const mtRenderTracksCore=renderTracks;
  renderTracks=function(gi,q=''){
    let idx=Number(gi);
    /* Some legacy entry points call renderTracks(query) or renderTracks()
       and rely on the active branch index. Never turn that into NaN/blank. */
    if(!Number.isInteger(idx)||idx<0||idx>=DATA.length){
      if(typeof gi==='string'&&q==='')q=gi;
      idx=Number(window.__genreIndex);
    }
    if(!Number.isInteger(idx)||idx<0||idx>=DATA.length){
      const out=mtRenderTracksCore.apply(this,arguments);
      requestAnimationFrame(mtHideBadTrackRows);
      return out;
    }
    const out=mtRenderWeeklyTracks(idx,q);
    requestAnimationFrame(mtHideBadTrackRows);
    return out;
  }
}
if(typeof renderBranchDrawer==='function'){const mtRenderBranchDrawerCore=renderBranchDrawer;renderBranchDrawer=function(gi){const d=DATA[Number(gi)];if(!d)return mtRenderBranchDrawerCore(gi);const all=d.tracks,weekly=mtVisibleTracks(Number(gi));d.tracks=weekly.length?weekly:all;try{return mtRenderBranchDrawerCore(gi)}finally{d.tracks=all;if($('drawerPoolMeta'))$('drawerPoolMeta').textContent=d.t+' · WEEKLY MIX · RANDOM '+Math.min(5,weekly.length||all.length)}}}
if(typeof nextTrackFrom==='function'){const mtNextTrackFromCore=nextTrackFrom;nextTrackFrom=function(t,dir=1){const p=findTrackPosition(t);if(!p||p.local)return mtNextTrackFromCore(t,dir);const weekly=mtVisibleTracks(p.gi),at=weekly.indexOf(t);if(at>=0)return nextAllowedTrack(weekly,at,dir)||mtNextTrackFromCore(t,dir);return mtNextTrackFromCore(t,dir)}}
if(typeof renderThemeShelf==='function'){const mtRenderThemeShelfCore=renderThemeShelf;renderThemeShelf=function(...args){const out=mtRenderThemeShelfCore(...args);requestAnimationFrame(mtPaintThemePoolCounts);return out}}
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
  visibleTracks:i=>mtVisibleTracks(Number(i)),
  visibleTrackIndexes:i=>mtVisibleTrackIndexes(Number(i)),
  trackWeekKey:mtWeekSeed,
  recoverAudio:(t=activeTrack,a=activeAudio||$('nativeAudioPlayer'))=>mtTryAudioRecovery(t,a)
});
queueMicrotask(()=>{mtEmit('ready',{});mtEmit('view',state?.view==='branch'?{view:'detail',index:window.__genreIndex??-1,theme:DATA[window.__genreIndex??-1]?.t}:{view:'home'});mtHideBadTrackRows()});
/* ================= R10.2 CORE BRIDGE END ================= */'''

OLD_BRIDGE=re.compile(r'/\* ================= R10 · bridge for the navigation shell =================[\s\S]*?mtEmit\(\'ready\',\{\}\);\s*',re.M)
CURRENT=re.compile(re.escape(START)+r'[\s\S]*?'+re.escape(END))
POOL_CURRENT=re.compile(re.escape(POOL_START)+r'[\s\S]*?'+re.escape(POOL_END))

def patch(text:str,name:str)->str:
    text=CURRENT.sub('',text)
    text=POOL_CURRENT.sub('',text)
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

    # CITYMUSIC VINYL SCRUB EASY V2.
    # Make the physical-disc gesture respond to small thumb movement while
    # keeping the existing transport/audio pipeline as the single source of truth.
    scrub_replacements = [
        ("const SCRUB_SECONDS_PER_TURN=96;", "const SCRUB_SECONDS_PER_TURN=150; /* CITYMUSIC VINYL SCRUB EASY V2 */"),
        ("const linearSeconds=dx*.62;", "const linearSeconds=dx*(matchMedia('(pointer:coarse)').matches?1.05:.88);"),
        ("const blend=Math.max(0,Math.min(.34,(radius-rect.width*.14)/(rect.width*.58)));",
         "const blend=Math.max(.12,Math.min(.72,(radius-rect.width*.10)/(rect.width*.46)));"),
        ("vinyl.setAttribute('aria-label',\`${c.name} 彩膠唱片。按住唱片即可平滑快轉或倒轉。\`);",
         "vinyl.setAttribute('aria-label',\`${c.name} 彩膠唱片。輕拖唱片任意方向即可快轉或倒轉。\`);"),
    ]
    for old,new in scrub_replacements:
        if old in text:
            text=text.replace(old,new,1)
        elif new not in text:
            raise RuntimeError(f'{name}: vinyl easy-scrub marker not found: {old[:42]}')

    # CITYMUSIC VISUAL QUALITY V1.
    # Builders rewrite the legacy WebGL block on each production build, so
    # these replacements intentionally run against the generated HTML.
    gl_old="const gl = canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});"
    gl_new="const gl = canvas.getContext('webgl2',{antialias:true,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'});"
    if gl_old in text:
        text=text.replace(gl_old,gl_new,1)
    elif gl_new not in text:
        raise RuntimeError(f'{name}: WebGL context quality marker not found')

    tex_old="const S=768, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');"
    tex_new="const S=MT_PERF_MOBILE?768:1024, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d',{alpha:false}); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';"
    if tex_old in text:
        text=text.replace(tex_old,tex_new,1)
    elif tex_new not in text:
        raise RuntimeError(f'{name}: card texture quality marker not found')

    aniso_old="Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))"
    aniso_new="Math.min(16,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))"
    if aniso_old in text:
        text=text.replace(aniso_old,aniso_new,1)
    elif aniso_new not in text:
        raise RuntimeError(f'{name}: anisotropy quality marker not found')

    rt_old="let W=1,H=1,cssW=1,cssH=1,dpr=1,T=null;"
    rt_new="""/* CITYMUSIC HQ render tier */
const MT_RENDER_DM=Number(navigator.deviceMemory||0);
const MT_RENDER_HC=Number(navigator.hardwareConcurrency||6);
const MT_RENDER_LOW_POWER=(MT_RENDER_DM>0&&MT_RENDER_DM<=4)||MT_RENDER_HC<=4;
let W=1,H=1,cssW=1,cssH=1,dpr=1,T=null;"""
    if rt_old in text:
        text=text.replace(rt_old,rt_new,1)
    elif "const MT_RENDER_LOW_POWER=" not in text:
        raise RuntimeError(f'{name}: render-target quality marker not found')

    samples_old="const samples=Math.min(((navigator.deviceMemory||4)<=4||cssW<700)?2:4,gl.getParameter(gl.MAX_SAMPLES)||0);"
    samples_new="const samples=Math.min(MT_RENDER_LOW_POWER?2:4,gl.getParameter(gl.MAX_SAMPLES)||0);"
    if samples_old in text:
        text=text.replace(samples_old,samples_new,1)
    elif samples_new not in text:
        raise RuntimeError(f'{name}: MSAA quality marker not found')

    pool_anchor='hydrateLaunchThemePools(DATA);'
    if pool_anchor not in text:
        raise RuntimeError(f'{name}: theme-pool hydration anchor not found')
    text=text.replace(pool_anchor,pool_anchor+'\n'+POOL_RUNTIME,1)
    text=text.replace('trackHits.length<32','trackHits.length<96')
    text=text.replace("trackHits.length>=32?' +'","trackHits.length>=96?' +'")

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