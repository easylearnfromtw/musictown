musicetown R7.1 — AUTO CC0 LOCAL MP3

目的
- 網站仍然用 <audio> 播放本地 MP3。
- fetch_cc0_music.py 自動從 CC0 catalog 尋找曲目。
- 每一首都必須在來源頁看到 CC0 1.0 Universal / public domain 才會收錄。
- 若該分類要求人聲，來源頁還必須標示 Has vocals。
- 音訊下載後用 ffmpeg 統一轉成 MP3，再寫入 catalog.js 與 music_manifest.json。
- 找不到直接音訊下載網址就跳過，不會塞假檔。

Mac 最簡單
1. 安裝 ffmpeg：brew install ffmpeg
2. 雙擊 FETCH_MUSIC.command
3. 等待下載完成。
4. 執行 python3 verify_music.py。
5. 用靜態伺服器打開網站，例如：
   python3 -m http.server 8000
   然後開 http://localhost:8000

GitHub Actions
- 將整個資料夾放到 repo。
- Actions > Build CC0 Music Library > Run workflow。
- 完成後下載 city-sound-archive-local-mp3 artifact。
- 工作流程不會自動把數百 MB 音樂 commit 進 Git repository。

為什麼不預先附 400 個 MP3
目前 ChatGPT 的執行容器無法直接下載第三方音訊二進位檔，因此這裡提供可重現的抓取與驗證流程，
而不是製造空檔或聲稱不存在的 MP3 已經下載完成。

授權原則
Nullrights 表示其 catalog 的每首錄音皆為 CC0；抓取器仍會逐一讀取 track page 並確認
CC0 1.0 Universal / public domain，才允許下載。若授權頁格式改變，該首會被跳過。


R7.2 PLAYER
- 品牌名稱：musicetown
- 每首歌曲會依歌名/Artist 固定取得一個彩膠顏色：
  黑、蘋果綠、淺藍、淺粉、Tiffany 綠、黑、淺黃。
- 播放時唱片依 audio.currentTime 旋轉。
- 拖曳唱片順時針＝快轉；逆時針＝倒轉。
- 轉一圈預設等於 8 秒，可在 VINYL_SECONDS_PER_TURN 調整手感。


R7.3
- 灰色播放器控制區改為深藍。
- 上方 seek bar 改成明顯的「滾軸」風格。
- 播放結束預設自動下一首，可在 Liquid Glass 控制列關閉 AUTO NEXT。
- 最下方新增常駐 Liquid Glass mini player：
  上一首 / 播放暫停 / 下一首 / 進度 / 音量 / 自動下一首。
- 關閉歌曲面板時若音樂仍播放，底部 Liquid Glass 會繼續控制播放。
