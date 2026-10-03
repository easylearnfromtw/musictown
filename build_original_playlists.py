#!/usr/bin/env python3
"""Curate MUSICTOWN original playlists from the 2500-track legal mother library.

The output is deterministic, contains only the licenses already admitted by
data/legal_music_library.json, and is embedded by design-src/build.py. No
additional network request is made while building the site.
"""
from __future__ import annotations
import hashlib, json, re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent
LIB=ROOT/"data"/"legal_music_library.json"
CAT=ROOT/"design-src"/"src"/"js"/"10-catalog.js"
OUT=ROOT/"data"/"original_playlists.generated.json"
REPORT=ROOT/"data"/"original_playlists_report.json"

COMMON_REJECT=["corporate","podcast","intro","children","comedy","christmas","notification","ringtone"]
REJECT={
 "MOONLIT HAZE":["metal","hard rock","punk","workout","party"],
 "DROWSY":["metal","punk","techno","workout","aggressive"],
 "KISS":["happy","uplifting","comedy","children"],
 "FIELD SEA NOTES":["metal","industrial","aggressive","workout"],
 "OCEANIC":["metal","punk","workout","corporate"],
 "TROUBADOUR":["techno","industrial","corporate","workout"],
 "LOOKING BACK":["corporate","comedy"],
}
NO_VOCALS={"MOONLIT HAZE":4,"DROWSY":3,"FIELD SEA NOTES":3,"OCEANIC":4}
YES_VOCALS={"KISS":2,"TROUBADOUR":5,"LOOKING BACK":1}

def norm(s):
    return re.sub(r"\s+"," ",str(s or "")).strip().casefold()

def stable_id(t):
    return str(t.get("libraryId") or t.get("masterId") or t.get("source") or (norm(t.get("artist"))+"|"+norm(t.get("title"))))

def artist_key(t):
    return norm(t.get("artist")) or "unknown"

def specs():
    s=CAT.read_text(encoding="utf-8")
    m=re.search(r"const ORIGINAL_PLAYLISTS = (\[[\s\S]*?\]);\nconst ORIGINAL_POOL",s)
    if not m: raise SystemExit("ORIGINAL_PLAYLISTS block not found")
    return json.loads(m.group(1))

def text_fields(t):
    title=norm(t.get("title")); artist=norm(t.get("artist")); genre=norm(t.get("genre")); tags=norm(t.get("tags"))
    return title,artist,genre,tags," ".join((title,artist,genre,tags))

def score_track(t,words,theme,echo_artists=frozenset()):
    title,artist,genre,tags,blob=text_fields(t)
    score=0; hits=[]
    for i,w in enumerate(words or []):
        w=norm(w)
        if not w: continue
        weight=max(3,12-min(i,8))
        if w in title: score+=weight+5; hits.append(w)
        elif w in genre: score+=weight+4; hits.append(w)
        elif w in tags: score+=weight+2; hits.append(w)
        elif w in blob: score+=weight; hits.append(w)
    for bad in COMMON_REJECT+REJECT.get(theme,[]):
        if norm(bad) in blob: score-=16
    if t.get("hasVocals") is False: score+=NO_VOCALS.get(theme,0)
    if t.get("hasVocals") is True: score+=YES_VOCALS.get(theme,0)
    if artist in echo_artists: score+=8
    # Nullrights / direct-download entries are the most dependable in-browser.
    src=norm(t.get("source"))
    if t.get("download") or "nullrights.com/track/" in src: score+=3
    tie=hashlib.sha1((theme+"|"+stable_id(t)).encode()).hexdigest()
    return score,tie,hits

def playable(t):
    src=norm(t.get("source"))
    return bool(t.get("download") or "nullrights.com/track/" in src)

