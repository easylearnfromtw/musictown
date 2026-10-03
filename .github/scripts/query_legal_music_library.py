#!/usr/bin/env python3
"""Query data/legal_music_library.json for future MUSICTOWN curation."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; LIB=ROOT/"data"/"legal_music_library.json"
def norm(s): return re.sub(r"\s+"," ",str(s or "")).strip().casefold()
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--query",default=""); ap.add_argument("--genre",default="")
    ap.add_argument("--tag",action="append",default=[]); ap.add_argument("--license",dest="license_name",default="")
    ap.add_argument("--vocals",choices=["any","yes","no"],default="any")
    ap.add_argument("--min-duration",type=int,default=0); ap.add_argument("--max-duration",type=int,default=10**9)
    ap.add_argument("--limit",type=int,default=50); ap.add_argument("--seed",default="musicetown")
    a=ap.parse_args()
    if not LIB.exists(): raise SystemExit("legal music library not built yet")
    p=json.loads(LIB.read_text(encoding="utf-8")); q=[x for x in re.split(r"\s+",norm(a.query)) if x]
    genre=norm(a.genre); tags=[norm(x) for x in a.tag if norm(x)]; lic=norm(a.license_name); out=[]
    for t in p.get("tracks",[]):
        dur=t.get("duration")
        if dur is not None and not (a.min_duration<=dur<=a.max_duration): continue
        if lic and lic not in norm(t.get("license")): continue
        if a.vocals=="yes" and not t.get("hasVocals"): continue
        if a.vocals=="no" and t.get("hasVocals"): continue
        if genre and genre not in norm(t.get("genre")): continue
        blob=" ".join(norm(t.get(k)) for k in ("title","artist","genre","tags"))
        if tags and not all(x in blob for x in tags): continue
        score=sum(6 if x in norm(t.get("genre")) else 4 if x in norm(t.get("tags")) else 2 if x in blob else -12 for x in q)
        tie=hashlib.sha1((a.seed+"|"+str(t.get("libraryId") or t.get("masterId") or t.get("source"))).encode()).hexdigest()
        out.append((score,tie,t))
    out.sort(key=lambda x:(-x[0],x[1])); selected=[t for _,_,t in out[:max(0,a.limit)]]
    json.dump({"libraryVersion":p.get("version"),"libraryCount":p.get("count"),"matched":len(out),"selected":selected},sys.stdout,ensure_ascii=False,indent=2); print()
if __name__=="__main__": main()
