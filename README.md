# toolkit toolkit v0.10.16 — inline artwork apply

this version builds on v0.10.15, retaining the shared album/single artwork engine and opencode's reviewed fixes.

## inline album artwork apply (v0.10.16)

- **find artwork** displays cover choices without copying or changing Genius. Selecting a result previews it in the current album modal and fills the inline cover URL field.
- **apply artwork** validates 1000 × 1000 dimensions and calls Genius's existing `cover-art-form` controller (`$ctrl.update(cover_art, url)`) for its **empty** cover tile; it never silently edits an existing cover or submits during search.
- Genius's native cover section appears alongside the panel, in the **same** album editor. No Filestack Choose File popup is opened by the normal Apply path. Genius may persist the cover immediately; check the native cover thumbnail/status.
- Firefox uses `wrappedJSObject` to access Genius's Angular controller if it is exposed. This is **not guaranteed** on every deployment. If the controller is inaccessible or the native update rejects the URL, the extension copies the link and displays the original camera tile → Link (URL) fallback instructions.
- **copy link** remains optional. The URL field and result preview remain usable without depending on native integration.
- Unsaved album info changes must be saved first. Stale search/selection results are not applied.
- No Genius API credentials, new extension permissions, direct API write endpoints, or extra third-party upload services are introduced.

## album artwork toolbar (v0.10.15)

- **find artwork** and **back to album info** share equal width when both are visible, with the same gap and height.
- when **back to album info** is hidden, **find artwork** expands to the full toolbar width.
- no changes to artwork lookup, copying, validation, or selection behavior.
- fixes the displayed extension version to match the manifest.

## album artwork copy feedback (v0.10.14)

- after a successful artwork-link copy, the instruction appears immediately: “Link copied. Paste it into Genius’s cover URL field (Ctrl+V), then save.”
- clipboard errors show an accurate fallback message.

## song artwork autofill (v0.10.13)

- **autofill always searches**, even if Genius already has an artwork URL in the Song Art field. The existing URL remains unchanged while searching and showing results.
- clicking a candidate **explicitly replaces** the current Song Art URL only after verifying that the image is exactly 1000 × 1000. Searching, viewing results, or clicking an invalid image never changes the field.
- results remain visible after a selection, so a different option can be chosen without searching again. The selected option is highlighted.
- when Genius song art is independently verified, it appears as an additional option alongside Apple Music candidates rather than only when Apple Music finds nothing.
- if the user manually changes the native URL while an image is being verified, the pending selection is discarded rather than overwriting their newer edit.
- the extension updates the Genius form, but **does not save the artwork to Genius automatically**. Use Genius's native Save button.
- album artwork search remains click-to-select and never replaces an existing cover merely by running a lookup.

## artwork lookup

- **one shared apple music engine** for both album and song artwork (background/apple-art.js), with an explicit `kind: 'album' | 'single'` policy. common title/artist matching, apple itunes store searches, artist catalog lookup, official apple music page discovery, cdn url conversion, and source verification are reused instead of reimplemented.
- **album mode:** searches official album releases on itunes, then official apple music release pages when the store index fails. the existing genius album metadata and verified album-linked song fallback remains intact.
- **single mode:** searches by song title + primary artist and accepts only a matching *standalone single* (or verified one-track release) rather than a parent album containing the song. official artist / song / release pages are available when itunes search omits the single. the genius song art fallback only accepts an image distinguishable from the parent album cover.
- **shared content utilities** in content/artwork-utils.js: artwork lookup messaging, duplicate removal, trustworthy genius image variants, and a single 1000 × 1000 image-dimension verifier. both album-modal.js and song-media.js use them.
- **safety unchanged:** selecting an image is necessary, 1000 × 1000 dimensions must verify, existing song artwork isn't overwritten, and genius's own Save action remains necessary.
- artist identifiers are reused within a lookup to avoid repeated itunes artist searches. no artist, song, or album IDs are hardcoded into production code.

## merged opencode fixes

- discogs metadata can be an array or a single value.
- `Producer` and `Writer` credit roles are normalized case-insensitively.
- the tag-sheet parser handles completely empty sheets.
- when adding tags, a post-save read verifies that both the new tags **and all prior tags** still exist.
- compare tracklists re-enables its action button if the track-fixes module is unavailable.
- shared `GeniusToolkitApiErrors.hasErrors` accepts an empty `errors: []` as success but correctly flags nonempty arrays, objects, strings, and failing API statuses. used by tags, credits, dates, and track fixes.

## install (firefox)

1. unzip the archive to its own folder.
2. in `about:debugging` → **this firefox**, remove any previous temporary toolkit toolkit add-on.
3. choose **load temporary add-on**, and select this folder's `manifest.json`.
4. verify the installed version reads **0.10.16** and reload the genius page.
5. album editor → **find artwork**; native song art editor → **autofill**.

## verification

run from the extracted folder:

```bash
node tests/inline-album-apply.cjs
node tests/album-copy.cjs
node tests/artwork.cjs
node tests/single-art.cjs
node tests/song-info.cjs
node tests/song-autofill.cjs
node tests/integration.cjs
```

all tests are local simulations: they exercise multi-album searches, the apple music fallback, standalone-single matching, album-art rejection for singles, genius album and song metadata, the shared messaging path, api error formats, and click-only song art replacement with an existing URL.

**limitations:** these tests cannot prove live firefox behavior, the current apple music/genius html or API responses, or that Genius will accept an external Apple Music image URL in its native cover updater. official release pages can change and not all albums/singles are available from every provider. no authenticated genius writes were made during testing.
