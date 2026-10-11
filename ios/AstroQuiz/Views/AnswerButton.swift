import SwiftUI

struct AnswerButton: View {
    let letter: String
    let text: String
    let isCorrect: Bool
    let isSelected: Bool
    let revealing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(letter)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(badgeInk)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(badgeFill))

                Text(text)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(isCorrect ? Theme.green : Theme.red)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(fill)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(border, lineWidth: revealing && (isCorrect || isSelected) ? 1.6 : 1)
                    )
            )
            .opacity(dimmed ? 0.45 : 1)
            .scaleEffect(revealing && isCorrect ? 1.02 : 1)
        }
        .buttonStyle(.plain)
        .disabled(revealing)
        .animation(.easeOut(duration: 0.22), value: revealing)
    }

    // MARK: - المظهر حسب الحالة

    private var dimmed: Bool { revealing && !isCorrect && !isSelected }

    private var fill: Color {
        guard revealing else { return Theme.card }
        if isCorrect { return Theme.green.opacity(0.20) }
        if isSelected { return Theme.red.opacity(0.20) }
        return Theme.card
    }

    private var border: Color {
        guard revealing else { return Theme.stroke }
        if isCorrect { return Theme.green }
        if isSelected { return Theme.red }
        return Theme.stroke
    }

    private var badgeFill: Color {
        if revealing && isCorrect { return Theme.green }
        if revealing && isSelected { return Theme.red }
        return Color.white.opacity(0.12)
    }

    private var badgeInk: Color {
        (revealing && (isCorrect || isSelected)) ? Theme.night : Theme.orange
    }

    private var icon: String? {
        guard revealing else { return nil }
        if isCorrect { return "checkmark.circle.fill" }
        if isSelected { return "xmark.circle.fill" }
        return nil
    }
}
