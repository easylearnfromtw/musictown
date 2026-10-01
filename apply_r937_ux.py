#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parent
css=(ROOT/"r937_ux.css").read_text(encoding="utf-8")
js=(ROOT/"r937_ux.js").read_text(encoding="utf-8")
for name in ("index.html","404.html"):
    p=ROOT/name
    text=p.read_text(encoding="utf-8")
    changed=False
    if 'id="r937-ux-layer"' not in text:
        if "</head>" not in text: raise RuntimeError(name+": missing </head>")
        text=text.replace("</head>",'<style id="r937-ux-layer">\\n'+css+'\\n</style>\\n</head>',1)
        changed=True
    if 'id="r937-ux-script"' not in text:
        if "</body>" not in text: raise RuntimeError(name+": missing </body>")
        text=text.replace("</body>",'<script id="r937-ux-script">\\n'+js+'\\n</script>\\n</body>',1)
        changed=True
    if changed:p.write_text(text,encoding="utf-8")
    print(name,"patched" if changed else "already R9.3.7")
