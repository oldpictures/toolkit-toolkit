/* Genius Toolkit 0.8.0 — read-only, official-source-focused media discovery.
   A MusicBrainz relationship does not alone prove that an uploader is official.
   Verify video/audio author identity through platform oEmbed before suggesting a link.
   Keep the network read-only: NEVER submit media metadata to Genius. */
(() => {
  'use strict';
  const MB = 'https://musicbrainz.org';
  const CAA = 'https://coverartarchive.org';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const uuid = v => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v || '');
  const normalize = value => String(value || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*(?:feat\.?|ft\.?|with)[^)]*\)/ig,'')
    .replace(/\b(feat\.?|ft\.?)\s.+$/ig,'').replace(/[^a-z\d]+/ig,' ').trim().replace(/\s+/g,' ');
  const same = (a,b) => normalize(a) === normalize(b) && !!normalize(a);
  const sameArtist = (a,b) => same(a,b) || String(a||'').split(/\s*(?:,|&| feat\.? | ft\.? | and )\s*/i).some(x => same(x,b));
  const safeQuery = value => String(value||'').replace(/[\\"():~*?^{}\[\]!+\-]/g,' ').replace(/\s+/g,' ').trim().slice(0,110);
  const titleStem = title => String(title||'').replace(/\s*\((?:official (?:audio|music video|video|visualizer)|audio|visualizer|lyrics?)\)\s*/ig,'').replace(/\s*\[(?:official (?:audio|video|music video)|audio|visualizer)\]\s*/ig,'').trim();
  let chain = Promise.resolve(), nextMB = 0;
  async function getJson(url, timeout=14500) {
    const response = await fetch(url, {method:'GET',headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(timeout)});
    if (!response.ok) throw Error('source returned HTTP '+response.status);
    const raw = await response.text();
    if (raw.length > 2000000) throw Error('source returned too much data');
    return JSON.parse(raw);
  }
  async function mb(path) {
    const delay = Math.max(0,nextMB - Date.now());
    if (delay) await wait(delay);
    nextMB = Date.now() + 1250;
    return getJson(MB+path);
  }
  function youtubeUrl(href) {
    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase().replace(/^www\./,'');
      if (url.protocol !== 'https:') return null;
      let id = '';
      if (host === 'youtu.be') id=url.pathname.split('/')[1] || '';
      else if (host === 'youtube.com' || host === 'music.youtube.com') {
        if (url.pathname === '/watch') id=url.searchParams.get('v')||'';
        else if (/^\/(?:shorts|embed)\//.test(url.pathname)) id=url.pathname.split('/')[2]||'';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? 'https://www.youtube.com/watch?v='+id : null;
    } catch { return null; }
  }
  function soundcloudUrl(href) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:' || !['soundcloud.com','www.soundcloud.com'].includes(url.hostname.toLowerCase())) return null;
      const parts=url.pathname.split('/').filter(Boolean);
      if (parts.length !== 2 || parts.some(x => /^(?:sets|likes|reposts|tracks|discover)$/i.test(x))) return null;
      return 'https://soundcloud.com/'+parts.map(encodeURIComponent).join('/');
    } catch { return null; }
  }
  function authorMatches(author, artist) {
    const clean=String(author||'').replace(/\s*(?:- Topic|VEVO|Official)\s*$/i,'');
    return sameArtist(clean,artist);
  }
  function oEmbedTitleMatches(title, track, artist) {
    const val=String(title||'').replace(/\s+(?:by|from)\s+.+$/i,'');
    const names=[val,val.replace(new RegExp('^'+String(artist).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[-–—:]\\s*','i'),'')];
    return names.some(name => same(titleStem(name),track));
  }
  async function validateYouTube(url, title, artist) {
    try {
      const o=await getJson('https://www.youtube.com/oembed?'+new URLSearchParams({url,format:'json'}),9500);
      return authorMatches(o?.author_name,artist) && oEmbedTitleMatches(o?.title,title,artist);
    } catch {return false;}
  }
  async function validateSoundCloud(url, title, artist) {
    try {
      const o=await getJson('https://soundcloud.com/oembed?'+new URLSearchParams({url,format:'json'}),9500);
      return authorMatches(o?.author_name,artist) && oEmbedTitleMatches(o?.title,title,artist);
    } catch {return false;}
  }
  async function recordingLinks(title, artist, needYoutube=true, needSoundcloud=true) {
    const result={youtube:null,soundcloud:null};
    const query=`recording:"${safeQuery(title)}" AND artist:"${safeQuery(artist)}"`;
    let listing;
    try {listing=await mb('/ws/2/recording/?'+new URLSearchParams({query,fmt:'json',limit:'8'}));}
    catch {return result;}
    const exact=(listing?.recordings||[]).filter(r=>uuid(r.id) && same(r.title,title) &&
      (r['artist-credit']||[]).some(c=>sameArtist(c?.artist?.name||c?.name,artist))).slice(0,2);
    const foundYouTube = new Set(), foundSoundCloud = new Set();
    for (const rec of exact) {
      let song;
      try { song=await mb('/ws/2/recording/'+rec.id+'?fmt=json&inc=url-rels'); } catch {continue;}
      for (const relation of song.relations||[]) {
        if (relation['target-type']!=='url' || !/stream|video|download/i.test(relation.type||'')) continue;
        const target=relation.url?.resource;
        const yt=youtubeUrl(target);if(yt && needYoutube) foundYouTube.add(yt);
        const sc=soundcloudUrl(target);if(sc && needSoundcloud) foundSoundCloud.add(sc);
      }
    }
    // Conflicting links are not safe to autofill. One exact linked URL is required.
    if (foundYouTube.size===1) {
      const candidate=[...foundYouTube][0];
      if(await validateYouTube(candidate,title,artist))result.youtube=candidate;
    }
    if (foundSoundCloud.size===1) {
      const candidate=[...foundSoundCloud][0];
      if(await validateSoundCloud(candidate,title,artist))result.soundcloud=candidate;
    }
    return result;
  }
  async function singleCover(title,artist) {
    // Never search album release-groups for song art: only standalone Singles.
    const query=`releasegroup:"${safeQuery(title)}" AND artist:"${safeQuery(artist)}" AND primarytype:single`;
    let result;
    try {result=await mb('/ws/2/release-group/?'+new URLSearchParams({query,fmt:'json',limit:'10'}));}
    catch{return null;}
    const groups=(result['release-groups']||[]).filter(g=>uuid(g.id) && g['primary-type']==='Single' && same(g.title,title) &&
      (g['artist-credit']||[]).some(c=>sameArtist(c?.name||c?.artist?.name,artist)));
    // More than one distinct single release with this name is ambiguous.
    if(groups.length!==1) return null;
    let group;
    try {group=await mb('/ws/2/release-group/'+groups[0].id+'?fmt=json&inc=releases');} catch{return null;}
    if(!(group.releases||[]).some(r=>r.status==='Official')) return null;
    let covers;
    try { covers=await getJson(CAA+'/release-group/'+groups[0].id+'/',11000); } catch{return null;}
    const fronts=(covers.images||[]).filter(x=>x.front===true && x.approved===true && typeof x.image==='string' && /^https?:\/\//i.test(x.image));
    if(fronts.length!==1) return null;
    const url=fronts[0].image.replace(/^http:\/\//i,'https://');
    const parsed=new URL(url);
    // The cover archive redirects into the Internet Archive; never accept arbitrary host art.
    if(!['coverartarchive.org','archive.org','www.archive.org'].includes(parsed.hostname))return null;
    return {url, source:MB+'/release-group/'+groups[0].id,kind:'official-single'};
  }
  async function lookup({title,artist,needYoutube=true,needSoundcloud=true,needArt=true}) {
    title=String(title||'').trim();artist=String(artist||'').trim();
    if(title.length<2||artist.length<2||title.length>250||artist.length>180)throw Error('song title or artist is missing');
    // The lookups remain independent so unavailable media data does not block artwork checks.
    const links=(needYoutube||needSoundcloud) ? await recordingLinks(title,artist,needYoutube,needSoundcloud) : {youtube:null,soundcloud:null};
    const artwork=needArt ? await singleCover(title,artist) : null;
    return {...links,artwork};
  }
  browser.runtime.onMessage.addListener(message => {
    if(message?.scope!=='gt-song-media' || message?.action!=='lookup')return undefined;
    const work=chain.then(()=>lookup(message));
    chain=work.catch(()=>{});
    return work.then(result=>({ok:true,...result}),error=>({ok:false,error:String(error.message||error)}));
  });
  // Test hooks are pure helpers, with no network actions.
  if(typeof globalThis !== 'undefined')globalThis.GTMediaTests={normalize,same,sameArtist,youtubeUrl,soundcloudUrl,authorMatches,oEmbedTitleMatches};
})();
