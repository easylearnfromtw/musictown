#!/usr/bin/env python3
from pathlib import Path
import json,re,sys,hashlib

ROOT=Path(__file__).resolve().parent
INDEX=ROOT/"index.html"
text=INDEX.read_text(encoding="utf-8")
m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
if not m:
    print("ERROR: MUSIC_DATA not found")
    sys.exit(2)

data=json.loads(m.group(1))
missing=[]
bad=[]
rows=[]

for drawer in data:
    for t in drawer.get("tracks",[]):
        rel=t.get("audioSrc","")
        p=ROOT/rel
        if not rel:
            missing.append(f"{drawer['t']} :: {t.get('title')} :: no audioSrc")
            continue
        if not p.exists():
            missing.append(rel)
            continue
        size=p.stat().st_size
        if size<20000:
            bad.append(f"{rel} ({size} bytes)")
            continue
        rows.append({
            "drawer":drawer["t"],
            "title":t.get("title",""),
            "artist":t.get("artist",""),
            "path":rel,
            "bytes":size,
            "sha256":hashlib.sha256(p.read_bytes()).hexdigest()
        })

report={
    "drawers":len(data),
    "expected_tracks":sum(len(d.get("tracks",[])) for d in data),
    "ready_tracks":len(rows),
    "missing":missing,
    "bad":bad,
    "files":rows
}
(ROOT/"cloud_audio_runtime_manifest.json").write_text(
    json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
)

print(f"Cloud audio ready: {len(rows)}/{report['expected_tracks']}")
if missing:
    print("Missing:")
    for x in missing[:80]: print(" -",x)
if bad:
    print("Invalid/small files:")
    for x in bad[:80]: print(" -",x)

sys.exit(1 if missing or bad else 0)
