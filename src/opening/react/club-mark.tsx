/**
 * شعار نادي الثقافة والأدب.
 *
 * ⚠ ليس رسمًا تقريبيًّا: هذه الهندسة **مشتقّة بالقياس من ملف الشعار الرسمي**
 *   عبر `tools/derive-logo.mjs`. البناء أربع دوائر متساوية مراكزها أركان
 *   مستطيلٍ واحد، مضروبةٌ بقلمٍ ثابت ومقصوصةٌ بذلك المستطيل — بخطأ ملاءمةٍ
 *   يقلّ عن نصف بكسل. الألوان مقيسة لا مخمَّنة.
 *
 * ترتيب المجموعات يصنع التشابك (الفيروزيّ فوق يسارًا، والبنفسجيّ فوق
 * يمينًا)، وهو نفسه ما يتيح لشاشة الافتتاح أن تُركّب الشعار أمام الزائر.
 */
export function ClubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 167 107"
      role="img"
      aria-label="شعار نادي الثقافة والأدب"
      focusable="false"
    >
  <clipPath id="clubMarkClip"><rect width="167" height="107"/></clipPath>
  <g class="club-mark-plum" clipPath="url(#clubMarkClip)" fill="none"
     stroke="#612775" strokeWidth="12.47"><circle cx="-0.05" cy="1.68" r="71.68"/></g>
  <g class="club-mark-teal" clipPath="url(#clubMarkClip)" fill="none"
     stroke="#73a2b1" strokeWidth="12.47"><circle cx="-0.05" cy="105.32" r="71.68"/><circle cx="167.05" cy="105.32" r="71.68"/></g>
  <g class="club-mark-plum" clipPath="url(#clubMarkClip)" fill="none"
     stroke="#612775" strokeWidth="12.47"><circle cx="167.05" cy="1.68" r="71.68"/></g>
  <path class="club-mark-seed" fill="#73a2b1" d="M82 30A81.18 81.18 0 0 0 96 54A81.18 81.18 0 0 0 82 78A81.18 81.18 0 0 0 68 54A81.18 81.18 0 0 0 82 30Z"/>
    </svg>
  );
}
