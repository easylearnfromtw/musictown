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

      /* GitHub project Pages must resolve verified local MP3s from the
         repository sub-path, even when the current URL is a 404/deep link or
         lacks a trailing slash. This keeps the first iPhone play attempt
         inside the original user-activation stack instead of failing once
         and retrying asynchronously. */
      const local=String(picked).match(/(?:^|\/)((?:jazz|crooner|rock|sport|lo-fi)\/\d{3}\.mp3)(?:[?#].*)?$/i);
      if(local&&location.hostname.endsWith('.github.io')){
        const pathParts=location.pathname.split('/').filter(Boolean);
        const project=(pathParts[0]&&pathParts[0].toLowerCase()!=='404.html')?pathParts[0]:'musictown';
        return new URL('/'+project+'/'+local[1],location.origin).href;
      }

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
        '<div class="live-lyrics-lines"><p class="live-lyric-line active">此曲來源目前沒有提供可驗證的實際歌詞；CITYMUSIC 不會用 AI 介紹文字冒充歌詞。</p></div>'+
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
  /* CITYMUSIC VINYL SCRUB EASY V3 · lighter thumb travel + Sakura platter. */
  /* CITYMUSIC CD SCRUB SFX · native Web Audio, synced to direction + drag speed.
     No remote dependency: the sound is synthesized locally so first drag stays responsive on iPhone. */
  const CD_SCRUB_MIN_MOVE=.004;
  let scrubCtx=null,scrubNoise=null,lastScrubBurst=0;
  const ensureScrubAudio=()=>{
    if(scrubCtx)return scrubCtx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    try{
      scrubCtx=new AC({latencyHint:'interactive'});
      const len=Math.max(256,Math.floor(scrubCtx.sampleRate*.055));
      scrubNoise=scrubCtx.createBuffer(1,len,scrubCtx.sampleRate);
      const ch=scrubNoise.getChannelData(0);
      for(let i=0;i<len;i++){
        const env=1-i/len;
        ch[i]=(Math.random()*2-1)*env;
      }
    }catch(_){scrubCtx=null;scrubNoise=null}
    return scrubCtx;
  };
  const playerAudibility=()=>{
    const a=byId('nativeAudioPlayer');
    if(a?.muted)return 0;
    const v=Number.isFinite(a?.volume)?a.volume:1;
    return Math.max(.12,Math.min(1,v));
  };
  const scrubBurst=(direction,speed)=>{
    const ctx=ensureScrubAudio();
    if(!ctx||!scrubNoise)return;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const now=ctx.currentTime;
    const wall=performance.now();
    const cadence=Math.max(20,52-Math.min(32,speed*3.2));
    if(wall-lastScrubBurst<cadence)return;
    lastScrubBurst=wall;

    const src=ctx.createBufferSource();
    const filter=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    const pan=ctx.createStereoPanner?.();

    src.buffer=scrubNoise;
    src.playbackRate.value=Math.max(.72,Math.min(1.62,.82+speed*.055));
    filter.type='bandpass';
    filter.Q.value=.75+Math.min(2.2,speed*.06);
    filter.frequency.value=direction>=0
      ? Math.min(4300,1850+speed*92)
      : Math.max(680,1420-speed*34);

    const level=(.010+Math.min(.040,speed*.0028))*playerAudibility();
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,level),now+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.045);

    if(pan){
      pan.pan.value=direction>=0?.16:-.16;
      src.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(ctx.destination);
    }else{
      src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    }
    src.start(now);
    src.stop(now+.052);
  };
  const bindVinylScrubSfx=()=>{
    document.querySelectorAll('.vinyl-wrap').forEach(wrap=>{
      if(wrap.dataset.mtScrubSfx==='1')return;
      wrap.dataset.mtScrubSfx='1';
      let state=null;
      const angleAt=e=>{
        const r=wrap.getBoundingClientRect();
        return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));
      };
      wrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(e.target.closest('button,input,a,.deck-info'))return;
        const ctx=ensureScrubAudio();
        if(ctx?.state==='suspended')ctx.resume().catch(()=>{});
        state={id:e.pointerId,a:angleAt(e),x:e.clientX,t:performance.now(),moved:false};
      },{capture:true,passive:true});
      wrap.addEventListener('pointermove',e=>{
        if(!state||e.pointerId!==state.id)return;
        const now=performance.now(),a=angleAt(e);
        let da=a-state.a;
        if(da>Math.PI)da-=Math.PI*2;
        else if(da<-Math.PI)da+=Math.PI*2;
        const dx=e.clientX-state.x,dt=Math.max(8,now-state.t);
        const meaningful=Math.abs(da)>=CD_SCRUB_MIN_MOVE||Math.abs(dx)>=.8;
        if(!meaningful)return;
        state.moved=true;
        const direction=Math.abs(da)>=CD_SCRUB_MIN_MOVE?Math.sign(da):Math.sign(dx);
        const angularSpeed=Math.abs(da)/dt*1000;
        const linearSpeed=Math.abs(dx)/dt*55;
        scrubBurst(direction||1,Math.min(18,angularSpeed*2.3+linearSpeed));
        state.a=a;state.x=e.clientX;state.t=now;
        wrap.classList.add('mt-cd-scrubbing');
        wrap.dataset.mtScrubDirection=direction>=0?'forward':'backward';
      },{capture:true,passive:true});
      const stop=e=>{
        if(!state)return;
        if(e?.pointerId!=null&&e.pointerId!==state.id)return;
        state=null;
        wrap.classList.remove('mt-cd-scrubbing');
        delete wrap.dataset.mtScrubDirection;
      };
      wrap.addEventListener('pointerup',stop,{capture:true,passive:true});
      wrap.addEventListener('pointercancel',stop,{capture:true,passive:true});
      wrap.addEventListener('lostpointercapture',stop,{capture:true,passive:true});
    });
  };
  bindVinylScrubSfx();
  new MutationObserver(()=>requestAnimationFrame(bindVinylScrubSfx)).observe(document.body,{childList:true,subtree:true});

  /* CITYMUSIC SAKURA PLATTER V1 · decorative outer ring, pointer-transparent. */
  const bindSakuraPlatter=()=>{
    document.querySelectorAll('#playerSheet .vinyl-wrap').forEach(wrap=>{
      if(wrap.querySelector(':scope > .mt-sakura-platter'))return;
      const ring=document.createElement('div');
      ring.className='mt-sakura-platter';
      ring.setAttribute('aria-hidden','true');
      ring.innerHTML=Array.from({length:10},(_,i)=>'<i style="--i:'+i+'"><span>✿</span></i>').join('');
      wrap.prepend(ring);
    });
  };
  bindSakuraPlatter();
  new MutationObserver(()=>requestAnimationFrame(bindSakuraPlatter)).observe(document.body,{childList:true,subtree:true});


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
  /* R10.2.1 · mobile glass state + iPhone audio rescue */
  const body=document.body;
  const root=document.documentElement;
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const $=id=>document.getElementById(id);

  let playerIO=null;
  let lastWindowY=window.scrollY||0;
  let lastCardY=0;

  const setCompact=on=>{
    if(!mobile())on=false;
    body.classList.toggle('mt-glass-compact',!!on);
  };

  const syncPlayerObserver=()=>{
    const sheet=$('playerSheet');
    const card=sheet?.querySelector('.player-card');
    const open=!!sheet?.classList.contains('open');
    body.classList.toggle('mt-player-open',open);
    if(playerIO){playerIO.disconnect();playerIO=null}
    body.classList.remove('mt-player-controls-in-view');
    if(!open||!card){lastCardY=0;return}

    const controls=card.querySelector('.local-player-controls')||
                   card.querySelector('.deck-seek-wrap')||
                   card.querySelector('.vinyl-wrap');
    if(!controls)return;

    playerIO=new IntersectionObserver(entries=>{
      const e=entries[0];
      const visible=!!e?.isIntersecting && e.intersectionRatio>.12;
      body.classList.toggle('mt-player-controls-in-view',visible);
      if(visible)setCompact(false);
      else if(card.scrollTop>120)setCompact(true);
    },{root:card,threshold:[0,.12,.35,.65]});
    playerIO.observe(controls);
    lastCardY=card.scrollTop||0;
  };

  const onCardScroll=e=>{
    const card=e.currentTarget;
    const y=card.scrollTop||0,dy=y-lastCardY;
    if(y<70)setCompact(false);
    if(Math.abs(dy)>8){
      if(dy>0&&y>135&&!body.classList.contains('mt-player-controls-in-view'))setCompact(true);
      else if(dy<0)setCompact(false);
      lastCardY=y;
    }
  };

  const bindPlayerCard=()=>{
    const card=document.querySelector('#playerSheet .player-card');
    if(!card||card.dataset.mtGlassScroll==='1')return;
    card.dataset.mtGlassScroll='1';
    card.addEventListener('scroll',onCardScroll,{passive:true});
  };

  const syncAll=()=>{bindPlayerCard();syncPlayerObserver()};
  const sheet=$('playerSheet');
  if(sheet)new MutationObserver(()=>requestAnimationFrame(syncAll)).observe(sheet,{attributes:true,attributeFilter:['class']});
  const bodyHost=$('playerBody');
  if(bodyHost)new MutationObserver(()=>requestAnimationFrame(syncAll)).observe(bodyHost,{childList:true,subtree:true});
  window.addEventListener('resize',()=>{if(!mobile())setCompact(false);requestAnimationFrame(syncAll)},{passive:true});
  document.addEventListener('DOMContentLoaded',syncAll);
  requestAnimationFrame(syncAll);

  window.addEventListener('scroll',()=>{
    if(!mobile()||body.classList.contains('mt-player-open'))return;
    const y=window.scrollY||0,dy=y-lastWindowY;
    if(y<70)setCompact(false);
    if(Math.abs(dy)>8){
      if(dy>0&&y>150&&$('glassTransport')?.classList.contains('show'))setCompact(true);
      else if(dy<0)setCompact(false);
      lastWindowY=y;
    }
  },{passive:true});

  /* ---------- iPhone / GitHub Pages audio rescue ---------- */
  const mtAudioSession='r1022-'+Date.now().toString(36);
  const withAudioBust=url=>{
    try{
      const u=new URL(url,document.baseURI);
      u.searchParams.set('mtAudio',mtAudioSession);
      return u.href;
    }catch(_){return url}
  };
  const audioCandidates=a=>{
    const raw=[
      a?.querySelector('source')?.getAttribute('src'),
      a?.getAttribute('src'),
      a?.currentSrc,
      a?.src
    ].filter(Boolean);
    const out=[];
    const add=u=>{if(u&&!out.includes(u))out.push(u)};
    for(const src0 of raw){
      const src=String(src0).trim();
      try{
        const abs=new URL(src,document.baseURI).href;
        /* Failed media requests can stay sticky in iOS Safari. Retry the
           same verified MP3 with a session URL before falling back. */
        add(withAudioBust(abs));
        add(abs);
      }catch(_){}
      try{
        const u=new URL(src,location.href);
        const m=u.pathname.match(/\/((?:jazz|crooner|rock|sport|lo-fi)\/\d{3}\.mp3)$/i);
        if(m){
          const rel=m[1];
          if(location.hostname.endsWith('.github.io')){
            const first=location.pathname.split('/').filter(Boolean)[0]||'musictown';
            const projectUrl=new URL('/'+first+'/'+rel,location.origin).href;
            add(withAudioBust(projectUrl));
            add(projectUrl);
          }
          const rootUrl=new URL('/'+rel,location.origin).href;
          add(withAudioBust(rootUrl));
          add(rootUrl);
        }
      }catch(_){}
    }
    return out;
  };

  const nextAudioSource=(a,{play=true}={})=>{
    if(!a)return false;
    const list=audioCandidates(a);
    if(!list.length)return false;
    let i=Number(a.dataset.mtAudioCandidate||'-1');
    i=Number.isFinite(i)?i+1:0;
    if(i>=list.length)i=0;
    const src=list[i];
    if(!src)return false;
    a.dataset.mtAudioCandidate=String(i);
    a.setAttribute('playsinline','');
    try{
      if(a.src!==src)a.src=src;
      a.preload='auto';
      a.load();
      if(play)a.play().catch(()=>{});
      return true;
    }catch(_){return false}
  };

  const bindAudioRescue=a=>{
    if(!a||a.dataset.mtAudioRescue==='1')return;
    a.dataset.mtAudioRescue='1';
    a.setAttribute('playsinline','');
    a.addEventListener('loadedmetadata',()=>{a.dataset.mtAudioCandidate='0'},{passive:true});
    a.addEventListener('error',()=>{
      const tries=Number(a.dataset.mtAudioErrors||'0')+1;
      a.dataset.mtAudioErrors=String(tries);
      if(tries<=3)nextAudioSource(a,{play:true});
    });
    a.addEventListener('stalled',()=>{
      if(a.readyState<1&&Number(a.dataset.mtAudioErrors||'0')<2)nextAudioSource(a,{play:!a.paused});
    });
  };

  const scanAudio=()=>{
    const a=$('nativeAudioPlayer');
    if(a)bindAudioRescue(a);
  };
  if(bodyHost)new MutationObserver(()=>requestAnimationFrame(scanAudio)).observe(bodyHost,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scanAudio);
  requestAnimationFrame(scanAudio);

  /* Capture only the broken/no-metadata case so the core handler remains the
     source of truth during normal playback. */
  document.addEventListener('click',e=>{
    const ctl=e.target.closest?.('#localPlay,#vinylDisc,#glassPlay');
    if(!ctl)return;
    const a=$('nativeAudioPlayer');
    if(!a)return;
    bindAudioRescue(a);
    if(a.readyState<1 || a.error || a.networkState===HTMLMediaElement.NETWORK_NO_SOURCE){
      e.preventDefault();
      e.stopImmediatePropagation();
      nextAudioSource(a,{play:true});
    }
  },true);
})();



