#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse
import shutil,json,re

ROOT=Path(__file__).resolve().parent
SITE=ROOT/"_site"
if SITE.exists():shutil.rmtree(SITE)
SITE.mkdir()

for name in [
  "index.html","404.html",".nojekyll","MUSIC_INSTALL_REPORT.json",
  "fresh_city_manifest.json","theme_curation_manifest.json","limited_theme_manifest.json"
]:
    p=ROOT/name
    if p.exists():shutil.copy2(p,SITE/name)

text=(ROOT/"index.html").read_text(encoding="utf-8")
m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
if not m:raise SystemExit("MUSIC_DATA not found")
data=json.loads(m.group(1))

# Copy only same-repository audio folders. HTTPS streams remain remote and
# therefore do not count toward the GitHub Pages 1 GB published-site limit.
folders=set()
for drawer in data:
    for track in drawer.get("tracks",[]):
        src=str(track.get("audioSrc","") or "").strip()
        if not src:continue
        if urlparse(src).scheme in {"http","https"}:continue
        parts=Path(src).parts
        if parts:folders.add(parts[0])

for folder in sorted(folders):
    src=ROOT/folder
    if not src.exists():raise SystemExit(f"Missing local audio folder: {folder}")
    shutil.copytree(src,SITE/folder)

size=sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
print(f"Prepared hybrid Pages site: {size/1024/1024:.1f} MB")
print(f"Local audio folders: {', '.join(sorted(folders))}")
if size>1024*1024*1024:
    raise SystemExit("Pages artifact exceeds GitHub Pages 1 GB published-site limit")
