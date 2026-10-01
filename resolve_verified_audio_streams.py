#!/usr/bin/env python3
from __future__ import annotations

import json, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from fetch_verified_audio import MANIFEST, resolve_master_audio

ROOT=Path(__file__).resolve().parent
CACHE_FILE=ROOT/"_resolved_verified_streams.json"

def read_catalog(path:Path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:
        raise RuntimeError(f"MUSIC_DATA not found in {path}")
    return text,m,json.loads(m.group(1))

def write_catalog(path:Path,data):
    text,m,_=read_catalog(path)
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")

def load_cache():
    try:
        obj=json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        return obj if isinstance(obj,dict) else {}
    except Exception:
        return {}

def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache,ensure_ascii=False,indent=2),encoding="utf-8")

def resolve_one(master):
    mid=master["masterId"]
    url=resolve_master_audio(master)
    if not url or not re.match(r"^https://",str(url),re.I):
        raise RuntimeError(f"{mid}: no HTTPS direct audio URL")
    return mid,url

def main():
    cache=load_cache()
    masters=MANIFEST.get("masters",[])
    unresolved=[m for m in masters if not re.match(r"^https://",str(cache.get(m["masterId"],"")),re.I)]
    print(f"Verified stream resolver: {len(masters)-len(unresolved)} cached / {len(unresolved)} unresolved.")

    failures=[]
    # Small pool on purpose: source sites rate-limit aggressive parallel requests.
    with ThreadPoolExecutor(max_workers=2) as ex:
        futures={ex.submit(resolve_one,m):m for m in unresolved}
        for fut in as_completed(futures):
            m=futures[fut]
            try:
                mid,url=fut.result()
                cache[mid]=url
                print(" resolved",m["artist"],"—",m["title"])
            except Exception as e:
                failures.append({"masterId":m["masterId"],"title":m["title"],"error":str(e)})
                print(" FAILED",m["title"],str(e)[:180])
            if len(cache)%12==0:
                save_cache(cache)

    save_cache(cache)
    if failures:
        (ROOT/"verified_stream_resolve_report.json").write_text(
            json.dumps({"failures":failures},ensure_ascii=False,indent=2),encoding="utf-8"
        )
        raise SystemExit(f"Could not resolve {len(failures)} audited masters")

    target_to_stream={}
    for master in masters:
        url=cache.get(master["masterId"])
        if not url:
            raise RuntimeError(f"missing cached URL for {master['masterId']}")
        for target in master.get("targets",[]):
            target_to_stream[str(target)]={
                "url":url,
                "masterId":master["masterId"],
                "source":master["source"],
                "license":master["license"],
                "licenseChecked":master.get("licenseChecked"),
                "licenseEvidence":master.get("licenseEvidence")
            }

    changed=0
    core={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
    index=ROOT/"index.html"
    _,_,data=read_catalog(index)
    for drawer in data:
        if drawer.get("t") not in core:
            continue
        for track in drawer.get("tracks",[]):
            local=str(track.get("audioSrc",""))
            info=target_to_stream.get(local)
            if not info:
                # Some slots retain their original audited target path.
                info=target_to_stream.get(str(track.get("originalAudioSrc","")))
            if not info:
                raise RuntimeError(f"{drawer.get('t')} / {track.get('title')}: no audited master target mapping")
            track["originalLocalAudio"]=local
            track["audioSrc"]=info["url"]
            track["streamingAudio"]=True
            track["localMp3"]=False
            track["masterId"]=info["masterId"]
            track["source"]=info["source"]
            track["license"]=info["license"]
            track["licenseVerified"]=True
            track["licenseChecked"]=info.get("licenseChecked") or track.get("licenseChecked")
            track["licenseEvidence"]=info.get("licenseEvidence") or track.get("licenseEvidence")
            changed+=1
        drawer["installPending"]=False

    if changed!=250:
        raise RuntimeError(f"expected 250 audited base slots, updated {changed}")

    write_catalog(index,data)
    if (ROOT/"404.html").exists():
        write_catalog(ROOT/"404.html",data)

    print(f"Audited base streaming ready: {changed}/250 slots · {len(cache)}/{len(masters)} master URLs.")

if __name__=="__main__":
    main()
