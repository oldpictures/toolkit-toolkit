/* Shared album/song artwork helpers: one background lookup and one image validator. */
(() => {
 'use strict';
 function validUrl(raw){
  try{const u=new URL(String(raw||'').trim());return u.protocol==='https:'?u.href:null;}catch{return null;}
 }
 function geniusVariants(raw){
  const href=validUrl(raw);if(!href)return [];
  const u=new URL(href);
  if(u.hostname!=='images.genius.com'||!/\.(?:jpe?g|png|webp)$/i.test(u.pathname))return [];
  const urls=[];
  if(/\.\d{2,5}x\d{2,5}x\d+(?=\.(?:jpe?g|png|webp)$)/i.test(u.pathname)){
   const high=new URL(u.href);
   high.pathname=high.pathname.replace(/\.\d{2,5}x\d{2,5}x\d+(?=\.(?:jpe?g|png|webp)$)/i,'.1000x1000x1');
   urls.push(high.href);
  }
  urls.push(u.href);
  return [...new Set(urls)];
 }
 function sameGeniusImage(a,b){
  const canonical=raw=>{
   const href=validUrl(raw);
   if(!href)return null;
   const u=new URL(href);
   if(u.hostname!=='images.genius.com')return null;
   return u.pathname.replace(/\.\d{2,5}x\d{2,5}x\d+(?=\.(?:jpe?g|png|webp)$)/i,'');
  };
  const left=canonical(a),right=canonical(b);
  return !!left&&left===right;
 }
 function dimensions(url,timeoutMs=11000){return new Promise(resolve=>{
  if(!validUrl(url)){resolve(null);return;}
  const pic=new Image();let complete=false;
  const finish=result=>{if(complete)return;complete=true;clearTimeout(timer);pic.onload=pic.onerror=null;resolve(result);};
  const timer=setTimeout(()=>finish(null),timeoutMs);
  pic.onload=()=>finish({width:pic.naturalWidth,height:pic.naturalHeight});
  pic.onerror=()=>finish(null);
  pic.src=url;
 });}
 async function search({kind,album,title,artist,appleId,appleArtistId}){
  if(kind!=='album'&&kind!=='single')throw Error('unknown artwork lookup type');
  if(typeof browser==='undefined'||!browser.runtime?.sendMessage)throw Error('extension artwork lookup unavailable');
  const reply=await browser.runtime.sendMessage({scope:'gt-apple-art',action:'search',kind,
   artist:String(artist||'').trim(),...(kind==='single'?{title:String(title||'').trim(),appleId,appleArtistId}:{album:String(album||'').trim(),appleId})});
  if(!reply?.ok)return {ok:false,error:reply?.error||'artwork lookup unavailable',candidates:[]};
  const seen=new Set();
  const candidates=(Array.isArray(reply.candidates)?reply.candidates:[]).filter(x=>{
   const art=validUrl(x?.artwork),preview=validUrl(x?.preview);
   if(!art||!preview||seen.has(art))return false;
   seen.add(art);return true;
  }).slice(0,12);
  return {ok:true,direct:!!reply.direct,candidates};
 }
 globalThis.GeniusToolkitArtwork={validUrl,geniusVariants,sameGeniusImage,dimensions,search};
})();
