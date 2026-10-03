'use strict';

const { Readable } = require('node:stream');
const library = require('../data/legal_music_library.json');

const rows = Array.isArray(library) ? library : (library.tracks || []);
const allowed = new Set();
const AUDIO_EXT = /\.(?:mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:$|[?#])/i;

function add(raw) {
  if (!raw) return;
  try {
    const u = new URL(String(raw));
    if (!/^https?:$/.test(u.protocol)) return;
    if (['localhost','127.0.0.1','::1'].includes(u.hostname)) return;
    allowed.add(u.href);
  } catch (_) {}
}
for (const t of rows) {
  add(t.download);
  if (t.source && AUDIO_EXT.test(t.source)) add(t.source);
  const m = String(t.embed || t.source || '').match(/nullrights\.com\/track\/([^/?#]+)/i);
  if (m) add('https://nullrights.com/audio/' + encodeURIComponent(m[1]));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range,If-Range,If-None-Match,If-Modified-Since');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag,Last-Modified,X-CITYMUS-Proxy');
  res.setHeader('X-CITYMUS-Proxy', '1');
}
function isAllowed(target) {
  if (allowed.has(target.href)) return true;
  // CJK supplement is generated at deploy time. Restrict its fallback to
  // Wikimedia's immutable upload host and audio-looking paths only.
  return target.hostname === 'upload.wikimedia.org' && AUDIO_EXT.test(target.pathname);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.query?.health === '1') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true, service: 'CITYMUS audio proxy', allowlist: allowed.size }));
  }
  if (!['GET','HEAD'].includes(req.method)) {
    res.statusCode = 405; return res.end('Method not allowed');
  }

  let target;
  try {
    const raw = Array.isArray(req.query?.u) ? req.query.u[0] : req.query?.u;
    target = new URL(String(raw || ''));
  } catch (_) {
    res.statusCode = 400; return res.end('Bad audio URL');
  }
  if (!/^https?:$/.test(target.protocol) || !isAllowed(target)) {
    res.statusCode = 403; return res.end('Audio source is not in the CITYMUS allowlist');
  }

  const headers = {
    'User-Agent': 'CITYMUS-Audio-Proxy/1.0',
    'Accept': req.headers.accept || 'audio/*,*/*;q=0.8'
  };
  for (const h of ['range','if-range','if-none-match','if-modified-since']) {
    if (req.headers[h]) headers[h.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('-')] = req.headers[h];
  }

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 25000);
  req.on('close', () => ac.abort());

  try {
    const upstream = await fetch(target, { method: req.method, headers, redirect: 'follow', signal: ac.signal });
    clearTimeout(timeout);
    res.statusCode = upstream.status;

    for (const h of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']) {
      const v = upstream.headers.get(h); if (v) res.setHeader(h, v);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

    if (req.method === 'HEAD' || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body).on('error', () => { try { res.end(); } catch (_) {} }).pipe(res);
  } catch (e) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.statusCode = e?.name === 'AbortError' ? 504 : 502;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(e?.name === 'AbortError' ? 'Upstream audio timeout' : 'Upstream audio unavailable');
    } else {
      try { res.end(); } catch (_) {}
    }
  }
};
