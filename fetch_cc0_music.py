#!/usr/bin/env python3
"""
CITY SOUND ARCHIVE — CC0 music fetcher

Discovers tracks from nullrights.com, verifies the track page says CC0 1.0
Universal, optionally requires "Has vocals", downloads the source audio,
transcodes non-MP3 sources to MP3, and generates catalog.js + manifest.

This intentionally refuses tracks whose license cannot be verified.
"""
from __future__ import annotations
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.parse import quote_plus, urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parent
UA = "CitySoundArchiveCC0Fetcher/1.0 (+personal website build tool)"
S = requests.Session()
S.headers.update({"User-Agent": UA})

NULLRIGHTS = "https://nullrights.com"
FMA = "https://freemusicarchive.org"
TIMEOUT = 40

def get(url: str) -> requests.Response:
    r = S.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    return r

def unique(seq):
    out=[]; seen=set()
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

def discover_nullrights(query: str, max_pages: int = 8):
    """Return /track/<id> URLs found from search pages."""
    found=[]
    for p in range(1, max_pages+1):
        urls=[
            f"{NULLRIGHTS}/search?q={quote_plus(query)}&page={p}",
            f"{NULLRIGHTS}/search?q={quote_plus(query)}",
        ]
        got_any=False
        for u in urls[:1 if p>1 else 2]:
            try:
                h=get(u).text
            except Exception:
                continue
            links=re.findall(r'href=["\'](/track/[A-Za-z0-9_-]+)["\']', h)
            if links:
                got_any=True
                found += [urljoin(NULLRIGHTS,x) for x in links]
        if p>1 and not got_any:
            break
    return unique(found)

def parse_nullrights_track(url: str, require_vocals=True):
    h=get(url).text
    soup=BeautifulSoup(h, "html.parser")
    txt=soup.get_text(" ", strip=True)

    if "CC0 1.0 Universal" not in txt or "public domain" not in txt.lower():
        return None
    if require_vocals and "Has vocals" not in txt:
        return None

    h1=soup.find("h1")
    title=h1.get_text(" ",strip=True) if h1 else ""
    if not title:
        return None

    # Artist is usually the first meaningful text near the title; prefer meta/structured text.
    artist=""
    for selector in ['meta[name="author"]','meta[property="music:musician"]']:
        node=soup.select_one(selector)
        if node and node.get("content"):
            artist=node.get("content").strip()
            break
    if not artist:
        # Nullrights snippet structure usually renders "Artist · Album".
        raw=re.sub(r"\s+"," ",txt)
        pos=raw.find(title)
        tail=raw[pos+len(title):pos+len(title)+250] if pos>=0 else raw[:250]
        artist=tail.split("·")[0].strip(" -–—·")[:100] or "Unknown artist"

    # Tags/genre-ish metadata
    genre=""
    mg=re.search(r"Genre\s+(.+?)(?:Tags|Duration|Format|Added|License|BPM|Key|Vocals)", txt)
    if mg:
        genre=mg.group(1).strip()[:120]
    if not genre:
        genre="CC0 Vocal"

    # Direct download link from nullrights page.
    download=None
    for a in soup.find_all("a", href=True):
        label=a.get_text(" ",strip=True).lower()
        href=a["href"]
        if "download" in label:
            download=urljoin(url,href)
            break

    # Original source link for evidence/fallback.
    original=None
    for a in soup.find_all("a", href=True):
        label=a.get_text(" ",strip=True).lower()
        href=a["href"]
        if "originally published" in label or "free music archive" in label or "opengameart" in label:
            original=urljoin(url,href)
            break

    fmt=""
    mf=re.search(r"Format\s+([A-Za-z0-9]+)",txt)
    if mf: fmt=mf.group(1).upper()

    return {
        "title": title,
        "artist": artist,
        "vibe": genre,
        "license": "CC0 1.0 Universal",
        "source": url,
        "originalSource": original,
        "download": download,
        "format": fmt,
        "licenseEvidence": "Nullrights track page states CC0 1.0 Universal / public domain",
    }

def extract_fma_file_url(page_url: str):
    """FMA pages commonly embed fileUrl in their HTML."""
    h=get(page_url).text
    patterns=[
        r'fileUrl["\']?\s*:\s*["\']([^"\']+)',
        r'fileUrl\\?["\']?\s*[:=]\s*\\?["\']([^"\']+)',
        r'(https://files\.freemusicarchive\.org/storage-freemusicarchive-org/[^"\']+?\.mp3(?:\?[^"\']*)?)'
    ]
    for pat in patterns:
        m=re.search(pat,h,re.I)
        if m:
            return html.unescape(m.group(1)).replace("\\/","/")
    return None

def extract_oga_audio(page_url: str):
    h=get(page_url).text
    soup=BeautifulSoup(h,"html.parser")
    candidates=[]
    for a in soup.find_all("a",href=True):
        u=urljoin(page_url,a["href"])
        if re.search(r"\.(mp3|ogg|flac)(?:\?|$)",u,re.I):
            candidates.append(u)
    # Prefer MP3, then OGG, then FLAC.
    candidates.sort(key=lambda u: (0 if ".mp3" in u.lower() else 1 if ".ogg" in u.lower() else 2))
    return candidates[0] if candidates else None

