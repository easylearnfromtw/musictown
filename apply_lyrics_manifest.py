#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parent
MANIFEST=ROOT/"lyrics_manifest.json"
if not MANIFEST.exists():
    raise SystemExit("lyrics_manifest.json not found")

lyrics=json.loads(MANIFEST.read_text(encoding="utf-8"))
masters=lyrics.get("masters") or {}

def patch(path:Path):
    text=path.read_text(encoding="utf-8")
    m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n</script>',text,re.S)
    if not m: raise RuntimeError(f"{path.name}: MUSIC_DATA not found")
    data=json.loads(m.group(1))
    applied=0;unavailable=0
    for drawer in data:
        for track in drawer.get("tracks",[]):
            mid=str(track.get("masterId") or "")
            item=masters.get(mid)
            track.pop("lyrics",None);track.pop("lyric",None);track.pop("lrc",None)
            track.pop("syncedLyrics",None)
            track.pop("lyricsSource",None);track.pop("lyricsLanguage",None);track.pop("lyricsModel",None)
            if not item: continue
            if item.get("status")=="transcribed" and item.get("syncedLyrics"):
                track["syncedLyrics"]=item["syncedLyrics"]
                track["lyricsSource"]="audio-transcription"
                track["lyricsLanguage"]=item.get("language")
                track["lyricsModel"]=item.get("model")
                applied+=1
            elif item.get("status")=="no_speech":
                track["lyricsUnavailableReason"]="no-speech-detected"
                unavailable+=1
    js=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    new=text[:m.start()]+"window.MUSIC_DATA = "+js+";\n</script>"+text[m.end():]
    path.write_text(new,encoding="utf-8")
    print(path.name,"lyrics placements:",applied,"no-speech placements:",unavailable)

for name in ("index.html","404.html"):
    p=ROOT/name
    if p.exists():patch(p)
