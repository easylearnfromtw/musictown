'use strict';
const { env, respond, failure, method } = require('../lib/citymus-backend');
module.exports = async (req, res) => {
  try {
    method(req, ['GET']);
    return respond(res, 200, {
      supabaseUrl: env('SUPABASE_URL'),
      supabaseAnonKey: env('SUPABASE_ANON_KEY')
    });
  } catch (e) { return failure(res, e); }
};
