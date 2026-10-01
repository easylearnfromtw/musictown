#!/usr/bin/env python3
from __future__ import annotations
import json,re,hashlib,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
THEMES=json.loads((ROOT/"theme_profiles.json").read_text(encoding="utf-8"))
CITIES=json.loads((ROOT/"fresh_city_profiles.json").read_text(encoding="utf-8"))

THEME_SOURCES={
  "JAZZ":["JAZZ"],"CROONER":["CROONER"],"ROCK":["ROCK"],"SPORT":["SPORT"],"LO-FI":["LO-FI"],
  "EMO":["ROCK","LO-FI"],
  "RUNNING":["SPORT","ROCK"],
  "POEM":["CROONER","LO-FI","JAZZ"],
  "TRADITIONAL BEIJING":["JAZZ","CROONER","LO-FI"],
}
CITY_SOURCES={
  "TAIPEI DREAM":["LO-FI","JAZZ","CROONER"],
  "OLD TOKYO":["LO-FI","JAZZ","SPORT"],
  "SPLENDOR SHANGHAI":["JAZZ","CROONER"],
  "VANCOUVER":["LO-FI","CROONER","JAZZ"],
  "VAPOR LONDON":["ROCK","JAZZ","LO-FI"],
  "NEW YORK":["JAZZ","SPORT","ROCK"],
  "TROPICAL HAWAII":["CROONER","LO-FI","SPORT"],
  "BUSTLING HONG KONG":["SPORT","ROCK","JAZZ"],
  "SLIGHTLY TIPSY ROME":["CROONER","JAZZ"],
  "PSYCHEDELIC LA":["ROCK","LO-FI"],
  "SOLEMN KYOTO":["LO-FI","JAZZ","CROONER"],
  "MIRACULOUS LUOYANG":["JAZZ","CROONER"],
  "CHAMPS-ÉLYSÉES":["CROONER","JAZZ","LO-FI"],
  "MENACING DUBAI":["SPORT","ROCK","LO-FI"],
  "BARCELONA":["CROONER","ROCK","JAZZ"],
  "RUSTY DETROIT":["ROCK","JAZZ","SPORT"],
  "SYDNEY STREET":["ROCK","SPORT","LO-FI"],
  "TIANJING":["JAZZ","CROONER","LO-FI"],
  "ROTTERDAM":["SPORT","LO-FI","ROCK"],
  "LAS VEGAS":["CROONER","JAZZ","SPORT"],
  "FREEZE HOKKAIDO":["LO-FI","CROONER","JAZZ"],
  "MEXICO":["ROCK","CROONER","JAZZ"],
}

