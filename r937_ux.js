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
  const observer=new MutationObserver(syncModalLock);
  modalIds.forEach(id=>{const el=byId(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class']})});
  syncModalLock();

  const cards=()=>[...document.querySelectorAll('#passbookCarousel .passbook-card')];
  const currentIndex=()=>{
    const box=byId('passbookCarousel'),list=cards();
    if(!box||!list.length)return 0;
    const center=box.scrollLeft+box.clientWidth/2;
    let best=0,dist=Infinity;
    list.forEach((card,i)=>{const d=Math.abs(card.offsetLeft+card.offsetWidth/2-center);if(d<dist){dist=d;best=i}});
    return best;
  };
  const updatePager=()=>{
    const list=cards(),i=currentIndex(),txt=byId('passbookProgressText');
    if(txt)txt.textContent=list.length?String(i+1)+' / '+String(list.length):'0 / 0';
    const prev=document.querySelector('[data-pass-prev]'),next=document.querySelector('[data-pass-next]');
    if(prev)prev.disabled=!list.length||i===0;
    if(next)next.disabled=!list.length||i===list.length-1;
  };
  const step=dir=>{
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
    bar.querySelector('[data-pass-prev]')?.addEventListener('click',()=>step(-1));
    bar.querySelector('[data-pass-next]')?.addEventListener('click',()=>step(1));
  };
  ensurePager();
  const carousel=byId('passbookCarousel');
  if(carousel){
    let timer=0;
    carousel.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(updatePager,60)},{passive:true});
    new MutationObserver(()=>requestAnimationFrame(updatePager)).observe(carousel,{childList:true});
  }
  byId('passbookOpen')?.addEventListener('click',()=>requestAnimationFrame(updatePager));
  updatePager();

  const transient=(el,cls)=>{
    if(!el)return;let timer=0;
    el.addEventListener('scroll',()=>{
      document.documentElement.classList.add(cls);
      clearTimeout(timer);timer=setTimeout(()=>document.documentElement.classList.remove(cls),120);
    },{passive:true});
  };
  transient(byId('themeGroupItems'),'mt-atlas-scrolling');
  transient(byId('passbookCarousel'),'mt-passbook-scrolling');

  /* ===== R9.3.9 DOM repair + local passbook ===== */
  const PASSBOOK_KEY='musicetown.passbook.local.v1';

  const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const readPasses=()=>{
    try{
      const value=JSON.parse(localStorage.getItem(PASSBOOK_KEY)||'[]');
      return Array.isArray(value)?value:[];
    }catch(_){return []}
  };
  const writePasses=list=>{
    try{localStorage.setItem(PASSBOOK_KEY,JSON.stringify(list.slice(0,120)))}catch(_){}
  };
  const passSnapshot=()=>{
    const theme=byId('cityPassThemeTitle')?.textContent?.trim();
    if(!theme)return null;
    const ticket=byId('cityPassTicketNo')?.textContent?.trim()||'';
    const code=byId('cityPassCityCode')?.textContent?.trim()||theme.slice(0,3).toUpperCase();
    const location=byId('cityPassDetectedCity')?.textContent?.trim()||'';
    const description=byId('cityPassDescription')?.textContent?.trim()||'';
    const program=byId('cityPassProgramType')?.textContent?.trim()||'MUSICTOWN LIMITED PASS';
    const status=byId('cityPassStatus')?.textContent?.trim()||'VERIFIED';
    return {
      id:ticket||[theme,location].join('|'),
      theme,code,location,description,program,status,ticket,
      savedAt:new Date().toISOString(),
      url:location.href
    };
  };

  const ensurePassbook=()=>{
    let sheet=byId('passbookSheet');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='passbookSheet';sheet.className='passbook-sheet';sheet.setAttribute('aria-hidden','true');
      sheet.innerHTML='<div class="passbook-backdrop" data-mt-passbook-close></div><section class="passbook-panel" role="dialog" aria-modal="true" aria-label="My ticket collection"><header class="passbook-head"><div><small>MUSICTOWN LOCAL</small><h2>MY PASSES</h2></div><button type="button" class="passbook-close" data-mt-passbook-close aria-label="Close">×</button></header><div class="passbook-carousel" id="passbookCarousel"></div></section>';
      document.body.appendChild(sheet);
      modalIds.push?.('passbookSheet');
    }
    let open=byId('passbookOpen');
    if(!open){
      open=document.createElement('button');
      open.id='passbookOpen';open.className='mt-passbook-open';open.type='button';
      open.innerHTML='<span>PASSES</span><i class="mt-pass-count">0</i>';
      document.body.appendChild(open);
    }else if(!open.querySelector('.mt-pass-count')){
      const badge=document.createElement('i');badge.className='mt-pass-count';badge.textContent='0';open.appendChild(badge);
    }
    const openSheet=()=>{sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');renderLocalPassbook();syncModalLock()};
    const closeSheet=()=>{sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true');syncModalLock()};
    if(!open.dataset.mtPassbookBound){open.dataset.mtPassbookBound='1';open.addEventListener('click',openSheet)}
    sheet.querySelectorAll('[data-mt-passbook-close]').forEach(el=>{
      if(el.dataset.mtPassbookBound)return;
      el.dataset.mtPassbookBound='1';el.addEventListener('click',closeSheet);
    });
    return sheet;
  };

  const passbookCardHTML=p=>`
    <article class="passbook-card mt-local-passbook-card" data-pass-id="${escapeHTML(p.id)}">
      <div class="mt-pass-kicker">${escapeHTML(p.program||'MUSICTOWN LIMITED PASS')}</div>
      <div class="mt-pass-code">${escapeHTML(p.code||'PASS')}</div>
      <h3 class="mt-pass-theme">${escapeHTML(p.theme)}</h3>
      <p class="mt-pass-description">${escapeHTML(p.description||'A location-limited musicetown collectible.')}</p>
      <div class="mt-pass-meta">
        <div><small>LOCATION</small><b>${escapeHTML(p.location||'—')}</b></div>
        <div><small>STATUS</small><b>${escapeHTML(p.status||'VERIFIED')}</b></div>
        <div><small>TICKET</small><b>${escapeHTML(p.ticket||'—')}</b></div>
        <div><small>SAVED</small><b>${escapeHTML((p.savedAt||'').slice(0,10)||'LOCAL')}</b></div>
      </div>
      <div class="mt-pass-actions">
        <button type="button" data-pass-save>PNG</button>
        <button type="button" data-pass-share>SHARE</button>
        <button type="button" class="mt-pass-delete" data-pass-delete aria-label="Delete">×</button>
      </div>
    </article>`;

  const updatePassCount=()=>{
    const badge=byId('passbookOpen')?.querySelector('.mt-pass-count');
    if(badge)badge.textContent=String(readPasses().length);
  };

  function renderLocalPassbook(){
    ensurePassbook();
    const box=byId('passbookCarousel');if(!box)return;
    box.querySelectorAll('.mt-local-passbook-card,.mt-passbook-empty').forEach(el=>el.remove());
    const list=readPasses();
    if(!list.length){
      const empty=document.createElement('div');empty.className='mt-passbook-empty';
      empty.innerHTML='<div><b>NO SAVED PASSES YET</b><br>到限定城市、校園或景點解鎖票根後，按 SAVE TICKET 收藏在這台裝置。</div>';
      box.appendChild(empty);
    }else{
      box.insertAdjacentHTML('beforeend',list.map(passbookCardHTML).join(''));
    }
    updatePassCount();requestAnimationFrame(updatePager);
  }

  const storeCurrentPass=()=>{
    const p=passSnapshot();if(!p)return;
    const list=readPasses();
    const idx=list.findIndex(x=>x.id===p.id||(x.theme===p.theme&&x.location===p.location));
    if(idx>=0)list.splice(idx,1);
    list.unshift(p);writePasses(list);renderLocalPassbook();
  };

  const makePassPng=p=>{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1520;
    const ctx=canvas.getContext('2d');
    const g=ctx.createLinearGradient(0,0,1080,1520);g.addColorStop(0,'#f8fbff');g.addColorStop(1,'#dfe8f1');
    ctx.fillStyle=g;ctx.fillRect(0,0,1080,1520);
    ctx.fillStyle='#29465d';
    ctx.font='700 34px system-ui';ctx.fillText('MUSICTOWN · LOCAL PASSBOOK',80,110);
    ctx.font='900 150px system-ui';ctx.fillText(String(p.code||'PASS').slice(0,9),80,300);
    ctx.font='800 44px system-ui';ctx.fillText(String(p.theme||'').slice(0,34),80,390);
    ctx.fillStyle='rgba(41,70,93,.68)';ctx.font='600 30px system-ui';
    const desc=String(p.description||'').slice(0,150);
    const words=desc.split(/\s+/);let line='',y=470;
    for(const word of words){
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width>900){ctx.fillText(line,80,y);line=word;y+=46}else line=test;
    }
    if(line)ctx.fillText(line,80,y);
    const rows=[['LOCATION',p.location],['STATUS',p.status],['TICKET',p.ticket],['SAVED',(p.savedAt||'').slice(0,10)]];
    let my=970;
    rows.forEach(([k,v])=>{ctx.fillStyle='rgba(41,70,93,.42)';ctx.font='800 22px system-ui';ctx.fillText(k,80,my);ctx.fillStyle='#29465d';ctx.font='750 34px system-ui';ctx.fillText(String(v||'—').slice(0,38),80,my+42);my+=125});
    ctx.fillStyle='rgba(41,70,93,.42)';ctx.font='700 22px system-ui';ctx.fillText('COLLECTED LOCALLY · PRECISE GPS IS NOT STORED',80,1430);
    canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='musicetown-'+String(p.code||'pass').toLowerCase()+'-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},'image/png');
  };

  const sharePass=async p=>{
    const text=['musicetown · '+p.theme,p.location?'LOCATION · '+p.location:'',p.ticket?'TICKET · '+p.ticket:''].filter(Boolean).join('\n');
    try{
      if(navigator.share){await navigator.share({title:'musicetown · '+p.theme,text,url:p.url||location.href});return}
    }catch(_){}
    try{await navigator.clipboard.writeText(text+'\n'+(p.url||location.href))}catch(_){}
  };

  document.addEventListener('click',e=>{
    if(e.target.closest('#cityPassSave'))setTimeout(storeCurrentPass,0);
    const card=e.target.closest('.mt-local-passbook-card');if(!card)return;
    const p=readPasses().find(x=>x.id===card.dataset.passId);if(!p)return;
    if(e.target.closest('[data-pass-save]'))makePassPng(p);
    if(e.target.closest('[data-pass-share]'))sharePass(p);
    if(e.target.closest('[data-pass-delete]')){
      writePasses(readPasses().filter(x=>x.id!==p.id));renderLocalPassbook();
    }
  });

  /* Move Audio Output close button inside its modal card. */
  const pinClose=()=>{
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
  };
  pinClose();
  new MutationObserver(pinClose).observe(document.body,{childList:true,subtree:true});
  window.visualViewport?.addEventListener('resize',pinClose,{passive:true});

  /* Larger vinyl scrub hit-zone. Capture disc drags and seek directly. */
  const installVinylAssist=()=>{
    document.querySelectorAll('.vinyl-wrap').forEach(wrap=>{
      if(wrap.dataset.mtVinylAssist)return;wrap.dataset.mtVinylAssist='1';
      let state=null;
      const disc=()=>wrap.querySelector('.vinyl,.vinyl-rotor,.record,.record-disc')||wrap;
      const audio=()=>document.querySelector('#playerBody audio,#playerSheet audio,.player-sheet audio,audio');
      const angle=(e,el)=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;return Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI};
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
        if(feedback){const diff=target-state.start;feedback.textContent=(diff>=0?'+':'−')+Math.abs(diff).toFixed(1)+'s';feedback.classList.add('show');clearTimeout(feedback.__hideTimer);feedback.__hideTimer=setTimeout(()=>feedback.classList.remove('show'),520)}
      },{passive:false});
      const end=e=>{
        if(!state||e.pointerId!==state.id)return;
        const wasPlaying=state.wasPlaying;state=null;wrap.classList.remove('mt-vinyl-dragging');
        const a=audio();if(wasPlaying&&a)a.play().catch(()=>{});
      };
      wrap.addEventListener('pointerup',end);wrap.addEventListener('pointercancel',end);
    });
  };
  installVinylAssist();
  new MutationObserver(()=>requestAnimationFrame(installVinylAssist)).observe(document.body,{childList:true,subtree:true});

  ensurePassbook();renderLocalPassbook();pinClose();
})();