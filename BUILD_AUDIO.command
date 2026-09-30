#!/bin/zsh
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null 2>&1 || { echo "Install ffmpeg first: brew install ffmpeg"; exit 1; }
python3 -m pip install -r requirements.txt
python3 fetch_verified_audio.py --bitrate 128k
python3 verify_audio_files.py
read -n 1 -s -r -p "Press any key to close..."
