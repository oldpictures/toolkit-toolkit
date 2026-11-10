/* Genius Toolkit v0.6.0: album-scoped release-date editor.
 * Read, then write the date-only Genius song field, and read back to verify.
 * No automatic date selection between editions. No album date mutation.
 */
(() => {
  'use strict';
  const api = globalThis.GeniusToolkitTagApi;
  const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const make = (tag, cls = '', label) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (label != null) el.textContent = label;
    return el;
  };
  const validId = value => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; };

  // Validates real calendar dates without silently filling absent components.
  function parseDate(input) {
    const text = String(input ?? '').trim();
    const found = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text);
    if (!found) throw Error('Enter a date as YYYY, YYYY-MM, or YYYY-MM-DD.');
    const year = Number(found[1]);
    const month = found[2] == null ? null : Number(found[2]);
    const day = found[3] == null ? null : Number(found[3]);
    if (year < 1000 || year > 2100) throw Error('Release year must be between 1000 and 2100.');
    if (month != null && (month < 1 || month > 12)) throw Error('Invalid release month.');
    if (day != null) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day < 1 || day > daysInMonth) throw Error('Invalid calendar day for this month.');
    }
    const iso = found[1] + (found[2] ? `-${found[2]}` : '') + (found[3] ? `-${found[3]}` : '');
    return {year, month, day, iso};
  }
  function fromGenius(song) {
    const part = song?.release_date_components;
    if (part && Number(part.year) > 0) {
      const year = String(part.year).padStart(4, '0');
      const month = Number(part.month) > 0 ? '-' + String(part.month).padStart(2, '0') : '';
      const day = month && Number(part.day) > 0 ? '-' + String(part.day).padStart(2, '0') : '';
      try { return parseDate(year + month + day); } catch { throw Error('Genius has an invalid existing date. This song was not edited.'); }
    }
    if (song?.release_date) {
      try { return parseDate(song.release_date); } catch { throw Error('Genius has an unrecognized existing date. This song was not edited.'); }
    }
    return null;
  }
  function protectedFields(song) {
    if (!song || !Array.isArray(song.tags) || typeof song.title !== 'string')
      throw Error('Genius returned incomplete metadata. No changes were submitted.');
    const tags = song.tags.map(t => validId(t?.id)).sort((a,b) => a-b);
    if (tags.some(id => !id)) throw Error('Song contains an unrecognized existing tag.');
    const albumIds = Array.isArray(song.album_appearances)
      ? song.album_appearances.map(a => validId(a?.album?.id || a?.album_id)).filter(Boolean).sort((a,b)=>a-b)
      : null;
    return {title:song.title, tags:tags.join(','), albums:albumIds && albumIds.join(',')};
  }
  function csrf() {
    const cookie = (document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('_csrf_token=')) || '').slice('_csrf_token='.length);
    const raw = cookie || document.querySelector('meta[name="csrf-token"],meta[name="csrf_token"]')?.getAttribute('content') || '';
    if (!raw || raw.length > 1024) throw Error('Sign in to Genius and refresh the album before editing.');
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  async function request(path, options, signal, label) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort('timeout'), 18000);
    const onAbort = () => ctrl.abort('user');
    if (signal?.aborted) {clearTimeout(timeout); throw Error('Stopped by user.');}
    signal?.addEventListener('abort', onAbort, {once:true});
    try {
      const response = await fetch(`${location.origin}/api${path}`, {
        ...options, credentials:'same-origin', redirect:'error', signal:ctrl.signal
      });
      if (!response.ok) {
        const error = Error(`${label}: Genius returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      const json = await response.json();
      if (globalThis.GeniusToolkitApiErrors.hasErrors(json))
        throw Error(`${label}: Genius rejected the request.`);
      return json;
    } catch (error) {
      if (signal?.aborted) throw Error('Stopped by user.');
      if (ctrl.signal.aborted) throw Error(`${label} timed out. Check the song before retrying.`);
      throw error;
    } finally {clearTimeout(timeout); signal?.removeEventListener('abort', onAbort);}
  }
  async function readSong(id, signal) {
    const data = await request(`/songs/${id}`, {method:'GET',headers:{Accept:'application/json'}}, signal, 'Reading song');
    const song = data?.response?.song;
    if (!song || validId(song.id) !== id) throw Error('Genius returned an unexpected song; no changes were made.');
    return song;
  }
  async function songIdFromAlbum(track,signal) {
    if(!api?.resolveAlbumSongs)throw Error('Album song resolver is unavailable. Reload the extension.');
    const {songs}=await api.resolveAlbumSongs(document,[track],signal);
    const key=api.sameGeniusUrl(track?.url);
    const entry=key&&songs.find(item=>item.key===key);
    if(!entry||!validId(entry.id))throw Error('This track could not be verified as belonging to the album.');
    return entry.id;
  }
  async function updateSongDate(track, dateInput, mode, signal) {
    const date = typeof dateInput === 'string' ? parseDate(dateInput) : dateInput;
    if (!date || !date.iso || !['missing', 'replace'].includes(mode)) throw Error('Invalid date update.');
    const id = await songIdFromAlbum(track,signal);
    const original = await readSong(id, signal);
    const before = protectedFields(original);
    const current = fromGenius(original);
    if (current?.iso === date.iso) return {state:'skipped',message:'already has this date'};
    if (mode === 'missing' && current) return {state:'skipped',message:`existing date preserved (${current.iso})`};
    if (signal?.aborted) throw Error('Stopped by user.');
    // This is the only submitted field. Nulls represent intentionally
    // unavailable date precision, not guessed January 1 dates.
    await request(`/songs/${id}`, {
      method:'PUT',
      headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf()},
      body:JSON.stringify({text_format:'html,markdown',song:{release_date_components:{
        year:date.year,month:date.month,day:date.day
      }}})
    }, signal, 'Saving release date');
    const after = await readSong(id, signal);
    const saved = fromGenius(after);
    if (!saved || saved.iso !== date.iso)
      throw Error(`Genius responded to the update, but the saved date was not verified${saved ? ` (got ${saved.iso})` : ''}. Review this song.`);
    const newFields = protectedFields(after);
    if (before.title !== newFields.title || before.tags !== newFields.tags ||
        (before.albums !== null && newFields.albums !== null && before.albums !== newFields.albums))
      throw Error('Date saved, but other song metadata changed unexpectedly. Review the song.');
    return {state:'done',message:`verified ${date.iso}`};
  }

  function init(panel, readTracks, guessAlbum, lookup) {
    const section = panel.querySelector('.gt-date-editor');
    const trackArea = section.querySelector('.gt-date-tracks');
    const trackSummary = section.querySelector('.gt-date-tracks-heading');
    const value = section.querySelector('#gt-date-value');
    const valueLabel = value.querySelector('.gt-date-label');
    const wrapper = section.querySelector('.gt-date-calendar-wrap');
    const popup = section.querySelector('#gt-date-popup');
    const grid = section.querySelector('.gt-cal-grid');
    const heading = section.querySelector('.gt-cal-heading');
    const current = section.querySelector('.gt-cal-current');
    const use = section.querySelector('.gt-cal-use');
    const prev = section.querySelector('.gt-cal-prev');
    const next = section.querySelector('.gt-cal-next');
    const today = new Date();
    const MIN_YEAR = 1000, MAX_YEAR = 2100;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad = n => String(n).padStart(2,'0');
    let chosen = '';
    let stage = 'year';
    let pageYear = Math.floor(today.getFullYear() / 12) * 12;
    const activeDate = () => chosen;

    // Keep selection separate from the visible calendar stage. Selecting a
    // year or month is a valid partial date, not an invented complete date.
    function choose(iso) {
      chosen = parseDate(iso).iso;
      valueLabel.textContent = chosen;
      current.textContent = chosen;
      updateUI();
    }
    function closeCalendar({restoreFocus = false} = {}) {
      if (popup.hidden) return;
      popup.hidden = true;
      value.setAttribute('aria-expanded', 'false');
      if (restoreFocus) value.focus();
    }
    function renderCalendar() {
      grid.replaceChildren();
      grid.className = 'gt-cal-grid gt-cal-' + stage;
      const parts = chosen.split('-');
      const year = Number(parts[0]) || today.getFullYear();
      const month = Number(parts[1]) || today.getMonth() + 1;
      let items = [];
      if (stage === 'year') {
        heading.textContent = `${pageYear}–${pageYear + 11}`;
        prev.hidden = false; next.hidden = false;
        prev.disabled = pageYear - 12 + 11 < MIN_YEAR;
        next.disabled = pageYear + 12 > MAX_YEAR;
        prev.setAttribute('aria-label', 'Previous 12 years');
        next.setAttribute('aria-label', 'Next 12 years');
        items = Array.from({length:12}, (_, i) => ({label:String(pageYear + i),date:String(pageYear + i)}));
      } else if (stage === 'month') {
        heading.textContent = String(year);
        prev.hidden = false; next.hidden = true;
        prev.disabled = false;
        prev.setAttribute('aria-label', 'Back to years');
        items = months.map((label, i) => ({label, date:`${year}-${pad(i + 1)}`}));
      } else {
        heading.textContent = `${months[month - 1]} ${year}`;
        prev.hidden = false; next.hidden = true;
        prev.disabled = false;
        prev.setAttribute('aria-label', 'Back to months');
        const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
        items = Array.from({length:count}, (_, i) => ({
          label:String(i + 1), date:`${year}-${pad(month)}-${pad(i + 1)}`
        }));
      }
      for (const item of items) {
        const button = make('button', 'gt-cal-cell', item.label);
        button.type = 'button';
        button.dataset.date = item.date;
        button.disabled = Number(item.date.slice(0,4)) < MIN_YEAR || Number(item.date.slice(0,4)) > MAX_YEAR;
        button.classList.toggle('gt-cal-active', chosen === item.date);
        button.setAttribute('aria-label', item.date);
        grid.append(button);
      }
      current.textContent = chosen || 'No date selected';
      use.disabled = !chosen;
      use.textContent = stage === 'month' ? 'Use year only'
        : stage === 'day' ? 'Use year & month' : 'Use selected date';
    }
    function openCalendar() {
      stage = 'year';
      pageYear = Math.floor((Number(chosen.slice(0,4)) || today.getFullYear()) / 12) * 12;
      popup.hidden = false;
      value.setAttribute('aria-expanded', 'true');
      renderCalendar();
    }
    value.addEventListener('click', () => {
      if (popup.hidden) openCalendar();
      else closeCalendar();
    });

    // Delegate to a permanent ancestor: the buttons are removed when the
    // grid redraws. A document click listener must not see a detached target.
    grid.addEventListener('click', event => {
      const button = event.target.closest('button[data-date]');
      if (!button || button.disabled) return;
      event.stopPropagation();
      const date = button.dataset.date;
      source.textContent = ''; // user-chosen date supersedes the imported reference
      setStatus('');
      choose(date);
      if (stage === 'year') stage = 'month';
      else if (stage === 'month') stage = 'day';
      else closeCalendar({restoreFocus:true});
      if (!popup.hidden) {
        renderCalendar();
        // The previous cell was destroyed during redraw. Restore keyboard
        // focus to the next stage instead of losing it to the document.
        grid.querySelector('.gt-cal-cell:not(:disabled)')?.focus({preventScroll:true});
      }
    });
    prev.addEventListener('click', () => {
      if (stage === 'year') pageYear = Math.max(Math.floor(MIN_YEAR/12)*12, pageYear - 12);
      else if (stage === 'month') {
        stage = 'year';
        pageYear = Math.floor(Number(chosen.slice(0,4)) / 12) * 12;
      } else stage = 'month';
      renderCalendar();
    });
    next.addEventListener('click', () => {
      if (stage === 'year' && !next.disabled) {pageYear += 12; renderCalendar();}
    });
    use.addEventListener('click', () => closeCalendar({restoreFocus:true}));
    // Close after the outside control has received its click. Closing on
    // pointerdown moved the radio/checkbox before click, swallowing that click.
    // Date cells stop propagation when they change calendar stage.
    document.addEventListener('click', event => {
      if (!popup.hidden && !wrapper.contains(event.target)) closeCalendar();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !popup.hidden) {
        event.preventDefault();
        closeCalendar({restoreFocus:true});
      }
    });
    const status = section.querySelector('.gt-date-status');
    const source = section.querySelector('.gt-date-source');
    const results = section.querySelector('.gt-date-results');
    const apply = section.querySelector('.gt-date-apply');
    const stop = section.querySelector('.gt-date-stop');
    let tracks = [], busy = false, controller = null;
    const selectedTracks = () => [...trackArea.querySelectorAll('input:checked')]
      .map(el=>tracks[Number(el.value)]).filter(Boolean);
    const setStatus = message => {status.textContent = message;};
    const mode = () => section.querySelector('input[name="gt-date-mode"]:checked')?.value || 'missing';
    const validInput = () => {try{return parseDate(activeDate());}catch{return null;}};
    function updateUI() {
      trackSummary.textContent = `Choose tracks (${selectedTracks().length}/${tracks.filter(t=>api.sameGeniusUrl(t.url)).length})`;
      apply.disabled = busy || !selectedTracks().length || !validInput();
      value.disabled = busy;
      for (const radio of section.querySelectorAll('input[name="gt-date-mode"]')) radio.disabled = busy;
      for (const checkbox of trackArea.querySelectorAll('input')) checkbox.disabled = busy || !api.sameGeniusUrl(tracks[Number(checkbox.value)]?.url);
    }
    function loadTracks() {
      if (busy) return;
      tracks = readTracks(); trackArea.replaceChildren();
      tracks.forEach((track,index) => {
        const row = make('label','gt-date-track');
        const box = make('input');box.type='checkbox';box.value=String(index);
        box.checked = Boolean(api.sameGeniusUrl(track.url));
        box.disabled = !box.checked;
        box.setAttribute('aria-label',`Select ${track.title}`);
        row.classList.toggle('gt-track-selected',box.checked);
        box.addEventListener('change',()=>{
          row.classList.toggle('gt-track-selected',box.checked);updateUI();
        });
        row.append(box,make('span','',`${track.number??track.position}. ${track.title}${box.disabled?' (unlinked)':''}`));
        trackArea.append(row);
      });
      updateUI();
    }
    function offerDate(date, description, details = null) {
      try {
        const parsed = parseDate(date);
        choose(parsed.iso);
        closeCalendar();
        source.textContent = `${description} · ${parsed.iso}`;
        setStatus('');
        updateUI();
        return true;
      } catch {return false;}
    }
    async function batchApply() {
      if (busy) return;
      let date;
      try{date=parseDate(activeDate());}catch(error){setStatus(error.message);return;}
      const selection=selectedTracks();
      if (!selection.length){setStatus('Choose at least one linked track.');return;}
      busy=true;controller=new AbortController();updateUI();stop.hidden=false;results.replaceChildren();
      let done=0,skipped=0,failed=0;
      for (let i=0;i<selection.length;i++) {
        if (controller.signal.aborted) break;
        const track=selection[i];
        setStatus(`Updating dates: ${i+1}/${selection.length} · ${track.title}`);
        try {
          const out=await updateSongDate(track,date,mode(),controller.signal);
          if (out.state==='done')done++;else skipped++;
          results.append(make('div','gt-date-result '+(out.state==='done'?'gt-done':''),`${track.title} — ${out.message}`));
        } catch(error) {
          failed++;
          results.append(make('div','gt-date-result gt-failed',`${track.title} — ${error.message||error}`));
          // In particular, do not continue after unexpected write/auth failure.
          break;
        }
      }
      setStatus(`${controller.signal.aborted?'Stopped.':'Batch finished.'} ${done} updated · ${skipped} unchanged · ${failed} failed.`);
      busy=false;stop.hidden=true;controller=null;updateUI();
    }
    section.querySelector('.gt-date-all').addEventListener('click',()=>{
      if(busy)return;
      for(const checkbox of trackArea.querySelectorAll('input:not(:disabled)')) {
        checkbox.checked=true;checkbox.closest('.gt-date-track').classList.add('gt-track-selected');
      }
      updateUI();
    });
    section.querySelector('.gt-date-none').addEventListener('click',()=>{
      if(busy)return;
      for(const checkbox of trackArea.querySelectorAll('input:not(:disabled)')) {
        checkbox.checked=false;checkbox.closest('.gt-date-track').classList.remove('gt-track-selected');
      }
      updateUI();
    });
    apply.addEventListener('click',()=>void batchApply());
    stop.addEventListener('click',()=>controller?.abort());
    panel.addEventListener('gt:reference-selected',event=>{
      const detail=event.detail||{};
      if (busy || !detail.date) return;
      offerDate(detail.date,`Selected ${detail.provider === 'discogs' ? 'Discogs':'MusicBrainz'} reference`,detail);
    });
    section.addEventListener('toggle',()=>{if(section.open)loadTracks();else closeCalendar();});
    loadTracks();
  }
  globalThis.GeniusToolkitDates={init,parseDate,fromGenius,updateSongDate};
})();
