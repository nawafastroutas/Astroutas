'use client';

/**
 * شاشة الدخول — <SplashScreen /> (React / Next.js drop-in)
 * ------------------------------------------------------------------
 * يستخدم نفس ملف `splash.css` ونفس الهوية البصرية.
 *
 * لماذا JSX تصريحي بدل تركيب يدوي (imperative mount)؟
 * لأن الشاشة تُرسَم ضمن HTML الأولي (SSR) فتظهر فورًا بلا وميض للصفحة.
 *
 * الحركات عبر CSS وليست عبر Framer Motion — لأن الشاشة يجب أن تُرسم
 * قبل تحميل أي JavaScript، وهذا أمر لا تستطيع مكتبة حركة توفيره.
 * (إن كانت framer-motion موجودة لديك، يمكنك تغليف المحتوى الداخلي بها
 *  دون المساس بمنطق التوقيت أدناه.)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULTS = {
  title: 'قسم الأنشطة الطلابية',
  tagline: 'نصنع تجربة طلابية استثنائية',
  minDuration: 950,
  maxDuration: 7000,
  exitDuration: 620,
  holdAfterComplete: 240,
};

const PROGRESS_CEILING = 0.92;

/**
 * الشعار مرسوم داخل الصفحة (inline SVG) بدل <img>:
 *  - يُرسم مع HTML الأوّلي (SSR) ⇒ لا طلب شبكة ولا وميض.
 *  - كل جزء (أسطر السرعة، السهم، حرف J) عنصر مستقل تحرّكه splash.css.
 */
