/* Genius Toolkit v0.4.0 — album-page tag writer.
 * Uses Genius's existing authenticated song API shape identified in
 * Uri6/Genius-Enhancer (permission granted by its author to the user).
 * Does not copy its source. Never creates tags or alters unrelated metadata.
 */
(() => {
  'use strict';
  const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const positiveId = value => { const n=Number(value); return Number.isSafeInteger(n)&&n>0?n:null; };
  const sameGeniusUrl = (url, origin = location.origin) => {
    try {
      const candidate=new URL(url,origin), base=new URL(origin);
      if(candidate.protocol!=='https:' || candidate.hostname.replace(/^www\./,'')!=='genius.com' ||
         base.hostname.replace(/^www\./,'')!=='genius.com') return null;
      return candidate.pathname.replace(/\/$/,'').toLowerCase();
    } catch { return null; }
  };
  // Album layouts do not all ship the same embedded metadata. Keep the
  // original strict mapping, but also accept alternate song-appearance shapes.
  // Never map a song by title or position: an exact Genius song URL is required.
  const albumSongCache=new Map();
  const albumCacheKey=key=>`${location.pathname.replace(/\/$/,'').toLowerCase()}|${key}`;
  function embeddedAlbumData(doc){
    const values=[];
    const metas=doc.querySelectorAll('meta[itemprop="page_data"],meta[property="page_data"]');
    for(const meta of [...metas].slice(0,8)){
      const content=meta.getAttribute('content')||'';
      if(content.length>3000000)continue;
      try{values.push(JSON.parse(content));}catch{}
    }
    for(const script of [...doc.querySelectorAll('script#__NEXT_DATA__,script[type="application/json"]')].slice(0,12)){
      const content=script.textContent||'';
      if(content.length>3000000||!/(?:album_appearances|song_appearances|"album")/.test(content))continue;
      try{values.push(JSON.parse(content));}catch{}
    }
    return values;
  }
  function albumSongEntries(data){
    const values=[data,data?.page_data,data?.album,data?.props?.pageProps,
      data?.props?.pageProps?.album,data?.response?.album].filter(Boolean);
    const entries=new Map();
    for(const value of values){
      for(const key of ['album_appearances','song_appearances','tracks','songs']){
        const list=value?.[key];
        if(!Array.isArray(list))continue;
        for(const item of list.slice(0,600)){
          const song=item?.song?.song||item?.song||item?.track?.song||item?.track||item;
          const id=positiveId(song?.id||item?.song_id);
          const url=typeof song?.url==='string'?song.url:item?.url;
          const path=typeof song?.api_path==='string'?song.api_path:`/songs/${id||''}`;
          const key=sameGeniusUrl(url);
          if(!id||!key||!/^\/songs\/\d+$/.test(path)||Number(path.split('/').pop())!==id)continue;
          entries.set(key,{key,id,path,title:String(song?.title||song?.title_with_featured||'').slice(0,250)});
        }
      }
    }
    return [...entries.values()];
  }
  function fromAlbumPage(doc=document){
    const found=new Map();
    for(const data of embeddedAlbumData(doc))for(const item of albumSongEntries(data))found.set(item.key,item);
    // Cache entries are scoped to this exact album route, never another page.
    for(const [cacheKey,item] of albumSongCache){
      if(cacheKey.startsWith(location.pathname.replace(/\/$/,'').toLowerCase()+'|'))found.set(item.key,item);
    }
    if(found.size)return [...found.values()];
    throw Error('Genius did not embed album song IDs. The toolkit will try verified song links instead.');
  }
  function albumIdFromPage(doc){
    for(const data of embeddedAlbumData(doc)){
      const id=positiveId(data?.album?.id||data?.album?.album?.id||
        data?.page_data?.album?.id||data?.props?.pageProps?.album?.id);
      if(id)return id;
    }
    return null;
  }
  function songIdInTrackRow(doc,key){
    const links=doc.querySelectorAll('.chart_row a[href], [data-testid*="track" i] a[href], [class*="tracklist" i] a[href]');
    for(const link of links){
      if(sameGeniusUrl(link.getAttribute('href'))!==key)continue;
      const row=link.closest('.chart_row,[data-testid*="track" i],[class*="tracklist" i]');
      const id=positiveId(link.getAttribute('data-song-id')||row?.getAttribute('data-song-id'));
      if(id)return id;
    }
    return null;
  }
  async function verifyAlbumSong(track,doc,albumId,signal){
    const key=sameGeniusUrl(track?.url);
    if(!key||!key.endsWith('-lyrics'))throw Error('Track has no valid Genius song URL.');
    const cached=albumSongCache.get(albumCacheKey(key));
    if(cached)return cached;
    let id=songIdInTrackRow(doc,key),finalKey=key;
    if(!id){
      const page=await boundedFetch(new URL(track.url,location.origin).href,
        {method:'GET',headers:{Accept:'text/html'},redirect:'follow'},signal,14000);
      if(!page.ok)throw Error(`Song page returned HTTP ${page.status}.`);
      finalKey=sameGeniusUrl(page.url);
      if(!finalKey||!finalKey.endsWith('-lyrics'))throw Error('Song page redirected outside Genius.');
      const html=await page.text();
      id=songIdFromHtml(html);
      if(!id)throw Error('Song page did not expose a verified numeric ID.');
    }
    const result=await jsonResult(await boundedFetch(`${location.origin}/api/songs/${id}`,
      {method:'GET',headers:{Accept:'application/json'}},signal,14000),'Verifying album song');
    const song=result?.response?.song;
    if(positiveId(song?.id)!==id)throw Error('Genius returned an unexpected song ID.');
    const apiKey=sameGeniusUrl(song?.url);
    if(!apiKey||(apiKey!==key&&apiKey!==finalKey))
      throw Error('Song ID does not match the album track URL.');
    const appearances=song?.album_appearances;
    if(albumId&&Array.isArray(appearances)&&appearances.length){
      const ids=appearances.map(a=>positiveId(a?.album?.id||a?.album_id)).filter(Boolean);
      if(ids.length&&!ids.includes(albumId))throw Error('Song does not belong to this album.');
    }
    const entry={key,id,path:`/songs/${id}`,title:String(song.title||track.title||'').slice(0,250)};
    albumSongCache.set(albumCacheKey(key),entry);
    if(albumSongCache.size>180)albumSongCache.delete(albumSongCache.keys().next().value);
    return entry;
  }
  // Resolve only the selected, explicitly linked album tracks. On alternate
  // layouts, fetch each song page and cross-check its numeric ID against the
  // authenticated Genius song API before allowing any write.
  async function resolveAlbumSongs(doc=document,tracks=[],signal,progress){
    let embedded=[];
    try{embedded=fromAlbumPage(doc);}catch{}
    const found=new Map(embedded.map(item=>[item.key,item]));
    const wanted=new Map();
    for(const track of tracks){
      const key=sameGeniusUrl(track?.url);
      if(key&&key.endsWith('-lyrics')&&!wanted.has(key))wanted.set(key,track);
    }
    if(!wanted.size)return {songs:[],unresolved:[]};
    const albumId=albumIdFromPage(doc);
    const missing=[...wanted].filter(([key])=>!found.has(key));
    // An album API response can contain the entire list; if it does, avoid
    // dozens of individual page requests. A failure here is not fatal.
    if(missing.length&&albumId){
      try{
        const data=await jsonResult(await boundedFetch(`${location.origin}/api/albums/${albumId}`,
          {method:'GET',headers:{Accept:'application/json'}},signal,10000),'Reading album');
        if(positiveId(data?.response?.album?.id)===albumId){
          for(const item of albumSongEntries(data)){
            if(wanted.has(item.key))found.set(item.key,item);
          }
        }
      }catch(error){if(signal?.aborted)throw error;}
    }
    const remaining=[...wanted].filter(([key])=>!found.has(key));
    const unresolved=[];
    let next=0,finished=0;
    async function worker(){
      while(next<remaining.length){
        if(signal?.aborted)throw Error('Stopped by user.');
        const [key,track]=remaining[next++];
        progress?.(`Verifying album song IDs: ${finished}/${remaining.length} checked…`);
        try{found.set(key,await verifyAlbumSong(track,doc,albumId,signal));}
        catch(error){if(signal?.aborted)throw error;unresolved.push({key,title:track.title||key,reason:String(error.message||error)});}
        finished++;
      }
    }
    await Promise.all(Array.from({length:Math.min(3,remaining.length)},()=>worker()));
    return {songs:[...wanted.keys()].map(key=>found.get(key)).filter(Boolean),unresolved};
  }
  function nativeTagList(html){
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const select=parsed.querySelector('select[name="tag_ids[]"], [name="tag_ids[]"]');
    if(!select)throw Error('Genius did not expose its existing-tag selector on /new.');
    const catalog=new Map();
    for(const option of select.querySelectorAll('option')){
      const id=positiveId(option.value), name=(option.textContent||'').replace(/\s+/g,' ').trim();
      if(id && name.length>=2 && name.length<=70 && !catalog.has(norm(name)))
        catalog.set(norm(name),{name,id});
    }
    if(catalog.size<8)throw Error('Genius did not provide enough existing tags to validate autocomplete.');
    return catalog;
  }
  const headers = () => ({'Accept':'application/json','Content-Type':'application/json','X-CSRF-Token':csrf()});
  function csrf(){
    let cookie='';
    try { cookie=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('_csrf_token='))||''; } catch {}
    let token='';
    if(cookie){try{token=decodeURIComponent(cookie.slice('_csrf_token='.length));}catch{}}
    if(!token)token=document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"]')?.getAttribute('content')||'';
    if(!token || token.length>1024)throw Error('The Genius login/CSRF token was unavailable. Sign in and reload the album.');
    return token;
  }
  async function boundedFetch(url, init, signal, ms=14000){
    const task=new AbortController();
    const timeout=setTimeout(()=>task.abort('timeout'),ms);
    const onAbort=()=>task.abort('stopped');
    if(signal?.aborted){clearTimeout(timeout);throw Error('Stopped by user.');}
    signal?.addEventListener('abort',onAbort,{once:true});
    try{
      return await fetch(url,{...init,credentials:'same-origin',redirect:init?.redirect==='follow'?'follow':'error',signal:task.signal});
    }catch(error){
      if(signal?.aborted)throw Error('Stopped by user.');
      if(task.signal.aborted)throw Error('Genius API did not respond within '+Math.ceil(ms/1000)+' seconds.');
      throw error;
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',onAbort);}
  }
  async function jsonResult(response, label){
    if(!response.ok){
      const error=Error(`${label}: Genius returned HTTP ${response.status}.`);
      error.status=response.status;
      throw error;
    }
    const json=await response.json().catch(()=>{throw Error(`${label}: expected JSON but received a different response.`);});
    if(json?.meta?.status && Number(json.meta.status)>=400){
      const error=Error(`${label}: Genius returned status ${json.meta.status}.`);error.status=Number(json.meta.status);throw error;
    }
    return json;
  }
  async function getSong(path,signal){
    const result=await jsonResult(await boundedFetch(`${location.origin}/api${path}`,
      {method:'GET',headers:{Accept:'application/json'}},signal),'Reading song');
    const song=result?.response?.song;
    if(!song || !Array.isArray(song.tags))throw Error('Song API response has no verified tags array; no edit was made.');
    return song;
  }
  // Build a catalog only from an explicitly identified Genius tag object
  // or from tag arrays in a song's actual API response. Never infer IDs from
  // search hits of other types (e.g. a song named after a genre).
  function collectExistingTags(json){
    const catalog=new Map(), seen=new WeakSet();
    function add(value){
      const id=positiveId(value?.id),name=typeof value?.name==='string'?value.name.trim():'';
      if(id&&name.length>=2&&name.length<=70)catalog.set(norm(name),{name,id});
    }
    function walk(value,depth=0,tagContext=false){
      if(!value||typeof value!=='object'||depth>12||seen.has(value))return;
      seen.add(value);
      if(Array.isArray(value)){
        for(const entry of value.slice(0,1000))walk(entry,depth+1,tagContext);
        return;
      }
      const type=String(value.type||value._type||value.result_type||'').toLowerCase();
      if(tagContext||type==='tag'||type==='tags'||
         (value.slug&&/^https:\/\/genius\.com\/tags\//i.test(String(value.url||''))))add(value);
      for(const [key,child] of Object.entries(value).slice(0,800)){
        if(child&&typeof child==='object')
          walk(child,depth+1,key==='tag'||key==='tags'||(tagContext&&Array.isArray(child)));
      }
    }
    walk(json);return catalog;
  }

  function tagSlugs(name){
    // The tag page URL is public and independent of the album being edited.
    // Genius commonly uses hyphenated names (e.g. /tags/reggae).
    const base=String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/&/g,' ').replace(/['’]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const list=[base];
    if(/&/.test(name))list.push(String(name).toLowerCase().replace(/&/g,'-b').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
    return [...new Set(list.filter(Boolean))].slice(0,2);
  }

  function tagPageSources(html,wanted){
    if(!html||html.length>4500000)throw Error('Genius returned an unusable tag page.');
    const doc=new DOMParser().parseFromString(html,'text/html');
    const candidates=[];
    const keys=new Map();
    const addCatalog=data=>{
      if(!data||typeof data!=='object')return;
      const item=collectExistingTags(data).get(norm(wanted));
      if(item)keys.set(norm(item.name),item);
    };
    // Some Genius page types expose the tag in their embedded page_data.
    for(const meta of [...doc.querySelectorAll('meta[itemprop="page_data"],meta[property="page_data"]')].slice(0,5)){
      try{addCatalog(JSON.parse(meta.getAttribute('content')||''));}catch{}
    }
    for(const script of [...doc.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')].slice(0,12)){
      try{addCatalog(JSON.parse(script.textContent||''));}catch{}
    }
    const seen=new Set();
    for(const a of [...doc.querySelectorAll('a[href]')].slice(0,3500)){
      const href=a.getAttribute('href')||'';
      const path=sameGeniusUrl(href);
      if(!path||(!/-lyrics$/.test(path)&&!/^\/songs\/\d+$/.test(path))||seen.has(path))continue;
      seen.add(path);
      const dataId=positiveId(a.getAttribute('data-song-id')||a.closest('[data-song-id]')?.getAttribute('data-song-id'));
      candidates.push({url:new URL(href,location.origin).href,id:/^\/songs\/(\d+)$/.test(path)?positiveId(path.split('/')[2]):dataId});
      if(candidates.length>=20)break;
    }
    return {verified:keys.get(norm(wanted))||null,candidates};
  }

  function songIdFromHtml(html){
    if(!html||html.length>4500000)return null;
    // Genius's own mobile-app metadata contains an exact numeric song ID.
    // Example: <meta content="genius://songs/1234" name="twitter:app:url:iphone">
    const appId=html.match(/\bcontent=["']genius:\/\/songs\/(\d+)["']/i);
    if(appId)return positiveId(appId[1]);
    const doc=new DOMParser().parseFromString(html,'text/html');
    const metas=[...doc.querySelectorAll('meta[itemprop="page_data"],meta[property="page_data"]')];
    for(const meta of metas.slice(0,8)){
      try{
        const data=JSON.parse(meta.getAttribute('content')||'');
        const id=positiveId(data?.song?.id||data?.song_id||data?.song?.song?.id);
        if(id)return id;
      }catch{}
    }
    // Some newer song templates store a numeric song ID in JSON script data.
    for(const script of [...doc.querySelectorAll('script[type="application/json"]')].slice(0,8)){
      try{
        const data=JSON.parse(script.textContent||'');
        const id=positiveId(data?.song?.id||data?.props?.pageProps?.song?.id);
        if(id)return id;
      }catch{}
    }
    return null;
  }

  // Verified Genius tag IDs are stored in the extension's own persistent
  // browser.storage.local, not genius.com's origin localStorage. No automatic
  // expiry: entries can be explicitly cleared and refreshed in the tag editor.
  const verifiedTagIds=new Map();
  const pendingLookups=new Map();
  const CACHE_KEY='gt-verified-tag-ids-v2';
  let persistQueue=Promise.resolve();
  const cacheReady=(async()=>{
    try{
      const saved=(await browser.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};
      for(const [key,item] of Object.entries(saved).slice(0,1500)){
        if(item && positiveId(item.id) && norm(item.name)===key){
          verifiedTagIds.set(key,{name:item.name,id:positiveId(item.id)});
        }
      }
      // Migrate the verified 0.3.9 cache on the first upgrade (one-time).
      if(!verifiedTagIds.size){
        const previous=JSON.parse(localStorage.getItem('gt-verified-tag-ids-v1')||'{}');
        for(const [key,item] of Object.entries(previous)){
          if(item && positiveId(item.id) && norm(item.name)===key){
            verifiedTagIds.set(key,{name:item.name,id:positiveId(item.id)});
          }
        }
        if(verifiedTagIds.size)await saveCache();
      }
    }catch(error){console.warn('[Genius Toolkit] Tag cache unavailable:',error);}
  })();
  function saveCache(){
    const snapshot=Object.fromEntries([...verifiedTagIds].slice(-1200));
    persistQueue=persistQueue.catch(()=>{}).then(()=>browser.storage.local.set({[CACHE_KEY]:snapshot}));
    return persistQueue;
  }
  function rememberTag(key,tag){
    const verified={name:String(tag.name),id:positiveId(tag.id)};
    if(!verified.id||norm(verified.name)!==key)throw Error('Cannot cache an unverified tag.');
    verifiedTagIds.delete(key);
    verifiedTagIds.set(key,verified);
    void saveCache().catch(error=>console.warn('[Genius Toolkit] Could not persist verified tag ID',error));
  }
  async function getCachedTag(name){
    await cacheReady;
    return verifiedTagIds.get(norm(name))||null;
  }
  async function clearCachedTags(){
    await cacheReady;
    verifiedTagIds.clear();
    // Also prevent the old origin-based cache from restoring stale IDs.
    try{localStorage.removeItem('gt-verified-tag-ids-v1');}catch{}
    await saveCache();
  }
  async function resolveGeniusTag(name,signal){
    const query=String(name||'').trim(),key=norm(query);
    if(query.length<2||query.length>70)throw Error('Invalid tag name.');
    await cacheReady;
    if(verifiedTagIds.has(key))return verifiedTagIds.get(key);
    // Multiple selections requesting the same tag share one lookup. A caller
    // abort is handled at the UI/batch level, not by killing other callers.
    if(pendingLookups.has(key))return pendingLookups.get(key);
    const task=resolveUncachedTag(query,key,signal);
    pendingLookups.set(key,task);
    try{return await task;}
    finally{if(pendingLookups.get(key)===task)pendingLookups.delete(key);}
  }
  async function resolveUncachedTag(query,key,signal){
    const notes=[];
    for(const slug of tagSlugs(query)){
      if(signal?.aborted)throw Error('Stopped by user.');
      let sources;
      try{
        // Tag pages can be considerably slower than the song API. Allow a
        // longer deadline and one retry on a transient network timeout.
        let lastError;
        for(let attempt=0;attempt<2;attempt++){
          if(signal?.aborted)throw Error('Stopped by user.');
          try{
            const response=await boundedFetch(`${location.origin}/tags/${slug}`,
              {method:'GET',headers:{Accept:'text/html'}},signal,25000);
            if(!response.ok)throw Error(`tag page returned HTTP ${response.status}`);
            const type=String(response.headers?.get('content-type')||'');
            if(type&&!type.includes('html'))throw Error('tag page did not return HTML');
            sources=tagPageSources(await response.text(),query);
            lastError=null;
            break;
          }catch(error){
            lastError=error;
            if(signal?.aborted)throw error;
            if(!/within \d+ seconds|network|fetch failed|failed to fetch/i.test(String(error.message)))break;
          }
        }
        if(lastError)throw lastError;
      }catch(error){if(signal?.aborted)throw error;notes.push(error.message);continue;}
      if(sources.verified){rememberTag(key,sources.verified);return sources.verified;}
      // Use reference songs displayed on this tag's public page. No write is
      // made to them. An exact tag match in /api/songs/:id is proof of the ID.
      for(const source of sources.candidates.slice(0,6)){
        if(signal?.aborted)throw Error('Stopped by user.');
        try{
          let id=source.id;
          if(!id){
            const page=await boundedFetch(source.url,{method:'GET',headers:{Accept:'text/html'}},signal,20000);
            if(!page.ok)continue;
            id=songIdFromHtml(await page.text());
          }
          if(!id)continue;
          const song=await getSong(`/songs/${id}`,signal);
          const matches=song.tags.filter(t=>norm(t?.name)===key&&positiveId(t?.id));
          if(matches.length===1){
            const verified={name:matches[0].name,id:positiveId(matches[0].id)};
            rememberTag(key,verified);return verified;
          }
        }catch(error){if(signal?.aborted)throw error;notes.push(error.message);}
      }
      notes.push(`no matching song metadata found on /tags/${slug}`);
    }
    // Never substitute an unverified ID or create a tag, even when the
    // approved spreadsheet includes its name.
    throw Error(`Could not find a verified Genius ID for "${query}" using its public tag page and tagged songs. No songs were changed. ${notes.slice(-2).join('; ')}`);
  }
  async function getGeniusTags(){return new Map();}
  function mergedTags(existing,requested){
    if(!Array.isArray(existing)||!Array.isArray(requested))throw Error('Invalid tag list.');
    const seen=new Set(),out=[];
    for(const t of existing){
      const id=positiveId(t?.id), name=String(t?.name||'').trim();
      if(!id || !name)throw Error('An existing Genius tag has invalid metadata; refusing to modify the song.');
      if(!seen.has(id)){seen.add(id);out.push({name,id});}
    }
    let added=0;
    for(const t of requested){
      const id=positiveId(t?.id),name=String(t?.name||'').trim();
      if(!id||name.length<2||name.length>70)throw Error('Refusing to submit an unresolved tag.');
      if(!seen.has(id)){seen.add(id);out.push({name,id});added++;}
    }
    return {tags:out,added};
  }
  async function applyToSong(song,tagObjects,signal){
    if(signal?.aborted)throw Error('Stopped by user.');
    if(!/^\/songs\/\d+$/.test(song?.path||'')||!positiveId(song?.id)||Number(song.path.slice(7))!==song.id)
      throw Error('Invalid Genius song ID; no write attempted.');
    if(!Array.isArray(tagObjects)||tagObjects.length===0||tagObjects.length>12)
      throw Error('Choose 1–12 approved Genius tags.');
    // This is additive; existing tags are always retained.
    const original=await getSong(song.path,signal);
    const originalIds=new Set(original.tags.map(t=>positiveId(t?.id)));
    const {tags,added}=mergedTags(original.tags,tagObjects);
    if(!added)return {status:'unchanged',message:'all selected tags already exist on this song'};
    const result=await jsonResult(await boundedFetch(`${location.origin}/api${song.path}`,
      {method:'PUT',headers:headers(),body:JSON.stringify({text_format:'html,markdown',song:{tags}})},signal),
      'Saving song tags');
    if(globalThis.GeniusToolkitApiErrors.hasErrors(result))throw Error('Genius reported an error while saving tags.');
    // Read-back prevents accepting a 200 response as proof that tags persisted.
    // It also confirms that the additive write did not drop existing tags.
    const after=await getSong(song.path,signal);
    const ids=new Set(after.tags.map(t=>positiveId(t?.id)));
    if(![...originalIds].every(id=>ids.has(id)) || !tagObjects.every(t=>ids.has(Number(t.id))))
      throw Error('Genius accepted the request but the saved tags did not verify. Check this song manually.');
    return {status:'done',message:`verified ${added} new tag${added===1?'':'s'}; existing tags preserved`};
  }
  async function removeFromSong(song,tagNames,signal){
    if(signal?.aborted)throw Error('Stopped by user.');
    if(!/^\/songs\/\d+$/.test(song?.path||'')||!positiveId(song?.id)||Number(song.path.slice(7))!==song.id)
      throw Error('Invalid Genius song ID; no write attempted.');
    if(!Array.isArray(tagNames)||tagNames.length===0||tagNames.length>12 ||
       !tagNames.every(name=>typeof name==='string'&&name.trim().length>=2&&name.length<=70))
      throw Error('Choose 1–12 approved tags to remove.');
    const wanted=new Set(tagNames.map(norm));
    const original=await getSong(song.path,signal);
    const originalTags=mergedTags(original.tags,[]).tags;
    const remaining=originalTags.filter(t=>!wanted.has(norm(t.name)));
    const removed=originalTags.length-remaining.length;
    if(!removed)return {status:'unchanged',message:'none of the selected tags appear on this song'};
    const result=await jsonResult(await boundedFetch(`${location.origin}/api${song.path}`,
      {method:'PUT',headers:headers(),body:JSON.stringify({text_format:'html,markdown',song:{tags:remaining}})},signal),
      'Removing song tags');
    if(globalThis.GeniusToolkitApiErrors.hasErrors(result))throw Error('Genius reported an error while removing tags.');
    const after=await getSong(song.path,signal);
    const afterIds=new Set(after.tags.map(t=>positiveId(t?.id)));
    if(after.tags.some(t=>wanted.has(norm(t?.name))) ||
       !remaining.every(t=>afterIds.has(t.id)))
      throw Error('Genius accepted the removal but the saved tags did not verify. Check this song manually.');
    return {status:'done',message:`verified ${removed} tag${removed===1?'':'s'} removed; other tags preserved`};
  }
  globalThis.GeniusToolkitTagApi={norm,positiveId,sameGeniusUrl,fromAlbumPage,albumIdFromPage,albumSongEntries,resolveAlbumSongs,nativeTagList,
    getGeniusTags,resolveGeniusTag,collectExistingTags,tagSlugs,tagPageSources,songIdFromHtml,mergedTags,applyToSong,removeFromSong,getCachedTag,clearCachedTags};
})();
