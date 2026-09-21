'use client';

/**
 * نادي الثقافة والأدب — الدخولية لـ React / Next.js
 * ------------------------------------------------------------------
 * المكوّن يُرسَم ضمن HTML الأوّلي (SSR) فيظهر فورًا بلا وميض، ثم يتولّى
 * `createEntrance` قيادته بعد التركيب — وهي نفس الوحدة المستخدمة في
 * النسخة العادية، فلا ازدواج في المنطق ولا في القياسات.
 *
 * الاستعمال في app/layout.jsx:
 *
 *   import '@/styles/entrance.css';
 *   import EntranceScreen from '@/components/EntranceScreen';
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="ar" dir="rtl" className="js">
 *         <body>
 *           <EntranceScreen theme="ink" once="session" />
 *           <div data-app-root>{children}</div>
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * لا تنسَ السكربت التمهيدي في الـ layout (شبكة الأمان الزمنية) —
 * انظر README.
 */

import { useEffect, useRef } from 'react';
import { createEntrance, DEFAULT_VERSES } from '../entrance.js';

export default function EntranceScreen({
  title = 'نادي الثقافة والأدب',
  tagline = 'كلية التربية بالرستاق',
  theme = 'ink',
  verses = DEFAULT_VERSES,
  skippable = true,
  once = 'always',
  appRoot = '[data-app-root]',
  waitFor,
  onDone,
  ...rest
}) {
  const handle = useRef(null);
  const first = verses[0] || { text: '', by: '' };

  useEffect(() => {
    handle.current = createEntrance({
      title, tagline, theme, verses, skippable, once, appRoot, waitFor, ...rest,
    });

    const done = (event) => onDone?.(event.detail);
    document.addEventListener('club:entrance-done', done);

    return () => {
      document.removeEventListener('club:entrance-done', done);
      handle.current?.destroy();
    };
    // مرّة واحدة عمدًا: الدخولية حدثٌ يقع عند الإقلاع، لا حالة تُعاد مزامنتها.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="entrance" data-entrance data-entrance-theme={theme}
         aria-label="شاشة الدخول — جارٍ فتح الموقع">
      <div className="entrance__bg" aria-hidden="true">
        <span className="entrance__glow" />
        <span className="entrance__grain" />
        <span className="entrance__letters" data-entrance-letters />
      </div>

      <div className="entrance__stage">
        <div className="entrance__mark">
          <span className="entrance__drop" aria-hidden="true" />
          <span className="entrance__blot" aria-hidden="true" />

          {/* الزخرفة الثمانية — تُرسم بالقلم ثم تدور ببطء */}
          <svg className="entrance__ornament" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle className="ent-ring-outer" cx="50" cy="50" r="46" pathLength="100"
                    data-draw style={{ '--draw-delay': '620ms' }} />
            <path className="ent-sq-a" d="M20 20H80V80H20Z" pathLength="100"
                  data-draw style={{ '--draw-delay': '760ms' }} />
            <path className="ent-sq-b" d="M50 7.6 92.4 50 50 92.4 7.6 50Z" pathLength="100"
                  data-draw style={{ '--draw-delay': '900ms' }} />
          </svg>

          {/* الشعار — أقواسه ترسم نفسها، ثم تتفتّح البذرة الوسطى */}
          <svg className="entrance__logo" viewBox="0 0 120 120" role="img"
               aria-label={`شعار ${title}`} focusable="false">
            <g fill="none" strokeLinecap="round">
              <path className="ent-logo-arc" d="M48 24C4 40 4 80 48 96" stroke="var(--logo-plum)"
                    strokeWidth="6.5" pathLength="100" style={{ '--draw-delay': '840ms' }} />
              <path className="ent-logo-arc" d="M72 24C116 40 116 80 72 96" stroke="var(--logo-plum)"
                    strokeWidth="6.5" pathLength="100" style={{ '--draw-delay': '920ms' }} />
              <path className="ent-logo-arc" d="M58 32C30 44 30 76 58 88" stroke="var(--logo-teal)"
                    strokeWidth="5.5" pathLength="100" style={{ '--draw-delay': '1000ms' }} />
              <path className="ent-logo-arc" d="M62 32C90 44 90 76 62 88" stroke="var(--logo-teal)"
                    strokeWidth="5.5" pathLength="100" style={{ '--draw-delay': '1080ms' }} />
            </g>
            <path className="ent-logo-seed" d="M60 46C66.5 52 66.5 68 60 74C53.5 68 53.5 52 60 46Z"
                  fill="var(--logo-plum)" />
          </svg>
        </div>

        <p className="entrance__title">
          <span className="entrance__title-text">{title}</span>
          <span className="entrance__nib-track" aria-hidden="true">
            <span className="entrance__nib" />
          </span>
        </p>

        <span className="entrance__rule" aria-hidden="true">
          <i className="entrance__lozenge" />
        </span>

        <figure className="entrance__verse" data-entrance-verse aria-hidden="true">
          <blockquote className="entrance__verse-text" data-entrance-verse-text>{first.text}</blockquote>
          <figcaption className="entrance__verse-by" data-entrance-verse-by>{first.by}</figcaption>
        </figure>
      </div>

      <div className="entrance__footer">
        <div className="entrance__progress" role="progressbar" aria-valueMin={0} aria-valueMax={100}
             aria-valueNow={0} aria-label="نسبة التحميل" data-entrance-progress>
          <span className="entrance__progress-fill" data-entrance-fill />
          <span className="entrance__progress-dot" data-entrance-dot aria-hidden="true" />
        </div>
        <span className="entrance__status" role="status" aria-live="polite"
              data-entrance-status>{tagline}</span>
        {skippable && (
          <button className="entrance__skip" type="button" data-entrance-skip>تخطّي المقدّمة</button>
        )}
      </div>
    </div>
  );
}
