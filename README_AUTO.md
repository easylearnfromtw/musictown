# musicetown AUTO v1

GitHub-native deployment for musicetown (UI: R11.1 "Literature + Performance").

## What is automatic
- The website source lives directly in this repository.
- A push to `main` automatically starts `.github/workflows/musicetown-auto.yml`.
- The workflow installs/verifies the 23 × 50 = 1150-track catalog.
- City Pass QR PNGs are generated during the workflow; no manual PNG upload is required.
- The workflow builds `_site` and deploys GitHub Pages.
- Future website updates can be committed directly through the connected GitHub account; browser drag-and-drop upload is not required.

## Current web architecture
- 23 themes
- VAPOR LONDON
- Theme Classification
- centered musicetown logo + right-side search
- Multi Library + Library Pass
- City Pass
- Bluetooth Connection Ritual / iOS bridge-compatible web events
- Media Session

## R10 UI
- `index.html` is generated from `design-src/` — see `CLAUDE_EDIT_GUIDE.md`.
- Rebuild the UI with `python3 design-src/build.py .` (keeps the installed catalog).
- Home-screen icons, manifest, iOS startup images and the social card ship with the Pages artifact.

## R11
- 文學 category: 10 works × 25 public-domain / CC recordings in `literature-catalog.js` (outside `MUSIC_DATA`, so the 23-theme checks are unchanged).
- `bake-literature-audio.yml` checks those streams monthly and repairs renamed files; it never edits `index.html`.
- Offline Home Screen app: `sw.js` app shell + songs saved to IndexedDB.
- Taipei limited edition artwork in `assets/limited/`.
