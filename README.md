# musicetown R8.1 — GitHub Pages / verified audio folders

## Changes
- MY LIBRARY stays open when you click/play inside it.
- Added playlist sharing (Web Share API + copy-link fallback).
- Rebuilt all 11×50 slots from a source-verified CC0 master pool.
- Removed synthetic/search-placeholder songs from production.
- Every drawer now has its own physical audio folder:
  `music/jazz/`, `music/london/`, `music/new-york/`, etc.
- `verified_audio_manifest.json` records every slot, source, licence evidence and target file.

## Audio folders
Each category expects:
`001.mp3` ... `050.mp3`

The HTML points directly to those category-specific files.

## Why MP3 binaries are not bundled here
The ChatGPT build container cannot fetch third-party audio binaries directly.
Run `fetch_verified_audio.py` on your Mac/PC. It re-checks source-page CC0 text,
downloads each unique master once, converts to MP3 with ffmpeg, then copies the
result into every required category folder.

This gives you the expanded physical-folder layout you requested without the
build pretending missing audio files already exist.

## GitHub size warning
11 × 50 full MP3 copies can make the repository very large. GitHub rejects
individual files over 100 MB and large repositories become slow. For a public
production deployment, consider putting `music/` on object storage/CDN while
keeping this GitHub Pages frontend unchanged.
