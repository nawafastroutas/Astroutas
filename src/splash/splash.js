/**
 * Astroutas — Splash / Loading Screen controller
 * ------------------------------------------------------------------
 * وحدة مستقلة بالكامل (Zero dependencies) وقابلة لإعادة الاستخدام.
 *
 * المبدأ: الاختفاء مرتبط بجاهزية التطبيق الحقيقية — لا تأخير مصطنع.
 *  - `minDuration` يمنع "الوميض" إذا كان الموقع مخزّنًا مؤقتًا (cache).
 *  - `maxDuration` سقف صارم: الشاشة لا تحجب المستخدم مهما حدث.
 *
 * @module splash
 */

/** @typedef {Object} SplashOptions
 *  @property {string}   [logoSrc]      مسار شعار الكلية.
 *  @property {string}   [title]        العنوان تحت الشعار.
 *  @property {string}   [tagline]      العبارة الصغيرة تحت العنوان.
 *  @property {number}   [minDuration]  أقل مدة ظهور (ms).
 *  @property {number}   [maxDuration]  أقصى مدة ظهور قبل الإخفاء القسري (ms).
 *  @property {number}   [exitDuration] مدة تأثير الاختفاء (ms).
 *  @property {number}   [holdAfterComplete] وقفة قصيرة بعد وصول المؤشر 100%.
 *  @property {Promise[]}[waitFor]      وعود إضافية تُنتظر قبل الإخفاء.
 *  @property {string}   [appRoot]      مُحدِّد عنصر التطبيق (لتعطيله أثناء التحميل).
 *  @property {'always'|'session'} [once] تكرار الظهور.
 *  @property {Element}  [mount]        عنصر الإدراج (افتراضيًا <body>).
 *  @property {Document} [document]
 */

/** @type {Required<Pick<SplashOptions,'logoSrc'|'title'|'tagline'|'minDuration'|'maxDuration'|'exitDuration'|'holdAfterComplete'|'appRoot'|'once'>>} */
export const SPLASH_DEFAULTS = {
  logoSrc: 'assets/logo.svg',
  title: 'نادي الثقافة والأدب',
  tagline: 'كلمةٌ تُقال، وأثرٌ يبقى',
  minDuration: 950,
  maxDuration: 7000,
  exitDuration: 620,
  holdAfterComplete: 240,
  appRoot: '[data-app-root]',
  once: 'always',
};

const SESSION_KEY = 'astroutas:splash-seen';
const PROGRESS_CEILING = 0.92;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);

/**
 * قالب الشاشة. مفصول عن المتحكّم حتى يمكن حقنه في HTML ثابت (أسرع رسم)
 * أو إنشاؤه ديناميكيًا من React/Vue.
 * @param {SplashOptions} [options]
 * @returns {string} HTML
 */
export function splashMarkup(options = {}) {
  const { logoSrc, title, tagline } = { ...SPLASH_DEFAULTS, ...options };
  return `
<div class="splash" id="splash" role="status" aria-live="polite"
     aria-label="جارٍ تحميل الموقع" data-splash>
  <div class="splash__core">
    <div class="splash__mark">
      <span class="splash__ring splash__ring--track" aria-hidden="true"></span>
      <span class="splash__ring splash__ring--arc" aria-hidden="true"></span>
      <span class="splash__ring splash__ring--arc-alt" aria-hidden="true"></span>
      <img class="splash__logo" src="${escapeHtml(logoSrc)}" alt="" aria-hidden="true"
           width="128" height="128" fetchpriority="high" decoding="sync">
    </div>
    <p class="splash__title">${escapeHtml(title)}</p>
    <span class="splash__rule" aria-hidden="true"></span>
    <p class="splash__tagline">${escapeHtml(tagline)}</p>
  </div>

  <div class="splash__footer">
    <div class="splash__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="0" aria-label="نسبة التحميل" data-splash-progress>
      <span class="splash__progress-fill" data-splash-fill></span>
    </div>
    <span class="splash__status" data-splash-status>جارٍ التحميل…</span>
  </div>
</div>`.trim();
}

/**
 * يشغّل شاشة التحميل ويعيد متحكّمًا بها.
 * @param {SplashOptions} [options]
 */
