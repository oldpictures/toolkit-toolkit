/* Offline regression tests: simulate iTunes results and public Apple Music HTML. */
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../background/apple-art.js'),'utf8');
const art='https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/test/1200x630wp-60.jpg';
const albumHref='https://music.apple.com/us/album/hypebeast-single/6808678953';
const meta=(k,v)=>`<meta property="${k}" content="${v}">`;
const albumHTML=meta('og:title','‎Hypebeast - Single - Album by smokedope2016 - Apple Music')+meta('og:image',art);
function fake(resolver){
 let handle;
 const calls=[];
 const browser={runtime:{onMessage:{addListener(fn){handle=fn;}}}};
 const fetch=async input=>{
  const url=new URL(input);calls.push(url);
  const val=await resolver(url);
  if(val instanceof Error)throw val;
  return {ok:true,status:200,json:async()=>({results:val||[]}),text:async()=>String(val||'')};
 };
 const globalThis={};
 vm.runInNewContext(src,{browser,URL,URLSearchParams,AbortSignal,fetch,globalThis});
 return {calls,send:msg=>handle({scope:'gt-apple-art',action:'search',...msg}),hooks:globalThis.GTAppleArtTests};
}
const album=(name,artist,id,trackCount=1)=>({wrapperType:'collection',collectionType:'Album',collectionName:name,artistName:artist,collectionId:id,trackCount,artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/Music/test/100x100bb.jpg'});
async function go(){
 const f=fake(url=>{
  if(url.hostname==='itunes.apple.com'){
   if(url.searchParams.get('entity')==='musicArtist')return [{artistName:'smokedope2016',artistId:1616723183}];
   return [];
  }
  if(url.pathname==='/us/artist/artist/1616723183')return `<a href="${albumHref}">Hypebeast</a><a href="/us/album/the-peak/1234567890">The Peak</a>`;
  if(url.pathname==='/us/album/hypebeast-single/6808678953')return albumHTML;
  return '';
 });
 const result=await f.send({title:'Hypebeast',artist:'smokedope2016',album:'THE COMEUP'});
 assert.equal(result.ok,true);
 assert.equal(result.candidates.length,1,JSON.stringify(result));
 assert.equal(result.candidates[0].artwork,'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/test/1000x1000bb.jpg');
 assert.equal(result.candidates[0].album,'Hypebeast - Single');
 assert.equal(f.calls.some(u=>u.hostname==='music.apple.com'),true);

 // An actual single surfaced in the iTunes response should return immediately.
 const fast=fake(u=>u.hostname==='itunes.apple.com'&&u.searchParams.get('entity')==='album'?[album('Hypebeast - Single','smokedope2016',23)]:[]);
 assert.equal((await fast.send({title:'Hypebeast',artist:'smokedope2016'})).candidates.length,1);

 // Albums that happen to be named after a song must not become song art.
 const full=fake(u=>u.hostname==='itunes.apple.com'&&u.searchParams.get('entity')==='song'?
  [{...album('Hypebeast','smokedope2016',34,13),wrapperType:'track',kind:'song'}]:[]);
 assert.equal((await full.send({title:'Hypebeast',artist:'smokedope2016'})).candidates.length,0);

 // Apple Music release belongs to different artist -> reject even if slug same.
 const bad=fake(url=>{
  if(url.hostname==='itunes.apple.com')return url.searchParams.get('entity')==='musicArtist'?[{artistName:'smokedope2016',artistId:1616723183}]:[];
  if(url.pathname.startsWith('/us/artist/'))return `<a href="${albumHref}">Hypebeast</a>`;
  if(url.pathname.includes('/album/hypebeast-'))return meta('og:title','Hypebeast - Single - Album by Someone Else - Apple Music')+meta('og:image',art);
  return '';
 });
 assert.equal((await bad.send({title:'Hypebeast',artist:'smokedope2016'})).candidates.length,0);

 // Song pages with an Apple ID can discover their linked standalone release.
 const song=fake(url=>{
  if(url.hostname==='itunes.apple.com')return [];
  if(url.pathname==='/us/song/6811734323')return `<a href="${albumHref}">Single</a>`;
  if(url.pathname==='/us/album/hypebeast-single/6808678953')return albumHTML;
  return '';
 });
 assert.equal((await song.send({title:'Hypebeast',artist:'smokedope2016',appleId:'6811734323'})).candidates.length,1);

 // Generically named song/artist and a different single on Apple Music.
 const secondUrl='https://music.apple.com/ro/album/quiet-single/9876543210';
 const second=fake(url=>{
  if(url.hostname==='itunes.apple.com')return url.searchParams.get('entity')==='musicArtist'?[{artistName:'Any Artist',artistId:1234567890}]:[];
  if(url.pathname.startsWith('/us/artist/'))return `<a href="${secondUrl}">Quiet</a>`;
  if(url.pathname==='/ro/album/quiet-single/9876543210')return meta('og:title','Quiet - Single - Album by Any Artist - Apple Music')+meta('og:image',art);
  return '';
 });
 assert.equal((await second.send({title:'Quiet',artist:'Any Artist'})).candidates.length,1);

 // No third-party image URLs accepted even with a plausible title.
 assert.equal(f.hooks.applePageArtwork('https://example.org/image/thumb/Music/a/1200x630.jpg'),null);
 assert.equal(f.hooks.appleAlbumLinks('https://music.apple.com/us/album/hypebeast-single/6808678953','Another Track').length,0);
 assert.equal(f.hooks.verifiedAppleRelease(meta('og:title','Hypebeast - Album by smokedope2016 - Apple Music')+meta('og:image',art),
  'https://music.apple.com/us/album/hypebeast/6808678953','Hypebeast','smokedope2016','single'),null);
 console.log('single artwork lookup tests passed (itunes, apple music artist/song, separate release, cross-artist rejection, album cover rejection, strict image host)');
}
go().catch(e=>{console.error(e);process.exitCode=1});
