#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse
import json,re,subprocess,shutil,sys
ROOT=Path(__file__).resolve().parent
s=(ROOT/"index.html").read_text(encoding="utf-8");m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',s,re.S)
if not m:raise SystemExit("MUSIC_DATA not found")
data=json.loads(m.group(1));LIMITED=json.loads((ROOT/"limited_theme_profiles.json").read_text(encoding="utf-8"));FRESH=json.loads((ROOT/"fresh_city_profiles.json").read_text(encoding="utf-8"));THEMES=json.loads((ROOT/"theme_profiles.json").read_text(encoding="utf-8"))
EXPECTED_DRAWERS=len(LIMITED)+len(FRESH)+len(THEMES);EXPECTED_VISIBLE=3300;EXPECTED_POOL=9900
missing=[];bad=[];counts={};pcounts={};ffprobe=shutil.which("ffprobe");probed=set();master=set()
for d in data:
    if d.get("t") in {"JAZZ","CROONER","ROCK","SPORT","LO-FI"}:
        for i,t in enumerate((d.get("tracks") or [])[:50]):master.add(str(t.get("masterRef") or f"{d['t']}:{i}"))
for d in data:
    name=d.get("t","UNKNOWN");tracks=d.get("tracks") or [];target=int(d.get("targetTracks",25 if d.get("limitedTheme") else 50));refs=d.get("poolRefs") or []
    counts[name]=len(tracks);pcounts[name]=len(refs)
    if len(tracks)!=target:bad.append(f"{name}: visible {len(tracks)}/{target}")
    if len(refs)!=target*3:bad.append(f"{name}: pool {len(refs)}/{target*3}")
    if int(d.get("poolSize",0))!=target*3:bad.append(f"{name}: poolSize mismatch")
    seen=set()
    for e in refs:
        ref=str(e.get("r",""))
        if ref not in master:bad.append(f"{name}: invalid master ref {ref}")
        if ref in seen:bad.append(f"{name}: duplicate master ref {ref}")
        seen.add(ref)
    for t in tracks:
        rel=str(t.get("audioSrc","") or "").strip()
        if not rel:missing.append(f"{name} :: empty audioSrc");continue
        u=urlparse(rel)
        if u.scheme in {"http","https"}:
            if u.scheme!="https" or not t.get("licenseVerified"):bad.append(f"{name}: bad remote audio")
            continue
        p=ROOT/rel
        if not p.exists():missing.append(f"{name} :: {rel}");continue
        if p.stat().st_size<20000:bad.append(f"{rel}: too small");continue
        if ffprobe and rel not in probed:
            r=subprocess.run([ffprobe,"-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(p)],capture_output=True,text=True);probed.add(rel)
            if r.returncode!=0:bad.append(f"{rel}: ffprobe failed")
CRITICAL_THEME_REGRESSION={"MENACING DUBAI":(50,150)}
for name,(need_visible,need_pool) in CRITICAL_THEME_REGRESSION.items():
    if counts.get(name)!=need_visible:bad.append(f"{name}: regression visible {counts.get(name)}/{need_visible}")
    if pcounts.get(name)!=need_pool:bad.append(f"{name}: regression pool {pcounts.get(name)}/{need_pool}")
    d=next((x for x in data if x.get("t")==name),None)
    if not d or not any(str(t.get("audioSrc","")).strip() for t in (d.get("tracks") or [])):
        bad.append(f"{name}: regression has no playable visible track")
vt=sum(counts.values());pt=sum(pcounts.values())
if len(data)!=EXPECTED_DRAWERS:bad.append(f"drawers {len(data)}/{EXPECTED_DRAWERS}")
report={"visibleTotal":vt,"searchableTotal":pt,"counts":counts,"poolCounts":pcounts,"missing":missing,"bad":bad}
(ROOT/"MUSIC_INSTALL_REPORT.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"VISIBLE CATALOG: {vt}/{EXPECTED_VISIBLE}");print(f"SEARCHABLE 3X POOL: {pt}/{EXPECTED_POOL}");print(f"MASTER AUDIO REFS: {len(master)}")
if missing or bad:
    for x in (missing+bad)[:120]:print(" -",x)
sys.exit(1 if missing or bad or vt!=EXPECTED_VISIBLE or pt!=EXPECTED_POOL else 0)
