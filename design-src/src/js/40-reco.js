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
  /* CITYMUS weighted ranking model.
     The seven weights intentionally sum to 1.0 so tuning stays legible:
     Theme 30% · Mood 20% · Energy 15% · Vocal 10% · Sequence 10% ·
     Novelty 10% · City 5%. Behavioural affinity and explicit penalties
     sit outside the fit vector so skips/dislikes can still veto a match. */
  const WEIGHTS = Object.freeze({
    theme: .30, mood: .20, energy: .15, vocal: .10,
    sequence: .10, novelty: .10, city: .05
  });
  const tagSet = t => new Set(vibeTags(t).map(norm));
  const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n / (a.size + b.size - n); };
  const num = v => (v == null || v === '' || !Number.isFinite(+v)) ? null : +v;
  const textOf = t => {
    const th = themeOf(t);
    return [t?.vibe, t?.genre, t?.note, th?.t, th?.name, th?.cn].filter(Boolean).join(' ').toLowerCase();
  };
  const tokenSet = t => new Set(textOf(t).split(/[\\s·,;:/|()[\\]{}_-]+/).map(norm).filter(x => x && x.length > 1));

  function moodFit(t, seed) {
    if (!seed) return .5;
    const coarse = jaccard(tagSet(t), tagSet(seed));
    const fine = jaccard(tokenSet(t), tokenSet(seed));
    return clamp(Math.max(coarse, fine * .82), 0, 1);
  }
  function energy01(t) {
    const e = num(t?.energy);
    if (e != null) return clamp(e > 1 ? e / 100 : e, 0, 1);
    const bpm = num(t?.bpm);
    if (bpm != null) return clamp((bpm - 58) / 112, 0, 1);
    const h = textOf(t);
    if (/high energy|running|sport|workout|upbeat|fast|punk|rock|drive|pulse|hype|dance/.test(h)) return .82;
    if (/slow|soft|ambient|ballad|lo-fi|dream|quiet|gentle|study|solemn/.test(h)) return .28;
    return .5;
  }
  function vocal01(t) {
    const v = num(t?.vocal);
    if (v != null) return clamp(v > 1 ? v / 100 : v, 0, 1);
    if (t?.instrumental === true) return .05;
    const h = textOf(t);
    if (/instrumental|ambient|soundscape|score|orchestral|piano|strings|synthwave/.test(h) && !/vocal|singer|voice|crooner/.test(h)) return .16;
    if (/vocal|singer|songwriter|crooner|chanson|ballad|acapella|soul|rap|hip.?hop|voice/.test(h)) return .88;
    return .5;
  }
  function activeCityTheme() {
    try { return Geo?.theme || null; } catch (_) { return null; }
  }
  function themeFit(t, ctx) {
    const th = themeOf(t); if (!th) return .35;
    const target = ctx.targetTheme || themeOf(ctx.seed)?.t || null;
    if (target) {
      if (th.t === target) return 1;
      if ((NEAR[target] || []).includes(th.t)) return .62;
      return .12;
    }
    if (ctx.daypart && DAYPART[ctx.daypart]?.includes(th.t)) return .78;
    return .5;
  }
  function sequenceFit(t, seed) {
    if (!seed) return .5;
    const e = 1 - Math.abs(energy01(t) - energy01(seed));
    const b1 = num(t?.bpm), b2 = num(seed?.bpm);
    const bpm = (b1 != null && b2 != null) ? 1 - clamp(Math.abs(b1 - b2) / 72, 0, 1) : e;
    const artist = norm(t?.artist) === norm(seed?.artist) ? .08 : 1;
    return clamp(e * .45 + bpm * .35 + artist * .20, 0, 1);
  }
  function noveltyFit(t, recent) {
    const rk = recKey(t), ri = recent.indexOf(rk);
    const freshness = ri < 0 ? 1 : clamp(ri / Math.max(1, recent.length - 1), .04, .82);
    const history = 1 / (1 + Stats.plays(rk) * .18);
    return clamp(freshness * .78 + history * .22, 0, 1);
  }
  function cityFit(t, ctx) {
    if (ctx.cityAware === false) return .5;
    const city = ctx.cityTheme || activeCityTheme();
    if (!city) return .5;
    return themeOf(t)?.t === city ? 1 : .35;
  }

  function scoreParts(t, ctx = {}) {
    if (!t || Dislikes.has(t)) return { total: -Infinity };
    const rk = recKey(t);
    if (ctx.exclude && ctx.exclude.has(rk)) return { total: -Infinity };

    const recent = ctx.recent || Stats.recentRecs(50);
    const th = themeOf(t), seed = ctx.seed || null;
    const fit = {
      theme: themeFit(t, ctx),
      mood: moodFit(t, seed),
      energy: seed ? 1 - Math.abs(energy01(t) - energy01(seed)) : .5,
      vocal: seed ? 1 - Math.abs(vocal01(t) - vocal01(seed)) : .5,
      sequence: sequenceFit(t, seed),
      novelty: noveltyFit(t, recent),
      city: cityFit(t, ctx)
    };
    const weighted = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + fit[k] * w, 0);

    let affinity = Math.min(2.5, Stats.artistAffinity(t.artist) * .18);
    if (th) affinity += Math.min(2.2, Stats.themeAffinity(th.t) * .12);
    if (Library.isFav(t)) affinity += ctx.favBoost ?? .8;
    if (ctx.daypart && th && DAYPART[ctx.daypart]?.includes(th.t)) affinity += .65;

    let penalty = 0;
    const ri = recent.indexOf(rk);
    if (ri >= 0) penalty += 4.6 * (1 - ri / Math.max(60, recent.length));
    penalty += Math.min(6, Stats.skips(rk) * 2);
    if (seed && norm(t.artist) === norm(seed.artist)) penalty += 2.4;
    if (ctx.lastArtists && ctx.lastArtists.includes(norm(t.artist))) penalty += 3.5;

    const random = (ctx.rand || Math.random)() * (ctx.noise ?? 1.8);
    const total = weighted * 12 + affinity - penalty + random;
    return { total, fit, weighted, affinity, penalty, random };
  }
  const score = (t, ctx = {}) => scoreParts(t, ctx).total;

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
    let five = pick(th.tracks, 5, { exclude, targetTheme: th.t, noise: 2.2, favBoost: .3, cityAware: true });
    if (five.length < 5) five = five.concat(pick(th.tracks, 5 - five.length, { exclude: new Set(five.map(recKey)), targetTheme: th.t, noise: 2.2, cityAware: true }));
    return five;
  }

  /* when the queue runs out: keep the mood going */
  function radio(seed, n = 10, { avoid = [] } = {}) {
    if (!seed) return pick(ALL_TRACKS, n, { daypart: partOfDay(), cityAware: true });
    const sth = themeOf(seed);
    const pool = [];
    if (sth) pool.push(...sth.tracks, ...(NEAR[sth.t] || []).flatMap(n => THEME_BY_T.get(n)?.tracks || []));
    else pool.push(...ALL_TRACKS);
    const exclude = new Set([recKey(seed), ...avoid.map(recKey), ...Stats.recentRecs(25)]);
    let out = pick(pool, n, { seed, seedTags: tagSet(seed), targetTheme: sth?.t || null, exclude, noise: 1.45, lastArtists: [norm(seed.artist)], cityAware: true });
    if (out.length < n) out = out.concat(pick(ALL_TRACKS, n - out.length, { exclude: new Set([...exclude, ...out.map(recKey)]) }));
    return out;
  }

  /* home: a daily edit that stays stable for the day */
  function todaysEdit(n = 6) {
    const day = new Date().toISOString().slice(0, 10);
    const rand = seeded(`edit-${day}-${Stats.totalPlays > 10 ? Math.floor(Stats.totalPlays / 10) : 0}`);
    const dp = partOfDay();
    const pool = ALL_TRACKS.filter(t => !themeOf(t)?.data.archiveEdit || dp === 'night');
    return pick(pool.length ? pool : ALL_TRACKS, n, { daypart: dp, rand, noise: 2.1, exclude: new Set(Stats.recentRecs(12)), cityAware: true });
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
    return pick(th.tracks, n, { rand: seeded(lm.id), targetTheme: lm.theme, cityTheme: lm.theme, noise: 3.6, favBoost: 0, recent: [], cityAware: true });
  }

  return { drawFive, radio, todaysEdit, themesForNow, smartShuffle, forLandmark, score, explain: scoreParts, WEIGHTS, NEAR };
})();
