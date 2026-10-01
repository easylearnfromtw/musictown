#!/usr/bin/env python3
from __future__ import annotations

import json, re, time, hashlib
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

    # Some previously-audited source pages can later stop exposing a direct media
    # URL even though their license evidence remains valid. Never block the whole
    # release because of a dead transport URL: replace only the affected SLOT with
    # another already-audited, currently resolvable master from the same drawer.
    resolved_by_folder={}
    for master in masters:
        url=cache.get(master["masterId"])
        if not re.match(r"^https://",str(url or ""),re.I):
            continue
        for target in master.get("targets",[]):
            folder=str(target).split("/",1)[0]
            resolved_by_folder.setdefault(folder,[]).append((master,url))

    failed_ids={x["masterId"] for x in failures}
    replacements=[]
    target_to_stream={}
    for master in masters:
        own_url=cache.get(master["masterId"])
        for target in master.get("targets",[]):
            target=str(target)
            chosen=master
            url=own_url
            replacement_for=None
            if not re.match(r"^https://",str(url or ""),re.I):
                folder=target.split("/",1)[0]
                donors=resolved_by_folder.get(folder,[])
                if not donors:
                    raise RuntimeError(f"{target}: no verified HTTPS donor available")
                seed=int(hashlib.sha1(target.encode("utf-8")).hexdigest()[:8],16)
                chosen,url=donors[seed%len(donors)]
                replacement_for=master["masterId"]
                replacements.append({
                    "target":target,
                    "replacedMasterId":master["masterId"],
                    "replacedTitle":master.get("title"),
                    "donorMasterId":chosen["masterId"],
                    "donorTitle":chosen.get("title"),
                    "donorArtist":chosen.get("artist")
                })
            target_to_stream[target]={
                "url":url,
                "masterId":chosen["masterId"],
                "title":chosen.get("title"),
                "artist":chosen.get("artist"),
                "source":chosen["source"],
                "license":chosen["license"],
                "licenseChecked":chosen.get("licenseChecked"),
                "licenseEvidence":chosen.get("licenseEvidence"),
                "replacementFor":replacement_for
            }

    (ROOT/"verified_stream_resolve_report.json").write_text(
        json.dumps({"failures":failures,"slotReplacements":replacements},ensure_ascii=False,indent=2),
        encoding="utf-8"
    )

    changed=0
    core={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
    index=ROOT/"index.html"
    _,_,data=read_catalog(index)
    for drawer in data:
        if drawer.get("t") not in core:
            continue
        for track in drawer.get("tracks",[]):
            local=str(track.get("audioSrc",""))

            # Idempotent release rebuild: once a persisted catalog already carries
            # an audited HTTPS stream, do not try to reinterpret that URL as an old
            # repository-local target path. UI-only commits may trigger this workflow
            # many times, so the resolver must accept its own previous output.
            if re.match(r"^https://",local,re.I) and track.get("licenseVerified") and track.get("source"):
                track["streamingAudio"]=True
                track["localMp3"]=False
                track.setdefault("originalLocalAudio",str(track.get("originalAudioSrc") or ""))
                changed+=1
                continue

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
            if info.get("title"): track["title"]=info["title"]
            if info.get("artist"): track["artist"]=info["artist"]
            if info.get("replacementFor"):
                track["transportReplacement"]=True
                track["replacedMasterId"]=info["replacementFor"]
            else:
                track.pop("transportReplacement",None)
                track.pop("replacedMasterId",None)
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

    print(f"Audited base streaming ready: {changed}/250 slots · {len(cache)}/{len(masters)} direct master URLs · {len(replacements)} transport replacements.")

if __name__=="__main__":
    main()
