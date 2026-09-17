/**
 * زرّ التقييم: يمنح النقاط أولًا ثم يفتح الاستبيان.
 * رابط الاستبيان لا يوجد في الصفحة — يصل فقط في ردّ هذا الطلب.
 */
for (const form of document.querySelectorAll('form[data-evaluate]')) {
  const status = form.querySelector('[data-evaluate-status]');
  const button = form.querySelector('button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    if (status) status.textContent = 'جارٍ التسجيل…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (status) status.textContent = data.message || 'تعذّر التقييم.';
        button.disabled = false;
        return;
      }
      if (status) status.textContent = data.message;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => { window.location.assign(data.url); }, reduced ? 0 : 900);
    } catch {
      if (status) status.textContent = 'تعذّر الاتصال. حاول مرّة أخرى.';
      button.disabled = false;
    }
  });
}
