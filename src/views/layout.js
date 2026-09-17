/** هيكل الصفحة والمكوّنات المشتركة. */
import { html, raw, esc, when } from '../lib/html.js';
import config from '../config.js';
import { formatRange, formatShort } from '../lib/datetime.js';
import { arabicDigits, arabicNumber, points as pointsText, seats as seatsText } from '../lib/arabic.js';
import { objectUrl } from '../lib/storage.js';

const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/events', label: 'الفعاليات' },
  { href: '/structure', label: 'هيكلة النادي' },
  { href: '/about', label: 'عن النادي' },
  { href: '/contact', label: 'تواصل' },
];

export const num = arabicNumber;
export { pointsText, seatsText, arabicDigits };

/**
 * أحرف الاسم الأولى عند غياب الصورة: أول الاسم وأول اللقب،
 * وتُتخطّى الكلمات الرابطة (بن، بنت، آل، أبو).
 */
const NAME_PARTICLES = new Set(['بن', 'بنت', 'آل', 'ال', 'أبو', 'ابو', 'عبد', 'أم']);
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter((w) => !NAME_PARTICLES.has(w));
  if (!words.length) return '؟';
  // «ال» التعريف لا تفيد كحرف أوّل: المقبالي ← م
  const letter = (word) => {
    const bare = word.length > 3 && word.startsWith('ال') ? word.slice(2) : word;
    return [...bare][0] || '';
  };
  const first = letter(words[0]);
  const last = words.length > 1 ? letter(words[words.length - 1]) : '';
  return `${first}${last ? ` ${last}` : ''}`;
}

export function avatar(person, { size = '' } = {}) {
  const url = objectUrl(person?.photo_key);
  const cls = `avatar${size === 'lg' ? ' avatar--lg' : ''}`;
  if (url) {
    return html`<img class="${cls}" src="${url}" alt="صورة ${person.full_name}" loading="lazy" width="96" height="96">`;
  }
  return html`<span class="${cls} avatar--fallback" role="img" aria-label="لا توجد صورة لـ${person?.full_name || 'العضو'}">${initials(person?.full_name)}</span>`;
}

export function alertBox(type, message, { role = 'status' } = {}) {
  if (!message) return raw('');
  const icon = type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ';
  return html`<div class="alert alert--${type}" role="${type === 'error' ? 'alert' : role}">
    <span class="alert__icon" aria-hidden="true">${icon}</span><span>${message}</span>
  </div>`;
}

export function statusChip(event) {
  if (event.status === 'cancelled') return html`<span class="chip chip--danger">ملغاة</span>`;
  if (event.status === 'draft') return html`<span class="chip chip--outline">مسودّة</span>`;
  const ended = new Date(event.ends_at).getTime() < Date.now();
  return ended
    ? html`<span class="chip chip--outline">منتهية</span>`
    : html`<span class="chip chip--success">مفتوحة</span>`;
}

export function eventCard(event, { showStatus = true } = {}) {
  const seats = event.capacity > 0 ? Math.max(0, event.capacity - event.tickets_count) : null;
  return html`<article class="card card--link" data-splash-enter>
    <div class="cluster" style="margin-bottom:.5rem">
      ${when(!!event.category, html`<span class="chip chip--teal">${event.category}</span>`)}
      ${when(showStatus, statusChip(event))}
      ${when(event.points > 0, html`<span class="chip chip--gold">${pointsText(event.points)}</span>`)}
    </div>
    <h3 class="card__title"><a href="/events/${event.id}">${event.title}</a></h3>
    <div class="card__meta">
      <span>🗓️ ${formatRange(event.starts_at, event.ends_at)}</span>
      ${when(!!event.location, html`<span>📍 ${event.location}</span>`)}
    </div>
    <div class="card__foot">
      <a class="btn btn--sm btn--outline" href="/events/${event.id}">التفاصيل</a>
      ${when(seats !== null, html`<span class="small muted">${seats > 0 ? `المتبقّي: ${seatsText(seats)}` : 'اكتملت المقاعد'}</span>`)}
    </div>
  </article>`;
}

/**
 * هيكل الصفحة الكامل.
 * ترتيب <head> مقصود: تنسيق شاشة التحميل أولًا (حاجب وصغير) فتظهر فورًا،
 * ثم تنسيق الموقع بلا حجب.
 */
