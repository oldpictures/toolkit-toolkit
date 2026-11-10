/* Toolkit Toolkit 0.10.16 — inline album artwork apply and resilient search.
   Search Apple Music and the album's own verified Genius metadata, without
   guessing song artwork or overriding existing covers automatically. */
(() => {
 'use strict';
 const PANEL = 'gt-album-art-panel';
 const artwork=globalThis.GeniusToolkitArtwork;
 const TEXT = el => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
 const visible = el => !!(el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
 const albumPath = () => /^\/albums\/[^/]+\/[^/]+/i.test(location.pathname);
 const original = {requestSeq:0};
 const versionPath = () => location.pathname;

 function leaf(root, expression) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
   if (!expression.test((node.nodeValue||'').replace(/\s+/g,' ').trim())) continue;
   const element = node.parentElement;
   if (element && !element.closest('#'+PANEL+', #gt-toolkit, script, style') && visible(element) && TEXT(element).length<80) return element;
  }
  return null;
 }
 function sharedAncestor(a,b){
  if(!a||!b)return null;
  for(let n=a;n;n=n.parentElement)if(n.contains(b))return n;
  return null;
 }
 function interactive(el){return el?.closest('button,a,[role="tab"],[ng-click],[data-action]')||el;}
 function findModal(){
  if(!albumPath())return null;
  const edit=leaf(document.body,/^edit info$/i),cover=leaf(document.body,/^edit cover art$/i);
  if(!edit||!cover)return null;
  const group=sharedAncestor(edit,cover);
  if(!group || group===document.body || group.querySelector('input:not([type=hidden])'))return null;
  const box=group.getBoundingClientRect();
  if(box.width<150||box.width>650)return null;
  const tab1=interactive(edit),tab2=interactive(cover);
  if(tab1===tab2)return null;
  let modal=null;
  for(let n=group.parentElement;n&&n!==document.body;n=n.parentElement){
   const r=n.getBoundingClientRect();
   if(r.width<540 || r.height<250)continue;
   if(r.width>Math.max(window.innerWidth*0.98,1300))continue;
   const controls=[...n.querySelectorAll('button,[role="button"],input[type="submit"],a,[ng-click]')];
   const hasSave=controls.some(c=>/^save$/i.test(TEXT(c)||c.value||''));
   const hasCancel=controls.some(c=>/^cancel$/i.test(TEXT(c)||c.value||''));
   if(hasSave&&hasCancel){modal=n;break;}
  }
  return modal?{modal,group,tab1,tab2}:null;
 }
 function modalInput(modal){
  return [...modal.querySelectorAll('input,textarea')].filter(el=>!el.closest('#'+PANEL) && el.type!=='hidden' && el.type!=='file' && visible(el));
 }
 function routeInfo(){
  // The album URL is independent of Genius's often-missing artist chips and
  // auto-generated og:title text. Use only as an identity/search fallback.
  const m=location.pathname.match(/^\/albums\/([^/]+)\/([^/]+)/i);
  const readable=s=>{try{return decodeURIComponent(s).replace(/-/g,' ').trim();}catch{return s.replace(/-/g,' ').trim();}};
  return m?{album:readable(m[2]),artist:readable(m[1])}:{album:'',artist:''};
 }
 function compactName(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
 function infoFromModal(modal){
  // Input selection is bounded to the actual Genius album modal, never the sidebar.
  const inputs=modalInput(modal);
  const input=inputs.find(i=>/album.*name|name.*album/i.test([i.id,i.name,i.getAttribute('ng-model'),i.getAttribute('placeholder')].join(' '))) ||
   inputs.find(i=>i.type==='text' && i.value && i.value.length<=150 && !/url|https?:/i.test(i.value));
  const title=String(input?.value||'').trim();
  const artistLinks=[...modal.querySelectorAll('a[href*="/artists/"]')].filter(a=>!a.closest('#'+PANEL));
  let artist=TEXT(artistLinks.find(visible));
  if(!artist){
   // Genius's multiple-artist chip often has neither a href nor a value.
   const label=leaf(modal,/^artists$/i);
   if(label){
    const field=label.nextElementSibling || label.parentElement?.nextElementSibling;
    const maybe=TEXT(field).replace(/[×✕]\s*$/,'').trim();
    if(maybe && maybe.length<150 && !/^artists$/i.test(maybe))artist=maybe;
   }
  }
  const og=String(document.querySelector('meta[property="og:title"]')?.content||document.title||'').trim();
  const match=og.match(/^(.+?)\s+by\s+(.+?)(?:\s*[|–].*)?$/i);
  const route=routeInfo();
  const album=title||String(match?.[1]||route.album||document.querySelector('h1')?.textContent||'').trim();
  const by=artist||String(match?.[2]||route.artist||'').replace(/\s*(?:\||[–—])\s*.*$/,'').trim();
  return {album,artist:by||route.artist};
 }
 function currentArt(){
  // Genius album pages sometimes expose a generic og:image despite having
  // the real album cover in their page markup.
  const candidates=[];
  const add=value=>{
   if(!value)return;
   try{const u=new URL(value,location.href);if(/^https?:$/.test(u.protocol))candidates.push(u.href);}catch{}
  };
  for(const selector of [
   'meta[property="og:image"]','meta[name="twitter:image"]',
   'meta[property="twitter:image"]'
  ])add(document.querySelector(selector)?.content);
  for(const img of document.querySelectorAll('main img, [class*="album"] img, [class*="Album"] img')){
   if(img.closest('#'+PANEL+', #gt-toolkit'))continue;
   const rect=img.getBoundingClientRect();
   if(rect.width<110||rect.height<110)continue;
   add(img.currentSrc||img.src);
  }
  const isArtwork=url=>/images\.genius\.com|images\d*\.genius\.com|genius\.com\/.*\.(?:jpg|jpeg|png|webp)|mzstatic\.com/i.test(url);
  return candidates.find(isArtwork)||candidates[0]||'';
 }
 // A Genius album can already have the correct cover even when Apple's
 // search API returns no hits. Only trust covers explicitly tied to the
 // current album (and optionally a song's verified album_appearances).
 const artworkVariants=artwork.geniusVariants;
 function albumCoverUrls(album){
  const urls=[];
  const push=x=>{if(typeof x==='string')urls.push(x);};
  push(album?.cover_art_url);
  push(album?.cover_art?.url);push(album?.cover_art?.image_url);
  for(const x of (Array.isArray(album?.cover_arts)?album.cover_arts:[]).slice(0,5)){
   push(x?.image_url);push(x?.url);
  }
  return urls;
 }
 function sameAlbumURL(url){
  try{const parsed=new URL(url,location.origin);return parsed.origin===location.origin&&
   parsed.pathname.replace(/\/$/,'').toLowerCase()===location.pathname.replace(/\/$/,'').toLowerCase();}
  catch{return false;}
 }
 async function imageFromAlbumTracks(albumId,add){
  // Only inspect a small number of actual song links on this album page.
  // Song ART is not automatically album art: prefer explicit, verified album
  // cover metadata. If two album tracks have the same song image, that image
  // can be offered as a fallback, subject to the normal size check.
  const api=globalThis.GeniusToolkitTagApi;
  let embedded=[];
  try{embedded=api?.fromAlbumPage?.(document)||[];}catch{}
  const candidates=embedded.map(x=>({url:x.key,id:x.id}));
  if(!candidates.length){
   for(const a of document.querySelectorAll('a[href]')){
    let u;
    try{u=new URL(a.href,location.href);}catch{continue;}
    if(u.origin!==location.origin||!/^\/[^/]+-lyrics\/?$/i.test(u.pathname))continue;
    if(candidates.some(x=>x.url===u.pathname))continue;
    candidates.push({url:u.pathname,id:null});
    if(candidates.length>=2)break;
   }
  }
  const seenSongArt=[];
  for(const track of candidates.slice(0,2)){
   let songId=track.id;
   if(!songId){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
    try{
     const page=await fetch(track.url,{credentials:'same-origin',signal:controller.signal});
     if(!page.ok)continue;
     const html=await page.text();
     if(html.length>3000000)continue;
     const doc=new DOMParser().parseFromString(html,'text/html');
     for(const el of doc.querySelectorAll('meta[content^="genius://songs/"]')){
      const value=Number((el.content||'').split('/').pop());
      if(Number.isSafeInteger(value)&&value>0){songId=value;break;}
     }
     if(!songId)for(const el of doc.querySelectorAll('meta[itemprop="page_data"],meta[property="page_data"]')){
      try{
       const data=JSON.parse(el.content||'{}');
       const value=Number(data?.song?.song?.id||data?.song?.id||data?.page_data?.song?.id);
       if(Number.isSafeInteger(value)&&value>0){songId=value;break;}
      }catch{}
     }
    }catch{}finally{clearTimeout(timer);}
   }
   if(!Number.isSafeInteger(Number(songId))||Number(songId)<=0)continue;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
   try{
    const res=await fetch('/api/songs/'+songId,{headers:{Accept:'application/json'},
     credentials:'same-origin',signal:controller.signal});
    if(!res.ok)continue;
    const song=(await res.json())?.response?.song;
    if(Number(song?.id)!==Number(songId))continue;
    if(!sameAlbumSongURL(song?.url,track.url))continue;
    const albums=[song?.album,...(Array.isArray(song?.album_appearances)?song.album_appearances.map(x=>x.album):[])];
    const own=albums.find(a=>Number(a?.id)===Number(albumId)||(a?.url&&sameAlbumURL(a.url)));
    if(!own)continue;
    const verifiedCovers=albumCoverUrls(own);
    for(const url of verifiedCovers)add(url);
    if(verifiedCovers.length)return; // The album's own cover is stronger than a song-art guess.
    if(song?.song_art_image_url)seenSongArt.push(song.song_art_image_url);
   }catch{}finally{clearTimeout(timer);}
  }
  if(seenSongArt.length===2&&seenSongArt[0]===seenSongArt[1])add(seenSongArt[0]);
 }
 function sameAlbumSongURL(songUrl,trackUrl){
  try{
   const a=new URL(songUrl,location.origin),b=new URL(trackUrl,location.origin);
   return a.origin===location.origin&&b.origin===location.origin&&
    a.pathname.replace(/\/$/,'').toLowerCase()===b.pathname.replace(/\/$/,'').toLowerCase();
  }catch{return false;}
 }
 async function geniusAlbumArtwork(albumName,artistName){
  const api=globalThis.GeniusToolkitTagApi;
  const id=api?.albumIdFromPage?.(document);
  const found=[];
  const add=src=>{
   for(const url of artworkVariants(src)){
    if(found.some(item=>item.artwork===url))continue;
    found.push({album:albumName,artist:artistName,artwork:url,
     preview:src,source:'Genius',rank:300});
   }
  };
  if(id){
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),9500);
   try{
    const response=await fetch('/api/albums/'+id,{method:'GET',credentials:'same-origin',
     headers:{Accept:'application/json'},signal:controller.signal});
    if(response.ok){
     const body=await response.json(),data=body?.response?.album;
     if(Number(data?.id)===id){
      for(const url of albumCoverUrls(data))add(url);
     }
    }
   }catch{}finally{clearTimeout(timeout);}
   if(!found.length)await imageFromAlbumTracks(id,add);
  }
  if(!id&&!found.length)await imageFromAlbumTracks(null,add);
  // If the Genius album's explicit API data is unavailable, only use an
  // image visually marked as this album's COVER, never generic og:image or
  // song art. The actual dimensions are checked on selection.
  if(!found.length){
   for(const img of [...document.querySelectorAll('img')].slice(0,250)){
    if(img.closest('#'+PANEL+',#gt-toolkit'))continue;
    const description=[img.alt,img.getAttribute('aria-label'),img.parentElement?.className,
     img.className].map(x=>typeof x==='string'?x:'').join(' ');
    if(!/(?:album.*(?:cover|art)|cover.*(?:art|image)|album[-_ ]?art)/i.test(description) ||
     /(?:profile|avatar|header|artist|thumbnail|track)/i.test(description))continue;
    const src=img.currentSrc||img.src;
    if(src)add(src);
    if(found.length>=3)break;
   }
  }
  return found.slice(0,4);
 }
 function build(){
  const panel=document.createElement('section');panel.id=PANEL;
  panel.setAttribute('aria-label','Album artwork lookup');
  panel.innerHTML=`
   <div class="gt-album-art-title"><span>Album artwork</span><span class="gt-album-art-dim">1000 × 1000</span></div>
   <div class="gt-album-art-frame"><img class="gt-album-art-preview" alt="Current album artwork"><span class="gt-album-art-placeholder" hidden>No cover art</span></div>
   <div class="gt-album-art-toolbar"><button type="button" class="gt-album-art-search">Find artwork</button><button type="button" class="gt-album-art-back" hidden>Back to album info</button></div>
   <details class="gt-album-art-query"><summary>Edit search</summary><label for="gt-album-art-title-input">Album</label><input type="text" id="gt-album-art-title-input" autocomplete="off" maxlength="150"><label for="gt-album-art-artist-input">Artist</label><input type="text" id="gt-album-art-artist-input" autocomplete="off" maxlength="150"></details>
   <div class="gt-album-art-next" hidden role="status" aria-live="polite"></div>
   <div class="gt-album-art-status" role="status" aria-live="polite"></div>
   <div class="gt-album-art-results" role="listbox" aria-label="Album artwork matches"></div>
   <label class="gt-album-art-url-label" for="gt-album-art-url">Cover art URL</label>
   <div class="gt-album-art-url-row"><input id="gt-album-art-url" type="url" spellcheck="false" placeholder="https://..." autocomplete="off"></div>
   <div class="gt-album-art-apply-actions"><button type="button" class="gt-album-art-apply" disabled>Apply artwork</button><button type="button" class="gt-album-art-copy" disabled>Copy link</button></div>
  `;
  return panel;
 }
 const dimensions=artwork.dimensions,validUrl=artwork.validUrl;
 async function copyValue(value){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}}catch{}
  const input=document.createElement('textarea');input.value=value;input.style.cssText='position:fixed;left:-2000px;top:0';
  document.body.append(input);input.select();let result=false;
  try{result=document.execCommand('copy');}catch{}
  input.remove();return result;
 }
 // The native Genius editor already wires `on-file-picked` to
 // `$ctrl.update(cover_art, url)` on <cover-art-form>. In Firefox, content
 // scripts use an isolated JS world; wrappedJSObject gives access to the
 // page's Angular instance without injecting code or exposing a new API.
 // Only address the *empty add-artwork tile*. Existing cover records must
 // never be selected implicitly, and no request is made during search.
 function findEmptyNativeCover(form,angular,ctrl){
  if(typeof ctrl?.visible_cover_arts!=='function')return null;
  const covers=ctrl.visible_cover_arts();
  if(!Array.isArray(covers))return null;
  const empty=cover=>cover&&typeof cover==='object'&&
   ![cover.image_url,cover.url,cover.cover_art_url].some(value=>typeof value==='string'&&value.trim());
  const tiles=[...form.querySelectorAll('.cover_art_form-cover_art_container[ng-repeat]')];
  for(const tile of tiles){
   if(!tile.querySelector('image-upload-button[on-file-picked]'))continue;
   let art;
   try{art=angular.element(tile).scope()?.cover_art;}catch{}
   if(art && covers.includes(art) && empty(art))return art;
  }
  // With Angular debugInfo disabled, ng-repeat scopes can be inaccessible.
  // The component's own visible-cover list still identifies the empty tile.
  const blanks=covers.filter(empty);
  return blanks.length===1?blanks[0]:null;
 }
 function callGeniusCoverUpdate(form,url,page=window){
  const angular=(page?.wrappedJSObject||page)?.angular;
  if(typeof angular?.element!=='function')return {ok:false,reason:'angular-unavailable'};
  let element,ctrl,scope;
  try{
   element=angular.element(form);
   ctrl=element.controller('coverArtForm');
   scope=element.isolateScope?.()||element.scope?.();
   ctrl=ctrl||scope?.$ctrl;
  }catch{return {ok:false,reason:'controller-unavailable'};}
  if(typeof ctrl?.update!=='function')return {ok:false,reason:'controller-unavailable'};
  const target=findEmptyNativeCover(form,angular,ctrl);
  if(!target)return {ok:false,reason:'no-empty-cover-slot'};
  try{
   // `update` is Genius's own handler; we do not forge a Genius API request.
   // It can persist immediately, so call it only after an explicit click.
   const pending=ctrl.update(target,url);
   try{scope?.$applyAsync?.();}catch{}
   return {ok:true,pending};
  }catch(e){return {ok:false,reason:'native-update-failed',error:String(e?.message||e)};}
 }
 async function applyNativeCover(ctx,url,isCurrent=()=>true){
  if(!isCurrent()||!ctx.modal.isConnected)return {ok:false,reason:'stale'};
  if(ctx.isInfoDirty())return {ok:false,reason:'unsaved-info'};
  // This changes the current tab in the *same* album modal, not the Filestack
  // file picker. The user remains in the editor throughout.
  ctx.tab2.click();
  for(let attempt=0;attempt<12;attempt++){
   if(!isCurrent()||!ctx.modal.isConnected)return {ok:false,reason:'stale'};
   const form=ctx.modal.querySelector('cover-art-form[cover-arts][type="album"]');
   if(form){
    const result=callGeniusCoverUpdate(form,url);
    if(result.ok && result.pending && typeof result.pending.then==='function'){
     try{
      const reply=await result.pending;
      const hasErrors=globalThis.GeniusToolkitApiErrors?.hasErrors;
      if(typeof hasErrors==='function'&&(hasErrors(reply)||hasErrors(reply?.data))){
       return {ok:false,reason:'native-update-rejected',error:'Genius reported an upload error'};
      }
     }catch(e){return {ok:false,reason:'native-update-rejected',error:String(e?.message||e)};}
    }
    return {ok:result.ok,reason:result.reason||null,error:result.error||null};
   }
   await new Promise(resolve=>setTimeout(resolve,120));
  }
  return {ok:false,reason:'cover-editor-not-mounted'};
 }
 function install(found){
  const {modal,group,tab1,tab2}=found;
  if(group.querySelector('#'+PANEL))return;
  const panel=build();
  const meta=infoFromModal(modal);
  const heading=document.createElement('div');heading.className='gt-album-workspace-heading';heading.textContent='Edit album';
  // Keep the Angular nav nodes in the DOM (including event bindings).
  group.prepend(heading);
  group.appendChild(panel);
  group.classList.add('gt-album-modal-tabs');
  modal.classList.add('gt-album-modal-root');
  // The native dialog can draw its frame on a wrapper outside the content node.
  // Only mark tight wrappers, never the full-screen backdrop/overlay.
  const modalRect=modal.getBoundingClientRect();
  let wrapper=modal.parentElement;
  for(let depth=0;wrapper&&depth<3;depth++,wrapper=wrapper.parentElement){
   const r=wrapper.getBoundingClientRect();
   if(!r.width||!r.height||r.width>window.innerWidth*.97||r.height>window.innerHeight*.97)break;
   if(r.width-modalRect.width>72||r.height-modalRect.height>72)break;
   wrapper.classList.add('gt-album-modal-frame');
  }

  tab1.classList.add('gt-album-tab-native');tab2.classList.add('gt-album-tab-native');
  const initial=modalInput(modal).map(input=>[input,input.value]);
  const ctx={modal,tab1,tab2,isInfoDirty(){return initial.some(([input,value])=>input.isConnected&&input.value!==value);}};
  const title=panel.querySelector('#gt-album-art-title-input'),artist=panel.querySelector('#gt-album-art-artist-input');
  title.value=meta.album;artist.value=meta.artist;
  const src=currentArt(),image=panel.querySelector('.gt-album-art-preview'),placeholder=panel.querySelector('.gt-album-art-placeholder');
  if(src){image.src=src;image.onerror=()=>{image.hidden=true;placeholder.hidden=false;};}
  else{image.hidden=true;placeholder.hidden=false;}
  const status=panel.querySelector('.gt-album-art-status'),results=panel.querySelector('.gt-album-art-results');
  const urlInput=panel.querySelector('#gt-album-art-url');
  const copyButton=panel.querySelector('.gt-album-art-copy');
  const applyButton=panel.querySelector('.gt-album-art-apply');
  const next=panel.querySelector('.gt-album-art-next');
  let selectedVersion=0,applying=false;
  const syncButtons=()=>{
   const ready=!!validUrl(urlInput.value);
   copyButton.disabled=!ready;
   applyButton.disabled=!ready||applying;
  };
  urlInput.addEventListener('input',()=>{
   selectedVersion++;syncButtons();next.hidden=true;
   for(const choice of results.querySelectorAll('.gt-album-art-choice'))choice.setAttribute('aria-selected','false');
  });
  urlInput.addEventListener('change',async()=>{
   const url=validUrl(urlInput.value);if(!url)return;
   const size=await dimensions(url);
   if(!panel.isConnected||url!==validUrl(urlInput.value))return;
   if(size?.width===1000&&size.height===1000){
    image.hidden=false;placeholder.hidden=true;image.src=url;
    status.textContent='1000 × 1000 artwork ready. Click Apply artwork to add it to Genius.';
   }else status.textContent='The image is not accessible at 1000 × 1000 pixels. Nothing changed in Genius.';
  });
  syncButtons();
  panel.querySelector('.gt-album-art-search').addEventListener('click',async()=>{
   // Refresh from Genius's live title field unless the user customized the search.
   const current=infoFromModal(modal);
   if(title.value.trim()===meta.album && current.album)title.value=current.album;
   if(artist.value.trim()===meta.artist && current.artist)artist.value=current.artist;
   const album=title.value.trim(),by=artist.value.trim();
   if(album.length<2||by.length<2){status.textContent='Enter the album title and artist under Edit search.';panel.querySelector('details').open=true;return;}
   const button=panel.querySelector('.gt-album-art-search');
   if(button.disabled)return;
   const request=++original.requestSeq;
   button.disabled=true;button.textContent='Searching…';results.replaceChildren();next.hidden=true;
   status.textContent='Searching Apple Music and Genius…';
   const path=versionPath();
   try {
    if(typeof browser==='undefined'||!browser.runtime?.sendMessage)throw Error('extension background messaging unavailable.');
    // Avoid confusing another album with the current Genius album when the
    // user deliberately changes the search fields.
    const route=routeInfo();
    const customSearch=compactName(album)!==compactName(meta.album)||compactName(by)!==compactName(meta.artist);
    const allowGenius=!customSearch && compactName(album)===compactName(route.album);
    // Start Genius in parallel for misses, but don't delay an exact Apple hit
    // while the Genius-side lookup is still reading the page's metadata.
    const geniusTask=allowGenius?geniusAlbumArtwork(album,by).catch(()=>[]):Promise.resolve([]);
    let reply;
    try{reply=await artwork.search({kind:'album',album,artist:by});}
    catch(e){reply={ok:false,error:String(e?.message||e)};}
    if(!panel.isConnected||request!==original.requestSeq||path!==versionPath())return;
    let options=Array.isArray(reply?.candidates)?reply.candidates:[];
    // A bad artist chip or page title should not stop matching any album.
    // Retry the canonical URL identity only when search wasn't customized.
    if(!options.length&&!customSearch&&route.album&&route.artist&&
      (compactName(route.artist)!==compactName(by)||compactName(route.album)!==compactName(album))){
     const fallback=await artwork.search({kind:'album',album:route.album,artist:route.artist});
     if(!panel.isConnected||request!==original.requestSeq||path!==versionPath())return;
     if(fallback?.ok)options=fallback.candidates||[];
     if(!reply?.ok)reply=fallback;
    }
    // An API failure must not discard a verified Genius candidate, but
    // without any results give a specific error instead of a false "no art".
    if(!options.length&&allowGenius){
     status.textContent='Checking the album’s artwork on Genius…';
     const genius=await geniusTask;
     if(!panel.isConnected||request!==original.requestSeq||path!==versionPath())return;
     options.push(...genius);
    }
    options=options.filter(x=>validUrl(x?.artwork)&&validUrl(x?.preview));
    const seen=new Set();
    options=options.filter(x=>{if(seen.has(x.artwork))return false;seen.add(x.artwork);return true;}).slice(0,14);
    if(!options.length&&!reply?.ok)throw Error(reply?.error||'Apple Music lookup unavailable');
    status.textContent=options.length?'Choose the correct artwork below.':'No matching artwork found in Apple Music or Genius. Check the album and artist under Edit search.';
    for(const c of options){
     if(!validUrl(c?.artwork)||!validUrl(c?.preview))continue;
     const button=document.createElement('button');button.type='button';button.className='gt-album-art-choice';button.setAttribute('role','option');button.setAttribute('aria-selected','false');
     const thumb=document.createElement('img');thumb.src=c.preview;thumb.alt='';thumb.loading='lazy';
     const desc=document.createElement('span');const albumName=document.createElement('strong');albumName.textContent=String(c.album||'');const artistName=document.createElement('small');artistName.textContent=String(c.artist||'')+' · '+String(c.source||'Apple Music');
     desc.append(albumName,artistName);button.append(thumb,desc);results.append(button);
     button.addEventListener('click',async()=>{
      if(button.disabled)return;
      const all=[...results.querySelectorAll('button')];all.forEach(item=>item.disabled=true);
      status.textContent='Verifying 1000 × 1000 artwork…';
      const size=await dimensions(c.artwork);
      if(!panel.isConnected||path!==versionPath()||request!==original.requestSeq)return;
      all.forEach(item=>item.disabled=false);
      if(size?.width!==1000||size?.height!==1000){status.textContent='This image is not 1000 × 1000; choose a different result.';return;}
      selectedVersion++;urlInput.value=c.artwork;syncButtons();
      image.hidden=false;placeholder.hidden=true;image.src=c.artwork;
      image.alt='Selected artwork preview (not yet applied)';
      all.forEach(item=>item.setAttribute('aria-selected',String(item===button)));
      // Searching or selecting never writes to Genius: explicit Apply only.
      next.hidden=true;
      status.textContent='1000 × 1000 artwork selected. Click Apply artwork to add it to Genius.';
     });
    }
   }catch(e){if(request===original.requestSeq&&panel.isConnected)status.textContent='Artwork lookup failed: '+String(e?.message||e);}
   finally{if(request===original.requestSeq&&panel.isConnected){button.disabled=false;button.textContent='Find artwork';}}
  });
  results.addEventListener('keydown',event=>{
   const items=[...results.querySelectorAll('button:not(:disabled)')];
   const index=items.indexOf(document.activeElement);
   if(index<0)return;
   if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
   }else if(event.key==='Escape'){event.preventDefault();panel.querySelector('.gt-album-art-search').focus();}
  });
  applyButton.addEventListener('click',async()=>{
   if(applying)return;
   const url=validUrl(urlInput.value);
   if(!url){status.textContent='Enter a valid HTTPS cover URL first.';return;}
   if(ctx.isInfoDirty()){
    status.textContent='Save your album info changes in Genius before applying cover artwork.';
    return;
   }
   const selection=selectedVersion,path=versionPath();
   const stillCurrent=()=>panel.isConnected&&path===versionPath()&&
    selection===selectedVersion&&validUrl(urlInput.value)===url;
   applying=true;syncButtons();next.hidden=true;
   status.textContent='Checking artwork dimensions…';
   try{
    const size=await dimensions(url);
    if(!stillCurrent())return;
    if(size?.width!==1000||size?.height!==1000){
     status.textContent='Only verified 1000 × 1000 artwork can be applied. Nothing changed.';
     return;
    }
    status.textContent='Applying through Genius’s album cover editor…';
    const result=await applyNativeCover(ctx,url,stillCurrent);
    if(!stillCurrent())return;
    if(result.ok){
     panel.querySelector('.gt-album-art-back').hidden=false;
     status.textContent='Artwork sent to Genius. Check its cover list; save if Genius prompts you.';
     next.hidden=true;
    }else if(result.reason==='unsaved-info'){
     status.textContent='Save your album info in Genius first, then click Apply artwork again.';
    }else if(result.reason!=='stale'){
     // Failure is non-destructive. Provide the original Genius URL uploader
     // path as fallback; never claim the cover was applied successfully.
     const copied=await copyValue(url);
     if(!stillCurrent())return;
     panel.querySelector('.gt-album-art-back').hidden=false;
     status.textContent=copied?'Direct apply isn’t available in this Genius editor. The artwork URL was copied.':
      'Direct apply isn’t available. Click Copy link to copy the artwork URL.';
     next.hidden=false;
     next.textContent='In the gray camera tile, choose Link (URL), paste the artwork URL, and confirm.';
    }
   }catch(e){
    if(stillCurrent())status.textContent='Couldn’t apply the artwork. Nothing was changed: '+String(e?.message||e);
   }finally{applying=false;if(panel.isConnected)syncButtons();}
  });
  panel.querySelector('.gt-album-art-copy').addEventListener('click',async()=>{
   const url=validUrl(urlInput.value);if(!url){status.textContent='Enter a valid HTTPS image URL first.';return;}
   const copied=await copyValue(url);
   status.textContent=copied?'Link copied. Paste it into Genius’s cover URL field (Ctrl+V), then save.':
    'Couldn’t copy automatically. Select the link above and press Ctrl+C.';
   next.hidden=false;
   next.textContent='Manual alternative: click the gray camera tile → Link (URL), paste the cover link and confirm.';
  });
  panel.querySelector('.gt-album-art-back').addEventListener('click',()=>{
   tab1.click();panel.querySelector('.gt-album-art-back').hidden=true;
   status.textContent='Album info is open. Selected artwork and its link are preserved.';
   next.hidden=true;
  });
  // Keep native Angular Save/Cancel; restyle only their verified nodes.
  for(const b of modal.querySelectorAll('button,[role="button"],a,input[type="submit"]')){
   if(b.closest('#'+PANEL))continue;
   if(/^save$/i.test(TEXT(b)||b.value||''))b.classList.add('gt-album-native-save');
   if(/^cancel$/i.test(TEXT(b)||b.value||''))b.classList.add('gt-album-native-cancel');
  }
 }
 let pending=false;
 function schedule(){if(pending||document.getElementById(PANEL))return;pending=true;setTimeout(()=>{
  pending=false;
  if(!albumPath()||document.getElementById(PANEL))return;
  const found=findModal();if(found)install(found);
 },170);}
 schedule();
 new MutationObserver(changes=>{
  if(changes.some(c=>!c.target?.closest?.('#'+PANEL+', #gt-toolkit, .gt-album-art-results')))schedule();
 }).observe(document.documentElement,{subtree:true,childList:true});
 addEventListener('popstate',schedule);
 globalThis.GeniusToolkitAlbumModalTests={findModal,infoFromModal,routeInfo,compactName,artworkVariants,albumCoverUrls,geniusAlbumArtwork,sameAlbumURL,sameAlbumSongURL,validUrl,dimensions,copyValue,findEmptyNativeCover,callGeniusCoverUpdate,applyNativeCover};
})();
