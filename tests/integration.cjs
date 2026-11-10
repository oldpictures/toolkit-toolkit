/* Run with node tests/integration.cjs. Offline shared-code regression coverage. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const load=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const appleSrc=load('background/apple-art.js');
const errors={globalThis:{}};
vm.runInNewContext(load('content/api-errors.js'),errors);
const {present,hasErrors}=errors.globalThis.GeniusToolkitApiErrors;
assert.equal(hasErrors({meta:{status:200},errors:[]}),false);
assert.equal(hasErrors({meta:{status:200},errors:[null,'']}),false);
assert.equal(hasErrors({errors:['update failed']}),true);
assert.equal(hasErrors({errors:{base:['not saved']}}),true);
assert.equal(hasErrors({errors:{}}),false);
assert.equal(hasErrors({error:'   '}),false);
assert.equal(hasErrors({error:'bad request'}),true);
assert.equal(hasErrors({meta:{status:422},errors:[]}),true);
assert.equal(hasErrors({error:{message:'failed'}}),true);
assert.equal(present(false),false);
const art={globalThis:{},URL,clearTimeout,setTimeout};
vm.runInNewContext(load('content/artwork-utils.js'),art);
const common=art.globalThis.GeniusToolkitArtwork;
assert.equal(common.geniusVariants('https://images.genius.com/image.600x600x1.jpg')[0],
 'https://images.genius.com/image.1000x1000x1.jpg');
assert.equal(common.geniusVariants('https://untrusted.example/image.600x600x1.jpg').length,0);
assert.equal(common.sameGeniusImage('https://images.genius.com/c.600x600x1.jpg',
 'https://images.genius.com/c.1000x1000x1.jpg'),true);
assert.equal(common.sameGeniusImage('https://images.genius.com/a.jpg',
 'https://images.genius.com/b.jpg'),false);
assert.equal(common.validUrl('javascript:alert(1)'),null);
async function mock(resolver){
 let listener;const calls=[];
 const globalThis={};
 const browser={runtime:{onMessage:{addListener(fn){listener=fn;}}}};
 const fetch=async input=>{
  const u=new URL(input);calls.push(u);const val=resolver(u);
  if(val instanceof Error)throw val;
  return {ok:true,json:async()=>({results:Array.isArray(val)?val:[]}),text:async()=>String(val||'')};
 };
 vm.runInNewContext(appleSrc,{globalThis,browser,fetch,URL,URLSearchParams,AbortSignal});
 return {calls,send:payload=>listener({scope:'gt-apple-art',action:'search',...payload}),hooks:globalThis.GTAppleArtTests};
}
const item=(album,artist,id,trackCount=8)=>({wrapperType:'collection',collectionType:'Album',collectionName:album,
 artistName:artist,collectionId:id,trackCount,artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/Music/a/100x100bb.jpg'});
const meta=(k,v)=>`<meta property="${k}" content="${v}">`;
(async()=>{
 // The album API is empty, but official artist page has a matching album.
 const albumPage='https://music.apple.com/us/album/try/1758351382';
 const f=await mock(u=>{
  if(u.hostname==='itunes.apple.com')return u.searchParams.get('entity')==='musicArtist'?[{artistName:'Joeyy',artistId:144001}]:[];
  if(u.pathname==='/us/artist/joeyy/144001')return `<a href="${albumPage}">Try</a>`;
  if(u.pathname==='/us/album/try/1758351382')return meta('og:title','Try - Album by Joeyy - Apple Music')+
   meta('og:image','https://is1-ssl.mzstatic.com/image/thumb/Music/a/1200x630wp-60.jpg');
  return '';
 });
 const found=await f.send({kind:'album',album:'Try',artist:'Joeyy'});
 assert.equal(found.candidates.length,1,JSON.stringify(found));
 assert.equal(found.candidates[0].artwork,'https://is1-ssl.mzstatic.com/image/thumb/Music/a/1000x1000bb.jpg');
 // The artist catalog's ID is reused for the Apple Music website, not queried twice.
 assert.equal(f.calls.filter(u=>u.hostname==='itunes.apple.com'&&u.searchParams.get('entity')==='musicArtist').length,1);
 // An album is NOT suitable as single cover art for its song of the same title.
 assert.equal((await f.send({kind:'single',title:'Try',artist:'Joeyy'})).candidates.length,0);
 // Both art entry points send through the same shared messaging interface.
 let message;
 art.browser={runtime:{sendMessage:async m=>(message=m,{ok:true,candidates:[{
  artwork:'https://is1-ssl.mzstatic.com/image/thumb/a/1000x1000bb.jpg',
  preview:'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg'}]})}};
 // Art module originally evaluated without a browser global. Re-evaluate in a
 // sandbox that provides it, proving the same interface serves both modes.
 const context={globalThis:{},URL,browser:art.browser};vm.runInNewContext(load('content/artwork-utils.js'),context);
 const shared=context.globalThis.GeniusToolkitArtwork;
 assert.equal((await shared.search({kind:'album',album:'Try',artist:'Joeyy'})).candidates.length,1);
 assert.equal(message.kind,'album');
 assert.equal((await shared.search({kind:'single',title:'Hypebeast',artist:'smokedope2016'})).candidates.length,1);
 assert.equal(message.kind,'single');
 console.log('integration tests passed: shared artwork, album fallback, single rejection, lookup reuse, Genius API errors');
})().catch(error=>{console.error(error);process.exitCode=1});
