/** فحوص قواعد التسجيل والتحقّق من المدخلات. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateName, validatePhone, validateStudentId, validateEmail, validateMajor,
  validateUrl, validateInt, normalizeDigits, formatPhone,
} from '../src/lib/validate.js';

test('الاسم: ثلاث كلمات فأكثر، كل كلمة حرفان، حروف فقط، ٧٠ حرفًا', () => {
  assert.equal(validateName('نواف بن سعيد المقبالي').value, 'نواف بن سعيد المقبالي');
  assert.equal(validateName('  ريم   خالد   الهنائية ').value, 'ريم خالد الهنائية');
  assert.equal(validateName('Ahmed Ali Al Balushi').ok, true, 'الحروف اللاتينية مقبولة');

  assert.match(validateName('نواف المقبالي').message, /ثلاث كلمات/);
  assert.match(validateName('').message, /مطلوب/);
  assert.match(validateName('نواف ب المقبالي').message, /حرفان/);
  assert.match(validateName('نواف 2 المقبالي').message, /بلا أرقام/);
  assert.match(validateName('نواف @ المقبالي').message, /رموز/);
  assert.match(validateName('نواف سعيد ٣ المقبالي').message, /بلا أرقام/, 'الأرقام العربية أيضًا');
  assert.match(validateName(`${'ا'.repeat(30)} ${'ب'.repeat(30)} ${'ت'.repeat(30)}`).message, /٧٠ حرفًا/);
});

test('الجوال: ثمانية أرقام عُمانية أو دولي، وتُقبل الأرقام العربية', () => {
  assert.equal(validatePhone('91234567').value, '+96891234567');
  assert.equal(validatePhone('٩١٢٣٤٥٦٧').value, '+96891234567', 'أرقام عربية');
  assert.equal(validatePhone('۹۱۲۳۴۵۶۷').value, '+96891234567', 'أرقام فارسية');
  assert.equal(validatePhone('+968 9123 4567').value, '+96891234567');
  assert.equal(validatePhone('00968-91234567').value, '+96891234567');
  assert.equal(validatePhone('96891234567').value, '+96891234567');
  assert.equal(validatePhone('71234567').value, '+96871234567');
  assert.equal(validatePhone('+971501234567').value, '+971501234567', 'دولي');

  assert.match(validatePhone('11234567').message, /يبدأ بـ ٧ أو ٩/);
  assert.match(validatePhone('912345').message, /ثمانية أرقام/);
  assert.match(validatePhone('9123456789').message, /ثمانية أرقام/);
  assert.match(validatePhone('').message, /مطلوب/);
  assert.match(validatePhone('abcdefgh').message, /ثمانية أرقام/);
  assert.equal(formatPhone('+96891234567'), '+968 9123 4567');
});

test('الرقم الجامعي: أرقام فقط من ٥ إلى ١٢ خانة', () => {
  assert.equal(validateStudentId('20231234').value, '20231234');
  assert.equal(validateStudentId('٢٠٢٣١٢٣٤').value, '20231234');
  assert.match(validateStudentId('1234').message, /٥ إلى ١٢/);
  assert.match(validateStudentId('1234567890123').message, /٥ إلى ١٢/);
  assert.match(validateStudentId('2023abc').message, /أرقام فقط/);
});

test('الإيميل: نطاق الجامعة فقط', () => {
  assert.equal(validateEmail('Nawaf@UTAS.edu.om').value, 'nawaf@utas.edu.om', 'يُخفَّض الحرف');
  assert.equal(validateEmail('a.b-c_1@utas.edu.om').ok, true);
  assert.match(validateEmail('nawaf@gmail.com').message, /@utas\.edu\.om/);
  assert.match(validateEmail('nawaf@utas.edu.om.evil.com').message, /@utas\.edu\.om/);
  assert.match(validateEmail('بلا-قرد').message, /صيغة/);
  assert.match(validateEmail('').message, /مطلوب/);
});

test('التخصّص والروابط والأعداد', () => {
  assert.equal(validateMajor('  اللغة   العربية ').value, 'اللغة العربية');
  assert.match(validateMajor('').message, /مطلوب/);

  assert.equal(validateUrl('https://forms.office.com/r/x').ok, true);
  assert.equal(validateUrl('').value, '', 'اختياري');
  assert.match(validateUrl('javascript:alert(1)').message, /https/);
  assert.match(validateUrl('data:text/html,<script>').message, /https/);

  assert.equal(validateInt('٢٥', { label: 'النقاط' }).value, 25);
  assert.equal(validateInt('', { fallback: 0 }).value, 0);
  assert.match(validateInt('-5', { min: 0 }).message, /المدى/);
  assert.match(validateInt('كثير').message, /رقمًا/);
});

test('تطبيع الأرقام يزيل المحارف الخفيّة', () => {
  assert.equal(normalizeDigits('‏٩١٢‎'), '912');
  assert.equal(normalizeDigits('123'), '123');
});
