import Foundation
import Observation

/// منطق اللعبة كله في مكان واحد: الجولة، الوقت، النقاط، والانتقال للسؤال التالي.
@Observable
final class QuizEngine {

    enum Phase: Equatable { case idle, playing, finished }
    enum AnswerState: Equatable { case waiting, correct, wrong, timeout }

    /// عدد أسئلة الجولة الواحدة.
    static let roundSize = 10
    /// الوقت المتاح للسؤال الواحد بالثواني.
    static let questionTime: Double = 15
    /// مدة إظهار الجواب الصحيح قبل الانتقال.
    static let revealDelay: Double = 1.15

    private static let bestKey = "astroquiz.bestScore"

    private(set) var phase: Phase = .idle
    private(set) var deck: [Question] = []
    private(set) var index = 0
    private(set) var score = 0
    private(set) var correctCount = 0
    private(set) var streak = 0
    private(set) var bestStreak = 0
    private(set) var selectedOption: Int?
    private(set) var state: AnswerState = .waiting
    private(set) var timeLeft: Double = QuizEngine.questionTime
    private(set) var lastGain = 0
    private(set) var best = UserDefaults.standard.integer(forKey: QuizEngine.bestKey)
    private(set) var isNewRecord = false

    // تفاصيل داخلية لا تخصّ الواجهة، فلا داعي لمراقبتها.
    @ObservationIgnored private var advanceWork: DispatchWorkItem?
    @ObservationIgnored private var clock: Timer?

    private static let tickInterval: Double = 0.05

    // MARK: - قراءات جاهزة للواجهة

    var current: Question? {
        deck.indices.contains(index) ? deck[index] : nil
    }

    var questionNumber: Int { min(index + 1, max(deck.count, 1)) }

    var progress: Double {
        guard !deck.isEmpty else { return 0 }
        return Double(index) / Double(deck.count)
    }

    var timeFraction: Double {
        max(0, min(1, timeLeft / QuizEngine.questionTime))
    }

    var isRevealing: Bool { state != .waiting }

    // MARK: - الجولة

    func start() {
        advanceWork?.cancel()
        advanceWork = nil
        deck = QuestionBank.all
            .shuffled()
            .prefix(QuizEngine.roundSize)
            .map { $0.shuffledOptions() }
        index = 0
        score = 0
        correctCount = 0
        streak = 0
        bestStreak = 0
        lastGain = 0
        isNewRecord = false
        resetQuestionState()
        phase = .playing
        startClock()
        Haptics.tap()
    }

    func quit() {
        advanceWork?.cancel()
        advanceWork = nil
        stopClock()
        phase = .idle
    }

    /// يُنادى من المؤقّت الداخلي كل جزء من الثانية.
    func tick(_ delta: Double) {
        guard phase == .playing, state == .waiting else { return }
        timeLeft = max(0, timeLeft - delta)
        if timeLeft == 0 { timeOut() }
    }

    func choose(_ option: Int) {
        guard phase == .playing, state == .waiting, let question = current else { return }
        selectedOption = option

        if option == question.answerIndex {
            state = .correct
            correctCount += 1
            streak += 1
            bestStreak = max(bestStreak, streak)
            lastGain = 100 + speedBonus + streakBonus
            score += lastGain
            Haptics.success()
        } else {
            state = .wrong
            streak = 0
            lastGain = 0
            Haptics.error()
        }

        scheduleAdvance()
    }

    /// للتقدّم فورًا بلمسة على الشاشة بدل انتظار المهلة.
    func advanceNow() {
        guard phase == .playing, isRevealing else { return }
        advance()
    }

    // MARK: - تفاصيل داخلية

    /// حتى 60 نقطة إضافية لمن يجيب بسرعة.
    private var speedBonus: Int { Int((timeLeft / QuizEngine.questionTime) * 60) }

    /// 15 نقطة لكل إجابة متتالية صحيحة، بسقف 60.
    private var streakBonus: Int { min(max(streak - 1, 0), 4) * 15 }

    private func timeOut() {
        state = .timeout
        selectedOption = nil
        streak = 0
        lastGain = 0
        Haptics.error()
        scheduleAdvance()
    }

    private func scheduleAdvance() {
        advanceWork?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.advance() }
        advanceWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + QuizEngine.revealDelay, execute: work)
    }

    private func advance() {
        advanceWork?.cancel()
        advanceWork = nil
        guard phase == .playing else { return }

        if index + 1 >= deck.count {
            finish()
        } else {
            index += 1
            resetQuestionState()
        }
    }

    private func resetQuestionState() {
        selectedOption = nil
        state = .waiting
        timeLeft = QuizEngine.questionTime
        lastGain = 0
    }

    private func startClock() {
        stopClock()
        // `.common` حتى لا يتوقف العدّ أثناء أي تفاعل مع الواجهة.
        let timer = Timer(timeInterval: QuizEngine.tickInterval, repeats: true) { [weak self] _ in
            self?.tick(QuizEngine.tickInterval)
        }
        RunLoop.main.add(timer, forMode: .common)
        clock = timer
    }

    private func stopClock() {
        clock?.invalidate()
        clock = nil
    }

    private func finish() {
        stopClock()
        phase = .finished
        if score > best {
            best = score
            isNewRecord = score > 0
            UserDefaults.standard.set(score, forKey: QuizEngine.bestKey)
        }
    }

    deinit {
        clock?.invalidate()
        advanceWork?.cancel()
    }
}