export function BrandMark() {
  return (
    <svg
      className="splash__mark-svg"
      viewBox="160 196 692 610"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path className="mark-bar1" d="M262.3 405.9C264 405.5 553.1 405.2 555 405.5C556.9 405.7 558.9 406 560.6 406.9C562.3 407.7 564 409.1 565.1 410.5C566.2 411.8 567 413.4 567.6 415C568.1 416.6 568.3 418.4 568.3 420C568.2 421.6 567.7 423.2 567.1 424.6C566.5 426.1 565.6 427.6 564.4 428.8C563.2 430 561.3 431.2 559.5 432C557.7 432.7 555.2 433 553 433.2C550.8 433.4 268.9 433.4 267 433.2C265.1 433 262.8 432.6 261.4 432.1C260 431.6 258.7 430.9 257.5 430C256.3 429.1 254.9 427.7 254.1 426.4C253.3 425.1 252.8 423.5 252.5 422C252.3 420.5 252.3 417.5 252.6 416C252.9 414.5 253.4 413 254.3 411.7C255.1 410.4 256.3 409.1 257.6 408.1C258.9 407.2 260.6 406.3 262.3 405.9Z" />
      <path className="mark-bar2" d="M176.4 471.9C178.1 471.6 497.1 471.4 499 471.6C500.9 471.9 502.8 472.2 504.5 473C506.2 473.9 508 475.5 508.9 476.5C509.9 477.6 510.7 478.9 511.2 480.2C511.7 481.6 512.2 484.3 512.1 485.9C512.1 487.5 511.7 489.1 511.1 490.6C510.5 492.1 509.6 493.7 508.5 494.9C507.4 496.2 506 497.2 504.5 498C503 498.7 500.9 499.1 499 499.4C497.1 499.6 180.9 499.6 179 499.4C177.1 499.2 174.7 498.7 173.4 498.1C172.1 497.5 170.9 496.6 169.9 495.6C168.9 494.5 167.7 492.9 167 491.5C166.3 490.1 165.8 488.6 165.6 487C165.4 485.4 165.4 483.7 165.8 482.2C166.2 480.6 167.1 478.9 168 477.5C169 476.2 170.1 474.9 171.5 474C172.8 473.1 174.6 472.3 176.4 471.9Z" />
      <path className="mark-bar3" d="M268.4 537.9C270.4 537.6 445.2 537.3 448 537.8C450.8 538.2 454.5 539.1 456.2 540.3C457.9 541.6 459.3 543.7 460.1 545.4C460.9 547.1 461.2 549.1 461.1 551C461.1 552.8 460.6 554.7 459.8 556.3C458.9 557.9 457 559.8 456.1 560.5C455.2 561.3 454.1 561.9 452.9 562.3C451.8 562.7 449.7 563.1 448 563.2C446.3 563.4 271.6 563.4 270 563.2C268.4 563.1 266.4 562.6 265.2 562.2C264.1 561.8 263.1 561.2 262.1 560.5C261.2 559.7 259.7 558 258.9 556.6C258.1 555.2 257.7 553.6 257.5 552C257.3 550.4 257.4 548.7 257.8 547.2C258.2 545.6 259.5 543.5 260.1 542.6C260.8 541.6 261.5 540.7 262.5 540.1C263.5 539.4 266.3 538.3 268.4 537.9Z" />
      <path className="mark-arrow" d="M844.5 202C844.8 202 845.1 202.2 845.5 202.3C845.4 202.6 845.4 204 845.2 204.8C845.1 205.6 811.4 321 811.1 321.6C810.8 322.3 810.3 322.7 809.9 323.3L506 344.3C485.7 345.6 447.8 348.2 445 348.3C442.2 348.3 439.5 348.1 436.7 348C439.3 347.1 844.2 202.1 844.5 202Z" />
      <path className="mark-j" d="M796.4 346.9L801.8 346.8C802 347.5 802.2 348.1 802.2 348.8C802.2 349.5 710.3 661.8 708.2 667.8C706.2 673.9 703.8 679.9 701.2 685.8C698.7 691.7 694.2 701.1 690.4 707.8C686.6 714.6 681.6 722.2 677.9 727.4C674.2 732.6 670.1 737.6 665.8 742.4C661.5 747.2 655.2 753.5 650.4 757.8C645.6 762.1 639.8 766.8 635.4 769.9C631.1 773 626.1 775.9 621.8 778.4C617.5 780.8 612.8 783.2 608.6 785.1C604.4 787 600.2 788.8 595.8 790.2C591.5 791.7 580.9 794.9 574.9 796.2C569 797.5 561.6 798.6 557 799.2C552.3 799.7 547.7 800 543 800.2C538.3 800.4 533 800.4 528 800.2C523 800 511.7 799.1 506 798.3C500.3 797.5 494 796.4 489.1 795.2C484.1 794.1 479.2 792.7 474.3 791.1C469.5 789.5 458.9 785.4 454.2 783.2C449.6 781.1 445 778.6 440.6 775.9C436.1 773.2 428.1 767.6 425.7 765.7C423.2 763.9 420.9 761.9 418.6 759.8C416.3 757.7 410.6 752.5 407 748.5C403.4 744.5 398.8 738.8 396.3 735.3C393.7 731.8 391.3 728.2 389.1 724.4C386.9 720.7 383.7 714.5 381.9 710.7C380 706.8 378.3 702.8 376.8 698.8C375.3 694.8 373.3 688.8 371.9 683.6C370.6 678.5 368 666.1 367.8 663.9C367.6 661.8 367.9 659.6 367.9 657.4L480.9 617.6C481.3 618.1 481.9 618.6 482.2 619.2C482.5 619.8 485.4 633.4 487.7 639.8C490 646.3 493.9 654.6 496 658.5C498.1 662.3 501.2 667 503.1 669.4C504.9 671.9 506.8 674.3 508.9 676.5C511 678.8 514.7 682.3 516.6 683.8C518.5 685.3 520.6 686.6 522.6 687.9C524.7 689.1 526.9 690.4 529.1 691.4C531.3 692.4 534.4 693.6 537.2 694.3C539.9 695 548.3 696.7 554 696.5C559.7 696.4 568.2 694.1 570.8 693.3C573.4 692.4 575.9 691.2 578.3 689.8C580.8 688.5 584.2 686.5 586.9 684.5C589.5 682.4 595.2 677 598.1 673.6C601.1 670.1 603.6 666.3 605.9 662.4C608.2 658.5 611.1 652.7 613.2 647.7C615.3 642.6 617.6 635.9 619.3 629.8C621 623.8 677.2 358 677.8 355.3C680.5 354.8 683.2 354.1 686 353.8C688.8 353.4 794.6 347 796.4 346.9Z" />
    </svg>
  );
}

