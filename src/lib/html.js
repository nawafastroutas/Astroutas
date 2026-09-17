/** توليد HTML آمن: كل قيمة مُدرَجة تُهرَّب إلا ما وُسِم صراحةً بـ raw(). */

export function esc(value) {
  if (value === null || value === undefined || value === false) return '';
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export class Raw {
  constructor(value) { this.value = String(value); }
  toString() { return this.value; }
}

export const raw = (value) => new Raw(value);

function render(value) {
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return esc(value);
}

/** قالب موسوم: html`<p>${userInput}</p>` */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** سمة اختيارية: attr('value', x) تُحذف كلّيًا إن كانت القيمة فارغة. */
export const attr = (name, value) =>
  (value === null || value === undefined || value === false || value === '')
    ? raw('')
    : raw(`${name}="${esc(value)}"`);

/**
 * إدراج شرطي. مرّر دالّة عندما يشير المحتوى إلى قيمة قد تكون null،
 * لأنّ الوسيط العادي يُقيَّم قبل استدعاء الدالّة.
 */
export const when = (cond, value) =>
  (cond ? (typeof value === 'function' ? value() : value) : raw(''));

/** تهريب داخل <script> — يمنع إغلاق الوسم مبكّرًا. */
export const jsonScript = (data) =>
  raw(JSON.stringify(data).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e'));