def resolve_download(track):
    if track.get("download"):
        return track["download"]
    o=track.get("originalSource") or ""
    try:
        if "freemusicarchive.org" in o:
            return extract_fma_file_url(o)
        if "opengameart.org" in o:
            return extract_oga_audio(o)
    except Exception:
        pass
    return None

def ffmpeg_exists():
    return shutil.which("ffmpeg") is not None

def download_and_convert(url: str, dst: Path, bitrate="160k"):
    dst.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp=Path(td)/"source_audio"
        r=S.get(url,timeout=120,stream=True)
        r.raise_for_status()
        ctype=(r.headers.get("content-type") or "").lower()
        with tmp.open("wb") as f:
            for chunk in r.iter_content(1024*256):
                if chunk: f.write(chunk)
        if tmp.stat().st_size < 20_000:
            raise RuntimeError(f"Downloaded file too small ({tmp.stat().st_size} bytes)")
        # Identify mp3 via content type / URL. Even for mp3 we normalize.
        if not ffmpeg_exists():
            raise RuntimeError("ffmpeg not found; install ffmpeg")
        cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(tmp),
             "-vn","-codec:a","libmp3lame","-b:a",bitrate,"-map_metadata","-1",str(dst)]
        subprocess.run(cmd,check=True)
        if dst.stat().st_size < 20_000:
            raise RuntimeError("Converted MP3 too small")

def duration_seconds(path: Path):
    if not shutil.which("ffprobe"): return None
    try:
        p=subprocess.run(
            ["ffprobe","-v","error","-show_entries","format=duration",
             "-of","default=noprint_wrappers=1:nokey=1",str(path)],
            capture_output=True,text=True,check=True
        )
        return round(float(p.stdout.strip()),2)
    except Exception:
        return None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--per-genre",type=int,default=50)
    ap.add_argument("--bitrate",default="160k")
    ap.add_argument("--dry-run",action="store_true")
    ap.add_argument("--sleep",type=float,default=.25)
    ap.add_argument("--max-candidates",type=int,default=500)
    args=ap.parse_args()

    cfg=json.loads((ROOT/"genre_config.json").read_text(encoding="utf-8"))
    old=[]
    cat=ROOT/"catalog.js"
    if cat.exists():
        raw=cat.read_text(encoding="utf-8")
        mm=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*\]);?\s*$',raw,re.S)
        if mm: old=json.loads(mm.group(1))
    old_by_name={d["t"]:d for d in old}

    manifest={"version":"R7.1","mode":"local-mp3","generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
              "genres":[],"total_tracks":0}
    output_data=[]

    for gc in cfg["genres"]:
        name=gc["name"]; folder=gc["folder"]; need=args.per_genre
        print(f"\n=== {name} ({need}) ===")
        candidates=[]
        for q in gc["queries"]:
            print("discover:",q)
            candidates+=discover_nullrights(q)
            candidates=unique(candidates)
            if len(candidates)>=args.max_candidates: break

        selected=[]; seen_titles=set()
        for url in candidates[:args.max_candidates]:
            if len(selected)>=need: break
            try:
                t=parse_nullrights_track(url,gc.get("require_vocals",True))
                if not t: continue
                key=(t["title"].lower(),t["artist"].lower())
                if key in seen_titles: continue
                dl=resolve_download(t)
                if not dl:
                    print(" skip no direct audio:",t["title"])
                    continue
                no=len(selected)+1
                rel=f"music/{folder}/{no:03d}.mp3"
                dst=ROOT/rel
                t["audioSrc"]=rel
                t["trackNo"]=no
                t["downloadResolved"]=dl
                if args.dry_run:
                    print(" verified:",t["title"],"->",dl)
                else:
                    print(" download:",t["title"])
                    download_and_convert(dl,dst,args.bitrate)
                    t["duration"]=duration_seconds(dst)
                    t["bytes"]=dst.stat().st_size
                selected.append(t); seen_titles.add(key)
                time.sleep(args.sleep)
            except Exception as e:
                print(" skip:",url,"::",str(e)[:160])

        if len(selected)<need:
            print(f"WARNING: only {len(selected)}/{need} verified tracks found for {name}")

        meta=old_by_name.get(name,{})
        output_data.append({
            "t":name,
            "sub":meta.get("sub",gc["description"]),
            "bpm":meta.get("bpm","VOCAL"),
            "key":meta.get("key",gc["description"]),
            "meters":meta.get("meters",[["VOCAL",100],["MOOD",80],["ENERGY",60],["FOCUS",60]]),
            "tracks":selected
        })
        manifest["genres"].append({"genre":name,"folder":folder,"count":len(selected),"tracks":selected})
        manifest["total_tracks"]+=len(selected)

    (ROOT/"catalog.js").write_text(
        "window.MUSIC_DATA = "+json.dumps(output_data,ensure_ascii=False,separators=(",",":"))+";\n",
        encoding="utf-8"
    )
    (ROOT/"music_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print("\nTOTAL:",manifest["total_tracks"])
    if manifest["total_tracks"] < len(cfg["genres"])*args.per_genre:
        print("Some genres are short; rerun later or adjust genre queries.")

if __name__=="__main__":
    main()
