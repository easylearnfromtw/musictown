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
      window.scrollTo({top:y,left:0,behavior:'instant'});
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

  /* Vinyl scrub assist.
     Captures the record plus a 52 px halo so one-finger scrubbing works reliably on iPhone. */
  const installVinylAssist=()=>{
    document.querySelectorAll('.vinyl-wrap').forEach(wrap=>{
      if(wrap.dataset.mtVinylAssist)return;
      wrap.dataset.mtVinylAssist='1';
      let state=null;
      const disc=()=>wrap.querySelector('.vinyl,.vinyl-rotor,.record,.record-disc')||wrap;
      const audio=()=>document.querySelector('#playerBody audio,#playerSheet audio,.player-sheet audio,audio');
      const angle=(e,el)=>{
        const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
        return Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI;
      };
      const norm=v=>{while(v>180)v-=360;while(v<-180)v+=360;return v};

      wrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(e.target.closest('button,input,a'))return;
        const a=audio();if(!a||!Number.isFinite(a.duration)||a.duration<=0)return;
        const d=disc(),r=d.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
        const radius=Math.hypot(e.clientX-cx,e.clientY-cy);
        if(radius>Math.max(r.width,r.height)/2+52)return;
        e.stopPropagation();e.preventDefault();
        state={id:e.pointerId,last:angle(e,d),start:a.currentTime||0,wasPlaying:!a.paused};
        if(state.wasPlaying)a.pause();
        wrap.classList.add('mt-vinyl-dragging');
        try{wrap.setPointerCapture(e.pointerId)}catch(_){}
      },true);

      wrap.addEventListener('pointermove',e=>{
        if(!state||e.pointerId!==state.id)return;
        const a=audio(),d=disc();if(!a)return;
        e.preventDefault();
        const next=angle(e,d),delta=norm(next-state.last);state.last=next;
        const target=Math.max(0,Math.min(a.duration,(a.currentTime||0)+(delta/360)*14));
        try{a.currentTime=target}catch(_){}
        const seek=byId('deckSeek');if(seek)seek.value=String(target);
        const feedback=byId('deckSeekFeedback');
        if(feedback){
          const diff=target-state.start;
          feedback.textContent=(diff>=0?'+':'−')+Math.abs(diff).toFixed(1)+'s';
          feedback.classList.add('show');
          clearTimeout(feedback.__hideTimer);
          feedback.__hideTimer=setTimeout(()=>feedback.classList.remove('show'),520);
        }
      },{passive:false});

      const end=e=>{
        if(!state||e.pointerId!==state.id)return;
        const wasPlaying=state.wasPlaying;state=null;
        wrap.classList.remove('mt-vinyl-dragging');
        const a=audio();if(wasPlaying&&a)a.play().catch(()=>{});
      };
      wrap.addEventListener('pointerup',end);
      wrap.addEventListener('pointercancel',end);
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