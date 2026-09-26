---
name: astroutas-brand
description: Astroutas visual identity — brand colors (blue/orange/white), Arabic system fonts, RTL rules and component look. Use before writing or changing ANY CSS, HTML, color, font, button, card or layout in this project, or when the user asks about the هوية / الألوان / الخطوط / التصميم.
---

# هوية Astroutas البصرية

المصدر الوحيد للألوان هو متغيّرات `:root` في `src/splash/splash.css`. لا تخترع ألوانًا جديدة.

## الألوان

| المتغيّر | القيمة | الاستخدام |
|---|---|---|
| `--astro-blue-900` | `#06162c` | خلفيات داكنة، شاشة التحميل، `theme-color` |
| `--astro-blue-800` | `#0a2246` | طبقات داكنة ثانوية |
| `--astro-blue-700` | `#0e2f5e` | النص الأساسي على الخلفية الفاتحة |
| `--astro-blue-500` | `#1e6fd9` | الروابط، الأزرار الأساسية، hover |
| `--astro-blue-400` | `#3d8bef` | تمييز على الخلفيات الداكنة |
| `--astro-orange-500` | `#f5851f` | لمسات التمييز: eyebrow، أيقونات، خط تحت hover |
| `--astro-orange-400` | `#ffa24a` | نهاية تدرّج البرتقالي |
| `--astro-white` | `#ffffff` | النص على الداكن، البطاقات |

ألوان مساعدة موجودة في `assets/site.css`: خلفية الصفحة `#f6f9fd`، نص ثانوي `#45618c` و`#5b76a0`، نص خافت `#7189ad`، حدود `rgba(14, 47, 94, 0.08)`.

قواعد:
- البرتقالي **للتمييز فقط** (كلمة، أيقونة، خط) — لا تستخدمه كخلفية لمساحات كبيرة ولا لنص طويل (تباينه على الأبيض ضعيف ≈ 2.5:1).
- الزر الأساسي: `linear-gradient(135deg, #1e6fd9, #0e2f5e)` بنص أبيض. الزر الثانوي: حد شفاف أزرق، ويصير برتقاليًا عند hover.
- كلمة مميّزة في العنوان: تدرّج `linear-gradient(to left, #f5851f, #ffa24a)` مع `background-clip: text`.
- في الملفات الجديدة استعمل `var(--astro-…)` بدل كتابة القيم مباشرة.

## الخطوط

خطوط النظام العربية فقط — **لا Google Fonts ولا أي طلب شبكة**:

```css
font-family: "SF Arabic", "Geeza Pro", "Noto Kufi Arabic", "Noto Naskh Arabic",
  "Dubai", "Tajawal", "Segoe UI", system-ui, -apple-system, sans-serif;
line-height: 1.7;
```

العناوين: `font-weight: 800`، حجم مرن بـ `clamp()` (مثال: `clamp(2rem, 7vw, 3.4rem)`)، و`text-wrap: balance`. الفقرات: `text-wrap: pretty`.

## RTL والتخطيط

- كل صفحة: `<html lang="ar" dir="rtl">`.
- استخدم الخصائص المنطقية دائمًا: `margin-inline`, `padding-block`, `inset-inline-start`, `border-block-end` — **لا** `left/right` ولا `margin-left`.
- اتجاه التدرّجات والأسهم يُعكس: "للأمام" = لليسار.
- الأرقام في النص عربية-هندية (٦٠، ٣٢٠) لتطابق المحتوى الحالي.
- الحاوية: `max-width: 72rem; margin-inline: auto; padding-inline: clamp(1rem, 4vw, 2.5rem);`
- المسافات والأحجام بـ `clamp()` بدل نقاط كسر كثيرة.

## الحركة

- منحنى الحركة المعتمد: `cubic-bezier(0.16, 1, 0.3, 1)`.
- hover خفيف: `translateY(-2px)` للأزرار، `translateY(-4px)` مع ظل ناعم للبطاقات.
- كل حركة يجب أن تُلغى أو تُبسَّط داخل `@media (prefers-reduced-motion: reduce)`.

## الشعار

`assets/logo.svg` شعار **مؤقّت**. أي مكان يعرضه يجب أن يبقى صالحًا عند استبداله بالشعار الرسمي (لا تعتمد على ألوانه الداخلية أو أبعاده غير المربّعة).
