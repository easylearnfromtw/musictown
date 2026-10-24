'use strict';
const crypto = require('node:crypto');
const {
  HttpError, respond, failure, method, parseBody, db, userFor,
  id, text, allowedDomains, keyDigest
} = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    method(req, ['GET', 'POST', 'DELETE']);
    const user = await userFor(req);
    const owner = 'user_id=eq.' + encodeURIComponent(user.id);
    if (req.method === 'GET') {
      const keys = await db('citymus_embed_keys?' + owner +
        '&revoked_at=is.null&select=id,name,key_prefix,playlist_id,allowed_domains,created_at' +
        '&order=created_at.desc&limit=25');
      return respond(res, 200, { keys });
    }
    if (req.method === 'DELETE') {
      await db('citymus_embed_keys?id=eq.' + encodeURIComponent(id(req.query?.id)) + '&' + owner,
        { method: 'PATCH', body: { revoked_at: new Date().toISOString() } });
      return respond(res, 200, { ok: true });
    }
    const body = parseBody(req);
    const pid = id(body.playlist_id);
    const playlist = await db('citymus_playlists?id=eq.' + encodeURIComponent(pid) + '&' +
      owner + '&select=id&limit=1');
    if (!playlist.length) throw new HttpError(404, 'Playlist not found');
    const existing = await db('citymus_embed_keys?' + owner + '&revoked_at=is.null&select=id&limit=11');
    if (existing.length >= 10) throw new HttpError(400, 'Maximum 10 active keys per account');
    const key = 'cm_pub_' + crypto.randomBytes(32).toString('base64url');
    const rows = await db('citymus_embed_keys', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        user_id: user.id,
        playlist_id: pid,
        name: text(body.name || 'My website', 80) || 'My website',
        key_prefix: key.slice(0, 17),
        key_hash: keyDigest(key),
        allowed_domains: allowedDomains(body.allowed_domains)
      }
    });
    return respond(res, 201, {
      key, id: rows[0].id, key_prefix: rows[0].key_prefix,
      message: 'Save this publishable key now. It cannot be displayed again.'
    });
  } catch (e) { return failure(res, e); }
};
