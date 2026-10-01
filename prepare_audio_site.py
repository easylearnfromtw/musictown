#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parent
SITE=ROOT/"_site"
if SITE.exists():shutil.rmtree(SITE)
SITE.mkdir()

for name in ["index.html","404.html",".nojekyll","MUSIC_INSTALL_REPORT.json"]:
    p=ROOT/name
    if p.exists():shutil.copy2(p,SITE/name)

folders=[
 "jazz","crooner","rock","sport","lo-fi",
 "taipei-style","old-tokyo","splendor-shanghai",
 "vancouver","london","new-york"
]
for folder in folders:
    src=ROOT/folder
    if not src.exists():raise SystemExit(f"Missing folder: {folder}")
    shutil.copytree(src,SITE/folder)

size=sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
print(f"Prepared website with audio: {size/1024/1024:.1f} MB")
