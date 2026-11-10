/* Token-free Discogs lookup. Public API first, public web search if API search
 * is unavailable. Never sends credentials or contacts third-party proxy services.
 * The public Discogs website can block requests; in that case show a clear error
 * and allow import by release URL, whose public API endpoint needs no token.
 */
(() => {
  'use strict';
  const API = 'https://api.discogs.com';
  const SITE = 'https://www.discogs.com';
  const numeric = value => /^\d{1,12}$/.test(String(value));
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const list = value => Array.isArray(value) ? value : (value == null ? [] : [value]);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let queue = Promise.resolve();
  let nextAt = 0;

  async function pacedFetch(url, accepts) {
    const delay = Math.max(0, nextAt - Date.now());
    if (delay) await wait(delay);
    // Below the public 25 req/min guideline; actions are queued in the listener.
    nextAt = Date.now() + 2600;
    return fetch(url, {
      method: 'GET',
      headers: {Accept: accepts},
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(19000)
    });
  }

  async function api(path) {
    const response = await pacedFetch(API + path, 'application/vnd.discogs.v2+json');
    if (!response.ok) {
      const error = Error(response.status === 429
        ? 'Discogs rate limit reached. Try again shortly.'
        : `Discogs public API returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function publicRelease(result, fallbackArtist = '') {
    if (!numeric(result.id)) return null;
    const fullTitle = clean(result.title);
    const separator = fullTitle.indexOf(' - ');
    const title = separator >= 0 ? fullTitle.slice(separator + 3) : fullTitle;
    const artist = separator >= 0 ? fullTitle.slice(0, separator) : fallbackArtist;
    const thumb = typeof result.thumb === 'string' && result.thumb.startsWith('https://') ? result.thumb : '';
    return {
      id:String(result.id), title:title || 'untitled release', artist:artist || 'unknown artist',
      date:String(result.year || ''), country:clean(result.country || ''),
      status:list(result.format).map(clean).join(', '), tracks:null,
      disambiguation:list(result.label).map(clean).join(', '), thumb
    };
  }

  async function apiSearch(album,artist) {
    const query = new URLSearchParams({type:'release',release_title:album,per_page:'25',page:'1'});
    if (artist) query.set('artist',artist);
    const data = await api('/database/search?' + query);
    let releases = (data.results || []).map(r => publicRelease(r,artist)).filter(Boolean);
    // Alias / credit spelling often differs between Genius and Discogs.
    if (!releases.length && artist) {
      const looser = await api('/database/search?' + new URLSearchParams({type:'release',q:artist+' '+album,per_page:'25',page:'1'}));
      releases = (looser.results || []).map(r => publicRelease(r,artist)).filter(Boolean);
    }
    return releases;
  }

  // Plain HTML parsing only. Never execute scripts from third-party pages.
  // Discogs may serve a Cloudflare challenge or client-rendered markup, in which
  // case this returns no entries and the UI offers manual release-link import.
  function parsePublicSearch(html, fallbackArtist) {
    if (typeof DOMParser === 'undefined') return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const unique = new Set();
    const releases = [];
    for (const anchor of doc.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(anchor.getAttribute('href'), SITE); } catch { continue; }
      if (!['discogs.com','www.discogs.com'].includes(url.hostname)) continue;
      const match = url.pathname.match(/^\/release\/(\d{1,12})(?:[-\/]|$)/i);
      if (!match || unique.has(match[1])) continue;
      const entry = anchor.closest('li, article, [class*="search_result"], [class*="SearchResult"], [data-testid*="search-result"]');
      const raw = clean(anchor.getAttribute('title') || anchor.textContent);
      const candidate = raw.length > 2 ? raw : clean(entry?.textContent || '');
      if (!candidate || candidate.length > 200) continue;
      unique.add(match[1]);
      const split = candidate.indexOf(' - ');
      releases.push({
        id:match[1], title:split >= 0 ? candidate.slice(split+3) : candidate,
        artist:split >= 0 ? candidate.slice(0,split) : (fallbackArtist || 'unknown artist'),
        date:'', country:'', status:'public website result', tracks:null,
        disambiguation:'', thumb:''
      });
      if (releases.length >= 25) break;
    }
    return releases;
  }

  async function websiteSearch(album,artist) {
    const q=[artist,album].filter(Boolean).join(' ');
    const url = SITE + '/search/?' + new URLSearchParams({q,type:'release'});
    const response=await pacedFetch(url,'text/html');
    if (!response.ok) {
      const error=Error(`Discogs website returned HTTP ${response.status}.`);
      error.status=response.status;
      throw error;
    }
    const html=await response.text();
    if (html.length > 4_000_000) throw Error('Discogs search response was too large.');
    const releases=parsePublicSearch(html,artist);
    if (!releases.length) throw Error('Discogs public search returned no readable releases.');
    return releases;
  }

  async function search(album,artist) {
    album=clean(album); artist=clean(artist);
    if (album.length < 2) throw Error('Enter an album title.');
    try {
      const releases = await apiSearch(album,artist);
      if (releases.length) return {releases,source:'public api'};
      // Empty API results may be a title/artist mismatch; try the website.
    } catch (error) {
      // A rate-limit response is explicit. Do not work around it using another
      // endpoint; the user can try later or import a known release URL.
      if (error.status === 429) throw error;
    }
    try {
      const releases = await websiteSearch(album,artist);
      return {releases,source:'public website'};
    } catch (error) {
      if (error.status === 429) throw Error('Discogs is rate-limiting public searches. Try later or use Release link with a release URL.');
      if (error.status === 403) throw Error('Discogs blocked public website search. Use Release link with a Discogs release URL.');
      throw Error('Public Discogs search is unavailable (' + clean(error.message) + '). Use Release link with a release URL.');
    }
  }

  async function release(id) {
    if (!numeric(id)) throw Error('Invalid Discogs release ID.');
    const data = await api('/releases/' + id);
    const flattened=[];
    for (const track of data.tracklist || []) {
      if (track.type_ === 'heading') continue;
      const children=Array.isArray(track.sub_tracks) ? track.sub_tracks : [];
      if (track.type_ === 'index' && children.length) {
        flattened.push(...children);
      } else if (track.type_ === 'track' || !track.type_ || track.type_ === 'sub_track') {
        flattened.push(track);
      }
    }
    const tracks=flattened.filter(t=>clean(t.title)).map((t,i)=>({
      title:clean(t.title), number:clean(t.position || String(i+1)),position:i+1,disc:1
    }));
    if (!tracks.length) throw Error('Discogs release has no tracklist. Choose another edition.');
    if (tracks.length>500) throw Error('Discogs release tracklist is too large.');
    return {tracks,title:data.title || '',date:String(data.released || data.year || ''),artist:(data.artists || []).map(a => clean(a.anv || a.name).replace(/ \(\d+\)$/,'')).join(', '),url:SITE+'/release/'+id};
  }

  // Clean up the obsolete saved token from v0.4.8; this version never uses it.
  browser.storage.local.remove('gtDiscogsToken').catch(() => {});
  browser.runtime.onMessage.addListener(message => {
    if (message?.scope !== 'gt-discogs') return undefined;
    const run=()=>message.action === 'search' ? search(message.album,message.artist)
      : message.action === 'release' ? release(message.id)
      : Promise.reject(Error('Unsupported action.'));
    const promise=queue.then(run);
    queue=promise.catch(()=>{});
    return promise.then(result=>({ok:true,...result}),error=>({ok:false,error:String(error.message || error)}));
  });
})();
