#!/usr/bin/env python3
"""Collect a small, attribution-preserving CJK open-music supplement from Wikimedia Commons.

Only audio files whose Commons metadata explicitly reports Public Domain, CC0,
CC BY, or CC BY-SA are admitted. This does not replace the 2500-track legal
mother library; build.py blends these verified CJK recordings into the final
2500-track CITYMUS library while keeping the total fixed.
"""
from __future__ import annotations
import argparse, html, json, re, time
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"data"/"cjk_open_music.generated.json"
REPORT=ROOT/"data"/"cjk_open_music_report.json"
API="https://commons.wikimedia.org/w/api.php"
UA={"User-Agent":"CITYMUS-open-music/12.2 (+https://github.com/easylearnfromtw/musictown)"}

SOURCES={
  "zh":[
    "Category:Audio files of music of China",
    "Category:Songs of China",
    "Category:Songs of Taiwan",
    "Category:Folk music of Taiwan",
  ],
  "ja":[
    "Category:Audio files of music of Japan",
    "Category:Audio files of songs of Japan",
    "Category:Songs of Japan",
  ],
  "ko":[
    "Category:Songs of South Korea",
    "Category:Trot (music)",
    "Category:National Gugak Center",
    "Category:Music of South Korea",
  ],
}
ALLOWED_PREFIXES=("public domain","cc0","cc by ","cc-by ","cc by-sa","cc-by-sa")
AUDIO_EXT=(".ogg",".oga",".wav",".flac",".mp3",".opus",".m4a")

def clean(s):
    s=re.sub(r"<[^>]+>"," ",html.unescape(str(s or "")))
    return re.sub(r"\s+"," ",s).strip()

def api(params, timeout=35):
    q={"format":"json","formatversion":"2",**params}
    r=requests.get(API,params=q,headers=UA,timeout=timeout)
    r.raise_for_status()
    return r.json()

def category_files(cat, depth=1, seen=None):
    seen=seen or set()
    if cat in seen:return []
    seen.add(cat); out=[]; cont=None
    while True:
        p={"action":"query","list":"categorymembers","cmtitle":cat,"cmlimit":"200","cmtype":"file|subcat"}
        if cont:p["cmcontinue"]=cont
        j=api(p)
        rows=j.get("query",{}).get("categorymembers",[])
        for row in rows:
            title=row.get("title","")
            if row.get("ns")==6:out.append(title)
            elif row.get("ns")==14 and depth>0:
                out.extend(category_files(title,depth-1,seen))
        cont=j.get("continue",{}).get("cmcontinue")
        if not cont:break
        if len(out)>500:break
    return list(dict.fromkeys(out))

def chunks(a,n=40):
    for i in range(0,len(a),n):yield a[i:i+n]

def meta_value(ext,key):
    v=(ext.get(key) or {}).get("value","")
    return clean(v)

def allowed(lic):
    x=clean(lic).casefold()
    return any(x.startswith(p) or p in x for p in ALLOWED_PREFIXES)

