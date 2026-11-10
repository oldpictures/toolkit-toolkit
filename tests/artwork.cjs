/* Run with: node tests/artwork.cjs. All network responses are mocked. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sharedArt=fs.readFileSync(require('node:path').join(__dirname,'../content/artwork-utils.js'),'utf8');
const appleSource=fs.readFileSync(require('node:path').join(__dirname,'../background/apple-art.js'),'utf8');
const modalSource=fs.readFileSync(require('node:path').join(__dirname,'../content/album-modal.js'),'utf8');
const item=(album,artist,id)=>({wrapperType:'collection',collectionType:'Album',collectionName:album,artistName:artist,collectionId:id,artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/Music/apple/100x100bb.jpg'});
function env(resolver){
 let listener;
 const calls=[];
 const browser={runtime:{onMessage:{addListener(fn){listener=fn;}}}};
 const fetch=async(raw)=>{const url=new URL(raw);calls.push(url);const result=resolver(url);if(result instanceof Error)throw result;return {ok:true,status:200,json:async()=>({results:result||[]})}};
 const sandbox={browser,fetch,URL,URLSearchParams,AbortSignal,globalThis:{}};
 vm.runInNewContext(appleSource,sandbox);
 return {calls,send:msg=>listener({scope:'gt-apple-art',action:'search',...msg}),hooks:sandbox.globalThis.GTAppleArtTests};
}
async function test(){
 // The original 40-result combined lookup missed some releases. An alternate
 // artist-only lookup must be able to find an exact match for ANY artist.
 for(const [album,artist] of [['Try','Joeyy'],['Unknown Pleasures','Joy Division'],['Achtung Baby','U2']]){
  const fake=env(url=>{
   if(url.searchParams.get('term')===artist&&url.searchParams.get('attribute')==='artistTerm')return [item(album,artist,12345)];
   return [item('Unrelated Release','Wrong Artist',999)];
  });
  const result=await fake.send({album,artist});
  assert.equal(result.ok,true);assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].album,album);
  assert.equal(result.candidates[0].artwork.endsWith('/1000x1000bb.jpg'),true);
  assert.equal(fake.calls.length,2);
 }
 // A very short title cannot erroneously pick a similarly named album.
 const wrong=env(()=>[item('Try Again','Joeyy',111)]);
 const result=await wrong.send({album:'Try',artist:'Joeyy'});
 assert.equal(result.candidates.length,0);
 // Never accept a different artist even when the album title matches.
 const wrongArtist=env(()=>[item('Try','Other Artist',11)]);
 assert.equal((await wrongArtist.send({album:'Try',artist:'Joeyy'})).candidates.length,0);
 // A linked Apple ID is safe only when the resulting release actually matches.
 const direct=env(url=>url.pathname==='/lookup' ? [item('Try','Joeyy',1758351382)] : []);
 assert.equal((await direct.send({album:'Try',artist:'Joeyy',appleId:'1758351382'})).direct,true);
 // Artist ID catalog is a general fallback when the search index omits a release.
 const catalog=env(url=>{
  if(url.searchParams.get('entity')==='musicArtist')return [{artistName:'Joeyy',artistId:712345}];
  if(url.pathname==='/lookup')return [{wrapperType:'artist'},item('Try','Joeyy',1758351382)];
  return [];
 });
 assert.equal((await catalog.send({album:'Try',artist:'Joeyy'})).candidates[0].id,'1758351382');
 assert.equal(catalog.calls.some(u=>u.pathname==='/lookup'&&u.searchParams.get('entity')==='album'),true);
 // Malformed and non-Apple artwork URLs cannot become selectable cover links.
 const h=direct.hooks;
 assert.equal(h.artworkUrl('https://evil.example/100x100bb.jpg'),null);
 assert.equal(h.artworkUrl('https://is1-ssl.mzstatic.com/x/300x300bb.jpg'),'https://is1-ssl.mzstatic.com/x/1000x1000bb.jpg');
 assert.equal(h.score('Try','Try Harder'),0);
 // Test Genius's exact-album cover extraction without a live browser.
 const scriptSandbox={globalThis:{},location:{pathname:'/albums/Joeyy/Try',href:'https://genius.com/albums/Joeyy/Try'},
  document:{querySelectorAll:()=>[],getElementById:()=>null,documentElement:{}},MutationObserver:class{observe(){}},addEventListener(){},setTimeout() {},URL,AbortController,clearTimeout(){},
  window:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({response:{album:{id:442,cover_art_url:'https://images.genius.com/example.640x640x1.jpg'}}})})};
 scriptSandbox.globalThis.GeniusToolkitTagApi={albumIdFromPage:()=>442};
 vm.runInNewContext(sharedArt,scriptSandbox);
 vm.runInNewContext(modalSource,scriptSandbox);
 const g=scriptSandbox.globalThis.GeniusToolkitAlbumModalTests;
 assert.equal(g.routeInfo().artist,'Joeyy');
 assert.equal(g.routeInfo().album,'Try');
 assert.equal(g.artworkVariants('https://images.genius.com/a.600x600x1.jpg')[0],
  'https://images.genius.com/a.1000x1000x1.jpg');
 assert.equal(g.artworkVariants('https://not-genius.com/a.600x600x1.jpg').length,0);
 const genius=await g.geniusAlbumArtwork('Try','Joeyy');
 assert.equal(genius[0].source,'Genius');
 assert.equal(genius[0].artwork,'https://images.genius.com/example.1000x1000x1.jpg');
 // When the album page omits IDs/art, a linked song can still expose its
 // album's own cover. Its song URL AND album URL must match exactly.
 function songFallback(albumURL){
  const doc={querySelectorAll:s=>s==='a[href]'?[{href:'https://genius.com/Joeyy-anglerfish-lyrics'}]:[],getElementById:()=>null,documentElement:{}};
  const sandbox={globalThis:{GeniusToolkitTagApi:{albumIdFromPage:()=>null,fromAlbumPage:()=>[]}},
   location:{pathname:'/albums/Joeyy/Try',origin:'https://genius.com',href:'https://genius.com/albums/Joeyy/Try'},
   document:doc,MutationObserver:class{observe(){}},addEventListener(){},setTimeout(){},clearTimeout(){},URL,AbortController,
   window:{addEventListener(){}},DOMParser:class{parseFromString(){return {querySelectorAll:()=>[{content:'genius://songs/77'}]};}},
   fetch:async(path)=>path.startsWith('/api/songs/')?{ok:true,json:async()=>({response:{song:{id:77,url:'https://genius.com/Joeyy-anglerfish-lyrics',album:{id:99,url:albumURL,cover_art_url:'https://images.genius.com/test.500x500x1.jpg'}}}})}:
   {ok:true,text:async()=>'<html><meta content="genius://songs/77"></html>'}};
  vm.runInNewContext(sharedArt,sandbox);
  vm.runInNewContext(modalSource,sandbox);
  return sandbox.globalThis.GeniusToolkitAlbumModalTests.geniusAlbumArtwork('Try','Joeyy');
 }
 assert.equal((await songFallback('https://genius.com/albums/Joeyy/Try'))[0].artwork,
  'https://images.genius.com/test.1000x1000x1.jpg');
 assert.equal((await songFallback('https://genius.com/albums/Joeyy/Another-release')).length,0);
 console.log('artwork tests passed: multi-album searches, false-positive prevention, linked IDs, Apple artist catalog, URL safety, Genius album API and verified song-page fallback');
}
test().catch(e=>{console.error(e);process.exitCode=1});
