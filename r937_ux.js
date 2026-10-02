(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const modalIds=['passbookSheet','audioAccessorySheet','localLibrarySheet','globalSearchSheet','cityPassSheet'];
  let locked=false,lockY=0;

  const syncModalLock=()=>{
    const open=modalIds.some(id=>byId(id)?.classList.contains('open'));
    if(open&&!locked){
      locked=true;lockY=window.scrollY||0;
      document.body.dataset.mtLockY=String(lockY);
      Object.assign(document.body.style,{position:'fixed',top:(-lockY)+'px',left:'0',right:'0',width:'100%'});
    }else if(!open&&locked){
      locked=false;
      const y=Number(document.body.dataset.mtLockY||lockY)||0;
      ['position','top','left','right','width'].forEach(k=>document.body.style[k]='');
      delete document.body.dataset.mtLockY;
      window.scrollTo(0,y);
    }
  };

  const modalObserver=new MutationObserver(syncModalLock);
  modalIds.forEach(id=>{const el=byId(id);if(el)modalObserver.observe(el,{attributes:true,attributeFilter:['class']})});
  syncModalLock();

  /* Native Passbook enhancer. Base app owns localStorage + save/share/remove. */
  const cards=()=>[...document.querySelectorAll('#passbookCarousel .passbook-card')];
  const currentIndex=()=>{
    const box=byId('passbookCarousel'),list=cards();
    if(!box||!list.length)return 0;
    const center=box.scrollLeft+box.clientWidth/2;
    let best=0,dist=Infinity;
    list.forEach((card,i)=>{
      const d=Math.abs(card.offsetLeft+card.offsetWidth/2-center);
      if(d<dist){dist=d;best=i}
    });
    return best;
  };
  const updatePager=()=>{
    const list=cards(),i=currentIndex(),txt=byId('passbookProgressText');
    if(txt)txt.textContent=list.length?String(i+1)+' / '+String(list.length):'0 / 0';
    const prev=document.querySelector('[data-pass-prev]'),next=document.querySelector('[data-pass-next]');
    if(prev)prev.disabled=!list.length||i===0;
    if(next)next.disabled=!list.length||i===list.length-1;
  };
  const stepPassbook=dir=>{
    const list=cards(),i=currentIndex();
    const target=list[Math.max(0,Math.min(list.length-1,i+dir))];
    if(target)target.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  };
  const ensurePager=()=>{
    const panel=document.querySelector('#passbookSheet .passbook-panel');
    if(!panel||byId('passbookProgress'))return;
    const bar=document.createElement('div');
    bar.id='passbookProgress';bar.className='passbook-progress';
    bar.innerHTML='<button type="button" data-pass-prev aria-label="Previous pass">&#8249;</button><b id="passbookProgressText">0 / 0</b><button type="button" data-pass-next aria-label="Next pass">&#8250;</button>';
    panel.appendChild(bar);
    bar.querySelector('[data-pass-prev]')?.addEventListener('click',()=>stepPassbook(-1));
    bar.querySelector('[data-pass-next]')?.addEventListener('click',()=>stepPassbook(1));
  };
  ensurePager();
  const passPanel=document.querySelector('#passbookSheet .passbook-panel');
  if(passPanel&&!byId('passbookLocalNote')){
    const note=document.createElement('div');
    note.id='passbookLocalNote';note.className='passbook-local-note';
    note.innerHTML='<b>LOCAL PASSBOOK</b><span>THIS DEVICE · SWIPE · SAVE · SHARE</span>';
    const carousel=byId('passbookCarousel');
    if(carousel)passPanel.insertBefore(note,carousel);else passPanel.appendChild(note);
  }
  const carousel=byId('passbookCarousel');
  if(carousel){
    let timer=0;
    carousel.addEventListener('scroll',()=>{
      document.documentElement.classList.add('mt-passbook-scrolling');
      clearTimeout(timer);
      timer=setTimeout(()=>{document.documentElement.classList.remove('mt-passbook-scrolling');updatePager()},90);
    },{passive:true});
    new MutationObserver(()=>requestAnimationFrame(updatePager)).observe(carousel,{childList:true});
  }
  byId('passbookOpen')?.addEventListener('click',()=>requestAnimationFrame(updatePager));
  updatePager();

  /* Lightweight scrolling state for the multi-row theme atlas. */
  const atlas=byId('themeGroupItems');
  const trackList=byId('trackList');
  if(trackList){
    let trackTimer=0;
    trackList.addEventListener('scroll',()=>{
      document.documentElement.classList.add('mt-track-scrolling');
      clearTimeout(trackTimer);trackTimer=setTimeout(()=>document.documentElement.classList.remove('mt-track-scrolling'),100);
    },{passive:true});
  }
  if(atlas){
    let timer=0;
    atlas.addEventListener('scroll',()=>{
      document.documentElement.classList.add('mt-atlas-scrolling');
      clearTimeout(timer);timer=setTimeout(()=>document.documentElement.classList.remove('mt-atlas-scrolling'),110);
    },{passive:true});
  }

  /* Audio Output repair: move the close button into the modal card itself. */
  const pinAudioClose=()=>{
    const close=byId('audioAccessoryClose');
    const card=document.querySelector('#audioAccessorySheet .audio-accessory-card');
    if(!close||!card)return;
    if(close.parentElement!==card)card.prepend(close);
    close.style.setProperty('position','absolute','important');
    close.style.setProperty('top','10px','important');
    close.style.setProperty('right','10px','important');
    close.style.setProperty('left','auto','important');
    close.style.setProperty('bottom','auto','important');
    close.style.setProperty('transform','none','important');
    close.style.setProperty('translate','none','important');
  };
  pinAudioClose();
  const audioObserver=new MutationObserver(pinAudioClose);
  audioObserver.observe(document.body,{childList:true,subtree:true});
  window.visualViewport?.addEventListener('resize',pinAudioClose,{passive:true});
  /* R9.3.14: secondary vinyl scrub handler removed. Core wireVinylTransport is the single source of truth. */
/* Keep modal sizing in sync with iOS visual viewport. */
  const updateVisibleHeight=()=>{
    const h=window.visualViewport?.height||window.innerHeight;
    document.documentElement.style.setProperty('--musicetown-visible-height',Math.round(h)+'px');
  };
  updateVisibleHeight();
  window.visualViewport?.addEventListener('resize',updateVisibleHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(updateVisibleHeight,120),{passive:true});
})();

