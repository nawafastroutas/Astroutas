# شاشات التحميل — قسم الأنشطة الطلابية (Astroutas)

اثنتا عشرة شاشة تحميل (Splash / Loading Screen)، **واحدة لكل نادٍ**، فوق نواة
تقنية مشتركة واحدة.

- **بدون أي مكتبة خارجية** — ولا خطوط من الإنترنت. Zero dependencies.
- الحركات عبر CSS/`requestAnimationFrame` — أداء عالٍ على الجوال.
- عربية و **RTL** بالكامل، ومتجاوبة من ٣٢٠px حتى الشاشات الكبيرة.
- الاختفاء مرتبط **بجاهزية التطبيق الحقيقية**، لا بمؤقّت وهمي.

```bash
npx http-server -p 8080 -c-1 .
# ثم افتح http://localhost:8080/sites/   ← معرض الشاشات الاثنتي عشرة
```

---

## الشاشات الاثنتا عشرة

| # | النادي | المفهوم البصري | ما يرسم نسبة التحميل |
|---|---|---|---|
| ٠١ | نادي الثقافة والأدب | مخطوطة بإطار مذهّب، أوراق تُقلَب | حبرٌ يسري في السطر |
| ٠٢ | نادي الرياضة والصحة | تخطيط قلب يعبر الشاشة | حلقة تكتمل حول الشعار |
| ٠٣ | نادي الفلك | كواكب على مدارات مائلة وسط غبار نجمي | قوس مداري |
| ٠٤ | نادي الطلبة الدوليين | كرة أرضية سلكية تدور ومسارات سفر | طائرة تقطع المسار |
| ٠٥ | نادي المسرح | ستارتان مخمليّتان تحت ضوء كاشف | صفّ مصابيح يضيء تباعًا |
| ٠٦ | نادي المناظرات | طرفان متقابلان وميزان | الميزان يهدأ حتى يستوي |
| ٠٧ | نادي الإعلام والتصوير | حدقة عدسة داخل إطار كاميرا | الحدقة تتّسع فتكشف الشعار |
| ٠٨ | النادي العلمي | دورق فوق شبكة جزيئية | السائل يرتفع في الدورق |
| ٠٩ | عشيرة الجوالة والجوالات | بوصلة فوق خطوط كنتور | دربٌ يُقطع نحو الخيمة |
| ١٠ | نادي العمل التطوعي | قلب ودوائر تتّسع | حلقة الأثر يكبر قطرها |
| ١١ | نادي الفنون | لوحة ألوان على قماش | ضربة فرشاة تُدهن |
| ١٢ | نادي اللغات | حلقة حروف من لغات مختلفة | سطرٌ يُكتب حرفًا حرفًا |

كل شاشة تصميم مستقل تمامًا: تخطيط وحركة ولوحة ألوان خاصة بها.

---

## البنية

```
src/splash/
  core.css              النواة المشتركة: المسرح، القفل، الخروج، شبكات الأمان
  splash.js             المتحكّم: التقدّم، الجاهزية، الخروج  (مشترك للجميع)
  sites.json            ← المصدر الوحيد لبيانات المواقع الاثني عشر
  themes/NN-slug.css    تصميم كل نادٍ  (١٢ ملفًا)
  themes/NN-slug.html   قالب شاشة كل نادٍ  (١٢ ملفًا)
  splash.css            ثيم القسم الأصلي، قائم بذاته — يخدم index.html
  react/SplashScreen.jsx نسخة React / Next.js

sites/<slug>/index.html   ١٢ صفحة جاهزة (مولَّدة)
sites/index.html          المعرض (مولَّد)
assets/club-site.css      معاينة موقع النادي خلف الشاشة
assets/gallery.css        تنسيق المعرض
tools/build_sites.py      يولّد صفحات sites/ من sites.json + القوالب
```

> صفحات `sites/` **مولَّدة** — لا تحرّرها يدويًا. حرّر `sites.json` أو ملف الثيم
> ثم شغّل `python3 tools/build_sites.py`. الهدف أن يبقى الهيكل المشترك
> (ترتيب `<head>`، شبكة الأمان، وسم التشغيل) معرَّفًا في مكان واحد بدل نسخه
> اثنتي عشرة مرة. بايثون أداة تطوير فقط — المخرجات ملفات ثابتة بلا أي اعتماد
> وقت التشغيل.

---

## التعديلات الشائعة

**تغيير اسم نادٍ أو عبارته أو نصوص حالته** — سطر واحد في `src/splash/sites.json`:

```json
{ "slug": "astronomy", "name": "نادي الفلك", "tagline": "…",
  "loadingText": "نرصد السماء…", "readyText": "الرؤية صافية" }
```

**تغيير ألوان نادٍ** — المتغيّرات أعلى ملف ثيمه:

```css
:root {
  --ast-gold: #f6c445;
  --ast-violet: #7c6cf0;
  /* عقد الألوان الذي تقرأه صفحة النادي خلف الشاشة */
  --club-accent: var(--ast-gold);
}
```

