import SwiftUI

@main
struct AstroQuizApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                // واجهة عربية بالكامل: اتجاه من اليمين لليسار مهما كانت لغة الجهاز.
                .environment(\.layoutDirection, .rightToLeft)
                .preferredColorScheme(.dark)
        }
    }
}
