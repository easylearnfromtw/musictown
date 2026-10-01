#!/bin/zsh
cd "$(dirname "$0")"
set -e

BITRATE="${1:-64k}"

echo ""
echo "musicetown MUSIC INSTALLER"
echo "=========================="
echo "Target bitrate: $BITRATE"
echo ""

if [ ! -f "index.html" ]; then
  echo "錯誤：請把這些安裝器檔案放到 musicetown repository 根目錄再執行。"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "安裝 ffmpeg..."
    brew install ffmpeg
  else
    echo "缺少 ffmpeg。請先安裝 Homebrew，再執行：brew install ffmpeg"
    exit 1
  fi
fi

python3 -m pip install -r requirements.txt

echo ""
echo "STEP 1/3 · 安裝 JAZZ / CROONER / ROCK / SPORT / LO-FI"
python3 fetch_verified_audio.py --bitrate "$BITRATE"

echo ""
echo "STEP 2/3 · 安裝 6 個全新城市歌單"
python3 build_fresh_city_packs.py --per-city 50 --bitrate "$BITRATE"

echo ""
echo "STEP 3/3 · 驗證所有網站音樂"
python3 verify_music_install.py

echo ""
echo "完成。11 個分類資料夾中的 MP3 已經可以由網站原生 <audio> 播放。"
echo "流程：網站 MP3 → 使用者點擊 → 真實播放"
echo ""