def info(titles):
    out=[]
    for batch in chunks(titles):
        j=api({"action":"query","prop":"imageinfo","titles":"|".join(batch),"iiprop":"url|mime|size|extmetadata|metadata"})
        for page in j.get("query",{}).get("pages",[]):
            ii=(page.get("imageinfo") or [{}])[0]; mime=str(ii.get("mime") or "")
            if not mime.startswith("audio/"):continue
            title=page.get("title","")
            if not title.casefold().endswith(AUDIO_EXT):continue
            if int(ii.get("size") or 0)<300000:continue
            ext=ii.get("extmetadata") or {}; lic=meta_value(ext,"LicenseShortName")
            if not allowed(lic):continue
            md={str(x.get("name","")).casefold():x.get("value") for x in (ii.get("metadata") or [])}
            dur=None
            for key in ("length","duration"):
                try:
                    if md.get(key) is not None:dur=float(md[key])
                except Exception:pass
            if dur is not None and dur<40:continue
            artist=meta_value(ext,"Artist") or meta_value(ext,"Credit") or "Wikimedia Commons contributor"
            obj=meta_value(ext,"ObjectName")
            name=clean(obj) or re.sub(r"^File:","",title,flags=re.I)
            desc=meta_value(ext,"ImageDescription") or meta_value(ext,"Categories")
            out.append({
              "title":name[:180],"artist":artist[:180],"source":ii.get("descriptionurl") or "",
              "download":ii.get("url") or "","license":lic[:80],
              "licenseEvidence":"Wikimedia Commons file metadata explicitly reports "+lic,
              "licenseChecked":time.strftime("%Y-%m-%d"),"duration":round(dur) if dur else None,
              "genre":"CJK open music","tags":desc[:360],"origin":"wikimedia-commons",
              "commonsTitle":title,
            })
    return out

def score(t,lang):
    blob=(t.get("title","")+" "+t.get("tags","")).casefold()
    s=0
    for w in ["song","music","folk","anthem","traditional","opera","koto","gagok","gugak","trot","民謠","民歌","歌曲","音樂","歌","唱","演奏","日本","한국","노래"]:
        if w.casefold() in blob:s+=2
    if any(x in blob for x in ["pronunciation","speech","interview","ident","time signal","alarm"]):s-=12
    if lang=="ja" and any(x in blob for x in ["japan","japanese","日本","歌"]):s+=3
    if lang=="zh" and any(x in blob for x in ["china","chinese","taiwan","中國","中国","台灣","台湾","民歌"]):s+=3
    if lang=="ko" and any(x in blob for x in ["korea","korean","한국","대한민국","gugak","trot"]):s+=3
    return s

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--max-per-language",type=int,default=24)
    ap.add_argument("--max-total",type=int,default=60)
    a=ap.parse_args()
    chosen=[]; by_lang={}
    for lang,cats in SOURCES.items():
        titles=[]
        for cat in cats:
            try:titles.extend(category_files(cat,1))
            except Exception as e:print("commons category warning:",cat,str(e)[:120],flush=True)
        rows=[]
        try:rows=info(list(dict.fromkeys(titles)))
        except Exception as e:print("commons metadata warning:",lang,str(e)[:120],flush=True)
        rows.sort(key=lambda t:(-score(t,lang),t.get("title","").casefold()))
        kept=[]; seen=set()
        for t in rows:
            if score(t,lang)<0:continue
            k=(t.get("download") or t.get("source") or t.get("title","")).casefold()
            if not k or k in seen:continue
            seen.add(k); t["language"]=lang
            t["culture"]={"zh":"華語／華人音樂","ja":"日本音樂","ko":"韓國音樂"}[lang]
            t["libraryId"]="commons:"+re.sub(r"[^a-z0-9]+","-",t["commonsTitle"].casefold()).strip("-")[:120]
            kept.append(t)
            if len(kept)>=a.max_per_language:break
        by_lang[lang]=len(kept); chosen.extend(kept)
    # Interleave languages instead of letting the largest category dominate.
    groups={k:[x for x in chosen if x.get("language")==k] for k in ("zh","ja","ko")}
    merged=[]
    while len(merged)<a.max_total and any(groups.values()):
        for k in ("zh","ja","ko"):
            if groups[k] and len(merged)<a.max_total:merged.append(groups[k].pop(0))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"count":len(merged),"tracks":merged},ensure_ascii=False,indent=2),encoding="utf-8")
    REPORT.write_text(json.dumps({"count":len(merged),"byLanguage":by_lang,"acceptedLicenses":["Public Domain","CC0","CC BY","CC BY-SA"]},ensure_ascii=False,indent=2),encoding="utf-8")
    print("CJK open music:",len(merged),by_lang,flush=True)

if __name__=="__main__":main()
