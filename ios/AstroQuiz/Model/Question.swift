import Foundation

/// تصنيف السؤال — يظهر كشريحة صغيرة أعلى السؤال.
enum Category: String, CaseIterable {
    case general   = "معلومات عامة"
    case science   = "علوم"
    case geography = "جغرافيا"
    case math      = "رياضيات"
    case culture   = "ثقافة وأدب"
    case tech      = "تقنية"
    case sports    = "رياضة"
}

/// سؤال واحد بأربعة خيارات، أحدها صحيح.
struct Question: Identifiable {
    let id = UUID()
    let category: Category
    let text: String
    let options: [String]
    let answerIndex: Int

    /// في بنك الأسئلة يُكتب الجواب الصحيح أولًا دائمًا، تسهيلًا للمراجعة.
    init(_ category: Category, _ text: String, correct: String, wrong: [String]) {
        self.category = category
        self.text = text
        self.options = [correct] + wrong
        self.answerIndex = 0
    }

    private init(category: Category, text: String, options: [String], answerIndex: Int) {
        self.category = category
        self.text = text
        self.options = options
        self.answerIndex = answerIndex
    }

    /// نسخة بخيارات مخلوطة — تُستدعى عند توزيع أسئلة الجولة.
    func shuffledOptions() -> Question {
        let correct = options[answerIndex]
        let mixed = options.shuffled()
        return Question(
            category: category,
            text: text,
            options: mixed,
            answerIndex: mixed.firstIndex(of: correct) ?? 0
        )
    }
}
