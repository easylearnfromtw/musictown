#!/usr/bin/env python3
from __future__ import annotations
import json,re,hashlib,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
PROFILES=json.loads((ROOT/"limited_theme_profiles.json").read_text(encoding="utf-8"))

def read_catalog(path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:raise RuntimeError("window.MUSIC_DATA not found")
    return text,m,json.loads(m.group(1))

def write_catalog(path,data):
    text,m,_=read_catalog(path)
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")

def blob(track):
    fields=["title","artist","genre","tags","sounds","vibe","curatedTheme"]
    return " ".join(str(track.get(k,"") or "") for k in fields).casefold()

def score(track, profile, source_rank):
    b=blob(track)
    s=max(0,120-source_rank*14)
    matches=[]
    for kw in profile.get("keywords",[]):
        if str(kw).casefold() in b:
            s+=11
            matches.append(kw)
    if track.get("licenseVerified"):s+=8
    if track.get("hasVocals"):s+=2
    return s,matches

def stable_key(theme, track):
    raw=f"{theme}|{track.get('shareId','')}|{track.get('source','')}|{track.get('title','')}|{track.get('artist','')}"
    return hashlib.sha1(raw.encode()).hexdigest()

def main():
    index=ROOT/"index.html"
    if not index.exists():raise SystemExit("index.html not found")
    _,_,data=read_catalog(index)
    by_name={d["t"]:d for d in data}
    limited_names=set(PROFILES)

    base_drawers=[d for d in data if d["t"] not in limited_names and d.get("tracks")]
    global_pool=[]
    for d in base_drawers:
        for t in d.get("tracks",[]):
            if t.get("audioSrc"):
                global_pool.append((d["t"],t))

    report={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"limitedThemes":{}}

    for theme,p in PROFILES.items():
        if theme not in by_name:
            raise RuntimeError(f"{theme}: missing drawer in MUSIC_DATA")
        target=int(p.get("track_count",25))
        source_themes=p.get("source_themes",[])
        ranked=[]
        seen=set()

        for rank,src_name in enumerate(source_themes):
            src=by_name.get(src_name)
            if not src:continue
            for t in src.get("tracks",[]):
                identity=(t.get("source"),t.get("title"),t.get("artist"),t.get("audioSrc"))
                if identity in seen or not t.get("audioSrc"):continue
                seen.add(identity)
                s,matches=score(t,p,rank)
                ranked.append((s,stable_key(theme,t),src_name,matches,t))

        if len(ranked)<target:
            for src_name,t in global_pool:
                identity=(t.get("source"),t.get("title"),t.get("artist"),t.get("audioSrc"))
                if identity in seen:continue
                seen.add(identity)
                s,matches=score(t,p,9)
                ranked.append((s,stable_key(theme,t),src_name,matches,t))

        ranked.sort(key=lambda x:(-x[0],x[1]))
        chosen=ranked[:target]
        if len(chosen)<target:
            raise RuntimeError(f"{theme}: only {len(chosen)} usable verified source tracks")

        out=[]
        slug=p["slug"]
        for i,(s,_,src_name,matches,t) in enumerate(chosen,1):
            clone=dict(t)
            original_share=clone.get("shareId")
            original_vibe=clone.get("vibe","CC0 music")
            clone.update({
              "trackNo":i,
              "shareId":f"{slug}-{i:03d}",
              "curatedTheme":theme,
              "limitedTheme":True,
              "limitedSourceTheme":src_name,
              "limitedSourceShareId":original_share,
              "limitedCurationScore":s,
              "limitedCurationMatches":matches[:8],
              "vibe":f"{p['label']} · {original_vibe}"
            })
            out.append(clone)

        drawer=by_name[theme]
        drawer["tracks"]=out
        drawer["installPending"]=False
        drawer["targetTracks"]=target
        report["limitedThemes"][theme]={
          "kind":p.get("kind","limited"),
          "count":len(out),
          "sourceThemes":source_themes,
          "tracks":out
        }

    final=[by_name[d["t"]] for d in data]
    write_catalog(index,final)
    if (ROOT/"404.html").exists():write_catalog(ROOT/"404.html",final)
    (ROOT/"limited_theme_manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Limited theme curation complete: {len(PROFILES)} themes × 25 tracks = {sum(len(v['tracks']) for v in report['limitedThemes'].values())} placements.")

if __name__=="__main__":
    main()
