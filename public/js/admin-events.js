/** القوالب الجاهزة: تملأ نموذج الفعالية وتقترح موعدًا قادمًا. */
import './upload.js';

const node = document.querySelector('[data-templates]');
if (node) {
  const templates = JSON.parse(node.textContent);

  /** يقترح الثلاثاء القادم الساعة ٦ مساءً بتوقيت عُمان. */
  function suggestedStart() {
    const now = new Date();
    const oman = new Date(now.getTime() + (4 * 60 + now.getTimezoneOffset()) * 60000);
    const daysAhead = ((2 - oman.getDay() + 7) % 7) || 7;      // ٢ = الثلاثاء
    oman.setDate(oman.getDate() + daysAhead);
    oman.setHours(18, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${oman.getFullYear()}-${pad(oman.getMonth() + 1)}-${pad(oman.getDate())}T${pad(oman.getHours())}:${pad(oman.getMinutes())}`;
  }

  function addHours(value, hours) {
    const [date, time] = value.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh + hours, mm);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }

  for (const button of document.querySelectorAll('[data-template]')) {
    button.addEventListener('click', () => {
      const tpl = templates[Number(button.dataset.template)];
      if (!tpl) return;
      const start = suggestedStart();
      const values = { ...tpl, starts_at: start, ends_at: addHours(start, tpl.durationHours || 2) };
      for (const field of document.querySelectorAll('[data-tpl]')) {
        const key = field.dataset.tpl;
        if (values[key] !== undefined) field.value = values[key];
      }
      document.querySelector('[data-tpl="title"]')?.focus();
    });
  }
}
