'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { playlistPayload, allowedDomains, id, keyDigest } = require('../lib/citymus-backend');

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
test('frame-ancestor origins must be HTTPS exact origins', () => {
  assert.deepEqual(allowedDomains(['https://example.com','https://example.com/']),['https://example.com']);
  for (const value of ['http://example.com','https://example.com/path','https://*.example.com','https://example.com?x=1']) {
    assert.throws(()=>allowedDomains([value]));
  }
});
test('UUIDs are validated, preventing REST filter injection', () => {
  assert.equal(id('8431a672-511b-458c-af8f-9fb2056c668a'),'8431a672-511b-458c-af8f-9fb2056c668a');
  assert.throws(()=>id('not-valid&user_id=eq.other'));
});
test('same key has stable digest with secret pepper', () => {
  process.env.CITYMUS_KEY_PEPPER='0123456789abcdefghijklmnopqrstuvwxyz';
  const key='cm_pub_'+crypto.randomBytes(32).toString('base64url');
  assert.equal(keyDigest(key),keyDigest(key));
  assert.notEqual(keyDigest(key),keyDigest(key+'x'));
});
