#!/usr/bin/env python3
"""Inject the R10 "Flow & Glass" shell into index.html and 404.html.

r10_ux.css -> <style id="r10-ux-layer">   (last stylesheet in <head>)
r10_ux.js  -> <script id="r10-ux-script"> (last script in <body>)

Safe to run repeatedly: existing blocks are replaced in place and moved to
the end of <head>/<body> so they always win the cascade / run last.
apply_r937_ux.py calls this automatically, so the existing deploy workflow
keeps the shell in sync.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
CSS = (ROOT / "r10_ux.css").read_text(encoding="utf-8")
JS = (ROOT / "r10_ux.js").read_text(encoding="utf-8")

STYLE_RE = re.compile(r'\n?<style id="r10-ux-layer">[\s\S]*?</style>\n?')
SCRIPT_RE = re.compile(r'\n?<script id="r10-ux-script">[\s\S]*?</script>\n?')


def apply(path: Path) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    text = STYLE_RE.sub("\n", text)
    text = SCRIPT_RE.sub("\n", text)
    style = '<style id="r10-ux-layer">\n' + CSS + '\n</style>\n'
    script = '<script id="r10-ux-script">\n' + JS + '\n</script>\n'
    if "</head>" not in text or "</body>" not in text:
        raise RuntimeError(f"{path.name}: missing </head> or </body>")
    head_at = text.index("</head>")
    text = text[:head_at] + style + text[head_at:]
    body_at = text.rindex("</body>")
    text = text[:body_at] + script + text[body_at:]
    path.write_text(text, encoding="utf-8")
    try:
        import apply_citymusic_brand
        apply_citymusic_brand.apply(path)
    except FileNotFoundError:
        pass
    print(f"{path.name}: R10 Flow & Glass shell applied + CITYMUSIC brand")


def apply_core_bridge_once() -> None:
    try:
        import apply_r10_core  # module applies to index.html + 404.html on import
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    apply_core_bridge_once()
    for name in ("index.html", "404.html"):
        apply(ROOT / name)