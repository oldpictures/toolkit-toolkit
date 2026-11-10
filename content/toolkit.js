(() => {
  'use strict';

  const PANEL_ID = 'gt-toolkit';

  // Scope album-only cosmetic overrides to album routes.
  document.documentElement.classList.toggle('gt-album-page', /^\/albums\//i.test(location.pathname));

  // Remove the exact legacy album pencil action, not Genius's main Edit Info
  // controls. Observe re-renders because Angular can recreate the button.
  function hideLegacyAlbumPencils() {
    if (!/^\/albums\//i.test(location.pathname)) return;
    for (const icon of document.querySelectorAll('svg.tiny_edit_button-svg[src="pencil.svg"]')) {
      const control = icon.closest('button, a, [role="button"], .tiny_edit_button');
      if (control && !control.classList.contains('gt-hidden-legacy-pencil')) {
        control.classList.add('gt-hidden-legacy-pencil');
        control.setAttribute('aria-hidden', 'true');
        if ('tabIndex' in control) control.tabIndex = -1;
      }
    }
  }
  hideLegacyAlbumPencils();
  // Ignore our own panel re-renders; rescan legacy pencils only when Genius
  // actually inserts a new pencil button (not on every comparison/table row).
  new MutationObserver(records => {
    if (pageKind() !== 'album') return;
    for (const record of records) {
      if (record.target?.closest?.('#gt-toolkit')) continue;
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (
          node.matches?.('svg.tiny_edit_button-svg[src="pencil.svg"]') ||
          node.querySelector?.('svg.tiny_edit_button-svg[src="pencil.svg"]')
        )) {hideLegacyAlbumPencils();return;}
      }
    }
  }).observe(document.documentElement, {childList:true,subtree:true});


  function pageKind() {
    const path = location.pathname;
    if (/^\/albums\//i.test(path)) return 'album';
    if (/^\/songs\//i.test(path) || /-lyrics(?:\/|$)/i.test(path)) return 'song';
    return 'other';
  }

  // Genius sometimes renders headings as plain divs instead of h2/h3.
  // As a fallback, locate the exact visible label in leaf text nodes.
  function findLeafLabel(root, pattern, maxLength) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > maxLength || !pattern.test(text)) continue;
      const parent = node.parentElement;
      if (parent && !parent.closest(`#${PANEL_ID}`) &&
          !parent.closest('script, style, nav, header') &&
          parent.getBoundingClientRect().width > 0) {
        return parent;
      }
    }
    return null;
  }

  // Locate the album's existing "About" card. Do not insert outside the page
  // layout if Genius changes its markup: that previously pushed the entire
  // website down and made the extension look like a separate page.
  function findAlbumAboutHeading() {
    const headings = document.querySelectorAll(
      'h2, h3, h4, h5, h6, [role="heading"], [class*="Title"], [class*="Heading"]'
    );

    for (const node of headings) {
      if (node.closest(`#${PANEL_ID}`)) continue;
      const value = (node.textContent || '').trim().replace(/\s+/g, ' ');
      if (value.length <= 130 && /^about(?:\s|$|[“"'‘])/i.test(value)) {
        return node;
      }
    }
    return findLeafLabel(document.body, /^about(?:\s|$|[“"'‘])/i, 130);
  }

  function hasUsefulSidebarWidth(el) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    if (window.innerWidth < 760) {
      return box.width >= 220 && box.width <= window.innerWidth + 2;
    }
    return box.width >= 250 &&
      box.width <= Math.min(700, window.innerWidth * 0.49) &&
      box.left >= window.innerWidth * 0.37;
  }

  function findAlbumSidebar(aboutHeading) {
    // On Genius the album information is in a narrow right-hand column.
    // Its generated CSS class names can change, so use actual layout geometry
    // first, with semantic sidebar classes as an additional fallback.
    const candidates = [];
    for (let element = aboutHeading.parentElement; element; element = element.parentElement) {
      if (element === document.body || element === document.documentElement) break;
      if (hasUsefulSidebarWidth(element)) candidates.push(element);
    }
    // The outermost narrow ancestor is the column, rather than the About card.
    if (candidates.length) return candidates[candidates.length - 1];

    const semanticSidebar = aboutHeading.closest(
      'aside, [class*="Sidebar"], [class*="sidebar"], ' +
      '[class*="RightColumn"], [class*="right-column"], [class*="right_column"]'
    );
    return semanticSidebar && hasUsefulSidebarWidth(semanticSidebar)
      ? semanticSidebar
      : null;
  }

  function findQandAHeading(sidebar) {
    const headings = sidebar.querySelectorAll(
      'h2, h3, h4, h5, h6, [role="heading"], [class*="Title"], [class*="Heading"]'
    );
    for (const node of headings) {
      if (node.closest(`#${PANEL_ID}`)) continue;
      const value = (node.textContent || '').trim().replace(/\s+/g, ' ');
      if (value.length <= 75 && /^(?:q\s*(?:&|and|\+)\s*a|questions?\s*(?:&|and)\s*answers?)\b/i.test(value)) {
        return node;
      }
    }
    return findLeafLabel(sidebar, /^(?:q\s*(?:&|and|\+)\s*a|questions?\s*(?:&|and)\s*answers?)$/i, 75);
  }

  function directChildOf(ancestor, descendant) {
    if (!descendant || !ancestor.contains(descendant)) return null;
    let element = descendant;
    while (element.parentElement && element.parentElement !== ancestor) {
      element = element.parentElement;
    }
    return element.parentElement === ancestor ? element : null;
  }

  function createPanel() {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Toolkit Toolkit by refrsh');
    panel.innerHTML = `
      <div class="gt-topline">
        <h3 class="gt-heading">Toolkit Toolkit <span class="gt-byline">by refrsh</span></h3>
        <span class="gt-version">v0.10.15</span>
      </div>
      <details class="gt-reference">
        <summary>Compare tracklists <span class="gt-chevron"></span></summary>
        <div class="gt-reference-body">
          <label class="gt-field-label" for="gt-lookup-provider">Reference database</label>
          <select id="gt-lookup-provider" class="gt-input">
            <option value="musicbrainz">MusicBrainz</option>
            <option value="discogs">Discogs</option>
            <option value="manual">Release link</option>
          </select>
          <div class="gt-auto-fields">
            <div class="gt-search-preview"></div>
            <details class="gt-edit-search">
              <summary>Edit album / artist</summary>
              <label class="gt-field-label" for="gt-album-query">Album</label>
              <input id="gt-album-query" class="gt-input" type="text" autocomplete="off">
              <label class="gt-field-label" for="gt-artist-query">Artist (optional)</label>
              <input id="gt-artist-query" class="gt-input" type="text" autocomplete="off">
            </details>
            <button type="button" class="gt-button gt-lookup-button">Find releases</button>
          </div>
          <div class="gt-manual-fields" hidden>
            <label class="gt-field-label" for="gt-import-url">Discogs or MusicBrainz release link</label>
            <input id="gt-import-url" class="gt-input" type="url" placeholder="Paste a release link" autocomplete="off">
            <button type="button" class="gt-button gt-import-button">Import from link</button>
          </div>
          <div class="gt-lookup-status" aria-live="polite"></div>
          <div class="gt-choices" hidden>
            <div class="gt-choices-label">Choose a release</div>
            <div class="gt-release-results" role="group" aria-label="Reference releases"></div>
          </div>
          <label class="gt-field-label gt-tracklist-label" for="gt-reference-list">Reference tracklist <span class="gt-label-hint">· editable</span></label>
          <textarea id="gt-reference-list" class="gt-input gt-textarea" rows="4" placeholder="Paste track titles here, one per line" spellcheck="false"></textarea>
          <button type="button" class="gt-button gt-compare">Confirm &amp; compare</button>
          <div class="gt-compare-status" aria-live="polite"></div>
        </div>
      </details>
      <details class="gt-date-editor">
        <summary>Date editor</summary>
        <div class="gt-date-body">
          <details class="gt-date-track-picker">
            <summary class="gt-date-tracks-heading">Choose tracks</summary>
            <div class="gt-bulk-select-actions">
              <button type="button" class="gt-link-button gt-date-all">Select all</button>
              <button type="button" class="gt-link-button gt-date-none">Clear</button>
            </div>
            <div class="gt-date-tracks" role="group" aria-label="Tracks for release-date updates"></div>
          </details>
          <div class="gt-date-source" aria-live="polite"></div>
          <label class="gt-field-label" for="gt-date-value">Release date</label>
          <div class="gt-date-calendar-wrap">
            <button type="button" id="gt-date-value" class="gt-input gt-date-display" aria-expanded="false" aria-controls="gt-date-popup"><span class="gt-date-label">Choose a release date</span><span class="gt-date-calendar-icon" aria-hidden="true"></span></button>
            <div id="gt-date-popup" class="gt-date-popup" hidden>
              <div class="gt-date-nav">
                <button type="button" class="gt-cal-prev" aria-label="Previous years"><span class="gt-cal-arrow" aria-hidden="true"></span></button>
                <strong class="gt-cal-heading">Choose year</strong>
                <button type="button" class="gt-cal-next" aria-label="Next years"><span class="gt-cal-arrow" aria-hidden="true"></span></button>
              </div>
              <div class="gt-cal-grid" role="group" aria-label="Choose date"></div>
              <div class="gt-cal-footer">
                <span class="gt-cal-current"></span>
                <button type="button" class="gt-cal-use">Use selected date</button>
              </div>
            </div>
          </div>
          <div class="gt-date-modes" role="group" aria-label="Date editing mode">
            <label><input type="radio" name="gt-date-mode" value="missing" checked> Fill missing dates only</label>
            <label><input type="radio" name="gt-date-mode" value="replace"> Replace existing dates</label>
          </div>
          <button type="button" class="gt-button gt-date-apply" disabled>Apply date to selected tracks</button>
          <button type="button" class="gt-link-button gt-date-stop" hidden>Stop batch</button>
          <div class="gt-date-status" aria-live="polite"></div>
          <div class="gt-date-results" aria-live="polite"></div>
        </div>
      </details>
      <details class="gt-credits-editor">
        <summary>Credits editor</summary>
        <div class="gt-credits-body">
          <details class="gt-credits-track-picker">
            <summary class="gt-credits-tracks-heading">Choose tracks</summary>
            <div class="gt-bulk-select-actions">
              <button type="button" class="gt-link-button gt-credits-all">Select all</button>
              <button type="button" class="gt-link-button gt-credits-none">Clear</button>
            </div>
            <div class="gt-credits-tracks" role="group" aria-label="Songs to edit credits"></div>
          </details>
          <label class="gt-field-label" for="gt-credit-role-search">Credit roles</label>
          <div class="gt-credit-role-field">
            <div class="gt-credit-role-selected" aria-live="polite"></div>
            <input class="gt-input" id="gt-credit-role-search" type="search" role="combobox" autocomplete="off" placeholder="Search roles" aria-autocomplete="list" aria-expanded="false" aria-controls="gt-credit-role-suggestions">
          </div>
          <div id="gt-credit-role-suggestions" class="gt-credit-role-suggestions" role="listbox" aria-label="Credit role suggestions" hidden></div>
          <label class="gt-field-label" for="gt-credit-artist">Genius artist or contributor</label>
          <div class="gt-credit-artist-field">
            <div class="gt-credit-artists" aria-live="polite"></div>
            <input class="gt-input" id="gt-credit-artist" type="search" autocomplete="off" placeholder="Search artists" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="gt-credit-artist-suggestions">
          </div>
          <div id="gt-credit-artist-suggestions" class="gt-credit-suggestions" role="listbox" aria-label="Genius artist suggestions" hidden></div>
          <button type="button" class="gt-button gt-credits-add" disabled>Add credits to selected tracks</button>
          <details class="gt-credits-action gt-credits-remove-action">
            <summary>Remove credits</summary>
            <div class="gt-credits-action-body">
              <button type="button" class="gt-button gt-credits-remove" disabled>Remove matching credits</button>
            </div>
          </details>
          <button type="button" class="gt-link-button gt-credits-stop" hidden>Stop batch</button>
          <div class="gt-credits-status" aria-live="polite"></div>
          <div class="gt-credits-results" aria-live="polite"></div>
        </div>
      </details>
      <details class="gt-bulk">
        <summary>Tag editor</summary>
        <div class="gt-bulk-body">
          <details class="gt-bulk-track-picker">
            <summary class="gt-bulk-picker-summary">Choose tracks</summary>
            <div class="gt-bulk-select-actions">
              <button type="button" class="gt-link-button gt-bulk-all">Select all</button>
              <button type="button" class="gt-link-button gt-bulk-none">Clear</button>
              <button type="button" class="gt-link-button gt-bulk-reload">Reload tracks</button>
            </div>
            <div class="gt-bulk-tracks" role="group" aria-label="Album tracks"></div>
          </details>
          <details class="gt-tag-action gt-tag-add" open>
            <summary>Add tags</summary>
            <div class="gt-tag-action-body">
              <label class="gt-field-label" for="gt-approved-tag-search">Search tags</label>
              <div class="gt-tag-search-field">
                <div class="gt-bulk-selected" aria-label="Tags to add"></div>
                <input type="text" id="gt-approved-tag-search" class="gt-input" placeholder="Search tags" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gt-approved-tag-options" disabled>
              </div>
              <div class="gt-bulk-suggestions" id="gt-approved-tag-options" role="listbox" hidden></div>
              <div class="gt-tag-id-status" aria-live="polite"></div>
              <button type="button" class="gt-button gt-bulk-apply" disabled>Apply tags to selected tracks</button>
            </div>
          </details>
          <details class="gt-tag-action gt-tag-remove">
            <summary>Remove tags</summary>
            <div class="gt-tag-action-body">
              <label class="gt-field-label" for="gt-remove-tag-search">Search tags</label>
              <div class="gt-tag-search-field">
                <div class="gt-remove-selected" aria-label="Tags to remove"></div>
                <input type="text" id="gt-remove-tag-search" class="gt-input" placeholder="Search tags" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gt-remove-tag-options" disabled>
              </div>
              <div class="gt-remove-suggestions" id="gt-remove-tag-options" role="listbox" hidden></div>
              <button type="button" class="gt-button gt-bulk-remove" disabled>Remove tags from selected tracks</button>
              <p class="gt-note gt-bulk-disclaimer">Removes only matching tags already on each song. All other tags are preserved.</p>
            </div>
          </details>
          <button type="button" class="gt-link-button gt-bulk-stop" hidden>Stop batch</button>
          <div class="gt-bulk-status" aria-live="polite"></div>
          <div class="gt-bulk-results" aria-live="polite"></div>
          <details class="gt-bulk-list-settings">
            <summary>Official tag list &amp; cache</summary>
            <div class="gt-bulk-approved-status" aria-live="polite">Loading official Genius tags…</div>
            <button type="button" class="gt-link-button gt-bulk-refresh-tags">Refresh official list</button>
            <button type="button" class="gt-link-button gt-bulk-clear-id-cache">Clear saved tag IDs</button>
            <a class="gt-source-link" href="https://docs.google.com/spreadsheets/d/1lTGIoizY0MfGXsPnErK-cFxmdf25PjnWKexhBq_KF0Y/edit?gid=0" target="_blank" rel="noopener noreferrer">Official Genius tag spreadsheet</a>
          </details>
        </div>
      </details>`;
    // Clicking unused space in any composite field focuses its search input.
    for (const field of panel.querySelectorAll('.gt-credit-role-field,.gt-credit-artist-field,.gt-tag-search-field')) {
      field.addEventListener('click', event => {
        if (event.target === field || event.target === field.querySelector('.gt-credit-role-selected,.gt-credit-artists,.gt-bulk-selected,.gt-remove-selected')) {
          const input = field.querySelector('input:not(:disabled)');
          input?.focus();
        }
      });
    }
    panel.dataset.albumPath = location.pathname;
    initBulk(panel);
    if (globalThis.GeniusToolkitCredits?.init)
      globalThis.GeniusToolkitCredits.init(panel, () => readRows().tracks);
    if (globalThis.GeniusToolkitDates?.init)
      globalThis.GeniusToolkitDates.init(panel, () => readRows().tracks, () => guessAlbumMetadata(), mbRequest);
    panel.querySelector('.gt-lookup-button').addEventListener('click', () => lookupMusicBrainz(panel));
    panel.querySelector('#gt-lookup-provider').addEventListener('change', () => {
      panel.querySelector('.gt-release-results').replaceChildren();
      panel.querySelector('.gt-lookup-status').replaceChildren();
      updateLookupProvider(panel);
    });
    panel.querySelector('.gt-compare').addEventListener('click', () => void compareReference(panel));
    panel.querySelector('.gt-import-button').addEventListener('click', () => importReleaseLink(panel));
    panel.querySelector('.gt-textarea').addEventListener('input', () => {
      panel.querySelector('.gt-compare-status').replaceChildren();
      panel._gtFixData = null;
      panel._gtCompareRun = (panel._gtCompareRun || 0) + 1;
      panel.dataset.gtCompared = '';
      panel.querySelector('.gt-compare').textContent = 'Confirm & compare';
    });
    const metadata = guessAlbumMetadata();
    panel.querySelector('#gt-album-query').value = metadata.album;
    panel.querySelector('#gt-artist-query').value = metadata.artist;
    const updateSearchPreview = () => {
      const album = panel.querySelector('#gt-album-query').value.trim();
      const artist = panel.querySelector('#gt-artist-query').value.trim();
      panel.querySelector('.gt-search-preview').textContent = [album, artist].filter(Boolean).join(' · ') || 'Set an album title to search';
    };
    for (const input of panel.querySelectorAll('#gt-album-query, #gt-artist-query')) {
      input.addEventListener('input', updateSearchPreview);
    }
    updateSearchPreview();
    updateLookupProvider(panel);
    return panel;
  }

  function initBulk(panel) {
    if (!globalThis.GeniusToolkitAlbumTags?.init) {
      panel.querySelector('.gt-bulk-approved-status').textContent = 'Bulk tags module unavailable. Reload the extension.';
      return;
    }
    globalThis.GeniusToolkitAlbumTags.init(panel, () => readRows().tracks);
  }

  function updateLookupProvider(panel) {
    const manual = panel.querySelector('#gt-lookup-provider').value === 'manual';
    panel.querySelector('.gt-auto-fields').hidden = manual;
    panel.querySelector('.gt-manual-fields').hidden = !manual;
    panel.querySelector('.gt-choices').hidden = manual || !panel.querySelector('.gt-release-results').children.length;
  }

  async function importReleaseLink(panel) {
    const raw = panel.querySelector('#gt-import-url').value.trim();
    const status = panel.querySelector('.gt-lookup-status');
    status.replaceChildren();
    let id, provider;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:') throw Error();
      if (['musicbrainz.org','www.musicbrainz.org'].includes(url.hostname)) {
        provider = 'musicbrainz';
        id = url.pathname.match(/^\/release\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})(?:\/|$)/i)?.[1];
      } else if (['discogs.com','www.discogs.com'].includes(url.hostname)) {
        provider = 'discogs';
        id = url.pathname.match(/^\/release\/(\d+)(?:[-\/]|$)/i)?.[1];
      }
      if (!id) throw Error();
    } catch {
      addLine(status, 'Paste a Discogs or MusicBrainz release URL, or paste track titles below.', 'gt-warning');
      return;
    }
    const button = panel.querySelector('.gt-import-button');
    button.disabled = true;
    addLine(status, 'Importing release…', 'gt-note');
    try {
      const result = await mbRequest('release', {id}, provider);
      if (!panel.isConnected) return;
      loadImportedTracks(panel, result.tracks, result.url || raw, (provider === 'discogs' ? 'Discogs' : 'MusicBrainz') + ' release · ' + result.tracks.length + ' tracks', id);
      rememberReferenceDate(panel, provider, result, id);
      status.replaceChildren();
      addLine(status, 'Imported. Review the list and click Confirm & compare.', 'gt-check');
    } catch (error) {
      status.replaceChildren(); addLine(status, error.message, 'gt-warning');
    } finally {button.disabled = false;}
  }

  function loadImportedTracks(panel, tracks, url, label, id) {
    panel.querySelector('#gt-reference-list').value = tracks.map(track => `${track.position}. ${track.title}`).join('\n');
    panel.dataset.referenceSource = url || '';
    panel.dataset.releaseId = id || '';
    panel.querySelector('.gt-compare-status').replaceChildren();
    panel._gtFixData = null;
    panel.dataset.gtCompared = '';
    panel.querySelector('.gt-compare').textContent = 'Confirm & compare';
  }

  function rememberReferenceDate(panel, provider, release, id) {
    const date = String(release?.date || '').trim();
    panel.dataset.referenceProvider = provider;
    panel.dataset.referenceDate = date;
    panel.dispatchEvent(new CustomEvent('gt:reference-selected', {detail:{
      provider, id, date, title:release?.title || ''
    }}));
  }

  // Strip Genius artist-page disambiguators, but not ordinary artist names.
  function cleanArtistName(value) {
    let name = clean(value).replace(/\s*\|\s*Genius.*$/i, '');
    const qualifiers = /^(?:producer|produced by|usa|us|uk|united states|united kingdom|canada|australia|france|germany|italy|rapper|singer|songwriter|artist|band|musician|dj|genius|verified|official|[a-z]{2}(?:[\s,-]+[a-z]{2})?)$/i;
    while (/\s+\([^()]+\)\s*$/.test(name)) {
      const match = name.match(/\s+\(([^()]*)\)\s*$/);
      if (!match || !qualifiers.test(match[1].trim())) break;
      name = name.slice(0, match.index).trim();
    }
    return name;
  }

  function artistFromStructuredData() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const root of nodes) {
          for (const node of [root, ...(Array.isArray(root?.['@graph']) ? root['@graph'] : [])]) {
            const by = node?.byArtist || node?.author || node?.creator;
            const artist = Array.isArray(by) ? by[0] : by;
            const name = typeof artist === 'string' ? artist : artist?.name;
            if (name && /music|album/i.test(String(node?.['@type'] || ''))) return cleanArtistName(name);
          }
        }
      } catch (_) { /* ignore invalid JSON-LD */ }
    }
    return '';
  }

  function guessAlbumMetadata() {
    const og = clean(document.querySelector('meta[property="og:title"]')?.content || '');
    const title = clean(document.title);
    const match = (og || title).match(/^(.+?)\s+by\s+(.+?)(?:\s*\|.*)?$/i);
    const heading = document.querySelector('h1');
    const album = match ? clean(match[1]) : clean(heading?.textContent || og.replace(/\s*\|.*$/, '') || title.replace(/\s*\|.*$/, ''));
    // Prefer the actual album artist link over title text. Never take a song
    // collaborator or a link inside our own sidebar.
    const artistLink = [...document.querySelectorAll('a[href*="/artists/"]')].find(el =>
      !el.closest(`#${PANEL_ID}, nav, header, footer`) &&
      (el.closest('[class*="Album"], [class*="album"], main, [role="main"]') ||
       el.parentElement?.querySelector('h1')) && clean(el.textContent));
    const artist = artistFromStructuredData() ||
      cleanArtistName(artistLink?.textContent || '') ||
      cleanArtistName(match?.[2] || '') ||
      cleanArtistName(clean(document.querySelector('meta[property="og:description"]')?.content || '').match(/(?:album|project) by ([^.|]+)/i)?.[1] || '');
    return {album: album.slice(0, 140), artist: artist.slice(0, 140)};
  }

  async function mbRequest(action, params, provider = 'musicbrainz') {
    if (typeof browser === 'undefined' || !browser.runtime?.sendMessage)
      throw Error('firefox extension messaging is unavailable.');
    const answer = await browser.runtime.sendMessage({scope:provider === 'discogs' ? 'gt-discogs' : 'gt-musicbrainz',action,...params});
    if (!answer?.ok) throw Error(answer?.error || `${provider === 'discogs' ? 'Discogs' : 'MusicBrainz'} request failed.`);
    return answer;
  }

  async function lookupMusicBrainz(panel) {
    const provider = panel.querySelector('#gt-lookup-provider').value;
    const button = panel.querySelector('.gt-lookup-button');
    const status = panel.querySelector('.gt-lookup-status');
    const results = panel.querySelector('.gt-release-results');
    const choices = panel.querySelector('.gt-choices');
    results.replaceChildren();
    status.replaceChildren();
    panel.querySelector('.gt-compare-status').replaceChildren();
    choices.hidden = true;
    const album = panel.querySelector('#gt-album-query').value.trim();
    const artist = panel.querySelector('#gt-artist-query').value.trim();
    if (provider === 'manual') return;
    if (album.length < 2) {
      panel.querySelector('.gt-edit-search').open = true;
      addLine(status, 'Enter an album title first.', 'gt-warning');
      return;
    }
    button.disabled = true;
    button.textContent = 'Searching…';
    addLine(status, `Searching ${provider === 'discogs' ? 'Discogs' : 'MusicBrainz'}…`, 'gt-note');
    try {
      const response = await mbRequest('search', {album, artist}, provider);
      if (!panel.isConnected) return;
      status.replaceChildren();
      if (!response.releases.length) {
        addLine(status, provider === 'discogs' ? 'No public Discogs results found. Try a different query or paste a release URL using Release link.' : 'No releases found. Try editing the search.', 'gt-warning');
        return;
      }
      choices.hidden = false;
      choices.querySelector('.gt-choices-label').textContent = `Choose a release (${response.releases.length})`;
      addLine(status, `${response.releases.length} possible edition${response.releases.length === 1 ? '' : 's'} found.`, 'gt-note');
      for (const release of response.releases) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'gt-release-choice';
        const art = document.createElement('img');
        art.className = 'gt-release-art';
        art.alt = '';
        art.loading = 'lazy';
        art.referrerPolicy = 'no-referrer';
        // Cover Art Archive's release-specific front cover; absent artwork gets a placeholder.
        // IDs come from MusicBrainz and are validated before constructing the URL.
        if (provider === 'discogs' && /^https:\/\/[^\s]+$/.test(release.thumb || '')) {
          art.src = release.thumb;
        } else if (provider === 'musicbrainz' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(release.id)) {
          art.src = `https://coverartarchive.org/release/${release.id}/front-250`;
        }
        art.addEventListener('error', () => {
          art.removeAttribute('src');
          art.classList.add('gt-release-art-missing');
        }, {once:true});
        const textWrap = document.createElement('span');
        textWrap.className = 'gt-release-text';
        const name = document.createElement('span');
        name.className = 'gt-release-name';
        name.textContent = release.title + ' — ' + release.artist;
        const detail = document.createElement('span');
        detail.className = 'gt-release-meta';
        detail.textContent = [release.date, release.country, release.status,
          release.tracks == null ? '' : `${release.tracks} tracks`, release.disambiguation]
          .filter(Boolean).join(' · ') || 'Edition details unavailable';
        textWrap.append(name, detail);
        option.append(art, textWrap);
        option.addEventListener('click', () => selectRelease(panel, release, option, provider));
        results.appendChild(option);
      }
    } catch (error) {
      if (panel.isConnected) {
        status.replaceChildren();
        addLine(status, error.message, 'gt-warning');
        if (provider === 'discogs') {
          const link = document.createElement('a');
          const query = [artist, album].filter(Boolean).join(' ');
          link.href = 'https://www.discogs.com/search/?' + new URLSearchParams({q:query,type:'release'});
          link.className = 'gt-source-link';
          link.textContent = 'Open Discogs search';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          status.appendChild(link);
          addLine(status, 'If Discogs blocks automated search, copy a release URL and select Release link.', 'gt-note');
        }
      }
    } finally {
      if (panel.isConnected) {
        button.disabled = false;
        button.textContent = 'Find releases';
      }
    }
  }

  async function selectRelease(panel, release, option, provider) {
    const status = panel.querySelector('.gt-lookup-status');
    const choices = [...panel.querySelectorAll('.gt-release-choice')];
    choices.forEach(button => button.disabled = true);
    status.replaceChildren();
    addLine(status, 'Loading tracklist…', 'gt-note');
    try {
      const result = await mbRequest('release', {id:release.id}, provider);
      if (!panel.isConnected) return;
      loadImportedTracks(panel, result.tracks, result.url, `${release.title} — ${release.artist} · ${result.tracks.length} tracks`, release.id);
      rememberReferenceDate(panel, provider, {...release, ...result, date:result.date || release.date}, release.id);
      choices.forEach(button => button.classList.toggle('gt-selected', button === option));
      status.replaceChildren();
      addLine(status, 'Release imported. Review the list, then confirm & compare.', 'gt-check');
    } catch (error) {
      if (panel.isConnected) {
        status.replaceChildren();
        addLine(status, error.message, 'gt-warning');
      }
    } finally { choices.forEach(button => button.disabled = false); }
  }

  // Some album pages have no About card at all. Prefer the native right
  // column when it exists, but never make that one heading a prerequisite for
  // mounting the entire toolkit.
  function isAlbumContentArea(el) {
    return el && !el.closest('nav, header, footer, [role="dialog"], [aria-modal="true"], #gt-toolkit');
  }

  function validAlbumSidebar(el) {
    return isAlbumContentArea(el) && hasUsefulSidebarWidth(el) &&
      !el.querySelector('.chart_row, [data-testid*="tracklist" i]') &&
      el.getBoundingClientRect().top < 3500;
  }

  function findAlternateSidebar() {
    // Named sidebar containers are safest, even when they contain no About.
    const semantic = [...document.querySelectorAll(
      'aside, [class*="Sidebar"], [class*="sidebar"], ' +
      '[class*="RightColumn"], [class*="right-column"], ' +
      '[class*="right_column"], [data-testid*="sidebar" i]'
    )].filter(validAlbumSidebar);
    if (semantic.length) {
      // A right column usually wraps smaller sidebar cards. Prefer the
      // outermost candidate, not an individual nested card.
      semantic.sort((a, b) => {
        if (a.contains(b)) return -1;
        if (b.contains(a)) return 1;
        return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
      });
      return semantic[0];
    }

    // Older Genius layouts may use generated class names with no semantic
    // sidebar class. Find a narrow right-hand column from other album cards.
    const headingPattern = /^(?:q\s*(?:&|and|\+)\s*a|contributors?|album\s+(?:info(?:rmation)?|credits|details)|release\s+(?:date|info(?:rmation)?)|description|about(?:\s+the\s+album)?|more\s+on\s+genius)$/i;
    const headings = document.querySelectorAll(
      'h2, h3, h4, h5, h6, [role="heading"], [class*="Title"], [class*="Heading"]'
    );
    for (const heading of headings) {
      if (!isAlbumContentArea(heading)) continue;
      const label = (heading.textContent || '').trim().replace(/\s+/g, ' ');
      if (label.length > 90 || !headingPattern.test(label)) continue;
      const sidebar = findAlbumSidebar(heading);
      if (sidebar && validAlbumSidebar(sidebar)) return sidebar;
    }

    // A two-column layout can have a completely unlabeled sidebar. Inspect
    // siblings of the album tracklist's main content column, rather than
    // guessing from arbitrary links anywhere on the page.
    const row = document.querySelector('.chart_row, [data-testid*="tracklist" i], [class*="tracklist" i]');
    if (row && isAlbumContentArea(row)) {
      for (let main = row.parentElement; main && main !== document.body; main = main.parentElement) {
        const parent = main.parentElement;
        if (!parent) continue;
        const options = [...parent.children].filter(el =>
          el !== main && validAlbumSidebar(el) &&
          el.getBoundingClientRect().left >= main.getBoundingClientRect().right - 12
        );
        if (options.length) return options[0];
      }
    }
    return null;
  }

  function sidebarInsertion(sidebar, preferredHeading) {
    const preferred = preferredHeading && sidebar.contains(preferredHeading)
      ? directChildOf(sidebar, preferredHeading) : null;
    // Skip ad placeholders and scripts, but keep the panel above the first
    // meaningful native sidebar block.
    const first = [...sidebar.children].find(el =>
      el.id !== PANEL_ID && !el.matches('script, style, template') &&
      el.getBoundingClientRect().height > 0
    );
    return {parent: sidebar, anchor: preferred || first || null, mode: 'sidebar'};
  }

  function inlineAlbumInsertion() {
    // Last resort for album layouts without any right-hand column. Mount
    // alongside album content instead of disappearing or appending to <body>.
    const rows = document.querySelector('.chart_row, [data-testid*="tracklist" i], [class*="tracklist" i]');
    if (rows && isAlbumContentArea(rows)) {
      const main = rows.closest('main, [role="main"]') ||
        [...document.querySelectorAll('main, [role="main"]')].find(el => el.contains(rows));
      if (main && isAlbumContentArea(main)) {
        const anchor = directChildOf(main, rows);
        if (anchor) return {parent: main, anchor, mode: 'inline'};
      }
      // Classic Genius album pages sometimes use only divs, not <main>.
      // Anchor to the tracklist's own container, never to a chart row or body.
      const tracklist = rows.closest(
        '[data-testid*="tracklist" i], [class*="tracklist" i], [id*="tracklist" i]'
      ) || (rows.matches('.chart_row') ? rows.parentElement : null);
      const host = tracklist?.parentElement;
      const rect = host?.getBoundingClientRect();
      if (host && host !== document.body && isAlbumContentArea(host) &&
          rect.width >= 250 && rect.width <= Math.max(760, window.innerWidth * 0.85)) {
        return {parent: host, anchor: tracklist, mode: 'inline'};
      }
    }
    const title = [...document.querySelectorAll('h1')].find(el =>
      isAlbumContentArea(el) && el.getBoundingClientRect().width > 0
    );
    const main = title?.closest('main, [role="main"]');
    if (main) {
      const titleBlock = directChildOf(main, title);
      return {parent: main, anchor: titleBlock?.nextElementSibling || null, mode: 'inline', appendIfEmpty: true};
    }
    return null;
  }

  function mountPanelInSidebar() {
    let panel = document.getElementById(PANEL_ID);
    if (pageKind() !== 'album') {
      if (panel) panel.remove();
      return;
    }
    if (panel && panel.dataset.albumPath !== location.pathname) {
      panel.remove();
      panel = null;
    }
    // No need to rescan the page on every unrelated Genius DOM mutation.
    // Inline fallbacks can still move to a native sidebar if one loads later.
    if (panel?.isConnected && panel.dataset.mountMode === 'sidebar') return;

    const about = findAlbumAboutHeading();
    const nativeSidebar = about && findAlbumSidebar(about);
    const sidebar = nativeSidebar || findAlternateSidebar();
    const target = sidebar
      ? sidebarInsertion(sidebar, about)
      : inlineAlbumInsertion();
    if (!target) return;

    if (!panel) panel = createPanel();
    // The title-only fallback can point at the panel itself after mounting.
    if (target.anchor === panel) return;
    panel.dataset.mountMode = target.mode;
    panel.classList.toggle('gt-inline-fallback', target.mode === 'inline');
    if (panel.parentElement !== target.parent || panel.nextElementSibling !== target.anchor) {
      if (target.anchor) target.anchor.insertAdjacentElement('beforebegin', panel);
      else if (target.appendIfEmpty) target.parent.append(panel);
      else target.parent.prepend(panel);
    }
  }

  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  // Use the same balanced-parentheses parser for displayed titles,
  // comparison keys and the authenticated rename safety check.
  const cleanGeniusTitle = value => clean(value)
    .replace(/(?:\s+|\s*[·|–—-]\s*)lyrics\s*$/i, '').trim();
  const cleanMatchTitle = value => globalThis.GeniusToolkitTitles.cleanAlbumTrackTitle(value);
  const norm = value => clean(value).normalize('NFKC').toLocaleLowerCase()
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  const confirmedTitles = new Map();
  let confirmedAlbumPath = location.pathname;
  function checkConfirmedAlbum() {
    if (confirmedAlbumPath !== location.pathname) {
      confirmedAlbumPath = location.pathname;
      confirmedTitles.clear();
    }
  }

  // A collaboration album may display a song as "Title by Artist (Ft. Guest)".
  // That byline is not part of the song title. Only remove it when either the
  // row explicitly identifies the artist or the song URL confirms the title.
  // Never blindly split on " by ": real titles like "Stand by Me" must survive.
  function trackTitleSlug(value) {
    return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function songUrlConfirmsTitle(title, anchor) {
    const href = songHref(anchor);
    if (!href) return false;
    try {
      const path = new URL(href).pathname;
      const slug = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
        .replace(/-lyrics$/i, '').toLocaleLowerCase();
      const titleSlug = trackTitleSlug(title);
      return titleSlug.length >= 2 &&
        (slug === titleSlug || slug.endsWith('-' + titleSlug));
    } catch { return false; }
  }

  function cleanRowTitle(raw, row, anchor) {
    const text = cleanGeniusTitle(raw);
    const full = cleanMatchTitle(text);
    if (!text || !/\sby\s/i.test(text)) return full;
    // A URL ending in 'day-by-day' also ends in '-day'. Check the
    // *longest full title first*, or 'Day by Day' becomes 'Day'.
    if (songUrlConfirmsTitle(full, anchor)) return full;
    const artistElement = row.querySelector(
      '.chart_row-content-artist, [data-testid*="track-artist" i], ' +
      '[class*="track_artist" i], [class*="artist_name" i]'
    );
    const artistLink = artistElement?.querySelector('a[href*="/artists/"]') ||
      row.querySelector('a[href*="/artists/"]');
    const artist = clean(artistElement?.textContent || artistLink?.textContent || '')
      .replace(/^by\s+/i, '');
    const bylinePattern = /\s+by\s+/gi;
    const matches = [...text.matchAll(bylinePattern)];
    for (const match of matches.reverse()) {
      const title = text.slice(0, match.index).trim();
      const suffix = text.slice(match.index + match[0].length).trim();
      if (!title || !suffix) continue;
      const primary = cleanMatchTitle(suffix);
      const cleanedTitle = cleanMatchTitle(title);
      const knownArtist = artist && norm(primary) === norm(artist);
      if (knownArtist || songUrlConfirmsTitle(cleanedTitle, anchor)) return cleanedTitle;
    }
    return full;
  }

  function songHref(anchor) {
    if (!anchor) return '';
    try {
      const url = new URL(anchor.getAttribute('href'), location.href);
      if (!/(^|\.)genius\.com$/i.test(url.hostname)) return '';
      if (!/-lyrics\/?$/i.test(url.pathname)) return '';
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch { return ''; }
  }

  // Read row elements rather than global links to avoid counting recommended songs.
  // Primary selectors are from Genius' chart_row album-tracklist markup.
  function readRows() {
    checkConfirmedAlbum();
    let rows = [...document.querySelectorAll('.chart_row')]
      .filter(row => !row.closest(`#${PANEL_ID}, nav, header, aside`));
    let source = 'Genius tracklist rows';
    if (!rows.length) {
      // Narrow fallback for alternate/newer Genius layouts. Never scrape all
      // song links from the document, which would count unrelated suggestions.
      const containers = [...document.querySelectorAll(
        '[data-testid*="tracklist" i], [class*="tracklist" i], [id*="tracklist" i]'
      )].filter(el => !el.closest(`#${PANEL_ID}, nav, header, aside`));
      const candidates = containers.map(el => ({el, links: [...el.querySelectorAll('a[href]')]
        .filter(a => songHref(a)).length})).filter(x => x.links > 0)
        .sort((a,b) => b.links - a.links || a.el.querySelectorAll('*').length - b.el.querySelectorAll('*').length);
      const container = candidates[0]?.el;
      if (!container) return {tracks: [], source: 'none'};
      rows = [...container.querySelectorAll('a[href]')].filter(a => songHref(a))
        .map(a => a.closest('[data-testid*="track" i], [class*="track" i], li') || a)
        .filter((row, index, arr) => arr.indexOf(row) === index);
      source = 'alternate tracklist markup';
    }

    const tracks = [];
    rows.forEach((row, index) => {
      const titleEl = row.querySelector('.chart_row-content-title, [data-testid*="track-title" i]');
      const candidates = [titleEl?.closest('a[href]'), ...row.querySelectorAll('a[href]')].filter(Boolean);
      const anchor = candidates.find(a => songHref(a));
      // Certain unlinked tracks are present in tracklists; retain them only
      // when a dedicated row title is available, rather than guessing.
      const title = cleanRowTitle(
        titleEl?.textContent || anchor?.querySelector('.chart_row-content-title')?.textContent || anchor?.textContent,
        row, anchor
      );
      if (!title || title.length > 220) return;
      const rawNumber = clean(row.querySelector('.chart_row-number_container-number span, .chart_row-number_container-number, [data-testid*="track-number" i]')?.textContent);
      const number = /^\d{1,3}$/.test(rawNumber) ? Number(rawNumber) : null;
      const url = songHref(anchor);
      tracks.push({title: confirmedTitles.get(url) || title, number, url, position: index + 1});
    });
    return {tracks, source};
  }

  function addLine(target, text, className = 'gt-check') {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    target.appendChild(el);
    return el;
  }

  // Accept a pasted, user-supplied release tracklist. No external service is
  // accessed and we do not independently certify that the reference is official.
  function parseReference(text) {
    return text.split(/\r?\n/).map((line, index) => {
      let title = clean(line.replace(/^[\s\u2022*•-]+/, ''));
      // 01. Title / 01) Title / 01 - Title / 01: Title / 1 Title
      title = title.replace(/^(?:\d{1,3}[.)\]:-]\s*|\d{1,3}\s+(?=\S))/, '');
      // [03] Title / (03) Title
      title = title.replace(/^[[(]\d{1,3}[\])]?\s*/, '');
      title = clean(title.replace(/\s+\((?:\d{1,2}:)?\d{1,2}:\d{2}\)$/, ''));
      return {title, line: index + 1};
    }).filter(row => row.title && !/^\s*(?:disc|side|cd)\s*(?:\d+|[a-z])\s*:?$/i.test(row.title));
  }

  // Align tracks by longest common subsequence. Exact matches anchor their
  // positions, so an inserted or missing track never shifts all later rows.
  // Normalize once per title, and derive both the table and counts from this
  // single alignment (the old counters used a different matching algorithm).
  function alignComparisonRows(genius, reference) {
    const n = genius.length, m = reference.length;
    const a = genius.map(t => norm(cleanMatchTitle(t.title)));
    const b = reference.map(t => norm(cleanMatchTitle(t.title)));
    const dp = Array.from({length:n + 1}, () => new Uint16Array(m + 1));
    for (let i=n-1;i>=0;i--) for (let j=m-1;j>=0;j--)
      dp[i][j] = a[i] && a[i] === b[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j],dp[i][j+1]);
    const anchors = []; let i=0,j=0;
    while (i<n && j<m) {
      if (a[i] && a[i]===b[j]) {anchors.push([i,j]);i++;j++;}
      else if (dp[i+1][j]>=dp[i][j+1]) i++;
      else j++;
    }
    const rows=[]; let gi=0,ri=0;
    for (const [nextG,nextR] of [...anchors,[n,m]]) {
      const gap = Math.max(nextG-gi,nextR-ri);
      for(let k=0;k<gap;k++) {
        const left=gi+k<nextG ? genius[gi+k] : null;
        const right=ri+k<nextR ? reference[ri+k] : null;
        rows.push({left,right,status:left&&right?'different':left?'genius-only':'reference-only',leftIndex:left?gi+k:null,rightIndex:right?ri+k:null});
      }
      if(nextG<n) rows.push({left:genius[nextG],right:reference[nextR],status:'match',leftIndex:nextG,rightIndex:nextR});
      gi=nextG+1;ri=nextR+1;
    }
    // An out-of-order title can appear as one Genius-only and one reference-
    // only row in the LCS. Pair these by exact normalized title (incl. repeats)
    // so reordering isn't misreported as a missing or misspelled song.
    const orphanG = new Map();
    for (const row of rows) if (row.status === 'genius-only') {
      const key = a[row.leftIndex];
      if (!orphanG.has(key)) orphanG.set(key, []);
      orphanG.get(key).push(row);
    }
    for (const row of rows) if (row.status === 'reference-only') {
      const from = orphanG.get(b[row.rightIndex]);
      if (from?.length) {from.shift().status='moved';row.status='moved';}
    }
    return rows;
  }

  function summarizeRows(rows) {
    const summary = {matched:0, different:0, geniusOnly:0, referenceOnly:0, reordered:0};
    for (const row of rows) {
      if (row.status === 'match') summary.matched++;
      else if (row.status === 'moved') {
        if (row.right) {summary.matched++;summary.reordered++;}
      } else if (row.status === 'different') summary.different++;
      else if (row.status === 'genius-only') summary.geniusOnly++;
      else if (row.status === 'reference-only') summary.referenceOnly++;
    }
    return summary;
  }

  function renderComparisonColumns(output, rows) {
    const legend=document.createElement('div');
    legend.className='gt-compare-legend';
    legend.textContent='Yellow: titles to review. Gray: tracks only on one list. Pale yellow: different track order.';
    output.appendChild(legend);
    const grid=document.createElement('div');
    grid.className='gt-side-by-side';
    grid.setAttribute('role','table');
    grid.setAttribute('aria-label','Genius and reference tracklists side by side');
    const headings=document.createElement('div');
    headings.className='gt-compare-row gt-compare-header';
    headings.setAttribute('role','row');
    for(const label of ['Genius tracklist','Reference tracklist']) {
      const cell=document.createElement('div');cell.setAttribute('role','columnheader');cell.textContent=label;headings.appendChild(cell);
    }
    grid.appendChild(headings);
    const body = document.createDocumentFragment();
    for(const row of rows) {
      const line=document.createElement('div');
      line.className='gt-compare-row gt-compare-'+row.status;
      line.setAttribute('role','row');
      for(const [track,index] of [[row.left,row.leftIndex],[row.right,row.rightIndex]]) {
        const cell=document.createElement('div');cell.className='gt-compare-cell';cell.setAttribute('role','cell');
        if(track) {
          const number=document.createElement('span');number.className='gt-compare-number';
          number.textContent=String(index+1).padStart(2,'0');
          const title=document.createElement('span');title.className='gt-compare-title';title.textContent=track.title;
          cell.append(number,title);
        } else {cell.classList.add('gt-compare-empty');cell.textContent='—';}
        line.appendChild(cell);
      }
      body.appendChild(line);
    }
    grid.appendChild(body);
    output.appendChild(grid);
    return rows;
  }

  // A comparison is evidence of a discrepancy, not permission to create or
  // overwrite an unrelated song. Actions are opt-in and separately verified.
  function renderTrackFixes(panel, output, rows, genius, reference) {
    const actions = [];
    for (const row of rows) {
      if (!row.right || row.status === 'match') continue;
      const title = row.right.title.trim();
      const titleKey = norm(title);
      if (!title || title.length > 200 || !titleKey) continue;
      if (row.status === 'different' && row.left?.url) {
        // A different row can also be an inserted/deleted song. Never check
        // renames by default; the user must explicitly approve each pairing.
        actions.push({kind:'rename', track:row.left, title, index:row.rightIndex});
      }
    }
    if (!actions.length) return;
    // Read the live DOM a second time only if an actual write action exists.
    panel._gtFixData = {actions, geniusSignature:JSON.stringify(readRows().tracks), referenceSignature:JSON.stringify(reference), albumPath:location.pathname};
    const area=document.createElement('div'); area.className='gt-fixes';
    const heading=document.createElement('div'); heading.className='gt-fixes-heading'; heading.textContent='Fix differences';
    area.appendChild(heading);
    addLine(area,'Choose what to fix. Renames are not automatic suggestions—check the original and reference before selecting.','gt-note');
    const options=document.createElement('div'); options.className='gt-fix-options';
    actions.forEach((action,i)=>{
      const label=document.createElement('label');label.className='gt-fix-option';
      const input=document.createElement('input');input.type='checkbox';input.className='gt-fix-check';input.value=String(i);
      const labelText=document.createElement('span');
      const title=document.createElement('strong');
      title.textContent='Rename existing song';
      const desc=document.createElement('span');desc.className='gt-fix-description';
      desc.textContent=`“${action.track.title}” → “${action.title}”`;
      labelText.append(title,desc);label.append(input,labelText);options.appendChild(label);
    });
    area.appendChild(options);
    const button=document.createElement('button');button.type='button';button.className='gt-button gt-fix-apply';
    button.textContent='Apply selected fixes';button.disabled=true;
    const status=document.createElement('div');status.className='gt-fix-status';status.setAttribute('aria-live','polite');
    const results=document.createElement('div');results.className='gt-fix-results';
    const hint=document.createElement('p');hint.className='gt-note';
    hint.textContent='Only existing song titles can be corrected here. Missing tracks remain visible in the comparison.';
    area.append(button,hint,status,results);
    options.addEventListener('change',()=>{button.disabled=!options.querySelector('.gt-fix-check:checked');});
    button.addEventListener('click',()=>void applyTrackFixes(panel,button,status,results));
    output.appendChild(area);
  }

  async function applyTrackFixes(panel,button,status,results){
    const data=panel._gtFixData;
    if(!data||data.albumPath!==location.pathname||
       data.geniusSignature!==JSON.stringify(readRows().tracks)||
       data.referenceSignature!==JSON.stringify(parseReference(panel.querySelector('.gt-textarea').value))){
      status.replaceChildren();addLine(status,'The album or reference list changed. Compare again before applying fixes.','gt-warning');return;
    }
    const chosen=[...panel.querySelectorAll('.gt-fix-check:checked')]
      .map(el=>data.actions[Number(el.value)]).filter(Boolean);
    if(!chosen.length)return;
    const renames=chosen.filter(a=>a.kind==='rename');
    if(!renames.length)return;
    if(renames.length>12){
      status.replaceChildren();addLine(status,'Please select no more than 12 title changes per batch.','gt-warning');return;
    }
    const confirmation=`Apply ${renames.length} title change(s) on Genius?\n\nThis will update live Genius song pages.`;
    if(!window.confirm(confirmation))return;
    button.disabled=true;status.replaceChildren();results.replaceChildren();
    const api=globalThis.GeniusToolkitTrackFixes;
    if(!api){button.disabled=false;addLine(status,'Track fixes module unavailable. Reload the extension.','gt-warning');return;}
    const successful=[];let failed=false;
    for(const action of renames){
      addLine(status,`Updating “${action.track.title}”...`,'gt-note');
      try{
        const result=await api.renameSong(action.track,action.title);
        addLine(results,`renamed: ${result.before} → ${result.after}`,'gt-check');
        successful.push(result);
        if (action.track.url && !result.unchanged) confirmedTitles.set(action.track.url, result.after);
      }catch(error){
        addLine(results,`failed “${action.track.title}”: ${error.message}`,'gt-warning');failed=true;
        break; // no further writes after a failed update
      }
    }
    status.replaceChildren();
    if(failed)addLine(status,'Stopped after a failure. Recheck the album before running fixes again.','gt-warning');
    else {
      // Genius may not rerender its tracklist after a successful API save.
      // Compare against the verified saved title instead of stale page text.
      panel._gtFixData=null;
      panel.querySelector('.gt-compare').disabled = false;
      await compareReference(panel, {skipNetwork:true});
      addLine(panel.querySelector('.gt-compare-status'),
        `${successful.length} verified title update${successful.length===1?'':'s'}; comparison refreshed without reloading.`, 'gt-check');
      return;
    }
    panel._gtFixData=null;
    button.disabled=true;
  }

  // A repeat comparison can optionally get fresh song titles from Genius's
  // *album* API in one request. Exact song URLs are required for cross-checking;
  // never guess a title by index or use a different release's tracklist.
  // If the endpoint is unavailable, a live DOM rescan still works offline.
  async function freshAlbumTitles(tracks) {
    const api = globalThis.GeniusToolkitTagApi;
    const albumId = api?.albumIdFromPage?.(document);
    if (!albumId || !api?.albumSongEntries || !api?.sameGeniusUrl)
      return {tracks, note:'Compared against the current page; a live album lookup was unavailable.'};
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 7000);
    try {
      const response = await fetch(`${location.origin}/api/albums/${albumId}`, {
        method:'GET', credentials:'same-origin', cache:'no-store',
        headers:{Accept:'application/json'}, signal:abort.signal
      });
      if (!response.ok) throw Error('Genius API unavailable');
      const data = await response.json();
      if (Number(data?.response?.album?.id) !== albumId) throw Error('Unexpected album');
      const entries = api.albumSongEntries(data);
      const byUrl = new Map(entries.filter(item => item.title).map(item => [item.key, item.title]));
      let updated = 0;
      const fresh = tracks.map(track => {
        const authoritativeTitle = byUrl.get(api.sameGeniusUrl(track.url));
        if (!authoritativeTitle) return track;
        updated++;
        const title = cleanMatchTitle(authoritativeTitle);
        if (!title || title.length > 220) return track;
        // Fresh server metadata supersedes a local confirmed-title overlay.
        confirmedTitles.delete(track.url);
        return {...track, title};
      });
      if (!updated) throw Error('No matching tracks in album API');
      return {tracks:fresh, note:updated < tracks.length
        ? `Refreshed ${updated} of ${tracks.length} titles from Genius; other tracks use the page.`
        : 'Refreshed titles from Genius without reloading the page.'};
    } catch {
      return {tracks, note:'Compared against the current page; live Genius refresh was unavailable.'};
    } finally {clearTimeout(timer);}
  }

  async function compareReference(panel, {skipNetwork=false} = {}) {
    const output = panel.querySelector('.gt-compare-status');
    const button = panel.querySelector('.gt-compare');
    if (button.disabled && !skipNetwork) return;
    const token = panel._gtCompareRun = (panel._gtCompareRun || 0) + 1;
    const albumPath = location.pathname;
    output.replaceChildren();
    panel._gtFixData = null;
    const reference = parseReference(panel.querySelector('.gt-textarea').value);
    const source = panel.dataset.referenceSource || '';
    const wasCompared = panel.dataset.gtCompared === 'true';
    let tracks = readRows().tracks;
    if (!tracks.length) {
      addLine(output, 'No Genius tracklist detected. Scroll to the tracklist and retry.', 'gt-warning');
      return;
    }
    if (!reference.length) {
      addLine(output, 'Add a reference tracklist or select a MusicBrainz release.', 'gt-warning');
      panel.querySelector('.gt-textarea').focus();
      return;
    }
    if (reference.length > 500 || tracks.length > 500) {
      addLine(output, 'Tracklist exceeds the 500-track comparison limit.', 'gt-warning');
      return;
    }
    let refreshNote = '';
    if (wasCompared && !skipNetwork) {
      button.disabled = true;
      button.textContent = 'Refreshing…';
      try {
        const fresh = await freshAlbumTitles(tracks);
        if (!panel.isConnected || location.pathname !== albumPath || token !== panel._gtCompareRun) return;
        tracks = fresh.tracks;
        refreshNote = fresh.note;
      } finally {
        button.disabled = false;
        button.textContent = 'Refresh comparison';
      }
    }
    if (!panel.isConnected || location.pathname !== albumPath || token !== panel._gtCompareRun) return;
    panel.dataset.gtCompared = 'true';
    button.textContent = 'Refresh comparison';
    const rows = alignComparisonRows(tracks, reference);
    const result = summarizeRows(rows);
    const stats = document.createElement('div');
    stats.className = 'gt-stats';
    const values = [
      [result.matched, 'Matched', 'gt-stat-ok'],
      [result.different, 'Title differences', result.different?'gt-stat-alert':''],
      ...(result.geniusOnly ? [[result.geniusOnly, 'Genius-only', 'gt-stat-neutral']] : []),
      ...(result.referenceOnly ? [[result.referenceOnly, 'Reference-only', 'gt-stat-alert']] : []),
      ...(result.reordered ? [[result.reordered, 'Out of order', 'gt-stat-alert']] : [])
    ];
    for (const [value, label, cls] of values) {
      const stat = document.createElement('div');
      stat.className = 'gt-stat ' + cls;
      const number = document.createElement('strong');
      number.textContent = String(value);
      const caption = document.createElement('span');
      caption.textContent = label;
      stat.append(number, caption);
      stats.appendChild(stat);
    }
    output.appendChild(stats);
    addLine(output, `Compared ${reference.length} reference track${reference.length===1?'':'s'} with ${tracks.length} Genius tracks.`, 'gt-note');
    if (!result.different && !result.referenceOnly && !result.geniusOnly && !result.reordered)
      addLine(output, 'All track titles and their order match.', 'gt-check');
    else if (!result.different && !result.referenceOnly && !result.reordered)
      addLine(output, `All ${result.matched} reference titles match. ${result.geniusOnly} additional Genius track${result.geniusOnly===1?' is':'s are'} not covered by this reference.`, 'gt-check');
    if (result.geniusOnly && reference.length < tracks.length)
      addLine(output, 'The reference is shorter than Genius’s tracklist. These extra tracks may belong to a different edition or an incomplete reference; they are not automatically errors.', 'gt-note');
    if (result.reordered) addLine(output, `${result.reordered} matching title${result.reordered===1?' appears':'s appear'} in a different position.`, 'gt-note');
    if (refreshNote) addLine(output, refreshNote, 'gt-note');
    renderComparisonColumns(output, rows);
    renderTrackFixes(panel, output, rows, tracks, reference);
    if (source) {
      try {
        const url = new URL(source);
        if (!['https:', 'http:'].includes(url.protocol)) throw Error('invalid url');
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View reference source';
        link.className = 'gt-source-link';
        output.appendChild(link);
      } catch { addLine(output, 'Reference URL is invalid.', 'gt-note'); }
    }
    addLine(output, 'Title-only comparison. Verify that both lists refer to the same release edition before applying any corrections.', 'gt-disclaimer');
  }

  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mountPanelInSidebar();
    });
  }

  refresh();
  // Internal dropdown/chip redraws should not trigger full-page sidebar scans.
  new MutationObserver(records => {
    if (records.some(record => !record.target?.closest?.('#gt-toolkit'))) refresh();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener('popstate', refresh);
  window.addEventListener('resize', refresh, { passive: true });
})();
