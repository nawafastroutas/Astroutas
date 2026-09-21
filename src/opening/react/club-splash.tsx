'use client';
import { useEffect, useRef } from 'react';
import { ClubMark } from './club-mark';

/**
 * شاشة الافتتاح — تركيب الشعار.
 * نصفا الشعار يتقاربان كيدين تلتقيان، ثم تتفتّح البذرة بينهما.
 *
 * القواعد خمس، وكلٌّ منها يمنع عطلًا بعينه:
 * - تُعرض مرة واحدة لكل جلسة تصفّح، لا مع كل تنقّل.
 * - تُتجاوَز كليًا مع «تقليل الحركة»، أو إن فُتح الموقع في تبويب خلفي.
 * - شبكة أمان زمنية تُخفيها مهما حدث، فلا تحجب الموقع أبدًا.
 * - الموقع مرسوم تحتها من البداية، فلا تؤخّر المحتوى ولا تحجبه عن محركات البحث.
 * - القرار يسبق الرسم لا يتبعه — انظر ClubSplashBoot — فهذا المكوّن لا يكشف
 *   الشاشة بل يُنهيها.
 *
 * والخروج ليس انزياح ستارة: ينتقل الشعار نفسه إلى موضعه في الهيدر بينما
 * ينقشع البياض، فيبدو الموقع وكأنه تجمّع لا وكأنه كُشف. يقيس الانتقال
 * الموضعين لحظة الخروج، فيظل صحيحًا مهما تغيّر مقاس الهيدر أو موضعه. وإن غاب
 * شعار الهيدر رجع الخروج إلى تلاشٍ بسيط.
 */
const RUN = 1080;
const EXIT = 480;

export function ClubSplash({
  title = 'نادي الثقافة والأدب',
  sub = 'كلية التربية بالرستاق',
}: {
  title?: string;
  sub?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if ((window as { __clubSplashSkip?: boolean }).__clubSplashSkip) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target = document.querySelector<HTMLElement>('.club-header-mark');

    const close = () => {
      root.hidden = true;
      document.body.style.overflow = previousOverflow;
      if (target) target.style.visibility = '';
    };

    /** ينقل الشعار من وسط الشاشة إلى موضعه في الهيدر. */
    const fly = () => {
      const mark = root.querySelector<SVGSVGElement>('.club-splash-mark');
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
        [
          { transform: 'none' },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        ],
        {
          duration: EXIT,
          easing: 'cubic-bezier(0.6, 0, 0.3, 1)',
          fill: 'both',
        },
      );
      return true;
    };

    const leave = setTimeout(() => {
      root.dataset.leaving = fly() ? 'fly' : 'fade';
    }, RUN);
    const end = setTimeout(close, RUN + EXIT);
    // شبكة أمان: مهما تعطّل الانتقال، لا تبقى الطبقة فوق الموقع
    const failsafe = setTimeout(close, RUN + EXIT + 3000);

    return () => {
      clearTimeout(leave);
      clearTimeout(end);
      clearTimeout(failsafe);
      close();
    };
  }, []);

  return (
    <div className="club-splash" ref={rootRef}>
      <div className="club-splash-veil" />
      <ClubMark className="club-splash-mark" />
      <div className="club-splash-copy">
        <p className="club-splash-title">{title}</p>
        <p className="club-splash-sub">{sub}</p>
      </div>
      <output className="club-sr-only">جارٍ فتح الموقع</output>
    </div>
  );
}
