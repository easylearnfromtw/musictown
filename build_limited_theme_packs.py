#!/usr/bin/env python3
from __future__ import annotations
import json,re,hashlib,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PROFILES=json.loads((ROOT/"limited_theme_profiles.json").read_text(encoding="utf-8"))
CORE5=("JAZZ","CROONER","ROCK","SPORT","LO-FI")
POOL_MULTIPLIER=3
def read_catalog(path):
    text=path.read_text(encoding="utf-8");m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:raise RuntimeError("window.MUSIC_DATA not found")
    return text,m,json.loads(m.group(1))
def write_catalog(path,data):
    text,m,_=read_catalog(path);js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")
def blob(t):return " ".join(str(t.get(k,"") or "") for k in ("title","artist","genre","tags","sounds","vibe","curatedTheme")).casefold()
def score(t,p,rank):
    b=blob(t);s=max(-40,120-rank*14);matches=[]
    for kw in p.get("keywords",[]):
        if str(kw).casefold() in b:s+=11;matches.append(kw)
    if t.get("licenseVerified"):s+=8
    if t.get("hasVocals"):s+=2
    return s,matches
def stable_key(theme,ref):return hashlib.sha1(f"{theme}|{ref}".encode()).hexdigest()
def main():
    index=ROOT/"index.html";_,_,data=read_catalog(index);by_name={d["t"]:d for d in data};masters={}
    for name in CORE5:
        d=by_name.get(name)
        if not d:raise RuntimeError(f"{name}: missing base master drawer")
        for i,t in enumerate(d.get("tracks",[])[:50]):
            ref=str(t.get("masterRef") or f"{name}:{i}");t["masterRef"]=ref;masters[ref]=dict(t)
    if len(masters)!=250:raise RuntimeError(f"expected 250 base masters, found {len(masters)}")
    report={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"limitedThemes":{}}
    for theme,p in PROFILES.items():
        drawer=by_name.get(theme)
        if not drawer:raise RuntimeError(f"{theme}: missing drawer")
        visible=int(p.get("track_count",25));pool_target=visible*POOL_MULTIPLIER;ranked=[];seen=set()
        def add_ref(ref,src_name,rank):
            ref=str(ref or "")
            if not ref or ref in seen or ref not in masters:return
            seen.add(ref);t=masters[ref];s,matches=score(t,p,rank)
            ranked.append((s,stable_key(theme,ref),src_name,ref,matches,t))
        for rank,src_name in enumerate(p.get("source_themes",[])):
            src=by_name.get(src_name)
            if not src:continue
            for e in src.get("poolRefs") or []:add_ref(e.get("r"),src_name,rank)
        for ref in sorted(masters):add_ref(ref,ref.split(":",1)[0],9)
        ranked.sort(key=lambda x:(-x[0],x[1]));chosen=ranked[:pool_target]
        if len(chosen)<pool_target:raise RuntimeError(f"{theme}: only {len(chosen)}/{pool_target} pool tracks")
        refs=[];out=[];slug=p["slug"]
        for i,(s,_,src_name,ref,matches,t) in enumerate(chosen,1):
            sid=f"{slug}-{i:03d}";refs.append({"r":ref,"q":round(float(s),2),"src":src_name,"id":sid})
            if i<=visible:
                x=dict(t);x.update({"trackNo":i,"shareId":sid,"masterRef":ref,"curatedTheme":theme,"limitedTheme":True,
                  "limitedSourceTheme":src_name,"limitedSourceShareId":t.get("shareId"),"limitedCurationScore":round(float(s),2),
                  "limitedCurationMatches":matches[:8],"vibe":f"{p['label']} · {t.get('genre') or t.get('vibe') or 'CC0 music'}"})
                out.append(x)
        drawer["tracks"]=out;drawer["poolRefs"]=refs;drawer["poolSize"]=len(refs);drawer["installPending"]=False;drawer["targetTracks"]=visible
        report["limitedThemes"][theme]={"kind":p.get("kind","limited"),"count":len(out),"poolSize":len(refs),"sourceThemes":p.get("source_themes",[]),"tracks":out}
    final=[by_name[d["t"]] for d in data];write_catalog(index,final)
    if (ROOT/"404.html").exists():write_catalog(ROOT/"404.html",final)
    (ROOT/"limited_theme_manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Limited 3x pools ready: {len(PROFILES)} themes · 25 visible / 75 searchable.")
if __name__=="__main__":main()