;(()=>{
  'use strict';
  /* R10.2.3 · canonical mobile player state
     Full player first. Compact liquid-glass transport appears only after the
     user has scrolled the full player far enough that its own controls are no
     longer visible. */
  const body=document.body;
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const byId=id=>document.getElementById(id);
  let boundCard=null;
  let raf=0;

  const sync=()=>{
    raf=0;
    const sheet=byId('playerSheet');
    const card=sheet?.querySelector('.player-card');
    const open=!!sheet?.classList.contains('open');
    body.classList.toggle('mt-player-open',open);

    if(!mobile()||!open||!card){
      body.classList.remove('mt-glass-compact','mt-player-controls-in-view');
      return;
    }

    const controls=card.querySelector('.local-player-controls')||
                   card.querySelector('.deck-seek-wrap')||
                   card.querySelector('.vinyl-wrap');
    const y=card.scrollTop||0;
    let controlsVisible=true;

    if(controls){
      const cr=controls.getBoundingClientRect();
      const rr=card.getBoundingClientRect();
      controlsVisible=cr.bottom>rr.top+24 && cr.top<rr.bottom-24;
    }

    body.classList.toggle('mt-player-controls-in-view',controlsVisible);

    /* Stable state by position, not by scroll direction:
       - near the top / controls visible: no floating dock
       - controls scrolled away: compact dock */
    const compact=!controlsVisible && y>130;
    body.classList.toggle('mt-glass-compact',compact);
  };

  const queue=()=>{
    if(raf)return;
    raf=requestAnimationFrame(sync);
  };

  const bind=()=>{
    const card=document.querySelector('#playerSheet .player-card');
    if(card&&card!==boundCard){
      boundCard=card;
      card.addEventListener('scroll',queue,{passive:true});
    }
    queue();
  };

  const sheet=byId('playerSheet');
  if(sheet)new MutationObserver(bind).observe(sheet,{attributes:true,attributeFilter:['class']});
  const host=byId('playerBody');
  if(host)new MutationObserver(bind).observe(host,{childList:true,subtree:true});
  window.visualViewport?.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queue,120),{passive:true});
  document.addEventListener('DOMContentLoaded',bind);
  bind();
})();


