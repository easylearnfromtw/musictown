#!/usr/bin/env python3
from __future__ import annotations

import json, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from fetch_verified_audio import MANIFEST, resolve_master_audio

ROOT=Path(__file__).resolve().parent
CACHE_FILE=ROOT/"_verified_stream_cache.json"
BASE_THEMES={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}

def read_catalog(path: Path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:
        raise RuntimeError(f"MUSIC_DATA not found in {path.name}")
    return text,m,json.loads(m.group(1))

def write_catalog(path: Path,data):
    text,m,_=read_catalog(path)
    payload=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(
        text[:m.start()]+f"window.MUSIC_DATA = {payload};\n"+text[m.end():],
        encoding="utf-8"
    )

def load_cache():
    try:
        obj=json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        return obj if isinstance(obj,dict) else {}
    except Exception:
        return {}

def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache,ensure_ascii=False,indent=2),encoding="utf-8")

def resolve_one(master):
    url=resolve_master_audio(master)
    if not url or not re.match(r"^https://",str(url),re.I):
        raise RuntimeError("resolved audio URL is missing or not HTTPS")
    return master["masterId"],url

def main():
    index=ROOT/"index.html"
    fallback=ROOT/"404.html"
    if not index.exists():
        raise SystemExit("index.html not found")

    cache=load_cache()
    masters=list(MANIFEST.get("masters") or [])
    unresolved=[m for m in masters if not re.match(r"^https://",str(cache.get(m["masterId"],"")),re.I)]
    print(f"Audited masters: {len(masters)} · cached HTTPS: {len(masters)-len(unresolved)} · resolving: {len(unresolved)}")

    failures=[]
    if unresolved:
        # Keep concurrency deliberately low: source pages are public, but we do
        # not want a release build to hammer FMA / Nullrights.
        with ThreadPoolExecutor(max_workers=3) as ex:
            future_map={ex.submit(resolve_one,m):m for m in unresolved}
            for n,fut in enumerate(as_completed(future_map),1):
                master=future_map[fut]
                try:
                    mid,url=fut.result()
                    cache[mid]=url
                    print(f"[{n}/{len(unresolved)}] OK {master['artist']} — {master['title']}")
                    if n%8==0:
                        save_cache(cache)
                except Exception as exc:
                    failures.append({
                        "masterId":master.get("masterId"),
                        "title":master.get("title"),
                        "source":master.get("source"),
                        "error":str(exc)
                    })
                    print(f"[{n}/{len(unresolved)}] FAILED {master.get('title')}: {exc}")
        save_cache(cache)

    if failures:
        (ROOT/"verified_stream_failures.json").write_text(
            json.dumps(failures,ensure_ascii=False,indent=2),encoding="utf-8"
        )
        raise RuntimeError(f"{len(failures)} audited masters could not resolve to HTTPS audio")

    target_to_url={}
    target_to_master={}
    for master in masters:
        url=cache.get(master["masterId"])
        if not re.match(r"^https://",str(url or ""),re.I):
            raise RuntimeError(f"{master['title']}: no cached HTTPS stream")
        for target in master.get("targets") or []:
            target_to_url[str(target)]=url
            target_to_master[str(target)]=master

    text,m,data=read_catalog(index)
    converted=0
    missing=[]
    base_counts={}
    for drawer in data:
        if drawer.get("t") not in BASE_THEMES:
            continue
        tracks=drawer.get("tracks") or []
        base_counts[drawer["t"]]=len(tracks)
        for track in tracks:
            src=str(track.get("audioSrc") or "")
            if re.match(r"^https://",src,re.I):
                track["streamingAudio"]=True
                track["localMp3"]=False
                continue
            url=target_to_url.get(src)
            if not url:
                missing.append(f"{drawer['t']} :: {track.get('title','')} :: {src}")
                continue
            master=target_to_master[src]
            track["audioSrc"]=url
            track["streamingAudio"]=True
            track["localMp3"]=False
            track["auditedStream"]=True
            track["auditedMasterId"]=master.get("masterId")
            track["licenseVerified"]=True
            track.setdefault("license",master.get("license","CC0 1.0 Universal"))
            track.setdefault("licenseChecked",master.get("licenseChecked"))
            track.setdefault("licenseEvidence",master.get("licenseEvidence"))
            track.setdefault("source",master.get("source"))
            converted+=1
        drawer["installPending"]=False

    if missing:
        raise RuntimeError("Audited target mapping missing:\n" + "\n".join(missing[:40]))
    if set(base_counts)!=BASE_THEMES or any(base_counts.get(k)!=50 for k in BASE_THEMES):
        raise RuntimeError(f"Base drawer counts invalid: {base_counts}")

    write_catalog(index,data)
    if fallback.exists():
        write_catalog(fallback,data)

    report={
      "generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
      "auditedMasters":len(masters),
      "targetSlots":len(target_to_url),
      "convertedSlots":converted,
      "baseCounts":base_counts,
      "allBaseHttps":all(
          re.match(r"^https://",str(t.get("audioSrc") or ""),re.I)
          for d in data if d.get("t") in BASE_THEMES for t in d.get("tracks",[])
      )
    }
    (ROOT/"verified_stream_report.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
    )
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if not report["allBaseHttps"]:
        raise RuntimeError("not all audited base slots are HTTPS")

if __name__=="__main__":
    main()
