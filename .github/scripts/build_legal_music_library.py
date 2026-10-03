#!/usr/bin/env python3
from __future__ import annotations
import argparse, concurrent.futures, hashlib, json, re, time
from pathlib import Path
from urllib.parse import quote_plus, urljoin
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"data"/"legal_music_library.json"
REPORT=ROOT/"data"/"legal_music_library_report.json"
NULLRIGHTS="https://nullrights.com"
UA={"User-Agent":"musicetown-legal-library/1.0 (+https://github.com/easylearnfromtw/musictown)"}
ALLOWED={"CC0 1.0 Universal","Public Domain Mark 1.0"}

def norm(s): return re.sub(r"\s+"," ",str(s or "")).strip()
def key(t): return (norm(t.get("artist")).casefold(),norm(t.get("title")).casefold(),norm(t.get("source")).casefold())
def keep(out,t):
    if t.get("license") not in ALLOWED or not t.get("title") or not t.get("source"): return
    out.setdefault(key(t),t)

def seed():
    out={}
    p=ROOT/"verified_audio_manifest.json"
    if p.exists():
        j=json.loads(p.read_text(encoding="utf-8"))
        for t in j.get("masters",[]): keep(out,{**t,"origin":"verified_audio_manifest"})
    p=ROOT/"design-src"/"src"/"literature.json"
    if p.exists():
        for w in json.loads(p.read_text(encoding="utf-8")):
            for t in w.get("tracks",[]): keep(out,{**t,"origin":"literature"})
    p=ROOT/"index.html"
    if p.exists():
        m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',p.read_text(encoding="utf-8"),re.S)
        if m:
            for d in json.loads(m.group(1)):
                for t in d.get("tracks",[]): keep(out,{**t,"origin":"catalog"})
    return out

def get(url,timeout=30):
    r=requests.get(url,headers=UA,timeout=timeout)
    r.raise_for_status(); return r

def discover():
    q=["music","ambient","folk","acoustic","rock","pop","electronic","jazz","blues","soul","funk","world","classical","dance","house","techno","reggae","punk","metal","experimental","piano","guitar","vocal","cinematic","lofi","chill","dark","happy","sad","romantic","dream","night","city","nature","meditative","traditional","orchestral","drums","synth","indie"]
    urls=[]
    for term in q:
        for page in range(1,26):
            try: h=get(f"{NULLRIGHTS}/search?q={quote_plus(term)}&page={page}",20).text
            except Exception: break
            found=re.findall(r'href=["\'](/track/[A-Za-z0-9_-]+)["\']',h)
            if not found and page>2: break
            urls.extend(urljoin(NULLRIGHTS,x) for x in found)
    return list(dict.fromkeys(urls))

def parse(url):
    try:
        soup=BeautifulSoup(get(url,35).text,"html.parser")
        txt=norm(soup.get_text(" ",strip=True)); low=txt.casefold()
        if "cc0 1.0 universal" not in low or re.search(r"ai generated\s+yes",low): return None
        h=soup.find("h1"); title=norm(h.get_text(" ",strip=True) if h else "")
        if not title:return None
        artist=""
        ma=re.search(rf'"{re.escape(title)}"\s+by\s+(.+?)\s+[—-]',txt,re.I)
        if ma: artist=norm(ma.group(1))
        if not artist:
            pos=txt.find(title); tail=txt[pos+len(title):pos+len(title)+180] if pos>=0 else ""
            artist=norm(tail.split("·")[0].strip(" -–—·")) or "Unknown artist"
        md=re.search(r"Duration\s+(\d+):(\d+)",txt,re.I)
        dur=int(md.group(1))*60+int(md.group(2)) if md else None
        if dur is not None and not 30<=dur<=1200:return None
        mg=re.search(r"Genre\s+(.+?)(?:Tags|Duration|Format|Added|AI generated|Plays|License)",txt,re.I)
        mt=re.search(r"Tags\s+(.+?)(?:Duration|Format|Added|AI generated|Plays|License)",txt,re.I)
        dl=None
        for a in soup.find_all("a",href=True):
            href=urljoin(url,a["href"]); label=norm(a.get_text(" ",strip=True)).casefold()
            if "download" in label and "/download/" in href: dl=href; break
        return {"libraryId":"nr:"+url.rstrip("/").split("/")[-1],"title":title,"artist":artist,"source":url,"download":dl,
                "license":"CC0 1.0 Universal","licenseEvidence":"Nullrights track page explicitly states CC0 1.0 Universal",
                "licenseChecked":time.strftime("%Y-%m-%d"),"genre":norm(mg.group(1))[:120] if mg else "",
                "tags":norm(mt.group(1))[:300] if mt else "","duration":dur,"hasVocals":"has vocals" in low,"origin":"nullrights"}
    except Exception:return None

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--target",type=int,default=2500); args=ap.parse_args()
    lib=seed(); candidates=discover(); before=len(lib)
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for t in ex.map(parse,candidates,chunksize=1):
            if t: keep(lib,t)
            if len(lib)>=args.target: break
    tracks=sorted(lib.values(),key=lambda x:(x.get("artist","").casefold(),x.get("title","").casefold(),x.get("source","")))[:args.target]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload={"version":"R11.4","generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"target":args.target,
             "count":len(tracks),"policy":{"acceptedLicenses":sorted(ALLOWED),"discoveredTracks":"Nullrights page must explicitly state CC0 1.0 Universal; AI-generated=Yes rejected."},"tracks":tracks}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    REPORT.write_text(json.dumps({"target":args.target,"count":len(tracks),"seedCount":before,"candidateUrls":len(candidates)},indent=2),encoding="utf-8")
    print(f"legal library {len(tracks)}/{args.target} (seed {before}, candidates {len(candidates)})")
    if len(tracks)!=args.target: raise SystemExit("target not reached")
if __name__=="__main__": main()
