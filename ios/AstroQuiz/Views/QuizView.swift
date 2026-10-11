import SwiftUI

struct QuizView: View {
    let engine: QuizEngine

    private static let letters = ["أ", "ب", "ج", "د"]

    var body: some View {
        ZStack {
            // لمسة في أي مكان فارغ = انتقال فوري للسؤال التالي أثناء إظهار الجواب.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture { engine.advanceNow() }

            VStack(spacing: 18) {
                header

                timeBar

                if let question = engine.current {
                    VStack(spacing: 18) {
                        categoryRow(question)
                        questionCard(question)
                        answers(question)
                    }
                    .id(question.id)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .animation(.easeInOut(duration: 0.25), value: engine.index)
        }
    }

    // MARK: - الأجزاء

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                engine.quit()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Theme.card))
            }
            .buttonStyle(.plain)

            Spacer()

            Text("سؤال \(engine.questionNumber) من \(engine.deck.count)")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .monospacedDigit()

            Spacer()

            HStack(spacing: 6) {
                if engine.state == .correct, engine.lastGain > 0 {
                    Text("+\(engine.lastGain)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.green)
                        .monospacedDigit()
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                Text("\(engine.score)")
                    .font(.system(size: 19, weight: .black))
                    .foregroundStyle(.white)
                    .monospacedDigit()
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: engine.state)
        }
    }

    private var timeBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.10))
                Capsule()
                    .fill(engine.timeFraction < 0.34 ? Theme.red : Theme.orange)
                    .frame(width: max(0, geo.size.width * engine.timeFraction))
            }
        }
        .frame(height: 8)
        .animation(.linear(duration: 0.08), value: engine.timeFraction)
    }

    private func categoryRow(_ question: Question) -> some View {
        HStack {
            Text(question.category.rawValue)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.orange)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(Theme.orange.opacity(0.14)))

            Spacer()

            if engine.streak >= 2 {
                Text("متتالية ×\(engine.streak)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.green)
                    .monospacedDigit()
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Theme.green.opacity(0.14)))
                    .transition(.scale.combined(with: .opacity))
            }

            Text("\(Int(engine.timeLeft.rounded(.up)))")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(engine.timeFraction < 0.34 ? Theme.red : .white)
                .monospacedDigit()
                .frame(minWidth: 26)
        }
        .animation(.easeOut(duration: 0.2), value: engine.streak)
    }

    private func questionCard(_ question: Question) -> some View {
        GlassCard {
            Text(question.text)
                .font(.system(size: 23, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(6)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 18)
                .padding(.vertical, 26)
        }
    }

    private func answers(_ question: Question) -> some View {
        VStack(spacing: 11) {
            ForEach(Array(question.options.enumerated()), id: \.offset) { pair in
                AnswerButton(
                    letter: Self.letters[min(pair.offset, Self.letters.count - 1)],
                    text: pair.element,
                    isCorrect: engine.isRevealing && pair.offset == question.answerIndex,
                    isSelected: engine.selectedOption == pair.offset,
                    revealing: engine.isRevealing
                ) {
                    engine.choose(pair.offset)
                }
            }

            if engine.state == .timeout {
                Text("انتهى الوقت!")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.red)
                    .padding(.top, 2)
                    .transition(.opacity)
            }
        }
    }
}