export default function SplashScreen({
  mark = <BrandMark />,
  title = DEFAULTS.title,
  tagline = DEFAULTS.tagline,
  minDuration = DEFAULTS.minDuration,
  maxDuration = DEFAULTS.maxDuration,
  exitDuration = DEFAULTS.exitDuration,
  holdAfterComplete = DEFAULTS.holdAfterComplete,
  waitFor,
  onDone,
}) {
  // 'loading' -> 'leaving' -> 'gone'
  const [phase, setPhase] = useState('loading');
  const rootRef = useRef(null);
  const fillRef = useRef(null);
  const barRef = useRef(null);
  const finishedRef = useRef(false);

  // نكتب التقدّم مباشرة على DOM: لا إعادة رسم لـ React في كل إطار.
  const paint = useCallback((value) => {
    const v = Math.min(1, Math.max(0, value));
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${v.toFixed(4)})`;
    barRef.current?.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }, []);

  useEffect(() => {
    if (phase !== 'loading') return undefined;

    const startedAt = performance.now();
    const timers = [];
    let raf = 0;
    let progress = 0;
    let cancelled = false;

    document.documentElement.classList.add('splash-lock');
    document.body.setAttribute('aria-busy', 'true');

    const tick = () => {
      progress += (PROGRESS_CEILING - progress) * 0.035;
      paint(progress);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = () => {
      if (finishedRef.current || cancelled) return;
      finishedRef.current = true;
      cancelAnimationFrame(raf);
      paint(1);
      timers.push(window.setTimeout(() => !cancelled && setPhase('leaving'), holdAfterComplete));
    };

    // سقف صارم — الشاشة لا تحجب المستخدم مهما تعثّر التحميل.
    timers.push(window.setTimeout(finish, maxDuration));

    const loaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((res) => window.addEventListener('load', () => res(), { once: true }));

    Promise.allSettled([loaded, document.fonts?.ready, ...(waitFor || [])]).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, minDuration - (performance.now() - startedAt));
      timers.push(window.setTimeout(finish, wait));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
    };
  }, [phase, minDuration, maxDuration, holdAfterComplete, waitFor, paint]);

  // مرحلة الخروج: نحرّر الصفحة فورًا ثم نزيل العنصر بعد انتهاء التلاشي.
  useEffect(() => {
    if (phase !== 'leaving') return undefined;

    document.documentElement.classList.remove('splash-lock');
    document.documentElement.classList.add('app-ready');
    document.body.removeAttribute('aria-busy');

    const el = rootRef.current;
    let removed = false;
    const settle = (event) => {
      if (event && event.target !== el) return; // تجاهُل انتقالات الأبناء
      if (removed) return;
      removed = true;
      setPhase('gone');
      onDone?.();
    };

    el?.addEventListener('transitionend', settle);
    const t = window.setTimeout(() => settle(null), exitDuration + 120);

    return () => {
      el?.removeEventListener('transitionend', settle);
      window.clearTimeout(t);
    };
  }, [phase, exitDuration, onDone]);

  if (phase === 'gone') return null;

  return (
    <div
      ref={rootRef}
      className={`splash${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="جارٍ فتح التطبيق"
      data-splash
    >
      <div className="splash__core">
        <div className="splash__mark">
          {mark}
          <span className="splash__sheen" aria-hidden="true" />
        </div>
        <p className="splash__title">{title}</p>
        <span className="splash__rule" aria-hidden="true" />
        <p className="splash__tagline">{tagline}</p>
      </div>

      <div className="splash__footer">
        <div
          ref={barRef}
          className="splash__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-label="نسبة التحميل"
        >
          <span ref={fillRef} className="splash__progress-fill" />
        </div>
        <span className="splash__status">
          {phase === 'leaving' ? 'جاهز' : 'جارٍ التحميل…'}
        </span>
      </div>
    </div>
  );
}
