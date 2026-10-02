#!/usr/bin/env python3
"""CITYMUSIC user-defined theme format contract.

This validator intentionally treats the theme specification as product data,
not as something the recommendation layer may reinterpret.
"""
from __future__ import annotations
import json,re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent

CORE_PROFILE_COUNT=9
CITY_PROFILE_COUNT=22
LIMITED_COUNT=70
LIMITED_KIND_COUNTS={"city":3,"university":26,"landmark":41}
STANDARD_TRACKS=50
LIMITED_TRACKS=25
TOTAL_THEMES=101
TOTAL_PLACEMENTS=3300

def load_json(name):
    return json.loads((ROOT/name).read_text(encoding="utf-8"))

def load_catalog():
    # The production builders materialize the authoritative 101-theme catalog
    # into index.html. catalog.js is only a small legacy/base seed.
    text=(ROOT/"index.html").read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:
        raise SystemExit("index.html: generated MUSIC_DATA not found")
    return json.loads(m.group(1))

def fail(msg):
    raise SystemExit("CITYMUSIC THEME FORMAT CONTRACT: "+msg)

core=load_json("theme_profiles.json")
cities=load_json("fresh_city_profiles.json")
limited=load_json("limited_theme_profiles.json")
catalog=load_catalog()

if len(core)!=CORE_PROFILE_COUNT:
    fail(f"expected {CORE_PROFILE_COUNT} original music themes, found {len(core)}")
if len(cities)!=CITY_PROFILE_COUNT:
    fail(f"expected {CITY_PROFILE_COUNT} city music themes, found {len(cities)}")
if len(limited)!=LIMITED_COUNT:
    fail(f"expected {LIMITED_COUNT} limited themes, found {len(limited)}")

all_profile_names=list(core)+list(cities)+list(limited)
if len(set(all_profile_names))!=TOTAL_THEMES:
    fail("theme names must be unique across original/city/limited profiles")
if any(name != name.upper() for name in all_profile_names):
    bad=[name for name in all_profile_names if name != name.upper()]
    fail("theme IDs/names must stay uppercase: "+", ".join(bad[:8]))

kind_counts=Counter(str(p.get("kind","")).strip() for p in limited.values())
if dict(kind_counts)!=LIMITED_KIND_COUNTS:
    fail(f"limited kind counts must be {LIMITED_KIND_COUNTS}, found {dict(kind_counts)}")

for name,p in limited.items():
    if int(p.get("track_count",0))!=LIMITED_TRACKS:
        fail(f"{name}: limited theme must have track_count={LIMITED_TRACKS}")
    kind=p.get("kind")
    pass_data=p.get("cityPass") or {}
    if pass_data.get("kind")!=kind:
        fail(f"{name}: pass kind must match limited kind {kind!r}")
    if kind=="university":
        fences=pass_data.get("geofences") or []
        if not fences:
            fail(f"{name}: university theme requires at least one campus geofence")
        for fence in fences:
            if not all(k in fence for k in ("lat","lon","radius")):
                fail(f"{name}: each university geofence needs lat/lon/radius")
    if kind=="city":
        if not pass_data.get("aliases"):
            fail(f"{name}: city-limited theme requires city aliases for location matching")
    if kind=="landmark":
        if not p.get("label"):
            fail(f"{name}: landmark theme requires its specified display label")

by_name={d.get("t"):d for d in catalog}
if len(catalog)!=TOTAL_THEMES:
    fail(f"catalog must contain exactly {TOTAL_THEMES} themes, found {len(catalog)}")
if set(by_name)!=set(all_profile_names):
    missing=sorted(set(all_profile_names)-set(by_name))
    extra=sorted(set(by_name)-set(all_profile_names))
    fail(f"catalog/profile names differ; missing={missing[:5]} extra={extra[:5]}")

placements=0
for name in list(core)+list(cities):
    n=len(by_name[name].get("tracks") or [])
    if n!=STANDARD_TRACKS:
        fail(f"{name}: standard/city theme must contain exactly {STANDARD_TRACKS} tracks, found {n}")
    placements+=n

for name in limited:
    n=len(by_name[name].get("tracks") or [])
    if n!=LIMITED_TRACKS:
        fail(f"{name}: limited theme must contain exactly {LIMITED_TRACKS} tracks, found {n}")
    placements+=n

if placements!=TOTAL_PLACEMENTS:
    fail(f"expected {TOTAL_PLACEMENTS} total placements, found {placements}")

print(
    "CITYMUSIC theme format contract OK · "
    f"{len(core)} original × {STANDARD_TRACKS} · "
    f"{len(cities)} city × {STANDARD_TRACKS} · "
    f"{kind_counts['city']} city limited + {kind_counts['university']} university + "
    f"{kind_counts['landmark']} landmark × {LIMITED_TRACKS} · "
    f"{TOTAL_THEMES} themes / {placements} placements"
)
