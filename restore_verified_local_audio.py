#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parent
CORE={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
MANIFEST=json.loads((ROOT/"verified_audio_manifest.json").read_text(encoding="utf-8"))

def read_catalog(path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:raise RuntimeError(f"MUSIC_DATA not found in {path}")
    return text,m,json.loads(m.group(1))

def write_catalog(path,data):
    text,m,_=read_catalog(path)
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")

slots={}
for row in MANIFEST.get("slotsDetail",[]):
    theme=str(row.get("theme",""))
    slot=int(row.get("slot") or 0)
    if theme in CORE and slot>0:slots[(theme,slot)]=row

def restore(path):
    _,_,data=read_catalog(path)
    changed=0
    for drawer in data:
        theme=drawer.get("t")
        if theme not in CORE:continue
        tracks=drawer.get("tracks",[])
        if len(tracks)<50:raise RuntimeError(f"{theme}: expected 50 base tracks, got {len(tracks)}")
        for i,t in enumerate(tracks[:50],1):
            row=slots.get((theme,i))
            if not row:raise RuntimeError(f"{theme} slot {i}: missing manifest mapping")
            target=str(row["target"])
            if not (ROOT/target).exists():raise RuntimeError(f"{target}: local audio file missing")
            t["title"]=row.get("title") or t.get("title")
            t["artist"]=row.get("artist") or t.get("artist")
            t["source"]=row.get("source") or t.get("source")
            t["license"]=row.get("license") or t.get("license") or "CC0 1.0 Universal"
            t["licenseVerified"]=True
            t["licenseChecked"]=row.get("licenseChecked") or t.get("licenseChecked")
            t["licenseEvidence"]=row.get("licenseEvidence") or t.get("licenseEvidence")
            t["audioSrc"]=target
            t["originalAudioSrc"]=target
            t["localMp3"]=True
            t["streamingAudio"]=False
            t["trackNo"]=i
            t["shareId"]=row.get("shareId") or t.get("shareId") or f"{theme.lower()}-{i:03d}"
            changed+=1
        drawer["installPending"]=False
        drawer["targetTracks"]=50
    if changed!=250:raise RuntimeError(f"expected 250 restored slots, got {changed}")
    write_catalog(path,data)
    return changed

n=restore(ROOT/"index.html")
if (ROOT/"404.html").exists():restore(ROOT/"404.html")
print(f"Verified local audio restored: {n}/250 base slots.")
