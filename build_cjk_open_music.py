#!/usr/bin/env python3
"""Build a large, explicitly licensed Japanese / Chinese open-music supplement.

Policy:
- Only files/items with explicit Public Domain, CC0, CC BY, or CC BY-SA metadata.
- No CC BY-NC / NC-SA / ND / "all rights reserved".
- No AI-generated source is intentionally collected.
- Prefer song/vocal/traditional-music material, then fill with clearly music-tagged
  recordings when needed to reach the requested count.
- Preserve source, license URL/evidence and attribution in every runtime track.

Sources:
1) Wikimedia Commons (file-level license metadata).
2) Internet Archive (item-level explicit license URL + audio-file metadata).

This is designed for CI; it stops as soon as each language target is reached.
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, html, json, re, time
from pathlib import Path
from urllib.parse import quote
import requests

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"data"/"cjk_open_music.generated.json"
REPORT=ROOT/"data"/"cjk_open_music_report.json"
COMMONS="https://commons.wikimedia.org/w/api.php"
ARCHIVE_SEARCH="https://archive.org/advancedsearch.php"
ARCHIVE_META="https://archive.org/metadata/"
UA={"User-Agent":"CITYMUS-open-music/16.4-fast (+https://github.com/easylearnfromtw/musictown)"}
AUDIO_EXT=(".ogg",".oga",".wav",".flac",".mp3",".opus",".m4a",".aac")
REJECT_WORDS=("speech","spoken","pronunciation","interview","podcast","audiobook","lecture","news",
              "time signal","alarm","sirens","sound effect","field recording","wikitongues","voice sample")

COMMONS_CATS={
 "ja":[
   "Category:Audio files of songs of Japan","Category:Songs of Japan","Category:Folk songs of Japan",
   "Category:Japanese folk songs","Category:Traditional music of Japan","Category:Music of Japan",
   "Category:Audio files of music of Japan","Category:Japanese songs",
 ],
 "zh":[
   "Category:Songs of China","Category:Songs of Taiwan","Category:Folk songs of China",
   "Category:Folk songs of Taiwan","Category:Chinese folk songs","Category:Music of China",
   "Category:Music of Taiwan","Category:Audio files of music of China","Category:Chinese songs",
 ],
}
COMMONS_SEARCH={
 "ja":["Japanese song","Japanese music","日本 歌","日本 音楽","民謡 日本","唱歌 日本","童謡 日本","和歌 音楽"],
 "zh":["Chinese song","Chinese music","Taiwanese song","Mandarin song","Cantonese song","中國 歌曲","中国 歌曲",
       "台灣 歌曲","台湾 歌曲","華語 歌曲","华语 歌曲","民歌 中國","民歌 台湾"],
}
IA_QUERIES={
 "ja":[
   'mediatype:audio AND (language:jpn OR language:Japanese OR language:ja)',
   'mediatype:audio AND collection:opensource_audio AND (subject:Japanese OR title:Japanese)',
   'mediatype:audio AND collection:community_audio AND (subject:Japanese OR title:Japanese)',
   'mediatype:audio AND collection:georgeblood AND (language:jpn OR subject:Japanese OR title:Japanese)',
 ],
 "zh":[
   'mediatype:audio AND (language:chi OR language:zho OR language:Chinese OR language:zh OR language:Mandarin OR language:Cantonese)',
   'mediatype:audio AND collection:opensource_audio AND (subject:Chinese OR subject:Taiwanese OR title:Chinese)',
   'mediatype:audio AND collection:community_audio AND (subject:Chinese OR subject:Taiwanese OR title:Chinese)',
   'mediatype:audio AND collection:georgeblood AND (language:chi OR language:zho OR subject:Chinese OR title:Chinese)',
 ],
}

def clean(s):
    s=re.sub(r"<[^>]+>"," ",html.unescape(str(s or "")))
    return re.sub(r"\s+"," ",s).strip()

def safe_get(url, *, params=None, timeout=35):
    r=requests.get(url,params=params,headers=UA,timeout=timeout)
    r.raise_for_status()
    return r

def commons_api(params):
    return safe_get(COMMONS,params={"format":"json","formatversion":"2",**params},timeout=40).json()

def license_from_text(name="", url=""):
    x=(clean(name)+" "+clean(url)).casefold()
    if "publicdomain/zero" in x or re.search(r"\bcc0\b",x): return ("CC0 1.0 Universal", clean(url))
    if "publicdomain/mark" in x or "public domain mark" in x: return ("Public Domain Mark 1.0", clean(url))
    if "public domain" in x and "creative commons" not in x: return ("Public Domain", clean(url))
    if re.search(r"/licenses/by-sa/",x) or "cc by-sa" in x or "cc-by-sa" in x: return ("CC BY-SA", clean(url))
    if re.search(r"/licenses/by/",x) or re.search(r"\bcc by\b",x) or "cc-by " in x: return ("CC BY", clean(url))
    return (None,None)

def rejects(blob):
    x=clean(blob).casefold()
    return any(w in x for w in REJECT_WORDS)

def infer_vocals(blob):
    x=clean(blob).casefold()
    yes=("song","songs","vocal","singing","singer","choir","choral","chant","opera","歌","唱","歌曲","民歌","民謡","童謡","童谣","聲樂","声乐","吟唱")
    no=("instrumental","solo piano","soundscape","field recording")
    if any(w in x for w in no): return False
    if any(w in x for w in yes): return True
    return None

def language_blob_ok(blob, lang):
    x=clean(blob).casefold()
    if lang=="ja":
        return bool(re.search(r"[ぁ-ゖァ-ヺ一-龯]",blob)) or any(w in x for w in ("japan","japanese","日本","nihon","nippon"))
    return bool(re.search(r"[\u3400-\u9fff]",blob)) or any(w in x for w in ("china","chinese","taiwan","taiwanese","mandarin","cantonese","中國","中国","台灣","台湾","華語","华语"))

def commons_category_files(cat, depth=2, seen=None, cap=4500):
    seen=seen or set()
    if cat in seen:return []
    seen.add(cat); out=[]; cont=None
    while True:
        p={"action":"query","list":"categorymembers","cmtitle":cat,"cmlimit":"500","cmtype":"file|subcat"}
        if cont:p["cmcontinue"]=cont
        try:j=commons_api(p)
        except Exception:return out
        for row in j.get("query",{}).get("categorymembers",[]):
            title=row.get("title","")
            if row.get("ns")==6: out.append(title)
            elif row.get("ns")==14 and depth>0 and len(out)<cap:
                out.extend(commons_category_files(title,depth-1,seen,cap))
            if len(out)>=cap:return list(dict.fromkeys(out))
        cont=j.get("continue",{}).get("cmcontinue")
        if not cont:break
    return list(dict.fromkeys(out))

def commons_search(term, cap=900):
    out=[]; off=None
    while len(out)<cap:
        p={"action":"query","list":"search","srsearch":term+" filetype:audio","srnamespace":"6","srlimit":"500"}
        if off:p["sroffset"]=off
        try:j=commons_api(p)
        except Exception:break
        out.extend(x.get("title","") for x in j.get("query",{}).get("search",[]) if x.get("title"))
        off=j.get("continue",{}).get("sroffset")
        if off is None:break
    return list(dict.fromkeys(out))

def chunks(a,n=40):
    for i in range(0,len(a),n):yield a[i:i+n]

def commons_info(titles,lang):
    out=[]
    for batch in chunks(titles):
        try:
            j=commons_api({"action":"query","prop":"imageinfo","titles":"|".join(batch),"iiprop":"url|mime|size|extmetadata|metadata"})
        except Exception: continue
        for page in j.get("query",{}).get("pages",[]):
            ii=(page.get("imageinfo") or [{}])[0]; mime=str(ii.get("mime") or "")
            title=page.get("title","")
            if not mime.startswith("audio/") or not title.casefold().endswith(AUDIO_EXT):continue
            if int(ii.get("size") or 0)<250000:continue
            ext=ii.get("extmetadata") or {}
            val=lambda k: clean((ext.get(k) or {}).get("value",""))
            lic_name=val("LicenseShortName"); lic_url=val("LicenseUrl")
            lic,_=license_from_text(lic_name,lic_url)
            if not lic:continue
            desc=" ".join([val("ObjectName"),val("ImageDescription"),val("Categories"),title])
            if rejects(desc) or not language_blob_ok(desc,lang):continue
            md={str(x.get("name","")).casefold():x.get("value") for x in (ii.get("metadata") or [])}
            dur=None
            for key in ("length","duration"):
                try:
                    if md.get(key) is not None:dur=float(md[key]); break
                except Exception:pass
            if dur is not None and not 35<=dur<=1800:continue
            artist=val("Artist") or val("Credit") or "Wikimedia Commons contributor"
            obj=val("ObjectName") or re.sub(r"^File:","",title,flags=re.I)
            source=ii.get("descriptionurl") or ""
            download=ii.get("url") or ""
            lid="commons:"+hashlib.sha1(title.encode("utf-8")).hexdigest()[:20]
            out.append({
              "libraryId":lid,"title":clean(obj)[:220],"artist":artist[:220],
              "source":source,"download":download,"license":lic,"licenseUrl":lic_url,
              "licenseEvidence":"Wikimedia Commons file metadata explicitly reports "+(lic_name or lic),
              "licenseChecked":time.strftime("%Y-%m-%d"),"duration":round(dur) if dur else None,
              "genre":"Open music","tags":clean(desc)[:420],"origin":"wikimedia-commons",
              "hasVocals":infer_vocals(desc),"language":lang,"culture":"日本音樂" if lang=="ja" else "華語／華人音樂",
              "attribution":f"{artist} · {lic} · Wikimedia Commons",
              "languageEvidence":"Commons category/search metadata identifies Japanese/Japan music" if lang=="ja" else "Commons category/search metadata identifies Chinese/Taiwan music",
            })
    return out

def archive_search(query, max_items=5000):
    out=[]; page=1
    while len(out)<max_items and page<=40:
        params={"q":query,"fl[]":["identifier","title","creator","licenseurl","rights","language","subject"],"rows":"200","page":str(page),"output":"json"}
        try:j=safe_get(ARCHIVE_SEARCH,params=params,timeout=45).json()
        except Exception:break
        docs=j.get("response",{}).get("docs",[])
        if not docs:break
        out.extend(docs); page+=1
        if len(docs)<200:break
    return out[:max_items]

def norm_list(v):
    if isinstance(v,list):return [clean(x) for x in v]
    return [clean(v)] if clean(v) else []

def archive_item(doc,lang):
    ident=clean(doc.get("identifier"))
    if not ident:return []
    try:j=safe_get(ARCHIVE_META+quote(ident,safe=""),timeout=45).json()
    except Exception:return []
    md=j.get("metadata") or {}
    lic_url=clean(md.get("licenseurl") or doc.get("licenseurl"))
    rights=clean(md.get("rights") or doc.get("rights"))
    lic,_=license_from_text(rights,lic_url)
    if not lic:return []
    langs=" ".join(norm_list(md.get("language") or doc.get("language")))
    subject=" ".join(norm_list(md.get("subject") or doc.get("subject")))
    title=clean(md.get("title") or doc.get("title") or ident)
    creator="; ".join(norm_list(md.get("creator") or doc.get("creator"))) or "Internet Archive contributor"
    evidence_blob=" ".join([langs,subject,title,creator])
    if rejects(evidence_blob):return []
    if lang=="ja":
        if not any(w in langs.casefold() for w in ("jpn","japanese"," ja","japan")) and not language_blob_ok(evidence_blob,"ja"):return []
    else:
        if not any(w in langs.casefold() for w in ("chi","zho","chinese","mandarin","cantonese"," zh","taiwan")) and not language_blob_ok(evidence_blob,"zh"):return []
    # Search query already requires music/song; enforce again on item metadata.
    low=(subject+" "+title).casefold()
    if not any(w in low for w in ("music","song","songs","folk","album","唱","歌","音樂","音乐","民謡","民谣","民歌")):return []

    files=j.get("files") or []
    rows=[]
    seen_base=set()
    for f in files:
        name=clean(f.get("name")); lowname=name.casefold()
        if not name or not lowname.endswith(AUDIO_EXT):continue
        fmt=clean(f.get("format")).casefold()
        if not any(w in fmt for w in ("mp3","mpeg","ogg","vorbis","flac","wave","wav","opus","aac","m4a")):continue
        # Prefer originals. IA derivatives often point back to an original file.
        source=clean(f.get("source")).casefold()
        if source and source not in ("original",""):continue
        length=f.get("length") or f.get("duration")
        dur=None
        try:
            if length is not None:
                if isinstance(length,str) and ":" in length:
                    parts=[float(x) for x in length.split(":")]
                    dur=sum(x*(60**i) for i,x in enumerate(reversed(parts)))
                else: dur=float(length)
        except Exception:pass
        if dur is not None and not 35<=dur<=1800:continue
        base=re.sub(r"\.(mp3|ogg|oga|flac|wav|opus|m4a|aac)$","",lowname)
        if base in seen_base:continue
        seen_base.add(base)
        track_title=clean(f.get("title") or f.get("track") or Path(name).stem)
        if rejects(track_title):continue
        dl=f"https://archive.org/download/{quote(ident,safe='')}/{quote(name,safe='/')}"
        rows.append({
          "libraryId":"ia:"+hashlib.sha1((ident+"|"+name).encode("utf-8")).hexdigest()[:22],
          "title":track_title[:220],"artist":clean(f.get("artist") or creator)[:220],
          "source":f"https://archive.org/details/{quote(ident,safe='')}",
          "download":dl,"license":lic,"licenseUrl":lic_url,
          "licenseEvidence":"Internet Archive item metadata explicitly provides "+(lic_url or rights),
          "licenseChecked":time.strftime("%Y-%m-%d"),"duration":round(dur) if dur else None,
          "genre":"Open music","tags":clean(subject)[:420],"origin":"internet-archive",
          "hasVocals":infer_vocals(" ".join([subject,track_title,creator])),"language":lang,"culture":"日本音樂" if lang=="ja" else "華語／華人音樂",
          "attribution":f"{clean(f.get('artist') or creator)} · {lic} · Internet Archive",
          "languageEvidence":"Internet Archive item language/subject metadata: "+clean(langs or subject)[:180],
        })
    return rows

def track_key(t):
    return (clean(t.get("download") or t.get("source")).casefold(), clean(t.get("title")).casefold(), clean(t.get("artist")).casefold())

def score(t,lang):
    blob=" ".join(clean(t.get(k)) for k in ("title","artist","tags","languageEvidence")).casefold()
    s=0
    if any(w in blob for w in ("song","songs","folk","vocal","sing","歌","唱","民謡","民歌","童謡","童谣")):s+=8
    if t.get("origin")=="wikimedia-commons":s+=2
    if t.get("duration") and 80<=t["duration"]<=480:s+=2
    if lang=="ja" and any(w in blob for w in ("日本","japanese","japan","民謡")):s+=4
    if lang=="zh" and any(w in blob for w in ("中國","中国","台灣","台湾","chinese","taiwan","mandarin","cantonese","華語","华语")):s+=4
    if rejects(blob):s-=50
    return s

def collect(lang,target):
    seen={}
    # Internet Archive first: one licensed album/item can contribute many tracks,
    # so this reaches 1000 far faster than crawling a deep Commons category tree.
    docs=[]
    for q in IA_QUERIES[lang]:
        docs.extend(archive_search(q,2200))
    uniq={clean(d.get("identifier")):d for d in docs if clean(d.get("identifier"))}
    items=list(uniq.values())
    print(lang,"Internet Archive candidate items",len(items),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=22) as ex:
        for i in range(0,len(items),120):
            futs=[ex.submit(archive_item,d,lang) for d in items[i:i+120]]
            for fut in concurrent.futures.as_completed(futs):
                try:rows=fut.result()
                except Exception:rows=[]
                for t in rows:seen.setdefault(track_key(t),t)
            print(lang,"IA accepted",len(seen),"/",target,flush=True)
            if len(seen)>=target+160:break

    # Commons is the high-confidence supplement/fallback and also improves
    # cultural coverage. Keep its crawl bounded so the deployment stays fast.
    if len(seen)<target+80:
        commons_titles=[]
        for cat in COMMONS_CATS[lang]:
            commons_titles.extend(commons_category_files(cat,2,cap=4500))
            if len(set(commons_titles))>=6500:break
        for term in COMMONS_SEARCH[lang]:
            commons_titles.extend(commons_search(term,900))
        commons_titles=list(dict.fromkeys(commons_titles))[:9000]
        print(lang,"Commons candidates",len(commons_titles),flush=True)
        for t in commons_info(commons_titles,lang):
            seen.setdefault(track_key(t),t)
        print(lang,"total accepted",len(seen),"/",target,flush=True)

    rows=sorted(seen.values(),key=lambda t:(-score(t,lang),clean(t.get("artist")).casefold(),clean(t.get("title")).casefold()))
    return rows[:target]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--per-language",type=int,default=1000)
    ap.add_argument("--max-per-language",type=int,default=None,help="legacy alias")
    ap.add_argument("--max-total",type=int,default=None)
    a=ap.parse_args()
    target=a.max_per_language or a.per_language
    by={}
    allrows=[]
    for lang in ("ja","zh"):
        rows=collect(lang,target)
        by[lang]=len(rows); allrows.extend(rows)
    if by["ja"]<target or by["zh"]<target:
        raise SystemExit(f"CJK target not reached: {by}, requested {target} each")
    allrows=allrows[: (a.max_total or target*2)]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload={
      "version":"R16.4","generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
      "count":len(allrows),"targets":{"ja":target,"zh":target},"languages":by,
      "policy":{"acceptedLicenses":["Public Domain","Public Domain Mark","CC0","CC BY","CC BY-SA"],
                "rejected":["CC BY-NC","CC BY-ND","all rights reserved","unknown license"],
                "sources":["Wikimedia Commons","Internet Archive"],
                "note":"Every admitted track retains source, license evidence and attribution metadata."},
      "tracks":allrows
    }
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
    REPORT.write_text(json.dumps({"targetPerLanguage":target,"count":len(allrows),"byLanguage":by,"policy":payload["policy"]},ensure_ascii=False,indent=2),encoding="utf-8")
    print("CJK open music ready:",len(allrows),by,flush=True)

if __name__=="__main__":main()
