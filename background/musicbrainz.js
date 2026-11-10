/* MusicBrainz Web Service (public, read-only); requests only on user actions.
 * Keep at least 1.1 seconds between requests to respect MusicBrainz rate limits.
 * Firefox background script can request musicbrainz.org via host_permissions.
 */
(() => {
  'use strict';
  let sequence = Promise.resolve();
  let nextRequestAt = 0;
  const ORIGIN = 'https://musicbrainz.org';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const uuid = value => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
  const safe = value => String(value || '').replace(/[\\"():~*?^{}\[\]!+\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

  async function request(endpoint) {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await sleep(delay);
    nextRequestAt = Date.now() + 1200;
    const response = await fetch(ORIGIN + endpoint, {
      headers: {Accept: 'application/json'},
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(18000)
    });
    if (!response.ok) {
      if (response.status === 503 || response.status === 429)
        throw Error('musicbrainz is rate-limiting requests. please try again shortly.');
      throw Error(`musicbrainz returned http ${response.status}.`);
    }
    return response.json();
  }
  async function search(album, artist) {
    album = safe(album); artist = safe(artist);
    if (!album || album.length < 2) throw Error('enter an album title.');
    const query = artist ? `release:"${album}" AND artist:"${artist}"` : `release:"${album}"`;
    const endpoint = '/ws/2/release/?fmt=json&limit=25&query=' + encodeURIComponent(query);
    let data = await request(endpoint);
    // Artist names on Genius can differ from MusicBrainz credit aliases.
    if (!(data.releases || []).length && artist)
      data = await request('/ws/2/release/?fmt=json&limit=25&query=' + encodeURIComponent(`release:"${album}"`));
    const releases = (data.releases || []).filter(x => uuid(x.id)).slice(0,25).map(x => ({
      id:x.id,
      title:x.title || '(untitled)',
      artist:(x['artist-credit'] || []).map(p => p.name || p.artist?.name || '').filter(Boolean).join(' ') || 'unknown artist',
      date:x.date || '',
      country:x.country || '',
      status:x.status || '',
      tracks:x['track-count'] ?? null,
      disambiguation:x.disambiguation || '',
      score:x.score ?? 0
    }));
    return {releases};
  }
  async function fetchRelease(id) {
    if (!uuid(id)) throw Error('invalid release id.');
    const data = await request('/ws/2/release/' + id + '?fmt=json&inc=recordings');
    const media = Array.isArray(data.media) ? data.media : [];
    const tracks = media.flatMap((medium, index) => (medium.tracks || []).map((track, pos) => ({
      title: String(track.title || track.recording?.title || '').trim(),
      disc: medium.position || index+1,
      number: String(track.number || pos+1),
      position: pos+1
    }))).filter(track => track.title);
    if (!tracks.length) throw Error('this release has no tracklist in musicbrainz. choose another edition.');
    if (tracks.length > 500) throw Error('this release has too many tracks to compare safely.');
    return {
      title:data.title || '',
      date:data.date || '',
      artist:(data['artist-credit'] || []).map(p => p.name || p.artist?.name || '').filter(Boolean).join(' '),
      url:ORIGIN + '/release/' + id,
      tracks
    };
  }
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.scope !== 'gt-musicbrainz') return undefined;
    const action = () => message.action === 'search' ? search(message.album,message.artist)
      : message.action === 'release' ? fetchRelease(message.id)
      : Promise.reject(Error('unsupported request.'));
    // Queue the operation, including any fallback lookup, so commands never
    // burst the MusicBrainz server even when users click repeatedly.
    const promise = sequence.then(action);
    sequence = promise.catch(() => {});
    return promise.then(result => ({ok:true,...result}), error => ({ok:false,error:String(error.message || error)}));
  });
})();
