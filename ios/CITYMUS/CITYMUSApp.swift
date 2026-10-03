import AVFAudio
import SwiftUI

enum CITYMUSAudioSession {
    static func configure() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.allowAirPlay])
            try session.setActive(true)
        } catch {
            // WKWebView playback still has its own fallback; never block launch.
        }
    }
}

@main
struct CITYMUSApp: App {
    @StateObject private var webModel = CITYMUSWebModel()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        CITYMUSAudioSession.configure()
    }

    var body: some Scene {
        WindowGroup {
            CITYMUSWebView(model: webModel)
                .ignoresSafeArea()
                .onOpenURL { webModel.handleDeepLink($0) }
                .onChange(of: scenePhase) { _, phase in
                    guard phase == .active else { return }
                    CITYMUSAudioSession.configure()
                    webModel.resumeSystemNowPlaying()
                }
        }
    }
}
