# CITYMUS iOS Companion + WidgetKit

這個目錄保留既有 CITYMUS Web / PWA，新增 iOS Companion App、WidgetKit、App Intents 與 App Group。

## Phase 1

- WKWebView Companion 直接使用現有 CITYMUS 網站，不重寫 HTML/CSS/JS。
- JavaScript ↔ Swift Bridge：同步 Current Song / Artist / Theme / Cover / 播放狀態。
- App Group：App 與 Widget 共用 metadata 與封面。
- Deep Link：citymus://player、citymus://track/<shareId>、citymus://radio?theme=<slug>、citymus://action?name=next。
- Small Now Playing Widget。
- Medium Player Widget。
- Medium For You Widget。
- Small / Medium City Radio Widget。
- Widget Theme 可選 Auto / Light / Dark；City Radio 可選城市。
- Widget 按鍵第一階段會開 Companion App，再把指令交給既有 Web Player。

真正「不開 App 也能在 Widget 背景播放/暫停/上下首」留在 Phase 2，屆時改由 AVPlayer + Background Audio + AudioPlaybackIntent 接管系統播放層，網站本身仍保留。

## 最快安裝到自己的 iPhone

這條路不需要先上 App Store；Xcode 會直接把 CITYMUS Companion 安裝到你的實機。

1. 在 Mac 下載 / clone 此 repo。
2. 雙擊 `ios/scripts/setup_xcode.command`（第一次若 macOS 阻擋，可在終端機執行 `bash ios/scripts/setup_xcode.command`）。
3. Xcode 打開後，CITYMUS 與 CITYMUSWidgets 兩個 target 都選同一個 Apple Developer Team。
4. 兩個 target 都確認 App Group：`group.com.easylearnfromtw.citymus`。
5. 用線連上 iPhone，將 Run Destination 切成你的 iPhone，按 ▶︎ Run。
6. iPhone 第一次若要求信任 Developer Mode / 開發者，依系統提示開啟。
7. 安裝後從「CITYMUS App」開啟並播放一首歌，再鎖定螢幕測試 Now Playing 返回。

只要 Native Companion 真正安裝到 iPhone，`citymus://` deep link、Widget、原生 audio session 才存在；單純 GitHub Pages / 加入主畫面的 PWA 不會取得這些 native 能力。

GitHub Actions 的 **CITYMUS iOS Companion CI** 也會在每次 `ios/**` 變更後自動：
- 產生 Xcode project
- 編譯 iOS Simulator
- 上傳 `CITYMUS-iOS-Companion.zip` artifact（保留 14 天）

## 產生 Xcode 專案

1. macOS 安裝 Xcode 與 XcodeGen。
2. 執行：
   cd ios
   xcodegen generate
   open CITYMUS.xcodeproj
3. CITYMUS 與 CITYMUSWidgets 選擇同一 Apple Developer Team。
4. 在兩個 target 的 Signing & Capabilities 啟用同一個 App Group：
   group.com.easylearnfromtw.citymus
5. Build 到實機 iPhone。
6. 安裝 App 後，長按主畫面 → 加入小工具 → CITYMUS。

如更換 Bundle ID / App Group，必須同步修改 project.yml、兩份 entitlements 與 Shared/CITYMUSShared.swift。

## Web Bridge

Native 註冊 window.webkit.messageHandlers.citymus。
design-src/src/js/92-ios-bridge.js 只有在 Native WKWebView 中才會啟動，Safari / PWA 完全 no-op。

Web → Native：
ready / playback / artwork / recommendations / recommendationArtwork / city

Native → Web：
window.CITYMUSNative.perform(...)
支援 player / playpause / next / prev / track / radio / home。
