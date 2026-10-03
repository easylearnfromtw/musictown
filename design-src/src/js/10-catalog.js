/* ==========================================================================
   Catalog · 26 destinations. Names in MUSIC_DATA are the stable keys.
   ========================================================================== */
const REMOTE_MAP = window.MUSICETOWN_REMOTE_AUDIO || {};
/* 文學 · nineteen literary works, 25 public-domain / open-licence recordings each.
   Kept outside MUSIC_DATA so the CI's 26-theme / 1300-track checks stay untouched. */
const LIT = Array.isArray(window.MUSICETOWN_LITERATURE) ? window.MUSICETOWN_LITERATURE : [];
const LIT_MAP = window.MUSICETOWN_LITERATURE_MAP || {};
const DATA = (Array.isArray(window.MUSIC_DATA) ? window.MUSIC_DATA : []).concat(LIT.map(w => ({ t: w.t, sub: w.summary, key: `${w.authorCn} · ${w.era}`, tracks: w.tracks, literature: true })));

/* kind: city | style | mood. code = IATA-style identity used across the UI. */
const META = {
  'TAIPEI DREAM':        { slug: 'taipei-style', code: 'TPE', name: 'Taipei Dream', cn: '台北夢', kind: 'city', region: 'asia', city: 'Taipei', cityCn: '台北', tz: 'Asia/Taipei', country: 'TW', accent: '#5f8f96', ink: '#2c4a4f', aliases: ['taipei', 'taipei city', 'new taipei', 'new taipei city', 'sanchong', 'banqiao', 'zhonghe', 'yonghe', 'xinzhuang', 'xindian'], line: '雨後的巷口、捷運末班車與臥室錄音的人聲。', summary: '雨夜、巷口、捷運與城市獨立人聲。TAIPEI DREAM 把台北都會的潮濕霓虹、日常節奏與輕微孤獨感收進一個抽屜。' },
  'FANTASY TAINAN':      { slug: 'fantasy-tainan', code: 'TNN', name: 'Fantasy Tainan', cn: '府城之戀', kind: 'city', region: 'asia', city: 'Tainan', cityCn: '台南', tz: 'Asia/Taipei', country: 'TW', accent: '#b98269', ink: '#5b4034', aliases: ['tainan', 'tainan city', 'anping', 'west central district'], line: '夕陽落在赤崁樓與安平巷弄，木吉他與老城的暖風慢慢靠近。', summary: '古城、廟埕、老屋、海風與南方日光。FANTASY TAINAN 偏溫暖、懷舊、帶一點戀愛感的 folk / acoustic / world 聲景。' },
  'ROUGE TIBET':         { slug: 'rouge-tibet', code: 'LXA', name: 'Rouge Tibet', cn: '胭脂西域', kind: 'city', region: 'asia', city: 'Lhasa', cityCn: '拉薩', tz: 'Asia/Shanghai', country: 'CN', accent: '#a65f55', ink: '#5a332e', aliases: ['lhasa', 'lasa', 'tibet', 'xizang', 'lhasa city'], line: '高原紅、風馬旗與寺院鐘聲，在稀薄空氣裡留下很長的尾韻。', summary: '高原、山風、寺院、鼓點與大片留白。ROUGE TIBET 以 world / folk / ritual / ambient 的開放授權錄音描繪藏地高原的深紅與遼闊。' },
  'MALDIVES PARADISE':  { slug: 'maldives-paradise', code: 'MLE', name: 'Maldives Paradise', cn: '仙境馬爾地夫', kind: 'city', region: 'asia', city: 'Maldives', cityCn: '馬爾地夫', tz: 'Indian/Maldives', country: 'MV', accent: '#79C9D2', ink: '#28555D', aliases: ['maldives', 'male', 'malé', 'hulhumale', 'kaafu'], line: '海水像玻璃一樣透明，白沙、珊瑚與日落把節拍放慢。', summary: '島嶼、潟湖、白沙、珊瑚礁與大片海面。MALDIVES PARADISE 以 tropical / ambient / acoustic / chill 的合法開放授權音樂描繪馬爾地夫。' },
  'OLD TOKYO':           { slug: 'old-tokyo', code: 'TYO', name: 'Old Tokyo', cn: '老東京', kind: 'city', region: 'asia', city: 'Tokyo', cityCn: '東京', tz: 'Asia/Tokyo', country: 'JP', accent: '#b07f86', ink: '#5a3c41', aliases: ['tokyo', 'shinjuku', 'shibuya', 'minato', 'chiyoda', 'taito', 'setagaya', 'suginami'], line: '首都高的霓虹、昭和餘暉與合成器流行。', summary: '昭和殘影、老東京夜色與都會旋律。OLD TOKYO 偏復古、細膩、略帶電影感，像深夜電車窗外倒退的街景。' },
  'SPLENDOR SHANGHAI':   { slug: 'splendor-shanghai', code: 'SHA', name: 'Splendor Shanghai', cn: '海上繁華', kind: 'city', region: 'asia', city: 'Shanghai', cityCn: '上海', tz: 'Asia/Shanghai', country: 'CN', accent: '#9a8270', ink: '#53443a', aliases: ['shanghai', 'shanghai city'], line: '舞廳爵士、靈魂樂與外灘的金色夜宴。', summary: '爵士舞廳、Art Deco 與老上海華麗聲響。SPLENDOR SHANGHAI 偏優雅、暖色、帶一點舊時代夜宴的節奏。' },
  'TRADITIONAL BEIJING': { slug: 'traditional-beijing', code: 'BJS', name: 'Traditional Beijing', cn: '京味北京', kind: 'city', region: 'asia', city: 'Beijing', cityCn: '北京', tz: 'Asia/Shanghai', country: 'CN', accent: '#9b3a4b', ink: '#54232c', aliases: ['beijing', 'beijing city'], line: '京劇唱腔、鑼鼓與胡同裡的老戲台。', summary: '京劇唱腔、鑼鼓、嗩吶與傳統戲曲舞台感。TRADITIONAL BEIJING 把京味戲劇張力與古典器樂聲響集中在一起。' },
  'BUSTLING HONG KONG':  { slug: 'bustling-hong-kong', code: 'HKG', name: 'Bustling Hong Kong', cn: '喧囂香港', kind: 'city', region: 'asia', city: 'Hong Kong', cityCn: '香港', tz: 'Asia/Hong_Kong', country: 'HK', accent: '#b0566a', ink: '#5e303b', aliases: ['hong kong', 'kowloon', 'central', 'wan chai', 'causeway bay', 'tsim sha tsui'], line: '霓虹招牌、叮叮電車與不睡的城市速度。', summary: '霓虹、電車、密集人潮與夜間速度。BUSTLING HONG KONG 是最喧囂、最密度導向的城市聲景之一。' },
  'SOLEMN KYOTO':        { slug: 'solemn-kyoto', code: 'KYO', name: 'Solemn Kyoto', cn: '肅穆京都', kind: 'city', region: 'asia', city: 'Kyoto', cityCn: '京都', tz: 'Asia/Tokyo', country: 'JP', accent: '#8c775d', ink: '#524638', aliases: ['kyoto', 'kyoto city'], line: '寺院木色、石庭留白與遠處鐘聲。', summary: '寺院、石庭、鐘聲、koto 與 shakuhachi。SOLEMN KYOTO 強調留白、儀式與日本傳統聲響。' },
  'MIRACULOUS LUOYANG':  { slug: 'miraculous-luoyang', code: 'LYA', name: 'Miraculous Luoyang', cn: '神都洛陽', kind: 'city', region: 'asia', city: 'Luoyang', cityCn: '洛陽', tz: 'Asia/Shanghai', country: 'CN', accent: '#a3604a', ink: '#5b3628', aliases: ['luoyang', 'luoyang city'], line: '宮闕、鐘鼓與盛唐式的恢弘。', summary: '宮闕、鐘鼓與君臨京城的恢弘。MIRACULOUS LUOYANG 聚焦中國傳統器樂、宮廷儀式與大尺度聲場。' },
  'VAPOR LONDON':        { slug: 'london', code: 'LON', name: 'Vapor London', cn: '霧都倫敦', kind: 'city', region: 'europe', city: 'London', cityCn: '倫敦', tz: 'Europe/London', country: 'GB', accent: '#7f6a7a', ink: '#4d3e48', aliases: ['london', 'city of london', 'westminster'], line: 'Soho 霧雨、後龐克與蒸氣般的合成器。', summary: '霧雨、Soho、post-punk、art-pop 與 vapor synth。VAPOR LONDON 把倫敦夜色拉成更冷、更霧、更流動的聲音。' },
  'SLIGHTLY TIPSY ROME': { slug: 'slightly-tipsy-rome', code: 'ROM', name: 'Slightly Tipsy Rome', cn: '微醺羅馬', kind: 'city', region: 'europe', city: 'Rome', cityCn: '羅馬', tz: 'Europe/Rome', country: 'IT', accent: '#98705f', ink: '#574139', aliases: ['rome', 'roma'], line: '葡萄酒色的夜、石柱與教堂迴音。', summary: '葡萄酒色夜幕、古城石材、教堂迴音與神聖合唱。SLIGHTLY TIPSY ROME 在微醺與莊嚴之間保持張力。' },
  'CHAMPS-ÉLYSÉES':      { slug: 'champs-elysees', code: 'PAR', name: 'Champs-Élysées', cn: '香榭大道', kind: 'city', region: 'europe', city: 'Paris', cityCn: '巴黎', tz: 'Europe/Paris', country: 'FR', accent: '#9a8399', ink: '#574b56', aliases: ['paris', 'paris city'], line: '精品櫥窗的光、lounge 與巴黎步伐。', summary: '精品櫥窗、香榭大道與夜間時裝店。CHAMPS-ÉLYSÉES 以 lounge、house、nu-disco 與法式優雅為主。' },
  'FANTASY TAINAN': ['folk', 'acoustic', 'warm', 'nostalgic', 'traditional', 'slow folk', 'coastal indie', 'pacific rain', 'soft room', 'chanson'],
  'ROUGE TIBET': ['ambient', 'ritual', 'folk', 'meditative', 'world', 'slow', 'old room', 'traditional', 'acapella', 'spiritual', 'ceremonial'],
  'MALDIVES PARADISE': ['tropical', 'island', 'ocean', 'beach', 'summer', 'sunset', 'acoustic', 'chill', 'warm', 'ambient', 'reggae'],
  'MENACING DUBAI':      { slug: 'menacing-dubai', code: 'DXB', name: 'Menacing Dubai', cn: '凜冽杜拜', kind: 'city', region: 'mideast', city: 'Dubai', cityCn: '杜拜', tz: 'Asia/Dubai', country: 'AE', accent: '#8a7553', ink: '#4e432f', aliases: ['dubai', 'dubayy'], line: '玻璃高塔、沙漠夜色與奢華的壓迫感。', summary: '玻璃高塔、沙漠夜色與壓迫式奢華。MENACING DUBAI 用暗黑電子、張力與中東質地製造膽戰心驚感。' },
  'VANCOUVER':           { slug: 'vancouver', code: 'YVR', name: 'Vancouver', cn: '溫哥華', kind: 'city', region: 'americas', city: 'Vancouver', cityCn: '溫哥華', tz: 'America/Vancouver', country: 'CA', accent: '#6d969c', ink: '#34545a', aliases: ['vancouver', 'burnaby', 'richmond', 'north vancouver', 'west vancouver'], line: '太平洋的雨、海堤與森林邊界的人聲。', summary: 'Pacific rain、冷空氣與鬆弛的人聲。VANCOUVER 把西岸的陰雨、木質感與 indie / folk 的空間感放在一起。' },
  'NEW YORK':            { slug: 'new-york', code: 'NYC', name: 'New York', cn: '紐約', kind: 'city', region: 'americas', city: 'New York', cityCn: '紐約', tz: 'America/New_York', country: 'US', accent: '#5d7394', ink: '#35465d', aliases: ['new york', 'new york city', 'manhattan', 'brooklyn', 'queens', 'bronx'], line: 'Downtown 靈魂樂、地鐵節奏與午夜流行。', summary: 'Downtown soul、地鐵速度、爵士與夜間能量。NEW YORK 是密度、節奏與城市碰撞感最強的一個抽屜。' },
  'TROPICAL HAWAII':     { slug: 'tropical-hawaii', code: 'HNL', name: 'Tropical Hawaii', cn: '熱帶夏威夷', kind: 'city', region: 'americas', city: 'Honolulu', cityCn: '檀香山', tz: 'Pacific/Honolulu', country: 'US', accent: '#6fa29a', ink: '#355955', aliases: ['honolulu', 'hilo', 'kailua', 'kahului', 'hawaii'], line: '海風、衝浪節拍與午後的島嶼陽光。', summary: '海風、熱甜節拍與島嶼午後。TROPICAL HAWAII 把 surf、reggae、ukulele 與明亮夏日感放進同一張城市票根。' },
  'PSYCHEDELIC LA':      { slug: 'psychedelic-la', code: 'LAX', name: 'Psychedelic LA', cn: '迷幻洛杉磯', kind: 'city', region: 'americas', city: 'Los Angeles', cityCn: '洛杉磯', tz: 'America/Los_Angeles', country: 'US', accent: '#8f74a8', ink: '#503f61', aliases: ['los angeles', 'hollywood', 'west hollywood', 'santa monica', 'beverly hills'], line: '日落大道的熱霧、夢幻吉他與迷幻色彩。', summary: 'Sunset haze、夢幻吉他與迷幻色彩。PSYCHEDELIC LA 把洛杉磯的熱、霧與 West Coast psych 疊在一起。' },
  'JAZZ':                { slug: 'jazz', code: 'JZZ', name: 'Jazz', cn: '爵士', kind: 'style', accent: '#8a87b5', ink: '#3f3d58', line: '深夜的銅管、鋼琴房與慢搖擺的人聲。' },
  'CROONER':             { slug: 'crooner', code: 'CRN', name: 'Crooner', cn: '經典人聲', kind: 'style', accent: '#978392', ink: '#493f48', line: '絲絨般的嗓音、lounge 與夜晚的浪漫。' },
  'ROCK':                { slug: 'rock', code: 'RCK', name: 'Rock', cn: '搖滾', kind: 'style', accent: '#7b839b', ink: '#3e4658', line: '吉他的顆粒、藍調根源與人的不完美。' },
  'LO-FI':               { slug: 'lo-fi', code: 'LFI', name: 'Lo-Fi', cn: '低傳真', kind: 'style', accent: '#a296b4', ink: '#51495d', line: '輕聲人聲、磁帶底噪與低干擾的夜。' },
  'EMO':                 { slug: 'emo', code: 'EMO', name: 'Emo', cn: '情緒', kind: 'mood', accent: '#886070', ink: '#523843', line: '把心事唱出來的人聲與午夜的釋放。' },
  'SPORT':               { slug: 'sport', code: 'SPT', name: 'Sport', cn: '運動', kind: 'mood', accent: '#7f98ae', ink: '#3c4c5b', line: '動能、衝擊與訓練用的人聲能量。' },
  'RUNNING':             { slug: 'running', code: 'RUN', name: 'Running', cn: '跑步', kind: 'mood', accent: '#5b8ea5', ink: '#315465', line: '快節拍、向前推進，為配速而選。' },
  'POEM':                { slug: 'poem', code: 'POM', name: 'Poem', cn: '詩', kind: 'mood', accent: '#968470', ink: '#55493d', line: '民謠、私語般的人聲與安靜房間。' }
};

