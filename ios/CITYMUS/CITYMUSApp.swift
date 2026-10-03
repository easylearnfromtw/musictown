import SwiftUI

@main
struct CITYMUSApp: App {
    @StateObject private var webModel = CITYMUSWebModel()

    var body: some Scene {
        WindowGroup {
            CITYMUSWebView(model: webModel)
                .ignoresSafeArea()
                .onOpenURL { webModel.handleDeepLink($0) }
        }
    }
}
