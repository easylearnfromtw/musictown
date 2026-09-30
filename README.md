# musicetown R8.4

## Share Atelier
- Share button opens a branded preview instead of immediately throwing a system share sheet.
- Theme-colored glass playlist cover.
- Transparent vinyl + circular type + musicetown globe mark.
- Native share / Copy Link / Copy Tracklist / Preview recipient page.
- Received playlists have a matching designed player/library surface.
- Mobile uses a bottom-sheet treatment.

## Vinyl
- Vinyl colors are substantially more translucent.
- Center label uses circular typography.
- Existing musicetown globe mark is integrated into the record label.
- Rotation now happens on a dedicated `.vinyl-rotor`, so button press/hover transforms cannot override record rotation.
- Local audio rotation follows `audio.currentTime`.
- Online fallback mode gets a slow visual rotation because cross-origin iframe playback time is inaccessible.
- Scratch/seek still changes real local audio currentTime.

All R8.3 fixes remain:
- shared WebGL drawer on the second page
- thick-border playing state
- locked MY LIBRARY modal
- hybrid playback fallback
