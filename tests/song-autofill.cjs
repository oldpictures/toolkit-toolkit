/* Offline UI simulation: autofill never overwrites until a verified choice is clicked. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../content/song-media.js'),'utf8');
class FakeElement {
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.parentElement=null;
  this.listeners={};this.attrs={};this.classList={add(){}};this.style={};this.value='';this.id='';
  this.name='';this.textContent='';this.disabled=false;this.readOnly=false;this.isConnected=true;
 }
 append(...nodes){for(const n of nodes)this.appendChild(n);}
 appendChild(n){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(x=>x!==n);this.children.push(n);n.parentNode=this;n.parentElement=this;return n;}
 insertBefore(n,other){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(x=>x!==n);const i=this.children.indexOf(other);assert.ok(i>=0);this.children.splice(i,0,n);n.parentNode=this;n.parentElement=this;return n;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 async click(){for(const fn of this.listeners.click||[])await fn({type:'click'});}
 dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);return true;}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k]||null;}
 querySelectorAll(q){if(q==='button')return this.children.filter(c=>c.tagName==='BUTTON');return [];}
 getBoundingClientRect(){return {width:200,height:20};}
 getClientRects(){return [{width:200}];}
 closest(){return null;}
}
class FakeInput extends FakeElement{constructor(){super('input');this.type='text';this.id='song_art_url';}}
class FakeTextarea extends FakeElement{constructor(){super('textarea');}}
const field=new FakeInput();field.value='https://images.genius.com/current-cover.jpg';
const wrapper=new FakeElement();wrapper.append(field);
const elements=[];const timers=[];const fakeSong={title:'Hypebeast',primary_artist:{name:'smokedope2016'},album:{name:'THE COMEUP'}};
const document={
 querySelectorAll(q){if(q.startsWith('input:not'))return [field];if(q.startsWith('meta[itemprop'))return [{content:JSON.stringify({song:fakeSong})}];return [];},
 querySelector(){return null;},getElementById(){return null},documentElement:{},
 createElement(tag){const el=new FakeElement(tag);elements.push(el);return el;}
};
const urls=['https://is1-ssl.mzstatic.com/first-1000.jpg','https://is1-ssl.mzstatic.com/second-1000.jpg'];
let dimMode='valid',deferred;
const artwork={
 geniusVariants(){return []},sameGeniusImage(){return false},
 async search(){return {ok:true,candidates:urls.map((url,i)=>({album:'Hypebeast - Single',artist:'smokedope2016',artwork:url,preview:url,source:'Apple Music'}))}},
 dimensions:async()=>dimMode==='invalid'?{width:500,height:500}:dimMode==='defer'?new Promise(resolve=>deferred=resolve):{width:1000,height:1000}
};
const sandbox={
 globalThis:{GeniusToolkitArtwork:artwork},document,location:{pathname:'/Smokedope2016-hypebeast-lyrics'},
 window:{addEventListener(){}},MutationObserver:class{observe(){}},
 getComputedStyle(){return {visibility:'visible',display:'block',fontFamily:'Arial'}},
 setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},URL,
 HTMLInputElement:FakeInput,HTMLTextAreaElement:FakeTextarea,Event:class{constructor(type){this.type=type;}}
};
vm.runInNewContext(src,sandbox);
(async()=>{
 timers.shift()(); // install the helper
 const autofill=elements.find(e=>e.tagName==='BUTTON'&&e.textContent==='Autofill');
 assert.ok(autofill,'autofill button installed');
 const status=elements.find(e=>e.className==='gt-song-art-status');
 const results=elements.find(e=>e.className==='gt-song-art-results');
 let inputs=0,changes=0;field.addEventListener('input',()=>inputs++);field.addEventListener('change',()=>changes++);
 const initial=field.value;
 await autofill.click();
 assert.equal(field.value,initial,'lookup must not alter existing artwork');
 assert.equal(results.children.length,2,'existing artwork must not hide search options');
 assert.equal(inputs,0);assert.equal(changes,0);
 await results.children[0].click();
 assert.equal(field.value,urls[0],'explicit selection may replace existing art');
 assert.equal(results.children.length,2,'choices stay available after selecting');
 assert.equal(results.children[0].attrs['aria-pressed'],'true');
 assert.equal(inputs,1);assert.equal(changes,1);
 await results.children[1].click();
 assert.equal(field.value,urls[1],'can switch to another option without re-searching');
 assert.equal(inputs,2);assert.equal(changes,2);
 dimMode='invalid';await results.children[0].click();
 assert.equal(field.value,urls[1],'invalid dimensions never replace artwork');
 dimMode='defer';
 const clicking=results.children[0].click();
 await Promise.resolve(); // allow dimensions() to begin
 field.value='https://images.genius.com/manual-edit.jpg';
 deferred({width:1000,height:1000});await clicking;
 assert.equal(field.value,'https://images.genius.com/manual-edit.jpg','manual edit during validation must win');
 assert.match(status.textContent,/changed while verifying/i);
 console.log('song autofill UI tests passed: populated field, click-only replacement, reselect, dimensions, concurrent edits');
})().catch(error=>{console.error(error);process.exitCode=1});
