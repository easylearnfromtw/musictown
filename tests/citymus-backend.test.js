'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { playlistPayload, allowedDomains, id, sharedApiKey, SHARED_API_KEY, ATTRIBUTION } = require('../lib/citymus-backend');
test('shared public API identifier is the same for all users', () => {
  assert.equal(SHARED_API_KEY,'cm_public_v1');
  assert.equal(sharedApiKey({query:{api_key:SHARED_API_KEY}}), SHARED_API_KEY);
  assert.throws(()=>sharedApiKey({query:{api_key:'bad'}}));
  assert.equal(ATTRIBUTION.required,true);
  assert.match(ATTRIBUTION.label,/CITYMUS/);
});
test('only public HTTPS direct audio links are accepted', () => {
  const good=playlistPayload({name:'Taipei',tracks:[{title:'Night',artist:'DJ',url:'https://cdn.example.com/night.mp3'}]});
  assert.equal(good.tracks[0].url,'https://cdn.example.com/night.mp3');
  for (const url of ['http://example.com/a.mp3','https://127.0.0.1/a.mp3',
    'https://localhost/a.mp3','https://example.com/video','javascript:alert(1)']) {
    assert.throws(()=>playlistPayload({name:'X',tracks:[{title:'A',url}]}));
  }
});
test('playlist and track quotas prevent oversized writes', () => {
  assert.throws(()=>playlistPayload({name:'',tracks:[]}));
  assert.throws(()=>playlistPayload({name:'X',tracks:Array.from({length:41},(_,i)=>({
    title:String(i),url:'https://cdn.example.com/a.mp3'
  }))}));
});
test('authorized frame ancestors require exact HTTPS origins', () => {
  assert.deepEqual(allowedDomains(['https://example.com','https://example.com/']),['https://example.com']);
  for (const value of ['http://example.com','https://example.com/path','https://*.example.com','https://example.com?x=1']) {
    assert.throws(()=>allowedDomains([value]));
  }
});
test('integration UUIDs are validated', () => {
  assert.equal(id('8431a672-511b-458c-af8f-9fb2056c668a'),'8431a672-511b-458c-af8f-9fb2056c668a');
  assert.throws(()=>id('not-valid&user_id=eq.other'));
});
