/* Offline regression: optional manual copying still succeeds/fails accurately,
   while the direct Apply flow does not depend on clipboard permissions. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../content/album-modal.js'),'utf8');
const url='https://is1-ssl.mzstatic.com/image/thumb/a/1000x1000bb.jpg';
let written=[],shouldFail=false;
const doc={querySelectorAll:()=>[],getElementById:()=>null,documentElement:{},
 body:{append(){}},execCommand:()=>false,
 createElement:()=>({style:{},select(){},remove(){}})};
const sandbox={globalThis:{GeniusToolkitArtwork:{geniusVariants:()=>[],validUrl:v=>v}},
 location:{pathname:'/not-an-album'},document:doc,MutationObserver:class{observe(){}},
 addEventListener(){},setTimeout(){},URL,navigator:{clipboard:{writeText:async text=>{
  if(shouldFail)throw Error('denied');written.push(text);
 }}}};
vm.runInNewContext(src,sandbox);
const {copyValue}=sandbox.globalThis.GeniusToolkitAlbumModalTests;
(async()=>{
 assert.equal(await copyValue(url),true);
 assert.deepEqual(written,[url]);
 shouldFail=true;
 assert.equal(await copyValue(url),false,'failed clipboard must not claim success');
 assert.deepEqual(written,[url]);
 assert.match(src,/Link copied\. Paste it into Genius’s cover URL field \(Ctrl\+V\), then save\./);
 assert.match(src,/Manual alternative: click the gray camera tile/);
 console.log('album copy fallback passed: success, failure, accurate instructions');
})().catch(error=>{console.error(error);process.exitCode=1});
