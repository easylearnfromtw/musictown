# musicetown R8.6

Changes:
1. Homepage 3D drawer opens on the first touch/pointer-up; no second tap required.
2. OPEN CTA is touch-stable and no longer shifts under the global press animation.
3. MY LIBRARY mobile rows use a two-line constrained text layout with no overflow.
4. Playback buttons use custom musicetown SVG icons (play/pause/previous/next).
5. Share controls use custom SVG icons; no Unicode/emoji-style share glyphs.
6. Realtime subtitle/music-sync UI and LRC/VTT sync controls are removed.
7. Vinyl palette adds translucent CHAMPAGNE PURPLE and OXBLOOD RED.
8. R8.5 site-cloud MP3 deployment architecture is preserved.

Playback remains:
GitHub Pages website MP3 → user → native HTML audio.


## R8.6.1
- softened the mobile/detail-page background
- removed the harsh split-looking panel wash
- added natural glass blur transitions for detail / drawer / archive panels


## R8.6.2 Scroll Restore
- Restores `.detail` to a fixed, independently scrollable viewport.
- Keeps the homepage body locked for WebGL without blocking the detail page.
- MY LIBRARY / Share / Player cards have native iOS momentum scrolling.
- WebGL drawer now distinguishes a short tap from a vertical swipe.
- Vertical swipes over the 3D drawer and vinyl scroll the page instead of triggering a track.


## R8.6.3 Mobile Overlay Hotfix
- OPEN button is hard-positioned inside the expanded card on iPhone.
- Mobile interactive card controls no longer depend on container-query units.
- The card's FLIP animation is cleaned up after finishing to avoid Safari transformed-containing-block glitches.
- The large visible safe-mode banner is removed.
- Nonfatal visual errors degrade silently and are logged only to the browser console.


## R8.6.5 One-Tap Play
- `openTrack()` no longer delays audio construction through requestAnimationFrame.
- On a real user tap/click, the same event stack calls native `<audio>.play()`.
- This is specifically required for iPhone Safari user-activation autoplay rules.
- Track/3D-card tap -> player opens -> site-cloud MP3 starts immediately.
- Auto Next still uses the existing non-user-gesture continuation logic.
- GitHub Cloud Audio deployment still fails verification if expected MP3 files are missing.


## R8.6.6 iOS Scroll Architecture
Previous builds kept the detail page as a fixed nested scroll viewport.
On iPhone Safari, fixed + WebGL + large backdrop-filter surfaces can still freeze touch scrolling.

R8.6.6 changes architecture:
- homepage: body remains locked for WebGL
- detail page: html/body become the native document scroller
- `.detail` becomes normal-flow content
- shared WebGL canvas stays mounted inside the detail drawer
- mobile blur load is reduced to avoid compositor jank
- returning home restores the locked WebGL viewport
