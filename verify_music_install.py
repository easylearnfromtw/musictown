#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse
import json,re,subprocess,shutil,sys

ROOT=Path(__file__).resolve().parent
text=(ROOT/"index.html").read_text(encoding="utf-8")
m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
if not m:
    raise SystemExit("MUSIC_DATA not found")
data=json.loads(m.group(1))

LIMITED=json.loads((ROOT/"limited_theme_profiles.json").read_text(encoding="utf-8")) if (ROOT/"limited_theme_profiles.json").exists() else {}
FRESH=json.loads((ROOT/"fresh_city_profiles.json").read_text(encoding="utf-8")) if (ROOT/"fresh_city_profiles.json").exists() else {}
THEMES=json.loads((ROOT/"theme_profiles.json").read_text(encoding="utf-8")) if (ROOT/"theme_profiles.json").exists() else {}
EXPECTED_BASE_DRAWERS=5+len(FRESH)+len(THEMES)
EXPECTED_LIMITED_DRAWERS=len(LIMITED)
EXPECTED_DRAWERS=EXPECTED_BASE_DRAWERS+EXPECTED_LIMITED_DRAWERS
EXPECTED_TOTAL=EXPECTED_BASE_DRAWERS*50+sum(int(v.get("track_count",25)) for v in LIMITED.values())

missing=[]
bad=[]
remote=[]
local=[]
counts={}
seen_share_ids=set()
ffprobe=shutil.which("ffprobe")

for d in data:
    name=d.get("t","UNKNOWN")
    tracks=d.get("tracks",[])
    target=int(d.get("targetTracks",25 if d.get("limitedTheme") else 50))
    counts[name]=len(tracks)

    if len(tracks)!=target:
        bad.append(f"{name}: expected {target} tracks, got {len(tracks)}")
    if d.get("installPending"):
        bad.append(f"{name}: installPending still true")

    if d.get("limitedTheme"):
        p=LIMITED.get(name)
        if not p:
            bad.append(f"{name}: limited drawer missing profile")
        elif int(p.get("track_count",25))!=target:
            bad.append(f"{name}: targetTracks does not match limited profile")
        if d.get("limitedKind") in {"university","landmark"}:
            cfg=d.get("cityPass") or {}
            fences=cfg.get("geofences") or []
            expected_kind=d.get("limitedKind")
            if cfg.get("kind")!=expected_kind:
                bad.append(f"{name}: {expected_kind} drawer has wrong cityPass kind")
            if not fences:
                bad.append(f"{name}: {expected_kind} drawer has no GPS geofence")
            max_radius=5000 if expected_kind=="university" else 600000
            for i,fence in enumerate(fences,1):
                try:
                    lat=float(fence["lat"]);lon=float(fence["lon"]);radius=float(fence["radius"])
                    if not (-90<=lat<=90 and -180<=lon<=180 and 250<=radius<=max_radius):
                        bad.append(f"{name}: invalid geofence #{i}")
                except Exception:
                    bad.append(f"{name}: malformed geofence #{i}")

    drawer_seen=set()
    for t in tracks:
        title=t.get("title","")
        rel=str(t.get("audioSrc","") or "").strip()
        sid=str(t.get("shareId","") or "").strip()
        if sid:
            if sid in drawer_seen:
                bad.append(f"{name}: duplicate shareId {sid}")
            drawer_seen.add(sid)
            if sid in seen_share_ids:
                bad.append(f"global duplicate shareId {sid}")
            seen_share_ids.add(sid)

        if not rel:
            missing.append(f"{name} :: {title} :: empty audioSrc")
            continue

        parsed=urlparse(rel)
        if parsed.scheme in {"http","https"}:
            if parsed.scheme!="https":
                bad.append(f"{name} :: {title} :: remote audio must use HTTPS")
            if not t.get("licenseVerified"):
                bad.append(f"{name} :: {title} :: remote stream is not licenseVerified")
            if not t.get("source"):
                bad.append(f"{name} :: {title} :: remote stream missing source page")
            remote.append(rel)
            continue

        p=ROOT/rel
        if not p.exists():
            missing.append(f"{name} :: {title} :: {rel}")
            continue
        if p.stat().st_size<20000:
            bad.append(f"{rel}: too small ({p.stat().st_size} bytes)")
            continue
        if ffprobe:
            r=subprocess.run(
              [ffprobe,"-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(p)],
              capture_output=True,text=True
            )
            if r.returncode!=0:
                bad.append(f"{rel}: ffprobe failed")
                continue
        local.append(rel)

if len(data)!=EXPECTED_DRAWERS:
    bad.append(f"catalog: expected {EXPECTED_DRAWERS} drawers, got {len(data)}")

base_count=sum(1 for d in data if not d.get("limitedTheme"))
limited_count=sum(1 for d in data if d.get("limitedTheme"))
if base_count!=EXPECTED_BASE_DRAWERS:
    bad.append(f"catalog: expected {EXPECTED_BASE_DRAWERS} base drawers, got {base_count}")
if limited_count!=EXPECTED_LIMITED_DRAWERS:
    bad.append(f"catalog: expected {EXPECTED_LIMITED_DRAWERS} limited drawers, got {limited_count}")

total=sum(counts.values())
ready=total-len(missing)-len([x for x in bad if "::" in x or ": too small" in x or ": ffprobe failed" in x])

report={
  "expected":EXPECTED_TOTAL,
  "drawers":len(data),
  "baseDrawers":base_count,
  "limitedDrawers":limited_count,
  "counts":counts,
  "total":total,
  "ready":ready,
  "localAudio":len(local),
  "remoteAudio":len(remote),
  "missing":missing,
  "bad":bad
}
(ROOT/"MUSIC_INSTALL_REPORT.json").write_text(
    json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
)

print(f"\nMUSIC CATALOG: {total}/{EXPECTED_TOTAL}")
print(f"DRAWERS: {len(data)} = {base_count} base + {limited_count} limited")
print(f"LOCAL AUDIO REFERENCES: {len(local)}")
print(f"REMOTE VERIFIED STREAM REFERENCES: {len(remote)}")
if missing:
    print("\nMISSING:")
    for x in missing[:120]:print(" -",x)
if bad:
    print("\nBAD:")
    for x in bad[:120]:print(" -",x)

sys.exit(1 if missing or bad or total!=EXPECTED_TOTAL else 0)
