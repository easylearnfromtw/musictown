#!/usr/bin/env python3
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parent
m=json.loads((ROOT/"music_manifest.json").read_text(encoding="utf-8"))
missing=[]; total=0; present=0
for g in m.get("genres",[]):
    for t in g.get("tracks",[]):
        total+=1
        p=ROOT/t.get("audioSrc",t.get("mp3Path",""))
        if p.exists() and p.stat().st_size>20000: present+=1
        else: missing.append(str(p.relative_to(ROOT)))
print(f"MP3 present: {present}/{total}")
if missing:
    print("Missing:")
    for x in missing[:100]: print(" -",x)
    if len(missing)>100: print(f" ... and {len(missing)-100} more")
sys.exit(1 if missing else 0)
