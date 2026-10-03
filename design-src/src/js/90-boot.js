/* ==========================================================================
   Boot
   ========================================================================== */
(function boot() {
  const q = new URLSearchParams(location.search);
  const deep = q.has('theme') || q.has('read') || location.hash.length > 1 || q.has('previewCityPass') || q.has('previewLibraryPass') || q.has('previewAudioLink') || q.has('previewMonthly') || q.has('limited');
  Router.start();
  Player.restore();
  Mini.render();
  if (!Settings.get('onboarded') && !deep) Welcome.open(); else Geo.ensure();
  Share.readHash();
  setTimeout(() => Pass.autoHiddenSpot?.(), 1800);
  const monthlyDue = MonthlyTracker.issueDue();
  if (q.get('previewMonthly') === '1') setTimeout(() => MonthlyPass.open(MonthlyTracker.preview()), 650);
  else if (monthlyDue) setTimeout(() => {
    if (!Welcome.isOpen && !Sheet.isOpen && !PassSheet.isOpen) MonthlyPass.open(monthlyDue);
    else toast(monthlyDue.monthLabel + '聆聽月報已生成', { action: '查看', ms: 6500, onAction: () => MonthlyPass.open(monthlyDue) });
  }, 2600);

  // design previews (kept from R8.x)
  const pv = q.get('previewCityPass');
  if (pv) {
    const th = themeBySlug(pv) || THEME_BY_SLUG.get(norm(pv).replace(/\s+/g, '-'));
    if (th) { Geo.preview(th.t); Router.go('theme', { slug: th.slug }, { replace: true }); setTimeout(() => Pass.openTicket(Pass.issueCity(th, 'IP')), 420); }
  }
  if (q.get('previewLibraryPass') === '1') {
    const th = THEME_BY_T.get('TAIPEI DREAM') || THEMES.find(t => t.tracks.length);
    setTimeout(() => Share.libraryPass({ name: 'After Rain in Taipei', keys: th.tracks.slice(0, 8).map(trackKey) }), 500);
  }
  if (q.get('previewAudioLink') === '1') setTimeout(() => Ritual.open({ preview: true }), 600);

  // one gentle add-to-home-screen hint for returning iPhone visitors
  if (IS_IOS && !STANDALONE && VISITS >= 2 && !Settings.get('a2hsDismissed')) {
    setTimeout(() => {
      if (Welcome.isOpen || Sheet.isOpen) return;
      Settings.set('a2hsDismissed', true);
      toast('加入主畫面，像 App 一樣使用', { action: '怎麼做', ms: 6000, onAction: () => Sheet.open({ title: '加入主畫面', sub: '全螢幕開啟，鎖定畫面也能控制播放',
        html: `<div class="a2hs"><img src="apple-touch-icon.png" alt=""><div><b>1 · 點 Safari 下方的 ${icon('share')}</b><p>在分享選單往下捲。</p></div></div><div class="a2hs mt-8"><img src="apple-touch-icon.png" alt=""><div><b>2 · 選「加入主畫面」</b><p>主畫面會出現 CITYMUS 的圖示；從那裡打開，下載的歌會穩定保留，沒有網路也能聽。</p></div></div>` }) });
    }, 9000);
  }

  // Remove accidental literal newline markers if an upstream generated payload
  // ever leaves "/n" or "\\n" as a standalone DOM text node.
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const bad = [];
    while (walker.nextNode()) {
      const n = walker.currentNode, t = String(n.nodeValue || '').trim();
      if ((t === '/n' || t === '\\n') && !n.parentElement?.closest('script,style,pre,code')) bad.push(n);
    }
    bad.forEach(n => n.remove());
  } catch (_) {}

  document.documentElement.classList.add('is-ready');
})();

/* small public handle for debugging and the native shell */
window.CITYMUS = Object.freeze({ version: MT_BUILD, Player, Reco, Settings, FX, Geo, Pass, Router, Drawer, Offline, Artwork, Limited, Share });
window.musicetown = window.CITYMUS; // legacy API alias for old integrations
