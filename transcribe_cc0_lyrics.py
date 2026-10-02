#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import argparse, json, os, re, time

ROOT=Path(__file__).resolve().parent

def norm_text(s:str)->str:
    s=re.sub(r"\s+"," ",str(s or "")).strip()
    return s

def pick_audio(targets):
    for rel in targets or []:
        p=ROOT/rel
        if p.exists() and p.stat().st_size>20000:
            return p,rel
    return None,None

def save(path,obj):
    tmp=path.with_suffix(path.suffix+".tmp")
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding="utf-8")
    tmp.replace(path)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--model",default=os.getenv("WHISPER_MODEL","base"))
    ap.add_argument("--force",action="store_true")
    args=ap.parse_args()

    from faster_whisper import WhisperModel

    verified=json.loads((ROOT/"verified_audio_manifest.json").read_text(encoding="utf-8"))
    out_path=ROOT/"lyrics_manifest.json"
    if out_path.exists():
        out=json.loads(out_path.read_text(encoding="utf-8"))
    else:
        out={"version":1,"generatedAt":None,"model":None,"masters":{}}

    out.setdefault("masters",{})
    out["model"]=f"faster-whisper/{args.model}"
    model=WhisperModel(args.model,device="cpu",compute_type="int8",cpu_threads=max(2,os.cpu_count() or 2))

    masters=verified.get("masters") or []
    total=len(masters)
    for idx,m in enumerate(masters,1):
        mid=str(m.get("masterId") or "").strip()
        if not mid: continue
        existing=out["masters"].get(mid)
        if existing and existing.get("status") in {"transcribed","no_speech"} and not args.force:
            print(f"[{idx}/{total}] cached {mid} · {m.get('artist')} — {m.get('title')}")
            continue

        p,rel=pick_audio(m.get("targets"))
        if not p:
            out["masters"][mid]={
                "status":"missing_audio","title":m.get("title"),"artist":m.get("artist"),
                "source":m.get("source"),"syncedLyrics":[]
            }
            save(out_path,out);continue

        print(f"[{idx}/{total}] transcribe {rel} · {m.get('artist')} — {m.get('title')}",flush=True)
        try:
            segments,info=model.transcribe(
                str(p),
                task="transcribe",
                beam_size=2,
                best_of=2,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms":500},
                condition_on_previous_text=True,
                temperature=0.0
            )
            lines=[]
            last_text=""
            speech_sec=0.0
            for seg in segments:
                txt=norm_text(seg.text)
                if not txt: continue
                no_speech=float(getattr(seg,"no_speech_prob",0.0) or 0.0)
                avg_logprob=float(getattr(seg,"avg_logprob",-99.0) or -99.0)
                compression=float(getattr(seg,"compression_ratio",0.0) or 0.0)
                if no_speech>0.68 or avg_logprob<-1.35 or compression>2.6:
                    continue
                if txt.casefold()==last_text.casefold():
                    continue
                start=max(0.0,float(seg.start))
                end=max(start,float(seg.end))
                speech_sec+=end-start
                lines.append({"time":round(start,2),"end":round(end,2),"text":txt})
                last_text=txt

            chars=sum(len(x["text"]) for x in lines)
            # Aggressive anti-hallucination gate for instrumental tracks.
            if len(lines)<2 or chars<24 or speech_sec<6:
                status="no_speech";lines=[]
            else:
                status="transcribed"

            out["masters"][mid]={
                "status":status,
                "title":m.get("title"),"artist":m.get("artist"),"source":m.get("source"),
                "audio":rel,
                "language":getattr(info,"language",None),
                "languageProbability":round(float(getattr(info,"language_probability",0.0) or 0.0),4),
                "model":out["model"],
                "syncedLyrics":lines
            }
        except Exception as e:
            out["masters"][mid]={
                "status":"error","title":m.get("title"),"artist":m.get("artist"),
                "source":m.get("source"),"audio":rel,"error":str(e)[:500],"syncedLyrics":[]
            }

        out["generatedAt"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
        save(out_path,out)

    out["generatedAt"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    counts={}
    for v in out["masters"].values():counts[v.get("status","unknown")]=counts.get(v.get("status","unknown"),0)+1
    out["summary"]=counts
    save(out_path,out)
    print("Lyrics manifest complete:",counts)

if __name__=="__main__":
    main()
