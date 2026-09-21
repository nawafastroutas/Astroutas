/**
 * نادي الثقافة والأدب — الدخولية (Entrance Screen)
 * ==================================================================
 * وحدة مستقلّة تمامًا: لا مكتبات، لا خطوط شبكة، لا أصول خارجية.
 *
 * المبدأ الحاكم — كما في أي شاشة تحميل محترمة:
 *   الاختفاء مرتبط بجاهزية الموقع الحقيقية، لا بمؤقّت وهمي.
 *   `minDuration` يمنع الوميض ويترك المشهد يكتمل،
 *   `maxDuration` سقف صارم: لا نحجب المستخدم مهما حدث.
 *
 * @module entrance
 */

/** @typedef {{text: string, by: string}} Verse */

/** @typedef {Object} EntranceOptions
 *  @property {string}   [title]        اسم النادي.
 *  @property {string}   [tagline]      العبارة تحت الاسم (اختيارية).
 *  @property {'ink'|'paper'|'night'} [theme] السمة البصرية.
 *  @property {Verse[]}  [verses]       أبيات تتبدّل أثناء التحميل.
 *  @property {number}   [verseInterval] مدّة بقاء البيت (ms).
 *  @property {number}   [letters]      عدد الحروف العائمة (0 = تعطيل).
 *  @property {number}   [minDuration]  أقل مدة ظهور.
 *  @property {number}   [maxDuration]  سقف صارم قبل الإخفاء القسري.
 *  @property {number}   [exitDuration] مدة طيّ الصفحة.
 *  @property {number}   [holdAfterComplete] وقفة بعد بلوغ 100%.
 *  @property {boolean}  [skippable]    إظهار زرّ التخطّي (و Esc).
 *  @property {number}   [skipAfter]    متى يظهر زرّ التخطّي (ms).
 *  @property {Promise[]}[waitFor]      وعود إضافية تُنتظر قبل الإخفاء.
 *  @property {string}   [appRoot]      عنصر الموقع — يُعطَّل أثناء العرض.
 *  @property {'always'|'session'} [once]
 *  @property {Element}  [mount]
 *  @property {Document} [document]
 */

/** أبيات مختارة — موثّقة النسبة. */
export const DEFAULT_VERSES = [
  { text: 'وخيرُ جليسٍ في الزمانِ كتابُ', by: 'المتنبّي' },
  { text: 'أنا الذي نظرَ الأعمى إلى أدبي — وأسمعَتْ كلماتي مَن بهِ صَمَمُ', by: 'المتنبّي' },
  { text: 'أنا البحرُ في أحشائِهِ الدُّرُّ كامنٌ — فهل سألوا الغوّاصَ عن صَدَفاتي', by: 'حافظ إبراهيم' },
  { text: 'إذا الشعبُ يومًا أرادَ الحياةَ — فلا بدَّ أن يستجيبَ القَدَرْ', by: 'أبو القاسم الشابّي' },
  { text: 'وما نيلُ المطالبِ بالتمنّي — ولكنْ تُؤخَذُ الدنيا غِلابا', by: 'أحمد شوقي' },
  { text: 'كُن جميلًا ترَ الوجودَ جميلا', by: 'إيليا أبو ماضي' },
];

export const ENTRANCE_DEFAULTS = {
  title: 'نادي الثقافة والأدب',
  tagline: 'كلية التربية بالرستاق',
  theme: 'ink',
  verses: DEFAULT_VERSES,
  verseInterval: 3200,
  letters: 16,
  minDuration: 2800,
  maxDuration: 9000,
  exitDuration: 620,
  holdAfterComplete: 160,
  skippable: true,
  skipAfter: 1100,
  appRoot: '[data-app-root]',
  once: 'always',
};

const SESSION_KEY = 'club:entrance-seen';
const PROGRESS_CEILING = 0.92;

/** حروف «أبجد هوّز» — ترتيب عربي أصيل، لمسة أدبية في الخلفية. */
const ABJAD = 'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/*  القالب — مفصول عن المتحكّم كي يمكن وضعه في HTML ثابت (أسرع رسم)   */
/*  أو توليده من React/Vue. الشعار SVG مضمّن لأنه يرسم نفسه بالقلم.    */
/* ------------------------------------------------------------------ */