def read_catalog(path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m: raise RuntimeError(f"MUSIC_DATA not found in {path}")
    return text,m,json.loads(m.group(1))

def write_catalog(path,data):
    text,m,_=read_catalog(path)
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")

def text_blob(t):
    return " ".join(str(t.get(k,"") or "") for k in ("title","artist","genre","tags","sounds","vibe","curatedTheme")).casefold()

def score(t,profile,source_rank,theme):
    b=text_blob(t)
    s=130-source_rank*18
    matches=[]
    for kw in profile.get("keywords",[]):
        if str(kw).casefold() in b:
            s+=10;matches.append(kw)
    for kw in profile.get("required_any",[]):
        if str(kw).casefold() in b:s+=7
    for kw in profile.get("reject",[]):
        if str(kw).casefold() in b:s-=25
    if t.get("licenseVerified"):s+=15
    if t.get("hasVocals"):s+=3
    tie=int(hashlib.sha1((theme+"|"+str(t.get("shareId",""))+"|"+str(t.get("source",""))).encode()).hexdigest()[:10],16)
    return s,matches,tie

def clone_tracks(theme,profile,sources,by_name,target=50):
    pool=[]
    seen=set()
    for rank,src_name in enumerate(sources):
        drawer=by_name.get(src_name)
        if not drawer:continue
        for t in drawer.get("tracks",[]):
            if not t.get("audioSrc") or not t.get("licenseVerified"):continue
            src=str(t.get("audioSrc",""))
            ident=(t.get("source"),t.get("title"),t.get("artist"),src)
            if ident in seen:continue
            seen.add(ident)
            s,matches,tie=score(t,profile,rank,theme)
            pool.append((s,tie,src_name,matches,t))
    if len(pool)<target:
        raise RuntimeError(f"{theme}: related audited pool only has {len(pool)}/{target} tracks")
    pool.sort(key=lambda x:(-x[0],x[1]))
    out=[]
    slug=profile.get("slug") or re.sub(r"[^a-z0-9]+","-",theme.lower()).strip("-")
    for i,(s,_,src_name,matches,t) in enumerate(pool[:target],1):
        x=dict(t)
        x.update({
          "trackNo":i,
          "shareId":f"{slug}-{i:03d}",
          "curatedTheme":theme,
          "curationScore":round(float(s),2),
          "curationMatches":matches[:8],
          "curationTier":"audited-related-drawer",
          "curatedFromDrawer":src_name,
          "streamingAudio":bool(re.match(r"^https://",str(x.get("audioSrc","")),re.I)),
          "localMp3":not bool(re.match(r"^https://",str(x.get("audioSrc","")),re.I)),
          "vibe":f"{profile.get('label') or profile.get('vibe') or theme} · {x.get('genre') or src_name}"
        })
        out.append(x)
    return out

def main():
    _,_,data=read_catalog(ROOT/"index.html")
    by_name={d["t"]:d for d in data}

    # Base five are restored to verified repository-local MP3 files before curation.
    core5={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
    for name in core5:
        d=by_name.get(name)
        if not d or len(d.get("tracks",[]))<50:
            raise RuntimeError(f"{name}: audited base drawer is not ready")
        if not all(t.get("licenseVerified") and str(t.get("audioSrc","")).strip() for t in d["tracks"][:50]):
            raise RuntimeError(f"{name}: audited base drawer contains missing/unverified audio")
        for t in d["tracks"][:50]:
            src=str(t.get("audioSrc",""))
            if re.match(r"^https?://",src,re.I):
                raise RuntimeError(f"{name}: base drawer must use local MP3, got remote {src}")

    report={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"themes":{},"cities":{}}

    # Build the four non-base core themes first; base five remain unchanged.
    for theme,profile in THEMES.items():
        if theme in core5:
            by_name[theme]["installPending"]=False
            report["themes"][theme]=by_name[theme]["tracks"][:50]
            continue
        sources=THEME_SOURCES.get(theme)
        if not sources:raise RuntimeError(f"{theme}: no audited source mapping")
        tracks=clone_tracks(theme,profile,sources,by_name,50)
        by_name[theme]["tracks"]=tracks;by_name[theme]["installPending"]=False;by_name[theme]["targetTracks"]=50
        report["themes"][theme]=tracks
        print(f"THEME {theme}: 50 audited related tracks")

    # Cities are constructed from the audited base five only. This deliberately
    # keeps release builds independent from source-site availability/rate limits.
    for city,profile in CITIES.items():
        sources=CITY_SOURCES.get(city)
        if not sources:raise RuntimeError(f"{city}: no audited source mapping")
        tracks=clone_tracks(city,profile,sources,by_name,50)
        by_name[city]["tracks"]=tracks;by_name[city]["installPending"]=False;by_name[city]["targetTracks"]=50
        report["cities"][city]=tracks
        print(f"CITY {city}: 50 audited related tracks")

    final=[by_name[d["t"]] for d in data]
    write_catalog(ROOT/"index.html",final)
    if (ROOT/"404.html").exists():write_catalog(ROOT/"404.html",final)
    (ROOT/"theme_curation_manifest.json").write_text(json.dumps({"generatedAt":report["generatedAt"],"themes":report["themes"]},ensure_ascii=False,indent=2),encoding="utf-8")
    (ROOT/"fresh_city_manifest.json").write_text(json.dumps({"generatedAt":report["generatedAt"],"cities":report["cities"]},ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Audited deterministic curation ready: {len(THEMES)} core themes + {len(CITIES)} city themes.")

if __name__=="__main__":
    main()