export function page({
  title, description = '', member = null, path = '/', nonce = '',
  head = raw(''), body, scripts = [], wide = false, splash = true,
}) {
  const fullTitle = title ? `${title} — ${config.club.name}` : config.club.name;
  const isAdmin = !!member?.is_admin;

  return html`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description || `${config.club.name} — ${config.club.college}، ${config.club.university}.`}">
<meta name="theme-color" content="#1d0a21">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description || config.club.tagline}">
<meta property="og:type" content="website">
${when(splash, html`<link rel="stylesheet" href="/splash/splash.css">
<link rel="preload" as="image" href="/assets/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/site.css" media="print" data-site-css>
<script nonce="${nonce}">
  /* سكربت تمهيدي موقَّع (تمنع سياسة أمان المحتوى المعالجات المضمّنة في الوسوم):
     ١) يفعّل تنسيق الموقع فور تحميله — فيبقى غير حاجب لظهور شاشة التحميل.
     ٢) شبكة أمان: لو تعثّر تحميل وحدة الشاشة يُحرَّر الموقع بعد عشر ثوانٍ. */
  (function () {
    var r = document.documentElement;
    r.classList.add('js');
    var css = document.querySelector('[data-site-css]');
    var apply = function () { if (css) css.media = 'all'; };
    if (css && css.sheet) apply();
    else if (css) css.addEventListener('load', apply, { once: true });
    setTimeout(apply, 2500);
    setTimeout(function () {
      if (r.classList.contains('app-ready')) return;
      r.classList.remove('splash-lock');
      r.classList.add('app-ready');
      var s = document.querySelector('[data-splash]');
      if (s) s.remove();
    }, 10000);
  })();
</script>
<noscript><link rel="stylesheet" href="/css/site.css"></noscript>`)}
${when(!splash, html`<link rel="stylesheet" href="/css/site.css">`)}
${head}
</head>
<body>
<a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>
${when(splash, raw(`
<div class="splash" id="splash" role="status" aria-live="polite" aria-label="جارٍ تحميل الموقع" data-splash>
  <div class="splash__core">
    <div class="splash__mark">
      <span class="splash__ring splash__ring--track" aria-hidden="true"></span>
      <span class="splash__ring splash__ring--arc" aria-hidden="true"></span>
      <span class="splash__ring splash__ring--arc-alt" aria-hidden="true"></span>
      <img class="splash__logo" src="/assets/logo.svg" alt="" aria-hidden="true" width="128" height="128" fetchpriority="high" decoding="sync">
    </div>
    <p class="splash__title">${esc(config.club.name)}</p>
    <span class="splash__rule" aria-hidden="true"></span>
    <p class="splash__tagline">${esc(config.club.tagline)}</p>
  </div>
  <div class="splash__footer">
    <div class="splash__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="نسبة التحميل" data-splash-progress>
      <span class="splash__progress-fill" data-splash-fill></span>
    </div>
    <span class="splash__status" data-splash-status>جارٍ التحميل…</span>
  </div>
</div>`))}

<div data-app-root>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="/">
      <img src="/assets/logo.svg" alt="" width="46" height="46">
      <span class="brand__text">
        <strong>${config.club.name}</strong>
        <small>${config.club.college} — ${config.club.university}</small>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" data-nav-toggle>
      القائمة
    </button>
    <nav class="nav" id="main-nav" aria-label="التنقل الرئيسي">
      ${NAV.map((item) => html`<a href="${item.href}"${when(path === item.href, raw(' aria-current="page"'))}>${item.label}</a>`)}
      ${when(isAdmin, html`<a href="/admin"${when(path.startsWith('/admin'), raw(' aria-current="page"'))}>لوحة الإدارة</a>`)}
      ${member
        ? html`<a class="nav__cta" href="/me">عضويتي</a>`
        : html`<a class="nav__cta" href="/login">الدخول</a>`}
    </nav>
  </div>
</header>

<main id="main" tabindex="-1">
  <div class="${wide ? 'container' : 'container'}">
    ${body}
  </div>
</main>

<footer class="site-footer">
  <div class="container">
    <div class="site-footer__grid">
      <div>
        <h3>${config.club.name}</h3>
        <p class="small">${config.club.tagline}</p>
        <p class="small">${config.club.college}<br>${config.club.university}</p>
      </div>
      <div>
        <h3>روابط</h3>
        <ul class="small" style="list-style:none;padding:0;margin:0;display:grid;gap:.3rem">
          ${NAV.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}
          <li><a href="/me">عضويتي</a></li>
        </ul>
      </div>
      <div>
        <h3>تواصل معنا</h3>
        <p class="small"><a href="mailto:${config.club.email}">${config.club.email}</a></p>
        <p class="small"><a href="/contact">أرسل رسالة عبر الموقع</a></p>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>© ${arabicDigits(new Date().getFullYear())} ${config.club.name}</span>
      <span>جميع المواعيد بتوقيت سلطنة عُمان</span>
    </div>
  </div>
</footer>
</div>

${scripts.map((src) => html`<script type="module" src="${src}"></script>`)}
${when(splash, html`<script type="module" nonce="${nonce}">
  import { createSplash, indexEnterTargets } from '/splash/splash.js';
  indexEnterTargets();
  createSplash({ logoSrc: '/assets/logo.svg', title: ${raw(JSON.stringify(config.club.name))},
                 tagline: ${raw(JSON.stringify(config.club.tagline))},
                 appRoot: '[data-app-root]', once: 'session' });
</script>`)}
<script type="module" src="/js/app.js"></script>
</body>
</html>`;
}

/** هيكل صفحات لوحة الإدارة (قائمة جانبية + محتوى). */
export function adminPage({ title, member, path, nonce, body, scripts = [], newMessages = 0 }) {
  const links = [
    { href: '/admin', label: 'نظرة عامّة' },
    { href: '/admin/events', label: 'الفعاليات' },
    { href: '/admin/members', label: 'الأعضاء' },
    { href: '/admin/announcements', label: 'الإعلانات' },
    { href: '/admin/messages', label: 'الرسائل' },
    { href: '/admin/scan', label: 'مسح الحضور' },
    { href: '/admin/export', label: 'التصدير' },
  ];
  return page({
    title, member, path, nonce, splash: false, scripts,
    body: html`<div class="admin-shell">
      <nav class="admin-nav" aria-label="أقسام لوحة الإدارة">
        ${links.map((l) => html`<a href="${l.href}"${when(path === l.href, raw(' aria-current="page"'))}>
          ${l.label}${when(l.href === '/admin/messages' && newMessages > 0, html` <span class="pill-count">${num(newMessages)}</span>`)}
        </a>`)}
      </nav>
      <div>${body}</div>
    </div>`,
  });
}

export { html, raw, esc, when, formatRange, formatShort };
