---
name: astroutas-audit
description: Performance and accessibility review checklist for the Astroutas site — render-blocking, splash safety nets, contrast of brand colors, keyboard focus, ARIA, reduced motion, RTL. Use when the user asks to review, audit, راجع, حسّن الأداء, or check accessibility/وصولية, or before merging a large UI change.
---

# مراجعة الأداء وإمكانية الوصول

راجع الملفات المتغيّرة مقابل هذه القائمة، ثم شغّل `astroutas-check` لتأكيد النتائج عمليًا. اذكر كل مشكلة مع `file:line` واقتراح إصلاح محدد.

## الأداء

- [ ] `splash.css` هو **الوحيد** الحاجب للرسم في `<head>`؛ أي CSS آخر يُحمَّل بـ `media="print" onload` + `<noscript>`.
- [ ] لا سكربتات حاجبة: كل JS إما inline صغير أو `type="module"`.
- [ ] لا طلبات لخوادم خارجية (خطوط، CDN، تحليلات) إلا بطلب صريح.
- [ ] الصور لها `width`/`height`، وما تحت أول شاشة `loading="lazy"`، والشعار `preload`.
- [ ] الحركات على `transform`/`opacity` فقط (لا `top/left/width` متحرّكة).
- [ ] شبكات الأمان الثلاث سليمة: `maxDuration` ≤ ٧ث، السكربت التمهيدي ١٠ث، صنف `js`.
- [ ] شاشة التحميل تُزال من DOM بعد الاختفاء، ويُحرَّر قفل التمرير و`inert`.

## إمكانية الوصول

- [ ] تباين النص ≥ 4.5:1 (العناوين الكبيرة ≥ 3:1). انتبه: البرتقالي `#f5851f` على الأبيض ≈ 2.5:1 — غير مقبول لنص عادي.
  احسب بسرعة:
  ```bash
  python3 -c "
  def L(h):
      c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
      c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]
      return .2126*c[0]+.7152*c[1]+.0722*c[2]
  a,b=L('#f5851f'),L('#ffffff'); print(round((max(a,b)+.05)/(min(a,b)+.05),2))"
  ```
- [ ] كل عنصر تفاعلي يصل له التركيز بلوحة المفاتيح وله `:focus-visible` ظاهر.
- [ ] `alt` عربي وصفي للصور ذات المعنى، و`alt=""` + `aria-hidden` للزخرفية.
- [ ] `lang="ar" dir="rtl"`، عنوان `h1` واحد، ترتيب عناوين بلا قفزات.
- [ ] `nav` و`section` لها `aria-label` عربي عند الحاجة.
- [ ] شاشة التحميل: `role="status"`، `aria-live="polite"`، و`progressbar` بقيم `aria-valuenow` حقيقية.
- [ ] `prefers-reduced-motion: reduce` يلغي الدوران والضبابية والحركات الكبيرة.
- [ ] أهداف اللمس ≥ 44×44px على الجوال.

## RTL

- [ ] لا `left`/`right`/`margin-left`/`padding-right` — خصائص منطقية فقط.
- [ ] الأيقونات الاتجاهية (أسهم) معكوسة.
