#!/usr/bin/env python3
"""Curate MUSICTOWN original playlists from the 2500-track legal mother library.

The output is deterministic, contains only the licenses already admitted by
data/legal_music_library.json, and is embedded by design-src/build.py. No
additional network request is made while building the site.
"""
from __future__ import annotations
import hashlib, json, re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent
LIB=ROOT/"data"/"legal_music_library.json"
CJK=ROOT/"data"/"cjk_open_music.generated.json"
CAT=ROOT/"design-src"/"src"/"js"/"10-catalog.js"
OUT=ROOT/"data"/"original_playlists.generated.json"
REPORT=ROOT/"data"/"original_playlists_report.json"

COMMON_REJECT=["corporate","podcast","intro","children","comedy","christmas","notification","ringtone"]
REJECT={
 "MOONLIT HAZE":["metal","hard rock","punk","workout","party"],
 "DROWSY":["metal","punk","techno","workout","aggressive"],
 "KISS":["happy","uplifting","comedy","children"],
 "FIELD SEA NOTES":["metal","industrial","aggressive","workout"],
 "OCEANIC":["metal","punk","workout","corporate"],
 "TROUBADOUR":["techno","industrial","corporate","workout"],
 "LOOKING BACK":["corporate","comedy"],
}
NO_VOCALS={"MOONLIT HAZE":4,"DROWSY":3,"FIELD SEA NOTES":3,"OCEANIC":4}
YES_VOCALS={"KISS":2,"TROUBADOUR":5,"LOOKING BACK":1}

# Legacy destinations that previously fell back to an in-browser interim mix.
# These are now curated deterministically from the same verified 2500-track
# mother library so the deployed site always has a fixed 50-track edition.
ARCHIVE_SPECS=[
 {"t":"EMO","slug":"emo","name":"Emo","count":50,"words":["alternative","guitar grain","lo-fi rock","post-punk","punk","ballad rock","indie rock","slow night","soho after dark","roots"]},
 {"t":"RUNNING","slug":"running","name":"Running","count":50,"words":["high energy","motion","workout","fast pop","hype pop","upbeat pop","electronic","dubstep","synthwave","downtown pulse"]},
 {"t":"POEM","slug":"poem","name":"Poem","count":50,"words":["singer-songwriter","folk","slow folk","soft room","late study","pacific rain","acapella","chanson","slow night","coastal indie"]},
 {"t":"TRADITIONAL BEIJING","slug":"traditional-beijing","name":"Traditional Beijing","count":50,"words":["beijing opera","chinese opera","traditional chinese","folk song","vocal","opera","traditional","ceremonial","percussion","old room","vintage"],"languagePrefer":"zh","vocalBonus":8,"noMatchPenalty":16,"reject":["techno","workout","corporate","punk","metal"]},
 {"t":"TROPICAL HAWAII","slug":"tropical-hawaii","name":"Tropical Hawaii","count":50,"words":["summer pop","upbeat pop","coastal indie","pacific rain","warm","pop","lounge","soul"]},
 {"t":"BUSTLING HONG KONG","slug":"bustling-hong-kong","name":"Bustling Hong Kong","count":50,"words":["hong kong","cantonese","chinese","city pop","urban","night city","neon","synth pop","downtown pulse","night drive","fast pop","vocal"],"languagePrefer":"zh","vocalBonus":7,"noMatchPenalty":12},
 {"t":"SLIGHTLY TIPSY ROME","slug":"slightly-tipsy-rome","name":"Slightly Tipsy Rome","count":50,"words":["acapella","vintage lounge","ballroom vocal","velvet vocal","chanson","old room","jazz room","slow night"]},
 {"t":"PSYCHEDELIC LA","slug":"psychedelic-la","name":"Psychedelic LA","count":50,"words":["art pop","synthwave","lo-fi","lo-fi rock","soho after dark","night drive","synth","americana"]},
 {"t":"SOLEMN KYOTO","slug":"solemn-kyoto","name":"Solemn Kyoto","count":50,"words":["gagaku","shomyo","shōmyō","buddhist chant","temple chant","japanese traditional","shakuhachi","koto","biwa","noh","chant","choral","sacred","ceremonial","ritual","meditative","classical","drone","temple","spiritual","traditional"],"languagePrefer":"ja","vocalBonus":4,"vocalRatio":0.26,"noMatchPenalty":34,"reject":["lo-fi","pop","happy","upbeat","party","funk","hip hop","rap","techno","club","punk","hard rock","workout","corporate","comedy","children","dance pop","synth pop"]},
 {"t":"MIRACULOUS LUOYANG","slug":"miraculous-luoyang","name":"Miraculous Luoyang","count":50,"words":["chinese traditional","ceremonial","ritual","traditional","classical","folk song","vocal","opera","drums","ancient","old room"],"languagePrefer":"zh","vocalBonus":5,"noMatchPenalty":16,"reject":["techno","workout","corporate","punk","metal"]},
 {"t":"CHAMPS-ÉLYSÉES","slug":"champs-elysees","name":"Champs-Élysées","count":50,"words":["lounge","vintage lounge","chanson","velvet vocal","art pop","soul-r&b","jazz-funk","soho after dark"]},
 {"t":"MENACING DUBAI","slug":"menacing-dubai","name":"Menacing Dubai","count":50,"words":["dark","night","electronic","industrial","synth","pulse","tense","urban","city","drive","rock","dream","ambient","downtown","neon"]}
]

