import SwiftUI

struct ResultView: View {
    let engine: QuizEngine
    @State private var ringProgress: Double = 0

    private var total: Int { max(engine.deck.count, 1) }
    private var ratio: Double { Double(engine.correctCount) / Double(total) }

    private var grade: String {
        switch ratio {
        case 1:         return "علامة كاملة! 🏆"
        case 0.8..<1:   return "ممتاز 👏"
        case 0.6..<0.8: return "جيد جدًا"
        case 0.4..<0.6: return "جيد"
        default:        return "حاول مرة أخرى 💪"
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 16)

            Text("انتهت الجولة")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.muted)

            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.10), lineWidth: 12)

                Circle()
                    .trim(from: 0, to: ringProgress)
                    .stroke(Theme.brand, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))

                VStack(spacing: 2) {
                    Text("\(engine.score)")
                        .font(.system(size: 44, weight: .black))
                        .foregroundStyle(.white)
                        .monospacedDigit()
                    Text("نقطة")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.muted)
                }
            }
            .frame(width: 190, height: 190)
            .padding(.top, 14)

            Text(grade)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(.white)
                .padding(.top, 18)

            if engine.isNewRecord {
                Text("رقم قياسي جديد")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.night)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(Theme.brand))
                    .padding(.top, 10)
            }

            Spacer(minLength: 16)

            HStack(spacing: 10) {
                StatChip(title: "إجابات صحيحة", value: "\(engine.correctCount)/\(total)", tint: Theme.green)
                StatChip(title: "أطول متتالية", value: "\(engine.bestStreak)")
                StatChip(title: "أفضل نتيجة", value: "\(engine.best)", tint: Theme.orange)
            }
            .padding(.horizontal, 22)

            PrimaryButton(title: "مرة أخرى") { engine.start() }
                .padding(.horizontal, 22)
                .padding(.top, 18)

            Button("القائمة الرئيسية") { engine.quit() }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .padding(.top, 14)

            Spacer(minLength: 18)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.9).delay(0.15)) {
                ringProgress = ratio
            }
        }
    }
}