/** الزخرفة الثمانية — تُرسم بـ stroke-dashoffset. pathLength=100 يوحّد الأطوال. */
const ORNAMENT = `
    <svg class="entrance__ornament" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle class="ent-ring-outer" cx="50" cy="50" r="46" pathLength="100"
              data-draw style="--draw-delay:620ms"></circle>
      <path class="ent-sq-a" d="M20 20H80V80H20Z" pathLength="100"
            data-draw style="--draw-delay:760ms"></path>
      <path class="ent-sq-b" d="M50 7.6 92.4 50 50 92.4 7.6 50Z" pathLength="100"
            data-draw style="--draw-delay:900ms"></path>
    </svg>`;

/**
 * الشعار الرسمي مرسومًا SVG — أربعة أقواس متشابكة وبذرة وسطى.
 * الألوان عبر متغيّرات CSS كي يتبدّل مع السمة (فاتح/داكن) تلقائيًا.
 * لاستبداله بالملف الرسمي: بدّل محتوى هذه الدالة فقط.
 */
const LOGO = `
    <svg class="entrance__logo" viewBox="0 0 120 120" role="img"
         aria-label="شعار نادي الثقافة والأدب" focusable="false">
      <g fill="none" stroke-linecap="round">
        <path class="ent-logo-arc" d="M48 24C4 40 4 80 48 96" stroke="var(--logo-plum)"
              stroke-width="6.5" pathLength="100" style="--draw-delay:840ms"></path>
        <path class="ent-logo-arc" d="M72 24C116 40 116 80 72 96" stroke="var(--logo-plum)"
              stroke-width="6.5" pathLength="100" style="--draw-delay:920ms"></path>
        <path class="ent-logo-arc" d="M58 32C30 44 30 76 58 88" stroke="var(--logo-teal)"
              stroke-width="5.5" pathLength="100" style="--draw-delay:1000ms"></path>
        <path class="ent-logo-arc" d="M62 32C90 44 90 76 62 88" stroke="var(--logo-teal)"
              stroke-width="5.5" pathLength="100" style="--draw-delay:1080ms"></path>
      </g>
      <path class="ent-logo-seed" d="M60 46C66.5 52 66.5 68 60 74C53.5 68 53.5 52 60 46Z"
            fill="var(--logo-plum)"></path>
    </svg>`;

/**
 * @param {EntranceOptions} [options]
 * @returns {string} HTML
 */
export function entranceMarkup(options = {}) {
  const { title, tagline, theme, skippable } = { ...ENTRANCE_DEFAULTS, ...options };
  const first = (options.verses || DEFAULT_VERSES)[0] || { text: '', by: '' };

  return `
<div class="entrance" data-entrance data-entrance-theme="${escapeHtml(theme)}"
     aria-label="شاشة الدخول — جارٍ فتح الموقع">
  <div class="entrance__bg" aria-hidden="true">
    <span class="entrance__glow"></span>
    <span class="entrance__grain"></span>
    <span class="entrance__letters" data-entrance-letters></span>
  </div>

  <div class="entrance__stage">
    <div class="entrance__mark">
      <span class="entrance__drop" aria-hidden="true"></span>
      <span class="entrance__blot" aria-hidden="true"></span>
${ORNAMENT}
${LOGO}
    </div>

    <p class="entrance__title">
      <span class="entrance__title-text">${escapeHtml(title)}</span>
      <span class="entrance__nib-track" aria-hidden="true">
        <span class="entrance__nib"></span>
      </span>
    </p>

    <span class="entrance__rule" aria-hidden="true"><i class="entrance__lozenge"></i></span>

    <figure class="entrance__verse" data-entrance-verse aria-hidden="true">
      <blockquote class="entrance__verse-text" data-entrance-verse-text>${escapeHtml(first.text)}</blockquote>
      <figcaption class="entrance__verse-by" data-entrance-verse-by>${escapeHtml(first.by)}</figcaption>
    </figure>
  </div>

  <div class="entrance__footer">
    <div class="entrance__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="0" aria-label="نسبة التحميل" data-entrance-progress>
      <span class="entrance__progress-fill" data-entrance-fill></span>
      <span class="entrance__progress-dot" data-entrance-dot aria-hidden="true"></span>
    </div>
    <span class="entrance__status" role="status" aria-live="polite"
          data-entrance-status>${escapeHtml(tagline)}</span>
    ${skippable ? `<button class="entrance__skip" type="button" data-entrance-skip>تخطّي المقدّمة</button>` : ''}
  </div>
</div>`.trim();
}

/* ------------------------------------------------------------------ */
/*  المتحكّم                                                           */
/* ------------------------------------------------------------------ */

/**
 * يشغّل الدخولية ويعيد متحكّمًا بها.
 * @param {EntranceOptions} [options]
 */
