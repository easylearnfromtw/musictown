'use strict';
/** Public, read-only search of CITYMUS' licensed catalog. No account or private playlist data. */
const library = require('../data/legal_music_library.json');
const records = Array.isArray(library) ? library : Array.isArray(library.tracks) ? library.tracks : [];
const ATTRIBUTION = { label: 'Powered by CITYMUS', url: 'https://easylearnfromtw.github.io/musictown/', required: true };
const PUBLIC_ORIGINS = new Set(['https://easylearnfromtw.github.io']);
const MOODS = {
  '讀書': ['lofi','lo-fi','study','focus','calm','piano','ambient','chill','quiet','輕音樂','安靜'],
  '專注': ['focus','ambient','minimal','lofi','lo-fi','study','piano','instrumental','calm'],
  '工作': ['focus','lofi','lo-fi','jazz','ambient','chill','study'],
  '睡前': ['sleep','ambient','relax','calm','piano','soft','quiet','night','dream'],
  '放鬆': ['relax','chill','ambient','soft','calm','lofi','lo-fi','jazz'],
  '開車': ['drive','road','rock','pop','city','night','retro','synth','upbeat'],
  '運動': ['workout','sport','energy','edm','electronic','dance','rock','upbeat'],
  '跑步': ['run','running','sport','workout','energy','dance','edm','upbeat'],
  '咖啡': ['cafe','coffee','jazz','lounge','acoustic','lofi','lo-fi'],
  '爵士': ['jazz','blues','swing','soul'],
  '搖滾': ['rock','indie','guitar'],
  '電子': ['electronic','edm','synth','dance','techno'],
  '夜晚': ['night','jazz','lounge','ambient','chill','city'],
  '下雨': ['rain','lofi','lo-fi','ambient','piano','soft'],
  '日文': ['japan','japanese','tokyo','j-pop','jpop'],
  '韓文': ['korea','korean','k-pop','kpop'],
  '中文': ['chinese','taiwan','mandarin','c-pop'],
  '台北': ['taipei','taiwan','city'],
  '東京': ['tokyo','japan','city']
};
function safeString(v, max = 160) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}
function safeHttp(v) {
  const input = safeString(v, 1800);
  try {
    const u = new URL(input);
    return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
function tags(t) {
  const values = [t.genre, t.genres, t.mood, t.moods, t.vibe, t.tags, t.theme, t.category, t.style, t.styles, t.city];
  return values.flatMap(x => Array.isArray(x) ? x : x == null ? [] : [x])
    .map(v => safeString(v, 100)).filter(Boolean).join(' · ');
}
function normalized(t, index) {
  const title = safeString(t.title || t.name || t.track || t.song);
  const artist = safeString(t.artist || t.creator || t.author || t.performer || '未標示作者');
  if (!title) return null;
  // Avoid returning invented or unlicensed playable URLs. Source and playback remain distinct.
  const sourceUrl = safeHttp(t.source || t.source_url || t.page || t.url || t.link);
  const download = safeHttp(t.download || t.audioUrl || t.audio_url || t.audioSrc || t.preview);
  const audioUrl = download && /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:[?#]|$)/i.test(download) ? download : null;
  return {
    id: String(t.id || t.track_id || 'citymus-' + index).slice(0, 100),
    title, artist, genre: tags(t), license: safeString(t.license || t.licence || ''),
    sourceUrl, audioUrl, album: safeString(t.album || ''), provider: 'CITYMUS'
  };
}
function tokens(q) {
  return q.toLowerCase()
    .replace(/(請問|請幫我|幫我|我想|我要|可以|想聽|推薦|查詢|搜尋|查找|找找|找一下|幾首|歌曲|歌單|音樂|歌手|專輯|播放|給我|有沒有|一些|一點|適合|的|來點|citymus)/gi, ' ')
    .split(/[\s，、。？?!！:：/]+/).filter(x => x.length > 1).slice(0, 8);
}
function relevance(track, query) {
  const q = query.toLowerCase().trim();
  const tt = track.title.toLowerCase(), aa = track.artist.toLowerCase(), mm = (track.genre + ' ' + track.album).toLowerCase();
  const words = tokens(q), moodTerms = Object.entries(MOODS)
    .filter(([key]) => q.includes(key))
    .flatMap(([, values]) => values);
  let score = 0;
  if (q.length >= 2 && (tt === q || aa === q)) score += 120;
  for (const w of words) {
    if (tt.includes(w)) score += 45;
    if (aa.includes(w)) score += 40;
    if (mm.includes(w)) score += 16;
  }
  for (const term of moodTerms) {
    if (mm.includes(term)) score += 8;
    if (tt.includes(term)) score += 4;
  }
  return score;
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (PUBLIC_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=60, s-maxage=300' : 'no-store');
  res.end(JSON.stringify(data));
}
module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed' });
  const query = Array.isArray(req.query?.q) ? req.query.q[0] : req.query?.q;
  if (typeof query !== 'string' || query.trim().length < 1 || query.length > 180)
    return respond(res, 400, { error: 'q must be 1–180 characters' });
  const count = Math.min(12, Math.max(1, Number.parseInt(req.query?.limit, 10) || 6));
  const ranked = records.map((t, index) => normalized(t, index)).filter(Boolean)
    .map(t => ({ track: t, score: relevance(t, query) }));
  const matched = ranked.filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.track.title.localeCompare(b.track.title, 'zh-Hant'));
  // Generic music recommendations may use the licensed catalog, but don't claim exact matches.
  const generic = /^(?:(?:請|幫我|給我|我想|我要|可以|推薦|找|搜尋|查詢|一些|幾首|好聽|隨機|的|聽|播放|點|一下|\s|[，。！!])+)?(?:歌|歌曲|音樂|歌單|music|citymus)(?:(?:推薦|清單|一下|給我|\s|[，。！!])*)$/i.test(query.trim());
  const results = matched.length ? matched : generic ? ranked.slice(0, 6) : [];
  return respond(res, 200, {
    query, total: records.length, matched: matched.length, fallback: !matched.length && generic,
    tracks: results.slice(0, count).map(x => x.track), attribution: ATTRIBUTION
  });
};