import Foundation
import SwiftUI
import WebKit
import WidgetKit

@MainActor
final class CITYMUSWebModel: NSObject, ObservableObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    static let handlerName = "citymus"

    weak var webView: WKWebView?
    private var didLoad = false
    private var webReady = false
    private var pendingCommand: [String: Any]?
    private var reloadWork: DispatchWorkItem?

    func attach(_ webView: WKWebView) { self.webView = webView }

    func resumeSystemNowPlaying() {
        let s = CITYMUSShared.playback
        guard !s.shareID.isEmpty,
              Date().timeIntervalSince(s.updatedAt) < 12 * 60 * 60 else { return }
        CITYMUSNowPlaying.shared.update(s)
        if s.isPlaying { send(["action":"player"]) }
    }

    func loadHomeIfNeeded() {
        guard !didLoad, let webView else { return }
        didLoad = true
        var c = URLComponents(url: CITYMUSShared.webURL, resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "source", value: "ios")]
        webView.load(URLRequest(url: c.url!))
    }

    func handleDeepLink(_ url: URL) {
        guard url.scheme?.lowercased() == "citymus" else {
            if ["http","https"].contains(url.scheme?.lowercased() ?? "") {
                webView?.load(URLRequest(url: url))
            }
            return
        }

        let c = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let q = Dictionary(uniqueKeysWithValues: (c?.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        let host = (url.host ?? "").lowercased()
        let path = url.path.split(separator: "/").map(String.init)

        switch host {
        case "player": send(["action":"player"])
        case "track": send(["action":"track", "trackId": path.first ?? q["id"] ?? ""])
        case "radio": send(["action":"radio", "theme": q["theme"] ?? "taipei-dream"])
        case "action": send(["action": q["name"] ?? "player"])
        case "home": send(["action":"home"])
        default: send(["action": host.isEmpty ? "home" : host])
        }
    }

    func send(_ command: [String: Any]) {
        guard webReady, let webView else { pendingCommand = command; return }
        guard JSONSerialization.isValidJSONObject(command),
              let data = try? JSONSerialization.data(withJSONObject: command),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.CITYMUSNative?.perform(\(json));")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("window.CITYMUSNative?.publishAll?.();")
        resumeSystemNowPlaying()
    }

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme?.lowercased() == "citymus" {
            handleDeepLink(url)
            decisionHandler(.cancel)
            return
        }

        // Keep http(s) links inside the CITYMUS companion instead of handing
        // target=_blank navigation to Safari or another application.
        if ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
           navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName,
              let p = message.body as? [String: Any],
              let type = p["type"] as? String else { return }

        switch type {
        case "ready":
            webReady = true
            if let cmd = pendingCommand { pendingCommand = nil; send(cmd) }
            scheduleReload()

        case "playback":
            var s = CITYMUSShared.playback
            s.shareID = p["shareId"] as? String ?? s.shareID
            s.title = p["title"] as? String ?? s.title
            s.artist = p["artist"] as? String ?? s.artist
            s.theme = p["theme"] as? String ?? s.theme
            s.themeSlug = p["themeSlug"] as? String ?? s.themeSlug
            s.isPlaying = p["isPlaying"] as? Bool ?? s.isPlaying
            s.position = p["position"] as? Double ?? s.position
            s.duration = p["duration"] as? Double ?? s.duration
            s.updatedAt = .now
            CITYMUSShared.playback = s
            CITYMUSNowPlaying.shared.update(s)
            scheduleReload()

        case "artwork":
            guard let id = p["shareId"] as? String,
                  let dataURL = p["dataURL"] as? String,
                  let file = CITYMUSShared.writeDataURL(dataURL, filename: "current-artwork.jpg") else { return }
            var s = CITYMUSShared.playback
            guard s.shareID == id else { return }
            s.artworkFile = file
            s.updatedAt = .now
            CITYMUSShared.playback = s
            CITYMUSNowPlaying.shared.update(s)
            scheduleReload()

        case "recommendations":
            guard let raw = p["items"] as? [[String: Any]] else { return }
            CITYMUSShared.recommendations = Array(raw.prefix(3).map {
                RecommendationSnapshot(
                    shareID: $0["shareId"] as? String ?? "",
                    title: $0["title"] as? String ?? "CITYMUS",
                    artist: $0["artist"] as? String ?? "",
                    theme: $0["theme"] as? String ?? "",
                    artworkFile: nil
                )
            })
            scheduleReload()

        case "recommendationArtwork":
            guard let id = p["shareId"] as? String,
                  let dataURL = p["dataURL"] as? String else { return }
            let file = "rec-\(CITYMUSShared.safeFileComponent(id)).jpg"
            guard CITYMUSShared.writeDataURL(dataURL, filename: file) != nil else { return }
            var items = CITYMUSShared.recommendations
            if let i = items.firstIndex(where: { $0.shareID == id }) {
                items[i].artworkFile = file
                CITYMUSShared.recommendations = items
                scheduleReload()
            }

        case "city":
            CITYMUSShared.city = CityContextSnapshot(
                name: p["name"] as? String ?? "Taipei",
                displayName: p["displayName"] as? String ?? "台北",
                themeSlug: p["themeSlug"] as? String ?? "taipei-dream",
                updatedAt: .now
            )
            scheduleReload()

        default: break
        }
    }

    private func scheduleReload() {
        reloadWork?.cancel()
        let work = DispatchWorkItem { WidgetCenter.shared.reloadAllTimelines() }
        reloadWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: work)
    }
}

struct CITYMUSWebView: UIViewRepresentable {
    @ObservedObject var model: CITYMUSWebModel

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsAirPlayForMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        let uc = WKUserContentController()
        uc.add(model, name: CITYMUSWebModel.handlerName)
        config.userContentController = uc

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = model
        web.uiDelegate = model
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .clear

        model.attach(web)
        model.loadHomeIfNeeded()
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: ()) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: CITYMUSWebModel.handlerName)
    }
}
