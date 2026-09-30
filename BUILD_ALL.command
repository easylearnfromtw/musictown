#!/bin/zsh
cd "$(dirname "$0")"
echo "musicetown R8.2 · build verified audio"
command -v ffmpeg >/dev/null 2>&1 || { echo "Install ffmpeg first: brew install ffmpeg"; exit 1; }
python3 -m pip install -r requirements.txt

echo "1/2 Building the five general verified CC0 drawers..."
python3 fetch_verified_audio.py --bitrate 96k

echo "2/2 Finding six completely fresh city pools..."
python3 build_fresh_city_packs.py --per-city 50 --bitrate 96k

echo "Done."
echo "Audio folders are directly at repository root: jazz/, taipei-style/, london/, etc."
read -n 1 -s -r -p "Press any key to close..."
