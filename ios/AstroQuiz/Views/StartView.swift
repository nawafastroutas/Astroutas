import SwiftUI

struct StartView: View {
    let engine: QuizEngine
    @State private var glow = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)

            LogoMark(size: 112)
                .scaleEffect(glow ? 1.04 : 1.0)
                .animation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true), value: glow)

            Text("لعبة أسئلة")
                .font(.system(size: 38, weight: .black))
                .foregroundStyle(.white)
                .padding(.top, 22)

            Text("قسم الأنشطة الطلابية")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.orange)
                .padding(.top, 6)

            Text("عشرة أسئلة، \(Int(QuizEngine.questionTime)) ثانية لكل سؤال.\nأسرع جواب صحيح = نقاط أكثر.")
                .font(.system(size: 16))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.top, 14)
                .padding(.horizontal, 24)

            Spacer(minLength: 24)

            HStack(spacing: 10) {
                StatChip(title: "أفضل نتيجة", value: "\(engine.best)", tint: Theme.orange)
                StatChip(title: "عدد الأسئلة", value: "\(QuestionBank.all.count)")
                StatChip(title: "التصنيفات", value: "\(Category.allCases.count)")
            }
            .padding(.horizontal, 22)

            PrimaryButton(title: "ابدأ اللعب") { engine.start() }
                .padding(.horizontal, 22)
                .padding(.top, 18)

            Text("لمسة واحدة لكل جواب — والنتيجة تظهر فورًا.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
                .padding(.top, 14)

            Spacer(minLength: 18)
        }
        .onAppear { glow = true }
    }
}
