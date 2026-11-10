/* Toolkit Toolkit 0.10.13 — token-free, cross-album Apple Music artwork lookup.
 * Search results can be incomplete or badly ranked, especially for short titles.
 * Verify BOTH the collection name and artist before offering a cover; selection
 * and the actual 1000×1000 image validation remain in the content script.
 */
(() => {
 'use strict';
 const MAX=12;
 const clean=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[’‘]/g,"'").replace(/\s*(?:\(|\[)\s*(?:feat(?:uring)?\.?|ft\.?)\s+[^)\]]+[)\]]\s*$/i,'').replace(/\s*[([](?:deluxe|expanded|remaster(?:ed)?|anniversary|explicit|clean|bonus tracks?|special edition|single|ep)(?:\s+(?:edition|version))?[)\]]\s*$/i,'')
  .replace(/\s*[-–—]\s*(?:deluxe|expanded|remaster(?:ed)?|single|ep)(?:\s+(?:edition|version))?$/i,'')
  .replace(/\s+&\s+/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 function score(a,b){
  const x=clean(a),y=clean(b);
  if(!x||!y)return 0;
  if(x===y)return 100;
  // Partial titles are NOT sufficiently reliable for automatically offering art.
  if(x.length>=5&&y.length>=5&&(x.includes(y)||y.includes(x)))return 55;
  return 0;
 }
 function artistScore(a,b){
  const direct=score(a,b);
  if(direct===100)return 100;
  const split=value=>String(value||'').split(/\s*(?:,|\/|\s+&\s+|\s+and\s+|\s+(?:feat\.?|ft\.?)\s+)\s*/i)
   .map(clean).filter(Boolean);
  const pieces=split(a),other=split(b);
  if(pieces.length>1&&pieces.length===other.length&&
   pieces.sort().every((name,i)=>name===other.sort()[i]))return 95;
  return pieces.some(piece=>score(piece,b)===100)?90:direct;
 }
 function artworkUrl(url){
  if(typeof url!=='string')return null;
  try{
   const obj=new URL(url);
   if(!['http:','https:'].includes(obj.protocol)||!/(^|\.)mzstatic\.com$/i.test(obj.hostname))return null;
   if(!/\/\d{2,5}x\d{2,5}(?:bb)?\.(?:jpe?g|png|webp)$/i.test(obj.pathname))return null;
   obj.protocol='https:';
   obj.pathname=obj.pathname.replace(/\/\d{2,5}x\d{2,5}(?:bb)?\.(?:jpe?g|png|webp)$/i,'/1000x1000bb.jpg');
   return obj.href;
  }catch{return null;}
 }
 function candidate(x,album,artist,verifiedId=false){
  if(x?.wrapperType!=='collection'&&x?.wrapperType!=='track')return null;
  if(x.collectionType!=='Album'&&x.kind!=='song')return null;
  if(!/^\d+$/.test(String(x.collectionId||'')))return null;
  const preview=x.artworkUrl100||x.artworkUrl60;
  const art=artworkUrl(preview);
  if(!art||!x.collectionName||!x.artistName)return null;
  const a=score(x.collectionName,album),b=artistScore(x.artistName,artist);
  return {album:String(x.collectionName),artist:String(x.artistName),id:String(x.collectionId),
   artwork:art,preview,rank:a*2+b,albumScore:a,artistScore:b,
   verifiedId:!!verifiedId,source:'Apple Music'};
 }
 const acceptable=x=>x&&x.albumScore>=85&&x.artistScore>=75;
 function unique(candidates){
  const byId=new Map();
  for(const x of candidates){
   if(!acceptable(x))continue;
   const old=byId.get(x.id);
   if(!old||x.rank>old.rank)byId.set(x.id,x);
  }
  return [...byId.values()].sort((a,b)=>b.rank-a.rank).slice(0,MAX);
 }
 async function getJson(url,timeoutMs=13000){
  let response;
  try{response=await fetch(url,{method:'GET',credentials:'omit',redirect:'follow',
   signal:AbortSignal.timeout(timeoutMs)});}
  catch(e){throw Error('Apple Music network request failed: '+String(e?.message||e));}
  if(!response.ok)throw Error('Apple Music returned HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data?.results))throw Error('Unexpected Apple Music response');
  return data.results;
 }
 const api=(endpoint,params,timeoutMs)=>getJson('https://itunes.apple.com/'+endpoint+'?'+new URLSearchParams(params),timeoutMs);
 async function findById(appleId,album,artist){
  if(!/^\d{1,20}$/.test(appleId||''))return null;
  for(const country of ['us','ro']){
   const rows=await api('lookup',{id:appleId,country});
   const matched=rows.find(x=>String(x.trackId)===appleId||String(x.collectionId)===appleId);
   const item=matched&&candidate(matched,album,artist,true);
   if(item&&(!album||!artist||acceptable(item)))return item;
  }
  return null;
 }
 // Both modes use the same metadata, artwork CDN, query and page-validation
 // machinery. Only the acceptance policy differs: album vs standalone single.
 function isStandalone(row){
  const name=String(row?.collectionName||'');
  return /(?:\s*[-–—]\s*|\(\s*)single(?:\s*\))?$/i.test(name)||Number(row?.trackCount)===1;
 }
 function matchingRows(rows,title,artist,kind){
  const list=[];
  for(const row of rows||[]){
   if(kind==='single'&&!isStandalone(row))continue;
   const item=candidate(row,title,artist);
   if(acceptable(item))list.push(item);
  }
  return list;
 }
 async function searchApi(title,artist,kind,context={}){
  const deadline=Date.now()+20000;
  let succeeded=0,lastError=null;
  const all=[];
  const attempt=async(endpoint,query)=>{
   if(Date.now()>deadline-600)return unique(all);
   try{
    const rows=await api(endpoint,query,Math.max(600,Math.min(7500,deadline-Date.now())));
    succeeded++;all.push(...matchingRows(rows,title,artist,kind));
   }catch(e){lastError=e;}
   return unique(all);
  };
  const common={media:'music',entity:'album',country:'us',limit:'200'};
  if(kind==='single'){
   const song={media:'music',entity:'song',country:'us',limit:'200'};
   let found=await Promise.all([
    attempt('search',{...song,term:artist+' '+title}),
    attempt('search',{...common,term:artist+' '+title})
   ]);
   if(found.some(x=>x.length))return unique(all);
  }else{
   let found=await attempt('search',{...common,term:artist+' '+title});
   if(found.length)return found;
   found=await attempt('search',{...common,term:artist,attribute:'artistTerm'});
   if(found.length)return found;
  }
  // For releases missing from search rankings, enumerate the exact artist's
  // catalog. Shared by albums and singles, without hardcoded artist IDs.
  try{
   if(Date.now()<deadline-600){
    const artists=await api('search',{term:artist,media:'music',entity:'musicArtist',country:'us',limit:'25'},
     Math.max(600,Math.min(6500,deadline-Date.now())));
    succeeded++;
    const ids=[...new Set(artists.filter(x=>artistScore(x.artistName,artist)>=95&&safeAppleId(x.artistId))
     .map(x=>String(x.artistId)))].slice(0,2);
    context.artistIds=ids;
    for(const id of ids){
     const found=await attempt('lookup',{id,entity:'album',country:'us',limit:'200'});
     if(found.length)return found;
    }
   }
  }catch(e){lastError=e;}
  const remaining=kind==='single'?[
   {endpoint:'search',query:{...common,term:title,attribute:'albumTerm'}},
   {endpoint:'search',query:{media:'music',entity:'song',country:'ro',limit:'200',term:artist+' '+title}}
  ]:[
   {endpoint:'search',query:{...common,term:title,attribute:'albumTerm'}},
   {endpoint:'search',query:{...common,country:'ro',term:artist+' '+title}}
  ];
  for(const q of remaining){
   const found=await attempt(q.endpoint,q.query);
   if(found.length)return found;
  }
  if(!succeeded&&lastError)throw lastError;
  return [];
 }
 // Some Apple Music releases are absent from iTunes's older Store search.
 // Apple Music pages are discovery hints until the official release page is
 // independently checked for matching title, artist, and release type.
 const appleMusicRoot='https://music.apple.com';
 const safeAppleId=id=>/^\d{5,20}$/.test(String(id||''))?String(id):null;
 function decodeHtml(s){
  return String(s||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,hex,decimal)=>{
   const n=parseInt(hex||decimal,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
  }).replace(/&apos;|&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
 }
 function metadata(html,key){
  for(const match of String(html||'').matchAll(/<meta\b[^>]{0,1800}>/gi)){
   const fields={};
   for(const attr of match[0].matchAll(/([a-z][a-z0-9:_-]*)\s*=\s*(["'])(.*?)\2/gi))
    fields[attr[1].toLowerCase()]=decodeHtml(attr[3]);
   if(fields.property===key||fields.name===key)return fields.content||'';
  }
  return '';
 }
 function applePageArtwork(raw){
  try{
   const u=new URL(decodeHtml(raw));
   if(u.protocol!=='https:'||!/(^|\.)mzstatic\.com$/i.test(u.hostname)||!u.pathname.startsWith('/image/thumb/'))return null;
   if(!/\/\d{2,5}x\d{2,5}[^/]*\.(?:png|jpe?g|webp)$/i.test(u.pathname))return null;
   u.pathname=u.pathname.replace(/\/\d{2,5}x\d{2,5}[^/]*\.(?:png|jpe?g|webp)$/i,'/1000x1000bb.jpg');
   u.search='';return u.href;
  }catch{return null;}
 }
 function appleAlbumLinks(html,title){
  const src=decodeHtml(html).replace(/\\u002f/gi,'/').replace(/\\\//g,'/');
  const out=new Map();
  const re=/(?:https?:\/\/music\.apple\.com)?\/([a-z]{2})\/album\/([a-z0-9%_-]{1,180})\/(\d{6,20})(?=[^0-9]|$)/gi;
  for(const m of src.matchAll(re)){
   let slug;
   try{slug=decodeURIComponent(m[2]);}catch{continue;}
   const rawTitle=slug.replace(/-(?:single|ep)$/i,'').replace(/-/g,' ');
   if(score(rawTitle,title)!==100)continue;
   const id=m[3],url=appleMusicRoot+'/'+m[1].toLowerCase()+'/album/'+m[2]+'/'+id;
   out.set(id,url);
   if(out.size>=8)break;
  }
  return [...out.values()];
 }
 async function getApplePage(url,timeoutMs=6500){
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='music.apple.com')throw Error('unexpected Apple Music host');
  const response=await fetch(u.href,{method:'GET',credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error('Apple Music page returned HTTP '+response.status);
  const html=await response.text();
  if(html.length>5000000)throw Error('Apple Music page was too large');
  return html;
 }
 function verifiedAppleRelease(html,url,title,artist,kind='single'){
  const ogTitle=metadata(html,'og:title')||metadata(html,'twitter:title');
  const ogImage=metadata(html,'og:image')||metadata(html,'twitter:image');
  const art=applePageArtwork(ogImage);
  const match=ogTitle.match(/^\s*[\u200e\u200f\u202a-\u202e\ufeff]*\s*(.*?)\s+[-–—]\s+(?:album|single|ep)\s+by\s+(.+?)(?:\s+[-–—]\s+apple\s+music)?\s*$/i);
  if(!match||!art||score(match[1],title)!==100||artistScore(match[2],artist)<90)return null;
  const parts=new URL(url).pathname.split('/');
  const id=parts[4];if(parts[2]!=='album'||!safeAppleId(id))return null;
  // A song's artwork must be from the single release. Apple's "Single - Album
  // by" format identifies single releases, not standalone album tracks.
  const single=/(?:\s*[-–—]\s*|\(\s*)single(?:\s*\))?$/i.test(match[1])||
   /\s[-–—]\sSingle\s+by\s/i.test(ogTitle)||/-(?:single)$/i.test(parts[3]||'');
  if(kind==='single'&&!single)return null;
  return {album:match[1],artist:match[2],id,artwork:art,preview:art,
   rank:310,albumScore:100,artistScore:100,source:'Apple Music',verifiedId:true};
 }
 async function findApplePages(title,artist,kind='single',artistId='',appleId='',knownArtistIds=[]){
  const releases=new Map();
  const collect=html=>{for(const url of appleAlbumLinks(html,title))releases.set(url,url);};
  const slug=String(artist).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
   .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  // A linked Genius Apple ID can identify a track OR an album. Never trust
  // the ID until the official release metadata has been verified.
  if(safeAppleId(appleId)){
   for(const country of ['us','ro']){
    try{
     const id=String(appleId);
     const suffix=kind==='single'?'song/':'album/'+encodeURIComponent(title.toLowerCase().replace(/\s+/g,'-'))+'/';
     const html=await getApplePage(appleMusicRoot+'/'+country+'/'+suffix+id);
     collect(html);
     if(kind==='album')releases.set(appleMusicRoot+'/'+country+'/'+suffix+id,appleMusicRoot+'/'+country+'/'+suffix+id);
     if(releases.size)break;
    }catch{}
   }
  }
  const artistIds=new Set(knownArtistIds.filter(safeAppleId).map(String));
  if(safeAppleId(artistId))artistIds.add(String(artistId));
  if(!artistIds.size){
   try{
    const rows=await api('search',{term:artist,media:'music',entity:'musicArtist',country:'us',limit:'25'},6500);
    for(const row of rows){
     if(artistScore(row.artistName,artist)>=95&&safeAppleId(row.artistId))artistIds.add(String(row.artistId));
     if(artistIds.size>=2)break;
    }
   }catch{}
  }
  if(!releases.size){
   for(const id of artistIds){
    for(const path of [`/us/artist/${encodeURIComponent(slug)}/${id}`,`/us/artist/artist/${id}`]){
     try{collect(await getApplePage(appleMusicRoot+path));}catch{}
     if(releases.size)break;
    }
    if(releases.size)break;
   }
  }
  if(!releases.size){
   try{collect(await getApplePage(appleMusicRoot+'/us/search?term='+encodeURIComponent(artist+' '+title)));}catch{}
  }
  const verified=[];
  for(const url of [...releases.values()].slice(0,6)){
   try{
    const item=verifiedAppleRelease(await getApplePage(url),url,title,artist,kind);
    if(item)verified.push(item);
   }catch{}
  }
  return unique(verified);
 }
 async function searchRelease({kind,title,artist,appleId='',artistId='',skipDirectLookup=false}){
  if(safeAppleId(appleId)&&!skipDirectLookup){
   for(const country of ['us','ro']){
    try{
     const rows=await api('lookup',{id:appleId,country},6500);
     const found=matchingRows(rows,title,artist,kind);
     if(found.length)return unique(found);
    }catch{}
   }
  }
  let fromApi=[],lookupError=null;
  const context={};
  try{fromApi=await searchApi(title,artist,kind,context);}catch(e){lookupError=e;}
  if(fromApi.length)return fromApi;
  const fromPages=await findApplePages(title,artist,kind,artistId,appleId,context.artistIds||[]);
  if(!fromPages.length&&lookupError)throw lookupError;
  return fromPages;
 }
 async function search(album,artist){return searchRelease({kind:'album',title:album,artist});}
 async function searchSingle(title,artist,appleId,artistId){
  return searchRelease({kind:'single',title,artist,appleId,artistId});
 }
 async function findAppleMusicPageSingle(title,artist,artistId,appleId){
  return findApplePages(title,artist,'single',artistId,appleId);
 }
 browser.runtime.onMessage.addListener(message=>{
  if(message?.scope!=='gt-apple-art'||message?.action!=='search')return undefined;
  return (async()=>{
   const artist=String(message.artist||'').trim(),album=String(message.album||'').trim();
   const title=String(message.title||'').trim(),appleId=String(message.appleId||'').trim();
   const kind=message.kind|| (title?'single':'album');
   if(!['album','single'].includes(kind))return {ok:false,error:'unknown artwork lookup type'};
   const release=kind==='single'?title:album;
   if(artist.length>150||release.length>200)return {ok:false,error:'release or artist name too long'};
   if(!artist||!release)return {ok:false,error:'missing artist or release information'};
   try{
    if(kind==='album'){
     // Preserve the direct-ID indicator shown by the album editor.
     if(appleId){
      try{const direct=await findById(appleId,release,artist);if(direct)return {ok:true,direct:true,candidates:[direct]};}catch{}
     }
     return {ok:true,direct:false,candidates:await searchRelease({kind:'album',title:release,artist,appleId,skipDirectLookup:!!appleId})};
    }
    return {ok:true,direct:false,candidates:await searchSingle(release,artist,appleId,String(message.appleArtistId||''))};
   }catch(e){return {ok:false,error:String(e?.message||e)};}
  })();
 });
 if(typeof globalThis!=='undefined')globalThis.GTAppleArtTests={clean,score,artistScore,artworkUrl,candidate,unique,findById,search,searchSingle,searchApi,searchRelease,matchingRows,isStandalone,
  metadata,applePageArtwork,appleAlbumLinks,verifiedAppleRelease,findAppleMusicPageSingle,findApplePages};
})();
