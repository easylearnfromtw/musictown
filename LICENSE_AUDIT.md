# musicetown R8.1 — License audit

Audit date: 2026-10-01

## Production rule

R8.1 removes all synthetic/search-placeholder tracks and all tracks whose current
source page was not sufficiently verified for this build.

Every production catalog entry is labelled **CC0 1.0 Universal** and references
one of the verified source pages in `verified_audio_manifest.json`.

The website still displays artist/source information even though CC0 does not
require attribution.

## Important legal nuance

This audit verifies the **recording licence as represented by the source catalog**.
It is not a legal opinion. A source can be wrong, a later takedown can occur, and
an underlying composition can have separate rights. For that reason this build
also excludes obvious re-work / cover-risk titles used in older drafts.

## Verified source families used

- Free Music Archive: HoliznaCC0 — Music From The Vault
- Free Music Archive: HoliznaCC0 — All The Years I've Haunted (Part 1)
- Free Music Archive: HoliznaCC0 — Orphaned Media
- Free Music Archive: HoliznaCC0 — BASSIC
- Free Music Archive: HoliznaCC0 — Mouth Music
- Free Music Archive: HoliznaCC0 — Makeshift Salvation
- Free Music Archive: HoliznaCC0 — Shooting Ghost - Dirty Driving Death Part 2
- Free Music Archive: SUPERARE — II / III / IV / IX / XII / Pop Sensation / Fatal
- Free Music Archive: oji — outlet. / quiet music. / non edible sounds.
- Free Music Archive: Tadz — The Motherland
- Nullrights direct CC0 track pages included in the manifest.

## Removed from older drafts

- Nullrights search-result placeholder URLs with invented labels
- Sources not re-verified for this release
- Obvious re-work / cover-risk titles