;(()=>{
  'use strict';
  /* R9.3.13 compact transport / real-lyrics / vinyl page lock */

  const byId=id=>document.getElementById(id);

  /* Keep the compact transport alive whenever a track exists.
     Legacy fallback is allowed to change the player body, but not erase the dock state. */
  if(typeof window.dismissGlassTransport==='function'){
    window.dismissGlassTransport=function(){
      const dock=byId('glassTransport');
      const track=window.activeTrack || (typeof activeTrack!=='undefined'?activeTrack:null);
      if(track){
        dock?.classList.add('show');
        try{typeof updateGlassUI==='function'&&updateGlassUI()}catch(_){}
        return;
      }
      dock?.classList.remove('show');
    };
  }

  /* Prefer real playable media over known webpage URLs from stale catalogs. */
  if(typeof window.resolveSiteCloudAudio==='function'){
    const originalResolve=window.resolveSiteCloudAudio;
    window.resolveSiteCloudAudio=function(t){
      const raw=String(t?.audioSrc||'').trim();
      const badWebPage=/freemusicarchive\.org\/music\/charts|\/search(?:\?|$)/i.test(raw);
      const candidates=[
        !badWebPage&&raw,
        String(t?.download||'').trim(),
        String(t?.originalLocalAudio||'').trim(),
        String(t?.originalAudioSrc||'').trim()
      ].filter(Boolean);
      const picked=candidates[0]||raw;
      try{return new URL(picked,document.baseURI).href}catch(_){return originalResolve(t)}
    };
  }

  /* Actual lyrics only. Never fabricate track-specific lyrics. */
  function parseVerifiedLyrics(track){
    const raw=track?.syncedLyrics ?? track?.lrc ?? track?.lyrics ?? track?.lyric ?? null;
    if(!raw)return {lines:[],synced:false};

    if(Array.isArray(raw)){
      const lines=raw.map((x,i)=>{
        if(typeof x==='string')return {text:x,time:null,index:i};
        return {text:String(x?.text||x?.line||''),time:Number.isFinite(Number(x?.time))?Number(x.time):null,index:i};
      }).filter(x=>x.text.trim());
      return {lines,synced:lines.some(x=>x.time!=null)};
    }

    const src=String(raw).replace(/\r/g,'').trim();
    if(!src)return {lines:[],synced:false};
    const out=[];
    for(const line of src.split('\n')){
      const m=line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
      if(m){
        const frac=Number('0.'+(m[3]||'0'));
        out.push({time:Number(m[1])*60+Number(m[2])+frac,text:m[4].trim()});
      }else if(line.trim()){
        out.push({time:null,text:line.trim()});
      }
    }
    return {lines:out.filter(x=>x.text),synced:out.some(x=>x.time!=null)};
  }

  window.buildLiveLyricsUI=function(track){
    const parsed=parseVerifiedLyrics(track);
    if(!parsed.lines.length){
      return '<section class="live-lyrics live-lyrics-empty" aria-label="歌詞">'+
        '<div class="live-lyrics-head"><b>LYRICS</b><span>NOT PROVIDED BY SOURCE</span></div>'+
        '<div class="live-lyrics-lines"><p class="live-lyric-line active">此曲來源目前沒有提供可驗證的實際歌詞；musicetown 不會用 AI 介紹文字冒充歌詞。</p></div>'+
      '</section>';
    }
    return '<section class="live-lyrics" aria-label="歌詞">'+
      '<div class="live-lyrics-head"><b>LYRICS</b><span>'+(track?.lyricsSource==='audio-transcription'?'AUDIO TRANSCRIPTION':parsed.synced?'SOURCE-SYNCED':'SOURCE LYRICS')+'</span></div>'+
      '<div class="live-lyrics-lines" id="liveLyricsLines">'+
      parsed.lines.map((x,i)=>'<p class="live-lyric-line'+(i===0?' active':'')+'" data-li="'+i+'"'+(x.time!=null?' data-time="'+x.time+'"':'')+'>'+String(x.text).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))+'</p>').join('')+
      '</div></section>';
  };

  window.wireLiveLyrics=function(audio,track){
    const box=byId('liveLyricsLines');
    if(!audio||!box)return;
    const lines=[...box.querySelectorAll('.live-lyric-line')];
    const timed=lines.map((el,i)=>({el,i,time:Number(el.dataset.time)})).filter(x=>Number.isFinite(x.time));
    if(!timed.length)return;
    let last=-1;
    const sync=()=>{
      const cur=Number(audio.currentTime)||0;
      let idx=0;
      for(let i=0;i<timed.length;i++){
        if(timed[i].time<=cur)idx=i;else break;
      }
      if(idx===last)return;
      last=idx;
      lines.forEach((el,i)=>{
        el.classList.toggle('active',i===timed[idx].i);
        el.classList.toggle('past',i<timed[idx].i);
      });
      timed[idx].el.scrollIntoView?.({block:'center',behavior:'smooth'});
    };
    ['timeupdate','seeked','loadedmetadata'].forEach(ev=>audio.addEventListener(ev,sync));
    sync();
  };

  /* iPhone: while the user is actually scrubbing the vinyl, freeze surrounding page gestures only for that drag. */
  let vinylGestureDepth=0;
  const lockVinylPage=()=>{
    vinylGestureDepth++;
    document.documentElement.classList.add('mt-vinyl-page-lock');
  };
  const unlockVinylPage=()=>{
    vinylGestureDepth=Math.max(0,vinylGestureDepth-1);
    if(!vinylGestureDepth)document.documentElement.classList.remove('mt-vinyl-page-lock');
  };
  const preventTouchMove=e=>{
    if(document.documentElement.classList.contains('mt-vinyl-page-lock')&&e.cancelable)e.preventDefault();
  };
  document.addEventListener('touchmove',preventTouchMove,{passive:false,capture:true});

  const bindVinylLocks=()=>{
    document.querySelectorAll('.vinyl-wrap').forEach(wrap=>{
      if(wrap.dataset.mtPageLock==='1')return;
      wrap.dataset.mtPageLock='1';
      let activeId=null;
      wrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(e.target.closest('button,input,a,.deck-info'))return;
        activeId=e.pointerId;
        lockVinylPage();
      },{capture:true,passive:true});
      const done=e=>{
        if(activeId==null)return;
        if(e?.pointerId!=null&&e.pointerId!==activeId)return;
        activeId=null;
        unlockVinylPage();
      };
      wrap.addEventListener('pointerup',done,{capture:true,passive:true});
      wrap.addEventListener('pointercancel',done,{capture:true,passive:true});
      wrap.addEventListener('lostpointercapture',done,{capture:true,passive:true});
    });
  };
  bindVinylLocks();
  new MutationObserver(()=>requestAnimationFrame(bindVinylLocks)).observe(document.body,{childList:true,subtree:true});

  /* When a player opens, assign src directly as well as <source>; iOS Safari is more reliable this way. */
  const hydrateAudioSrc=()=>{
    const a=byId('nativeAudioPlayer');
    if(!a||a.dataset.mtHydrated==='1')return;
    const source=a.querySelector('source');
    const src=source?.getAttribute('src')||a.getAttribute('src');
    if(!src)return;
    a.dataset.mtHydrated='1';
    try{
      a.src=src;
      a.preload='auto';
      a.load();
    }catch(_){}
  };
  new MutationObserver(()=>requestAnimationFrame(hydrateAudioSrc)).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',hydrateAudioSrc);
})();

