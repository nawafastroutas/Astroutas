/**
 * شاشة الافتتاح — نادي الثقافة والأدب.
 * نصفا الشعار يتقاربان كيدين تلتقيان، ثم تتفتّح البذرة بينهما.
 *
 * القواعد خمس، وكلٌّ منها يمنع عطلًا بعينه:
 * - تُعرض مرة واحدة لكل جلسة تصفّح، لا مع كل تنقّل.
 * - تُتجاوَز كليًا مع «تقليل الحركة»، أو إن فُتح الموقع في تبويب خلفي.
 * - شبكة أمان زمنية تُخفيها مهما حدث، فلا تحجب الموقع أبدًا.
 * - الموقع مرسوم تحتها من البداية، فلا تؤخّر المحتوى ولا تحجبه عن محركات البحث.
 * - القرار يسبق الرسم لا يتبعه — انظر CLUB_SPLASH_BOOT — فهذه الوحدة لا تكشف
 *   الشاشة بل تُنهيها.
 *
 * والخروج ليس انزياح ستارة: ينتقل الشعار نفسه إلى موضعه في الهيدر بينما
 * ينقشع البياض، فيبدو الموقع وكأنه تجمّع لا وكأنه كُشف. يقيس الانتقال
 * الموضعين لحظة الخروج، فيظل صحيحًا مهما تغيّر مقاس الهيدر أو موضعه. وإن غاب
 * شعار الهيدر رجع الخروج إلى تلاشٍ بسيط.
 *
 * @module club-splash
 */

const RUN = 1080;
const EXIT = 480;

/**
 * قرار العرض — يُنفَّذ قبل أول رسمة.
 *
 * الشاشة تُرسم ظاهرة، وإلا رأى الزائر المحتوى ثم غطّته الشاشة بعده، وهو أسوأ
 * من غيابها. ولأنها تُرسم ظاهرة فلا بدّ من قرارٍ متزامن يسبق الرسم، لا تأثيرٍ
 * يجري بعده.
 *
 * القرار يُنفَّذ بحقن <style> لا بسمة على <html>، فذلك يعمل كما هو في React
 * أيضًا: React يقارن سمات الجذر عند الهيدريشن، فسمةٌ يكتبها سكربت قبله تُعدّ
 * اختلافًا ويُسجَّل خطأ. أما <style> مُضاف من خارج الشجرة فلا يقارنه أحد.
 *
 * `?splash=1` يفرض العرض متجاوزًا علامة الجلسة والتبويب الخلفي — للمعاينة
 * دون مسح تخزين المتصفّح في كل مرة.
 *
 * ضعه inline في <head>، قبل أي شيء آخر.
 */
export const CLUB_SPLASH_BOOT =
  `(function(){var f=location.search.indexOf('splash=1')>-1,s=false;` +
  `try{if(!f&&(sessionStorage.getItem('club-splash-seen')||document.visibilityState!=='visible')){s=true}` +
  `else{sessionStorage.setItem('club-splash-seen','1')}}catch(e){s=!f}` +
  `window.__clubSplashSkip=s;if(s){var e=document.createElement('style');` +
  `e.textContent='.club-splash{display:none}';document.head.appendChild(e)}})()`;

/**
 * يُنهي شاشة الافتتاح. القالب موجود في HTML أصلًا — هذه الوحدة لا تنشئه.
 *
 * @param {Object}  [options]
 * @param {string}  [options.root='.club-splash']        حاوية الشاشة.
 * @param {string}  [options.headerMark='.club-header-mark'] هدف الطيران.
 * @param {number}  [options.run=1080]  مدّة بقاء الشاشة قبل الخروج (ms).
 * @param {number}  [options.exit=480]  مدّة الخروج (ms).
 * @param {Document}[options.document]
 * @returns {{ skipped: boolean, close: () => void }}
 */
export function createClubSplash(options = {}) {
  const doc = options.document || document;
  const run = options.run ?? RUN;
  const exit = options.exit ?? EXIT;

  const root = doc.querySelector(options.root || '.club-splash');
  if (!root) return { skipped: true, close() {} };

  // القرار اتُّخذ قبل الرسم؛ هنا نحترمه فقط.
  if (window.__clubSplashSkip) return { skipped: true, close() {} };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { skipped: true, close() {} };

  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';

  const target = doc.querySelector(options.headerMark || '.club-header-mark');
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(leave);
    clearTimeout(end);
    clearTimeout(failsafe);
    root.hidden = true;
    doc.body.style.overflow = previousOverflow;
    if (target) target.style.visibility = '';
    doc.dispatchEvent(new CustomEvent('club:splash-done'));
  };

  /** ينقل الشعار من وسط الشاشة إلى موضعه في الهيدر. */
  const fly = () => {
    const mark = root.querySelector('.club-splash-mark');
    if (!mark || !target || typeof mark.animate !== 'function') return false;
    const from = mark.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.height || !to.height) return false;
    const scale = to.height / from.height;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // يُخفى شعار الهيدر أثناء الطيران كي لا يظهر شعاران في اللحظة نفسها
    target.style.visibility = 'hidden';
    mark.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }],
      { duration: exit, easing: 'cubic-bezier(0.6, 0, 0.3, 1)', fill: 'both' },
    );
    return true;
  };

  const leave = setTimeout(() => {
    root.dataset.leaving = fly() ? 'fly' : 'fade';
  }, run);
  const end = setTimeout(close, run + exit);
  // شبكة أمان: مهما تعطّل الانتقال، لا تبقى الطبقة فوق الموقع
  const failsafe = setTimeout(close, run + exit + 3000);

  return { skipped: false, close };
}
