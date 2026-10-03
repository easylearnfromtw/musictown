#!/usr/bin/env python3
"""Assemble musicetown R11.4 into a single index.html (+404 stub, claude-interface copy).

usage: python3 build.py out_dir [catalog.json | some.html]

  From the repo root:  python3 design-src/build.py .
  The catalog is taken, in order, from the 2nd argument, from the
  window.MUSIC_DATA already inside out_dir/index.html (so a UI rebuild keeps
  whatever the CI installed), or from src/catalog.repo.json.

The catalog line is written exactly as `window.MUSIC_DATA = <json>;\n` so the
CI curation scripts (build_theme_packs.py / build_fresh_city_packs.py /
verify_music_install.py) keep finding and rewriting it.
"""
import json, re, sys, pathlib, subprocess, hashlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
CONTRACT = re.compile(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n', re.S)
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)

def load_catalog():
    cands = [pathlib.Path(sys.argv[2])] if len(sys.argv) > 2 else [out / "index.html", SRC / "catalog.repo.json"]
    for p in cands:
        if not p.exists(): continue
        text = p.read_text(encoding="utf-8")
        if p.suffix == ".json": return json.loads(text), p
        m = CONTRACT.search(text)
        if m: return json.loads(m.group(1)), p
    raise SystemExit("no catalog found (pass a catalog .json or an index.html)")

catalog, catalog_from = load_catalog()
BUILD = "R12.8 · 2026-10-03 · Reader Classics Complete"

repo_root = ROOT.parent
orig_builder = repo_root / "build_original_playlists.py"
orig_generated = repo_root / "data" / "original_playlists.generated.json"
if orig_builder.exists() and (repo_root / "data" / "legal_music_library.json").exists():
    subprocess.run([sys.executable, str(orig_builder)], cwd=repo_root, check=True)
original_playlists = json.loads(orig_generated.read_text(encoding="utf-8")) if orig_generated.exists() else []

# Full searchable/playable CITYMUS mother library.
legal_path = repo_root / "data" / "legal_music_library.json"
cjk_path = repo_root / "data" / "cjk_open_music.generated.json"
legal_payload = json.loads(legal_path.read_text(encoding="utf-8")) if legal_path.exists() else {"tracks":[]}
cjk_payload = json.loads(cjk_path.read_text(encoding="utf-8")) if cjk_path.exists() else {"tracks":[]}

def _lib_key(t):
    return str(t.get("libraryId") or t.get("masterId") or t.get("download") or t.get("source") or (str(t.get("artist",""))+"|"+str(t.get("title","")))).strip()

def _runtime_track(t, i):
    key=_lib_key(t)
    mid=str(t.get("masterId") or ("lib:"+hashlib.sha1(key.encode("utf-8")).hexdigest()[:20]))
    out={k:t.get(k) for k in ("title","artist","source","download","license","licenseEvidence","licenseChecked","genre","tags","duration","hasVocals","origin","language","culture","attribution") if t.get(k) not in (None,"")}
    out["masterId"]=mid
    out["shareId"]="library-"+str(i).zfill(4)
    out["libraryId"]=str(t.get("libraryId") or key)
    out["libraryOnly"]=True
    out["vibe"]=" · ".join(x for x in ["CITYMUS Library",str(t.get("culture") or t.get("genre") or "").strip()] if x)
    return out

runtime_library=[]; lib_seen=set()
# Reserve visible space for explicitly licensed Chinese/Japanese/Korean recordings.
for raw in list(cjk_payload.get("tracks",[]))+list(legal_payload.get("tracks",[])):
    k=_lib_key(raw).casefold()
    if not k or k in lib_seen: continue
    lib_seen.add(k)
    runtime_library.append(_runtime_track(raw,len(runtime_library)+1))
    if len(runtime_library)>=2500: break
if len(runtime_library)!=2500:
    raise SystemExit(f"CITYMUS runtime library expected 2500 tracks, got {len(runtime_library)}")
lang_counts={}
for t in runtime_library:
    x=t.get("language")
    if x:lang_counts[x]=lang_counts.get(x,0)+1