;(()=>{
  'use strict';
  /* R9.3.16 mobile compact-player state
     Full player owns the top state. The glass dock appears only after the
     user has meaningfully scrolled down inside the player, with hysteresis
     so it does not flicker near the threshold. */
  const byId=id=>document.getElementById(id);
  const sheet=byId('playerSheet');
  const card=sheet?.querySelector('.player-card');
  const body=document.body;
  if(!sheet||!card||!body)return;

  let compact=false,raf=0;
  const hasTrack=()=>{
    try{
      if(typeof activeTrack!=='undefined'&&activeTrack)return true;
      return !!window.activeTrack;
    }catch(_){return !!window.activeTrack}
  };
  const sync=()=>{
    raf=0;
    const open=sheet.classList.contains('open');
    const y=Math.max(0,card.scrollTop||0);

    if(!open){
      compact=hasTrack();
      body.classList.remove('mt-player-top-zone');
      body.classList.toggle('mt-player-compact-ready',compact);
      if(compact)byId('glassTransport')?.classList.add('show');
      return;
    }

    // Hysteresis: down past 180px enters mini-player; back near top exits.
    if(!compact && y>=180)compact=true;
    else if(compact && y<=72)compact=false;

    // Opening a new player always begins in the full-player state.
    if(!hasTrack())compact=false;

    body.classList.toggle('mt-player-top-zone',!compact);
    body.classList.toggle('mt-player-compact-ready',compact);
    if(compact)byId('glassTransport')?.classList.add('show');
  };
  const queue=()=>{
    if(raf)return;
    raf=requestAnimationFrame(sync);
  };

  card.addEventListener('scroll',queue,{passive:true});
  window.visualViewport?.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queue,100),{passive:true});

  new MutationObserver(()=>{
    if(sheet.classList.contains('open') && card.scrollTop<=72)compact=false;
    queue();
  }).observe(sheet,{attributes:true,attributeFilter:['class']});

  const playerBody=byId('playerBody');
  if(playerBody)new MutationObserver(queue).observe(playerBody,{childList:true,subtree:true});

  queue();
})();

