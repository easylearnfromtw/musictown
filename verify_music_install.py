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

EXPECTED_DRAWERS=52
EXPECTED_BASE_TRACKS=50
EXPECTED_LIMITED_TRACKS=25

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
    counts[name]=len(tracks)
    target=max(1,int(d.get("targetTracks") or EXPECTED_BASE_TRACKS))
    if len(tracks)!=target:
        bad.append(f"{name}: expected {target} tracks, got {len(tracks)}")
    if d.get("installPending"):
        bad.append(f"{name}: installPending still true")

    drawer_seen=set()
    for t in tracks:
        title=t.get("title","")
        rel=str(t.get("audioSrc","") or "").strip()
        sid=str(t.get("shareId","") or "").strip()
        if sid:
            if sid in drawer_seen:
                bad.append(f"{name}: duplicate shareId {sid}")
            drawer_seen.add(sid)
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

expected_total=sum(max(1,int(d.get("targetTracks") or EXPECTED_BASE_TRACKS)) for d in data)
total=sum(counts.values())
ready=total-len(missing)-len([x for x in bad if "::" in x or ": too small" in x or ": ffprobe failed" in x])

report={
  "expected":expected_total,
  "drawers":len(data),
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

print(f"\nMUSIC CATALOG: {total}/{expected_total}")
print(f"LOCAL AUDIO: {len(local)}")
print(f"REMOTE VERIFIED STREAMS: {len(remote)}")
if missing:
    print("\nMISSING:")
    for x in missing[:100]:print(" -",x)
if bad:
    print("\nBAD:")
    for x in bad[:100]:print(" -",x)

sys.exit(1 if missing or bad or total!=expected_total else 0)
