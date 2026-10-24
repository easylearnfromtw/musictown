'use strict';
const {
  HttpError, respond, failure, method, parseBody, db, userFor,
  id, text, allowedDomains, SHARED_API_KEY, ATTRIBUTION
} = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    method(req, ['GET', 'POST', 'DELETE']);
    const user = await userFor(req);
    const owner = 'user_id=eq.' + encodeURIComponent(user.id);
    if (req.method === 'GET') {
      const integrations = await db('citymus_integrations?' + owner +
        '&revoked_at=is.null&select=id,name,playlist_id,allowed_domains,terms_accepted_at,created_at' +
        '&order=created_at.desc&limit=25');
      return respond(res, 200, { sharedApiKey: SHARED_API_KEY, integrations, attribution: ATTRIBUTION });
    }
    if (req.method === 'DELETE') {
      const integrationId = id(req.query?.id);
      await db('citymus_integrations?id=eq.' + encodeURIComponent(integrationId) + '&' + owner,
        { method: 'PATCH', body: { revoked_at: new Date().toISOString() } });
      return respond(res, 200, { ok: true });
    }
    const body = parseBody(req);
    if (body.accept_attribution !== true)
      throw new HttpError(400, 'You must accept the CITYMUS attribution requirement');
    const allowed = allowedDomains(body.allowed_domains);
    if (allowed.length === 0)
      throw new HttpError(400, 'At least one authorized HTTPS website origin is required');
    const pid = id(body.playlist_id);
    const playlist = await db('citymus_playlists?id=eq.' + encodeURIComponent(pid) + '&' +
      owner + '&select=id&limit=1');
    if (!playlist.length) throw new HttpError(404, 'Playlist not found');
    const existing = await db('citymus_integrations?' + owner + '&revoked_at=is.null&select=id&limit=11');
    if (existing.length >= 10) throw new HttpError(400, 'Maximum 10 active integrations per account');
    const rows = await db('citymus_integrations', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        user_id: user.id,
        playlist_id: pid,
        name: text(body.name || 'My website', 80) || 'My website',
        allowed_domains: allowed,
        terms_accepted_at: new Date().toISOString(),
        terms_version: 'citymus-attribution-v1'
      }
    });
    return respond(res, 201, {
      id: rows[0].id, sharedApiKey: SHARED_API_KEY, attribution: ATTRIBUTION,
      message: 'CITYMUS integration bound to this account and the authorized origin.'
    });
  } catch (e) { return failure(res, e); }
};
