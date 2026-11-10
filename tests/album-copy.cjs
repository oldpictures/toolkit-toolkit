/* Offline regression: album cover selection announces a successful copy before
   the native Genius tab changes; clipboard failures never claim success. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../content/album-modal.js'),'utf8');
const exact='Link copied. Paste it into Genius’s cover URL field (Ctrl+V), then save.';
const url='https://is1-ssl.mzstatic.com/image/thumb/a/1000x1000bb.jpg';
let written=[],shouldFail=false,opened=false;
const doc={
 querySelectorAll:()=>[],getElementById:()=>null,documentElement:{},
 body:{append(){}},execCommand:()=>false,
 createElement:()=>({style:{},select(){},remove(){}})
};
const sandbox={
 globalThis:{GeniusToolkitArtwork:{geniusVariants:()=>[],dimensions:async()=>({width:1000,height:1000}),validUrl:v=>v}},
 location:{pathname:'/albums/Joeyy/Try',href:'https://genius.com/albums/Joeyy/Try'},
 document:doc,MutationObserver:class{observe(){}},addEventListener(){},setTimeout(){},URL,
 navigator:{clipboard:{writeText:async text=>{if(shouldFail)throw Error('denied');written.push(text);}}}
};
vm.runInNewContext(src,sandbox);
const {copyAndNotify,copyInstruction}=sandbox.globalThis.GeniusToolkitAlbumModalTests;
const instruction={hidden:true,textContent:''};
const panel={isConnected:true,querySelector(selector){assert.equal(selector,'.gt-album-art-next');return instruction;}};
(async()=>{
 await copyAndNotify(panel,url,async copied=>{
  opened=true;
  assert.equal(copied,true);
  assert.deepEqual(written,[url]);
  assert.equal(instruction.hidden,false,'instruction is visible when the native tab is opened');
  assert.equal(instruction.textContent,exact,'show exact requested copy/paste instruction immediately');
 });
 assert.equal(opened,true);
 assert.equal(instruction.textContent,exact,'instruction persists after native tab navigation');
 // Simulate the native cover field being filled: copying remains the primary
 // confirmation, rather than being replaced by a transient status.
 assert.equal(instruction.textContent,exact);
 shouldFail=true;opened=false;instruction.hidden=true;instruction.textContent='';
 await copyAndNotify(panel,url,async copied=>{
  opened=true;
  assert.equal(copied,false);
  assert.match(instruction.textContent,/Couldn’t copy automatically/);
  assert.doesNotMatch(instruction.textContent,/^Link copied/);
 });
 assert.equal(opened,true);
 // A detached modal should not be mutated by an old clipboard completion.
 panel.isConnected=false;instruction.textContent='unchanged';
 await copyAndNotify(panel,url,async()=>{throw Error('must not open detached modal');});
 assert.equal(instruction.textContent,'unchanged');
 // A stale artwork selection must not display instructions for the old URL.
 panel.isConnected=true;instruction.textContent='unchanged';
 await copyAndNotify(panel,url,async()=>{throw Error('must not open stale selection');},()=>false);
 assert.equal(instruction.textContent,'unchanged');
 // Explicit test of helper's normal copy confirmation.
 panel.isConnected=true;copyInstruction(panel,true,true,false);
 assert.equal(instruction.textContent,exact);
 console.log('album cover copy tests passed: immediate confirmation, clipboard failure, detached/stale selection');
})().catch(error=>{console.error(error);process.exitCode=1});
