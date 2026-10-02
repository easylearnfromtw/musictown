#!/usr/bin/env python3
from __future__ import annotations
import json,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CORE_PROFILE_COUNT=9;CITY_PROFILE_COUNT=22;LIMITED_COUNT=70
LIMITED_KIND_COUNTS={"city":3,"university":26,"landmark":41}
STANDARD_TRACKS=50;LIMITED_TRACKS=25;POOL_MULTIPLIER=3;TOTAL_THEMES=101
VISIBLE_PLACEMENTS=3300;SEARCHABLE_PLACEMENTS=9900
MASTER_DRAWERS={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
def load_json(n):return json.loads((ROOT/n).read_text(encoding="utf-8"))
def load_catalog():
    s=(ROOT/"index.html").read_text(encoding="utf-8");m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',s,re.S)
    if not m:raise SystemExit("MUSIC_DATA missing")
    return json.loads(m.group(1))
def fail(x):raise SystemExit("CITYMUSIC THEME FORMAT CONTRACT: "+x)
core=load_json("theme_profiles.json");cities=load_json("fresh_city_profiles.json");limited=load_json("limited_theme_profiles.json");catalog=load_catalog()
if len(core)!=9 or len(cities)!=22 or len(limited)!=70:fail("profile counts changed")
names=list(core)+list(cities)+list(limited)
if len(set(names))!=101 or any(x!=x.upper() for x in names):fail("theme names/IDs changed")
kc=Counter(str(p.get("kind","")).strip() for p in limited.values())
if dict(kc)!=LIMITED_KIND_COUNTS:fail(f"limited kind counts changed: {dict(kc)}")
for name,p in limited.items():
    if int(p.get("track_count",0))!=25:fail(f"{name}: visible limited count changed")
    kind=p.get("kind");cfg=p.get("cityPass") or {}
    if cfg.get("kind")!=kind:fail(f"{name}: pass kind mismatch")
    if kind=="university" and not (cfg.get("geofences") or []):fail(f"{name}: missing campus geofence")
    if kind=="city" and not cfg.get("aliases"):fail(f"{name}: missing city aliases")
    if kind=="landmark" and not p.get("label"):fail(f"{name}: missing landmark label")
by={d.get("t"):d for d in catalog}
if len(catalog)!=101 or set(by)!=set(names):fail("catalog theme set differs")
vis=0;pool=0;ids=set()
for name in names:
    d=by[name];visible=25 if name in limited else 50;need=visible*3;tracks=d.get("tracks") or [];refs=d.get("poolRefs") or []
    if len(tracks)!=visible:fail(f"{name}: visible must stay {visible}, got {len(tracks)}")
    if int(d.get("targetTracks",0))!=visible:fail(f"{name}: targetTracks changed")
    if len(refs)!=need or int(d.get("poolSize",0))!=need:fail(f"{name}: 3x pool must be {need}")
    sr=set()
    for e in refs:
        ref=str(e.get("r",""));sid=str(e.get("id",""))
        if ref in sr:fail(f"{name}: duplicate master ref {ref}")
        sr.add(ref)
        if sid in ids:fail(f"global duplicate pool id {sid}")
        ids.add(sid)
        if ":" not in ref:fail(f"{name}: invalid ref {ref}")
        src,idx=ref.rsplit(":",1)
        if src not in MASTER_DRAWERS:fail(f"{name}: invalid master drawer {src}")
        try:i=int(idx)
        except:fail(f"{name}: invalid master index")
        if not 0<=i<50:fail(f"{name}: master index out of range")
    vis+=len(tracks);pool+=len(refs)
if vis!=3300 or pool!=9900:fail(f"expected 3300 visible / 9900 searchable, found {vis}/{pool}")
print(f"CITYMUSIC theme format OK · 101 themes · {vis} visible / {pool} searchable")
