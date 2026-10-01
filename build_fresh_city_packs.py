#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, shutil, subprocess, tempfile, time, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote_plus, urljoin
import requests
import threading
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent
PROFILES=json.loads((ROOT/"fresh_city_profiles.json").read_text(encoding="utf-8"))
CACHE=ROOT/"_fresh_audio_cache"
CACHE.mkdir(parents=True,exist_ok=True)

S=requests.Session()
S.headers.update({"User-Agent":"musicetown-fresh-city-installer/8.9.0"})
NULLRIGHTS="https://nullrights.com"
TIMEOUT=20
CITY_NAMES=list(PROFILES.keys())

RATE_LOCK=threading.Lock()
LAST_REQUEST_AT=0.0
RATE_BLOCK_UNTIL=0.0
MIN_REQUEST_INTERVAL=0.18
TRACK_HTML_CACHE={}

def get(url,tries=3):
    global LAST_REQUEST_AT,RATE_BLOCK_UNTIL
    last=None
    for n in range(tries):
        # Pace all workers together so parallel parsing does not hammer Nullrights.
        with RATE_LOCK:
            now=time.monotonic()
            wait=max(0.0,RATE_BLOCK_UNTIL-now,MIN_REQUEST_INTERVAL-(now-LAST_REQUEST_AT))
            if wait>0:time.sleep(wait)
            LAST_REQUEST_AT=time.monotonic()
        try:
            r=S.get(url,timeout=TIMEOUT)
            if r.status_code==429:
                raw=r.headers.get("Retry-After","")
                try:cooldown=float(raw)
                except Exception:cooldown=min(18.0,3.5*(n+1))
                cooldown=max(2.5,min(30.0,cooldown))
                with RATE_LOCK:
                    RATE_BLOCK_UNTIL=max(RATE_BLOCK_UNTIL,time.monotonic()+cooldown)
                last=requests.HTTPError(f"429 Too Many Requests: cooling down {cooldown:.1f}s",response=r)
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last=e
            if n+1<tries:time.sleep(min(8.0,1.4*(n+1)))
    raise last
def norm(s):
    return re.sub(r"\s+"," ",str(s or "")).strip()

def track_key(title,artist):
    return f"{norm(artist).casefold()}||{norm(title).casefold()}"

def discover(query,max_pages=1):
    found=[]
    for p in range(1,max_pages+1):
        url=f"{NULLRIGHTS}/search?q={quote_plus(query)}&page={p}"
        try:h=get(url).text
        except Exception:continue
        links=re.findall(r'href=["\'](/track/[A-Za-z0-9_-]+)["\']',h)
        if not links and p>2:break
        found.extend(urljoin(NULLRIGHTS,x) for x in links)
    return list(dict.fromkeys(found))

def discover_genre(genre,max_pages=1):
    found=[]
    for p in range(1,max_pages+1):
        url=f"{NULLRIGHTS}/genre/{quote_plus(genre)}?page={p}"
        try:h=get(url).text
        except Exception:continue
        links=re.findall(r'href=["\'](/track/[A-Za-z0-9_-]+)["\']',h)
        if not links and p>2:break
        found.extend(urljoin(NULLRIGHTS,x) for x in links)
    return list(dict.fromkeys(found))

