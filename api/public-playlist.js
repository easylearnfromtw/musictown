'use strict';
const { HttpError, respond, failure, method, publicPlaylist } = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    method(req, ['GET']);
    const result = await publicPlaylist(req);
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin) {
      if (!result.allowedDomains.includes(origin))
        throw new HttpError(403, 'This website origin is not authorized for the integration');
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    return respond(res, 200, {
      name: result.playlist.name,
      description: result.playlist.description,
      tracks: result.playlist.tracks,
      attribution: result.attribution
    });
  } catch (e) { return failure(res, e); }
};
