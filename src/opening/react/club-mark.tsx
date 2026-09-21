/**
 * شعار نادي الثقافة والأدب.
 *
 * مقسوم نصفين مرآتيّين — `club-mark-left` و`club-mark-right` — وبينهما
 * `club-mark-seed`. هذا التقسيم هو ما يتيح لشاشة الافتتاح أن تُركّب الشعار
 * أمام الزائر بدل أن تعرضه جاهزًا. الألوان عبر متغيّرات CSS كي يعمل الشعار
 * على الأبيض وعلى الداكن بلا نسختين.
 *
 * ⚠ هذه إعادة بناء متجهيّة للشعار الرسمي (وصلنا كصورة لا كملف متجه).
 *    عند توفّر الملف الرسمي: بدّل مسارات <path> فقط، وأبقِ أسماء الأصناف
 *    الثلاثة كما هي كي تبقى حركة التركيب تعمل.
 */
export function ClubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      role="img"
      aria-label="شعار نادي الثقافة والأدب"
      focusable="false"
    >
      <g className="club-mark-right" fill="none" strokeLinecap="round">
        <path d="M72 24C116 40 116 80 72 96" stroke="var(--club-plum, #7a2d76)" strokeWidth="6.5" />
        <path d="M62 32C90 44 90 76 62 88" stroke="var(--club-teal, #8cbfc0)" strokeWidth="5.5" />
      </g>
      <g className="club-mark-left" fill="none" strokeLinecap="round">
        <path d="M48 24C4 40 4 80 48 96" stroke="var(--club-plum, #7a2d76)" strokeWidth="6.5" />
        <path d="M58 32C30 44 30 76 58 88" stroke="var(--club-teal, #8cbfc0)" strokeWidth="5.5" />
      </g>
      <path
        className="club-mark-seed"
        d="M60 46C66.5 52 66.5 68 60 74C53.5 68 53.5 52 60 46Z"
        fill="var(--club-plum, #7a2d76)"
      />
    </svg>
  );
}