def parse_track(url, profile):
    h=TRACK_HTML_CACHE.get(url)
    if h is None:
        h=get(url).text
        TRACK_HTML_CACHE[url]=h
    soup=BeautifulSoup(h,"html.parser")
    txt=norm(soup.get_text(" ",strip=True))
    low=txt.casefold()

    # Hard legal gate; vocals can be required or merely preferred per theme.
    if "cc0 1.0 universal" not in low:return None
    has_vocals="has vocals" in low
    if profile.get("vocal_mode","required")=="required" and not has_vocals:return None
    if re.search(r"ai generated\s+yes",low):return None

    h1=soup.find("h1")
    title=norm(h1.get_text(" ",strip=True) if h1 else "")
    if not title:return None

    artist=""
    ma=re.search(rf'"{re.escape(title)}"\s+by\s+(.+?)\s+[—-]',txt,re.I)
    if ma:artist=norm(ma.group(1))
    if not artist:
        pos=txt.find(title)
        tail=txt[pos+len(title):pos+len(title)+180] if pos>=0 else ""
        artist=norm(tail.split("·")[0].strip(" -–—·"))
    if not artist:artist="Unknown artist"

    duration=None
    md=re.search(r"Duration\s+(\d+):(\d+)",txt,re.I)
    if md:duration=int(md.group(1))*60+int(md.group(2))
    if duration is not None and not (60<=duration<=600):return None

    genre=""
    mg=re.search(r"Genre\s+(.+?)(?:Tags|Duration|Format|Added|AI generated|Plays|License)",txt,re.I)
    if mg:genre=norm(mg.group(1))[:120]

    tags=""
    mt=re.search(r"Tags\s+(.+?)(?:Duration|Format|Added|AI generated|Plays|License)",txt,re.I)
    if mt:tags=norm(mt.group(1))[:260]

    sounds=""
    ms=re.search(r"Sounds like\s+(.+?)(?:Download|Embed this player|Similar tracks|What CC0 means)",txt,re.I)
    if ms:sounds=norm(ms.group(1))[:360]

    download=None
    for a in soup.find_all("a",href=True):
        label=norm(a.get_text(" ",strip=True)).casefold()
        href=urljoin(url,a["href"])
        # Accept verified extensionless Download redirect endpoints.
        if "download" in label and href.startswith(("https://","http://")):
            download=href
            break
    if not download:
        for a in soup.find_all("a",href=True):
            u=urljoin(url,a["href"])
            if re.search(r"\.(mp3|ogg|oga|flac|wav)(?:\?|$)",u,re.I):
                download=u
                break

    if not download:return None

    embed_id=url.rstrip("/").split("/")[-1]
    return {
      "title":title,"artist":artist,"genre":genre or "CC0 Music",
      "tags":tags,"sounds":sounds,"duration":duration,"hasVocals":has_vocals,
      "source":url,"embed":embed_id,"download":download,
      "license":"CC0 1.0 Universal","licenseVerified":True,
      "licenseChecked":time.strftime("%Y-%m-%d")
    }

def score(track,profile):
    blob=" ".join([track.get("genre",""),track.get("tags",""),track.get("sounds","")]).casefold()
    score=0
    matches=[]
    for kw in profile.get("keywords",[]):
        if kw.casefold() in blob:
            score+=5
            matches.append(kw)
    required=profile.get("required_any",[])
    strong=[kw for kw in required if kw.casefold() in blob]
    track["_strongHits"]=strong
    track["_matches"]=matches[:10]
    if required and not strong:score-=120
    if track.get("hasVocals"):score+=8
    for x in profile.get("reject",[]):
        if x.casefold() in blob:score-=18
    if any(x in blob for x in ["background music","podcast intro","youtube intro","corporate video","game music"]):score-=10
    return score

def direct_audio(track):
    if track.get("download"):return track["download"]
    h=get(track["source"]).text
    soup=BeautifulSoup(h,"html.parser")
    for a in soup.find_all("a",href=True):
        u=urljoin(track["source"],a["href"])
        if re.search(r"\.(mp3|ogg|oga|flac|wav)(?:\?|$)",u,re.I):
            return u
    return None

def cache_key(track):
    return hashlib.sha256(track["source"].encode()).hexdigest()[:24]

def convert_to_cache(track, bitrate):
    cache=CACHE/f"{cache_key(track)}-{bitrate}.mp3"
    if cache.exists() and cache.stat().st_size>=20000:
        return cache

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required")

    url=direct_audio(track)
    if not url:raise RuntimeError("no direct audio URL")

    with tempfile.TemporaryDirectory() as td:
        raw=Path(td)/"input"
        r=get(url,tries=3)
        with raw.open("wb") as f:
            f.write(r.content)
        if raw.stat().st_size<20000:raise RuntimeError("download too small")
        subprocess.run([
          "ffmpeg","-hide_banner","-loglevel","error","-y",
          "-i",str(raw),"-vn","-codec:a","libmp3lame",
          "-b:a",bitrate,"-map_metadata","-1",str(cache)
        ],check=True)
    if cache.stat().st_size<20000:raise RuntimeError("converted output too small")
    return cache