ثم `python3 tools/build_sites.py`. (`colors` في `sites.json` تخدم بطاقة المعرض
و`<meta name="theme-color">`، فحدّثها معها.)

**وضع شعار النادي الرسمي** — داخل قالب الثيم علامة `<!-- شعار النادي -->` فوق
الـ SVG المؤقّت. استبدله بشعاركم؛ ولو كان ملفًا خارجيًا:

```html
<img class="ast__sun" src="../../assets/marks/astronomy.svg" alt=""
     width="128" height="128" fetchpriority="high" decoding="sync">
```

وأضف في `<head>`: `<link rel="preload" as="image" href="…">`.

---

## كيف يصل التقدّم إلى التصميم

`splash.js` لا يفترض شكلًا لمؤشّر التحميل. في كل إطار يكتب متغيّرين على عنصر
الشاشة، وكل ثيم يترجمهما كما يشاء:

| المتغيّر | القيمة |
|---|---|
| `--splash-progress` | `0` → `1` |
| `--splash-progress-pct` | `0` → `100` |

```css
/* حلقة */      background: conic-gradient(from -90deg, gold calc(var(--splash-progress) * 360deg), transparent 0);
/* سائل يرتفع */ transform: translateY(calc(106px - var(--splash-progress) * 60px));
/* مسار يُرسَم */ stroke-dashoffset: calc(100 - var(--splash-progress) * 100);  /* مع pathLength="100" */
/* كشف تدريجي */ clip-path: inset(0 0 0 calc((1 - var(--splash-progress)) * 100%));
```

وهناك خطّافات جاهزة في القالب:

| الخطّاف | الدور |
|---|---|
| `data-splash` | جذر الشاشة (مطلوب) |
| `data-splash-progress` | عنصر `role="progressbar"` — تُحدَّث `aria-valuenow` عليه |
| `data-splash-status` | نص الحالة |
| `data-splash-percent` | يُكتب فيه الرقم `0…100` |
| `data-splash-fill` | يُطبَّق عليه `scaleX()` — للشريط الأفقي الكلاسيكي |
| `data-splash-enter` | عناصر الموقع التي تدخل بتتابُع بعد الاختفاء |
| `data-app-root` | يُعطَّل بـ `inert` أثناء التحميل |

---

## إضافة نادٍ ثالث عشر

1. أضف مُدخَله في `src/splash/sites.json`.
2. أنشئ `src/splash/themes/13-slug.css` — عرّف فيه ألوانه وعقد `--club-*`.
3. أنشئ `src/splash/themes/13-slug.html` — استعمل العلامات
   `{{name}}` و`{{tagline}}` و`{{loading}}` و`{{aria}}` (وأي علامة خاصة عبر
   حقل `extra` في `sites.json`).
4. `python3 tools/build_sites.py`.

---

## الدمج في موقع حقيقي

الترتيب داخل `<head>` **مقصود ومهم**: نواة الشاشة وثيم النادي هما ملفّا التنسيق
الوحيدان اللذان يحجبان الرسم — وهما صغيران — فتظهر الشاشة فورًا؛ أما تنسيق
الموقع فيُحمَّل بشكل غير حاجب حتى لا يؤخّرها.

```html
<link rel="stylesheet" href="src/splash/core.css">
<link rel="stylesheet" href="src/splash/themes/03-astronomy.css">

<script>
  /* يضع الصنف js + شبكة أمان زمنية تحرّر الموقع لو فشل تحميل splash.js */
  (function () {
    var r = document.documentElement;
    r.classList.add('js');
    setTimeout(function () {
      if (r.classList.contains('app-ready')) return;
      r.classList.remove('splash-lock');
      r.classList.add('app-ready');
      var s = document.querySelector('[data-splash]');
      if (s) s.remove();
      if (document.body) document.body.removeAttribute('aria-busy');
    }, 10000);
  })();
</script>

<link rel="stylesheet" href="css/site.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="css/site.css"></noscript>
```

ثم في `<body>`: ضع قالب الشاشة (انسخه من `sites/<slug>/index.html`) كأول عنصر،
ولُفّ موقعك بعنصر يحمل `data-app-root`، وأضف `data-splash-enter` لأي عنصر تريده
يدخل بلطف بعد الاختفاء. وأخيرًا:

```html
<script type="module">
  import { createSplash, indexEnterTargets } from './src/splash/splash.js';
  indexEnterTargets();
  createSplash({
    appRoot: '[data-app-root]',
    loadingText: 'نرصد السماء…',
    readyText: 'الرؤية صافية',
    sessionKey: 'astroutas:splash:astronomy',   // مفتاح مستقل لكل موقع
  });
</script>
```

> إن لم تضع القالب في HTML، تُنشئه الوحدة تلقائيًا بالتصميم الافتراضي — لكن وضعه
> في HTML أسرع ظهورًا لأنه لا ينتظر تحميل الـ JavaScript، وهو **الطريقة الوحيدة**
> للحصول على تصميم النادي الخاص.

---

## الدمج في React / Next.js

انسخ `core.css` وملف ثيم النادي و`SplashScreen.jsx`، ثم في `app/layout.jsx`:

