'use strict';
const { respond, failure, method, publicPlaylist } = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    method(req, ['GET']);
    const result = await publicPlaylist(req);
    return respond(res, 200, {
      name: result.playlist.name,
      description: result.playlist.description,
      tracks: result.playlist.tracks
    });
  } catch (e) { return failure(res, e); }
};
