/* ==========================================================================
   Reco · in-browser recommender
   Signals: completions, skips, likes, dislikes, recency, artist diversity,
   vibe similarity, theme affinity, BPM/energy continuity, time of day.
   A recording that appears in several themes is treated as one song.
   ========================================================================== */
const Reco = (() => {
  /* themes that sit well next to each other when the queue runs out */
  const NEAR = {
    'JAZZ': ['SPLENDOR SHANGHAI', 'CROONER', 'NEW YORK', 'SLIGHTLY TIPSY ROME'],
    'CROONER': ['JAZZ', 'SPLENDOR SHANGHAI', 'CHAMPS-ÉLYSÉES', 'POEM'],
    'ROCK': ['EMO', 'VAPOR LONDON', 'SPORT', 'PSYCHEDELIC LA'],
    'LO-FI': ['TAIPEI DREAM', 'VANCOUVER', 'POEM', 'SOLEMN KYOTO'],
    'EMO': ['ROCK', 'VAPOR LONDON', 'LO-FI'],
    'SPORT': ['RUNNING', 'ROCK', 'BUSTLING HONG KONG', 'NEW YORK'],
    'RUNNING': ['SPORT', 'BUSTLING HONG KONG', 'OLD TOKYO'],
    'POEM': ['LO-FI', 'VANCOUVER', 'CROONER', 'SOLEMN KYOTO'],
    'TAIPEI DREAM': ['LO-FI', 'OLD TOKYO', 'VANCOUVER', 'BUSTLING HONG KONG'],
    'OLD TOKYO': ['TAIPEI DREAM', 'BUSTLING HONG KONG', 'PSYCHEDELIC LA', 'NEW YORK'],
    'SPLENDOR SHANGHAI': ['JAZZ', 'CROONER', 'TRADITIONAL BEIJING', 'CHAMPS-ÉLYSÉES'],
    'TRADITIONAL BEIJING': ['MIRACULOUS LUOYANG', 'SPLENDOR SHANGHAI', 'SOLEMN KYOTO'],
    'BUSTLING HONG KONG': ['OLD TOKYO', 'NEW YORK', 'TAIPEI DREAM', 'RUNNING'],
    'SOLEMN KYOTO': ['MIRACULOUS LUOYANG', 'POEM', 'LO-FI'],
    'MIRACULOUS LUOYANG': ['TRADITIONAL BEIJING', 'SOLEMN KYOTO', 'SLIGHTLY TIPSY ROME'],
    'VAPOR LONDON': ['ROCK', 'EMO', 'CHAMPS-ÉLYSÉES', 'NEW YORK'],
    'SLIGHTLY TIPSY ROME': ['CROONER', 'CHAMPS-ÉLYSÉES', 'JAZZ', 'MIRACULOUS LUOYANG'],
    'CHAMPS-ÉLYSÉES': ['SLIGHTLY TIPSY ROME', 'VAPOR LONDON', 'CROONER', 'NEW YORK'],
    'MENACING DUBAI': ['BUSTLING HONG KONG', 'VAPOR LONDON', 'ROCK'],
    'VANCOUVER': ['LO-FI', 'POEM', 'TAIPEI DREAM', 'TROPICAL HAWAII'],
    'NEW YORK': ['JAZZ', 'BUSTLING HONG KONG', 'CHAMPS-ÉLYSÉES', 'SPORT'],
    'TROPICAL HAWAII': ['VANCOUVER', 'PSYCHEDELIC LA', 'SPORT'],
    'PSYCHEDELIC LA': ['TROPICAL HAWAII', 'OLD TOKYO', 'VAPOR LONDON', 'ROCK'],
    /* literature reads well next to its neighbours in mood and era */
    'DREAM OF THE RED CHAMBER': ['TAIPEI PEOPLE', 'IN SEARCH OF THE SUPERNATURAL', 'THE GOLDEN CANGUE'],
    'THE GOLDEN CANGUE': ['LOVE IN A FALLEN CITY', 'JOURNEY UNDER THE MIDNIGHT SUN', 'TAIPEI PEOPLE'],
    'LOVE IN A FALLEN CITY': ['THE GOLDEN CANGUE', 'TAIPEI PEOPLE', 'PRIDE AND PREJUDICE'],
    'TAIPEI PEOPLE': ['LOVE IN A FALLEN CITY', 'DREAM OF THE RED CHAMBER', 'CALL TO ARMS'],
    'CALL TO ARMS': ['A TALE OF TWO CITIES', 'TAIPEI PEOPLE', 'THE GOLDEN CANGUE'],
    'JOURNEY UNDER THE MIDNIGHT SUN': ['THE GOLDEN CANGUE', 'IN SEARCH OF THE SUPERNATURAL', 'ROBINSON CRUSOE'],
    'IN SEARCH OF THE SUPERNATURAL': ['DREAM OF THE RED CHAMBER', 'JOURNEY UNDER THE MIDNIGHT SUN', 'ROBINSON CRUSOE'],
    'ROBINSON CRUSOE': ['PRIDE AND PREJUDICE', 'IN SEARCH OF THE SUPERNATURAL', 'A TALE OF TWO CITIES'],
    'PRIDE AND PREJUDICE': ['ROBINSON CRUSOE', 'LOVE IN A FALLEN CITY', 'A TALE OF TWO CITIES'],
    'A TALE OF TWO CITIES': ['CALL TO ARMS', 'PRIDE AND PREJUDICE', 'ROBINSON CRUSOE']
  };
  /* what tends to suit each part of the day */
  const DAYPART = {
    morning: ['RUNNING', 'SPORT', 'TROPICAL HAWAII', 'VANCOUVER', 'POEM', 'TAIPEI DREAM', 'ROBINSON CRUSOE', 'PRIDE AND PREJUDICE'],
    day: ['TAIPEI DREAM', 'OLD TOKYO', 'CHAMPS-ÉLYSÉES', 'PSYCHEDELIC LA', 'TROPICAL HAWAII', 'ROCK'],
    evening: ['NEW YORK', 'SPLENDOR SHANGHAI', 'BUSTLING HONG KONG', 'CROONER', 'VAPOR LONDON', 'SLIGHTLY TIPSY ROME', 'LOVE IN A FALLEN CITY', 'TAIPEI PEOPLE'],
    night: ['JAZZ', 'LO-FI', 'VAPOR LONDON', 'CROONER', 'POEM', 'SOLEMN KYOTO', 'MENACING DUBAI', 'DREAM OF THE RED CHAMBER', 'JOURNEY UNDER THE MIDNIGHT SUN', 'THE GOLDEN CANGUE'],
    late: ['LO-FI', 'JAZZ', 'POEM', 'SOLEMN KYOTO', 'VANCOUVER', 'IN SEARCH OF THE SUPERNATURAL', 'JOURNEY UNDER THE MIDNIGHT SUN']
  };
  const tagSet = t => new Set(vibeTags(t).map(norm));
  const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n / (a.size + b.size - n); };
  const num = v => (v == null || v === '' || !Number.isFinite(+v)) ? null : +v;

  function score(t, ctx = {}) {
    if (!t || Dislikes.has(t)) return -Infinity;
    const rk = recKey(t);
    if (ctx.exclude && ctx.exclude.has(rk)) return -Infinity;
    let s = 0;
    const recent = ctx.recent || Stats.recentRecs(50);
    const ri = recent.indexOf(rk); if (ri >= 0) s -= 9 * (1 - ri / 60);
    s -= Math.min(9, Stats.skips(rk) * 3);
    const th = themeOf(t);
    if (ctx.seed) {
      const sd = ctx.seed; const sth = themeOf(sd);
      s += 7 * jaccard(tagSet(t), ctx.seedTags || tagSet(sd));
      if (th && sth) s += th.t === sth.t ? 3 : (NEAR[sth.t] || []).includes(th.t) ? 1.6 : 0;
      const b1 = num(t.bpm), b2 = num(sd.bpm); if (b1 && b2) s -= Math.min(4, Math.abs(b1 - b2) / 18);
      const e1 = num(t.energy), e2 = num(sd.energy); if (e1 != null && e2 != null) s -= Math.min(3, Math.abs(e1 - e2) / 22);
      if (norm(t.artist) === norm(sd.artist)) s -= 2.5;
    }
    if (ctx.lastArtists && ctx.lastArtists.includes(norm(t.artist))) s -= 4;
    s += Math.min(4, Stats.artistAffinity(t.artist) * .25);
    if (th) s += Math.min(3, Stats.themeAffinity(th.t) * .15);
    if (Library.isFav(t)) s += ctx.favBoost ?? .8;
    if (ctx.daypart && th && DAYPART[ctx.daypart]?.includes(th.t)) s += 2.2;
    s += (ctx.rand || Math.random)() * (ctx.noise ?? 2.4);
    return s;
  }

  /* weighted sample without replacement, one song per recording, artist spread */
  function pick(pool, n, ctx = {}) {
    const rand = ctx.rand || Math.random;
    const scored = pool.map(t => ({ t, s: score(t, { ...ctx, rand }) })).filter(x => Number.isFinite(x.s)).sort((a, b) => b.s - a.s);
    const out = [], recs = new Set(ctx.exclude || []), artists = [];
    let cand = scored.slice(0, Math.max(n * 6, 30));
    while (out.length < n && cand.length) {
      const max = cand[0].s; const temp = ctx.temp ?? 2.2;
      const w = cand.map(x => Math.exp((x.s - max) / temp) * (artists.slice(-2).includes(norm(x.t.artist)) ? .25 : 1));
      let r = rand() * w.reduce((a, b) => a + b, 0), i = 0;
      for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
      const x = cand.splice(i, 1)[0]; const rk = recKey(x.t);
      if (recs.has(rk)) continue;
      recs.add(rk); artists.push(norm(x.t.artist)); out.push(x.t);
    }
    return out;
  }

  /* 換一組 5 首 — fresh five from one theme */
  function drawFive(th, shown = []) {
    const exclude = new Set(shown.map(recKey));
    let five = pick(th.tracks, 5, { exclude, noise: 3.2, favBoost: .3 });
    if (five.length < 5) five = five.concat(pick(th.tracks, 5 - five.length, { exclude: new Set(five.map(recKey)), noise: 3 }));
    return five;
  }

  /* when the queue runs out: keep the mood going */
  function radio(seed, n = 10, { avoid = [] } = {}) {
    if (!seed) return pick(ALL_TRACKS, n, { daypart: partOfDay() });
    const sth = themeOf(seed);
    const pool = [];
    if (sth) pool.push(...sth.tracks, ...(NEAR[sth.t] || []).flatMap(n => THEME_BY_T.get(n)?.tracks || []));
    else pool.push(...ALL_TRACKS);
    const exclude = new Set([recKey(seed), ...avoid.map(recKey), ...Stats.recentRecs(25)]);
    let out = pick(pool, n, { seed, seedTags: tagSet(seed), exclude, noise: 2, lastArtists: [norm(seed.artist)] });
    if (out.length < n) out = out.concat(pick(ALL_TRACKS, n - out.length, { exclude: new Set([...exclude, ...out.map(recKey)]) }));
    return out;
  }

  /* home: a daily edit that stays stable for the day */
  function todaysEdit(n = 6) {
    const day = new Date().toISOString().slice(0, 10);
    const rand = seeded(`edit-${day}-${Stats.totalPlays > 10 ? Math.floor(Stats.totalPlays / 10) : 0}`);
    const dp = partOfDay();
    const pool = ALL_TRACKS.filter(t => !themeOf(t)?.data.archiveEdit || dp === 'night');
    return pick(pool.length ? pool : ALL_TRACKS, n, { daypart: dp, rand, noise: 3, exclude: new Set(Stats.recentRecs(12)) });
  }

  /* themes ranked for this listener right now */
  function themesForNow(limit = 6) {
    const dp = partOfDay();
    return THEMES.filter(t => t.tracks.length).map(th => {
      let s = Stats.themeAffinity(th.t) * .6 + (DAYPART[dp].includes(th.t) ? 3 : 0) + seeded(th.t + new Date().toDateString())() * 2;
      if (Stats.recentThemes()[0] === th.t) s -= 2;
      return { th, s };
    }).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.th);
  }

  /* shuffle that never puts the same recording or artist back to back */
  function smartShuffle(list, keepFirst = null) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    if (keepFirst) { const i = arr.indexOf(keepFirst); if (i > 0) { arr.splice(i, 1); arr.unshift(keepFirst); } }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < arr.length; i++) {
      if (norm(arr[i].artist) !== norm(arr[i - 1].artist) && recKey(arr[i]) !== recKey(arr[i - 1])) continue;
      for (let j = i + 1; j < arr.length; j++) {
        if (norm(arr[j].artist) !== norm(arr[i - 1].artist) && (j + 1 >= arr.length || norm(arr[j + 1]?.artist) !== norm(arr[i].artist))) { [arr[i], arr[j]] = [arr[j], arr[i]]; break; }
      }
    }
    // drop duplicate recordings (same song filed under two themes)
    const seen = new Set(); return arr.filter(t => { const k = recKey(t); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  /* a few tracks for a landmark ticket, stable per landmark */
  function forLandmark(lm, n = 5) {
    const th = THEME_BY_T.get(lm.theme); if (!th) return [];
    return pick(th.tracks, n, { rand: seeded(lm.id), noise: 6, favBoost: 0, recent: [] });
  }

  return { drawFive, radio, todaysEdit, themesForNow, smartShuffle, forLandmark, NEAR };
})();
