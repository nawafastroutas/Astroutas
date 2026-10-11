import SwiftUI

/// ألوان الهوية البصرية — نفس متغيّرات شاشة التحميل في المشروع.
enum Theme {
    static let night  = Color(red: 0.024, green: 0.086, blue: 0.173)  // #06162c
    static let deep   = Color(red: 0.012, green: 0.047, blue: 0.106)
    static let blue   = Color(red: 0.118, green: 0.435, blue: 0.851)  // #1e6fd9
    static let orange = Color(red: 0.961, green: 0.521, blue: 0.122)  // #f5851f
    static let green  = Color(red: 0.102, green: 0.737, blue: 0.541)
    static let red    = Color(red: 0.918, green: 0.263, blue: 0.325)
    static let muted  = Color.white.opacity(0.60)
    static let card   = Color.white.opacity(0.06)
    static let stroke = Color.white.opacity(0.10)

    static var background: LinearGradient {
        LinearGradient(
            colors: [deep, night, Color(red: 0.047, green: 0.133, blue: 0.251)],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    static var brand: LinearGradient {
        LinearGradient(colors: [orange, Color(red: 0.98, green: 0.69, blue: 0.27)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

/// هالتان ضوئيتان خلف المحتوى تعطيان عمقًا بدون تكلفة أداء.
struct Backdrop: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.blue.opacity(0.35))
                .frame(width: 320, height: 320)
                .blur(radius: 90)
                .offset(x: -110, y: -260)

            Circle()
                .fill(Theme.orange.opacity(0.22))
                .frame(width: 280, height: 280)
                .blur(radius: 100)
                .offset(x: 130, y: 300)
        }
        .allowsHitTesting(false)
    }
}

/// بطاقة زجاجية موحّدة لكل الشاشات.
struct GlassCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Theme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(Theme.stroke, lineWidth: 1)
                    )
            )
    }
}

/// شريحة صغيرة لعرض قيمة مع عنوانها.
struct StatChip: View {
    let title: String
    let value: String
    var tint: Color = .white

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(tint)
                .monospacedDigit()
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Theme.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Theme.stroke, lineWidth: 1)
                )
        )
    }
}

/// الزر الرئيسي (ابدأ / مرة أخرى).
struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.night)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 17)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Theme.brand)
                )
                .shadow(color: Theme.orange.opacity(0.35), radius: 18, y: 8)
        }
        .buttonStyle(.plain)
    }
}

/// علامة اللعبة: علامة استفهام عربية داخل دائرة متوهّجة.
struct LogoMark: View {
    var size: CGFloat = 104

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(colors: [Theme.blue.opacity(0.9), Theme.night],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .overlay(Circle().stroke(Theme.orange.opacity(0.55), lineWidth: 2))
                .shadow(color: Theme.blue.opacity(0.5), radius: 24, y: 10)

            Text("؟")
                .font(.system(size: size * 0.52, weight: .black))
                .foregroundStyle(Theme.brand)
        }
        .frame(width: size, height: size)
    }
}