```jsx
import '@/styles/splash-core.css';
import '@/styles/themes/03-astronomy.css';
import SplashScreen from '@/components/SplashScreen';

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="js">
      <body>
        <SplashScreen logoSrc="/assets/logo.svg" />
        <div data-app-root>{children}</div>
      </body>
    </html>
  );
}
```

المكوّن يُرسَم ضمن HTML الأولي (SSR) فيظهر فورًا بلا وميض. أضف نفس السكربت
التمهيدي أعلاه في الـ layout للحصول على شبكة الأمان نفسها. (المكوّن يحمل القالب
الافتراضي — لاستعمال تصميم نادٍ بعينه، انقل قالب الثيم إلى JSX.)

---

## الخيارات

| الخيار | الافتراضي | الوصف |
|---|---|---|
| `logoSrc` | `assets/logo.svg` | مسار الشعار (للقالب الافتراضي فقط) |
| `title` / `tagline` | القسم / عبارته | نصوص القالب الافتراضي |
| `loadingText` | `جارٍ التحميل…` | نص الحالة أثناء التحميل |
| `readyText` | `جاهز` | نص الحالة عند الاكتمال |
| `minDuration` | `950` | أقل مدة ظهور (تمنع الوميض) |
| `maxDuration` | `7000` | **سقف صارم** — لا تحجب المستخدم أبدًا |
| `exitDuration` | `620` | مدة التلاشي |
| `holdAfterComplete` | `240` | وقفة قصيرة بعد وصول المؤشر ١٠٠٪ |
| `waitFor` | `[]` | وعود إضافية (جلب بيانات مثلًا) |
| `once` | `'always'` | `'session'` = مرة واحدة لكل جلسة |
| `sessionKey` | `astroutas:splash-seen` | مفتاح الجلسة — **افصله لكل موقع** |
| `appRoot` | `[data-app-root]` | يُعطَّل أثناء التحميل (`inert`) |

مثال — انتظار بيانات قبل الإخفاء:

```js
createSplash({ waitFor: [fetch('/api/events').then(r => r.json())] });
```

---

## الخطوط

الشاشات تستعمل خطوط النظام العربية عمدًا: **لا طلب شبكة، ولا وميض خطوط** — وهو
ما يهمّ أكثر ما يكون في شاشة تحميل. لاعتماد Noto Kufi Arabic / Almarai
(كما في دليل هوية النادي) استضِفهما ذاتيًا ثم غيّر متغيّرًا واحدًا في
`core.css`:

```css
:root { --splash-font: "Noto Kufi Arabic", "Almarai", system-ui, sans-serif; }
```

---

## الأداء وإمكانية الوصول

- تُزال الشاشة من DOM بعد الاختفاء — لا تكلفة ولا اعتراض للنقر.
- قفل التمرير أثناء العرض فقط، ثم يُحرَّر.
- `role="status"` و`aria-live` و`progressbar` بنسبة حقيقية.
- الموقع يُعطَّل بـ `inert` أثناء التحميل فلا يصله تركيز لوحة المفاتيح.
- `prefers-reduced-motion`: كل ثيم يوقف دورانه وتلاشيه ويكتفي بالظهور الفوري.
- بدون JavaScript: لا تظهر الشاشة إطلاقًا ويعمل الموقع طبيعيًا.

### ثلاث شبكات أمان تمنع حجب الموقع

1. `maxDuration` (٧ ثوانٍ) — يُنهي الشاشة حتى لو تعثّر التحميل.
2. السكربت التمهيدي (١٠ ثوانٍ) — يعمل حتى لو فشل تحميل `splash.js`.
3. الصنف `js` — بدون JavaScript لا تُعرض الشاشة أساسًا.

---

## ما جرى التحقق منه فعليًا

اختُبرت **الشاشات الاثنتا عشرة** آليًا في Chromium عبر Playwright:

- **المسار الطبيعي** (١٢٨٠×٨٠٠): الشاشة تظهر فورًا، والمؤشّر يبلغ ~٧٠٪ عند
  ٧٠٠ms، وتختفي خلال ~٢.٣ث، ثم `app-ready` وفكّ القفل وإزالة `inert`
  وظهور المحتوى — بلا خطأ JavaScript واحد وبلا طلب فاشل.
- **بلا JavaScript**: لا تظهر الشاشة إطلاقًا، والمحتوى ظاهر والتمرير حر.
- **`prefers-reduced-motion: reduce`**: الاثنتا عشرة تكمل الدورة بلا أخطاء.
- **جوال ٣٩٠×٨٤٤**: بلا تمرير أفقي، وبارتفاع منفذ كامل.

> لم تُختبر هذه الشاشات بعد على Safari/iOS ولا Firefox حقيقيَّين — البيئة توفّر
> Chromium فقط. الميزات المستعملة (`mask`, `clip-path`, `conic-gradient`,
> `inert`, `color-mix`, خصائص SVG كـ `r`/`rx` في CSS) مدعومة في الإصدارات
> الحديثة من الثلاثة، لكن تأكيدها يحتاج تشغيلًا فعليًا.
