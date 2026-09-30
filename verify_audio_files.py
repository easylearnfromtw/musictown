#!/usr/bin/env python3
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parent
m=json.loads((ROOT/"verified_audio_manifest.json").read_text(encoding="utf-8"))
missing=[]
for x in m["slotsDetail"]:
    p=ROOT/x["target"]
    if not p.exists() or p.stat().st_size<20000:missing.append(x["target"])
print(f"Audio ready: {len(m['slotsDetail'])-len(missing)}/{len(m['slotsDetail'])}")
if missing:
    print("First missing files:")
    for p in missing[:40]:print(" -",p)
sys.exit(1 if missing else 0)
