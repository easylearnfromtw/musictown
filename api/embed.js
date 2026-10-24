'use strict';
const { failure, method, publicPlaylist } = require('../lib/citymus-backend');
function jsonSafe(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
module.exports = async (req, res) => {
  try {
    method(req, ['GET']);
    const result = await publicPlaylist(req);
    const ancestors = result.allowedDomains.length ?
      "'self' " + result.allowedDomains.join(' ') : '*';
    res.setHeader('Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; " +
      "media-src https:; img-src https: data:; base-uri 'none'; object-src 'none'; " +
      'frame-ancestors ' + ancestors);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    return res.end([
      '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>CITYMUS Player</title><style>',
      '*{box-sizing:border-box}body{margin:0;background:#111522;color:#f7f8fc;',
      'font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.wrap{padding:17px;max-width:760px;margin:auto}',
      '.brand{font-size:10px;letter-spacing:.22em;color:#95a7dc;font-weight:800}',
      'h1{margin:11px 0 4px;font-size:21px;overflow-wrap:anywhere}',
      '#artist{color:#b0bad4;font-size:13px;min-height:19px}',
      'audio{width:100%;margin:18px 0 8px;accent-color:#a0adff}',
      '.tracks{max-height:200px;overflow:auto;display:grid;gap:5px}',
      'button{border:1px solid #2d344b;background:#20263a;color:#f8f9ff;',
      'width:100%;border-radius:11px;text-align:left;padding:11px;cursor:pointer}',
      'button.active{border-color:#9aabff;background:#303a5c}',
      'small{display:block;color:#b0bad4;margin-top:3px}</style></head><body>',
      '<div class="wrap"><div class="brand">CITYMUS · EMBED</div>',
      '<h1 id="title"></h1><div id="artist"></div>',
      '<audio id="player" controls preload="none"></audio><div class="tracks" id="tracks"></div></div>',
      '<script id="playlist-data" type="application/json">',
      jsonSafe(result.playlist),
      '</script><script defer src="/studio/embed-player.js"></script></body></html>'
    ].join(''));
  } catch (e) { return failure(res, e); }
};
