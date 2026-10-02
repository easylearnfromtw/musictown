#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
META_START="<!-- CITYMUSIC BRAND META START -->"
META_END="<!-- CITYMUSIC BRAND META END -->"
RUNTIME_START="<!-- CITYMUSIC BRAND RUNTIME START -->"
RUNTIME_END="<!-- CITYMUSIC BRAND RUNTIME END -->"

META=r'''<!-- CITYMUSIC BRAND META START -->
<meta name="application-name" content="CITYMUSIC">
<meta name="apple-mobile-web-app-title" content="CITYMUSIC">
<meta name="theme-color" content="#f7f8fc">
<meta name="description" content="CITYMUSIC — a personal music atlas shaped by cities, moods and the way you actually listen.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CITYMUSIC">
<meta property="og:title" content="CITYMUSIC · Your City, Your Sound">
<meta property="og:description" content="A personal music atlas shaped by cities, rituals, moods and listening behavior.">
<meta property="og:image" content="https://easylearnfromtw.github.io/musictown/assets/citymusic-share.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="CITYMUSIC · Your City, Your Sound">
<meta name="twitter:description" content="A personal music atlas shaped by cities, rituals, moods and listening behavior.">
<meta name="twitter:image" content="https://easylearnfromtw.github.io/musictown/assets/citymusic-share.svg">
<link rel="icon" type="image/svg+xml" href="./assets/citymusic-logo.svg">
<link rel="apple-touch-icon" href="./assets/citymusic-app-icon.svg">
<link rel="manifest" href="./site.webmanifest">
<!-- CITYMUSIC BRAND META END -->'''

RUNTIME=r'''<!-- CITYMUSIC BRAND RUNTIME START -->
<script id="citymusic-brand-runtime">
(()=>{
'use strict';
const brandValue=v=>String(v||'').replace(/MUSICETOWN|MUSICTOWN|musicetown/g,'CITYMUSIC').replace(/MT\s*推薦榜/g,'CT 推薦').replace(/MT\s*推薦/g,'CT 推薦').replace(/MT PICK/g,'CT PICK');
const skip=new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','NOSCRIPT']);
function patchNode(root){
  if(!root)return;
  if(root.nodeType===3){const p=root.parentElement;if(!p||skip.has(p.tagName))return;const n=brandValue(root.nodeValue);if(n!==root.nodeValue)root.nodeValue=n;return}
  if(root.nodeType!==1)return;
  const el=root;if(skip.has(el.tagName))return;
  for(const a of ['aria-label','title','alt','placeholder'])if(el.hasAttribute(a)){const v=el.getAttribute(a),n=brandValue(v);if(n!==v)el.setAttribute(a,n)}
  if(el.matches?.('#logo .logo-wordmark,#logo .mt-logo-word,.mt-logo-word'))el.textContent='CITYMUSIC';
  for(const n of el.childNodes)patchNode(n);
}
document.title='CITYMUSIC — Your City, Your Sound';
patchNode(document.body);
new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')patchNode(m.target);for(const n of m.addedNodes)patchNode(n)}}).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
</script>
<!-- CITYMUSIC BRAND RUNTIME END -->'''

def strip_block(text,start,end):
    return re.sub(re.escape(start)+r'[\s\S]*?'+re.escape(end)+r'\s*','',text,count=1)

def apply(path:Path):
    if not path.exists():return
    text=path.read_text(encoding="utf-8")
    text=text.replace("MUSICETOWN","CITYMUSIC").replace("MUSICTOWN","CITYMUSIC")
    text=text.replace("MT 推薦榜","CT 推薦").replace("MT推薦榜","CT推薦")
    text=re.sub(r'<title>[\s\S]*?</title>','<title>CITYMUSIC — Your City, Your Sound</title>',text,count=1,flags=re.I)
    if not re.search(r'<title>',text,re.I):text=text.replace('</head>','<title>CITYMUSIC — Your City, Your Sound</title>\n</head>',1)
    text=strip_block(text,META_START,META_END);text=strip_block(text,RUNTIME_START,RUNTIME_END)
    text=text.replace('</head>',META+'\n</head>',1)
    text=text.replace('</body>',RUNTIME+'\n</body>',1)
    path.write_text(text,encoding="utf-8")
    print(path.name,"CITYMUSIC brand applied")

if __name__=="__main__":
    for name in ("index.html","404.html"):apply(ROOT/name)
