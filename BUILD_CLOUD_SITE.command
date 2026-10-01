#!/bin/zsh
cd "$(dirname "$0")"
set -e

BITRATE="${1:-64k}"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "請先安裝 ffmpeg: brew install ffmpeg"
  exit 1
}

python3 -m pip install -r requirements.txt

echo "① 下載一般五類 CC0 MP3..."
python3 fetch_verified_audio.py --bitrate "$BITRATE"

echo "② 尋找並下載六個城市全新 CC0 人聲曲庫..."
python3 build_fresh_city_packs.py --per-city 50 --bitrate "$BITRATE"

echo "③ 驗證網站內每首歌曲都是真實 MP3..."
python3 verify_cloud_audio.py

echo "④ 準備 GitHub Pages 網站..."
python3 prepare_pages_site.py

echo ""
echo "完成。_site/ 就是包含真實 MP3 的完整網站。"
echo "播放流程：網站雲端 MP3 → 使用者 → HTML audio 真實播放"
