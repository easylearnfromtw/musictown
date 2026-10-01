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

  /* R9.3.11 vinyl scrub assist.
     Any horizontal drag across the record zone seeks predictably on iPhone.
     Capture-phase handling prevents the legacy circular handler from competing. */
  const installVinylAssist=()=>{
    document.querySelectorAll('.vinyl-wrap').forEach(wrap=>{
      if(wrap.dataset.mtVinylAssist==='r9311')return;
      wrap.dataset.mtVinylAssist='r9311';
      let state=null,raf=0,pending=null;
      const audio=()=>document.querySelector('#playerBody audio,#playerSheet audio,.player-sheet audio,audio');
      const fmt=v=>{
        const sign=v>=0?'+':'−',n=Math.abs(v);
        if(n<60)return sign+n.toFixed(n<10?1:0)+'s';
        const m=Math.floor(n/60),s=Math.round(n%60);
        return sign+m+':'+String(s).padStart(2,'0');
      };
      const paint=()=>{
        raf=0;
        if(!state||pending==null)return;
        const a=audio();if(!a)return;
        const target=pending;pending=null;
        try{a.currentTime=target}catch(_){}
        const deck=byId('deckSeek'),glass=byId('glassSeek');
        if(deck)deck.value=String(target);
        if(glass)glass.value=String(target);
        const cur=byId('deckCurrent');if(cur)cur.textContent=Math.floor(target/60)+':'+String(Math.floor(target%60)).padStart(2,'0');
        const diff=target-state.startTime;
        const feedback=byId('deckSeekFeedback');
        if(feedback){
          feedback.textContent=fmt(diff);feedback.classList.add('show');
          clearTimeout(feedback.__hideTimer);
          feedback.__hideTimer=setTimeout(()=>feedback.classList.remove('show'),500);
        }
        const rotor=wrap.querySelector('#vinylRotor,.vinyl-rotor,.vinyl,.record,.record-disc');
        if(rotor)rotor.style.setProperty('--record-angle',(target*24)+'deg');
      };
      const finish=e=>{
        if(!state||e.pointerId!==state.id)return;
        e.preventDefault();e.stopImmediatePropagation();
        if(raf){cancelAnimationFrame(raf);raf=0}paint();
        const resume=state.wasPlaying;state=null;pending=null;
        wrap.classList.remove('mt-vinyl-dragging');
        try{wrap.releasePointerCapture?.(e.pointerId)}catch(_){}
        const a=audio();if(resume&&a)a.play().catch(()=>{});
      };
      wrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(e.target.closest('button,input,a,.deck-info'))return;
        const a=audio();
        const duration=Number(a?.duration);
        if(!a||!Number.isFinite(duration)||duration<=0)return;
        e.preventDefault();e.stopImmediatePropagation();
        const rect=wrap.getBoundingClientRect();
        state={
          id:e.pointerId,
          startX:e.clientX,
          startTime:Number(a.currentTime)||0,
          duration,
          span:Math.max(180,rect.width*.82),
          sweep:Math.min(duration,180),
          wasPlaying:!a.paused
        };
        pending=state.startTime;
        if(state.wasPlaying)a.pause();
        wrap.classList.add('mt-vinyl-dragging');
        try{wrap.setPointerCapture?.(e.pointerId)}catch(_){}
      },true);
      wrap.addEventListener('pointermove',e=>{
        if(!state||e.pointerId!==state.id)return;
        e.preventDefault();e.stopImmediatePropagation();
        const dx=e.clientX-state.startX;
        pending=Math.max(0,Math.min(state.duration,state.startTime+(dx/state.span)*state.sweep));
        if(!raf)raf=requestAnimationFrame(paint);
      },true);
      wrap.addEventListener('pointerup',finish,true);
      wrap.addEventListener('pointercancel',finish,true);
    });
  };
  installVinylAssist();
  new MutationObserver(()=>requestAnimationFrame(installVinylAssist)).observe(document.body,{childList:true,subtree:true});

  /* Keep modal sizing in sync with iOS visual viewport. */
  const updateVisibleHeight=()=>{
    const h=window.visualViewport?.height||window.innerHeight;
    document.documentElement.style.setProperty('--musicetown-visible-height',Math.round(h)+'px');
  };
  updateVisibleHeight();
  window.visualViewport?.addEventListener('resize',updateVisibleHeight,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(updateVisibleHeight,120),{passive:true});
})();