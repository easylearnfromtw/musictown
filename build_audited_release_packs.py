#!/usr/bin/env python3
from __future__ import annotations
import json,re,hashlib,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
THEMES=json.loads((ROOT/"theme_profiles.json").read_text(encoding="utf-8"))
CITIES=json.loads((ROOT/"fresh_city_profiles.json").read_text(encoding="utf-8"))
CORE5=("JAZZ","CROONER","ROCK","SPORT","LO-FI")
VISIBLE_TRACKS=50
POOL_MULTIPLIER=3
POOL_TRACKS=VISIBLE_TRACKS*POOL_MULTIPLIER

THEME_SOURCES={
  "JAZZ":["JAZZ"],"CROONER":["CROONER"],"ROCK":["ROCK"],"SPORT":["SPORT"],"LO-FI":["LO-FI"],
  "EMO":["ROCK","LO-FI"],"RUNNING":["SPORT","ROCK"],
  "POEM":["CROONER","LO-FI","JAZZ"],"TRADITIONAL BEIJING":["JAZZ","CROONER","LO-FI"],
}
CITY_SOURCES={
  "TAIPEI DREAM":["LO-FI","JAZZ","CROONER"],"OLD TOKYO":["LO-FI","JAZZ","SPORT"],
  "SPLENDOR SHANGHAI":["JAZZ","CROONER"],"VANCOUVER":["LO-FI","CROONER","JAZZ"],
  "VAPOR LONDON":["ROCK","JAZZ","LO-FI"],"NEW YORK":["JAZZ","SPORT","ROCK"],
  "TROPICAL HAWAII":["CROONER","LO-FI","SPORT"],"BUSTLING HONG KONG":["SPORT","ROCK","JAZZ"],
  "SLIGHTLY TIPSY ROME":["CROONER","JAZZ"],"PSYCHEDELIC LA":["ROCK","LO-FI"],
  "SOLEMN KYOTO":["LO-FI","JAZZ","CROONER"],"MIRACULOUS LUOYANG":["JAZZ","CROONER"],
  "CHAMPS-ÉLYSÉES":["CROONER","JAZZ","LO-FI"],"MENACING DUBAI":["SPORT","ROCK","LO-FI"],
  "BARCELONA":["CROONER","ROCK","JAZZ"],"RUSTY DETROIT":["ROCK","JAZZ","SPORT"],
  "SYDNEY STREET":["ROCK","SPORT","LO-FI"],"TIANJING":["JAZZ","CROONER","LO-FI"],
  "ROTTERDAM":["SPORT","LO-FI","ROCK"],"LAS VEGAS":["CROONER","JAZZ","SPORT"],
  "FREEZE HOKKAIDO":["LO-FI","CROONER","JAZZ"],"MEXICO":["ROCK","CROONER","JAZZ"],
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
    b=text_blob(t);s=130-source_rank*18;matches=[]
    for kw in profile.get("keywords",[]):
        if str(kw).casefold() in b:s+=10;matches.append(kw)
    for kw in profile.get("required_any",[]):
        if str(kw).casefold() in b:s+=7
    for kw in profile.get("reject",[]):
        if str(kw).casefold() in b:s-=25
    if t.get("licenseVerified"):s+=15
    if t.get("hasVocals"):s+=3
    tie=int(hashlib.sha1((theme+"|"+str(t.get("masterRef",""))+"|"+str(t.get("source",""))).encode()).hexdigest()[:10],16)
    return s,matches,tie

def slugify(theme,profile):
    return profile.get("slug") or re.sub(r"[^a-z0-9]+","-",theme.lower()).strip("-")

def snapshot_masters(by_name):
    masters={}
    for name in CORE5:
        d=by_name.get(name)
        if not d or len(d.get("tracks",[]))<VISIBLE_TRACKS:
            raise RuntimeError(f"{name}: audited base drawer is not ready")
        rows=[]
        for i,t in enumerate(d["tracks"][:VISIBLE_TRACKS]):
            if not t.get("licenseVerified") or not str(t.get("audioSrc","")).strip():
                raise RuntimeError(f"{name}: missing/unverified base audio")
            if re.match(r"^https?://",str(t.get("audioSrc","")),re.I):
                raise RuntimeError(f"{name}: base drawer must use local MP3")
            ref=f"{name}:{i}";t["masterRef"]=ref;rows.append(dict(t))
        masters[name]=rows
    return masters

def ranked_candidates(theme,profile,sources,masters,target):
    pool=[];seen=set()
    def add_source(src_name,rank):
        for i,t in enumerate(masters.get(src_name,[])):
            ref=f"{src_name}:{i}"
            if ref in seen:continue
            seen.add(ref)
            s,matches,tie=score(t,profile,rank,theme)
            pool.append((s,tie,src_name,ref,matches,t))
    for rank,src_name in enumerate(sources):add_source(src_name,rank)
    for src_name in CORE5:add_source(src_name,max(6,len(sources)+3))
    if len(pool)<target:raise RuntimeError(f"{theme}: only {len(pool)}/{target} master tracks")
    pool.sort(key=lambda x:(-x[0],x[1]))
    return pool[:target]

def make_pool(theme,profile,sources,masters,pool_target=POOL_TRACKS,visible=VISIBLE_TRACKS):
    ranked=ranked_candidates(theme,profile,sources,masters,pool_target)
    slug=slugify(theme,profile);refs=[];tracks=[]
    for i,(s,_,src_name,ref,matches,t) in enumerate(ranked,1):
        sid=f"{slug}-{i:03d}"
        refs.append({"r":ref,"q":round(float(s),2),"src":src_name,"id":sid})
        if i<=visible:
            x=dict(t)
            x.update({"trackNo":i,"shareId":sid,"masterRef":ref,"curatedTheme":theme,
              "curationScore":round(float(s),2),"curationMatches":matches[:8],
              "curationTier":"audited-3x-pool","curatedFromDrawer":src_name,
              "streamingAudio":bool(re.match(r"^https://",str(x.get("audioSrc","")),re.I)),
              "localMp3":not bool(re.match(r"^https://",str(x.get("audioSrc","")),re.I)),
              "vibe":f"{profile.get('label') or profile.get('vibe') or theme} · {x.get('genre') or src_name}"})
            tracks.append(x)
    return tracks,refs

def make_base_pool(theme,profile,masters):
    slug=slugify(theme,profile);refs=[];visible=[];seen=set()
    for i,t in enumerate(masters[theme],1):
        ref=f"{theme}:{i-1}";seen.add(ref);s,_,_=score(t,profile,0,theme)
        sid=str(t.get("shareId") or f"{slug}-{i:03d}")
        x=dict(t);x.update({"trackNo":i,"shareId":sid,"masterRef":ref,"curatedTheme":theme,"curationScore":round(float(s),2)})
        visible.append(x);refs.append({"r":ref,"q":round(float(s),2),"src":theme,"id":sid})
    fallback=[]
    for src_name in CORE5:
        if src_name==theme:continue
        for j,t in enumerate(masters[src_name]):
            ref=f"{src_name}:{j}";s,_,tie=score(t,profile,7,theme)
            fallback.append((s,tie,src_name,ref))
    fallback.sort(key=lambda x:(-x[0],x[1]))
    for k,(s,_,src_name,ref) in enumerate(fallback[:POOL_TRACKS-len(refs)],VISIBLE_TRACKS+1):
        refs.append({"r":ref,"q":round(float(s),2),"src":src_name,"id":f"{slug}-{k:03d}"})
    if len(refs)!=POOL_TRACKS:raise RuntimeError(f"{theme}: only {len(refs)}/{POOL_TRACKS} pool refs")
    return visible,refs

def main():
    _,_,data=read_catalog(ROOT/"index.html")
    by_name={d["t"]:d for d in data};masters=snapshot_masters(by_name)
    report={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"themes":{},"cities":{}}
    for theme,profile in THEMES.items():
        sources=THEME_SOURCES.get(theme)
        if not sources:raise RuntimeError(f"{theme}: no audited source mapping")
        tracks,refs=make_base_pool(theme,profile,masters) if theme in CORE5 else make_pool(theme,profile,sources,masters)
        d=by_name[theme];d["tracks"]=tracks;d["poolRefs"]=refs;d["poolSize"]=len(refs);d["targetTracks"]=VISIBLE_TRACKS;d["installPending"]=False
        report["themes"][theme]={"visible":tracks,"poolSize":len(refs)}
        print(f"THEME {theme}: {VISIBLE_TRACKS} visible / {len(refs)} searchable")
    for city,profile in CITIES.items():
        sources=CITY_SOURCES.get(city)
        if not sources:raise RuntimeError(f"{city}: no audited source mapping")
        tracks,refs=make_pool(city,profile,sources,masters)
        d=by_name[city];d["tracks"]=tracks;d["poolRefs"]=refs;d["poolSize"]=len(refs);d["targetTracks"]=VISIBLE_TRACKS;d["installPending"]=False
        report["cities"][city]={"visible":tracks,"poolSize":len(refs)}
        print(f"CITY {city}: {VISIBLE_TRACKS} visible / {len(refs)} searchable")
    final=[by_name[d["t"]] for d in data]
    write_catalog(ROOT/"index.html",final)
    if (ROOT/"404.html").exists():write_catalog(ROOT/"404.html",final)
    (ROOT/"theme_curation_manifest.json").write_text(json.dumps({"generatedAt":report["generatedAt"],"themes":report["themes"]},ensure_ascii=False,indent=2),encoding="utf-8")
    (ROOT/"fresh_city_manifest.json").write_text(json.dumps({"generatedAt":report["generatedAt"],"cities":report["cities"]},ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"CITYMUSIC 3x pool ready: {len(THEMES)+len(CITIES)} standard themes.")

if __name__=="__main__":main()
