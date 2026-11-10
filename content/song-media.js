/* v0.10.13 — explicit song artwork selection, with verified Genius fallback. */
(() => {
 'use strict';
 const ID='gt-song-art-helper';
 const artwork=globalThis.GeniusToolkitArtwork;
 const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
 const positiveId=v=>/^\d+$/.test(String(v||''))&&Number(v)>0?String(v):null;
 function pageData(){
  for(const meta of document.querySelectorAll('meta[itemprop="page_data"],meta[property="page_data"]')){
   try {const d=JSON.parse(meta.content),s=d.song?.song||d.song||d.page_data?.song;
    if(s && typeof s==='object')return s;}catch{}
  }
  return null;
 }
 function songId(){
  const match=location.pathname.match(/^\/songs\/(\d+)(?:\/|$)/i);
  if(match)return positiveId(match[1]);
  for(const m of document.querySelectorAll('meta[content^="genius://songs/"]')){
   const id=positiveId(m.content.split('/').pop());if(id)return id;
  }
  return positiveId(pageData()?.id);
 }
 const geniusImage=url=>artwork.geniusVariants(url)[0]||null;
 function artistAppleId(s){
  const a=s?.primary_artist||s?.artist;
  return positiveId(a?.apple_music_id)||null;
 }
 function standaloneGeniusArt(s){
  // Genius sometimes inherits the album cover as song art. Only offer artwork
  // explicitly different from that album cover, or a dedicated custom-song URL.
  const image=geniusImage(s?.custom_song_art_image_url||s?.song_art_image_url);
  const album=s?.album?.cover_art_url||s?.album?.cover_art_thumbnail_url||null;
  if(!image)return null;
  if(album&&artwork.sameGeniusImage(image,album))return null;
  if(!album&&!s?.custom_song_art_image_url)return null;
  return image;
 }
 function albumName(s){
  return String(s?.album?.name||s?.album?.title||s?.albums?.find?.(a=>a?.name)?.name||'').trim();
 }
 function songInfo(){
  const s=pageData();
  let album=albumName(s),artist=String(s?.primary_artist?.name||s?.artist?.name||'').trim();
  if(!album){
   const a=[...document.querySelectorAll('a[href*="/albums/"]')].find(a=>text(a).length>1);
   if(a)album=text(a);
  }
  if(!artist){
   const a=[...document.querySelectorAll('a[href*="/artists/"]')].find(a=>text(a).length>1);
   if(a)artist=text(a);
  }
  return {id:songId(),title:String(s?.title||s?.title_with_featured||document.querySelector('meta[property="og:title"]')?.content?.split(' Lyrics')[0]||'').trim(),album,artist,appleId:positiveId(s?.apple_music_id),appleArtistId:artistAppleId(s),geniusArtwork:standaloneGeniusArt(s)};
 }
 async function fromGenius(){
  const data=songInfo();
  if(!data.id)return data;
  try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9500);
   let res;
   try{res=await fetch('/api/songs/'+data.id,{credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal});}
   finally{clearTimeout(timer);}
   if(!res.ok)return data;
   const json=await res.json(),s=json?.response?.song;
   if(String(s?.id)!==data.id)return data;
   return {...data,title:String(s?.title||data.title).trim(),album:albumName(s)||data.album,
    artist:String(s?.primary_artist?.name||data.artist).trim(),
    appleId:positiveId(s?.apple_music_id)||data.appleId,
    appleArtistId:artistAppleId(s)||data.appleArtistId,
    geniusArtwork:standaloneGeniusArt(s)||data.geniusArtwork};
  }catch{return data;}
 }
 function locate(){
  // Genius can use plain text nodes instead of <label> and mount the editor later.
  const visible=el=>!!(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const inputs=[...document.querySelectorAll('input:not([type=hidden]),textarea')].filter(el=>visible(el)&&!el.closest('#'+ID+',.gt-song-art-input-row'));
  for(const field of inputs){
   const id=String(field.id||'').toLowerCase();
   const name=String(field.name||'').toLowerCase();
   if(/song[_-]?art|song[_-]?image|cover[_-]?art/.test(id+' '+name))return {field};
  }
  for(const field of inputs){
   // Limit the text search to nearby elements to avoid matching a sidebar or unrelated controls.
   let node=field.parentElement;
   for(let depth=0;node&&depth<4;depth++,node=node.parentElement){
    const labels=[...node.querySelectorAll('label,span,div,p,strong,h3,h4')].filter(el=>el.children.length===0 && /^song art$/i.test(text(el)) && visible(el));
    if(labels.length && node.querySelectorAll('input:not([type=hidden]),textarea').length<=2)return {field};
    const prev=node.previousElementSibling;
    if(prev && /^song art$/i.test(text(prev)) && visible(prev))return {field};
   }
  }
  return null;
 }
 // Only an explicit artwork choice may replace a populated Genius field.
 // If the user edits the field during image verification, do not overwrite it.
 function setValue(field,value,expectedValue){
  if(!field||field.disabled||field.readOnly||field.value!==expectedValue)return false;
  const proto=field instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
  if(setter)setter.call(field,value);else field.value=value;
  field.dispatchEvent(new Event('input',{bubbles:true}));
  field.dispatchEvent(new Event('change',{bubbles:true}));
  return field.value===value;
 }
 const dimensions=artwork.dimensions;
 function findArtworkColumnHost(field, nativeWidth){
  // Use the existing Song Art row, so the native thumbnail/label/input keep
  // their original parentage. Genius's art row is typically a flex container.
  // Never attach to the wider Media & Audio editor (which has other fields).
  let node=field.parentElement;
  for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
   const inputs=node.querySelectorAll('input:not([type=hidden]),textarea');
   if(inputs.length!==1||inputs[0]!==field)break;
   const display=getComputedStyle(node).display;
   if(display!=='flex'&&display!=='inline-flex')continue;
   if(node.children.length<2||!Array.from(node.children).some(child=>child.contains(field)))continue;
   const rect=node.getBoundingClientRect();
   if(rect.width>=nativeWidth+110)return node;
  }
  return null;
 }
 function updateSongArtHint(field){
  // Edit only the hint associated with the native Song Art URL input.
  // Other Media & Audio hints (e.g. YouTube) must stay untouched.
  let node=field.parentElement;
  for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
   const fields=node.querySelectorAll('input:not([type=hidden]),textarea');
   if(fields.length!==1||fields[0]!==field)break;
   const hints=[...node.querySelectorAll('small,span,p,div,label')]
    .filter(el=>!el.children.length && /^enter a url$/i.test(text(el))
      && !!(field.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));
   if(hints.length){hints[0].textContent='Or enter a URL';return true;}
  }
  return false;
 }
 function install({field}){
  if(document.getElementById(ID)||field.closest('#'+ID))return;
  const nativeWidth=field.getBoundingClientRect().width;
  const columnHost=findArtworkColumnHost(field,nativeWidth);
  updateSongArtHint(field);
  const root=document.createElement('div');root.id=ID;root.className='gt-song-art-helper';
  // Only wrap the URL input. The native label, thumbnail and hint stay in place.
  const row=document.createElement('div');row.className='gt-song-art-input-row';
  row.style.maxWidth=Math.round(nativeWidth)+'px';
  const button=document.createElement('button');button.type='button';button.textContent='Autofill';
  button.className='gt-song-art-button';
  button.setAttribute('aria-label','Find song artwork options without changing the current artwork');
  const font=getComputedStyle(field).fontFamily;
  if(font)button.style.fontFamily=font;
  field.parentNode.insertBefore(row,field);
  row.append(button,field);
  const status=document.createElement('div');status.className='gt-song-art-status';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const results=document.createElement('div');results.className='gt-song-art-results';
  root.append(status,results);
  // Place lookup status and artwork choices in their own column to the
  // right of the native Song Art URL area, never inside its input/label.
  // If Genius uses an unknown layout, keep the safe inline fallback.
  if(columnHost){
   columnHost.classList.add('gt-song-art-column-host');
   // Genius sometimes adds its own margin to the URL column. Clear that
   // margin so the gap matches the rest of the native Media & Audio grid.
   const formColumn=[...columnHost.children].find(child=>child.contains(field));
   if(formColumn)formColumn.classList.add('gt-song-art-field-column');
   columnHost.appendChild(root);
  }else{
   row.parentElement.appendChild(root);
  }
  let lookupSeq=0;
  button.addEventListener('click',async()=>{
   if(button.disabled)return;
   const request=++lookupSeq;
   button.disabled=true;button.textContent='Searching…';results.replaceChildren();
   status.textContent='Searching for standalone single artwork… Current artwork will not change.';
   const path=location.pathname;
   try{
    const info=await fromGenius();
    if(!row.isConnected||path!==location.pathname||request!==lookupSeq)return;
    if(!info.title||!info.artist)throw Error('song title or artist information is missing.');
    const reply=await artwork.search({kind:'single',...info});
    if(!reply?.ok&&!info.geniusArtwork)throw Error(reply?.error||'lookup unavailable');
    if(!row.isConnected||path!==location.pathname||request!==lookupSeq)return;
    const choices=Array.isArray(reply?.candidates)?reply.candidates.slice():[];
    if(info.geniusArtwork&&!choices.some(c=>c.artwork===info.geniusArtwork))choices.push({
     album:info.title+' (song artwork)',artist:info.artist,artwork:info.geniusArtwork,
     preview:info.geniusArtwork,source:'Genius song art'
    });
    if(!choices.length){
     status.textContent='No verified standalone single artwork found on Apple Music or Genius. Current artwork unchanged.';
     return;
    }
    status.textContent='Choose an artwork option to replace the current song art. Nothing changes until you click one.';
    for(const item of choices){
     const choice=document.createElement('button');choice.type='button';choice.className='gt-song-art-choice';
     choice.setAttribute('aria-pressed','false');
     const thumb=document.createElement('img');thumb.src=item.preview;thumb.alt='';thumb.loading='lazy';
     const title=document.createElement('span');title.textContent=item.album+' — '+item.artist+' · '+String(item.source||'Apple Music');
     choice.append(thumb,title);results.append(choice);
     choice.addEventListener('click',async()=>{
      if(choice.disabled||button.disabled||request!==lookupSeq)return;
      // Snapshot the native field before the asynchronous size check. This is
      // an explicit replacement, but must never clobber newer manual edits.
      const previous=field.value;
      const all=[...results.querySelectorAll('button')];
      all.forEach(el=>el.disabled=true);button.disabled=true;
      status.textContent='Verifying 1000 × 1000 image…';
      try{
       const size=await dimensions(item.artwork);
       if(!row.isConnected||path!==location.pathname||request!==lookupSeq)return;
       if(size?.width!==1000||size?.height!==1000){
        status.textContent='This artwork is not 1000 × 1000; current artwork unchanged.';return;
       }
       if(field.value!==previous){
        status.textContent='The song art field changed while verifying. Nothing replaced; select again if needed.';return;
       }
       if(previous===item.artwork){
        status.textContent='This artwork is already selected. No changes needed.';
       }else if(setValue(field,item.artwork,previous)){
        status.textContent='Song art updated. Review and save in Genius.';
       }else{
        status.textContent='Could not update the native song art field. Nothing replaced.';return;
       }
       all.forEach(el=>el.setAttribute('aria-pressed',String(el===choice)));
      }catch(error){
       if(row.isConnected&&request===lookupSeq)status.textContent='Could not verify artwork: '+String(error?.message||error)+'. Current artwork unchanged.';
      }finally{
       if(request===lookupSeq&&row.isConnected){
        all.forEach(el=>el.disabled=false);button.disabled=false;
       }
      }
     });
    }
   }catch(error){if(request===lookupSeq&&row.isConnected)status.textContent='Artwork lookup failed: '+String(error?.message||error);}
   finally{if(request===lookupSeq&&row.isConnected){button.disabled=false;button.textContent='Autofill';}}
  });
 }
 let pending=false;
 function scan(){
  pending=false;
  if(!/^\/(?:songs\/\d+|[^/]+-lyrics)(?:\/|$)/i.test(location.pathname))return;
  const found=locate();
  if(found&&!document.getElementById(ID))install(found);
 }
 function schedule(){if(pending)return;pending=true;setTimeout(scan,150);}
 schedule();
 new MutationObserver(changes=>{
  if(changes.some(c=>!c.target?.closest?.('#'+ID+',.gt-song-art-input-row')))schedule();
 }).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('popstate',schedule);
 globalThis.GeniusToolkitSongArtTests={pageData,songId,songInfo,locate,setValue,dimensions,fromGenius,normalize,geniusImage,standaloneGeniusArt};
})();