export function createEntrance(options = {}) {
  const config = { ...ENTRANCE_DEFAULTS, ...options };
  const doc = config.document || document;
  const root = doc.documentElement;
  const reduced = prefersReducedMotion();

  /** @type {HTMLElement|null} */
  let el = doc.querySelector('[data-entrance]');

  // زيارة متكرّرة في نفس الجلسة → نفتح الموقع فورًا بلا مقدّمة.
  if (config.once === 'session' && readFlag()) {
    el?.remove();
    root.classList.remove('entrance-lock');
    root.classList.add('app-ready');
    doc.body?.removeAttribute('aria-busy');
    return { skipped: true, finish() {}, destroy() {} };
  }

  if (!el) {
    const host = config.mount || doc.body;
    if (!host) {
      console.warn('[entrance] لا يوجد عنصر لإدراج الدخولية فيه.');
      return { skipped: true, finish() {}, destroy() {} };
    }
    host.insertAdjacentHTML('afterbegin', entranceMarkup(config));
    el = /** @type {HTMLElement} */ (doc.querySelector('[data-entrance]'));
    if (!el) return { skipped: true, finish() {}, destroy() {} };
  } else if (config.theme) {
    el.setAttribute('data-entrance-theme', config.theme);
  }

  const fill = el.querySelector('[data-entrance-fill]');
  const dot = el.querySelector('[data-entrance-dot]');
  const bar = el.querySelector('[data-entrance-progress]');
  const verseBox = el.querySelector('[data-entrance-verse]');
  const verseText = el.querySelector('[data-entrance-verse-text]');
  const verseBy = el.querySelector('[data-entrance-verse-by]');
  const skipBtn = el.querySelector('[data-entrance-skip]');
  const appRoot = config.appRoot ? doc.querySelector(config.appRoot) : null;

  const startedAt = performance.now();
  let progress = 0;
  let rafId = 0;
  let hardStop = 0;
  let verseTimer = 0;
  let skipTimer = 0;
  let done = false;

  root.classList.add('entrance-lock');
  doc.body?.setAttribute('aria-busy', 'true');
  lockApp(true);

  spawnLetters();
  startVerses();
  setupSkip();

  // مؤشّر التقدّم: يزحف بتباطؤ نحو سقف 92% ثم يُكمل عند الجاهزية الحقيقية.
  const tick = () => {
    progress += (PROGRESS_CEILING - progress) * 0.035;
    paint(progress);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // سقف صارم — لا نحجب المستخدم مهما تعثّر التحميل.
  hardStop = window.setTimeout(() => finish('timeout'), config.maxDuration);

  whenReady().then(() => {
    const elapsed = performance.now() - startedAt;
    window.setTimeout(() => finish('ready'), Math.max(0, config.minDuration - elapsed));
  });

  return {
    skipped: false,
    element: el,
    finish: () => finish('manual'),
    destroy,
  };

  /* ===================== الداخل ===================== */

  function paint(value) {
    const v = Math.min(1, Math.max(0, value));
    if (fill) fill.style.transform = `scaleX(${v.toFixed(4)})`;
    // النقطة تركب رأس الخط. نستخدم `left` لا `translateX` لأن النسبة
    // المئوية في transform تُقاس على عرض النقطة نفسها، لا على عرض الشريط.
    if (dot) {
      const rtl = getComputedStyle(el).direction !== 'ltr';
      dot.style.left = `${((rtl ? 1 - v : v) * 100).toFixed(2)}%`;
    }
    bar?.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }

  /** إشارات الجاهزية الحقيقية. allSettled: فشل صورة أو خط لا يُبقي الشاشة عالقة. */
  function whenReady() {
    return Promise.allSettled([
      doc.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((r) => window.addEventListener('load', () => r(), { once: true })),
      doc.fonts?.ready ?? Promise.resolve(),
      ...(config.waitFor || []),
    ]);
  }

  /** حروف أبجدية تتهادى صاعدة كغبارِ مكتبةٍ في شعاع ضوء. */
  function spawnLetters() {
    const host = el.querySelector('[data-entrance-letters]');
    if (!host || reduced || config.letters <= 0) return;
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < config.letters; i += 1) {
      const span = doc.createElement('span');
      span.className = 'entrance__letter';
      span.textContent = ABJAD[Math.floor(Math.random() * ABJAD.length)];
      span.setAttribute('aria-hidden', 'true');
      span.style.cssText =
        `--x:${(Math.random() * 100).toFixed(2)}%;` +
        `--size:${(0.9 + Math.random() * 2.1).toFixed(2)}rem;` +
        `--dur:${(13 + Math.random() * 12).toFixed(1)}s;` +
        `--delay:${(-Math.random() * 18).toFixed(1)}s;` +
        `--sway:${(Math.random() * 10 - 5).toFixed(1)}vw;` +
        `--turn:${(Math.random() * 50 - 25).toFixed(0)}deg;` +
        `--peak:${(0.12 + Math.random() * 0.2).toFixed(2)};`;
      frag.appendChild(span);
    }
    host.appendChild(frag);
  }

  /** تبديل أبيات الشعر — يبدأ من بيتٍ عشوائي فتختلف كل زيارة. */
  function startVerses() {
    const list = config.verses || [];
    if (!verseBox || !verseText || list.length < 2 || reduced) return;

    let i = Math.floor(Math.random() * list.length);
    show(list[i]);

    verseTimer = window.setInterval(() => {
      i = (i + 1) % list.length;
      const next = list[i];
      verseBox.classList.add('is-swapping');
      window.setTimeout(() => {
        show(next);
        verseBox.classList.remove('is-swapping');
      }, 460); // يطابق مدّة الانتقال في CSS
    }, config.verseInterval);

    function show(v) {
      verseText.textContent = v.text;
      if (verseBy) verseBy.textContent = v.by;
    }
  }

  /** التخطّي: زرّ يظهر بعد لحظة + مفتاح Esc. احترامًا لوقت الزائر. */
  function setupSkip() {
    if (!config.skippable) return;
    if (skipBtn) {
      skipTimer = window.setTimeout(
        () => skipBtn.classList.add('is-visible'),
        config.skipAfter
      );
      skipBtn.addEventListener('click', () => finish('skip'));
    }
    doc.addEventListener('keydown', onKey);
  }

  function onKey(event) {
    if (event.key === 'Escape') finish('skip');
  }

  function finish(reason) {
    if (done) return;
    done = true;

    cancelAnimationFrame(rafId);
    window.clearTimeout(hardStop);
    window.clearTimeout(skipTimer);
    window.clearInterval(verseTimer);
    doc.removeEventListener('keydown', onKey);
    skipBtn?.classList.remove('is-visible');

    paint(1);

    // عند التخطّي لا نُضيف وقفة — الزائر طلب العبور الآن.
    const hold = reason === 'skip' ? 0 : config.holdAfterComplete;

    window.setTimeout(() => {
      el?.classList.add('is-leaving');
      // المحتوى يبدأ بالدخول أثناء الطيّ — انتقال متداخل أنعم بكثير.
      release();

      let removed = false;
      const settle = (event) => {
        // transitionend يتصاعد من الأبناء — نتجاهل ما ليس الشاشة نفسها.
        if (event && event.target !== el) return;
        if (removed) return;
        removed = true;
        el?.removeEventListener('transitionend', settle);
        el?.remove();
        el = null;
        lockApp(false);
        doc.dispatchEvent(new CustomEvent('club:entrance-done', { detail: { reason } }));
      };
      el?.addEventListener('transitionend', settle);
      // شبكة أمان: لو أُلغيت الحركة أو كانت التبويبة مخفية.
      window.setTimeout(() => settle(null), config.exitDuration + 140);
    }, hold);
  }

  function lockApp(locked) {
    if (!appRoot) return;
    if (locked) {
      appRoot.setAttribute('inert', '');
      appRoot.setAttribute('aria-hidden', 'true');
    } else {
      appRoot.removeAttribute('inert');
      appRoot.removeAttribute('aria-hidden');
    }
  }

  function release() {
    root.classList.remove('entrance-lock');
    root.classList.add('app-ready');
    doc.body?.removeAttribute('aria-busy');
    if (config.once === 'session') writeFlag();
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    window.clearTimeout(hardStop);
    window.clearTimeout(skipTimer);
    window.clearInterval(verseTimer);
    doc.removeEventListener('keydown', onKey);
    done = true;
    el?.remove();
    el = null;
    release();
    lockApp(false);
  }

  function readFlag() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false; // التصفّح الخاص
    }
  }

  function writeFlag() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* تجاهُل */
    }
  }
}

/** ترقيم عناصر الدخول تلقائيًا للحصول على تتابُع (stagger). */
export function indexEnterTargets(scope = document) {
  scope.querySelectorAll('[data-entrance-enter]').forEach((node, i) => {
    node.style.setProperty('--entrance-enter-index', String(i));
  });
}