def choose(pool,theme,words,n,used,artist_counts,phase,echo_artists=frozenset(),max_artist=2):
    ranked=[]
    for t in pool:
        k=stable_id(t)
        if k in used or not playable(t): continue
        sc,tie,hits=score_track(t,words,theme,echo_artists)
        ranked.append((sc,tie,t,hits))
    ranked.sort(key=lambda x:(-x[0],x[1]))
    out=[]
    # First pass enforces artist diversity.
    for sc,tie,t,hits in ranked:
        a=artist_key(t)
        if artist_counts[a]>=max_artist: continue
        used.add(stable_id(t)); artist_counts[a]+=1
        out.append((t,sc,hits,phase))
        if len(out)>=n: return out
    # Safety fallback: keep track uniqueness even if the artist cap is the bottleneck.
    for sc,tie,t,hits in ranked:
        if stable_id(t) in used: continue
        used.add(stable_id(t)); artist_counts[artist_key(t)]+=1
        out.append((t,sc,hits,phase))
        if len(out)>=n: return out
    raise RuntimeError(f"{theme}: only {len(out)}/{n} playable unique tracks")

def public_track(t,spec,i,sc,hits,phase):
    keep=("libraryId","title","artist","source","download","license","licenseEvidence","licenseChecked","genre","tags","duration","hasVocals","origin")
    o={k:t.get(k) for k in keep if t.get(k) is not None}
    sid=stable_id(t)
    o["masterId"]=str(t.get("masterId") or hashlib.sha1(sid.encode()).hexdigest()[:16])
    src=str(t.get("source") or "")
    if "nullrights.com/track/" in src:
        o["embed"]=src.rstrip("/").split("/")[-1]
    o["trackNo"]=i
    o["shareId"]=f"{spec['slug']}-{i:03d}"
    o["curatedTheme"]=spec["t"]
    o["curatedFrom"]=sid
    o["motherLibrary"]=True
    o["curationScore"]=sc
    o["curationPhase"]=phase
    o["curationMatches"]=hits[:10]
    descriptor=str(t.get("genre") or t.get("tags") or "Mother Library")
    o["vibe"]=f"{spec['name']} · {descriptor[:140]}"
    return o

def main():
    lib=json.loads(LIB.read_text(encoding="utf-8"))
    pool=lib.get("tracks",[])
    if len(pool)<2500: raise SystemExit(f"legal library too small: {len(pool)}")
    all_used=set(); playlists=[]; report={"libraryVersion":lib.get("version"),"libraryCount":len(pool),"playlists":{}}
    for spec in specs():
        theme=spec["t"]; artist_counts=Counter(); selected=[]
        phases=spec.get("phases")
        if phases:
            first_artists=set()
            for pi,p in enumerate(phases):
                echo=first_artists if theme=="TROUBADOUR" and pi==len(phases)-1 else frozenset()
                batch=choose(pool,theme,p.get("words",[]),int(p["n"]),all_used,artist_counts,p.get("label") or f"phase-{pi+1}",echo,max_artist=2)
                if pi==0: first_artists={artist_key(x[0]) for x in batch}
                selected.extend(batch)
        elif theme=="LOOKING BACK":
            selected.extend(choose(pool,theme,spec.get("rush",[]),24,all_used,artist_counts,"尋找",max_artist=2))
            selected.extend(choose(pool,theme,spec.get("resolve",[]),1,all_used,artist_counts,"找到",max_artist=2))
        else:
            selected.extend(choose(pool,theme,spec.get("words",[]),25,all_used,artist_counts,"main",max_artist=2))
        if len(selected)!=25: raise RuntimeError(f"{theme}: expected 25, got {len(selected)}")
        tracks=[public_track(t,spec,i,sc,hits,phase) for i,(t,sc,hits,phase) in enumerate(selected,1)]
        playlists.append({"t":theme,"tracks":tracks})
        report["playlists"][theme]=[{"n":i,"title":t["title"],"artist":t["artist"],"score":t["curationScore"],"phase":t["curationPhase"],"matches":t["curationMatches"]} for i,t in enumerate(tracks,1)]
        print(f"\n{spec['name']} · {theme}")
        for t in tracks: print(f"  {t['trackNo']:02d}. {t['artist']} — {t['title']} [{t['curationPhase']}] score={t['curationScore']}")
    masters=[t["masterId"] for p in playlists for t in p["tracks"]]
    expected=len(playlists)*25
    if len(masters)!=expected or len(set(masters))!=expected: raise RuntimeError(f"original playlists are not {expected} globally unique masters")
    OUT.write_text(json.dumps(playlists,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"\noriginal playlists: {len(playlists)} themes / {len(masters)} globally unique legal-library tracks")

if __name__=="__main__":
    main()
