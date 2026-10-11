import SwiftUI

struct RootView: View {
    @State private var engine = QuizEngine()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            Backdrop()

            switch engine.phase {
            case .idle:
                StartView(engine: engine)
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
            case .playing:
                QuizView(engine: engine)
                    .transition(.opacity)
            case .finished:
                ResultView(engine: engine)
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
            }
        }
        .animation(.easeInOut(duration: 0.32), value: engine.phase)
        .tint(Theme.orange)
    }
}

#Preview {
    RootView()
        .environment(\.layoutDirection, .rightToLeft)
        .preferredColorScheme(.dark)
}
