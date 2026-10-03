/* ==========================================================================
   musicetown R11 · core utilities
   ========================================================================== */
const MT_BUILD = '__BUILD__';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const byId = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pad2 = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raf = () => new Promise(r => requestAnimationFrame(r));
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmtTime = sec => { sec = Number(sec); if (!Number.isFinite(sec) || sec < 0) sec = 0; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${pad2(s)}`; };
const hash32 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = seed => { let a = hash32(seed) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const IS_IOS = /iP(hone|ad|od)/.test(navigator.platform || '') || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const IS_SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
const STANDALONE = !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
document.documentElement.classList.toggle('is-ios', IS_IOS);
document.documentElement.classList.toggle('is-standalone', STANDALONE);
document.documentElement.classList.toggle('is-coarse', COARSE);

/* storage that never throws */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  raw(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  setRaw(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} }
};
const sess = {
  get(k, d = null) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};

/* tiny event bus */
const bus = (() => {
  const m = new Map();
  return {
    on(n, f) { if (!m.has(n)) m.set(n, new Set()); m.get(n).add(f); return () => m.get(n).delete(f); },
    emit(n, d) { (m.get(n) || []).forEach(f => { try { f(d); } catch (e) { console.warn('[bus]', n, e); } }); }
  };
})();

/* html → element */
function h(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; }

/* ---------- haptics: iOS 18 switch trick, vibrate elsewhere ---------- */
const haptic = (() => {
  let label = null;
  function ensure() {
    if (label) return label;
    const id = 'mt-haptic-switch';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.id = id; input.setAttribute('switch', '');
    input.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none;width:1px;height:1px';
    input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    label = document.createElement('label'); label.htmlFor = id;
    label.style.cssText = input.style.cssText;
    label.setAttribute('aria-hidden', 'true');
    document.body.append(input, label);
    return label;
  }
  return (kind = 'light') => {
    try {
      if (IS_IOS) { ensure().click(); if (kind === 'success') setTimeout(() => label.click(), 90); return; }
      if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [8, 40, 10] : kind === 'heavy' ? 14 : 6);
    } catch (_) {}
  };
})();

/* ---------- toast ---------- */
const toast = (() => {
  let timer = null;
  return (msg, { action = null, onAction = null, ms = 2200 } = {}) => {
    const el = byId('toast'); if (!el) return;
    clearTimeout(timer);
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
    if (action && onAction) el.querySelector('button').onclick = () => { onAction(); el.classList.remove('show'); };
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    timer = setTimeout(() => el.classList.remove('show'), ms);
  };
})();

/* ---------- body scroll lock (iOS safe) ---------- */
const scrollLock = (() => {
  let n = 0, y = 0;
  return {
    lock() {
      if (n++ > 0) return;
      y = window.scrollY;
      document.documentElement.classList.add('is-locked');
      document.body.style.top = `-${y}px`;
    },
    unlock() {
      if (n === 0 || --n > 0) return;
      document.documentElement.classList.remove('is-locked');
      document.body.style.top = '';
      window.scrollTo(0, y);
    },
    get locked() { return n > 0; }
  };
})();

/* ---------- icons (one consistent 24px stroke family) ---------- */
const ICONS = {
  play: '<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2A.8.8 0 0 0 8 5.8Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.6" y="5.5" width="3.6" height="13" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.8" y="5.5" width="3.6" height="13" rx="1.1" fill="currentColor" stroke="none"/>',
  next: '<path d="M5.5 6.6v10.8a.7.7 0 0 0 1.1.6l7.6-5.4a.7.7 0 0 0 0-1.2L6.6 6a.7.7 0 0 0-1.1.6Z" fill="currentColor" stroke="none"/><rect x="16" y="6" width="2.6" height="12" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18.5 6.6v10.8a.7.7 0 0 1-1.1.6l-7.6-5.4a.7.7 0 0 1 0-1.2L17.4 6a.7.7 0 0 1 1.1.6Z" fill="currentColor" stroke="none"/><rect x="5.4" y="6" width="2.6" height="12" rx="1" fill="currentColor" stroke="none"/>',
  shuffle: '<path d="M4 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H20"/><path d="M4 17h3.2c1.2 0 2.3-.5 3.1-1.3M13.7 8.3c.8-.8 1.9-1.3 3.1-1.3H20"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5"/>',
  repeat: '<path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19"/><path d="m16.5 4.5 2.5 2.5-2.5 2.5"/><path d="M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5"/><path d="M7.5 19.5 5 17l2.5-2.5"/>',
  repeatOne: '<path d="M5 11V9.5A2.5 2.5 0 0 1 7.5 7H19"/><path d="m16.5 4.5 2.5 2.5-2.5 2.5"/><path d="M19 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5"/><path d="M7.5 19.5 5 17l2.5-2.5"/><path d="M11.4 10.6 12.6 10v5" stroke-width="1.6"/>',
  heart: '<path d="M12 19.5s-7.2-4.3-7.2-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.2 2.3c0 5.3-7.2 9.6-7.2 9.6Z"/>',
  heartFill: '<path d="M12 19.5s-7.2-4.3-7.2-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.2 2.3c0 5.3-7.2 9.6-7.2 9.6Z" fill="currentColor"/>',
  more: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  down: '<path d="m6 9.5 6 6 6-6"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>',
  share: '<path d="M12 14.5V4"/><path d="m8.4 7.4 3.6-3.6 3.6 3.6"/><path d="M7.5 10.5H6.4c-.8 0-1.4.6-1.4 1.4v6.7c0 .8.6 1.4 1.4 1.4h11.2c.8 0 1.4-.6 1.4-1.4v-6.7c0-.8-.6-1.4-1.4-1.4h-1.1"/>',
  link: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h7"/><circle cx="4.8" cy="7" r=".9" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  queue: '<path d="M4 6h12M4 11h12M4 16h7"/><path d="M15 14.5v5l4-2.5-4-2.5Z" fill="currentColor"/>',
  ticket: '<path d="M4 8.2V6.5c0-.8.6-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5v1.7a2.5 2.5 0 0 0 0 4.6v4.7c0 .8-.7 1.5-1.5 1.5h-13c-.9 0-1.5-.7-1.5-1.5v-4.7a2.5 2.5 0 0 0 0-4.6Z"/><path d="M14.5 5.5v2M14.5 10.5v2M14.5 15.5v2" stroke-dasharray="0"/>',
  pin: '<path d="M12 20.5s6-5.6 6-10.4a6 6 0 0 0-12 0c0 4.8 6 10.4 6 10.4Z"/><circle cx="12" cy="10" r="2.2"/>',
  globe: '<circle cx="12" cy="12" r="8.4"/><ellipse cx="12" cy="12" rx="3.6" ry="8.4"/><path d="M3.8 12h16.4"/>',
  home: '<path d="M4.5 10.5 12 4.5l7.5 6V19a1 1 0 0 1-1 1h-4v-5.5h-5V20h-4a1 1 0 0 1-1-1Z"/>',
  board: '<rect x="3.5" y="5" width="17" height="14" rx="2.2"/><path d="M3.5 10h17M8.5 10v9"/>',
  library: '<rect x="4" y="4.5" width="4" height="15" rx="1"/><rect x="10" y="4.5" width="4" height="15" rx="1"/><path d="m16.2 5.4 3.6-.9 3 14.2-3.6.9Z" transform="translate(-2.4 .2)"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5.5 12h13"/>',
  check: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>',
  ban: '<circle cx="12" cy="12" r="8"/><path d="m6.4 6.4 11.2 11.2"/>',
  airplay: '<path d="M6 17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-1"/><path d="M12 14.5 16.5 20h-9Z" fill="currentColor"/>',
  headphones: '<path d="M4.5 15v-2.5a7.5 7.5 0 0 1 15 0V15"/><rect x="3.5" y="14" width="4" height="6" rx="1.4"/><rect x="16.5" y="14" width="4" height="6" rx="1.4"/>',
  source: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M17 13.5v4.5c0 .8-.7 1.5-1.5 1.5H6c-.8 0-1.5-.7-1.5-1.5V8.5C4.5 7.7 5.2 7 6 7h4.5"/>',
  download: '<path d="M12 4v11M7.8 11l4.2 4.2 4.2-4.2"/><path d="M5 19.5h14"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.8-4.8L7 19.5"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.4"/><path d="M3.5 10h17"/><path d="M6.5 6 15 3.6c.8-.2 1.6.3 1.8 1.1l.3 1.3"/>',
  edit: '<path d="M5 19h3.5L18.6 8.9a1.6 1.6 0 0 0 0-2.3l-1.2-1.2a1.6 1.6 0 0 0-2.3 0L5 15.5Z"/>',
  trash: '<path d="M5 7.5h14M10 7.5V5.5h4v2M7 7.5l.8 11c.1.8.7 1.5 1.5 1.5h5.4c.8 0 1.4-.7 1.5-1.5l.8-11"/>',
  folder: '<path d="M3.5 7.5c0-.8.7-1.5 1.5-1.5h4.3l2 2H19c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5Z"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  sparkle: '<path d="M12 3.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z"/>',
  settings: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3.8v2.1M12 18.1v2.1M20.2 12h-2.1M5.9 12H3.8M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5M17.8 17.8l-1.5-1.5M7.7 7.7 6.2 6.2"/>',
  vinyl: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/><path d="M7.6 9.6a5.2 5.2 0 0 1 2.2-2.3M16.4 14.4a5.2 5.2 0 0 1-2.2 2.3"/>',
  location: '<path d="m4 11 16-7-7 16-2-7Z"/>',
  phoneAdd: '<rect x="6.5" y="3" width="11" height="18" rx="2.4"/><path d="M12 8.6v6.8M8.6 12h6.8"/>',
  listAdd: '<path d="M4 6.5h11M4 11.5h11M4 16.5h6.5"/><path d="M17.5 13.5v6M14.5 16.5h6"/>',
  downloaded: '<circle cx="12" cy="12" r="8.4"/><path d="m8.4 12.2 2.5 2.5 4.8-5.1"/>',
  cloud: '<path d="M7.5 18.5h9.2a3.8 3.8 0 0 0 .5-7.6 5.3 5.3 0 0 0-10.2-1A4.3 4.3 0 0 0 7.5 18.5Z"/>',
  moon: '<path d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z"/>',
  book: '<path d="M5 5.5c2.7-.9 5.2-.6 7 1v13c-1.8-1.6-4.3-1.9-7-1Z"/><path d="M19 5.5c-2.7-.9-5.2-.6-7 1v13c1.8-1.6 4.3-1.9 7-1Z"/>',
  map: '<path d="m9 5-5 2v12l5-2 6 2 5-2V5l-5 2Z"/><path d="M9 5v12M15 7v12"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.2 4.6v4.2H15"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M18 14h2M14 18h2v2M18 18h2v2"/>'
};
function icon(name, cls = 'i') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.play}</svg>`;
}