export function createSplash(options = {}) {
  const config = { ...SPLASH_DEFAULTS, ...options };
  const doc = config.document || document;
  const root = doc.documentElement;

  /** @type {HTMLElement|null} */
  let el = doc.querySelector('[data-splash]');
  const wasPreRendered = Boolean(el);

  const skip = config.once === 'session' && readSessionFlag();
  if (skip) {
    // مسار مبكّر: لا نلمس lockApp/finalise هنا لأن `appRoot` لم يُهيّأ بعد.
    el?.remove();
    root.classList.remove('splash-lock');
    root.classList.add('app-ready');
    doc.body?.removeAttribute('aria-busy');
    return { skipped: true, finish: () => {}, destroy: () => {} };
  }

  if (!el) {
    const host = config.mount || doc.body;
    if (!host) {
      // استُدعيت الوحدة قبل وجود <body> — لا نُسقط الصفحة بخطأ.
      console.warn('[splash] لا يوجد عنصر لإدراج شاشة التحميل فيه.');
      return { skipped: true, finish: () => {}, destroy: () => {} };
    }
    host.insertAdjacentHTML('afterbegin', splashMarkup(config));
    el = /** @type {HTMLElement} */ (doc.querySelector('[data-splash]'));
    if (!el) return { skipped: true, finish: () => {}, destroy: () => {} };
  }

  const fill = el.querySelector('[data-splash-fill]');
  const bar = el.querySelector('[data-splash-progress]');
  const status = el.querySelector('[data-splash-status]');
  const appRoot = config.appRoot ? doc.querySelector(config.appRoot) : null;

  const startedAt = performance.now();
  let progress = 0;
  let rafId = 0;
  let hardStop = 0;
  let done = false;

  root.classList.add('splash-lock');
  doc.body?.setAttribute('aria-busy', 'true');
  lockApp(true);

  // ---- مؤشر التقدّم: يزحف بسلاسة نحو سقف 92% ثم يُكمل عند الجاهزية ----
  const tick = () => {
    // كلما اقترب من السقف تباطأ — إحساس طبيعي بدل قفزات عشوائية
    progress += (PROGRESS_CEILING - progress) * 0.035;
    paint(progress);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // ---- سقف صارم: لا تحجب المستخدم أبدًا ----
  hardStop = window.setTimeout(() => finish('timeout'), config.maxDuration);

  whenReady().then(() => {
    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, config.minDuration - elapsed);
    window.setTimeout(() => finish('ready'), wait);
  });

  return { skipped: false, element: el, finish: () => finish('manual'), destroy };

  // ==================== helpers ====================

  function paint(value) {
    const clamped = Math.min(1, Math.max(0, value));
    if (fill) fill.style.transform = `scaleX(${clamped.toFixed(4)})`;
    bar?.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
  }

  /** إشارات الجاهزية الحقيقية للتطبيق */
  function whenReady() {
    const signals = [documentLoaded(), fontsReady(), ...(config.waitFor || [])];
    // allSettled: فشل خط أو صورة يجب ألا يُبقي الشاشة عالقة
    return Promise.allSettled(signals);
  }

  function documentLoaded() {
    if (doc.readyState === 'complete') return Promise.resolve();
    return new Promise((resolve) =>
      window.addEventListener('load', () => resolve(), { once: true })
    );
  }

  function fontsReady() {
    return doc.fonts?.ready ?? Promise.resolve();
  }

  function finish(reason) {
    if (done) return;
    done = true;

    cancelAnimationFrame(rafId);
    window.clearTimeout(hardStop);

    paint(1);
    if (status) status.textContent = 'جاهز';

    window.setTimeout(() => {
      el?.classList.add('is-leaving');
      // المحتوى يبدأ بالظهور أثناء تلاشي الشاشة — انتقال متداخل أنعم
      finalise(false);

      const remove = () => {
        el?.remove();
        el = null;
        lockApp(false);
        doc.dispatchEvent(
          new CustomEvent('astroutas:splash-done', { detail: { reason } })
        );
      };

      // transitionend + مؤقّت احتياطي (لو أُلغيت الحركة أو كانت التبويبة مخفية)
      let removed = false;
      const settle = (event) => {
        // انتباه: transitionend يتصاعد من الأبناء (شريط التقدّم) —
        // نتجاهله ما لم يكن انتقال الشاشة نفسها.
        if (event && event.target !== el) return;
        if (removed) return;
        removed = true;
        el?.removeEventListener('transitionend', settle);
        remove();
      };
      el?.addEventListener('transitionend', settle);
      window.setTimeout(() => settle(null), config.exitDuration + 120);
    }, config.holdAfterComplete);
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

  function destroy() {
    cancelAnimationFrame(rafId);
    window.clearTimeout(hardStop);
    done = true;
    el?.remove();
    el = null;
    lockApp(false);
    finalise(false);
  }

  function finalise(immediate) {
    root.classList.remove('splash-lock');
    root.classList.add('app-ready');
    doc.body?.removeAttribute('aria-busy');
    if (config.once === 'session') writeSessionFlag();
    if (immediate) lockApp(false);
  }

  function readSessionFlag() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false; // وضع التصفح الخاص
    }
  }

  function writeSessionFlag() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* تجاهُل */
    }
  }
}

/** ترقيم عناصر الدخول تلقائيًا للحصول على تتابُع (stagger). */
export function indexEnterTargets(scope = document) {
  scope.querySelectorAll('[data-splash-enter]').forEach((node, i) => {
    node.style.setProperty('--splash-enter-index', String(i));
  });
}
