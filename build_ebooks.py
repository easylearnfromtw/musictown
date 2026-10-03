#!/usr/bin/env python3
from __future__ import annotations
import html,json,re,time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"ebook-catalog.js"; REPORT=ROOT/"EBOOK_REPORT.json"
S=requests.Session(); S.headers.update({"User-Agent":"CITYMUS-Reader/12.4 (+https://github.com/easylearnfromtw/musictown)"})
SOURCES=[
{"slug":"red-cliff-rhapsody","theme":"RED CLIFF RHAPSODY","title":"赤壁賦","author":"蘇軾","lang":"zh-Hant","kind":"wiki","url":"https://zh.wikisource.org/zh-hant/%E5%89%8D%E8%B5%A4%E5%A3%81%E8%B3%A6","source":"維基文庫 · 前赤壁賦","rights":"原作公有領域；只收錄中文原文，不使用現代翻譯。"},
{"slug":"childhood-delights","theme":"CHILDHOOD DELIGHTS","title":"兒時記趣","author":"沈復","lang":"zh-Hant","kind":"wiki","url":"https://zh.wikisource.org/wiki/%E9%97%B2%E6%83%85%E8%AE%B0%E8%B6%A3","source":"維基文庫 · 浮生六記／卷二 閒情記趣","start":"余憶童稚時","end":"此皆幼時閒情也","rights":"《浮生六記》原作公有領域；只收錄兒時記趣原文段落。"},
{"slug":"peach-blossom-spring","theme":"PEACH BLOSSOM SPRING","title":"桃花源記","author":"陶淵明","lang":"zh-Hant","kind":"wiki","url":"https://zh.wikisource.org/zh-hant/%E6%A1%83%E8%8A%B1%E6%BA%90%E8%A8%98","source":"維基文庫 · 桃花源記","rights":"古典原作公有領域；只呈現中文原文。"},
{"slug":"chu-shi-biao","theme":"MEMORIAL ON THE NORTHERN EXPEDITION","title":"出師表","author":"諸葛亮","lang":"zh-Hant","kind":"wiki","url":"https://zh.wikisource.org/zh-hant/%E5%89%8D%E5%87%BA%E5%B8%88%E8%A1%A8","source":"維基文庫 · 前出師表","rights":"古典原作公有領域；只呈現中文原文。"},
{"slug":"li-sao","theme":"LI SAO","title":"離騷","author":"屈原","lang":"zh-Hant","kind":"wiki","url":"https://zh.wikisource.org/zh-hant/%E9%9B%A2%E9%A8%B7","source":"維基文庫 · 離騷","rights":"古典原作公有領域；只呈現中文原文。"},
{"slug":"sherlock-holmes","theme":"THE ADVENTURES OF SHERLOCK HOLMES","title":"The Adventures of Sherlock Holmes","author":"Arthur Conan Doyle","lang":"en","kind":"pg","id":1661,"url":"https://www.gutenberg.org/ebooks/1661","source":"Project Gutenberg eBook #1661","rights":"Original English text only. Project Gutenberg identifies this eBook as public domain in the USA."},
{"slug":"pride-and-prejudice","theme":"PRIDE AND PREJUDICE","title":"Pride and Prejudice","author":"Jane Austen","lang":"en","kind":"pg","id":1342,"url":"https://www.gutenberg.org/ebooks/1342","source":"Project Gutenberg eBook #1342","rights":"Original English text only. Project Gutenberg identifies this eBook as public domain in the USA."},
{"slug":"a-tale-of-two-cities","theme":"A TALE OF TWO CITIES","title":"A Tale of Two Cities","author":"Charles Dickens","lang":"en","kind":"pg","id":98,"url":"https://www.gutenberg.org/ebooks/98","source":"Project Gutenberg eBook #98","rights":"Original English text only. Project Gutenberg identifies this eBook as public domain in the USA."},
{"slug":"robinson-crusoe","theme":"ROBINSON CRUSOE","title":"Robinson Crusoe","author":"Daniel Defoe","lang":"en","kind":"pg","id":521,"url":"https://www.gutenberg.org/ebooks/521","source":"Project Gutenberg eBook #521","rights":"Original English text only. Project Gutenberg identifies this eBook as public domain in the USA."}
]
def get(url):
  last=None
  for n in range(4):
    try:
      r=S.get(url,timeout=35);r.raise_for_status();return r
    except Exception as e:last=e;time.sleep(1.2*(n+1))
  raise last
