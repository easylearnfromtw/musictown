#!/usr/bin/env python3
from pathlib import Path
import json,re,subprocess,shutil,sys

ROOT=Path(__file__).resolve().parent
text=(ROOT/"index.html").read_text(encoding="utf-8")
m=re.search(r'window\.MUSIC_DATA\s*=\s*(\[.*?\]);\s*\n',text,re.S)
if not m:
    raise SystemExit("MUSIC_DATA not found")
data=json.loads(m.group(1))

expected=[]
for d in data:
    for t in d.get("tracks",[]):
        expected.append((d["t"],t.get("title",""),t.get("audioSrc","")))

missing=[]
bad=[]
ffprobe=shutil.which("ffprobe")

for drawer,title,rel in expected:
    p=ROOT/rel
    if not rel or not p.exists():
        missing.append(f"{drawer} :: {title} :: {rel}")
        continue
    if p.stat().st_size<20000:
        bad.append(f"{rel}: too small ({p.stat().st_size} bytes)")
        continue
    if ffprobe:
        r=subprocess.run(
          [ffprobe,"-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(p)],
          capture_output=True,text=True
        )
        if r.returncode!=0:
            bad.append(f"{rel}: ffprobe failed")

total=len(expected)
ready=total-len(missing)-len(bad)
report={"expected":total,"ready":ready,"missing":missing,"bad":bad}
(ROOT/"MUSIC_INSTALL_REPORT.json").write_text(
    json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
)

print(f"\nMUSIC READY: {ready}/{total}")
if missing:
    print("\nMISSING:")
    for x in missing[:100]:print(" -",x)
if bad:
    print("\nBAD:")
    for x in bad[:100]:print(" -",x)

if total!=550:
    print(f"\nWARNING: catalog currently contains {total} tracks, not 550.")

sys.exit(1 if missing or bad else 0)