CORE_RECURATE_SPECS=[
 {"t":"OLD TOKYO","slug":"old-tokyo","name":"Old Tokyo","count":50,
  "words":["japanese","japan","city pop","kayokyoku","folk song","traditional","vintage","jazz","crooner","ballad","vocal","night city"],
  "languagePrefer":"ja","vocalBonus":7,"vocalRatio":0.46,"noMatchPenalty":18,
  "reject":["corporate","workout","hard rock","metal","children","techno"]},
 {"t":"SPLENDOR SHANGHAI","slug":"splendor-shanghai","name":"Splendor Shanghai","count":50,
  "words":["chinese","shanghai","mandarin","ballroom vocal","crooner","vintage jazz","swing","oldies","traditional","folk song","vocal","soul"],
  "languagePrefer":"zh","vocalBonus":8,"vocalRatio":0.52,"noMatchPenalty":18,
  "reject":["workout","metal","punk","techno","corporate"]},
 {"t":"VANCOUVER","slug":"vancouver","name":"Vancouver","count":50,
  "words":["indie folk","singer-songwriter","acoustic","folk","rain","coastal","dream pop","soft rock","vocal","warm","night"],
  "vocalBonus":7,"vocalRatio":0.52,"noMatchPenalty":14,"reject":["corporate","workout","metal","hard techno"]},
 {"t":"VAPOR LONDON","slug":"vapor-london","name":"Vapor London","count":50,
  "words":["british","post-punk","indie rock","trip hop","art pop","new wave","soul","jazz","vocal","rain","night","urban"],
  "vocalBonus":7,"vocalRatio":0.50,"noMatchPenalty":15,"reject":["corporate","workout","happy children","meditation"]},
 {"t":"NEW YORK","slug":"new-york","name":"New York","count":50,
  "words":["new york","jazz","soul","hip hop","rap","rock","funk","r&b","vocal","urban","night city","downtown"],
  "vocalBonus":8,"vocalRatio":0.54,"noMatchPenalty":15,"reject":["meditation","corporate","children","ambient drone"]},
 {"t":"JAZZ","slug":"jazz","name":"Jazz","count":50,
  "words":["jazz","bebop","swing","blues","vocal jazz","jazz vocal","lounge","big band","improvisation","crooner"],
  "vocalBonus":5,"vocalRatio":0.34,"noMatchPenalty":20,"reject":["techno","metal","punk","workout","corporate"]},
 {"t":"CROONER","slug":"crooner","name":"Crooner","count":50,
  "words":["crooner","vocal jazz","jazz vocal","ballad","swing","lounge","singer","vocal","torch song","big band","oldies"],
  "vocalBonus":13,"vocalRatio":0.78,"noMatchPenalty":22,"reject":["instrumental","techno","ambient","workout","metal","punk"]},
 {"t":"ROCK","slug":"rock","name":"Rock","count":50,
  "words":["rock","indie rock","alternative rock","guitar","post-punk","punk","garage","grunge","vocal","band"],
  "vocalBonus":8,"vocalRatio":0.58,"noMatchPenalty":18,"reject":["meditation","corporate","solo piano","lounge"]},
 {"t":"LO-FI","slug":"lo-fi","name":"Lo-fi","count":50,
  "words":["lo-fi","lofi","indie","folk","singer-songwriter","mellow","acoustic","soft","bedroom","vocal","slow night"],
  "vocalBonus":8,"vocalRatio":0.54,"noMatchPenalty":16,"reject":["workout","metal","hard rock","techno","corporate"]},
 {"t":"EMO","slug":"emo","name":"Emo","count":50,
  "words":["emo","alternative","indie rock","guitar","post-punk","ballad rock","melancholy","sad","vocal","singer","heartbreak"],
  "vocalBonus":10,"vocalRatio":0.64,"noMatchPenalty":18,"reject":["corporate","happy","children","meditation"]},
 {"t":"SPORT","slug":"sport","name":"Sport","count":50,
  "words":["high energy","motion","workout","rock","pop","hip hop","rap","electronic","vocal","upbeat","fast","hype"],
  "vocalBonus":6,"vocalRatio":0.42,"noMatchPenalty":12,"reject":["sleep","meditation","slow ambient","lullaby"]},
 {"t":"RUNNING","slug":"running","name":"Running","count":50,
  "words":["running","high energy","motion","workout","fast pop","hype","upbeat","electronic","rock","rap","vocal","driving"],
  "vocalBonus":7,"vocalRatio":0.46,"noMatchPenalty":13,"reject":["sleep","meditation","slow ambient","lullaby"]},
 {"t":"POEM","slug":"poem","name":"Poem","count":50,
  "words":["singer-songwriter","folk","acoustic","ballad","chanson","vocal","storytelling","poetry","soft","slow","intimate"],
  "vocalBonus":11,"vocalRatio":0.68,"noMatchPenalty":18,"reject":["workout","techno","metal","corporate","hard rock"]},
]

