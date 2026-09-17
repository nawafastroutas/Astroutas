/** أدوات الصياغة العربية: الأرقام العربية-الهندية، وصيغ العدد والمعدود. */

const DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** يحوّل أرقام النصّ إلى أرقام عربية-هندية. */
export const arabicDigits = (value) =>
  String(value).replace(/\d/g, (d) => DIGITS[Number(d)]);

/** رقم بفواصل الآلاف ثم بأرقام عربية: 1200 ← ١٬٢٠٠ */
export const arabicNumber = (value) =>
  arabicDigits(Number(value ?? 0).toLocaleString('en-US')).replace(/,/g, '٬');

/**
 * العدد والمعدود حسب قواعد العربية.
 * @param {number} count
 * @param {{zero?:string, one:string, two:string, few:string, many:string}} forms
 * @example arabicCount(5, {one:'نقطة', two:'نقطتان', few:'نقاط', many:'نقطة'}) ← "٥ نقاط"
 */
export function arabicCount(count, forms) {
  const n = Number(count ?? 0);
  if (n === 0 && forms.zero) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const rest = n % 100;
  if (rest >= 3 && rest <= 10) return `${arabicNumber(n)} ${forms.few}`;
  return `${arabicNumber(n)} ${forms.many}`;
}

export const points = (n) => arabicCount(n, {
  zero: 'بلا نقاط', one: 'نقطة واحدة', two: 'نقطتان', few: 'نقاط', many: 'نقطة',
});
export const seats = (n) => arabicCount(n, {
  zero: 'لا مقاعد', one: 'مقعد واحد', two: 'مقعدان', few: 'مقاعد', many: 'مقعدًا',
});
export const members = (n) => arabicCount(n, {
  zero: 'لا أعضاء', one: 'عضو واحد', two: 'عضوان', few: 'أعضاء', many: 'عضوًا',
});
export const minutes = (n) => arabicCount(n, {
  one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة',
});
export const times = (n) => arabicCount(n, {
  zero: 'لا حضور', one: 'مرّة واحدة', two: 'مرّتان', few: 'مرّات', many: 'مرّة',
});

export const rows = (n) => arabicCount(n, {
  zero: 'لا صفوف', one: 'صفّ واحد', two: 'صفّان', few: 'صفوف', many: 'صفًّا',
});
export const events = (n) => arabicCount(n, {
  zero: 'لا فعاليات', one: 'فعالية واحدة', two: 'فعاليتان', few: 'فعاليات', many: 'فعالية',
});
