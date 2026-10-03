#!/usr/bin/env python3
"""Build the GitHub Pages artifact (_site) for the GitHub Actions deploy.

R10: also ships the home-screen icons, manifest, favicon, iOS startup images
and remote-audio-map.js. (Before R10 these were left out of the Actions
artifact, so "Add to Home Screen" on iPhone had no icon.)
R11: also ships sw.js (offline app shell), literature-catalog.js and
literature-audio-map.js (the 文學 drawers live outside MUSIC_DATA).
"""
from pathlib import Path
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parent

# The curation steps above this job rewrite MUSIC_DATA in root/index.html.
# Rebuild the UI from design-src now, while build.py preserves that curated
# catalog. This keeps Pages, source modules, literature, and the SW version in sync.
subprocess.run([sys.executable, str(ROOT/"design-src"/"build.py"), str(ROOT)], check=True)
SITE=ROOT/"_site"
if SITE.exists():shutil.rmtree(SITE)
SITE.mkdir()

for name in [
    "index.html","404.html",".nojekyll","MUSIC_INSTALL_REPORT.json","theme_curation_manifest.json","city-pass-preview.html",
    "site.webmanifest","apple-touch-icon.png","icon-192.png","icon-512.png","icon-maskable-512.png",
    "favicon.svg","favicon-32.png","remote-audio-map.js",
    "sw.js","extra-city-catalog.js","literature-catalog.js","literature-audio-map.js","citymus-library.js","CITYMUS_LIBRARY_REPORT.json",
]:
    p=ROOT/name
    if p.exists():shutil.copy2(p,SITE/name)

cjk_report=ROOT/"data"/"cjk_open_music_report.json"
if cjk_report.exists():shutil.copy2(cjk_report,SITE/"cjk_open_music_report.json")

# icons, iOS startup images, social preview and City Pass QR artwork
assets=ROOT/"assets"
if assets.exists():
    shutil.copytree(assets,SITE/"assets")

folders=[
 "jazz","crooner","rock","sport","lo-fi",
 "taipei-style","old-tokyo","splendor-shanghai","vancouver","london","new-york",
 "emo","running","poem","traditional-beijing",
 "tropical-hawaii","bustling-hong-kong","slightly-tipsy-rome","psychedelic-la",
 "solemn-kyoto","miraculous-luoyang","champs-elysees","menacing-dubai",
 "rouge-tibet","fantasy-tainan","maldives-paradise"
]
local_fast_paths=0
for folder in folders:
    src=ROOT/folder
    if not src.exists():
        continue
    shutil.copytree(src,SITE/folder)
    local_fast_paths+=1

size=sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
print(f"Prepared CITYMUS 2500-track production site: {size/1024/1024:.1f} MB · optional local fast-path folders {local_fast_paths}/{len(folders)}")
