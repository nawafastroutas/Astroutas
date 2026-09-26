---
name: astroutas-check
description: Run the Astroutas site locally, take mobile + desktop screenshots with Playwright, and verify the splash screen hands off correctly with no JS errors or horizontal overflow. Use before committing any change to this project, or when the user asks to run, test, preview, screenshot, شغّل, جرّب, or افحص the site.
---

# تشغيل وفحص الموقع

الموقع ملفات ثابتة — لا build. الفحص يستخدم Playwright المثبّت مسبقًا في البيئة.

## التشغيل السريع

```bash
node .claude/skills/astroutas-check/scripts/check.mjs            # يفحص index.html
node .claude/skills/astroutas-check/scripts/check.mjs about.html # صفحة أخرى
```

السكربت يشغّل خادمًا ثابتًا داخليًا (بلا npm)، ثم على مقاسات **390×844** و**1440×900** و**320×640**:

1. ينتظر حتى يظهر الصنف `app-ready` على `<html>` وتُزال الشاشة من DOM (يفشل إذا تجاوز ٨ ثوانٍ).
2. يتأكد أن لا تمرير أفقي (`scrollWidth <= innerWidth`).
3. يجمع أخطاء JavaScript وطلبات الشبكة الفاشلة.
4. يعيد الفحص مع `prefers-reduced-motion: reduce` ومع تعطيل JavaScript (المحتوى يجب أن يظهر).
5. يحفظ لقطات في مجلد مؤقت ويطبع مساراتها.

يطبع `PASS` أو `FAIL` مع السبب، ويخرج بـ exit code 1 عند الفشل.

## بعد التشغيل

- **اعرض اللقطات فعلًا** بأداة Read وافحصها بعينك: اتجاه RTL، عدم تداخل النص، الألوان مطابقة لـ `astroutas-brand`.
- إذا فشل شيء: أصلحه وأعد التشغيل. لا تقل "تم" قبل `PASS`.
- اذكر للمستخدم بالضبط ما فُحص وما لم يُفحص.

## ملاحظات البيئة

- Playwright في `/opt/node22/lib/node_modules/playwright` و Chromium في `/opt/pw-browsers` — لا تشغّل `playwright install`.
- للتشغيل اليدوي: `python3 -m http.server 8080` ثم افتح `http://localhost:8080`.
