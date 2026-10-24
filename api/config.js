'use strict';
const { env, respond, failure, method, SHARED_API_KEY, ATTRIBUTION } = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    method(req, ['GET']);
    return respond(res, 200, {
      supabaseUrl: env('SUPABASE_URL'),
      supabaseAnonKey: env('SUPABASE_ANON_KEY'),
      sharedApiKey: SHARED_API_KEY,
      attribution: ATTRIBUTION
    });
  } catch (e) { return failure(res, e); }
};
