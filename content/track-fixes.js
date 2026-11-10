/* Genius Toolkit: safe comparison-assisted title changes . */
(() => {
  'use strict';
  function validTitle(value){
    const title=String(value??'').trim();
    if(!title||title.length>200||/[\r\n<>]/.test(title))throw Error('Invalid song title; no changes were made.');
    return title;
  }
  function normalize(value){return String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase();}
  function csrf(){
    const token=document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"]')?.getAttribute('content')||
      (document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('_csrf_token='))||'').slice(12);
    if(!token)throw Error('Sign in to Genius, then reload the album to obtain an editing token.');
    try{return decodeURIComponent(token);}catch{return token;}
  }
  async function request(path, init, timeout=18000){
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const response=await fetch(`${location.origin}${path}`,{...init,credentials:'same-origin',redirect:'error',signal:ctrl.signal});
      if(!response.ok)throw Error(`Genius returned HTTP ${response.status}`);
      const payload=await response.json();
      if(globalThis.GeniusToolkitApiErrors.hasErrors(payload))throw Error('Genius rejected the update.');
      return payload;
    }catch(error){if(ctrl.signal.aborted)throw Error('Genius took too long to respond. Check the song before retrying.');throw error;}
    finally{clearTimeout(timer);}
  }
  async function songById(id){
    const data=await request(`/api/songs/${id}`,{method:'GET',headers:{Accept:'application/json'}});
    const song=data?.response?.song;
    if(!song||!Number.isSafeInteger(Number(song.id))||Number(song.id)!==id||typeof song.title!=='string'||!Array.isArray(song.tags))
      throw Error('Genius returned incomplete song metadata; nothing was changed.');
    return song;
  }
  async function songId(track){
    const api=globalThis.GeniusToolkitTagApi;
    if(!api?.resolveAlbumSongs)throw Error('Album song resolver is unavailable. Reload the extension.');
    const {songs}=await api.resolveAlbumSongs(document,[track]);
    const key=api.sameGeniusUrl(track?.url);
    const match=key&&songs.find(entry=>entry.key===key);
    if(!match||!Number.isSafeInteger(Number(match.id))||Number(match.id)<=0)
      throw Error('Could not verify this song belongs to the current album.');
    return match.id;
  }
  function containsOriginalTitle(apiTitle,rowTitle){
    // Match the same display-title cleanup used by the tracklist scanner,
    // including nested artist qualifiers such as "Strings (Rap)".
    const clean=s=>normalize(globalThis.GeniusToolkitTitles.cleanAlbumTrackTitle(s));
    return clean(apiTitle)===clean(rowTitle);
  }
  async function renameSong(track,newTitle){
    const title=validTitle(newTitle),id=await songId(track);
    const original=await songById(id);
    if(!containsOriginalTitle(original.title,track.title))throw Error('The song title has changed since comparison. Compare again.');
    if(normalize(original.title)===normalize(title))return {before:original.title,after:original.title,unchanged:true};
    const beforeIds=original.tags.map(t=>Number(t.id)).sort((a,b)=>a-b).join(',');
    const beforeAlbumIds=Array.isArray(original.album_appearances)?original.album_appearances.map(a=>Number(a.album?.id||a.album_id)).filter(Boolean).sort((a,b)=>a-b).join(','):null;
    await request(`/api/songs/${id}`,{
      method:'PUT',
      headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf()},
      body:JSON.stringify({text_format:'html,markdown',song:{title}})
    });
    const after=await songById(id);
    if(normalize(after.title)!==normalize(title))throw Error('The API responded but did not save the requested title.');
    if(beforeIds!==after.tags.map(t=>Number(t.id)).sort((a,b)=>a-b).join(','))throw Error('Title saved, but tags changed unexpectedly. Review this song.');
    const afterAlbumIds=Array.isArray(after.album_appearances)?after.album_appearances.map(a=>Number(a.album?.id||a.album_id)).filter(Boolean).sort((a,b)=>a-b).join(','):null;
    if(beforeAlbumIds!==null&&afterAlbumIds!==null&&beforeAlbumIds!==afterAlbumIds)throw Error('Title saved, but album associations changed unexpectedly. Review this song.');
    return {before:original.title,after:after.title};
  }
  globalThis.GeniusToolkitTrackFixes={validTitle,normalize,containsOriginalTitle,renameSong};
})();