def clean(x):return re.sub(r"[ \t]+"," ",html.unescape(str(x or ""))).strip()
def paras(x):return [clean(p) for p in re.split(r"\n\s*\n+",x.replace("\r","")) if clean(p)]
def pg(s):
  i=s["id"];txt=None
  for u in [f"https://www.gutenberg.org/cache/epub/{i}/pg{i}.txt",f"https://www.gutenberg.org/files/{i}/{i}-8.txt",f"https://www.gutenberg.org/files/{i}/{i}.txt"]:
    try:
      r=get(u);r.encoding=r.apparent_encoding or "utf-8";txt=r.text
      if len(txt)>10000:break
    except Exception:pass
  if not txt or len(txt)<10000:raise RuntimeError("Gutenberg text unavailable")
  a=re.search(r"\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",txt,re.I|re.S)
  if a:txt=txt[a.end():]
  b=re.search(r"\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",txt,re.I|re.S)
  if b:txt=txt[:b.start()]
  lines=txt.strip().splitlines();heads=[]
  for n,line in enumerate(lines):
    t=clean(line)
    if re.match(r"^(ADVENTURE\s+[IVXLC]+|CHAPTER\s+[IVXLC0-9]+|BOOK\s+(THE\s+)?[A-ZIVXLC0-9]+)",t,re.I):heads.append((n,t.title() if t.isupper() else t))
  if not heads:return [{"id":"text","title":s["title"],"paragraphs":paras(txt)}]
  out=[]
  for j,(start,title) in enumerate(heads):
    end=heads[j+1][0] if j+1<len(heads) else len(lines);chunk="\n".join(lines[start+1:end]).strip()
    if len(chunk)>120:out.append({"id":f"s{j+1}","title":title,"paragraphs":paras(chunk)})
  return out
def wiki(s):
  root=BeautifulSoup(get(s["url"]).text,"html.parser").select_one(".mw-parser-output")
  if not root:raise RuntimeError("Wikisource content missing")
  for sel in ["table",".mw-editsection","sup.reference",".navbox",".sistersitebox",".ws-noexport","style","script","figure"]:
    for x in root.select(sel):x.decompose()
  blocks=[]
  for el in root.find_all(["h2","h3","p"]):
    t=clean(el.get_text(" ",strip=True))
    if t:blocks.append((el.name,t))
  if s.get("start"):
    joined="\n\n".join(t for _,t in blocks);a=joined.find(s["start"]);b=joined.find(s["end"],a)
    if a<0 or b<0:raise RuntimeError("excerpt markers missing")
    return [{"id":"original","title":s["title"],"paragraphs":paras(joined[a:b+len(s["end"])])}]
  out=[];cur={"id":"original","title":s["title"],"paragraphs":[]}
  for tag,t in blocks:
    if tag in ("h2","h3") and cur["paragraphs"]:
      out.append(cur);cur={"id":f"s{len(out)+1}","title":t.replace("[編輯]","").replace("[编辑]",""),"paragraphs":[]}
    elif tag=="p" and len(t)>20:cur["paragraphs"].append(t)
  if cur["paragraphs"]:out.append(cur)
  return out
def main():
  books=[];fails=[]
  for s in SOURCES:
    try:
      sec=pg(s) if s["kind"]=="pg" else wiki(s);chars=sum(len(p) for x in sec for p in x["paragraphs"])
      if chars<(6000 if s["kind"]=="pg" else 120):raise RuntimeError(f"text too short {chars}")
      books.append({k:s[k] for k in ("slug","theme","title","author","lang","url","source","rights")}|{"publicDomain":True,"sections":sec,"chars":chars})
      print("ebook",s["slug"],chars,"chars",len(sec),"sections",flush=True)
    except Exception as e:fails.append({"slug":s["slug"],"error":str(e)[:200]});print("ebook warning",s["slug"],e,flush=True)
  if len(books)<6:raise SystemExit(f"reader catalog too small: {len(books)}")
  OUT.write_text("window.CITYMUS_EBOOKS="+json.dumps(books,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
  REPORT.write_text(json.dumps({"count":len(books),"books":[{"slug":b["slug"],"title":b["title"],"chars":b["chars"],"source":b["source"]} for b in books],"failures":fails},ensure_ascii=False,indent=2),encoding="utf-8")
  print("CITYMUS Reader:",len(books),"public-domain originals",flush=True)
if __name__=="__main__":main()
