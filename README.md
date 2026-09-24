# Subbha | سبحة — الموقع + شاشة التحميل + PWA

موقع سبحة (متجر السبح الفاخرة) الفعلي، مع:

- شاشة افتتاحية (Splash / Loading Screen) فخمة بهوية الموقع (بني/ذهبي)
  تظهر فور فتح الموقع، ثم تختفي بتلاشٍ ناعم لتظهر الصفحة الرئيسية.
- إمكانية **تثبيت الموقع على الشاشة الرئيسية للهاتف** كتطبيق (PWA)، بأيقونة
  سبحة مخصّصة.

## شاشة التحميل

- **بدون أي مكتبة خارجية** — Zero dependencies.
- الحركات عبر CSS/`requestAnimationFrame` — أداء عالٍ على الجوال.
- عربية و **RTL** بالكامل، ومتجاوبة من ٣٢٠px حتى الشاشات الكبيرة.
- الاختفاء مرتبط **بجاهزية التطبيق الحقيقية** (تحميل الصفحة + الخطوط)، لا
  بمؤقّت وهمي — مع سقف صارم (٧ ثوانٍ) وشبكة أمان زمنية إضافية (١٠ ثوانٍ) في
  حال تعطّل JavaScript جزئيًا، حتى لا يُحجب الموقع أبدًا.
- الألوان كلها متغيّرات CSS أعلى `src/splash/splash.css` (مطابقة لهوية
  سبحة: بني دافئ + كريمي، بلا أي لمسات ذهبية) — غيّرها من مكان واحد فقط.

## التثبيت على الشاشة الرئيسية (PWA)

- `manifest.webmanifest` — اسم التطبيق، الأيقونات، لون الواجهة.
- `sw.js` — service worker بسيط لتفعيل خاصية التثبيت فقط (بدون أي تخزين
  مؤقت للبيانات، حتى لا تُعرض أسعار أو بيانات قديمة من كاش — سبحة تعتمد على
  Firebase كمصدر حقيقة حي).
- `assets/brand/subbha-icon-source.png` — أيقونة السبحة المربعة (الأصل)،
  مُصدَّرة بأحجام PNG متعددة (16/32/180/192/512) في `assets/icons/` لجميع
  الاستخدامات (Favicon، Apple Touch Icon، أيقونات المتصفح/الهاتف).
- على **أندرويد/Chrome**: يظهر خيار "تثبيت التطبيق" تلقائيًا.
- على **iPhone/Safari**: من قائمة المشاركة ← "إضافة إلى الشاشة الرئيسية".

---

## التشغيل

```bash
npx http-server -p 8080 -c-1 .
# ثم افتح http://localhost:8080
```

---

## الملفات

| الملف | الدور |
|---|---|
| `index.html` | الموقع الفعلي (شاشة التحميل + الموقع مدمجَين) |
| `src/splash/splash.css` | تنسيق شاشة التحميل + متغيّرات الهوية البصرية |
| `src/splash/splash.js` | المتحكّم: التقدّم، الجاهزية، الخروج |
| `src/splash/react/SplashScreen.jsx` | نسخة React / Next.js (مرجع إن استُخدم إطار عمل لاحقًا) |
| `manifest.webmanifest` | بيانات تثبيت PWA |
| `sw.js` | service worker (تفعيل التثبيت فقط) |
| `assets/icons/` | أيقونة السبحة بكل الأحجام المطلوبة |

---

## الدمج في موقع HTML

الترتيب داخل `<head>` **مقصود ومهم**: `splash.css` هو ملف التنسيق الوحيد الذي
يحجب الرسم، فتظهر الشاشة فورًا؛ أما تنسيق الموقع فيُحمَّل بشكل غير حاجب حتى لا
يؤخّرها.

```html
<link rel="stylesheet" href="src/splash/splash.css">
<link rel="preload" as="image" href="assets/logo.svg" type="image/svg+xml">

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
    }, 10000);
  })();
</script>

<link rel="stylesheet" href="css/site.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="css/site.css"></noscript>
```

ثم في `<body>`: ضع قالب الشاشة (انسخه من `index.html`) كأول عنصر، ولُفّ موقعك
بعنصر يحمل `data-app-root`، وأضف `data-splash-enter` لأي عنصر تريده يدخل بلطف
بعد الاختفاء. وأخيرًا:

