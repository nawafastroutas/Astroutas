/**
 * تحقّق من مدخلات التسجيل — كل رسالة موجَّهة للمستخدم بالعربية.
 * كل دالة تُعيد { ok, value } أو { ok:false, message }.
 */
import config from '../config.js';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية والفارسية إلى أرقام لاتينية، ويزيل المحارف الخفيّة. */
export function normalizeDigits(input) {
  return String(input ?? '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EXT_ARABIC_INDIC.indexOf(d)));
}

const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, message });

/* ----------------------------- الاسم الثلاثي ----------------------------- */
/** ثلاث كلمات فأكثر، كل كلمة حرفان فأكثر، حروف فقط، 70 حرفًا حدًّا أقصى. */
export function validateName(input) {
  const cleaned = String(input ?? '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fail('الاسم مطلوب.');
  if (cleaned.length > 70) return fail('الاسم طويل — الحدّ الأقصى ٧٠ حرفًا.');
  if (/[0-9٠-٩۰-۹]/.test(cleaned)) return fail('الاسم يُكتب بالحروف فقط، بلا أرقام.');

  const words = cleaned.split(' ');
  if (words.length < 3) return fail('اكتب الاسم الثلاثي كاملًا (ثلاث كلمات فأكثر).');

  for (const word of words) {
    if (!/^[\p{L}\p{M}]+$/u.test(word)) return fail('الاسم يُكتب بالحروف فقط، بلا أرقام أو رموز.');
    if ([...word.replace(/\p{M}/gu, '')].length < 2) return fail('كل كلمة في الاسم حرفان فأكثر.');
  }
  return ok(cleaned);
}

/* -------------------------------- الجوال -------------------------------- */
/**
 * ثمانية أرقام عُمانية (تبدأ بـ ٧ أو ٩)، أو رقم دولي بمفتاح الدولة.
 * تُقبل الأرقام العربية وتُحوَّل. الصيغة المخزَّنة: ‎+968xxxxxxxx
 */
export function validatePhone(input) {
  let s = normalizeDigits(input).replace(/[\s\-().]/g, '').trim();
  if (!s) return fail('رقم الجوال مطلوب.');

  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (/^968\d{8}$/.test(s)) s = `+${s}`;

  if (s.startsWith('+')) {
    const digits = s.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return fail('الرقم الدولي غير صحيح — اكتبه مع مفتاح الدولة، مثال: ‎+968xxxxxxxx');
    if (digits.startsWith('968')) {
      const local = digits.slice(3);
      if (!/^[79]\d{7}$/.test(local)) {
        return fail('رقم الجوال العُماني يبدأ بـ ٧ أو ٩ ويتكوّن من ثمانية أرقام.');
      }
      return ok(`+968${local}`);
    }
    return ok(`+${digits}`);
  }

  if (/^\d{8}$/.test(s)) {
    if (!/^[79]/.test(s)) return fail('رقم الجوال العُماني يبدأ بـ ٧ أو ٩ ويتكوّن من ثمانية أرقام.');
    return ok(`+968${s}`);
  }

  return fail('اكتب ثمانية أرقام عُمانية، أو رقمًا دوليًّا مع مفتاح الدولة.');
}

/** عرض ودّي: ‎+968 9123 4567 */
export function formatPhone(stored) {
  const m = /^\+968(\d{4})(\d{4})$/.exec(String(stored || ''));
  return m ? `+968 ${m[1]} ${m[2]}` : String(stored || '');
}

/* ----------------------------- الرقم الجامعي ---------------------------- */
export function validateStudentId(input) {
  const s = normalizeDigits(input).replace(/[\s\-]/g, '').trim();
  if (!s) return fail('الرقم الجامعي مطلوب.');
  if (!/^\d+$/.test(s)) return fail('الرقم الجامعي أرقام فقط.');
  if (s.length < 5 || s.length > 12) return fail('الرقم الجامعي من ٥ إلى ١٢ خانة.');
  return ok(s);
}

/* ------------------------------- الإيميل -------------------------------- */
export function validateEmail(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return fail('الإيميل الجامعي مطلوب.');
  if (!/^[a-z0-9]([a-z0-9._%+-]*[a-z0-9])?@[a-z0-9.-]+$/.test(s)) return fail('صيغة الإيميل غير صحيحة.');
  if (!s.endsWith(config.emailDomain)) {
    return fail(`لا بدّ أن ينتهي الإيميل بنطاق الجامعة ${config.emailDomain}`);
  }
  return ok(s);
}

/* ------------------------------- التخصّص -------------------------------- */
export function validateMajor(input) {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return fail('التخصّص مطلوب.');
  if (s.length > 60) return fail('التخصّص طويل — الحدّ الأقصى ٦٠ حرفًا.');
  return ok(s);
}

/* ------------------------- نصوص عامّة (نماذج) --------------------------- */
export function validateText(input, { label = 'الحقل', min = 1, max = 2000, required = true } = {}) {
  const s = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!s) return required ? fail(`${label} مطلوب.`) : ok('');
  if (s.length < min) return fail(`${label} قصير جدًّا.`);
  if (s.length > max) return fail(`${label} طويل — الحدّ الأقصى ${max} حرفًا.`);
  return ok(s);
}

/** رابط خارجي: http/https فقط (يمنع javascript: وغيرها). */
export function validateUrl(input, { required = false, label = 'الرابط' } = {}) {
  const s = String(input ?? '').trim();
  if (!s) return required ? fail(`${label} مطلوب.`) : ok('');
  let url;
  try { url = new URL(s); } catch { return fail(`${label} غير صحيح — ابدأه بـ https://`); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail(`${label} غير صحيح — ابدأه بـ https://`);
  return ok(url.toString());
}

export function validateInt(input, { label = 'الرقم', min = 0, max = 1e9, fallback = null } = {}) {
  const s = normalizeDigits(input).trim();
  if (s === '') {
    if (fallback !== null) return ok(fallback);
    return fail(`${label} مطلوب.`);
  }
  if (!/^-?\d+$/.test(s)) return fail(`${label} يجب أن يكون رقمًا.`);
  const n = Number(s);
  if (n < min || n > max) return fail(`${label} خارج المدى المسموح (${min}–${max}).`);
  return ok(n);
}

/** رسائل التكرار — محدَّدة لكل حقل، لا رسالة قاعدة بيانات. */
export const DUPLICATE_MESSAGES = {
  'members.phone': 'هذا الرقم مسجّل بعضوية أخرى.',
  'members.student_id': 'هذا الرقم الجامعي مسجّل بعضوية أخرى.',
  'members.email': 'هذا الإيميل مسجّل بعضوية أخرى.',
  'tickets.member_id, tickets.event_id': 'لديك تذكرة في هذه الفعالية بالفعل.',
  'attendances.ticket_id': 'هذه التذكرة ممسوحة من قبل.',
};

export function duplicateMessage(constraint) {
  return DUPLICATE_MESSAGES[constraint] || 'هذه البيانات مسجّلة مسبقًا.';
}
