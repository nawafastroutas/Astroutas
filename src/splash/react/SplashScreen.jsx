'use client';

/**
 * Astroutas — <SplashScreen /> (React / Next.js drop-in)
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
  logoSrc: '/assets/logo.svg',
  title: 'نادي الثقافة والأدب',
  tagline: 'كلمةٌ تُقال، وأثرٌ يبقى',
  minDuration: 950,
  maxDuration: 7000,
  exitDuration: 620,
  holdAfterComplete: 240,
};

const PROGRESS_CEILING = 0.92;

export default function SplashScreen({
  logoSrc = DEFAULTS.logoSrc,
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
      aria-label="جارٍ تحميل الموقع"
      data-splash
    >
      <div className="splash__core">
        <div className="splash__mark">
          <span className="splash__ring splash__ring--track" aria-hidden="true" />
          <span className="splash__ring splash__ring--arc" aria-hidden="true" />
          <span className="splash__ring splash__ring--arc-alt" aria-hidden="true" />
          <img
            className="splash__logo"
            src={logoSrc}
            alt=""
            aria-hidden="true"
            width={128}
            height={128}
            fetchPriority="high"
            decoding="sync"
          />
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
