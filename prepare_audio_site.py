#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlparse
import json
import re
import shutil
import unicodedata

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "_site"
if SITE.exists():
    shutil.rmtree(SITE)
SITE.mkdir()

for name in [
    "index.html", "404.html", ".nojekyll", "MUSIC_INSTALL_REPORT.json",
    "fresh_city_manifest.json", "theme_curation_manifest.json",
    "limited_theme_manifest.json", "limited_theme_profiles.json", "site.webmanifest",
]:
    p = ROOT / name
    if p.exists():
        shutil.copy2(p, SITE / name)

if (ROOT / "assets").is_dir():
    shutil.copytree(ROOT / "assets", SITE / "assets")

text = (ROOT / "index.html").read_text(encoding="utf-8")
m = re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n', text, re.S)
if not m:
    raise SystemExit("MUSIC_DATA not found")
data = json.loads(m.group(1))

verified_path = ROOT / "verified_audio_manifest.json"
verified = json.loads(verified_path.read_text(encoding="utf-8")) if verified_path.exists() else {"masters": []}
cache = ROOT / "_master_audio"

def norm(value):
    value = unicodedata.normalize("NFKD", str(value or "")).casefold()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()

masters_by_track = {}
for master in verified.get("masters", []):
    key = (norm(master.get("title")), norm(master.get("artist")))
    if all(key):
        masters_by_track.setdefault(key, master)

def safe_relative(src):
    raw = str(src or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme in {"http", "https"} or raw.startswith("//"):
        return None
    clean = raw.split("?", 1)[0].split("#", 1)[0].lstrip("/")
    if not clean:
        return None
    rel = Path(clean)
    if any(part in {"", ".", ".."} for part in rel.parts):
        return None
    return rel

def source_for(rel, track):
    candidates = [ROOT / rel]
    if rel.parts and rel.parts[0] == "music" and len(rel.parts) > 1:
        candidates.append(ROOT.joinpath(*rel.parts[1:]))
    else:
        candidates.append(ROOT / "music" / rel)
    for candidate in candidates:
        if candidate.is_file() and candidate.stat().st_size > 20000:
            return candidate, "direct"

    master = masters_by_track.get((norm(track.get("title")), norm(track.get("artist"))))
    if master:
        master_file = cache / f"{master.get('masterId')}.mp3"
        if master_file.is_file() and master_file.stat().st_size > 20000:
            return master_file, "master-cache"
        for target in master.get("targets", []):
            candidate = ROOT / str(target)
            if candidate.is_file() and candidate.stat().st_size > 20000:
                return candidate, "verified-target"
    return None, None

copied = 0
missing = []
methods = {}
seen = set()

for drawer in data:
    for track in drawer.get("tracks", []):
        rel = safe_relative(track.get("audioSrc"))
        if rel is None:
            continue
        rel_key = rel.as_posix()
        if rel_key in seen:
            continue
        seen.add(rel_key)

        source, method = source_for(rel, track)
        if source is None:
            missing.append({
                "theme": drawer.get("t"),
                "title": track.get("title"),
                "artist": track.get("artist"),
                "audioSrc": rel_key,
            })
            continue

        dest = SITE / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        copied += 1
        methods[method] = methods.get(method, 0) + 1

report = {
    "referencedLocalAudio": len(seen),
    "copiedLocalAudio": copied,
    "missingLocalAudio": len(missing),
    "copyMethods": methods,
    "missingSample": missing[:80],
}
(SITE / "audio_site_report.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
)

if copied == 0:
    raise SystemExit("No playable local audio was copied into the Pages artifact")

size = sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
print(f"Prepared Pages site: {size/1024/1024:.1f} MB")
print(f"Audio refs: {len(seen)}; copied: {copied}; missing: {len(missing)}; methods={methods}")
if missing:
    print("Missing audio sample:", ", ".join(x["audioSrc"] for x in missing[:12]))
if size > 1024 * 1024 * 1024:
    raise SystemExit("Pages artifact exceeds GitHub Pages 1 GB published-site limit")
