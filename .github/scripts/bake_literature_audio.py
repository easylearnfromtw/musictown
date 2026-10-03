#!/usr/bin/env python3
"""Check every 文學 stream and repair the ones that moved.

Reads literature-catalog.js (window.MUSICETOWN_LITERATURE), asks each
Internet Archive / Wikimedia URL for its first bytes, and when a file has been
renamed inside its Internet Archive item, finds the closest .mp3 in that same
item (same recording, same licence) and writes it to literature-audio-map.js
as {shareId: url}. The player tries the map before the catalog URL.

Never swaps in a different item, so the licence of every track stays the one
written in the catalog. Report: .github/reports/literature-audio-report.json
"""
import json, re, sys, time, difflib
from pathlib import Path
from urllib.parse import unquote, quote
import requests

ROOT = Path(__file__).resolve().parents[2]
CAT = ROOT / "literature-catalog.js"
OUT = ROOT / "literature-audio-map.js"
REPORT = ROOT / ".github" / "reports" / "literature-audio-report.json"

text = CAT.read_text(encoding="utf-8")
m = re.search(r"window\.MUSICETOWN_LITERATURE\s*=\s*(\[.*\]);", text, re.S)
if not m:
    sys.exit("MUSICETOWN_LITERATURE not found")
works = json.loads(m.group(1))

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 musicetown-literature-audio/1.0 (+https://github.com)"})

def alive(url):
    for attempt in range(3):
        try:
            r = S.get(url, headers={"Range": "bytes=0-2047"}, timeout=40, allow_redirects=True, stream=True)
            ct = r.headers.get("content-type", "")
            r.close()
            if r.status_code in (200, 206) and ("audio" in ct or "octet-stream" in ct or "ogg" in ct):
                return True
            if r.status_code in (404, 410, 403):
                return False
        except requests.RequestException:
            pass
        time.sleep(2 + attempt * 3)
    return False

files_cache = {}
def ia_files(item):
    if item not in files_cache:
        try:
            r = S.get(f"https://archive.org/metadata/{item}/files", timeout=60)
            r.raise_for_status()
            files_cache[item] = [f["name"] for f in r.json().get("result", []) if f.get("name", "").lower().endswith(".mp3")]
        except Exception:
            files_cache[item] = []
        time.sleep(1)
    return files_cache[item]

def key(s):
    return re.sub(r"[^a-z0-9]+", " ", unquote(s).lower()).strip()

def repair(url):
    mm = re.match(r"https://archive\.org/download/([^/]+)/(.+)$", url)
    if not mm:
        return None
    item, path = mm.group(1), unquote(mm.group(2))
    names = ia_files(item)
    if not names:
        return None
    want = key(path)
    best = max(names, key=lambda n: difflib.SequenceMatcher(None, want, key(n)).ratio())
    score = difflib.SequenceMatcher(None, want, key(best)).ratio()
    if score < 0.82:
        return None
    cand = f"https://archive.org/download/{item}/" + "/".join(quote(p) for p in best.split("/"))
    return cand if alive(cand) else None

out, report = {}, {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "ok": 0, "repaired": [], "broken": []}
total = sum(len(w["tracks"]) for w in works)
i = 0
for w in works:
    for t in w["tracks"]:
        i += 1
        url = t["stream"]
        if alive(url):
            report["ok"] += 1
            print(f"[{i}/{total}] ok   {t['shareId']}")
            continue
        fixed = repair(url)
        if fixed:
            out[t["shareId"]] = fixed
            report["repaired"].append({"shareId": t["shareId"], "from": url, "to": fixed})
            print(f"[{i}/{total}] FIX  {t['shareId']} -> {fixed}")
        else:
            report["broken"].append({"shareId": t["shareId"], "title": t["title"], "url": url, "source": t.get("source")})
            print(f"[{i}/{total}] DEAD {t['shareId']} {url}")
        time.sleep(0.4)

OUT.write_text("/* written by .github/scripts/bake_literature_audio.py — shareId → repaired stream */\nwindow.MUSICETOWN_LITERATURE_MAP = "
               + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"ok {report['ok']} · repaired {len(report['repaired'])} · broken {len(report['broken'])} / {total}")