def norm(s):
    return re.sub(r"\s+"," ",str(s or "")).strip().casefold()

def stable_id(t):
    return str(t.get("libraryId") or t.get("masterId") or t.get("source") or (norm(t.get("artist"))+"|"+norm(t.get("title"))))

def artist_key(t):
    return norm(t.get("artist")) or "unknown"

def specs():
    s=CAT.read_text(encoding="utf-8")
    m=re.search(r"const ORIGINAL_PLAYLISTS = (\[[\s\S]*?\]);\nconst ORIGINAL_POOL",s)
    if not m: raise SystemExit("ORIGINAL_PLAYLISTS block not found")
    out=json.loads(m.group(1))
    out.extend(CORE_RECURATE_SPECS)
    x=re.search(r"const EXTRA_THEME_SPECS = (\[[\s\S]*?\]);\nfunction extraThemeData",s)
    if x: out.extend(json.loads(x.group(1)))
    out.extend(ARCHIVE_SPECS)
    return out

def text_fields(t):
    title=norm(t.get("title")); artist=norm(t.get("artist")); genre=norm(t.get("genre")); tags=norm(t.get("tags"))
    return title,artist,genre,tags," ".join((title,artist,genre,tags))

def vocalish(t):
    if t.get("hasVocals") is True:return True
    if t.get("hasVocals") is False:return False
    blob=" ".join(norm(t.get(k)) for k in ("title","genre","tags","culture"))
    return any(w in blob for w in ("vocal","vocals","song","songs","sing","singer","singer-songwriter","acapella","a cappella","choir","choral","chant","crooner","ballad","rap","r&b","soul","歌","唱","民歌","民謡","童謡","聲樂","声乐"))

