---
name: astroutas-new-page
description: Step-by-step recipe for adding a new page or section to the Astroutas site (Arabic RTL, responsive from 320px, zero external libraries, works with the splash screen). Use when the user asks to add/create a page, section, صفحة, قسم, فعاليات, أندية, تواصل, or any new UI to this project.
---

# إضافة صفحة أو قسم جديد

اقرأ مهارة `astroutas-brand` أولًا — كل الألوان والخطوط والقواعد هناك.

## القيود الثابتة

- **صفر مكتبات خارجية**: لا npm، لا CDN، لا خطوط من الإنترنت. HTML + CSS + JavaScript (ES modules) فقط. (مستودع npm محجوب في بيئة Claude أصلًا.)
- عربي و RTL بالكامل، متجاوب من **320px** حتى الشاشات الكبيرة بلا تمرير أفقي.
- يعمل بدون JavaScript (المحتوى يظهر ومنسّق).

## صفحة HTML جديدة

انسخ `index.html` كنقطة بداية واحتفظ بترتيب `<head>` كما هو **بالضبط** (مشروح في تعليق داخل الملف):

1. `src/splash/splash.css` — ملف التنسيق الوحيد الحاجب للرسم.
2. `preload` للشعار.
3. السكربت التمهيدي inline (صنف `js` + شبكة الأمان ١٠ ثوانٍ).
4. `assets/site.css` بشكل غير حاجب (`media="print" onload=...` + `<noscript>`).

ثم:
- قالب شاشة التحميل كأول عنصر في `<body>` (أو احذفه إذا الصفحة لا تحتاجه — `createSplash` ينشئه تلقائيًا).
- لُفّ المحتوى في `<div class="site" data-app-root>`.
- أضف `data-splash-enter` للعناصر الرئيسية لتدخل بتتابع بعد الاختفاء، واستدعِ `indexEnterTargets()` قبل `createSplash(...)`.
- حدّث `<title>` و`<meta name="description">`، واجعل رابط الصفحة في `.nav` يعمل.
- لصفحة ثانوية يكفي عرض الشاشة مرة واحدة: `createSplash({ once: 'session', ... })`.
- إذا الصفحة تجلب بيانات: `createSplash({ waitFor: [fetch(...).then(r => r.json())] })`.

## قسم جديد داخل صفحة موجودة

- HTML دلالي: `<section aria-label="...">` أو عنوان `<h2>`، ترتيب عناوين سليم (h1 واحد لكل صفحة).
- التنسيق في `assets/site.css` بنمط BEM الموجود (`.block__element--modifier`) وبنفس تقسيمات التعليقات `/* ---------- Name ---------- */`.
- الشبكات: `display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));` لتنزل لعمود واحد تلقائيًا على الجوال.
- الصور: `width`/`height` صريحة، `alt` عربي وصفي (أو `alt=""` للزخرفية)، `loading="lazy"` لما تحت أول شاشة.

## لا تنسَ

- لا تعدّل `src/splash/*` إلا إذا طُلب تعديل شاشة التحميل نفسها.
- إذا أضفت ملفًا أو خيارًا جديدًا، حدّث جدول الملفات/الخيارات في `README.md`.
- بعد الانتهاء شغّل مهارة `astroutas-check` قبل الـ commit.
