/* Offline regression: the native Genius album-art update path is explicit,
   uses the existing controller, targets only the empty tile and fails safely. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../content/album-modal.js'),'utf8');
const goodUrl='https://is1-ssl.mzstatic.com/image/thumb/a/1000x1000bb.jpg';
const art={id:99,image_url:'https://images.genius.com/current.jpg'};
const empty={id:null,image_url:null};
const calls=[];
const fakeScope={$applyAsync(){calls.push('digest');}};
const controller={visible_cover_arts(){return [art,empty];},update(target,url){
 calls.push(['update',target,url]);return Promise.resolve('ok');
}};
let available=true;
const angular={element(element){return {
 controller:()=>available?controller:null,
 isolateScope:()=>fakeScope,
 scope:()=>element.repeatScope||fakeScope
};}};
const tile={querySelector:s=>s==='image-upload-button[on-file-picked]'?{}:null,
 repeatScope:{cover_art:empty}};
const form={querySelectorAll:()=>[tile]};
const doc={querySelectorAll:()=>[],getElementById:()=>null,documentElement:{}};
const sandbox={
 globalThis:{GeniusToolkitArtwork:{geniusVariants:()=>[],dimensions:async()=>({width:1000,height:1000}),validUrl:v=>v}},
 document:doc,location:{pathname:'/not-an-album'},MutationObserver:class{observe(){}},
 addEventListener(){},setTimeout,URL,window:{wrappedJSObject:{angular}}
};
vm.runInNewContext(src,sandbox);
const {callGeniusCoverUpdate,findEmptyNativeCover,applyNativeCover}=sandbox.globalThis.GeniusToolkitAlbumModalTests;
(async()=>{
 assert.equal(findEmptyNativeCover(form,angular,controller),empty);
 let result=callGeniusCoverUpdate(form,goodUrl,sandbox.window);
 assert.equal(result.ok,true);
 await result.pending;
 assert.equal(calls.length,2);
 assert.equal(calls[0][0],'update');
 assert.equal(calls[0][1],empty,'only the empty cover tile is targeted');
 assert.equal(calls[0][2],goodUrl);
 assert.equal(calls[1],'digest');
 assert.equal(art.image_url,'https://images.genius.com/current.jpg');
 // Native controller unavailable: no write, no fake success.
 available=false;
 result=callGeniusCoverUpdate(form,goodUrl,sandbox.window);
 assert.equal(result.ok,false);
 assert.equal(calls.length,2);
 available=true;
 controller.visible_cover_arts=()=>[art];
 result=callGeniusCoverUpdate(form,goodUrl,sandbox.window);
 assert.equal(result.ok,false,'never overwrite the existing cover as fallback');
 assert.equal(calls.length,2);
 controller.visible_cover_arts=()=>[art,empty];
 let switchCount=0;
 const ctx={modal:{isConnected:true,querySelector:s=>s==='cover-art-form[cover-arts][type="album"]'?form:null},
  tab2:{click(){switchCount++;}},isInfoDirty:()=>true};
 result=await applyNativeCover(ctx,goodUrl);
 assert.equal(result.reason,'unsaved-info','do not discard unsaved album metadata');
 assert.equal(switchCount,0);
 ctx.isInfoDirty=()=>false;
 result=await applyNativeCover(ctx,goodUrl);
 assert.equal(result.ok,true);
 assert.equal(switchCount,1,'only switch native tab within the existing editor');
 assert.equal(calls.filter(c=>Array.isArray(c)&&c[0]==='update').length,2);
 // Reject updates: errors are visible, not reported as a successful change.
 controller.update=()=>Promise.reject(new Error('native rejected'));
 result=await applyNativeCover(ctx,goodUrl);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'native-update-rejected');
 // Rejected by a resolved Genius API error is also a failure.
 sandbox.globalThis.GeniusToolkitApiErrors={hasErrors:reply=>!!reply?.errors?.length};
 controller.update=()=>Promise.resolve({errors:['artwork upload not accepted']});
 result=await applyNativeCover(ctx,goodUrl);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'native-update-rejected');
 console.log('inline album apply passed: native update, empty tile, no silent overwrite, unsaved info, errors');
})().catch(error=>{console.error(error);process.exitCode=1});