def score_track(t,words,spec,echo_artists=frozenset()):
    theme=spec["t"]; title,artist,genre,tags,blob=text_fields(t); score=0; hits=[]
    for i,w in enumerate(words or []):
        w=norm(w)
        if not w: continue
        weight=max(3,14-min(i,9))
        if w in title: score+=weight+7; hits.append(w)
        elif w in genre: score+=weight+5; hits.append(w)
        elif w in tags: score+=weight+3; hits.append(w)
        elif w in blob: score+=weight; hits.append(w)
    for bad in COMMON_REJECT+REJECT.get(theme,[])+list(spec.get("reject") or []):
        if norm(bad) in blob: score-=22
    if not hits: score-=int(spec.get("noMatchPenalty",8))
    if vocalish(t): score+=int(spec.get("vocalBonus",5))+YES_VOCALS.get(theme,0)
    elif t.get("hasVocals") is False: score+=NO_VOCALS.get(theme,0)
    pref=spec.get("languagePrefer"); lang=norm(t.get("language"))
    if pref:
        if lang==norm(pref): score+=18
        elif lang: score-=10
    if artist in echo_artists: score+=8
    src=norm(t.get("source"))
    if t.get("download") or "nullrights.com/track/" in src: score+=3
    tie=hashlib.sha1((theme+"|"+stable_id(t)).encode()).hexdigest()
    return score,tie,hits

def playable(t):
    src=norm(t.get("source"))
    return bool(t.get("download") or "nullrights.com/track/" in src)

def choose(pool,spec,words,n,used,artist_counts,phase,echo_artists=frozenset(),max_artist=2):
    theme=spec["t"]; ranked=[]
    for t in pool:
        k=stable_id(t)
        if k in used or not playable(t): continue
        sc,tie,hits=score_track(t,words,spec,echo_artists)
        ranked.append((sc,tie,t,hits))
    # A thematic keyword hit always outranks a merely generic/vocal fallback.
    ranked.sort(key=lambda x:(0 if x[3] else 1,-x[0],x[1]))
    out=[]

    ratio=float(spec.get("vocalRatio",0.42))
    vocal_need=max(0,min(n,round(n*ratio)))
    def take(rows, pred=lambda row:True):
        nonlocal out
        for sc,tie,t,hits in rows:
            if len(out)>=n:return
            if not pred((sc,tie,t,hits)):continue
            k=stable_id(t)
            if k in used:continue
            ak=artist_key(t)
            if artist_counts[ak]>=max_artist:continue
            used.add(k); artist_counts[ak]+=1; out.append((t,sc,hits,phase))

    # First satisfy vocal presence with tracks that actually match the theme.
    take(ranked,lambda r: bool(r[3]) and vocalish(r[2]) and sum(1 for x in out if vocalish(x[0]))<vocal_need)
    # Then fill by semantic relevance, regardless of vocal/instrumental.
    take(ranked)
    # If the artist-diversity cap blocked the requested size, relax only that cap.
    if len(out)<n:
        for sc,tie,t,hits in ranked:
            if len(out)>=n:break
            k=stable_id(t)
            if k in used:continue
            used.add(k); artist_counts[artist_key(t)]+=1; out.append((t,sc,hits,phase))
    if len(out)<n:raise RuntimeError(f"{theme}: only {len(out)}/{n} playable unique tracks")
    return out