/* literature meta: kind 'literature' */
LIT.forEach(w => { META[w.t] = { slug: w.slug, code: w.code, name: w.name, cn: w.cn, kind: 'literature', author: w.author, authorCn: w.authorCn, era: w.era, accent: w.accent, ink: w.ink, line: w.line, summary: w.summary }; });
/* Original playlists · 25 tracks each, deterministically re-curated from the mother library. */
const ORIGINAL_PLAYLISTS = [
  {
    "t": "MOONLIT HAZE",
    "slug": "moonlit-haze",
    "code": "YUE",
    "name": "趁月色恍惚時",
    "cn": "Moonlit Haze",
    "accent": "#8B91AF",
    "ink": "#42475F",
    "line": "月色隔著薄霧落下來，輪廓、呼吸和時間都慢了半拍。",
    "summary": "一張適合把焦點放鬆的夜色歌單。聲音不急著抵達哪裡，留著霧、回聲與朦朧的空隙，像凌晨抬頭時記不清楚的一段月光。",
    "words": [
      "dream",
      "dreamy",
      "ambient",
      "lo-fi",
      "slow night",
      "soft room",
      "haze",
      "night",
      "pacific rain",
      "synth",
      "velvet",
      "chanson",
      "mellow"
    ]
  },
  {
    "t": "DROWSY",
    "slug": "drowsy",
    "code": "AWK",
    "name": "惺忪",
    "cn": "Drowsy",
    "accent": "#C4AA91",
    "ink": "#624E3E",
    "line": "眼睛睜開了，意識還留在枕頭與晨光之間。",
    "summary": "剛醒來的聲音不該太完整。木吉他、柔軟人聲、低速節拍和一點室內殘響，像棉被還有溫度、窗簾才剛透進第一層光。",
    "words": [
      "soft",
      "acoustic",
      "folk",
      "lo-fi",
      "morning",
      "warm",
      "mellow",
      "slow",
      "lounge",
      "bedroom",
      "vocal",
      "gentle",
      "singer-songwriter"
    ]
  },
  {
    "t": "KISS",
    "slug": "kiss",
    "code": "KIS",
    "name": "吻",
    "cn": "Kiss",
    "systemName": "刎",
    "accent": "#9D5967",
    "ink": "#502C35",
    "line": "愛貼得太近時，吻與窒息只剩一線之隔。",
    "summary": "不是溫柔的情歌，而是依戀逐漸變成命令、佔有與失控的愛。節拍越來越緊，情緒越來越沒有出口，保留被凝視、被控制、想逃卻又被拉回去的壓迫感。",
    "words": [
      "dark",
      "tense",
      "industrial",
      "pulse",
      "emo",
      "rock",
      "post-punk",
      "night drive",
      "synth",
      "heavy",
      "dramatic",
      "distortion",
      "obsession"
    ]
  },
  {
    "t": "FIELD SEA NOTES",
    "slug": "field-sea-notes",
    "code": "MON",
    "name": "田海記趣",
    "cn": "Field & Sea Notes",
    "accent": "#87A7A0",
    "ink": "#405B57",
    "line": "把水面、田野、花與光拆成一筆一筆會流動的聲音。",
    "summary": "以莫奈畫作的觀看方式策展：不追求清楚輪廓，而讓水光、田野、睡蓮、風與色彩彼此滲開。前景像民謠，遠景像環境音，整張歌單要有如詩、如畫的呼吸。",
    "words": [
      "coastal",
      "pacific rain",
      "acoustic",
      "folk",
      "ambient",
      "soft",
      "warm",
      "garden",
      "chanson",
      "slow",
      "nature",
      "lounge",
      "dream"
    ]
  },
  {
    "t": "OCEANIC",
    "slug": "oceanic",
    "code": "SEA",
    "name": "汪洋",
    "cn": "Oceanic",
    "accent": "#668FA9",
    "ink": "#315166",
    "line": "看不見岸的藍，浪與呼吸把時間拉成更長的尺度。",
    "summary": "不是海灘派對，而是海本身。從近岸的光、潮汐與風，慢慢游向沒有地標的深藍；低頻像暗流，長音像浪，最後只剩一種遼闊感。",
    "words": [
      "ocean",
      "sea",
      "coastal",
      "pacific",
      "ambient",
      "wave",
      "blue",
      "island",
      "tropical",
      "slow",
      "dream",
      "synth",
      "chill"
    ]
  },
  {
    "t": "TROUBADOUR",
    "slug": "troubadour",
    "code": "BRD",
    "name": "吟遊詩人",
    "cn": "Troubadour",
    "accent": "#987A5E",
    "ink": "#574433",
    "line": "從一個人的弦聲出發，走過人群與夜色，再把故事帶回原點。",
    "summary": "這張歌單按故事順序聽。開場像獨自上路，中段逐漸遇見人群、酒館與遠方，之後轉入夜色與失落；結尾再收回最初的木質感，讓第一首與最後幾首彼此照應。",
    "phases": [
      {
        "n": 6,
        "words": [
          "acoustic",
          "folk",
          "singer-songwriter",
          "soft",
          "roots",
          "americana"
        ]
      },
      {
        "n": 7,
        "words": [
          "folk",
          "soul",
          "upbeat",
          "warm",
          "lounge",
          "vocal",
          "groove"
        ]
      },
      {
        "n": 6,
        "words": [
          "slow night",
          "dark",
          "ballad",
          "chanson",
          "old room",
          "emo",
          "night"
        ]
      },
      {
        "n": 6,
        "words": [
          "acoustic",
          "folk",
          "soft",
          "roots",
          "singer-songwriter",
          "warm"
        ]
      }
    ]
  },
  {
    "t": "LOOKING BACK",
    "slug": "looking-back",
    "code": "RET",
    "name": "驀然回首",
    "cn": "Looking Back",
    "accent": "#7C8799",
    "ink": "#3D4655",
    "line": "前二十四首都在趕路，直到最後一首，才終於看見那個人。",
    "summary": "整張歌單故意讓前段一直向前：快、急、城市感、像在人群裡反覆錯身。第 25 首才突然鬆開速度與張力，像跑了很久後回頭，真正要找的人一直站在燈火闌珊處。",
    "rush": [
      "running",
      "high energy",
      "motion",
      "fast",
      "downtown pulse",
      "night drive",
      "rock",
      "punk",
      "electronic",
      "synth",
      "upbeat",
      "city"
    ],
    "resolve": [
      "warm",
      "soft room",
      "acoustic",
      "ballad",
      "soul",
      "love",
      "slow",
      "chanson",
      "velvet",
      "gentle"
    ]
  }
];
const ORIGINAL_POOL = (() => {
  const seen = new Set(), out = [];
  for (const d of (Array.isArray(window.MUSIC_DATA) ? window.MUSIC_DATA : [])) {
    for (const t of (Array.isArray(d.tracks) ? d.tracks : [])) {
      const k = t.masterId || t.audioSrc || (norm(t.artist) + '|' + norm(t.title));
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push({ t, from: d.t });
    }
  }
  return out;
})();
const originalKey = x => x.t.masterId || x.t.audioSrc || (norm(x.t.artist) + '|' + norm(x.t.title));
const originalHay = x => [x.t.title, x.t.artist, x.t.vibe, x.t.genre, x.t.note, x.from].filter(Boolean).join(' ').toLowerCase();
function originalPick(spec, count, used = new Set(), words = spec.words || []) {
  const ranked = ORIGINAL_POOL.map(x => {
    const hay = originalHay(x); let score = 0;
    words.forEach((w, i) => { if (hay.includes(String(w).toLowerCase())) score += Math.max(2, 10 - Math.min(i, 7)); });
    if (/cc0|public domain/i.test(String(x.t.license || ''))) score += 2;
    return { x, score, tie: hash32(spec.t + '|' + originalKey(x)) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie);
  const out = [];
  for (const row of ranked) {
    const k = originalKey(row.x); if (used.has(k)) continue;
    used.add(k); out.push(row.x); if (out.length >= count) break;
  }
  return out;
}
function originalSequence(spec) {
  const used = new Set();
  if (Array.isArray(spec.phases)) {
    const out = [];
    spec.phases.forEach(p => out.push(...originalPick(spec, p.n, used, p.words)));
    return out.slice(0, 25);
  }
  if (spec.t === 'LOOKING BACK') return [...originalPick(spec, 24, used, spec.rush), ...originalPick(spec, 1, used, spec.resolve)];
  return originalPick(spec, 25, used, spec.words);
}
function originalData(spec) {
  const picked = originalSequence(spec);
  return { t: spec.t, sub: spec.summary, key: '原創歌單 · 25 首 · 母庫重新策展', original: true,
    tracks: picked.map((x, i) => ({ ...x.t, trackNo: i + 1, curatedTheme: spec.t,
      curatedFrom: x.t.shareId || x.t.audioSrc || x.from, sourceTheme: x.from,
      originalPlaylist: true, shareId: spec.slug + '-' + String(i + 1).padStart(3, '0'),
      vibe: spec.name + ' · ' + (x.t.vibe || x.from || '') }))
  };
}
ORIGINAL_PLAYLISTS.forEach(spec => {
  META[spec.t] = { slug: spec.slug, code: spec.code, name: spec.name, cn: spec.cn, kind: 'original',
    systemName: spec.systemName || '', accent: spec.accent, ink: spec.ink, line: spec.line, summary: spec.summary };
});
DATA.push(...ORIGINAL_PLAYLISTS.map(originalData));


/* Groups for the glass box and filters */
const GROUPS = [
  { key: 'asia', label: '亞洲', en: 'Asia', names: ['TAIPEI DREAM', 'FANTASY TAINAN', 'OLD TOKYO', 'SPLENDOR SHANGHAI', 'TRADITIONAL BEIJING', 'BUSTLING HONG KONG', 'SOLEMN KYOTO', 'MIRACULOUS LUOYANG', 'ROUGE TIBET'] },
  { key: 'europe', label: '歐洲', en: 'Europe', names: ['VAPOR LONDON', 'SLIGHTLY TIPSY ROME', 'CHAMPS-ÉLYSÉES', 'MENACING DUBAI'] },
  { key: 'americas', label: '美洲', en: 'Americas', names: ['VANCOUVER', 'NEW YORK', 'TROPICAL HAWAII', 'PSYCHEDELIC LA'] },
  { key: 'style', label: '風格', en: 'Styles', names: ['JAZZ', 'CROONER', 'ROCK', 'LO-FI'] },
  { key: 'mood', label: '心情', en: 'Moods', names: ['EMO', 'SPORT', 'RUNNING', 'POEM'] },
  { key: 'original', label: '原創歌單', en: 'Original', names: ORIGINAL_PLAYLISTS.map(w => w.t) },
  { key: 'literature', label: '文學', en: 'Literature', names: LIT.map(w => w.t) }
].filter(g => g.names.length);
const KIND_LABEL = { city: '城市', style: '風格', mood: '心情', original: '原創歌單', literature: '文學' };
const REGION_LABEL = { asia: '亞洲', europe: '歐洲', mideast: '中東', americas: '美洲' };

/* Landmarks for spot-edition tickets (GPS check-in, coordinates never stored) */
const LANDMARKS = [
  { id: 'west-lake-hangzhou', name: 'West Lake', cn: '西湖', code: 'HZH', area: 'Hangzhou', areaCn: '杭州', region: 'asia', theme: 'SPLENDOR SHANGHAI', lat: 30.2375, lng: 120.140833, r: 5200 },
  { id: 'taipei-101', name: 'Taipei 101', cn: '台北 101', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0340, lng: 121.5645, r: 650 },
  { id: 'ximending', name: 'Ximending', cn: '西門町', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0422, lng: 121.5077, r: 850 },
  { id: 'longshan-temple', name: 'Lungshan Temple', cn: '艋舺龍山寺', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0372, lng: 121.4999, r: 550 },
  { id: 'xingtian-temple', name: 'Xingtian Temple', cn: '行天宮', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0627, lng: 121.5337, r: 550 },
  { id: 'dihua-street', name: 'Dihua Street', cn: '迪化街', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0555, lng: 121.5103, r: 850 },
  { id: 'presidential-office', name: 'Presidential Office Building', cn: '總統府', code: 'TPE', area: 'Taipei', areaCn: '台北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.0400, lng: 121.5119, r: 380, hidden: true, auto: true },
  { id: 'wulai-old-street', name: 'Wulai Old Street', cn: '烏來老街', code: 'NWT', area: 'New Taipei', areaCn: '新北', region: 'asia', theme: 'TAIPEI DREAM', lat: 24.8638, lng: 121.5515, r: 1200 },
  { id: 'jiufen-old-street', name: 'Jiufen Old Street', cn: '九份老街', code: 'NWT', area: 'New Taipei', areaCn: '新北', region: 'asia', theme: 'TAIPEI DREAM', lat: 25.1098, lng: 121.8452, r: 1200 },
  { id: 'anping-fort', name: 'Anping Old Fort', cn: '安平古堡', code: 'TNN', area: 'Tainan', areaCn: '台南', region: 'asia', theme: 'FANTASY TAINAN', lat: 23.0016, lng: 120.1607, r: 900 },
  { id: 'alishan', name: 'Alishan', cn: '阿里山', code: 'CYI', area: 'Chiayi', areaCn: '嘉義', region: 'asia', theme: 'TAIPEI DREAM', lat: 23.5100, lng: 120.8050, r: 5000 },
  { id: 'sun-moon-lake', name: 'Sun Moon Lake', cn: '日月潭', code: 'NTO', area: 'Nantou', areaCn: '南投', region: 'asia', theme: 'TAIPEI DREAM', lat: 23.8650, lng: 120.9150, r: 5000 },
  { id: 'potala-palace', name: 'Potala Palace', cn: '布達拉宮', code: 'LXA', area: 'Lhasa', areaCn: '拉薩', region: 'asia', theme: 'ROUGE TIBET', lat: 29.6578, lng: 91.1172, r: 1200 },
  { id: 'tokyo-skytree', name: 'Tokyo Skytree', cn: '東京晴空塔', code: 'TYO', area: 'Tokyo', areaCn: '東京', region: 'asia', theme: 'OLD TOKYO', lat: 35.7101, lng: 139.8107, r: 700 },
  { id: 'tokyo-tower', name: 'Tokyo Tower', cn: '東京鐵塔', code: 'TYO', area: 'Tokyo', areaCn: '東京', region: 'asia', theme: 'OLD TOKYO', lat: 35.6586, lng: 139.7454, r: 550 },
  { id: 'shibuya-crossing', name: 'Shibuya Crossing', cn: '澀谷十字路口', code: 'TYO', area: 'Tokyo', areaCn: '東京', region: 'asia', theme: 'OLD TOKYO', lat: 35.6595, lng: 139.7005, r: 450 },
  { id: 'gyeongbokgung', name: 'Gyeongbokgung Palace', cn: '首爾景福宮', code: 'SEL', area: 'Seoul', areaCn: '首爾', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 37.5796, lng: 126.9770, r: 800 },
  { id: 'n-seoul-tower', name: 'N Seoul Tower', cn: '南山首爾塔', code: 'SEL', area: 'Seoul', areaCn: '首爾', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 37.5512, lng: 126.9882, r: 850 },
  { id: 'the-bund', name: 'The Bund', cn: '外灘', theme: 'SPLENDOR SHANGHAI', lat: 31.2400, lng: 121.4900, r: 1000 },
  { id: 'forbidden-city', name: 'Forbidden City', cn: '故宮', theme: 'TRADITIONAL BEIJING', lat: 39.9163, lng: 116.3972, r: 1300 },
  { id: 'victoria-peak', name: 'Victoria Peak', cn: '太平山頂', code: 'HKG', area: 'Hong Kong', areaCn: '香港', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 22.2759, lng: 114.1455, r: 1300 },
  { id: 'victoria-harbour', name: 'Victoria Harbour', cn: '維多利亞港', code: 'HKG', area: 'Hong Kong', areaCn: '香港', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 22.2940, lng: 114.1690, r: 1800 },
  { id: 'chungking-mansions', name: 'Chungking Mansions', cn: '重慶大廈', code: 'HKG', area: 'Hong Kong', areaCn: '香港', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 22.2964, lng: 114.1722, r: 450 },
  { id: 'hong-kong-disneyland', name: 'Hong Kong Disneyland', cn: '香港迪士尼', code: 'HKG', area: 'Hong Kong', areaCn: '香港', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 22.3130, lng: 114.0413, r: 1800 },
  { id: 'macau-casino', name: 'Macau Casino District', cn: '澳門賭場', code: 'MFM', area: 'Macau', areaCn: '澳門', region: 'asia', theme: 'BUSTLING HONG KONG', lat: 22.1904, lng: 113.5439, r: 1500 },
  { id: 'kiyomizu-dera', name: 'Kiyomizu-dera', cn: '清水寺', theme: 'SOLEMN KYOTO', lat: 34.9949, lng: 135.7850, r: 750 },
  { id: 'longmen-grottoes', name: 'Longmen Grottoes', cn: '龍門石窟', theme: 'MIRACULOUS LUOYANG', lat: 34.5562, lng: 112.4703, r: 1500 },
  { id: 'big-ben', name: 'Big Ben', cn: '大笨鐘', theme: 'VAPOR LONDON', lat: 51.5007, lng: -0.1246, r: 650 },
  { id: 'colosseum', name: 'Colosseum', cn: '羅馬競技場', theme: 'SLIGHTLY TIPSY ROME', lat: 41.8902, lng: 12.4922, r: 650 },
  { id: 'arc-de-triomphe', name: 'Arc de Triomphe', cn: '凱旋門', theme: 'CHAMPS-ÉLYSÉES', lat: 48.8738, lng: 2.2950, r: 1100 },
  { id: 'burj-khalifa', name: 'Burj Khalifa', cn: '哈里發塔', theme: 'MENACING DUBAI', lat: 25.1972, lng: 55.2744, r: 850 },
  { id: 'great-pyramid-giza', name: 'Great Pyramid of Giza', cn: '古夫金字塔', code: 'GIZ', area: 'Giza', areaCn: '吉薩', region: 'africa', theme: 'MENACING DUBAI', lat: 29.9792, lng: 31.1342, r: 1600 },
  { id: 'stanley-park', name: 'Stanley Park', cn: '史丹利公園', theme: 'VANCOUVER', lat: 49.3043, lng: -123.1443, r: 1700 },
  { id: 'yellowstone', name: 'Yellowstone National Park', cn: '黃石公園', code: 'YNP', area: 'Yellowstone', areaCn: '黃石國家公園', region: 'americas', theme: 'VANCOUVER', lat: 44.5982, lng: -110.5472, r: 65000 },
  { id: 'times-square', name: 'Times Square', cn: '時代廣場', theme: 'NEW YORK', lat: 40.7580, lng: -73.9855, r: 550 },
  { id: 'waikiki', name: 'Waikiki Beach', cn: '威基基海灘', theme: 'TROPICAL HAWAII', lat: 21.2767, lng: -157.8270, r: 1700 },
  { id: 'griffith', name: 'Griffith Observatory', cn: '格里斐斯天文台', theme: 'PSYCHEDELIC LA', lat: 34.1184, lng: -118.3004, r: 1300 }
];

/* ---------- archive edit: playable interim pools for themes the CI has not installed yet ---------- */
const HYDRATE_WORDS = {
  'EMO': ['alternative', 'guitar grain', 'lo-fi rock', 'post-punk', 'punk', 'ballad rock', 'indie rock', 'slow night', 'soho after dark', 'roots'],
  'RUNNING': ['high energy', 'motion', 'workout', 'fast pop', 'hype pop', 'upbeat pop', 'electronic', 'dubstep', 'synthwave', 'downtown pulse'],
  'POEM': ['singer-songwriter', 'folk', 'slow folk', 'soft room', 'late study', 'pacific rain', 'acapella', 'chanson', 'slow night', 'coastal indie'],
  'TRADITIONAL BEIJING': ['old room', 'vintage', 'ballroom vocal', 'acapella', 'ragtime', 'vintage jazz', 'public-domain', 'velvet vocal'],
  'TROPICAL HAWAII': ['summer pop', 'upbeat pop', 'coastal indie', 'pacific rain', 'warm', 'pop', 'lounge', 'soul'],
  'BUSTLING HONG KONG': ['night city', 'city night', 'neon', 'synth pop', 'downtown pulse', 'night drive', 'city pop', 'urban indie', 'fast pop'],
  'SLIGHTLY TIPSY ROME': ['acapella', 'vintage lounge', 'ballroom vocal', 'velvet vocal', 'chanson', 'old room', 'jazz room', 'slow night'],
  'PSYCHEDELIC LA': ['art pop', 'synthwave', 'lo-fi', 'lo-fi rock', 'soho after dark', 'night drive', 'synth', 'americana'],
  'SOLEMN KYOTO': ['slow night', 'soft room', 'late study', 'acapella', 'slow folk', 'lo-fi', 'old room', 'pacific rain'],
  'MIRACULOUS LUOYANG': ['old room', 'vintage', 'ballroom vocal', 'vintage jazz', 'ragtime', 'acapella', 'velvet vocal', 'lounge'],
  'CHAMPS-ÉLYSÉES': ['lounge', 'vintage lounge', 'chanson', 'velvet vocal', 'art pop', 'soul-r&b', 'jazz-funk', 'soho after dark'],
  'MENACING DUBAI': ['dark', 'night', 'electronic', 'industrial', 'synth', 'pulse', 'tense', 'urban', 'city', 'drive', 'rock', 'dream', 'ambient', 'downtown', 'neon']
};
(function hydrateEmptyThemes() {
  for (const d of DATA) {
    if (!d || (Array.isArray(d.tracks) && d.tracks.length)) continue;
    const words = HYDRATE_WORDS[d.t]; const meta = META[d.t];
    if (!words || !meta) continue;
    const seen = new Set(), pool = [];
    for (const src of DATA) {
      if (src === d || !Array.isArray(src.tracks) || src.archiveEdit) continue;
      for (const t of src.tracks) {
        if (!t?.audioSrc || seen.has(t.audioSrc)) continue;
        seen.add(t.audioSrc);
        const hay = `${t.title || ''} ${t.artist || ''} ${t.vibe || ''} ${src.t || ''}`.toLowerCase();
        let score = 0; for (const w of words) if (hay.includes(w)) score += 3;
        if (/cc0|public domain/i.test(String(t.license || ''))) score += 2;
        let tie = 0; for (const ch of String(t.audioSrc)) tie = (tie * 33 + ch.charCodeAt(0)) >>> 0;
        if (d.t !== 'MENACING DUBAI') tie = hash32(d.t + t.audioSrc);
        pool.push({ t, score, tie, from: src.t });
      }
    }
    pool.sort((a, b) => b.score - a.score || a.tie - b.tie);
    const used = new Set(); const picked = [];
    for (const x of pool) { const k = x.t.masterId || x.t.audioSrc; if (used.has(k)) continue; used.add(k); picked.push(x); if (picked.length >= 50) break; }
    d.tracks = picked.map((x, i) => ({ ...x.t, trackNo: i + 1, curatedTheme: d.t, curatedFrom: x.t.audioSrc, vibe: `${(d.key || '').split('·')[0].trim() || meta.name} · ${x.t.vibe || x.from}`, shareId: `${meta.slug}-${String(i + 1).padStart(3, '0')}` }));
    d.installPending = false; d.archiveEdit = true;
  }
})();

/* ---------- indexes ---------- */
const THEMES = DATA.map((d, i) => {
  const m = META[d.t] || { slug: norm(d.t).replace(/\s+/g, '-'), code: d.t.slice(0, 3), name: d.t, cn: '', kind: 'style', accent: '#8a87b5', ink: '#3f3d58', line: '' };
  const th = Object.assign({ t: d.t, index: i, data: d, tracks: d.tracks || [] }, m);
  th.tracks.forEach((t, ti) => { t.__theme = d.t; t.__ti = ti; });
  return th;
});
const THEME_BY_T = new Map(THEMES.map(t => [t.t, t]));
const THEME_BY_SLUG = new Map(THEMES.map(t => [t.slug, t]));
const TRACK_BY_SHARE = new Map();
THEMES.forEach(th => th.tracks.forEach(t => { if (t.shareId && !TRACK_BY_SHARE.has(t.shareId)) TRACK_BY_SHARE.set(t.shareId, t); }));
const ALL_TRACKS = THEMES.flatMap(th => th.tracks);
const CITY_THEMES = THEMES.filter(t => t.kind === 'city');
const LIT_THEMES = THEMES.filter(t => t.kind === 'literature');
const ORIGINAL_THEMES = THEMES.filter(t => t.kind === 'original');
const themeOf = t => THEME_BY_T.get(t?.__theme || t?.curatedTheme || t?.libraryGenre) || null;
const themeBySlug = s => THEME_BY_SLUG.get(String(s || '').toLowerCase()) || null;
/* a recording can appear in several themes: dedupe by master */
const recKey = t => t?.localPersonal ? `local:${t.id}` : (t?.masterId || `${norm(t?.artist)}|${norm(t?.title)}`);
const trackKey = t => t?.localPersonal ? `local:${t.id}` : (t?.shareId ? `id:${t.shareId}` : `${String(t?.artist || '').trim()}||${String(t?.title || '').trim()}||${String(t?.source || '').trim()}`);
const vibeTags = t => String(t?.vibe || '').split('·').map(s => s.trim()).filter(Boolean);
const shortVibe = t => { const v = vibeTags(t); return v.find(x => !/vocal/i.test(x) && x.length < 22) || v[0] || ''; };
const TOTAL_TRACKS = DATA.reduce((n, d) => n + (d.tracks?.length || 0), 0);

function localTimeIn(tz) {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch (_) { return ''; }
}
function hourIn(tz) {
  try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date())) % 24; } catch (_) { return new Date().getHours(); }
}
function partOfDay(h = new Date().getHours()) { return h < 5 ? 'late' : h < 11 ? 'morning' : h < 17 ? 'day' : h < 21 ? 'evening' : 'night'; }
const GREETING = { late: '夜深了', morning: '早安', day: '午安', evening: '傍晚好', night: '晚安' };

/* sound-profile meters still come from MUSIC_DATA */
const metersOf = th => Array.isArray(th.data.meters) ? th.data.meters : [];