/* globe brand mark (animated in a few places) */
function globeMark(cls = 'globe-mark') {
  return `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16.5"/><ellipse class="gm-m" cx="20" cy="20" rx="7" ry="16.5"/><ellipse class="gm-e" cx="20" cy="20" rx="16.5" ry="6.4"/><circle class="gm-dot" cx="20" cy="20" r="1.6"/></svg>`;
}

const fmtBytes = n => { n = Number(n) || 0; return n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB` : `${(n / 1073741824).toFixed(2)} GB`; };

/* copy with fallback */
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (_) {}
  const ta = document.createElement('textarea');
  ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove(); return ok;
}
async function nativeShare(data) {
  if (navigator.share) {
    try { await navigator.share(data); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'aborted'; }
  }
  if (data.url) { await copyText(data.url); toast('已複製連結'); return 'copied'; }
  return 'none';
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
function b64urlEncode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj)); let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  try {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s); return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch (_) { return null; }
}

/* press feedback: scale on every control without layout shift */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('button, [data-press], .row');
  if (!el || el.disabled) return;
  el.classList.add('is-pressed');
  const up = () => { el.classList.remove('is-pressed'); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
  window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
}, { passive: true });

function actionBurst(el, kind = 'spark', label = '') {
  if (!el) return;
  el.classList.remove('is-actioned'); void el.offsetWidth; el.classList.add('is-actioned');
  setTimeout(() => el.classList.remove('is-actioned'), 620);
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (!REDUCE) {
    try { el.animate([{ transform:'scale(1)' }, { transform:'scale(.84)' }, { transform:'scale(1.1)' }, { transform:'scale(1)' }], { duration:460, easing:'cubic-bezier(.2,.9,.2,1)' }); } catch (_) {}
    const layer = document.createElement('span'); layer.className = 'microburst microburst--' + kind; layer.style.left = x + 'px'; layer.style.top = y + 'px';
    const glyph = kind === 'heart' ? '♥' : kind === 'library' ? '+' : kind === 'share' ? '•' : '✦', count = kind === 'heart' ? 9 : kind === 'share' ? 6 : 8;
    for (let i=0;i<count;i++) { const p=document.createElement('i'), a=(Math.PI*2*i/count)-Math.PI/2, d=28+(i%3)*10; p.textContent=glyph; p.style.setProperty('--dx',Math.cos(a)*d+'px'); p.style.setProperty('--dy',Math.sin(a)*d+'px'); p.style.setProperty('--delay',(i*16)+'ms'); layer.appendChild(p); }
    document.body.appendChild(layer); setTimeout(()=>layer.remove(),820);
  }
  if (label) {
    document.querySelector('.action-feedback')?.remove();
    const note=document.createElement('span'); note.className='action-feedback action-feedback--'+kind; note.textContent=label;
    note.style.left=clamp(x,72,innerWidth-72)+'px'; note.style.top=Math.max(66,y-48)+'px';
    document.body.appendChild(note); setTimeout(()=>note.classList.add('is-in'),16); setTimeout(()=>note.remove(),1050);
  }
}
window.addEventListener('error', e => console.warn('[musicetown]', e?.error || e?.message));