def public_track(t,spec,i,sc,hits,phase):
    keep=("libraryId","title","artist","source","download","license","licenseUrl","licenseEvidence","licenseChecked","genre","tags","duration","hasVocals","origin","language","culture","attribution","languageEvidence")
    o={k:t.get(k) for k in keep if t.get(k) is not None}
    sid=stable_id(t)
    o["masterId"]=str(t.get("masterId") or hashlib.sha1(sid.encode()).hexdigest()[:16])
    src=str(t.get("source") or "")
    if "nullrights.com/track/" in src:
        o["embed"]=src.rstrip("/").split("/")[-1]
    o["trackNo"]=i
    o["shareId"]=f"{spec['slug']}-{i:03d}"
    o["curatedTheme"]=spec["t"]
    o["curatedFrom"]=sid
    o["motherLibrary"]=True
    o["curationScore"]=sc
    o["curationPhase"]=phase
    o["curationMatches"]=hits[:10]
    descriptor=str(t.get("genre") or t.get("tags") or "Mother Library")
    o["vibe"]=f"{spec['name']} · {descriptor[:140]}"
    return o

def main():
    lib=json.loads(LIB.read_text(encoding="utf-8"))
    cjk=json.loads(CJK.read_text(encoding="utf-8")) if CJK.exists() else {"tracks":[]}
    raw=list(lib.get("tracks",[]))+list(cjk.get("tracks",[]))
    seen=set(); pool=[]
    for t in raw:
        k=stable_id(t)
        if not k or k in seen:continue
        seen.add(k); pool.append(t)
    if len(lib.get("tracks",[]))<2500: raise SystemExit(f"legal library too small: {len(lib.get('tracks',[]))}")
    playlists=[]; report={"libraryVersion":lib.get("version"),"libraryCount":len(pool),"cjkCount":len(cjk.get("tracks",[])),"playlists":{}}
    for spec in specs():
        theme=spec["t"]; artist_counts=Counter(); selected=[]; used=set()
        phases=spec.get("phases")
        if phases:
            first_artists=set()
            for pi,p in enumerate(phases):
                echo=first_artists if theme=="TROUBADOUR" and pi==len(phases)-1 else frozenset()
                batch=choose(pool,spec,p.get("words",[]),int(p["n"]),used,artist_counts,p.get("label") or f"phase-{pi+1}",echo,max_artist=2)
                if pi==0:first_artists={artist_key(x[0]) for x in batch}
                selected.extend(batch)
        elif theme=="LOOKING BACK":
            selected.extend(choose(pool,spec,spec.get("rush",[]),24,used,artist_counts,"尋找",max_artist=2))
            selected.extend(choose(pool,spec,spec.get("resolve",[]),1,used,artist_counts,"找到",max_artist=2))
        else:
            selected.extend(choose(pool,spec,spec.get("words",[]),int(spec.get("count",25)),used,artist_counts,"main",max_artist=2))
        expected=sum(int(p.get("n",0)) for p in phases) if phases else int(spec.get("count",25))
        if len(selected)!=expected:raise RuntimeError(f"{theme}: expected {expected}, got {len(selected)}")
        tracks=[public_track(t,spec,i,sc,hits,phase) for i,(t,sc,hits,phase) in enumerate(selected,1)]
        if len({t["masterId"] for t in tracks})!=len(tracks):raise RuntimeError(f"{theme}: duplicate master inside playlist")
        playlists.append({"t":theme,"tracks":tracks})
        report["playlists"][theme]={"vocalCount":sum(1 for x in selected if vocalish(x[0])),
          "tracks":[{"n":i,"title":t["title"],"artist":t["artist"],"score":t["curationScore"],"phase":t["curationPhase"],"matches":t["curationMatches"],"language":t.get("language")} for i,t in enumerate(tracks,1)]}
        print(f"\n{spec['name']} · {theme} · vocals {report['playlists'][theme]['vocalCount']}/{len(tracks)}")
    total=sum(len(p["tracks"]) for p in playlists)
    expected=sum(sum(int(ph.get("n",0)) for ph in x.get("phases",[])) if x.get("phases") else int(x.get("count",25)) for x in specs())
    if total!=expected:raise RuntimeError(f"CITYMUS curated set expected {expected} selections, got {total}")
    OUT.write_text(json.dumps(playlists,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"\nCITYMUS relevance-first curation: {len(playlists)} themes / {total} selections")

if __name__=="__main__":
    main()