```html
<script type="module">
  import { createSplash, indexEnterTargets } from './src/splash/splash.js';
  indexEnterTargets();
  createSplash({ logoSrc: 'assets/logo.svg', appRoot: '[data-app-root]' });
</script>
```

> إن لم تضع القالب في HTML، تُنشئه الوحدة تلقائيًا — لكن وضعه في HTML أسرع
> ظهورًا لأنه لا ينتظر تحميل الـ JavaScript.

---

## الدمج في React / Next.js

انسخ `splash.css` و`SplashScreen.jsx`، ثم في `app/layout.jsx`:

```jsx
import '@/styles/splash.css';
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
التمهيدي أعلاه في الـ layout للحصول على شبكة الأمان نفسها.

---

## الخيارات

| الخيار | الافتراضي | الوصف |
|---|---|---|
| `logoSrc` | `assets/logo.svg` | مسار الشعار |
| `title` | `قسم الأنشطة الطلابية` | العنوان |
| `tagline` | `نصنع تجربة طلابية استثنائية` | العبارة |
| `minDuration` | `950` | أقل مدة ظهور (تمنع الوميض) |
| `maxDuration` | `7000` | **سقف صارم** — لا تحجب المستخدم أبدًا |
| `exitDuration` | `620` | مدة التلاشي |
| `waitFor` | `[]` | وعود إضافية (جلب بيانات مثلًا) |
| `once` | `'always'` | `'session'` = مرة واحدة لكل جلسة |
| `appRoot` | `[data-app-root]` | يُعطَّل أثناء التحميل (`inert`) |

مثال — انتظار بيانات قبل الإخفاء:

```js
createSplash({ waitFor: [fetch('/api/events').then(r => r.json())] });
```

---

## تغيير الهوية البصرية

كل الألوان في متغيّرات CSS أعلى `splash.css`:

```css
:root {
  --astro-blue-900: #06162c;   /* خلفية الشاشة */
  --astro-blue-500: #1e6fd9;
  --astro-orange-500: #f5851f;
  --splash-logo-size: clamp(6.5rem, 17vw, 9.5rem);
}
```

---

## الأداء وإمكانية الوصول

- تُزال الشاشة من DOM بعد الاختفاء — لا تكلفة ولا اعتراض للنقر.
- قفل التمرير أثناء العرض فقط، ثم يُحرَّر.
- `role="status"` و`aria-live` و`progressbar` بنسبة حقيقية.
- الموقع يُعطَّل بـ `inert` أثناء التحميل فلا يصله تركيز لوحة المفاتيح.
- `prefers-reduced-motion`: تلاشٍ بسيط بلا دوران أو ضبابية.
- بدون JavaScript: لا تظهر الشاشة إطلاقًا ويعمل الموقع طبيعيًا.

### ثلاث شبكات أمان تمنع حجب الموقع

1. `maxDuration` (٧ ثوانٍ) — يُنهي الشاشة حتى لو تعثّر التحميل.
2. السكربت التمهيدي (١٠ ثوانٍ) — يعمل حتى لو فشل تحميل `splash.js`.
3. الصنف `js` — بدون JavaScript لا تُعرض الشاشة أساسًا.

---

## ما جرى التحقق منه فعليًا

اختُبر في Chromium عبر Playwright على مقاسي ١٤٤٠×٩٠٠ و٣٩٠×٨٤٤:

- الظهور الفوري، والاختفاء بسبب `ready` خلال ~١.٢ث على تحميل سريع.
- ظهور الشاشة خلال ~٦٠٠ms حتى مع ملف تنسيق بطيء (٢.٦ث).
- السقف الصارم عند تعثّر التحميل، والموقع صالح للاستخدام بعده.
- فشل تحميل `splash.js` → السكربت التمهيدي يحرّر الموقع.
- تعطيل JavaScript → لا شاشة، والمحتوى ظاهر ومنسّق.
- `prefers-reduced-motion` → بلا دوران، ويكتمل التسلسل.
- لا أخطاء JavaScript، والموقع قابل للنقر والتمرير بعد الاختفاء.