def read_catalog(path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
    if not m:raise RuntimeError("window.MUSIC_DATA not found")
    return text,m,json.loads(m.group(1))

def write_catalog(path,data):
    text,m,_=read_catalog(path)
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    path.write_text(text[:m.start()]+"window.MUSIC_DATA = "+js+";\n"+text[m.end():],encoding="utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--per-city",type=int,default=50)
    ap.add_argument("--bitrate",default="64k")
    ap.add_argument("--max-candidates",type=int,default=28)
    ap.add_argument("--streaming",action="store_true",help="Keep verified remote audio URLs instead of packaging MP3 files into GitHub Pages.")
    ap.add_argument("--workers",type=int,default=4)
    args=ap.parse_args()

    index=ROOT/"index.html"
    if not index.exists():
        raise SystemExit("index.html not found. Put installer files in your musicetown repo root.")

    _,_,data=read_catalog(index)
    by_name={d["t"]:d for d in data}
    catalog_fallback=[]
    for d in data:
        for src in d.get("tracks",[]):
            if not src.get("licenseVerified") or not src.get("audioSrc"):continue
            clone=dict(src)
            clone["download"]=clone.get("download") or clone.get("audioSrc")
            clone["_catalogDrawer"]=d.get("t")
            catalog_fallback.append(clone)

    # Protect the 11 already-working drawers from replacement/reuse.
    legacy_themes={"JAZZ","CROONER","ROCK","SPORT","LO-FI"}
    hard_used=set()
    for d in data:
        if d["t"] in legacy_themes:
            for t in d.get("tracks",[]):
                hard_used.add(track_key(t.get("title"),t.get("artist")))
    used=set(hard_used)

    report={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"cities":{}}

    for city in CITY_NAMES:
        profile=PROFILES[city]
        existing=list((by_name.get(city) or {}).get("tracks") or [])
        existing_ready=len(existing)>=args.per_city and all(
            bool(t.get("audioSrc")) and (
                re.match(r"^https?://",str(t.get("audioSrc"))) is not None
                or (ROOT/str(t.get("audioSrc"))).exists()
            )
            for t in existing[:args.per_city]
        )
        if existing_ready:
            print(f"\n=== {city}: preserve existing {len(existing)} playable tracks ===")
            report["cities"][city]=existing[:args.per_city]
            by_name[city]["installPending"]=False
            continue

        print(f"\n=== {city}: discovering fresh CC0 theme-fit tracks ===")

        urls=[]
        for q in profile["queries"]:urls+=discover(q)
        for g in profile["genres"]:urls+=discover_genre(g)
        urls=list(dict.fromkeys(urls))

        candidates=[]
        candidate_urls=list(urls[:args.max_candidates])

        def load_candidate(url):
            try:
                return url,parse_track(url,profile),None
            except Exception as e:
                return url,None,e

        with ThreadPoolExecutor(max_workers=max(1,args.workers)) as ex:
            futures=[ex.submit(load_candidate,url) for url in candidate_urls]
            for fut in as_completed(futures):
                url,t,err=fut.result()
                if err is not None:
                    print(" skip:",url,str(err)[:100]);continue
                if not t:continue
                k=track_key(t["title"],t["artist"])
                if k in hard_used:continue
                t["_score"]=score(t,profile)
                candidates.append(t)

        candidates.sort(
            key=lambda t:(-t["_score"],hashlib.sha1((city+t["source"]).encode()).hexdigest())
        )

        selected=[]
        selected_keys=set()

        # Pass 1: exact theme matches, unique across newly generated packs.
        for t in candidates:
            k=track_key(t["title"],t["artist"])
            if k in used:continue
            if profile.get("required_any") and not t.get("_strongHits"):continue
            if t.get("_score",0)<0:continue
            t["_curationTier"]="exact"
            selected.append(t);selected_keys.add(k);used.add(k)
            if len(selected)>=args.per_city:break

        # Pass 2: legal/theme-adjacent fallback. It may reuse tracks across NEW
        # packs, but never reuses anything from the 11 established drawers.
        if len(selected)<args.per_city:
            fallback_min_matches=int(profile.get("fallback_min_keyword_matches",1))
            fallback_min_score=float(profile.get("fallback_min_score",-112))
            for t in candidates:
                k=track_key(t["title"],t["artist"])
                if k in selected_keys or k in hard_used:continue
                matches=t.get("_matches",[])
                strong=t.get("_strongHits",[])
                if not strong and len(matches)<fallback_min_matches:continue
                if t.get("_score",0)<fallback_min_score:continue
                t["_curationTier"]="adjacent-reuse" if k in used else "adjacent"
                selected.append(t);selected_keys.add(k);used.add(k)
                if len(selected)>=args.per_city:break

        # Pass 3: Nullrights metadata can be sparse even when the result
        # came directly from this city's own theme queries / genre pages.
        # All candidates have already passed CC0, direct-audio and duration gates.
        if len(selected)<args.per_city:
            for t in candidates:
                k=track_key(t["title"],t["artist"])
                if k in selected_keys or k in hard_used:continue
                t["_curationTier"]="query-genre-fit"
                selected.append(t);selected_keys.add(k);used.add(k)
                if len(selected)>=args.per_city:break

        if len(selected)<args.per_city:
            fallback=[]
            for src in catalog_fallback:
                t=dict(src)
                k=track_key(t.get("title"),t.get("artist"))
                if k in selected_keys:continue
                try:t["_score"]=score(t,profile)
                except Exception:continue
                fallback.append(t)
            fallback.sort(key=lambda t:(-t.get("_score",0),hashlib.sha1((city+str(t.get("shareId",""))).encode()).hexdigest()))
            for t in fallback:
                k=track_key(t.get("title"),t.get("artist"))
                if k in selected_keys:continue
                t["_curationTier"]="verified-catalog-fallback"
                selected.append(t);selected_keys.add(k);used.add(k)
                if len(selected)>=args.per_city:break

        if len(selected)<args.per_city:
            raise RuntimeError(f"{city}: only {len(selected)} verified CC0 tracks available after catalog fallback")

        folder=profile["slug"]
        target_dir=ROOT/folder
        if not args.streaming:
            target_dir.mkdir(parents=True,exist_ok=True)

        out_tracks=[]
        for i,t in enumerate(selected,1):
            score_value=t.pop("_score",0)
            matches=t.pop("_matches",[])
            strong_hits=t.pop("_strongHits",[])
            tier=t.pop("_curationTier","exact")
            t["curationScore"]=score_value
            t["curationMatches"]=matches
            t["strongThemeMatches"]=strong_hits
            t["curationTier"]=tier
            t["trackNo"]=i
            t["shareId"]=f"{folder}-{i:03d}"
            t["freshCity"]=True
            t["curatedTheme"]=city
            t["vibe"]=f"{profile['label']} · {t.get('genre') or t.get('_catalogDrawer') or 'CC0 Music'}"

            print(f"  [{i:02d}/{args.per_city}] {t['artist']} — {t['title']} · {tier}")
            if args.streaming:
                t["audioSrc"]=t["download"]
                t["streamingAudio"]=True
                t["localMp3"]=False
            else:
                t["audioSrc"]=f"{folder}/{i:03d}.mp3"
                cache=convert_to_cache(t,args.bitrate)
                shutil.copy2(cache,ROOT/t["audioSrc"])
                t["localMp3"]=True
            out_tracks.append(t)

        if city not in by_name:
            raise RuntimeError(f"{city}: profile does not match a MUSIC_DATA drawer")
        by_name[city]["tracks"]=out_tracks
        by_name[city]["installPending"]=False
        report["cities"][city]=out_tracks
        if not args.streaming:
            (target_dir/"manifest.json").write_text(
                json.dumps(out_tracks,ensure_ascii=False,indent=2),encoding="utf-8"
            )

    final=[by_name[d["t"]] for d in data]
    write_catalog(index,final)
    if (ROOT/"404.html").exists():write_catalog(ROOT/"404.html",final)

    (ROOT/"fresh_city_manifest.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
    )
    mode="verified remote streams" if args.streaming else "packaged MP3"
    print(f"\nFresh city installation complete: {len(CITY_NAMES)} × {args.per_city} tracks · {mode}.")

if __name__=="__main__":
    main()