;(()=>{
  'use strict';
  /* ================= CITYMUSIC APPLE UX V1 ================= */
  const root=document.documentElement;
  const ua=navigator.userAgent||'';
  const appleTouch=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  root.classList.toggle('mt-apple-touch',appleTouch);
  root.classList.toggle('mt-standalone',standalone());

  const syncAppleViewport=()=>{
    const vv=window.visualViewport;
    const w=Math.max(1,Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||1));
    const h=Math.max(1,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||1));
    root.style.setProperty('--mt-vvw',w+'px');
    root.style.setProperty('--mt-vvh',h+'px');
    root.style.setProperty('--mt-vv-top',Math.round(vv?.offsetTop||0)+'px');
    root.style.setProperty('--mt-vv-left',Math.round(vv?.offsetLeft||0)+'px');
  };
  syncAppleViewport();
  window.visualViewport?.addEventListener('resize',syncAppleViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',syncAppleViewport,{passive:true});
  window.addEventListener('resize',syncAppleViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncAppleViewport,80),{passive:true});
  window.addEventListener('pageshow',syncAppleViewport,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){root.classList.toggle('mt-standalone',standalone());setTimeout(syncAppleViewport,40)}});

  const hydrateInlineMedia=()=>{
    document.querySelectorAll('audio,video').forEach(m=>{
      m.setAttribute('playsinline','');
      m.setAttribute('webkit-playsinline','');
      if(m.tagName==='AUDIO')m.setAttribute('x-webkit-airplay','allow');
    });
  };
  hydrateInlineMedia();
  new MutationObserver(()=>requestAnimationFrame(hydrateInlineMedia)).observe(document.body,{childList:true,subtree:true});

  const keyboardField=el=>el?.matches?.('input,textarea,[contenteditable="true"]');
  document.addEventListener('focusin',e=>{
    if(!appleTouch||!keyboardField(e.target))return;
    root.classList.add('mt-ios-keyboard');
    requestAnimationFrame(syncAppleViewport);
  },true);
  document.addEventListener('focusout',e=>{
    if(!appleTouch||!keyboardField(e.target))return;
    setTimeout(()=>{root.classList.remove('mt-ios-keyboard');syncAppleViewport()},180);
  },true);

  if(appleTouch){
    document.addEventListener('touchstart',e=>{
      const c=e.target.closest?.('button,a,[role="button"]');
      if(c)c.classList.add('mt-ios-touching');
    },{passive:true});
    const clearIosTouch=()=>document.querySelectorAll('.mt-ios-touching').forEach(n=>n.classList.remove('mt-ios-touching'));
    document.addEventListener('touchend',clearIosTouch,{passive:true});
    document.addEventListener('touchcancel',clearIosTouch,{passive:true});
  }

  const displayMode=matchMedia('(display-mode: standalone)');
  displayMode.addEventListener?.('change',()=>root.classList.toggle('mt-standalone',standalone()));
  /* ================= /CITYMUSIC APPLE UX V1 ================= */
})();
