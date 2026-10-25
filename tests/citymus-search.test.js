'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/search.js');
function invoke({method='GET',q='推薦音樂',origin='https://easylearnfromtw.github.io'}={}){
 return new Promise((resolve,reject)=>{
  const headers={},res={
   statusCode:200,setHeader(k,v){headers[k]=v;},
   end(data=''){try{resolve({status:this.statusCode,headers,body:data?JSON.parse(String(data)):null});}catch(e){reject(e);}}
  };
  Promise.resolve(handler({method,query:{q,limit:'6'},headers:{origin}},res)).catch(reject);
 });
}
test('generic recommendations return real entries and CITYMUS attribution',async()=>{
 const r=await invoke();
 assert.equal(r.status,200);
 assert.ok(r.body.total>=2500);
 assert.ok(r.body.tracks.length>0);
 assert.equal(r.body.attribution.label,'Powered by CITYMUS');
 for(const track of r.body.tracks){
  assert.ok(track.title&&track.artist);
  assert.equal(track.provider,'CITYMUS');
  assert.ok(track.audioUrl===null||track.audioUrl.startsWith('http'));
 }
 assert.equal(r.headers['Access-Control-Allow-Origin'],'https://easylearnfromtw.github.io');
});
test('unmatched specific song never invents a result',async()=>{
 const r=await invoke({q:'完全不存在的歌曲_xyz_not_a_real_title_2026'});
 assert.equal(r.status,200);
 assert.equal(r.body.tracks.length,0);
 assert.equal(r.body.fallback,false);
});
test('public API only permits GET, with bounded queries',async()=>{
 assert.equal((await invoke({method:'DELETE'})).status,405);
 assert.equal((await invoke({q:'A'.repeat(181)})).status,400);
 const r=await invoke({origin:'https://not-vanilla.example'});
 assert.ok(!r.headers['Access-Control-Allow-Origin']);
});
