#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
css=(ROOT/"r937_ux.css").read_text(encoding="utf-8")
js=(ROOT/"r937_ux.js").read_text(encoding="utf-8")
for name in ("index.html","404.html"):
    p=ROOT/name
    text=p.read_text(encoding="utf-8")
    style='<style id="r937-ux-layer">\n'+css+'\n</style>'
    script='<script id="r937-ux-script">\n'+js+'\n</script>'
    if re.search(r'<style id="r937-ux-layer">[\s\S]*?</style>',text):
        text=re.sub(r'<style id="r937-ux-layer">[\s\S]*?</style>',lambda _m:style,text,count=1)
    else:
        if "</head>" not in text: raise RuntimeError(name+": missing </head>")
        text=text.replace("</head>",style+"\n</head>",1)
    if re.search(r'<script id="r937-ux-script">[\s\S]*?</script>',text):
        text=re.sub(r'<script id="r937-ux-script">[\s\S]*?</script>',lambda _m:script,text,count=1)
    else:
        if "</body>" not in text: raise RuntimeError(name+": missing </body>")
        text=text.replace("</body>",script+"\n</body>",1)
    p.write_text(text,encoding="utf-8")
    print(name,"R9.3 UX layer refreshed")

# R10: keep the Flow & Glass shell last in <head>/<body> after the R9.3 layer refresh.
try:
    sys_dont_write = __import__("sys"); sys_dont_write.dont_write_bytecode = True
    import apply_r10_ux
    for _name in ("index.html", "404.html"):
        apply_r10_ux.apply(ROOT / _name)
except FileNotFoundError:
    pass