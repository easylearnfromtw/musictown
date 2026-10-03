# musicetown · Edit Guide (R11.1 "Literature + Performance")

Current build: `R11.1 · 2026-10-03 · Performance`

`index.html` is now **generated**. Edit the sources in `design-src/src/`, then rebuild:

```bash
python3 design-src/build.py .        # from the repo root
```

The build keeps the `window.MUSIC_DATA` catalog already inside `index.html`
(so a UI rebuild never throws away what the CI installed), writes
`index.html`, `claude-interface.html` (same file, for review), the
`404.html` redirect stub, `literature-catalog.js`, `sw.js`, and — only if it
does not exist yet — an empty `literature-audio-map.js`.

## 文學 (literature) drawers — R11

Ten works × 25 tracks = 250 distinct recordings, curated by
`design-src/tools/lit_build.py` → `design-src/src/literature.json` →
`literature-catalog.js` (`window.MUSICETOWN_LITERATURE`).

- They are deliberately **outside** `MUSIC_DATA`, so the CI's 23-theme /
  1150-track checks are unchanged. The app appends them at runtime.
- Every composer died ≥ 50 years ago (newest: Josef Suk, 1935) and every
  recording is Public Domain Mark / CC0 / CC BY / CC BY-SA (Internet Archive
  Musopen collections, Wikimedia Commons). Licence + source are on each track.
- To change a track: edit the `WORKS` list in `tools/lit_build.py`, run
  `python3 design-src/tools/lit_build.py` then `python3 design-src/build.py .`.
- `.github/workflows/bake-literature-audio.yml` (manual, monthly, or when it
  changes) checks all 250 streams and, if a file was renamed inside its own
  Internet Archive item, writes the new URL to `literature-audio-map.js`
  (`{shareId: url}`), which the player tries first. Report:
  `.github/reports/literature-audio-report.json`.

## Offline (Home Screen) — R11

- `sw.js` caches the app shell so the Home Screen app opens without a
  connection; audio never goes through the service worker.
- Songs saved with the download buttons are stored as blobs in IndexedDB
  (`musicetown-offline`) and played from `blob:` URLs; the 收藏 tab shows an
  已下載 list and storage use. `navigator.storage.persist()` is requested on
  the first download.

## Source layout

| File | What it owns |
|---|---|
| `src/head.html` / `src/body.html` | meta, iOS/PWA tags, icon + startup-image links, app shell |
| `src/styles.css` | the whole design system (`@layer reset, tokens, base, components, views, overlays, utilities`) |
| `src/js/00-core.js` | helpers, icons, haptics, toast, scroll lock |
| `src/js/10-catalog.js` | 23 destinations (IATA code, city, time zone, accent), groups, 16 landmarks, archive-edit fill for empty themes |
| `src/js/20-store.js` | settings, libraries, dislikes, listening stats, ticket wallet |
| `src/js/30-qr.js` | vector QR encoder (Library Pass, tickets) |
| `src/js/40-reco.js` | recommender: draw-five, radio, today's edit, smart shuffle, themes for now |
| `src/js/50-fx.js` | vintage eras (Web Audio), fade gain, record-scratch engine (needle friction + grab thump) |
| `src/js/52-artwork.js` | per-song cover art for Media Session / Dynamic Island, share cards, Taipei limited edition |
| `src/js/53-offline.js` | IndexedDB song storage, service-worker registration |
| `src/js/55-player.js` | playback engine, gapless auto-next, source fallback, 2 s fade-in / 3 s fade-out, Media Session, AirPlay |
| `src/js/60-drawer.js` | WebGL2 glass record box |
| `src/js/70-shell.js` | router (history API), top bar, tab bar, mini player, sheets, track rows |
| `src/js/72-views.js` | 探索 / 城市 / 搜尋 / 收藏 / theme pages |
| `src/js/74-player-ui.js` | detailed player, spinning vinyl (no tonearm), limited stage, vintage strip, song actions, queue |
| `src/js/76-passes.js` | geo, City / Spot tickets, Library Pass, song / mix share + received-share pages |
| `src/js/78-welcome.js` | welcome (skippable), bluetooth ritual |
| `src/js/90-boot.js` | start-up, preview URLs |

Icons, startup images and the social card are rendered by
`design-src/gen_assets.py <repo-root>` (Playwright + Chromium).

## Contracts the CI depends on — do not break

- The catalog line must stay exactly `window.MUSIC_DATA = <json>;` followed by a newline.
  `build_theme_packs.py`, `build_fresh_city_packs.py`, `verify_music_install.py`
  and `bake-remote-audio-map.yml` find it with
  `window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n`. `build.py` asserts this on every build.
- `404.html` must keep a `window.MUSIC_DATA = [];` line (the curation scripts rewrite it).
- `remote-audio-map.js`, `literature-catalog.js` and `literature-audio-map.js` are loaded before the app script.
- The order of `LIB_REF_THEMES` in `76-passes.js` is part of the Library Pass (L2) link format — only append.
- Audio elements: `#nativeAudioPlayer` (direct) and `#mtFxAudioPlayer` (vintage / Web Audio).
- Native shell bridge: window event `musicetown:bluetooth-audio`,
  `webkit.messageHandlers.musicetownReady`.
- Preview URLs: `?previewCityPass=<slug>`, `?previewLibraryPass=1`, `?previewAudioLink=1`, `?limited=taipei` (Taipei limited stage anywhere), `?nosw` (skip the service worker).
- Deep links: `?theme=<slug>` (used by the City Pass QR codes), `?tab=cities|search|library`,
  `#mix=…`, `#t=<shareId>` (one song), `#library=L2.…`.
- localStorage keys from R8.x are kept, so favourites and libraries carry over:
  `musicetownFavoritesV1`, `musicetownLibrariesV2`, `musicetownActiveLibraryV2`,
  `musicetownDislikesV1`, `musicetownVintageLevelV1`. New keys use `musicetown.*.v10`.
- `prepare_audio_site.py` copies the manifest, icons, favicon, `assets/`
  (including `assets/limited/`), `remote-audio-map.js`, `sw.js`,
  `literature-catalog.js` and `literature-audio-map.js` into `_site`.

## Behaviour that must survive a redesign

1. A finished track starts the next one inside the same `ended` event (iOS keeps the audio session alive). A watchdog covers stalled streams.
2. Vintage mode never touches `playbackRate`; wow/flutter is a modulated delay, the noise floor is steady, clicks are sparse.
3. The page itself never moves sideways on phones (`overflow-x: hidden` on the root, tickets and sheets sized to the viewport). The only sideways lists are short rails that hand vertical swipes back to the page (`touch-action: pan-x pan-y`).
4. Buttons live in fixed slots (theme action bar, transport, tab bar) so they never move under the thumb.
5. The vinyl spins on the compositor (Web Animations), so it stays smooth at 120 Hz.
6. Fades are music-only: through Web Audio when the source allows CORS (always on iOS when possible, since iOS ignores `audio.volume`), otherwise via `volume` on desktop. Turn off in 收藏 → 設定 → 淡入淡出.
7. The vintage era chosen in the player stays on for the following songs.
