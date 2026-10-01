(()=>{
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

  const pinClose=()=>{
    const close=byId('audioAccessoryClose');if(!close)return;
    close.style.setProperty('top','8px','important');
    close.style.setProperty('right','8px','important');
    close.style.setProperty('left','auto','important');
    close.style.setProperty('transform','none','important');
  };
  pinClose();
  window.visualViewport?.addEventListener('resize',pinClose,{passive:true});
})();