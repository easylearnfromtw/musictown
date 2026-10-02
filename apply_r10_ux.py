#!/usr/bin/env python3
"""Inject the R10 Flow & Glass shell and, when upgrading an older R9 build,
install the small in-core MT bridge required by the shell.

Safe to run repeatedly.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
CSS = (ROOT / "r10_ux.css").read_text(encoding="utf-8")
JS = (ROOT / "r10_ux.js").read_text(encoding="utf-8")
STYLE_RE = re.compile(r'\n?<style id="r10-ux-layer">[\s\S]*?</style>\n?')
SCRIPT_RE = re.compile(r'\n?<script id="r10-ux-script">[\s\S]*?</script>\n?')

CORE_BRIDGE = r'''

/* ================= R10 · compatibility bridge =================
   Upgrades an R9 core in place. The shell only talks to this API. */
function mtEmit(name,detail){try{document.dispatchEvent(new CustomEvent('mt:'+name,{detail:detail||{}}))}catch(_){}}
function mtSplitThemeName(name){
  if(typeof splitThemeName==='function')return splitThemeName(name);
  const p=String(name||'').split(' · ');return {main:p[0]||String(name||''),sub:p[1]||''};
}
function mtThemeSlug(name){
  if(typeof themeSlug==='function')return themeSlug(name);
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function mtThemeGroupKey(name){
  if(typeof themeGroupKeyForName==='function')return themeGroupKeyForName(name);
  if(typeof HOME_GROUPS!=='undefined')for(const [k,g] of Object.entries(HOME_GROUPS))if(g.items?.includes(name))return k;
  return 'MUSIC_THEMES';
}
function mtExpandPlayer(){
  if(!activeTrack)return false;
  if(!$('playerBody')?.children?.length)openTrack(activeTrack,false);
  $('playerSheet')?.classList.add('open');$('playerSheet')?.setAttribute('aria-hidden','false');
  return true;
}
function mtThemeIndexOfTrack(t){
  try{const p=t?findTrackPosition(t):null;return p&&!p.local?p.gi:-1}catch(_){
    return DATA.findIndex(d=>(d.tracks||[]).includes(t));
  }
}
function mtUpNext(t,count=4){
  const out=[];let cur=t;
  for(let k=0;k<count;k++){const nxt=cur?nextTrackFrom(cur,1):null;if(!nxt||nxt===t||out.includes(nxt))break;out.push(nxt);cur=nxt}
  return out;
}
function mtPlayTheme(i,{shuffle=false}={}){
  const d=DATA[i];if(!d?.tracks?.length)return;
  const pool=d.tracks.filter(x=>!isDisliked?.(x));const list=pool.length?pool:d.tracks;
  const t=shuffle?list[Math.floor(Math.random()*list.length)]:list[0];
  if(typeof mtSetAutoNext==='function'&&!autoNextEnabled)mtSetAutoNext(true);
  openTrack(t,true);
}
function mtSetAutoNext(v){
  autoNextEnabled=!!v;
  const b=$('autoNextToggle');if(b){b.classList.toggle('active',autoNextEnabled);b.setAttribute('aria-pressed',autoNextEnabled?'true':'false');b.textContent=autoNextEnabled?'AUTO NEXT':'AUTO NEXT OFF'}
  mtEmit('autonext',{on:autoNextEnabled});
}
function mtLastTrack(){
  try{const x=JSON.parse(localStorage.getItem('musicetown.r10.lastTrack')||'null');if(!x?.id)return null;const gi=DATA.findIndex(d=>d.t===x.theme);const t=gi>=0?DATA[gi].tracks.find(tr=>tr.shareId===x.id):null;return t?{track:t,index:gi}:null}catch(_){return null}
}

/* emit state changes from the existing core without changing its UI */
try{
  if(typeof showDetail==='function'&&!showDetail.__mtWrapped){const fn=showDetail;showDetail=function(i,...rest){const r=fn.call(this,i,...rest);queueMicrotask(()=>mtEmit('view',{view:'detail',index:Number(i),theme:DATA[Number(i)]?.t}));return r};showDetail.__mtWrapped=true}
  if(typeof backToStage==='function'&&!backToStage.__mtWrapped){const fn=backToStage;backToStage=function(...args){const r=fn.apply(this,args);queueMicrotask(()=>mtEmit('view',{view:'home'}));return r};backToStage.__mtWrapped=true}
  if(typeof setHomeGroup==='function'&&!setHomeGroup.__mtWrapped){const fn=setHomeGroup;setHomeGroup=function(key,...rest){const r=fn.call(this,key,...rest);queueMicrotask(()=>mtEmit('group',{key}));return r};setHomeGroup.__mtWrapped=true}
  if(typeof openTrack==='function'&&!openTrack.__mtWrapped){const fn=openTrack;openTrack=function(t,gesture=true,opts={}){const r=fn.call(this,t,gesture,opts);queueMicrotask(()=>mtEmit('track',{track:activeTrack||t,audio:activeAudio||null}));try{if(t?.shareId){localStorage.setItem('musicetown.r10.lastTrack',JSON.stringify({id:t.shareId,theme:DATA[mtThemeIndexOfTrack(t)]?.t||''}))}}catch(_){}return r};openTrack.__mtWrapped=true}
  if(typeof finishWelcome==='function'&&!finishWelcome.__mtWrapped){const fn=finishWelcome;finishWelcome=function(...args){const r=fn.apply(this,args);queueMicrotask(()=>mtEmit('welcome',{done:true}));return r};finishWelcome.__mtWrapped=true}
}catch(err){console.warn('[musicetown R10 bridge wrap]',err)}

/* Remove the old ONLINE SOURCE fallback from the visible player. If an MP3
   really is unavailable, mark it unavailable and skip once instead of showing
   a fake-looking extra song/source card. */
try{
  if(typeof mountOnlinePlaybackFallback==='function'&&!mountOnlinePlaybackFallback.__mtR10){
    const unavailable=new Set();
    const fallback=mountOnlinePlaybackFallback;
    mountOnlinePlaybackFallback=function(t){
      const id=t?.shareId||`${t?.title||''}|${t?.artist||''}`;
      unavailable.add(id);
      document.querySelectorAll('.online-fallback').forEach(n=>n.remove());
      const status=$('localMp3Status');if(status){status.className='local-mp3-status missing';status.innerHTML='<i></i><span>此曲音訊暫時不可用，已從播放序列略過</span>'}
      const deck=document.querySelector('.musicetown-deck');deck?.classList.add('audio-unavailable');
      if(unavailable.size<=3){
        const nxt=typeof nextTrackFrom==='function'?nextTrackFrom(t,1):null;
        if(nxt&&nxt!==t){setTimeout(()=>{try{window.__musicetownAutoplayNext=true;openTrack(nxt,true,{reveal:$('playerSheet')?.classList.contains('open')})}catch(_){}},120);return}
      }
      try{showClickToast?.('音訊部署尚未完成，請稍後再試')}catch(_){}
      /* no ONLINE SOURCE card */
    };
    mountOnlinePlaybackFallback.__mtR10=true;
  }
}catch(err){console.warn('[musicetown R10 fallback]',err)}

window.MT=Object.freeze({
  version:'R10.2',
  DATA,
  HOME_GROUPS:(typeof HOME_GROUPS!=='undefined'?HOME_GROUPS:{}),
  THEME_MACROS:(typeof THEME_MACROS!=='undefined'?THEME_MACROS:[
    {key:'music',label:'音樂風格',groups:['MUSIC_THEMES']},
    {key:'city',label:'城市',groups:['ASIA','EUROPE','NORTH_AMERICA','OCEANIA','MIDDLE_EAST','LIMITED_CITIES']},
    {key:'campus',label:'大學',groups:['UNIVERSITY_TW','UNIVERSITY_US','UNIVERSITY_UK','UNIVERSITY_ASIA']},
    {key:'spot',label:'景點',groups:['LANDMARK_TW_NORTH','LANDMARK_TW_JOURNEY','LANDMARK_ASIA','LANDMARK_JP_ME','LANDMARK_EUROPE','LANDMARK_WORLD']}
  ]),
  get view(){return state?.view||'stage'},
  get modalOpen(){return state?.modal!=null},
  get groupKey(){return typeof HOME_GROUP_KEY!=='undefined'?HOME_GROUP_KEY:'ASIA'},
  get homeOrder(){return typeof HOME_CITY_ORDER!=='undefined'?[...HOME_CITY_ORDER]:[]},
  get themeIndex(){return state?.view==='branch'?(window.__genreIndex??-1):-1},
  get audio(){return activeAudio||null},
  get track(){return activeTrack||null},
  get autoNext(){return !!autoNextEnabled},
  get welcomeActive(){return document.body.classList.contains('welcome-active')},
  splitThemeName:mtSplitThemeName,
  themeSlug:mtThemeSlug,
  genreUiFor:(name)=>typeof genreUiFor==='function'?genreUiFor(name):{accent:'#8f8bbb',soft:'rgba(143,139,187,.16)'},
  themeGroupKeyForName:mtThemeGroupKey,
  themeIndexBySlug:slug=>DATA.findIndex(d=>mtThemeSlug(d.t)===slug),
  showTheme:i=>typeof navigateToThemeIndex==='function'?navigateToThemeIndex(i):showDetail(i),
  home:()=>{try{typeof dismissWelcomeForNavigation==='function'?dismissWelcomeForNavigation():(document.body.classList.remove('welcome-active'),$('welcome')?.classList.add('is-out'))}catch(_){}if(state?.view==='branch')backToStage()},
  stageGroup:key=>typeof stageHomeGroup==='function'?stageHomeGroup(key):setHomeGroup?.(key),
  playTheme:mtPlayTheme,
  reroll:()=>renderBranchDrawer?.(window.__genreIndex||0),
  openTrack:(t,gesture=true)=>openTrack(t,gesture),
  closePlayer:()=>closeTrack?.(),
  expandPlayer:mtExpandPlayer,
  togglePlay:()=>{if(!activeAudio)return;if(activeAudio.paused)activeAudio.play().catch(()=>{});else activeAudio.pause()},
  jump:dir=>typeof jumpGlobal==='function'?jumpGlobal(dir):null,
  upNext:mtUpNext,
  themeIndexOfTrack:mtThemeIndexOfTrack,
  setAutoNext:mtSetAutoNext,
  isFavorite:t=>typeof isFavorite==='function'?isFavorite(t):false,
  toggleFavorite:t=>typeof toggleFavorite==='function'?toggleFavorite(t):null,
  isDisliked:t=>typeof isDisliked==='function'?isDisliked(t):false,
  toggleDislike:t=>typeof toggleDislike==='function'?toggleDislike(t):null,
  activeLibraryName:()=>typeof getActiveLibrary==='function'?(getActiveLibrary()?.name||'MY LIBRARY'):'MY LIBRARY',
  libraryCount:()=>typeof localLibraryTracks!=='undefined'?localLibraryTracks.length:0,
  passCount:()=>typeof readPassbook==='function'?readPassbook().length:0,
  lastTrack:mtLastTrack,
  openSearch:()=>openGlobalSearch?.(),closeSearch:()=>closeGlobalSearch?.(),
  openLibrary:()=>openLibrary?.(),closeLibrary:()=>closeLibrary?.(),
  openPassbook:()=>openPassbook?.(),closePassbook:()=>closePassbook?.(),
  openAudioOutput:()=>openAudioAccessoryEffect?.({auto:false}),
  shareTracks:(tracks,title)=>openShareComposer?.(tracks,title),
  shareTheme:i=>{const d=DATA[i];if(d)openShareComposer?.((typeof currentDrawerTracks!=='undefined'&&currentDrawerTracks.length?currentDrawerTracks:d.tracks.slice(0,12)),d.t)},
  toast:msg=>showClickToast?.(msg),
  icon:name=>typeof musicetownIcon==='function'?musicetownIcon(name):'',
  esc:typeof esc==='function'?esc:(s=>String(s??''))
});
mtEmit('ready',{});
mtEmit('view',state?.view==='branch'?{view:'detail',index:window.__genreIndex??-1,theme:DATA[window.__genreIndex??-1]?.t}:{view:'home'});
if(activeTrack)mtEmit('track',{track:activeTrack,audio:activeAudio||null});
'''

# Find the main app IIFE just before the library markup and inject the bridge
CORE_END_RE = re.compile(r'\n\}\)\(\);\s*</script>\s*(?=<div id="localLibrarySheet")')


def ensure_bridge(text: str, name: str) -> str:
    if 'window.MT=Object.freeze' in text:
        return text
    m = CORE_END_RE.search(text)
    if not m:
        raise RuntimeError(f"{name}: could not locate core closure for R10 bridge")
    replacement = CORE_BRIDGE + '\n\n})();\n</script>\n\n'
    return text[:m.start()] + replacement + text[m.end():]


def apply(path: Path) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    text = ensure_bridge(text, path.name)
    text = STYLE_RE.sub("\n", text)
    text = SCRIPT_RE.sub("\n", text)
    style = '<style id="r10-ux-layer">\n' + CSS + '\n</style>\n'
    script = '<script id="r10-ux-script">\n' + JS + '\n</script>\n'
    if "</head>" not in text or "</body>" not in text:
        raise RuntimeError(f"{path.name}: missing </head> or </body>")
    head_at = text.index("</head>")
    text = text[:head_at] + style + text[head_at:]
    body_at = text.rindex("</body>")
    text = text[:body_at] + script + text[body_at:]
    path.write_text(text, encoding="utf-8")
    print(f"{path.name}: R10.2 Flow & Glass shell applied")


if __name__ == "__main__":
    for name in ("index.html", "404.html"):
        apply(ROOT / name)