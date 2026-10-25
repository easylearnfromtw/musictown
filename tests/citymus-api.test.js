'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const getPlaylist = require('../api/public-playlist');
const embed = require('../api/embed');
const integrations = require('../api/integrations');

const USER = '01234567-89ab-4cde-8f01-23456789abcd';
const PLAYLIST = '11234567-89ab-4cde-8f01-23456789abcd';
const INTEGRATION = '21234567-89ab-4cde-8f01-23456789abcd';
const ALLOWED = 'https://my-blog.example';
process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-key-for-tests';

function response() {
  const headers = Object.create(null);
  return {
    headers, statusCode: 200, body: '',
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(body='') { this.body = String(body); return this; }
  };
}
function stubFetch() {
  let active = true;
  const calls = [];
  const original = global.fetch;
  global.fetch = async (input, options={}) => {
    const url = String(input);
    calls.push({ url, method: options.method || 'GET', body: options.body });
    let data;
    if (url.includes('/auth/v1/user')) {
      data = {id:USER,email:'member@example.com'};
    } else if (url.includes('/rest/v1/rpc/citymus_resolve_integration')) {
      data = active ? { playlist: {name:'Night City',description:'Evening mixes',tracks:[{title:'First',artist:'CITYMUS licensed artist',url:'https://cdn.example.com/first.mp3'}]},allowed_domains:[ALLOWED]} : null;
    } else if (url.includes('/rest/v1/citymus_integrations')) {
      if (options.method === 'PATCH') { active = false; data=[]; }
      else if (options.method === 'POST') data = [{ id: INTEGRATION }];
      else if (url.includes('id=eq.')) data = active
        ? [{id:INTEGRATION,user_id:USER,playlist_id:PLAYLIST,allowed_domains:[ALLOWED],terms_accepted_at:'2026-10-24T00:00:00Z'}]
        : [];
      else data = active ? [{id:INTEGRATION}] : [];
    } else if (url.includes('/rest/v1/citymus_playlists')) {
      data = [{
        id:PLAYLIST,name:'Night City',description:'Evening mixes',
        tracks:[{title:'First',artist:'CITYMUS licensed artist',url:'https://cdn.example.com/first.mp3'}]
      }];
    } else throw Error('Unexpected URL ' + url);
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  return { calls, restore() { global.fetch=original; } };
}
function apiRequest(method, query={}, extra={}) {
  return {method,query,headers:extra.headers || {},body:extra.body};
}
test('shared API key + active binding returns publicly attributed tracks', async () => {
  const mock=stubFetch();
  try {
    const good=response();
    await getPlaylist(apiRequest('GET',{api_key:'cm_public_v1',integration:INTEGRATION},
      {headers:{origin:ALLOWED}}),good);
    assert.equal(good.statusCode,200);
    assert.equal(good.headers['access-control-allow-origin'],ALLOWED);
    const result=JSON.parse(good.body);
    assert.equal(result.name,'Night City');
    assert.equal(result.attribution.required,true);
    assert.equal(result.attribution.label,'Powered by CITYMUS');
    const wrong=response();
    await getPlaylist(apiRequest('GET',{api_key:'cm_public_v1',integration:INTEGRATION},
      {headers:{origin:'https://unauthorized.example'}}),wrong);
    assert.equal(wrong.statusCode,403);
    assert.equal(wrong.headers['access-control-allow-origin'],undefined);
    const invalid=response();
    await getPlaylist(apiRequest('GET',{api_key:'wrong',integration:INTEGRATION}),invalid);
    assert.equal(invalid.statusCode,401);
  } finally { mock.restore(); }
});
test('iframe restricts frame ancestors and always contains branded source link', async () => {
  const mock=stubFetch();
  try {
    const res=response();
    await embed(apiRequest('GET',{api_key:'cm_public_v1',integration:INTEGRATION}),res);
    assert.equal(res.statusCode,200);
    assert.match(res.headers['content-security-policy'],/frame-ancestors 'self' https:\/\/my-blog\.example/);
    assert.match(res.body,/Powered by CITYMUS/);
    assert.match(res.body,/https:\/\/easylearnfromtw\.github\.io\/musictown\//);
    assert.match(res.body,/<script defer src="\/studio\/embed-player\.js"><\/script>/);
  } finally { mock.restore(); }
});
test('website registration requires explicit attribution acceptance; revocation disables access', async () => {
  const mock=stubFetch();
  try {
    const body={name:'Personal Blog',playlist_id:PLAYLIST,allowed_domains:[ALLOWED]};
    const rejected=response();
    await integrations(apiRequest('POST',{}, {headers:{authorization:'Bearer test-user-token'},body}),rejected);
    assert.equal(rejected.statusCode,400);
    const deniedDomains=response();
    await integrations(apiRequest('POST',{}, {headers:{authorization:'Bearer test-user-token'},body:{...body,allowed_domains:[],accept_attribution:true}}),deniedDomains);
    assert.equal(deniedDomains.statusCode,400);
    const accepted=response();
    await integrations(apiRequest('POST',{}, {headers:{authorization:'Bearer test-user-token'},body:{...body,accept_attribution:true}}),accepted);
    assert.equal(accepted.statusCode,201);
    assert.equal(JSON.parse(accepted.body).sharedApiKey,'cm_public_v1');
    const inserted=mock.calls.find(x=>x.method==='POST'&&x.url.includes('citymus_integrations'));
    assert.equal(JSON.parse(inserted.body).user_id,USER);
    assert.equal(JSON.parse(inserted.body).terms_version,'citymus-attribution-v1');
    assert.equal(inserted.url.includes('citymus_integrations'),true);
    assert.equal(mock.calls.filter(x=>x.url.includes('citymus_integrations')).length > 0,true);
    const revoked=response();
    await integrations(apiRequest('DELETE',{id:INTEGRATION},{headers:{authorization:'Bearer test-user-token'}}),revoked);
    assert.equal(revoked.statusCode,200);
    const unavailable=response();
    await getPlaylist(apiRequest('GET',{api_key:'cm_public_v1',integration:INTEGRATION}),unavailable);
    assert.equal(unavailable.statusCode,404);
  } finally { mock.restore(); }
});
test('Studio inline module syntax and explicit attribution confirmation are valid',()=>{
  const markup=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
  const script=markup.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script,'Studio module must exist');
  const checked=spawnSync(process.execPath,['--check','--input-type=module'],{input:script[1],encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
  assert.match(markup,/id="agree" required/);
  assert.match(markup,/accept_attribution:true/);
  assert.match(markup,/Powered by CITYMUS/);
  assert.doesNotMatch(markup,/api\/keys\?/);
});

test('CITYMUS recovers an unused Supabase magic link without following localhost redirect', async()=>{
  const { parseCitymusAuthRecoveryLink }=await import('../studio/auth-recovery.mjs');
  const project='https://dlnejllwollwpuanhicf.supabase.co';
  const token='a'.repeat(64);
  assert.deepEqual(parseCitymusAuthRecoveryLink(
    project+'/auth/v1/verify?token='+token+'&type=magiclink&redirect_to=http%3A%2F%2Flocalhost%3A3000',project),
  { method:'verify', token_hash:token, type:'magiclink' });
  assert.deepEqual(parseCitymusAuthRecoveryLink(
    project+'/auth/v1/verify?token_hash='+token+'&type=email',project),
  { method:'verify', token_hash:token, type:'email' });
  assert.throws(()=>parseCitymusAuthRecoveryLink(
    'https://fake.example/auth/v1/verify?token='+token+'&type=magiclink',project));
  assert.throws(()=>parseCitymusAuthRecoveryLink(
    'javascript:alert(1)',project));
  assert.throws(()=>parseCitymusAuthRecoveryLink(
    project+'/auth/v1/verify?token='+token+'&type=recovery',project));
});
test('CITYMUS recovers existing redirected browser session tokens, but rejects incomplete localhost URL',async()=>{
  const { parseCitymusAuthRecoveryLink }=await import('../studio/auth-recovery.mjs');
  const origin='https://dlnejllwollwpuanhicf.supabase.co';
  const link='http://localhost:3000/#access_token=ey.abc.def&refresh_token=opaque-refresh';
  assert.deepEqual(parseCitymusAuthRecoveryLink(link,origin),{
    method:'session',access_token:'ey.abc.def',refresh_token:'opaque-refresh'
  });
  assert.throws(()=>parseCitymusAuthRecoveryLink('http://localhost:3000/',origin));
  assert.throws(()=>parseCitymusAuthRecoveryLink('http://other.example:3000/#access_token=ey.abc.def&refresh_token=x',origin));
});

test('recovery parses Google email wrapper without fetching or revealing login tokens', async () => {
  const { parseCitymusAuthRecoveryLink }=await import('../studio/auth-recovery.mjs');
  const supa='https://dlnejllwollwpuanhicf.supabase.co';
  const token='b'.repeat(64);
  const direct=supa+'/auth/v1/verify?token='+token+'&type=magiclink&redirect_to=http%3A%2F%2Flocalhost%3A3000';
  const google='https://www.google.com/url?q='+encodeURIComponent(direct)+'&sa=D';
  const outlook='https://nam01.safelinks.protection.outlook.com/?url='+encodeURIComponent(direct)+'&data=xyz';
  const nested='https://example.org/click?u='+encodeURIComponent(google);
  for(const input of [direct,google,outlook,nested,'<'+direct.replaceAll('&','&amp;')+'>']){
    assert.deepEqual(parseCitymusAuthRecoveryLink(input,supa),{
      method:'verify',token_hash:token,type:'magiclink'
    });
  }
  assert.throws(()=>parseCitymusAuthRecoveryLink('https://mail.google.com/mail/u/0/#inbox/123',supa),/信件頁面/);
  assert.throws(()=>parseCitymusAuthRecoveryLink('https://example.org/evil?link=https%3A%2F%2Fevil.example%2Fverify',supa),/不是 CITYMUS 驗證連結/);
});
test('recovery accepts official redirected session but rejects credential-less callbacks', async () => {
  const {parseCitymusAuthRecoveryLink}=await import('../studio/auth-recovery.mjs');
  const supa='https://dlnejllwollwpuanhicf.supabase.co';
  assert.deepEqual(parseCitymusAuthRecoveryLink('https://citymus-production.vercel.app/studio/#access_token=ey.abc.def&refresh_token=xyz',supa),{
    method:'session',access_token:'ey.abc.def',refresh_token:'xyz'
  });
  assert.throws(()=>parseCitymusAuthRecoveryLink('https://citymus-production.vercel.app/studio/',supa),/不是驗證信/);
  assert.throws(()=>parseCitymusAuthRecoveryLink('http://localhost:3000/',supa),/沒有登入資訊/);
});

test('CITYMUS Studio signs in with front-end 6-digit Email OTP and exposes shared API identifier',()=>{
  const markup=fs.readFileSync(path.join(__dirname,'../studio/index.html'),'utf8');
  assert.match(markup,/id="otp-form" hidden/);
  assert.match(markup,/id="otp" type="text" inputmode="numeric" autocomplete="one-time-code"/);
  assert.match(markup,/pattern="\[0-9\]\{6\}"/);
  assert.match(markup,/supabase\.auth\.signInWithOtp\(\{email\}\)/);
  assert.match(markup,/supabase\.auth\.verifyOtp\(\{ email, token, type:'email' \}\)/);
  assert.match(markup,/id="shared-key-display">cm_public_v1/);
  assert.match(markup,/id="copy-shared-key"/);
  assert.doesNotMatch(markup,/id="recover-form"/);
  assert.doesNotMatch(markup,/emailRedirectTo:base/);
});