library_report={"target":2500,"count":len(runtime_library),"cjkIncluded":sum(lang_counts.values()),"languages":lang_counts,"baseLegalCount":len(legal_payload.get("tracks",[]))}
(repo_root/"CITYMUS_LIBRARY_REPORT.json").write_text(json.dumps(library_report,ensure_ascii=False,indent=2),encoding="utf-8")
(repo_root/"citymus-library.js").write_text("window.CITYMUS_LIBRARY="+json.dumps(runtime_library,ensure_ascii=False,separators=(",",":"))+";\nwindow.CITYMUS_LIBRARY_REPORT="+json.dumps(library_report,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")

css = (SRC / "styles.css").read_text(encoding="utf-8")
js_files = sorted((SRC / "js").glob("*.js"))
js = "\n".join(f"/* ---- {p.name} ---- */\n" + p.read_text(encoding="utf-8") for p in js_files)
js = js.replace("__BUILD__", BUILD)

splash = ""
sp = ROOT / "splash.json"
if sp.exists():
    for s in json.loads(sp.read_text()):
        splash += (f'<link rel="apple-touch-startup-image" href="assets/splash/{s["file"]}" '
                   f'media="(device-width: {s["dw"]}px) and (device-height: {s["dh"]}px) and (-webkit-device-pixel-ratio: {s["r"]}) and (orientation: portrait)">\n')

head = (SRC / "head.html").read_text(encoding="utf-8").replace("__BUILD__", BUILD).replace("__CSS__", css).replace("__SPLASH__", splash.strip())
body = (SRC / "body.html").read_text(encoding="utf-8")
cat = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
orig = json.dumps(original_playlists, ensure_ascii=False, separators=(",", ":"))
html = (head + body
        + '<script id="musicetown-inline-catalog">\nwindow.MUSIC_DATA = ' + cat + ';\n</script>\n'
        + '<script id="musicetown-original-playlists">\nwindow.MUSICETOWN_ORIGINALS = ' + orig + ';\n</script>\n'
        + '<script src="citymus-library.js"></script>\n'
        + '<script src="ebook-catalog.js"></script>\n'
        + '<script id="musicetown-app">\n(() => {\n\'use strict\';\n' + js + '\n})();\n</script>\n</body>\n</html>\n')

# contract check: the CI regex must capture exactly our catalog
m = CONTRACT.search(html)
assert m and json.loads(m.group(1)) == catalog, "MUSIC_DATA contract broken"

(out / "index.html").write_text(html, encoding="utf-8")
(out / "claude-interface.html").write_text(html, encoding="utf-8")
stub = """<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CITYMUS</title>
<meta name="theme-color" content="#F6F8FC">
<script>
window.MUSIC_DATA = [];
</script>
<script>
/* Unknown path on GitHub Pages: return to the app, keeping ?query and #hash. */
(function () {
  var parts = location.pathname.split('/'), base = '/';
  if (/\\.github\\.io$/.test(location.hostname) && parts.length > 2 && parts[1]) base = '/' + parts[1] + '/';
  location.replace(base + location.search + location.hash);
})();
</script>
</head>
<body style="background:#F6F8FC"></body>
</html>
"""
(out / "404.html").write_text(stub, encoding="utf-8")

# literature catalog (kept out of MUSIC_DATA so the CI's 26-theme checks stay intact)
lit = json.loads((SRC / "literature.json").read_text(encoding="utf-8"))
(out / "literature-catalog.js").write_text("/* musicetown · 文學 · generated by tools/lit_build.py */\nwindow.MUSICETOWN_LITERATURE = " + json.dumps(lit, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
amap = out / "literature-audio-map.js"
if not amap.exists():
    amap.write_text("/* filled by .github/workflows/bake-literature-audio.yml when a source moves */\nwindow.MUSICETOWN_LITERATURE_MAP = {};\n", encoding="utf-8")
(out / "sw.js").write_text((SRC / "sw.js").read_text(encoding="utf-8").replace("__BUILD__", BUILD.split(" ")[0] + "-" + BUILD.split(" · ")[1]), encoding="utf-8")
n = sum(len(d.get("tracks", [])) for d in catalog)
print(f"built {out/'index.html'}  {len(html)/1024:.0f} KB  (js {len(js)/1024:.0f} KB, css {len(css)/1024:.0f} KB) · catalog {len(catalog)} themes / {n} tracks from {catalog_from}")
