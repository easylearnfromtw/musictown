'use strict';
const {
  HttpError, respond, failure, method, parseBody, db, userFor, id, playlistPayload
} = require('../lib/citymus-backend');
const TABLE = 'citymus_playlists';
module.exports = async (req, res) => {
  try {
    method(req, ['GET', 'POST', 'PATCH', 'DELETE']);
    const user = await userFor(req);
    const ownerFilter = 'user_id=eq.' + encodeURIComponent(user.id);
    if (req.method === 'GET') {
      const rows = await db(TABLE + '?' + ownerFilter +
        '&select=id,name,description,tracks,created_at,updated_at&order=updated_at.desc&limit=25');
      return respond(res, 200, { playlists: rows });
    }
    if (req.method === 'POST') {
      const existing = await db(TABLE + '?' + ownerFilter + '&select=id&limit=13');
      if (existing.length >= 12) throw new HttpError(400, 'Maximum 12 playlists per account');
      const body = playlistPayload(parseBody(req));
      const rows = await db(TABLE, { method: 'POST', body: { ...body, user_id: user.id }, prefer: 'return=representation' });
      return respond(res, 201, { playlist: rows[0] });
    }
    const pid = id(req.query?.id);
    const path = TABLE + '?id=eq.' + encodeURIComponent(pid) + '&' + ownerFilter;
    if (req.method === 'DELETE') {
      await db(path, { method: 'DELETE' });
      return respond(res, 200, { ok: true });
    }
    const rows = await db(path, {
      method: 'PATCH', body: playlistPayload(parseBody(req)), prefer: 'return=representation'
    });
    if (!rows.length) throw new HttpError(404, 'Playlist not found');
    return respond(res, 200, { playlist: rows[0] });
  } catch (e) { return failure(res, e); }
};
