'use strict';
const SHARED_API_KEY = 'cm_public_v1';
const ATTRIBUTION = Object.freeze({ required: true, label: 'Powered by CITYMUS', url: 'https://easylearnfromtw.github.io/musictown/' });

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function env(name) {
  const value = process.env[name];
  if (!value) throw new HttpError(503, 'CITYMUS backend is not configured: ' + name);
  return value;
}
function config() {
  return {
    url: env('SUPABASE_URL').replace(/\/+$/, ''),
    publicKey: env('SUPABASE_ANON_KEY'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY')
  };
}
function respond(res, status, payload, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(extraHeaders || {})) res.setHeader(key, value);
  return res.end(JSON.stringify(payload));
}
function failure(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  if (status === 500) console.error('CITYMUS API failure:', error);
  return respond(res, status, { error: status === 500 ? 'Internal server error' : error.message });
}
function method(req, allowed) {
  if (!allowed.includes(req.method)) throw new HttpError(405, 'Method not allowed');
}
function parseBody(req) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (raw.length > 45000) throw new HttpError(413, 'Request too large');
  let body;
  try { body = JSON.parse(raw); } catch (_) { throw new HttpError(400, 'Invalid JSON'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400, 'Invalid object');
  return body;
}
async function db(path, opts) {
  const cfg = config();
  const request = opts || {};
  const headers = {
    apikey: cfg.serviceKey,
    Authorization: 'Bearer ' + cfg.serviceKey,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (request.prefer) headers.Prefer = request.prefer;
  const response = await fetch(cfg.url + '/rest/v1/' + path, {
    method: request.method || 'GET',
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    console.error('CITYMUS database error', response.status, await response.text());
    throw new HttpError(502, 'Database request failed');
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}
async function userFor(req) {
  const token = /^Bearer (.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
  if (!token || token.length > 4096) throw new HttpError(401, 'Sign in required');
  const cfg = config();
  const result = await fetch(cfg.url + '/auth/v1/user', {
    headers: { apikey: cfg.publicKey, Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(10000)
  });
  if (!result.ok) throw new HttpError(401, 'Session expired');
  const user = await result.json();
  if (!/^[0-9a-f-]{36}$/i.test(String(user.id || ''))) throw new HttpError(401, 'Invalid user');
  return user;
}
function id(raw) {
  const value = String(raw || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new HttpError(400, 'Invalid resource ID');
  return value;
}
function text(raw, length) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, length);
}
function audioUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 1800) throw new HttpError(400, 'Invalid audio URL');
  let url;
  try { url = new URL(raw); } catch (_) { throw new HttpError(400, 'Invalid audio URL'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.includes('.') || /(^localhost$|\.localhost$|\.local$|\.internal$|\.test$)/i.test(url.hostname) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(':'))
    throw new HttpError(400, 'Only public HTTPS audio sources are supported');
  if (!/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:$|[?#])/i.test(url.pathname + url.search))
    throw new HttpError(400, 'Audio URL must point directly to a supported sound file');
  return url.href;
}
function playlistPayload(body) {
  const name = text(body.name, 90);
  if (!name) throw new HttpError(400, 'Playlist name is required');
  if (!Array.isArray(body.tracks) || body.tracks.length > 40)
    throw new HttpError(400, 'A playlist may contain up to 40 tracks');
  return {
    name,
    description: text(body.description || '', 400),
    tracks: body.tracks.map(t => {
      if (!t || typeof t !== 'object') throw new HttpError(400, 'Invalid track');
      const title = text(t.title, 120);
      if (!title) throw new HttpError(400, 'Track title required');
      return { title, artist: text(t.artist || '', 100), url: audioUrl(t.url) };
    }),
    updated_at: new Date().toISOString()
  };
}
function allowedDomains(domains) {
  if (domains === undefined || domains === null) return [];
  if (!Array.isArray(domains) || domains.length > 10) throw new HttpError(400, 'Up to 10 allowed origins');
  return Array.from(new Set(domains.map(value => {
    if (typeof value !== 'string') throw new HttpError(400, 'Invalid domain');
    let url;
    try { url = new URL(value); } catch (_) { throw new HttpError(400, 'Use full HTTPS origins, e.g. https://example.com'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' ||
        url.search || url.hash || !url.hostname.includes('.') || url.hostname.includes('*'))
      throw new HttpError(400, 'Allowed domains must be HTTPS origins');
    return url.origin;
  })));
}
function sharedApiKey(req) {
  const supplied = req.query?.api_key;
  if (typeof supplied !== 'string' || supplied !== SHARED_API_KEY)
    throw new HttpError(401, 'Invalid CITYMUS public API identifier');
  return SHARED_API_KEY;
}
async function publicPlaylist(req) {
  sharedApiKey(req);
  const integrationId = id(req.query?.integration);
  const rows = await db('citymus_integrations?id=eq.' + encodeURIComponent(integrationId) +
    '&revoked_at=is.null&select=id,user_id,playlist_id,allowed_domains,terms_accepted_at&limit=1');
  if (!rows.length || !rows[0].terms_accepted_at)
    throw new HttpError(404, 'Integration not found or revoked');
  const row = rows[0];
  const playlists = await db('citymus_playlists?id=eq.' + encodeURIComponent(row.playlist_id) +
    '&user_id=eq.' + encodeURIComponent(row.user_id) + '&select=name,description,tracks&limit=1');
  if (!playlists.length) throw new HttpError(404, 'Playlist unavailable');
  return { playlist: playlists[0], allowedDomains: row.allowed_domains || [], attribution: ATTRIBUTION };
}

module.exports = {
  HttpError, env, respond, failure, method, parseBody, db, userFor,
  id, text, playlistPayload, allowedDomains, sharedApiKey, SHARED_API_KEY, ATTRIBUTION, publicPlaylist
};
