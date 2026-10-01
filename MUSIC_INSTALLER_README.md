# musicetown Music Installer R8.6.5

這個 ZIP **不是網站完整版**。它是要覆蓋到你現有 musicetown repository 根目錄的「音樂安裝器」。

## 最簡單：用 GitHub 自己下載

1. 解壓縮本 ZIP。
2. 把全部檔案上傳到目前 musicetown repository 根目錄。
3. GitHub → Settings → Pages → Source 設成 **GitHub Actions**。
4. GitHub → Actions。
5. 執行 **Install musicetown Music + Deploy**。
6. bitrate 建議先選 `64k`。
7. 等 workflow 完成。

GitHub runner 會自己：
- 下載合法來源音訊
- 轉成 MP3
- 建立 11 個分類資料夾
- 驗證每一個網站 audioSrc 真的有檔案
- 把 HTML + MP3 一起部署到 GitHub Pages

部署成功後，使用者播放流程就是：

**你的 GitHub Pages MP3 → 使用者點歌 → HTML `<audio>` → 真實播放**

MP3 不需要存在使用者手機。

## Mac 本機安裝

把本 ZIP 全部檔案放到 musicetown repo 根目錄，雙擊：

`INSTALL_MUSIC.command`

它會把 MP3 實際存進：

- jazz/
- crooner/
- rock/
- sport/
- lo-fi/
- taipei-style/
- old-tokyo/
- splendor-shanghai/
- vancouver/
- london/
- new-york/

## 內容

一般五類使用 `verified_audio_manifest.json` 的已審核 CC0 pool。

六個城市：
- TAIPEI STYLE
- OLD TOKYO
- SPLENDOR SHANGHAI
- VANCOUVER
- LONDON
- NEW YORK

會重新搜尋符合該城市 sound profile 的 CC0、人聲、非 AI 標示曲目，並強制排除一般五類與六城市之間的重複。

## 注意

下載來源網站若改版、暫時阻擋或撤下檔案，installer 會失敗而不是假裝完成。
`verify_music_install.py` 必須通過，GitHub Pages 才會部署。
