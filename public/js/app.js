/** تحسينات عامّة: القائمة، تأكيد الحذف، ترقيم عناصر الدخول. */

const root = document.documentElement;
root.classList.add('js');

/* قائمة الجوال */
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.getElementById('main-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

/* تأكيد قبل الإجراءات التي لا رجعة فيها */
for (const form of document.querySelectorAll('form[data-confirm]')) {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
}

/* تتابع دخول العناصر (يُلغى تلقائيًّا مع تقليل الحركة عبر CSS) */
document.querySelectorAll('[data-splash-enter]').forEach((el, i) => {
  el.style.setProperty('--enter-index', String(i % 8));
});

/* نسخ النصوص */
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'نُسخ ✓';
    } catch {
      const field = document.createElement('input');
      field.value = value;
      document.body.append(field);
      field.select();
      document.execCommand('copy');
      field.remove();
      button.textContent = 'نُسخ ✓';
    }
    setTimeout(() => { button.textContent = original; }, 1800);
  });
}

/* لو لم تُحمَّل وحدة شاشة التحميل لأي سبب، حرّر الموقع */
if (!root.classList.contains('app-ready')) {
  setTimeout(() => {
    if (!root.classList.contains('app-ready')) {
      root.classList.remove('splash-lock');
      root.classList.add('app-ready');
      document.querySelector('[data-splash]')?.remove();
    }
  }, 8000);
}
