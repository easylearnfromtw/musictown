/* ==========================================================================
   CITYMUS iOS Companion bridge · no-op in Safari/PWA
   ========================================================================== */
const IOSCompanionBridge = (() => {
  const nativeHandler = () => window.webkit?.messageHandlers?.citymus;
  const available = () => !!nativeHandler();
  const post = payload => { if (!available()) return false; try { nativeHandler().postMessage(payload); return true; } catch (_) { return false; } };
  const cleanTrack = t => {
    if (!t) return null;
    const th = themeOf(t);
    return { shareId:t.shareId||'', title:t.title||'CITYMUS', artist:t.artist||t.composerCn||'',
      theme:th?.cn||th?.name||Player.context?.title||'CITYMUS', themeSlug:th?.slug||'' };
  };
  const playbackPayload = () => {
    const t=Player.current; if(!t) return null; const tm=Player.time;
    return {type:'playback',...cleanTrack(t),isPlaying:!!Player.playing,position:Number(tm.cur||0),duration:Number(tm.dur||0)};
  };

  let artSeq=0;
  async function publishPlayback(withArtwork=false){
    const t=Player.current,p=playbackPayload(); if(!t||!p)return; post(p);
    if(!withArtwork)return; const seq=++artSeq;
    try{const src=await Artwork.cover(t,1024);if(seq===artSeq&&Player.current===t&&src)post({type:'artwork',shareId:t.shareId||'',dataURL:src});}catch(_){}
  }
  async function publishRecommendations(){
    const picks=Reco.todaysEdit(3).filter(Boolean);
    post({type:'recommendations',items:picks.map(cleanTrack)});
    picks.forEach(async t=>{try{const src=await Artwork.cover(t,144);if(src)post({type:'recommendationArtwork',shareId:t.shareId||'',dataURL:src});}catch(_){}});
  }
  function publishCity(){
    const th=Geo.theme?THEME_BY_T.get(Geo.theme):null;
    post({type:'city',name:th?.city||Geo.city||'Taipei',displayName:th?.cityCn||th?.cn||Geo.city||'台北',themeSlug:th?.slug||'taipei-dream'});
  }
  function publishAll(){
    if(!available())return false;
    post({type:'ready',build:MT_BUILD});
    if(Player.current)publishPlayback(true);
    publishRecommendations();publishCity();return true;
  }
  function perform(command={}){
    const a=String(command.action||'').toLowerCase();
    if(a==='player'){if(Player.current)PlayerUI.show();return true;}
    if(a==='playpause'){Player.toggle();return true;}
    if(a==='next'){Player.next();return true;}
    if(a==='prev'||a==='previous'){Player.prev();return true;}
    if(a==='track'){
      const t=TRACK_BY_SHARE.get(String(command.trackId||''));if(!t)return false;
      Player.playTrack(t,{kind:'widget',title:'For You'});setTimeout(()=>PlayerUI.show(),60);return true;
    }
    if(a==='radio'){
      const th=themeBySlug(String(command.theme||''))||THEME_BY_T.get(Geo.theme)||THEME_BY_T.get('TAIPEI DREAM');
      if(!th?.tracks?.length)return false;
      Player.playList(th.tracks,0,{kind:'theme',title:th.name,theme:th.t});setTimeout(()=>PlayerUI.show(),60);return true;
    }
    if(a==='home'){if(PlayerUI.isOpen)PlayerUI.hide();Router.go('home');return true;}
    return false;
  }
  if(available()){
    bus.on('track',()=>publishPlayback(true));
    bus.on('state',()=>publishPlayback(false));
    let last=0;bus.on('time',()=>{const n=performance.now();if(n-last<15000)return;last=n;publishPlayback(false);});
    bus.on('geo',publishCity);
    setTimeout(publishAll,250);
  }
  const api=Object.freeze({available,publishAll,perform});window.CITYMUSNative=api;return api;
})();
