#!/usr/bin/env python3
"""
مولّد صفحات التحميل الـ١٢.

  python3 tools/build_sites.py

يقرأ:
  src/splash/sites.json            بيانات المواقع (المصدر الوحيد للحقيقة)
  src/splash/themes/NN-slug.html   قالب شاشة كل نادٍ (بعلامات {{name}} …)
  src/splash/themes/NN-slug.css    تصميم كل نادٍ

يكتب:
  sites/<slug>/index.html          صفحة التحميل + معاينة الموقع خلفها
  sites/index.html                 معرض الشاشات الـ١٢

المخرجات ملفات ثابتة بلا أي اعتماد وقت التشغيل — بايثون أداة تطوير فقط.
الهدف من المولّد أن يبقى الهيكل المشترك (ترتيب <head>، شبكة الأمان، وسم التشغيل)
معرَّفًا في مكان واحد بدل نسخه اثنتي عشرة مرة.
"""

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
THEMES = ROOT / 'src' / 'splash' / 'themes'
OUT = ROOT / 'sites'

# سكربت تمهيدي inline — لا يمكن أن يفشل تحميله.
# ١) يضيف الصنف `js`؛ بدونه لا تظهر الشاشة أصلًا فيبقى الموقع صالحًا بلا JavaScript.
# ٢) شبكة أمان زمنية: لو تعذّر تحميل splash.js يُحرَّر الموقع بعد ١٠ ثوانٍ.
BOOT = """  (function () {
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
  })();"""

PAGE = """<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} — {dept}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="{bg}">

<!-- ======================================================================
     ترتيب <head> مقصود — لا تغيّره:
     ١) نواة الشاشة + ثيم النادي: ملفّا التنسيق الوحيدان اللذان يحجبان الرسم،
        وهما صغيران، فتظهر شاشة التحميل فورًا.
     ٢) السكربت التمهيدي بعدهما مباشرة.
     ٣) تنسيق الموقع يُحمَّل بشكل غير حاجب حتى لا يؤخّر ظهور الشاشة —
        المحتوى مخفي خلفها على أي حال.
     ====================================================================== -->
<link rel="stylesheet" href="../../src/splash/core.css">
<link rel="stylesheet" href="../../src/splash/themes/{theme}.css">

<script>
{boot}
</script>

<link rel="stylesheet" href="../../assets/club-site.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="../../assets/club-site.css"></noscript>
</head>

<body>

<!-- ====== شاشة التحميل (أول عنصر في الصفحة) ====== -->
{splash}

<!-- ====== موقع النادي (معاينة — استبدلها بموقعكم الحقيقي) ====== -->
<div class="club" data-app-root>
  <header class="club__header" data-splash-enter>
    <span class="club__brand"><i class="club__dot" aria-hidden="true"></i>{title}</span>
    <a class="club__back" href="../index.html">كل الشاشات</a>
  </header>

  <main class="club__main">
    <p class="club__eyebrow" data-splash-enter>{eyebrow}</p>
    <h1 class="club__title" data-splash-enter>{hero}</h1>
    <p class="club__lede" data-splash-enter>{lede}</p>
    <ul class="club__chips" data-splash-enter>
{chips}
    </ul>
  </main>

  <footer class="club__footer" data-splash-enter>
    <p>© {title} — {dept}.</p>
    <p class="club__note">هذه معاينة توضيحية لما يظهر بعد اختفاء شاشة التحميل.</p>
  </footer>
</div>

<script type="module">
  import {{ createSplash, indexEnterTargets }} from '../../src/splash/splash.js';

  indexEnterTargets();          // ترقيم عناصر الدخول للحصول على تتابُع
  createSplash({{
    appRoot: '[data-app-root]',
    loadingText: {loading},
    readyText: {ready},
    sessionKey: 'astroutas:splash:{slug}',
  }});
</script>

</body>
</html>
"""

