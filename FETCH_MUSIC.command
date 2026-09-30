#!/bin/zsh
cd "$(dirname "$0")"
echo "CITY SOUND ARCHIVE — CC0 fetcher"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install with: brew install ffmpeg"
  exit 1
fi
python3 -m pip install -r requirements.txt
python3 fetch_cc0_music.py --per-genre 50 --bitrate 160k
python3 verify_music.py
echo "Done. Open index.html through a local/static web server."
read -n 1 -s -r -p "Press any key to close..."
