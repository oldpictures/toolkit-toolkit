/* Shared Genius album-title parsing. Pure functions; no network requests. */
(() => {
  'use strict';
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

  // Find the *outermost* final parentheses/brackets from the right.
  // Regexes like [^()]+ cannot handle (Ft. Strings (Rap)).
  function stripTrailingFeatureCredits(value) {
    let title = clean(value);
    // More than one credit group can be appended; cap work on hostile markup.
    for (let pass = 0; pass < 8; pass++) {
      const close = title.slice(-1);
      const open = close === ')' ? '(' : close === ']' ? '[' : null;
      if (!open) break;
      let depth = 0, start = -1;
      for (let i = title.length - 1; i >= 0; i--) {
        if (title[i] === close) depth++;
        else if (title[i] === open && --depth === 0) { start = i; break; }
      }
      if (start < 0) break; // Unbalanced markup: do not guess.
      const content = title.slice(start + 1, -1).trim();
      if (!/^(?:ft\.?|feat\.?|featuring)(?=\s|:|$)/i.test(content)) break;
      const remaining = title.slice(0, start).trimEnd();
      if (!remaining) break;
      title = remaining;
    }
    return title;
  }

  function stripLyricsLabel(value) {
    return clean(value).replace(/(?:\s+|\s*[·|–—-]\s*)lyrics\s*$/i, '').trim();
  }

  function cleanAlbumTrackTitle(value) {
    // Genius can append both a feature credit and a Lyrics label.
    return stripLyricsLabel(stripTrailingFeatureCredits(stripLyricsLabel(value)));
  }

  globalThis.GeniusToolkitTitles = Object.freeze({
    stripTrailingFeatureCredits,
    cleanAlbumTrackTitle
  });
})();