GALLERY = """<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>شاشات التحميل — {dept}</title>
<meta name="description" content="اثنتا عشرة شاشة تحميل، واحدة لكل نادٍ.">
<meta name="theme-color" content="#06162c">
<link rel="stylesheet" href="../assets/gallery.css">
</head>

<body>
<header class="gal__head">
  <p class="gal__eyebrow">{dept}</p>
  <h1 class="gal__title">شاشات التحميل</h1>
  <p class="gal__lede">اثنتا عشرة شاشة — لكل نادٍ تصميمه وحركته ولونه.
     افتح أيًّا منها لتشاهد التحميل ثم الانتقال إلى الموقع.</p>
</header>

<main class="gal__grid">
{cards}
</main>

<footer class="gal__foot">
  <p>كل شاشة ملفّان: <code>src/splash/themes/NN-slug.css</code> و<code>…/NN-slug.html</code>،
     فوق نواة مشتركة واحدة.</p>
</footer>
</body>
</html>
"""

CARD = """  <a class="gal__card" href="{slug}/index.html"
     style="--card-bg:{bg};--card-accent:{accent};--card-accent-2:{accent2};--card-ink:{ink}">
    <span class="gal__num">{num}</span>
    <span class="gal__art" aria-hidden="true"></span>
    <span class="gal__name">{name}</span>
    <span class="gal__concept">{concept}</span>
  </a>"""


def js_string(value):
    """نص JavaScript آمن — نمرّره عبر JSON فيهرّب المحارف الخاصة."""
    return json.dumps(value, ensure_ascii=False)


def build():
    data = json.loads((ROOT / 'src' / 'splash' / 'sites.json').read_text(encoding='utf-8'))
    dept = data['department']['name']
    cards = []

    for site in data['sites']:
        theme = f"{site['order']:02d}-{site['slug']}"
        partial = (THEMES / f'{theme}.html').read_text(encoding='utf-8').strip()

        splash = (partial
                  .replace('{{name}}', html.escape(site['name']))
                  .replace('{{tagline}}', html.escape(site['tagline']))
                  .replace('{{loading}}', html.escape(site['loadingText']))
                  .replace('{{aria}}', html.escape(f"جارٍ تحميل موقع {site['name']}")))

        # علامات إضافية يحتاجها ثيم بعينه (مثل سطر الكتابة في نادي اللغات)
        for key, value in site.get('extra', {}).items():
            splash = splash.replace('{{' + key + '}}', html.escape(value))

        left = re.findall(r'\{\{\w+\}\}', splash)
        if left:
            raise SystemExit(f'{theme}: علامات لم تُملأ: {", ".join(sorted(set(left)))}')

        chips = '\n'.join(
            f'      <li>{html.escape(c)}</li>' for c in site['preview']['chips']
        )

        page = PAGE.format(
            title=html.escape(site['name']),
            dept=html.escape(dept),
            desc=html.escape(site['tagline']),
            bg=site['colors']['bg'],
            theme=theme,
            boot=BOOT,
            splash=splash,
            eyebrow=html.escape(site['eyebrow']),
            hero=html.escape(site['preview']['title']),
            lede=html.escape(site['preview']['lede']),
            chips=chips,
            loading=js_string(site['loadingText']),
            ready=js_string(site['readyText']),
            slug=site['slug'],
        )

        target = OUT / site['slug']
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_text(page, encoding='utf-8')
        print(f"  ✓ sites/{site['slug']}/index.html")

        cards.append(CARD.format(
            slug=site['slug'],
            bg=site['colors']['bg'],
            accent=site['colors']['accent'],
            accent2=site['colors']['accent2'],
            ink=site['colors']['ink'],
            num=f"{site['order']:02d}",
            name=html.escape(site['name']),
            concept=html.escape(site['concept']),
        ))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(
        GALLERY.format(dept=html.escape(dept), cards='\n'.join(cards)),
        encoding='utf-8',
    )
    print('  ✓ sites/index.html')
    print(f"تمّ توليد {len(data['sites'])} صفحة + المعرض.")


if __name__ == '__main__':
    build()
